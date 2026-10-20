import { normalizeShopifyDomain } from "@/lib/security/shopify-domain";

export const API_PLATFORMS = ["Amazon India", "Flipkart", "Shopify", "WooCommerce"] as const;
export type ApiPlatform = typeof API_PLATFORMS[number];

export class ConnectionInputError extends Error {}

const FIELDS: Record<ApiPlatform, string[]> = {
  "Amazon India": ["clientId", "clientSecret", "refreshToken", "sellerId"],
  Flipkart: ["appId", "appSecret"],
  Shopify: ["shopDomain", "accessToken", "clientId", "clientSecret", "webhookSecret"],
  WooCommerce: ["storeUrl", "consumerKey", "consumerSecret", "webhookSecret"],
};

/** Blank fields mean retain the saved value. Browser input cannot set token/verification metadata. */
export function connectionInput(marketplace: string, input: unknown, previous: Record<string, any> = {}) {
  if (!API_PLATFORMS.includes(marketplace as ApiPlatform)) {
    throw new ConnectionInputError("Direct API setup is unavailable for this channel. Use its official report import.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ConnectionInputError("Enter the store credentials.");
  const platform = marketplace as ApiPlatform;
  const credentials = { ...previous };
  for (const [key, raw] of Object.entries(input)) {
    if (!FIELDS[platform].includes(key)) throw new ConnectionInputError("Unsupported credential field.");
    if (typeof raw !== "string" || raw.length > 8192 || /[\r\n\0]/.test(raw)) throw new ConnectionInputError("Invalid credential value.");
    if (raw.trim()) credentials[key] = raw.trim();
  }
  const required = platform === "Amazon India" ? ["clientId", "clientSecret", "refreshToken"]
    : platform === "Flipkart" ? ["appId", "appSecret"]
    : platform === "WooCommerce" ? ["storeUrl", "consumerKey", "consumerSecret"] : ["shopDomain"];
  if (required.some(key => !credentials[key])) throw new ConnectionInputError("Complete the required store credentials.");
  if (platform === "Flipkart" && ((input as any).appId?.trim() || (input as any).appSecret?.trim())) {
    for (const field of ["clientId", "clientSecret", "accessToken", "refreshToken", "tokenExpiresAt", "refreshTokenExpiresAt"]) delete credentials[field];
  }
  if (platform === "Shopify") {
    try { credentials.shopDomain = normalizeShopifyDomain(credentials.shopDomain); }
    catch { throw new ConnectionInputError("Enter the store's .myshopify.com domain."); }
    if (!credentials.accessToken && !(credentials.clientId && credentials.clientSecret)) {
      throw new ConnectionInputError("Authorize Shopify or provide a valid Admin token or own-organization app credentials.");
    }
    // Changing app credentials invalidates the old token; obtain a fresh one during verification.
    if ((input as any).clientId?.trim() || (input as any).clientSecret?.trim()) {
      delete credentials.accessToken; delete credentials.refreshToken; delete credentials.tokenExpiresAt;
      credentials.authMode = "CLIENT_CREDENTIALS";
      if ((input as any).clientSecret?.trim() && !(input as any).webhookSecret?.trim()) credentials.webhookSecret = credentials.clientSecret;
    } else if ((input as any).accessToken?.trim()) {
      delete credentials.refreshToken; delete credentials.tokenExpiresAt;
      credentials.authMode = "ADMIN_TOKEN";
    }
  }
  if (platform === "WooCommerce") {
    if ((input as any).consumerSecret?.trim() && !(input as any).webhookSecret?.trim() && previous.webhookSecret === previous.consumerSecret) {
      credentials.webhookSecret = credentials.consumerSecret;
    }
    let url: URL;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(credentials.storeUrl) ? credentials.storeUrl : `https://${credentials.storeUrl}`); }
    catch { throw new ConnectionInputError("Enter a valid HTTPS store URL."); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new ConnectionInputError("Enter the canonical HTTPS store URL without credentials or query parameters.");
    credentials.storeUrl = url.toString().replace(/\/+$/, "");
  }
  return { platform, credentials };
}
