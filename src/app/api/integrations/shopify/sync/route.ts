import { collectPages, nextLink } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { safeOutboundFetch } from "@/lib/security/ssrf-guard";
import { normalizeShopifyDomain } from "@/lib/security/shopify-domain";
import {
  ShopifyOrderWebhookSchema,
  mapShopifyOrderToDomain,
} from "@/lib/webhooks/schemas/shopify-schema";
import { marketplaceError } from "@/lib/integrations/error-response";
import { getSessionUserId } from "@/lib/security/session";
import {
  getConnectionCredentials,
  updateSyncStatus,
  recordSyncLog,
} from "@/lib/security/marketplace-vault";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Shopify",
        "AUTHENTICATION_REQUIRED",
        "A valid authenticated merchant session is required to perform Shopify synchronization.",
        401
      );
    }

    const body = await req.json().catch(() => ({}));
    let { action, shopDomain, accessToken, limit = 50 } = body;

    // Check vaulted credentials in PostgreSQL if not passed in request body (Zero Client-Side Master Secrets)
    if (!shopDomain || !accessToken) {
      const vaulted = await getConnectionCredentials<{
        shopDomain?: string;
        storeUrl?: string;
        accessToken?: string;
        consumerKey?: string;
      }>(userId, "Shopify");

      if (vaulted) {
        if (!shopDomain) shopDomain = vaulted.shopDomain || vaulted.storeUrl;
        if (!accessToken) accessToken = vaulted.accessToken || vaulted.consumerKey;
      }
    }

    if (!shopDomain || !accessToken) {
      return marketplaceError(
        "Shopify",
        "SHOPIFY_MISSING_CREDENTIALS",
        "Store domain and Admin API Access Token are required. Please configure credentials in the vault.",
        400
      );
    }

    // Clean shop domain: e.g. "my-brand.myshopify.com"
    let cleanDomain: string;
    try {
      cleanDomain = normalizeShopifyDomain(shopDomain);
    } catch {
      return marketplaceError("Shopify", "SHOPIFY_INVALID_DOMAIN", "Enter a valid Shopify shop domain.", 400);
    }

    const cleanToken = String(accessToken).trim();
    const headers = {
      "X-Shopify-Access-Token": cleanToken,
      "Content-Type": "application/json",
      "User-Agent": "MarginFlow-Shopify-Sync/1.0",
      Accept: "application/json",
    };

    if (action === "test_connection") {
      const testUrl = `https://${cleanDomain}/admin/api/2026-10/orders.json?limit=1&status=any`;

      let res: Response;
      try {
        res = await safeOutboundFetch(testUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (err: any) {
        return marketplaceError(
          "Shopify",
          "SHOPIFY_STORE_UNREACHABLE",
          `Could not reach Shopify store at ${cleanDomain}. Network error: ${err.message || "Timeout"}`,
          502
        );
      }

      if (res.status === 401) {
        return marketplaceError(
          "Shopify",
          "SHOPIFY_AUTH_FAILED",
          "Authentication failed (401). Invalid Admin API Access Token. Please verify your token in Shopify Admin > Settings > Apps > Develop apps.",
          401
        );
      }

      if (res.status === 403) {
        return marketplaceError(
          "Shopify",
          "SHOPIFY_FORBIDDEN",
          "Access Denied (403). Ensure your custom app has 'read_orders' and 'read_products' API scopes enabled.",
          403
        );
      }

      if (res.status === 404) {
        return marketplaceError(
          "Shopify",
          "SHOPIFY_STORE_NOT_FOUND",
          `Store domain '${cleanDomain}' not found on Shopify. Please check your .myshopify.com address.`,
          404
        );
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return marketplaceError(
          "Shopify",
          "SHOPIFY_API_ERROR",
          `Shopify responded with HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`,
          res.status
        );
      }

      const data = await res.json();
      if (!Array.isArray(data?.orders)) throw new Error("Shopify did not return a usable orders response.");
      const shopInfo = { name: cleanDomain, currency: undefined };

      return NextResponse.json({
        success: true,
        message: `Connected successfully to Shopify store: ${shopInfo.name || cleanDomain}`,
        storeName: shopInfo.name,
        currency: shopInfo.currency,
        domain: cleanDomain,
      });
    }

    if (action === "fetch_orders") {
      const syncStartedAt = new Date().toISOString();
      const fetchUrl = `https://${cleanDomain}/admin/api/2026-10/orders.json?status=any&limit=${Math.min(Math.max(Number(limit) || 50, 1), 250)}`;
      let pageNumber = 0;
      const rawOrders = await collectPages<any>(fetchUrl, url => safeOutboundFetch(url, {
        method: "GET", headers: headers,
        signal: AbortSignal.timeout(20000), cache: "no-store",
      }), (data, response) => {
        if (!Array.isArray(data?.orders)) throw new Error("Shopify omitted orders.");
        return { records: data.orders, next: nextLink(response) };
      });

      const domainOrders = rawOrders.map((raw:any) => mapShopifyOrderToDomain(ShopifyOrderWebhookSchema.parse(raw)));

      const dbResult = await upsertOrders(userId, domainOrders);
      const nowIso = new Date().toISOString();

      await updateSyncStatus(userId, "Shopify", "SUCCEEDED", {
          stream: "orders",
        lastSyncedAt: syncStartedAt,
      });
      await recordSyncLog(userId, {
        marketplace: "Personal Website",
        status: "SUCCEEDED",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
      });

      const syncResult = buildSyncResult({
        marketplace: "Personal Website",
        status: "succeeded",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
        skippedCount: Math.max(0, domainOrders.length - (dbResult.inserted + dbResult.updated)),
        lastSyncedAt: nowIso,
        errors: [],
      });

      return syncSuccessResponse(syncResult, {
        message: `Successfully fetched ${domainOrders.length} orders from Shopify.`,
        orders: domainOrders,
        persisted: dbResult,
      });
    }

    return marketplaceError(
      "Shopify",
      "SHOPIFY_INVALID_ACTION",
      `Invalid action: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "Shopify",
      "SHOPIFY_INTERNAL_ERROR",
      error.message || "Internal server error during Shopify sync.",
      500
    );
  }
}
