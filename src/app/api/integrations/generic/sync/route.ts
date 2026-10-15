import { collectPages, nextLink } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { Order, OrderItem } from "@/domain/types";
import { marketplaceError } from "@/lib/integrations/error-response";
import { getSessionUserId } from "@/lib/security/session";
import { safeOutboundFetch, validateSafeOutboundUrl } from "@/lib/security/ssrf-guard";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";
import { getConnectionCredentials, recordSyncLog, updateSyncStatus } from "@/lib/security/marketplace-vault";
import { marketplaceSyncLimiter } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Personal Website",
        "AUTHENTICATION_REQUIRED",
        "A valid authenticated merchant session is required to perform custom integration synchronization.",
        401
      );
    }

    const rateLimit = marketplaceSyncLimiter.consume(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Custom integration sync rate limit exceeded. Please back off.",
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
    let { action, endpointUrl, apiKey, limit = 20 } = body;
    if (!endpointUrl || !apiKey) {
      const vaulted = await getConnectionCredentials<any>(userId, "Personal Website");
      endpointUrl ||= vaulted?.endpointUrl || vaulted?.apiUrl;
      apiKey ||= vaulted?.apiKey;
    }

    const rawUrl = endpointUrl ? String(endpointUrl).trim() : "";
    const cleanApiKey = apiKey ? String(apiKey).trim() : "";

    // Validate SSRF for any endpoint URL passed
    if (rawUrl) {
      const ssrfCheck = await validateSafeOutboundUrl(rawUrl, {
        allowHttpInDevelopment: true,
      });
      if (!ssrfCheck.isSafe) {
        return marketplaceError(
          "Personal Website",
          "SSRF_SECURITY_VIOLATION",
          `Endpoint URL rejected by security guard: ${ssrfCheck.reason}`,
          400
        );
      }
    }

    const cleanUrl = rawUrl;

    if (action === "test_connection") {
      if (!cleanUrl) {
        return marketplaceError(
          "Personal Website",
          "GENERIC_MISSING_ENDPOINT",
          "Custom API / POS Endpoint URL is required.",
          400
        );
      }

      // Test reachable
      try {
        const testRes = await safeOutboundFetch(cleanUrl, {
          method: "GET",
          headers: {
            ...(cleanApiKey ? { Authorization: `Bearer ${cleanApiKey}` } : {}),
            Accept: "application/json",
            "User-Agent": "MarginFlow-Generic-Sync/1.0",
          },
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });

        if (testRes.status === 401 || testRes.status === 403) {
          return marketplaceError(
            "Personal Website",
            "GENERIC_AUTH_FAILED",
            `Endpoint returned HTTP ${testRes.status} Unauthorized. Verify API Key or bearer token.`,
            401
          );
        }

        if (!testRes.ok) throw new Error(`Endpoint returned HTTP ${testRes.status}.`);
        const data = await testRes.json();
        if (!Array.isArray(data) && !Array.isArray(data?.orders) && !Array.isArray(data?.data)) {
          throw new Error("Endpoint did not return an orders collection.");
        }
        return NextResponse.json({
          success: true,
          message: `Endpoint verified successfully (HTTP ${testRes.status}). Custom receiver is reachable.`,
          url: cleanUrl,
        });
      } catch (err: any) {
        return marketplaceError(
          "Personal Website",
          "GENERIC_ENDPOINT_UNREACHABLE",
          `Could not reach ${cleanUrl}: ${err.message || "Connection failed"}. Check URL or network.`,
          502
        );
      }
    }

    if (action === "fetch_orders") {
      if (!cleanUrl) {
        return marketplaceError(
          "Personal Website",
          "GENERIC_MISSING_ENDPOINT",
          "Custom API / POS Endpoint URL is required to fetch orders.",
          400
        );
      }

      const fetchedOrders = await collectPages<any>(cleanUrl, url => safeOutboundFetch(url, {
        method: "GET", headers: {
          ...(cleanApiKey ? { Authorization: `Bearer ${cleanApiKey}` } : {}), Accept: "application/json",
        }, signal: AbortSignal.timeout(10000), cache: "no-store",
      }), (data, response) => {
        const records = Array.isArray(data) ? data : data?.orders ?? data?.data;
        const next = nextLink(response) || data?.nextPageUrl || data?.next;
        if ((data?.hasMore || data?.nextCursor) && !next) throw new Error("Custom endpoint pagination requires a next-page URL or Link header.");
        return { records, next };
      });

      const nowIso = new Date().toISOString();

      if (fetchedOrders.length === 0) {
        await updateSyncStatus(userId, "Personal Website", "SUCCEEDED", {
          stream: "orders",
          lastSyncedAt: nowIso,
        });
        await recordSyncLog(userId, {
          marketplace: "Personal Website",
          status: "SUCCEEDED",
          fetchedCount: 0,
        });

        const syncResult = buildSyncResult({
          marketplace: "Personal Website",
          status: "succeeded",
          fetchedCount: 0,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          lastSyncedAt: nowIso,
          errors: [],
        });

        return syncSuccessResponse(syncResult, {
          orders: [],
        });
      }

      const domainOrders: Order[] = fetchedOrders.map((o, idx) => {
        const channelOrderId = o.channelOrderId || o.orderId || o.id || `POS-${1000 + idx}`;
        const total = parseFloat(o.total || o.amount || o.sellingPrice || "0");

        return {
          id: `ORD-GEN-${channelOrderId}`,
          channelOrderId: String(channelOrderId),
          marketplace: "Personal Website" as const,
          orderDate: o.orderDate || new Date().toISOString().split("T")[0],
          status: "CONFIRMED" as const,
          customerName: o.customerName || "Retail POS Customer",
          customerCity: o.customerCity || "Mumbai",
          customerState: o.customerState || "Maharashtra",
          items: [
            {
              id: `ITEM-GEN-${channelOrderId}-1`,
              sku: o.sku || "POS-RETAIL-01",
              productName: o.productName || "Direct Store Sale Item",
              quantity: Number(o.quantity || 1),
              sellingPrice: total,
              taxAmount: Number(o.taxAmount || 0),
              snapshotUnitCost: 0, // Invariant: Zero financial guesswork! Resolved strictly through catalog COGS
              discount: Number(o.discount || 0),
              returnedQuantity: 0,
            },
          ],
          shippingFeeCharged: Number(o.shippingFeeCharged || 0),
          marketplaceChargesEstimate: 0,
          notes: `Custom Ingestion Synced | Order: ${channelOrderId}`,
        };
      });

      // Atomic Database Upsert into PostgreSQL (TASK-3.5 / TASK-6.2 Point 8)
      const dbResult = await upsertOrders(userId, domainOrders);

      await updateSyncStatus(userId, "Personal Website", "SUCCEEDED", {
          stream: "orders",
        lastSyncedAt: nowIso,
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
        orders: domainOrders,
        persisted: dbResult,
      });
    }

    return marketplaceError(
      "Personal Website",
      "GENERIC_INVALID_ACTION",
      `Invalid action specified: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "Personal Website",
      "GENERIC_INTERNAL_ERROR",
      error.message || "Failed to execute custom API sync.",
      500
    );
  }
}
