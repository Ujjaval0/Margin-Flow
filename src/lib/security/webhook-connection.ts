import crypto from "crypto";
import { query } from "@/lib/db";
import { decryptPayload } from "./encryption";
import { getWebhookSecret } from "./secret-vault";

const CHANNELS: Record<string, string> = { Shopify: "shopify", WooCommerce: "woocommerce", Generic: "generic" };

export function webhookPath(id: string, marketplace: string, encryptedCredentials: string): string | undefined {
  const channel = CHANNELS[marketplace];
  if (!channel) return undefined;
  const credentials = decryptPayload<Record<string, string>>(encryptedCredentials);
  if (!credentials.webhookRoutingKey) return undefined;
  return `/api/webhooks/${channel}?connection_id=${encodeURIComponent(id)}&routing_key=${encodeURIComponent(credentials.webhookRoutingKey)}`;
}

/** The secret URL binds a signed payload to a server-owned connection, not a caller-supplied tenant. */
export async function resolveWebhookConnection(request: Request, channel: string) {
  const params = new URL(request.url).searchParams;
  if (params.has("user_id")) return null;
  const id = params.get("connection_id");
  const key = params.get("routing_key");
  if (!id || !key || !/^[a-f0-9]{64}$/.test(key)) return null;
  const result = await query(
    "SELECT id, user_id, marketplace, encrypted_credentials FROM marketplace_connections WHERE id = $1 AND is_active = TRUE",
    [id]
  );
  const row = result.rows[0];
  if (!row || CHANNELS[row.marketplace] !== channel) return null;
  const credentials = decryptPayload<Record<string, string>>(row.encrypted_credentials);
  const expected = credentials.webhookRoutingKey;
  if (!expected || expected.length !== key.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(key))) return null;
  const secret = credentials.webhookSecret || getWebhookSecret(channel as "shopify" | "woocommerce" | "generic");
  return { id: row.id as string, userId: row.user_id as string, secret, shopDomain: credentials.shopDomain };
}
