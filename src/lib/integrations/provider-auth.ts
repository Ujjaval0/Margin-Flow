import { providerFetch, ProviderRequestError } from "./provider-http";
import { pool } from "@/lib/db";
import { decryptPayload, encryptPayload } from "@/lib/security/encryption";
import { safeOutboundFetch } from "@/lib/security/ssrf-guard";
import { normalizeShopifyDomain } from "@/lib/security/shopify-domain";

export function tokenIsCurrent(credentials: Record<string, any>) {
  return Boolean(credentials.accessToken && credentials.tokenExpiresAt && Date.parse(credentials.tokenExpiresAt) > Date.now() + 120_000);
}

/** Serialize rotating grants across web requests and workers, then reload the winning token. */
export async function renewConnectionToken(owner: string, id: string, renew: (credentials: Record<string, any>) => Promise<Record<string, any>>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`token:${id}`]);
    const result = await client.query("SELECT encrypted_credentials FROM marketplace_connections WHERE user_id=$1 AND id=$2 AND is_active=TRUE FOR UPDATE", [owner,id]);
    if (!result.rows.length) throw new ProviderRequestError(401, false);
    const current = decryptPayload<Record<string, any>>(result.rows[0].encrypted_credentials);
    const updated = await renew(current);
    if (!updated.accessToken) throw new ProviderRequestError(401, false);
    if (updated.accessToken !== current.accessToken || updated.refreshToken !== current.refreshToken) {
      await client.query("UPDATE marketplace_connections SET encrypted_credentials=$1,updated_at=NOW() WHERE user_id=$2 AND id=$3", [encryptPayload({ ...current, ...updated }),owner,id]);
    }
    await client.query("COMMIT");
    return { ...current, ...updated };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function flipkartToken(parameters: Record<string, string>, clientId: string, clientSecret: string) {
  const url = new URL("https://api.flipkart.net/oauth-service/oauth/token");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await providerFetch(() => fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000), redirect: "error", cache: "no-store",
  }), 1); // Authorization codes and rotating refresh tokens must not be replayed automatically.
  const data = await response.json();
  if (typeof data.access_token !== "string" || !data.access_token) throw new ProviderRequestError(502);
  const expiresIn = Number(data.expires_in);
  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    tokenExpiresAt: new Date(Date.now() + (expiresIn > 0 ? expiresIn : 3600) * 1000).toISOString(),
    ...(Number(data.refresh_token_expires_in) > 0 ? { refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_token_expires_in) * 1000).toISOString() } : {}),
  };
}

export async function shopifyToken(credentials: Record<string, any>) {
  const shop = normalizeShopifyDomain(credentials.shopDomain);
  if (tokenIsCurrent(credentials) || credentials.accessToken && !credentials.tokenExpiresAt && credentials.authMode !== "CLIENT_CREDENTIALS") return credentials;
  const refresh = credentials.authMode !== "CLIENT_CREDENTIALS" && Boolean(credentials.refreshToken);
  if (!credentials.clientId || !credentials.clientSecret || !refresh && credentials.authMode !== "CLIENT_CREDENTIALS") throw new ProviderRequestError(401, false);
  const params = new URLSearchParams(refresh ? {
    grant_type: "refresh_token", refresh_token: credentials.refreshToken,
    client_id: credentials.clientId, client_secret: credentials.clientSecret,
  } : { grant_type: "client_credentials", client_id: credentials.clientId, client_secret: credentials.clientSecret });
  const response = await providerFetch(() => safeOutboundFetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", body: params.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(12000), cache: "no-store",
  }), 1);
  return { ...credentials, ...shopifyTokenResponse(await response.json()), authMode: refresh ? "OAUTH2" : "CLIENT_CREDENTIALS" };
}

export function shopifyTokenResponse(data: any) {
  if (typeof data.access_token !== "string" || !data.access_token) throw new ProviderRequestError(502);
  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    tokenExpiresAt: Number(data.expires_in) > 0 ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : undefined,
    ...(Number(data.refresh_token_expires_in) > 0 ? { refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_token_expires_in) * 1000).toISOString() } : {}),
    grantedScopes: typeof data.scope === "string" ? data.scope.split(",") : [],
  };
}
