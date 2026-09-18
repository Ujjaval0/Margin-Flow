import crypto from "crypto";

export interface VerificationResult {
  isValid: boolean;
  reason?: string;
  latencyMs: number;
}

/**
 * Constant-time comparison between two string digests to prevent timing attacks.
 */
function safeTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verify Shopify Webhook HMAC-SHA256 signature
 * Header: X-Shopify-Hmac-Sha256 (Base64 encoded)
 */
export function verifyShopifyWebhook(
  rawBody: Buffer | string,
  signatureHeader: string | null,
  secret: string
): VerificationResult {
  const start = performance.now();

  if (!signatureHeader || !secret) {
    return {
      isValid: false,
      reason: "Missing signature header or secret key",
      latencyMs: performance.now() - start,
    };
  }

  try {
    const computedHmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const isValid = safeTimingCompare(signatureHeader.trim(), computedHmac);

    return {
      isValid,
      reason: isValid ? undefined : "HMAC signature mismatch",
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  } catch (err: any) {
    return {
      isValid: false,
      reason: `Verification error: ${err.message}`,
      latencyMs: performance.now() - start,
    };
  }
}

/**
 * Verify WooCommerce Webhook HMAC-SHA256 signature
 * Header: x-wc-webhook-signature (Base64 encoded)
 */
export function verifyWooCommerceWebhook(
  rawBody: Buffer | string,
  signatureHeader: string | null,
  secret: string
): VerificationResult {
  const start = performance.now();

  if (!signatureHeader || !secret) {
    return {
      isValid: false,
      reason: "Missing WooCommerce signature header or secret",
      latencyMs: performance.now() - start,
    };
  }

  try {
    const computedHmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const isValid = safeTimingCompare(signatureHeader.trim(), computedHmac);

    return {
      isValid,
      reason: isValid ? undefined : "WooCommerce signature mismatch",
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  } catch (err: any) {
    return {
      isValid: false,
      reason: `Verification error: ${err.message}`,
      latencyMs: performance.now() - start,
    };
  }
}

/**
 * Verify Generic / Custom Channel Webhook Signature
 * Header: X-MarginFlow-Signature (Hex or Base64 encoded)
 */
export function verifyGenericWebhook(
  rawBody: Buffer | string,
  signatureHeader: string | null,
  secret: string
): VerificationResult {
  const start = performance.now();

  if (!signatureHeader || !secret) {
    return {
      isValid: false,
      reason: "Missing signature header or pre-shared secret",
      latencyMs: performance.now() - start,
    };
  }

  try {
    const computedHex = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const computedBase64 = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    const sig = signatureHeader.trim();
    const isValid = safeTimingCompare(sig, computedHex) || safeTimingCompare(sig, computedBase64);

    return {
      isValid,
      reason: isValid ? undefined : "HMAC signature mismatch",
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  } catch (err: any) {
    return {
      isValid: false,
      reason: `Verification error: ${err.message}`,
      latencyMs: performance.now() - start,
    };
  }
}

/**
 * Validate that webhook timestamp is not older than allowed threshold (default: 300s / 5min)
 * Defends against replay attacks.
 */
export function verifyTimestampFreshness(
  timestampHeader: string | null | number,
  maxAgeSeconds: number = 300
): { isFresh: boolean; ageSeconds: number } {
  if (!timestampHeader) {
    return { isFresh: true, ageSeconds: 0 }; // If timestamp is not provided by provider
  }

  let eventEpoch = 0;
  if (typeof timestampHeader === "number") {
    eventEpoch = timestampHeader > 1e11 ? timestampHeader : timestampHeader * 1000;
  } else {
    eventEpoch = new Date(timestampHeader).getTime();
  }

  if (isNaN(eventEpoch) || eventEpoch <= 0) {
    return { isFresh: false, ageSeconds: Infinity };
  }

  const ageSeconds = Math.abs(Math.round((Date.now() - eventEpoch) / 1000));
  return {
    isFresh: ageSeconds <= maxAgeSeconds,
    ageSeconds,
  };
}
