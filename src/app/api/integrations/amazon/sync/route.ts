import { money, sumMoney, toPaise } from "@/domain/order-financials";
import { amazonPages } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { Order, OrderItem } from "@/domain/types";
import { marketplaceError } from "@/lib/integrations/error-response";
import { getSessionUserId } from "@/lib/security/session";
import {
  getConnectionCredentials,
  getConnectionsForUser,
  updateSyncStatus,
  recordSyncLog,
} from "@/lib/security/marketplace-vault";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";
import { amazonSpApiLimiter } from "@/lib/security/rate-limiter";

const SP_API_EU_BASE = "https://sellingpartnerapi-eu.amazon.com";
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const DEFAULT_INDIA_MARKETPLACE_ID = "A21TJRUUN4KGV";

/**
 * Exchanges LWA refresh token for an access token.
 */
async function getLwaAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string | null; error?: string; status?: number }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  try {
    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "MarginFlow-Amazon-Sync/2.0",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
      redirect: "error",
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        accessToken: null,
        error:
          errJson.error_description ||
          errJson.error ||
          `Amazon LWA authentication failed with HTTP ${res.status}.`,
        status: res.status === 400 || res.status === 401 ? 401 : 502,
      };
    }

    const data = await res.json();
    return { accessToken: data.access_token || null };
  } catch (err: any) {
    return {
      accessToken: null,
      error: `Could not reach Amazon LWA service: ${err.message || "Network timeout"}`,
      status: 502,
    };
  }
}

/**
 * Fetches genuine order items for a specific Amazon Order ID from SP-API.
 */
