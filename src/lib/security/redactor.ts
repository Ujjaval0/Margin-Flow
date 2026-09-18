/**
 * Zero-Leakage Data Redactor & Sanitizer
 * Recursively sanitizes data objects, headers, and error messages
 * ensuring API keys, secrets, tokens, and authorization credentials
 * are NEVER leaked into error responses, browser network tabs, or server logs.
 */

const SENSITIVE_KEY_PATTERNS = [
  /secret/i,
  /key/i,
  /token/i,
  /password/i,
  /authorization/i,
  /auth/i,
  /bearer/i,
  /signature/i,
  /hmac/i,
  /credential/i,
  /private/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /shpss_[a-zA-Z0-9_-]+/g,            // Shopify secrets
  /shpat_[a-zA-Z0-9_-]+/g,            // Shopify access tokens
  /wc_secret_[a-zA-Z0-9_-]+/g,        // WooCommerce secrets
  /AIza[0-9A-Za-z-_]{35}/g,           // Google API Keys
  /sk-[a-zA-Z0-9]{32,}/g,             // OpenAI API Keys
  /AKIA[0-9A-Z]{16}/g,                // AWS Access Key ID
];

/**
 * Deeply scrub sensitive fields and token patterns from an object or string
 */
export function redactSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    let sanitized: string = input;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
    }
    return sanitized as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redactSensitiveData(value);
      }
    }
    return output as T;
  }

  return input;
}

/**
 * Format a safe error response for public HTTP endpoints
 */
export function formatSafeErrorResponse(error: any, fallbackMessage: string = "Request processing error") {
  const message = typeof error?.message === "string" ? error.message : fallbackMessage;
  const sanitizedMessage = redactSensitiveData(message);

  return {
    success: false,
    error: sanitizedMessage,
    timestamp: new Date().toISOString(),
  };
}
