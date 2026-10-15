import { NextRequest } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: session.ts was imported into a client bundle. Cryptographic session verification must remain strictly server-side."
  );
}

export const SESSION_COOKIE_NAME = "marginflow_session_token";
export const DEFAULT_SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  sid: string; // Unique login identity; identical logins must not share a token.
  sub: string; // User ID / merchant account ID
  email: string;
  name?: string;
  accountType?: string;
  companyName?: string;
  iat: number;
  exp: number;
}

// Process-lifetime ephemeral key used ONLY in development when env var is omitted
let _devEphemeralSecret: string | null = null;

function getSessionSecret(): Buffer {
  const envSecret = process.env.SESSION_SECRET || process.env.ENCRYPTION_MASTER_KEY;
  if (envSecret && Buffer.byteLength(envSecret.trim()) >= 32) {
    return crypto.createHash("sha256").update(envSecret.trim()).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL SECURITY CONFIGURATION ERROR: process.env.SESSION_SECRET or ENCRYPTION_MASTER_KEY must be set in production with at least 32 bytes of entropy."
    );
  }

  // Development ephemeral key fallback (generates new random key per server instance)
  if (!_devEphemeralSecret) {
    _devEphemeralSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[Security Warning] No SESSION_SECRET configured. Generated ephemeral session key for development."
    );
  }
  return crypto.createHash("sha256").update(_devEphemeralSecret).digest();
}

/**
 * Base64URL encode buffer/string without padding
 */
function toBase64Url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Base64URL decode string to UTF-8
 */
function fromBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Generates an HMAC-SHA256 signature for data using the server session secret.
 */
function signPayloadString(data: string): string {
  const secret = getSessionSecret();
  const hmac = crypto.createHmac("sha256", secret).update(data).digest();
  return toBase64Url(hmac);
}

/**
 * Issues a cryptographically signed session token for a validated user.
 */
export function signSessionToken(
  user: {
    id: string;
    email: string;
    name?: string;
    accountType?: string;
    companyName?: string;
  },
  expiresInSeconds: number = DEFAULT_SESSION_EXPIRY_SECONDS
): string {
  if (!user.id?.trim() || !user.email?.trim() || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > DEFAULT_SESSION_EXPIRY_SECONDS) throw new Error("Invalid session parameters.");
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sid: crypto.randomUUID(),
    sub: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name,
    accountType: user.accountType,
    companyName: user.companyName,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayloadString(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies the cryptographic HMAC signature and expiry of a session token.
 * Prevents timing attacks with crypto.timingSafeEqual.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string" || token.length > 8192 || token !== token.trim()) return null;

  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    if (parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    const header = JSON.parse(fromBase64Url(headerB64));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    const expectedSig = signPayloadString(`${headerB64}.${payloadB64}`);
    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(signatureB64);

    if (expectedBuf.length !== actualBuf.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return null;
    }

    const payloadJson = fromBase64Url(payloadB64);
    const payload: SessionPayload = JSON.parse(payloadJson);

    // Verify expiration timestamp
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.exp <= now || payload.iat > now || payload.exp <= payload.iat || payload.exp - payload.iat > DEFAULT_SESSION_EXPIRY_SECONDS) {
      return null;
    }

    if (typeof payload.sub !== "string" || !payload.sub.trim() || typeof payload.email !== "string" || !payload.email.trim() || typeof payload.sid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sid)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the authenticated merchant user session from signed HTTP-only cookies
 * or Bearer authorization headers.
 * 
 * SECURITY INVARIANT:
 * - NEVER trusts raw client headers like `x-user-id` from public requests.
 * - NEVER trusts unsigned cookies.
 * - In production, returns null if unauthenticated.
 */
export function getSessionToken(req: NextRequest | Request): string | null {
  try {
    let token: string | undefined;
    if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") token = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
    else {
      const match = req.headers.get("cookie")?.match(/(?:^|;\s*)marginflow_session_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
    if (!token) {
      const auth = req.headers.get("authorization");
      if (auth?.startsWith("Bearer ")) token = auth.slice(7);
    }
    return token && token.length <= 8192 ? token : null;
  } catch { return null; }
}

const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** A signed token only becomes usable after its durable login record is acknowledged. */
export async function issueSessionToken(user: Parameters<typeof signSessionToken>[0]): Promise<string> {
  const token = signSessionToken(user);
  const payload = verifySessionToken(token)!;
  const result = await query(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at) SELECT $1, id::text, to_timestamp($3) FROM user_accounts WHERE id::text = $2 RETURNING token_hash",
    [tokenHash(token), payload.sub, payload.exp]
  );
  if (result.rows.length !== 1) throw new Error("Session could not be registered.");
  return token;
}

/** No process-local active-session cache: a revoked copy must fail on every replica. */
export async function getSessionUser(req: NextRequest | Request): Promise<SessionPayload | null> {
  const token = getSessionToken(req);
  if (token) {
    const payload = verifySessionToken(token);
    if (!payload) return null;
    try {
      const result = await query(
        "SELECT s.user_id FROM auth_sessions s WHERE s.token_hash = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND EXISTS (SELECT 1 FROM user_accounts u WHERE u.id::text = s.user_id)",
        [tokenHash(token), payload.sub]
      );
      return result.rows.length === 1 ? payload : null;
    } catch { return null; }
  }
  // Explicit internal-service authentication is independent of human browser sessions.
  const internalSecret = process.env.INTERNAL_SERVICE_KEY;
  const providedKey = req.headers.get("x-internal-service-key");
  const providedUser = req.headers.get("x-user-id")?.trim();
  if (internalSecret && internalSecret.trim().length >= 32 && providedKey && providedUser) {
    const expected = Buffer.from(internalSecret), actual = Buffer.from(providedKey);
    if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) return {
      sid: "internal-service", sub: providedUser, email: "internal-service@marginflow.io", accountType: "SYSTEM",
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }
  return null;
}

/** Returns null for unsigned, unregistered, expired or revoked sessions, including outages. */
export async function getSessionUserId(req: NextRequest | Request): Promise<string | null> {
  return (await getSessionUser(req))?.sub ?? null;
}

/** Idempotent revocation commits before the logout endpoint clears the browser cookie. */
export async function revokeSessionToken(token: string): Promise<void> {
  const payload = verifySessionToken(token);
  if (!payload) return;
  await query("UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL", [tokenHash(token), payload.sub]);
}

/**
 * Returns cookie options for setting the signed session token.
 */
export function getSessionCookieOptions(expiresInSeconds: number = DEFAULT_SESSION_EXPIRY_SECONDS) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: expiresInSeconds,
  };
}
