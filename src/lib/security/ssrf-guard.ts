import dns from "dns/promises";
import net from "net";
import https from "https";
import http from "http";
import { Readable, Transform } from "stream";

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: ssrf-guard.ts was imported into a client bundle. Network boundary validation must remain strictly server-side."
  );
}

export interface SsrValidationResult {
  isSafe: boolean;
  reason?: string;
  resolvedIp?: string;
  normalizedUrl?: string;
}

/**
 * Checks if an IPv4 address belongs to a private, loopback, multicast, or cloud-metadata range.
 */
function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP is disallowed
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link Local / Cloud Metadata Service: 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 – 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Network Benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast: 224 - 239)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use: 240 - 255)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unique local, link-local, or IPv4-mapped private.
 */
function isDisallowedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // WHATWG URL normalizes IPv4-mapped IPv6 into hexadecimal words.
  const mappedHex = normalized.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    return isDisallowedIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  // Only global-unicast IPv6 is permitted (also excludes multicast/tunnels).
  if (!/^[23]/.test(normalized)) return true;

  // ::1 / Loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // Unspecified ::
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

  // Unique Local Address fc00::/7 (fc00:: - fdff::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-Local fe80::/10
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // IPv4-mapped IPv6 address (::ffff:192.168.1.1)
  const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4MappedMatch) {
    return isDisallowedIpv4(ipv4MappedMatch[1]);
  }

  return false;
}

/**
 * Validates whether an outbound destination URL is safe to fetch from server-side code.
 * Blocks all SSRF attempts against cloud metadata, local services, and private RFC 1918 subnets.
 */
export async function validateSafeOutboundUrl(
  rawUrl: string,
  options?: {
    allowHttpInDevelopment?: boolean;
    allowedProtocols?: string[];
  }
): Promise<SsrValidationResult> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { isSafe: false, reason: "Missing or invalid URL parameter." };
  }

  let parsed: URL;
  try {
    let toParse = rawUrl.trim();
    if (!toParse.startsWith("http://") && !toParse.startsWith("https://")) {
      toParse = `https://${toParse}`;
    }
    parsed = new URL(toParse);
  } catch {
    return { isSafe: false, reason: "Malformed URL syntax." };
  }

  // 1. Protocol Validation
  const allowedProtocols = options?.allowedProtocols || ["https:", "http:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      isSafe: false,
      reason: `Disallowed protocol "${parsed.protocol}". Only HTTPS is permitted.`,
    };
  }

  // In production, strictly enforce HTTPS
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return {
      isSafe: false,
      reason: "Insecure HTTP connection disallowed in production. HTTPS is strictly required.",
    };
  }

  // 2. Reject credentials embedded in URL (e.g. https://user:pass@evil.com)
  if (parsed.username || parsed.password) {
    return {
      isSafe: false,
      reason: "Embedded credentials in URL are prohibited.",
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

  // 3. Direct literal IP checks
  if (net.isIPv4(hostname)) {
    if (isDisallowedIpv4(hostname)) {
      return {
        isSafe: false,
        reason: `Target IP address ${hostname} is restricted (private subnet or cloud metadata).`,
      };
    }
  } else if (net.isIPv6(hostname)) {
    if (isDisallowedIpv6(hostname)) {
      return {
        isSafe: false,
        reason: `Target IPv6 address ${hostname} is restricted (loopback, local, or private address).`,
      };
    }
  } else {
    // 4. Hostname Blacklist (localhost, internal, metadata domain names)
    const blockedHostnames = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "instance-data",
      "metadata.google.internal",
      "metadata.internal",
    ];

    if (blockedHostnames.includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      // In development only, allow explicit localhost testing if requested
      if (
        process.env.NODE_ENV !== "production" &&
        options?.allowHttpInDevelopment &&
        (hostname === "localhost" || hostname === "127.0.0.1")
      ) {
        // Allowed in dev for local mock servers
      } else {
        return {
          isSafe: false,
          reason: `Target hostname "${hostname}" is restricted.`,
        };
      }
    }

    // 5. DNS Resolution Pinning & Verification
    try {
      const lookupResults = await dns.lookup(hostname, { all: true });
      if (!lookupResults || lookupResults.length === 0) {
        return { isSafe: false, reason: `Could not resolve hostname "${hostname}".` };
      }

      for (const record of lookupResults) {
        if (record.family === 4 && isDisallowedIpv4(record.address)) {
          return {
            isSafe: false,
            reason: `Hostname "${hostname}" resolved to restricted private IP ${record.address}.`,
            resolvedIp: record.address,
          };
        }
        if (record.family === 6 && isDisallowedIpv6(record.address)) {
          return {
            isSafe: false,
            reason: `Hostname "${hostname}" resolved to restricted IPv6 ${record.address}.`,
            resolvedIp: record.address,
          };
        }
      }

      return {
        isSafe: true,
        resolvedIp: lookupResults[0].address,
        normalizedUrl: parsed.toString(),
      };
    } catch (dnsErr: any) {
      return {
        isSafe: false,
        reason: `DNS resolution failed for "${hostname}": ${dnsErr.message}`,
      };
    }
  }

  return {
    isSafe: true,
    resolvedIp: hostname,
    normalizedUrl: parsed.toString(),
  };
}

