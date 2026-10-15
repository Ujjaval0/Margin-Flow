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

// Development default fallback tokens used ONLY in local development
const DEV_FALLBACK_SECRETS: WebhookSecrets = {
  shopifySecret: "shpss_dev_test_secret_39f018a7c2b4e891",
  woocommerceSecret: "wc_secret_dev_key_88b19e20a37fc6",
  amazonSecret: "amzn_sns_secret_token_719a8d92e10",
  genericSecret: "mf_generic_webhook_sec_49103e87a2",
};

/**
 * Retrieve configured webhook signing secret with strict boundary protection.
 * In production, strictly returns configured environment variables and never leaks dev tokens.
 */
export function getWebhookSecret(
  channel: "shopify" | "woocommerce" | "amazon" | "generic"
): string {
  let envSecret = "";
  switch (channel) {
    case "shopify":
      envSecret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
      break;
    case "woocommerce":
      envSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || "";
      break;
    case "amazon":
      envSecret = process.env.AMAZON_WEBHOOK_SECRET || "";
      break;
    case "generic":
      envSecret = process.env.GENERIC_WEBHOOK_SECRET || "";
      break;
    default:
      throw new Error(`Unknown webhook channel requested: ${channel}`);
  }

  if (envSecret && envSecret.trim()) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      `[Security Alert] Webhook secret for ${channel} is not configured in production environment. Webhook signature verification will safely reject incoming events.`
    );
    return "";
  }

  return DEV_FALLBACK_SECRETS[`${channel}Secret` as keyof WebhookSecrets];
}
