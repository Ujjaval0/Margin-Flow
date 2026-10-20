import { connectionInput, ConnectionInputError, type ApiPlatform } from "./connection-input";
import { getConnectionById, getConnectionCredentials, getConnectionsForUser, saveConnection } from "@/lib/security/marketplace-vault";

export async function providerOperation(platform: ApiPlatform, userId: string, body: Record<string, any>): Promise<Response> {
  switch (platform) {
    case "Amazon India": return (await import("./providers/amazon-sync")).runSync(userId, body);
    case "Flipkart": return (await import("./providers/flipkart-sync")).runSync(userId, body);
    case "Shopify": return (await import("./providers/shopify-sync")).runSync(userId, body);
    case "WooCommerce": return (await import("./providers/woocommerce-sync")).runSync(userId, body);
  }
}

/** Verify a complete candidate before replacing any encrypted database credentials. */
export async function verifyAndSaveConnection(userId: string, body: Record<string, any>) {
  const { marketplace, connectionId } = body;
  if (typeof marketplace !== "string") throw new ConnectionInputError("Choose a store platform.");
  if (connectionId && (typeof connectionId !== "string" || !/^conn_[\w-]{1,80}$/.test(connectionId))) throw new ConnectionInputError("Invalid connection identifier.");
  const existing = connectionId ? await getConnectionById(userId, connectionId) : null;
  if (connectionId && (!existing || existing.marketplace !== marketplace)) throw new ConnectionInputError("Store connection is unavailable.");
  if (!connectionId && (await getConnectionsForUser(userId)).some(connection => connection.marketplace === marketplace)) {
    throw new ConnectionInputError("This platform already has saved credentials. Open its configuration to update them.");
  }
  let previous: Record<string, any> = {};
  if (existing) {
    try { previous = await getConnectionCredentials(userId, marketplace, "", existing.id) || {}; }
    catch { /* A complete verified replacement can repair credentials encrypted with a lost legacy key. */ }
  }
  const { platform, credentials } = connectionInput(marketplace, body.credentials, previous);
  if (existing?.storeUrl && (credentials.shopDomain || credentials.storeUrl) !== existing.storeUrl) {
    throw new ConnectionInputError("Disconnect the existing store before connecting a different store address.");
  }
  if (platform === "Amazon India" && existing?.sellerId && credentials.sellerId && existing.sellerId !== credentials.sellerId) {
    throw new ConnectionInputError("Disconnect the existing account before connecting a different seller.");
  }
  // WooCommerce defaults a blank webhook Secret to its API user's consumer secret.
  if (platform === "WooCommerce" && !credentials.webhookSecret) credentials.webhookSecret = credentials.consumerSecret;
  if (platform === "Shopify" && !credentials.webhookSecret) credentials.webhookSecret = credentials.clientSecret || process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const verification = await providerOperation(platform, userId, { ...credentials, connectionId: existing?.id, action: "test_connection", verificationOnly: true });
  if (!verification.ok) {
    // Provider messages are intentionally not forwarded: upstreams can echo submitted credentials.
    throw new ConnectionInputError(verification.status === 401 || verification.status === 403
      ? "Store authorization failed. Check credentials and the app's order permissions. Your saved credentials were not changed."
      : "Could not verify order access. Check the canonical store address and platform availability. Your saved credentials were not changed.");
  }
  const verified = await verification.json();
  // Token acquisition may have produced a newer token. This data remains server-only.
  const finalCredentials = { ...credentials, ...(verified.credentialUpdate || {}), verifiedAt: new Date().toISOString() };
  return saveConnection(userId, {
    marketplace: platform, connectionId: existing?.id, expectedUpdatedAt: existing?.updatedAt,
    sellerId: existing?.sellerId || (platform === "Amazon India" ? credentials.sellerId : credentials.shopDomain || credentials.storeUrl) || "",
    authType: platform === "Shopify" ? finalCredentials.authMode || "ADMIN_TOKEN"
      : platform === "Amazon India" ? "LWA_REFRESH_TOKEN" : platform === "Flipkart" ? "SELF_ACCESS" : "API_KEY",
    credentials: finalCredentials,
  });
}
