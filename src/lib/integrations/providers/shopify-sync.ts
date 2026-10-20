import { NextResponse } from "next/server";
import { getConnectionCredentials, getConnectionsForUser, recordSyncLog, updateSyncStatus } from "@/lib/security/marketplace-vault";
import { shopifyToken, renewConnectionToken } from "@/lib/integrations/provider-auth";
import { shopifyOrdersPage } from "@/lib/integrations/shopify-orders";
import { ShopifyOrderWebhookSchema, mapShopifyOrderToDomain } from "@/lib/webhooks/schemas/shopify-schema";
import { upsertOrders } from "@/lib/integrations/connection-orders";
import { deferProviderOrder, resolveDeferredOrders } from "@/lib/integrations/deferred-orders";
import { marketplaceError } from "@/lib/integrations/error-response";
import { ProviderRequestError, publicProviderError } from "@/lib/integrations/provider-http";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";

export async function runSync(userId: string, body: Record<string, any>) {
  try {
    const saved = body.verificationOnly ? null : await getConnectionCredentials<Record<string, any>>(userId, "Shopify", "", body.connectionId);
    const credentials = body.verificationOnly ? body : saved || body;
    if (!credentials.shopDomain) return marketplaceError("Shopify", "SHOPIFY_MISSING_CREDENTIALS", "Authorize Shopify or configure your store credentials.", 400);
    const current = saved && body.connectionId ? await renewConnectionToken(userId, body.connectionId, shopifyToken) : await shopifyToken(credentials);
    if (body.action === "test_connection") {
      await shopifyOrdersPage(current.shopDomain, current.accessToken, "status:any", undefined, true);
      return NextResponse.json({ success: true, storeName: current.shopDomain, domain: current.shopDomain,
        ...(body.verificationOnly ? { credentialUpdate: current } : {}) });
    }
    const started = new Date().toISOString();
    const metadata = (await getConnectionsForUser(userId)).find(c => c.marketplace === "Shopify" && (!body.connectionId || c.id === body.connectionId));
    const checkpoint = metadata?.syncCheckpoints?.orders?.lastSyncedAt;
    const from = body.syncWindowStart || (checkpoint ? new Date(Date.parse(checkpoint) - 48 * 3600000).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString());
    const to = body.syncWindowEnd || started;
    const query = `status:any updated_at:>='${from}' updated_at:<='${to}'`;
    const rawOrders: any[] = []; const visited = new Set<string>(); let cursor: string | undefined;
    const deadline = Date.now() + 90000;
    do {
      const page = await shopifyOrdersPage(current.shopDomain, current.accessToken, query, cursor, false, deadline);
      rawOrders.push(...page.orders); cursor = page.next;
      if (rawOrders.length > 1000) throw new ProviderRequestError(413, true);
      if (cursor && (visited.has(cursor) || visited.size >= 250)) throw new ProviderRequestError(502);
      if (cursor) visited.add(cursor);
    } while (cursor);
    const orders = []; let deferred = 0;
    for (const raw of rawOrders) {
      const parsed = ShopifyOrderWebhookSchema.parse(raw);
      if (parsed.refunds.length || /refunded/.test(parsed.financial_status) || parsed.cancelled_at && parsed.fulfillment_status === "fulfilled") {
        if (!body.connectionId) throw new ProviderRequestError(422, false);
        await deferProviderOrder(userId, body.connectionId, parsed.id, raw, "REFUND_RECONCILIATION_REQUIRED");
        deferred++; continue;
      }
      orders.push(mapShopifyOrderToDomain(parsed));
    }
    const persisted = await upsertOrders(userId, orders, body.connectionId);
    if (body.connectionId) await resolveDeferredOrders(userId, body.connectionId, orders.map(order => order.id.replace(/^ORD-SHP-/, "")));
    await updateSyncStatus(userId, "Shopify", deferred ? "PARTIAL" : "SUCCEEDED", { stream: "orders", connectionId: body.connectionId, lastSyncedAt: to });
    await recordSyncLog(userId, { marketplace: "Shopify", connectionId: body.connectionId, status: deferred ? "PARTIAL" : "SUCCEEDED", fetchedCount: rawOrders.length, importedCount: persisted.inserted, updatedCount: persisted.updated });
    return syncSuccessResponse(buildSyncResult({ marketplace: "Personal Website", status: deferred ? "partial" : "succeeded", skippedCount: deferred, fetchedCount: rawOrders.length, importedCount: persisted.inserted, updatedCount: persisted.updated, lastSyncedAt: to }), { orders, persisted });
  } catch (error) {
    return marketplaceError("Shopify", "SHOPIFY_SYNC_FAILED", publicProviderError(error, "Shopify orders could not be imported. Check order data and retry."), error instanceof ProviderRequestError ? error.status : 502);
  }
}
