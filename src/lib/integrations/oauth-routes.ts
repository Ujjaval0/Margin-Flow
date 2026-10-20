import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { createOAuthState, verifyAndConsumeOAuthState } from "@/lib/security/oauth-state";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { normalizeShopifyDomain } from "@/lib/security/shopify-domain";
import { getConnectionsForUser, saveConnection } from "@/lib/security/marketplace-vault";
import { safeOutboundFetch } from "@/lib/security/ssrf-guard";
import { flipkartToken, shopifyTokenResponse } from "./provider-auth";
import { providerFetch } from "./provider-http";
import { providerOperation } from "./connection-service";
import { flipkartOAuthConfig } from "./flipkart-oauth";
import type { ApiPlatform } from "./connection-input";

type OAuthProvider = "amazon" | "flipkart" | "shopify";
const names: Record<OAuthProvider, ApiPlatform> = { amazon: "Amazon India", flipkart: "Flipkart", shopify: "Shopify" };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

function config(provider: OAuthProvider, requestUrl: string) {
  if (provider === "flipkart") return flipkartOAuthConfig(requestUrl);
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`];
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Provider app configuration is required.");
  const url = new URL(redirectUri);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Configure the registered HTTPS callback URL.");
  return { clientId, clientSecret, redirectUri };
}

export function validShopifyCallback(params: URLSearchParams, secret: string) {
  if (Array.from(new Set(params.keys())).some(key => params.getAll(key).length !== 1)) return false;
  const supplied = params.get("hmac") || "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const message = Array.from(params.entries()).filter(([key]) => key !== "hmac").sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("&");
  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export async function beginOAuth(request: Request, provider: OAuthProvider) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const owner = await getSessionUserId(request);
  if (!owner) return NextResponse.json({ success: false, error: "Sign in before connecting a store." }, { status: 401, headers });
  try {
    const app = config(provider, request.url);
    const query = new URL(request.url).searchParams;
    const shop = provider === "shopify" ? normalizeShopifyDomain(query.get("shop") || "") : "";
    const binding = { clientId: app.clientId + (shop ? `@${shop}` : ""), redirectUri: app.redirectUri };
    const state = await createOAuthState(owner, names[provider], 10 * 60000, binding);
    const url = new URL(provider === "shopify" ? `https://${shop}/admin/oauth/authorize`
      : provider === "amazon" ? "https://sellercentral.amazon.in/apps/authorize/consent" : "https://api.flipkart.net/oauth-service/oauth/authorize");
    url.searchParams.set("state", state);
    if (provider === "amazon") {
      if (!process.env.AMAZON_APPLICATION_ID) throw new Error("Amazon app registration is required.");
      url.searchParams.set("application_id", process.env.AMAZON_APPLICATION_ID);
      if (process.env.AMAZON_APP_BETA === "1") url.searchParams.set("version", "beta");
    } else {
      url.searchParams.set("client_id", app.clientId); url.searchParams.set("redirect_uri", app.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", provider === "flipkart" ? "Seller_Api" : process.env.SHOPIFY_SCOPES || "read_orders");
    }
    return NextResponse.json({ success: true, authorizationUrl: url.toString() }, { headers });
  } catch {
    return NextResponse.json({ success: false, error: provider === "shopify"
      ? "Enter a valid .myshopify.com domain and configure the registered Shopify app on the server."
      : "Configure the platform's approved app credentials and exact HTTPS callback URL on the server." }, { status: 503, headers });
  }
}

export async function finishOAuth(request: Request, provider: OAuthProvider) {
  const owner = await getSessionUserId(request);
  if (!owner) return NextResponse.json({ success: false, error: "Sign in and restart store authorization." }, { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("error")) throw new Error("Authorization was declined.");
    const app = config(provider, request.url);
    const shop = provider === "shopify" ? normalizeShopifyDomain(params.get("shop") || "") : "";
    if (provider === "shopify" && !validShopifyCallback(params, app.clientSecret)) throw new Error("Invalid Shopify callback signature.");
    const binding = { clientId: app.clientId + (shop ? `@${shop}` : ""), redirectUri: app.redirectUri };
    const state = params.get("state") || "";
    const valid = await verifyAndConsumeOAuthState(state, names[provider], owner, binding);
    if (!valid.valid) throw new Error("Invalid or expired authorization state.");
    const code = params.get(provider === "amazon" ? "spapi_oauth_code" : "code");
    if (!code || code.length > 8192) throw new Error("Missing authorization code.");
    let credentials: Record<string, any>;
    if (provider === "flipkart") {
      credentials = { ...await flipkartToken({ grant_type: "authorization_code", code, state, redirect_uri: app.redirectUri }, app.clientId, app.clientSecret),
        clientId: app.clientId, clientSecret: app.clientSecret };
    } else {
      const response = await providerFetch(() => (provider === "shopify" ? safeOutboundFetch : fetch)(
        provider === "shopify" ? `https://${shop}/admin/oauth/access_token` : "https://api.amazon.com/auth/o2/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, code,
            ...(provider === "amazon" ? { grant_type: "authorization_code", redirect_uri: app.redirectUri } : { expiring: "1" }) }).toString(),
          signal: AbortSignal.timeout(12000), redirect: "error", cache: "no-store",
        }), 1);
      const data = await response.json();
      credentials = provider === "shopify" ? { ...shopifyTokenResponse(data), shopDomain: shop, webhookSecret: app.clientSecret, authMode: "OAUTH2" }
        : { refreshToken: data.refresh_token, sellerId: params.get("selling_partner_id") };
      credentials.clientId = app.clientId; credentials.clientSecret = app.clientSecret;
    }
    if (provider !== "shopify" && !credentials.refreshToken) throw new Error("The platform did not grant renewable access.");
    const verification = await providerOperation(names[provider], owner, { ...credentials, action: "test_connection", verificationOnly: true });
    if (!verification.ok) throw new Error("Order access was not granted.");
    const existing = (await getConnectionsForUser(owner)).filter(connection => connection.marketplace === names[provider]);
    if (existing.length > 1) throw new Error("Select an explicit store connection.");
    const identity = provider === "shopify" ? shop : String(credentials.sellerId || "");
    if (existing[0]?.sellerId && identity && existing[0].sellerId !== identity) throw new Error("Disconnect the existing store before authorizing a different account.");
    await saveConnection(owner, { marketplace: names[provider], connectionId: existing[0]?.id, expectedUpdatedAt: existing[0]?.updatedAt,
      sellerId: identity || existing[0]?.sellerId || "", authType: provider === "amazon" ? "LWA_REFRESH_TOKEN" : "OAUTH2",
      credentials: { ...credentials, verifiedAt: new Date().toISOString() } });
    const redirect = new URL("/webhooks", app.redirectUri);
    redirect.searchParams.set("channel", provider); redirect.searchParams.set("status", "connected");
    return NextResponse.redirect(redirect, { headers });
  } catch {
    return NextResponse.json({ success: false, error: "Store authorization could not be completed. Your existing credentials were preserved. Sign in and restart authorization; check app permissions and the registered callback URL." }, { status: 400, headers });
  }
}
