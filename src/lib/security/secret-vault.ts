/**
 * Server-Only Secret Vault
 * Enforces zero-trust isolation of API keys, webhook signing secrets,
 * and sensitive merchant credentials.
 *
 * INVARIANT: This module MUST NEVER execute in a client/browser environment.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: secret-vault.ts was imported into a client-side bundle. API secrets must remain strictly server-side."
  );
}

export interface WebhookSecrets {
  shopifySecret: string;
  woocommerceSecret: string;
  amazonSecret: string;
  genericSecret: string;
}

// Development default fallback tokens used ONLY when process.env variables are not configured.
// In production, these should be supplied via secure environment variables.
const DEV_FALLBACK_SECRETS: WebhookSecrets = {
  shopifySecret: "shpss_dev_test_secret_39f018a7c2b4e891",
  woocommerceSecret: "wc_secret_dev_key_88b19e20a37fc6",
  amazonSecret: "amzn_sns_secret_token_719a8d92e10",
  genericSecret: "mf_generic_webhook_sec_49103e87a2",
};

/**
 * Retrieve configured webhook signing secret with strict boundary protection.
 * Never exposes the raw environment variable map.
 */
export function getWebhookSecret(
  channel: "shopify" | "woocommerce" | "amazon" | "generic"
): string {
  switch (channel) {
    case "shopify":
      return process.env.SHOPIFY_WEBHOOK_SECRET || DEV_FALLBACK_SECRETS.shopifySecret;
    case "woocommerce":
      return process.env.WOOCOMMERCE_WEBHOOK_SECRET || DEV_FALLBACK_SECRETS.woocommerceSecret;
    case "amazon":
      return process.env.AMAZON_WEBHOOK_SECRET || DEV_FALLBACK_SECRETS.amazonSecret;
    case "generic":
      return process.env.GENERIC_WEBHOOK_SECRET || DEV_FALLBACK_SECRETS.genericSecret;
    default:
      throw new Error(`Unknown webhook channel requested: ${channel}`);
  }
}