async function fetchSpApiOrderItems(
  amazonOrderId: string,
  accessToken: string
): Promise<any[]> {
  const itemsUrl = `${SP_API_EU_BASE}/orders/v0/orders/${encodeURIComponent(amazonOrderId)}/orderItems`;
  const items = await amazonPages(itemsUrl, accessToken, "OrderItems");
  if (!items.length) throw new Error("Amazon returned no order items; no orders were imported.");
  return items;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Amazon India",
        "AUTHENTICATION_REQUIRED",
        "A valid authenticated merchant session is required to perform Amazon synchronization.",
        401
      );
    }

    const rateLimit = amazonSpApiLimiter.consume(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Amazon SP-API rate limit exceeded. Please retry after the cooldown period.",
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
    let {
      action,
      clientId,
      clientSecret,
      refreshToken,
      sellerId,
      marketplaceId = DEFAULT_INDIA_MARKETPLACE_ID,
      limit = 50,
      cursor,
      nextToken,
    } = body;

    const requestedCursor = nextToken || cursor || null;

    // Zero Client-Side Master Secrets: Fetch vaulted credentials if not passed in body
    const connections = (await getConnectionsForUser(userId)).filter(c => c.marketplace === "Amazon India");
    if (connections.length > 1) throw new Error("Select an explicit store connection.");
    const vaultedMetadata = connections[0];
    const syncStartedAt = new Date().toISOString();
    if (!clientId || !clientSecret || !refreshToken) {
      const vaulted = await getConnectionCredentials<{
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        sellerId?: string;
        lastSyncedAt?: string;
        lastSyncCursor?: string;
      }>(userId, "Amazon India");

      if (vaulted?.clientId && vaulted?.clientSecret && vaulted?.refreshToken) {
        clientId = vaulted.clientId;
        clientSecret = vaulted.clientSecret;
        refreshToken = vaulted.refreshToken;
        if (!sellerId && vaulted.sellerId) sellerId = vaulted.sellerId;

      }
    }

    if (!clientId || !clientSecret || !refreshToken) {
      return marketplaceError(
        "Amazon India",
        "AMAZON_MISSING_CREDENTIALS",
        "Amazon LWA Client ID, Client Secret, and Refresh Token are required. Please configure credentials in the vault.",
        400
      );
    }

    const cleanClientId = String(clientId).trim();
    const cleanClientSecret = String(clientSecret).trim();
    const cleanRefreshToken = String(refreshToken).trim();
    const cleanSellerId = sellerId ? String(sellerId).trim() : undefined;

    // Action 1: test_connection
    if (action === "test_connection") {
      const auth = await getLwaAccessToken(cleanClientId, cleanClientSecret, cleanRefreshToken);
      if (!auth.accessToken) {
        return marketplaceError(
          "Amazon India",
          auth.status === 401 ? "AMAZON_AUTH_FAILED" : "AMAZON_LWA_UNREACHABLE",
          auth.error || "Authentication failed. Check your LWA credentials.",
          auth.status || 502
        );
      }

      await amazonPages(`${SP_API_EU_BASE}/orders/v0/orders?MarketplaceIds=${encodeURIComponent(marketplaceId)}&MaxResultsPerPage=1&CreatedAfter=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}`, auth.accessToken, "Orders");

      return NextResponse.json({
        success: true,
        message: "Amazon SP-API authenticated successfully (Region: India - IN).",
        sellerId: cleanSellerId || "Verified",
        marketplaceId,
      });
    }

    // Action 2: fetch_orders
    if (action === "fetch_orders") {
      // 1. Authenticate with LWA
      const auth = await getLwaAccessToken(cleanClientId, cleanClientSecret, cleanRefreshToken);
      if (!auth.accessToken) {
        await recordSyncLog(userId, {
          marketplace: "Amazon India",
          status: "FAILED",
          errorMessage: auth.error,
        });

        return marketplaceError(
          "Amazon India",
          auth.status === 401 ? "AMAZON_AUTH_FAILED" : "AMAZON_SYNC_FAILED",
          auth.error || "Failed to exchange LWA token.",
          auth.status || 502
        );
      }

      const accessToken = auth.accessToken;

      // 2. Formulate SP-API Orders query with India Marketplace & 48-Hour Overlap Window (TASK-3.1 & TASK-3.3)
      let ordersUrl = `${SP_API_EU_BASE}/orders/v0/orders?MarketplaceIds=${encodeURIComponent(
        marketplaceId
      )}&MaxResultsPerPage=${Math.min(Math.max(1, limit), 50)}`;

      if (requestedCursor) {
        // Cursor-based pagination
        ordersUrl += `&NextToken=${encodeURIComponent(requestedCursor)}`;
      } else {
        // Overlap window: 48-hour bounded overlap if previous sync exists, else 30 days
        const lastSyncedAt = vaultedMetadata?.syncCheckpoints?.orders?.lastSyncedAt;
        if (lastSyncedAt) {
          const overlapTime = new Date(new Date(lastSyncedAt).getTime() - 48 * 60 * 60 * 1000).toISOString();
          ordersUrl += `&LastUpdatedAfter=${encodeURIComponent(overlapTime)}`;
        } else {
          const defaultWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          ordersUrl += `&CreatedAfter=${encodeURIComponent(defaultWindow)}`;
        }
      }

      const spApiOrders = await amazonPages(ordersUrl, accessToken, "Orders");
      const responseNextToken: string | null = null;

      // Zero orders in query window
      if (spApiOrders.length === 0) {
        const nowIso = new Date().toISOString();
        if (!requestedCursor) await updateSyncStatus(userId, "Amazon India", "SUCCEEDED", {
          stream: "orders",
          lastSyncedAt: syncStartedAt,
          lastSyncCursor: responseNextToken || undefined,
        });
        await recordSyncLog(userId, {
          marketplace: "Amazon India",
          status: "SUCCEEDED",
          fetchedCount: 0,
        });

        const syncResult = buildSyncResult({
          marketplace: "Amazon India",
          status: "succeeded",
          fetchedCount: 0,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          lastSyncedAt: syncStartedAt,
          nextCursor: responseNextToken || undefined,
          errors: [],
        });

        return syncSuccessResponse(syncResult, {
          orders: [],
          totalFetched: 0,
          nextToken: responseNextToken,
        });
      }

      // 3. Map authentic multi-line order items (TASK-3.2)
      const domainOrders: Order[] = [];

      for (const ao of spApiOrders) {
        const channelOrderId = ao.AmazonOrderId;
        if (!channelOrderId) throw new Error("Amazon returned an order without an ID.");
        const orderDate = ao.PurchaseDate
          ? ao.PurchaseDate.split("T")[0]
          : new Date().toISOString().split("T")[0];

        // Map Amazon OrderStatus to MarginFlow canonical OrderStatus
        let status: Order["status"] = "CONFIRMED";
        if (ao.OrderStatus === "Shipped" || ao.OrderStatus === "InvoiceUnconfirmed") {
          status = "SHIPPED";
        } else if (ao.OrderStatus === "Delivered") {
          status = "DELIVERED";
        } else if (ao.OrderStatus === "Canceled" || ao.OrderStatus === "Unfulfillable") {
          status = "CANCELLED";
        } else if (ao.OrderStatus === "Pending") {
          status = "PENDING";
        }

        if(ao.OrderTotal?.CurrencyCode!=='INR')throw Error('Amazon order currency/total must be evidenced as INR.');
        // Fetch or resolve authentic line items (TASK-3.2)
        let rawItems: any[] = ao.OrderItems || ao.orderItems || [];
        if (!rawItems || rawItems.length === 0) {
          // If items not embedded, query SP-API OrderItems endpoint
          rawItems = await fetchSpApiOrderItems(channelOrderId, accessToken);
        }

        let items: OrderItem[] = [];

        if (Array.isArray(rawItems) && rawItems.length > 0) {
          items = rawItems.map((item: any, idx: number) => {
            const rawSku = item.SellerSKU || item.sellerSku;
            if(!rawSku || !item.OrderItemId || !item.ItemPrice || item.ItemPrice.CurrencyCode!=='INR')throw Error('Amazon order line identity, SKU and INR price are required.');
            const itemQty = Math.max(
              1,
              item.QuantityOrdered ?? item.quantityOrdered ?? item.QuantityShipped ?? 1
            );
            const rawPrice = parseFloat(
              item.ItemPrice?.Amount || item.itemPrice?.amount || item.Price?.Amount || "0"
            );
            const unitSellingPrice = itemQty > 0 && rawPrice > 0 ? rawPrice / itemQty : rawPrice;
            const itemTax = parseFloat(
              item.ItemTax?.Amount || item.itemTax?.amount || item.Tax?.Amount || "0"
            );
            const discount = parseFloat(
              item.PromotionDiscount?.Amount || item.promotionDiscount?.amount || "0"
            );

            return {
              id: `ITEM-AMZ-${channelOrderId}-${item.OrderItemId || idx + 1}`,
              sku: String(rawSku).trim(),
              productName: item.Title || item.title || "Amazon India Fulfilled Item",
              quantity: itemQty,
              sellingPrice: money(unitSellingPrice),
              lineSubtotal: money(rawPrice),
              taxAmount: sumMoney([itemTax,-Number(item.PromotionDiscountTax?.Amount||0)]),
              snapshotUnitCost: 0,costEvidence:"UNKNOWN", // Resolved only from owned dated catalog evidence
              discount: money(discount),
              returnedQuantity: 0,
            };
          });
        } else {
          throw new Error("Amazon returned no authentic order items.");
        }

        const base=sumMoney(items.map(i=>sumMoney([i.lineSubtotal??i.quantity*i.sellingPrice,-i.discount])));
        const itemTax=sumMoney(items.map(i=>i.taxAmount));
        const shipping=sumMoney(rawItems.map(i=>sumMoney([Number(i.ShippingPrice?.Amount||0),-Number(i.ShippingDiscount?.Amount||0)])));
        const shippingTax=sumMoney(rawItems.map(i=>sumMoney([Number(i.ShippingTax?.Amount||0),-Number(i.ShippingDiscountTax?.Amount||0)])));
        const charges=sumMoney(rawItems.map(i=>sumMoney([Number(i.GiftWrapPrice?.Amount||0),Number(i.CODFee?.Amount||0),-Number(i.CODFeeDiscount?.Amount||0)])));
        const chargesTax=sumMoney(rawItems.map(i=>Number(i.GiftWrapTax?.Amount||0)));
        const sourceTotal=Number(ao.OrderTotal.Amount);
        const inclusive=toPaise(sumMoney([base,shipping,charges]))===toPaise(sourceTotal);
        const exclusive=toPaise(sumMoney([base,itemTax,shipping,shippingTax,charges,chargesTax]))===toPaise(sourceTotal);
        if(!inclusive&&!exclusive)throw Error('Amazon line/discount/shipping/charge totals do not reconcile to OrderTotal.');
        const pricesIncludeTax=inclusive&&!exclusive?true:exclusive&&!inclusive?false:undefined;
        domainOrders.push({
          id: `ORD-AMZ-${channelOrderId}`,
          channelOrderId,
          marketplace: "Amazon India" as const,
          orderDate,
          status,
          customerName: ao.BuyerInfo?.BuyerName || "Amazon India Customer",
          customerCity: ao.ShippingAddress?.City || "India",
          customerState: ao.ShippingAddress?.StateOrRegion || "India",
          items,
          currency:'INR',sourceUpdatedAt:ao.LastUpdateDate,sourceTotal,pricesIncludeTax,
          customerCharges:sumMoney([charges,pricesIncludeTax?-chargesTax:0]),customerChargesTax:chargesTax,
          shippingFeeCharged:sumMoney([shipping,pricesIncludeTax===false?shippingTax:0]),shippingTaxAmount:shippingTax,
          marketplaceChargesEstimate: 0,
          notes: `Amazon SP-API Synced | Order: ${channelOrderId}`,
        });
      }

      // 4. Atomic Database Upsert into PostgreSQL (TASK-3.5)
      const dbResult = await upsertOrders(userId, domainOrders);

      // 5. Update Connection Sync Status & Cursor (TASK-3.3)
      const nowIso = new Date().toISOString();
      if (!requestedCursor) await updateSyncStatus(userId, "Amazon India", "SUCCEEDED", {
          stream: "orders",
        lastSyncedAt: syncStartedAt,
        lastSyncCursor: responseNextToken || undefined,
      });

      await recordSyncLog(userId, {
        marketplace: "Amazon India",
        status: "SUCCEEDED",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
      });

      const syncResult = buildSyncResult({
        marketplace: "Amazon India",
        status: "succeeded",
        fetchedCount: domainOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
        skippedCount: Math.max(0, domainOrders.length - (dbResult.inserted + dbResult.updated)),
        lastSyncedAt: syncStartedAt,
        nextCursor: responseNextToken || undefined,
        errors: [],
      });

      return syncSuccessResponse(syncResult, {
        orders: domainOrders,
        nextToken: responseNextToken,
        persisted: dbResult,
      });
    }

    return marketplaceError(
      "Amazon India",
      "AMAZON_INVALID_ACTION",
      `Invalid action specified: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "Amazon India",
      "AMAZON_SYNC_FAILED",
      error.message || "Failed to execute Amazon SP-API operation.",
      502
    );
  }
}
