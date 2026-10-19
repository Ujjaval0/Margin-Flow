import { collectPages, nextLink } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { safeOutboundFetch } from "@/lib/security/ssrf-guard";
import {
  WooCommerceOrderWebhookSchema,
  mapWooCommerceOrderToDomain,
} from "@/lib/webhooks/schemas/woocommerce-schema";
import { marketplaceError } from "@/lib/integrations/error-response";
import { getSessionUserId } from "@/lib/security/session";
import { validateSafeOutboundUrl } from "@/lib/security/ssrf-guard";
import {
  getConnectionCredentials,
  updateSyncStatus,
  recordSyncLog,
} from "@/lib/security/marketplace-vault";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";
import { marketplaceSyncLimiter } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "WooCommerce",
        "AUTHENTICATION_REQUIRED",
        "A valid authenticated merchant session is required to perform integration synchronization.",
        401
      );
    }

    const rateLimit = marketplaceSyncLimiter.consume(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Marketplace sync rate limit exceeded. Please back off.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    let { action, storeUrl, consumerKey, consumerSecret, perPage = 50 } = body;

    // Check vaulted credentials in PostgreSQL if not passed in request body (Zero Client-Side Master Secrets)
    if (!storeUrl || !consumerKey || !consumerSecret) {
      const vaulted = await getConnectionCredentials<{
        storeUrl: string;
        consumerKey: string;
        consumerSecret: string;
      }>(userId, "WooCommerce");

      if (vaulted) {
        if (!storeUrl) storeUrl = vaulted.storeUrl;
        if (!consumerKey) consumerKey = vaulted.consumerKey;
        if (!consumerSecret) consumerSecret = vaulted.consumerSecret;
      }
    }

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return marketplaceError(
        "WooCommerce",
        "WOOCOMMERCE_MISSING_CREDENTIALS",
        "Store URL, Consumer Key, and Consumer Secret are required. Please configure credentials in the vault.",
        400
      );
    }

    // SSRF Defense: Validate URL against private IPs, loopback, and cloud metadata
    const ssrfCheck = await validateSafeOutboundUrl(String(storeUrl), {
      allowHttpInDevelopment: true,
    });
    if (!ssrfCheck.isSafe) {
      return marketplaceError(
        "WooCommerce",
        "SSRF_SECURITY_VIOLATION",
        `Store URL rejected by security guard: ${ssrfCheck.reason}`,
        400
      );
    }

    // Normalize URL
    let cleanUrl = String(ssrfCheck.normalizedUrl || storeUrl).trim().replace(/\/+$/, "");

    const cleanKey = String(consumerKey).trim();
    const cleanSecret = String(consumerSecret).trim();

    const basicAuth = Buffer.from(`${cleanKey}:${cleanSecret}`).toString("base64");
    const authHeaders = {
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": "MarginFlow-Integration-Sync/1.0",
      Accept: "application/json",
    };



    if (action === "test_connection") {
      // Test with orders endpoint (orders?per_page=1 requires standard Read permission)
      const testUrl = `${cleanUrl}/wp-json/wc/v3/orders?per_page=1`;

      let res: Response;
      try {
        res = await safeOutboundFetch(testUrl, {
          method: "GET",
          headers: authHeaders,
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (fetchErr: any) {
        return marketplaceError(
          "WooCommerce",
          "WOOCOMMERCE_STORE_UNREACHABLE",
          `Could not connect to store at ${cleanUrl}. Network error: ${fetchErr.message || "Connection refused/timed out"}. Ensure your store URL is accessible.`,
          502
        );
      }

      if (res.status === 401) {
        return marketplaceError(
          "WooCommerce",
          "WOOCOMMERCE_AUTH_FAILED",
          "Authentication failed (401). Invalid Consumer Key or Consumer Secret. Please check your WooCommerce > Settings > Advanced > REST API credentials.",
          401
        );
      }

      if (res.status === 403) {
        return marketplaceError(
          "WooCommerce",
          "WOOCOMMERCE_FORBIDDEN",
          "Access Denied (403). Ensure your REST API key has 'Read' or 'Read/Write' permissions in WooCommerce.",
          403
        );
      }

      if (res.status === 404) {
        return marketplaceError(
          "WooCommerce",
          "WOOCOMMERCE_API_NOT_FOUND",
          "WooCommerce REST API not found (404). Ensure WooCommerce is installed and active, and WordPress Permalinks are set to 'Post name' under Settings > Permalinks.",
          404
        );
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return marketplaceError(
          "WooCommerce",
          "WOOCOMMERCE_API_ERROR",
          `Store responded with HTTP ${res.status}: ${errorText.slice(0, 150) || res.statusText}`,
          res.status
        );
      }

      if (!Array.isArray(await res.json())) throw new Error("WooCommerce did not return a usable orders response.");
      const totalCount = Number(res.headers.get("x-wp-total")) || 0;

      return NextResponse.json({
        success: true,
        message: "Successfully connected to WooCommerce store.",
        storeUrl: cleanUrl,
        totalOrdersInStore: totalCount,
      });
    }

    if (action === "fetch_orders") {
      const syncStartedAt = new Date().toISOString();
      const fetchUrl = `${cleanUrl}/wp-json/wc/v3/orders?per_page=${Math.min(Math.max(Number(perPage) || 50, 1), 100)}&status=any&page=1`;
      let pageNumber = 0;
      const rawOrders = await collectPages<any>(fetchUrl, url => safeOutboundFetch(url, {
        method: "GET", headers: authHeaders,
        signal: AbortSignal.timeout(20000), cache: "no-store",
      }), (data, response) => {
        if (!Array.isArray(data)) throw new Error("WooCommerce returned invalid orders.");
        const totalPages = Number(response.headers.get("x-wp-totalpages"));
        if (!Number.isInteger(totalPages) || totalPages < 0) throw new Error("WooCommerce omitted pagination metadata.");
        const page = ++pageNumber;
        return { records: data, next: page < totalPages ? fetchUrl.replace(/page=\d+$/, `page=${page + 1}`) : null };
      });

      const domainOrders = rawOrders.map((raw:any) => mapWooCommerceOrderToDomain(WooCommerceOrderWebhookSchema.parse(raw)));

      const dbResult = await upsertOrders(userId, domainOrders);

      const nowIso = new Date().toISOString();

      await updateSyncStatus(userId, "WooCommerce", "SUCCEEDED", {
          stream: "orders",
        lastSyncedAt: syncStartedAt,
      });
      await recordSyncLog(userId, {
        marketplace: "WooCommerce",
        status: "SUCCEEDED",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
      });

      const syncResult = buildSyncResult({
        marketplace: "WooCommerce",
        status: "succeeded",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
        skippedCount: Math.max(0, domainOrders.length - (dbResult.inserted + dbResult.updated)),
        lastSyncedAt: nowIso,
        errors: [],
      });

      return syncSuccessResponse(syncResult, {
        message: `Successfully retrieved ${domainOrders.length} orders from WooCommerce.`,
        orders: domainOrders,
        persisted: dbResult,
      });
    }

    return marketplaceError(
      "WooCommerce",
      "WOOCOMMERCE_INVALID_ACTION",
      `Invalid action specified: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "WooCommerce",
      "WOOCOMMERCE_INTERNAL_ERROR",
      error.message || "Internal server error during WooCommerce sync.",
      500
    );
  }
}