/**
 * Safe fetch wrapper that enforces SSRF guard validation before making outbound requests.
 */
export async function safeOutboundFetch(
  rawUrl: string,
  init?: RequestInit,
  options?: { allowHttpInDevelopment?: boolean }
): Promise<Response> {
  const validation = await validateSafeOutboundUrl(rawUrl, options);
  if (!validation.isSafe) {
    throw new Error(`SSRF_GUARD_REJECTED: ${validation.reason}`);
  }

  const targetUrl = new URL(validation.normalizedUrl || rawUrl);
  const address = validation.resolvedIp;
  if (!address || !net.isIP(address)) throw new Error("SSRF_GUARD_REJECTED: No validated destination.");
  if (init?.body != null && typeof init.body !== "string" && !(init.body instanceof Uint8Array)) {
    throw new Error("Unsupported outbound request body.");
  }
  const headers = new Headers(init?.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("accept-encoding", "identity");
  const transport = targetUrl.protocol === "https:" ? https : http;
  return new Promise<Response>((resolve, reject) => {
    const outgoing = transport.request(targetUrl, {
      method: init?.method || "GET",
      headers: Object.fromEntries(headers.entries()),
      agent: false,
      // Pin the validated destination while preserving hostname/SNI verification.
      lookup: (_hostname, lookupOptions, callback) => {
        const family = net.isIP(address);
        if (lookupOptions.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
    }, (incoming) => {
      const status = incoming.statusCode || 502;
      // Never follow redirects with credentials or into a different network.
      if (status >= 300 && status < 400) {
        incoming.destroy();
        reject(new Error("SSRF_GUARD_REJECTED: Outbound redirects are prohibited."));
        return;
      }
      if (incoming.headers["content-encoding"] && incoming.headers["content-encoding"] !== "identity") {
        incoming.destroy();
        reject(new Error("Unsupported outbound content encoding."));
        return;
      }
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      let received = 0;
      const bounded = new Transform({ transform(chunk, _encoding, callback) {
        received += chunk.length;
        callback(received > 20 * 1024 * 1024 ? new Error("Outbound response exceeds 20MB.") : null, chunk);
      }});
      incoming.on("error", (error) => bounded.destroy(error));
      bounded.on("close", () => incoming.destroy());
      incoming.pipe(bounded);
      const body = [204, 205, 304].includes(status) || init?.method === "HEAD"
        ? null : Readable.toWeb(bounded) as ReadableStream<Uint8Array>;
      if (body === null) incoming.resume();
      resolve(new Response(body, { status, headers: responseHeaders }));
    });
    outgoing.on("error", reject);
    outgoing.end(init?.body ?? undefined);
  });
}
