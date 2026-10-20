import { ProviderRequestError } from "@/lib/integrations/provider-http";
import { flipkartToken, tokenIsCurrent, renewConnectionToken } from "@/lib/integrations/provider-auth";
import { publicProviderError } from "@/lib/integrations/provider-http";
import { money, sumMoney, toPaise } from "@/domain/order-financials";
import { collectPages } from "@/lib/integrations/provider-pagination";
import { NextRequest, NextResponse } from "next/server";
import { Order, OrderItem } from "@/domain/types";
import { marketplaceError } from "@/lib/integrations/error-response";

import {
  getConnectionCredentials,
  updateSyncStatus,
  recordSyncLog,
  getConnectionsForUser,
  saveConnection,
} from "@/lib/security/marketplace-vault";
import { upsertOrders } from "@/lib/integrations/connection-orders";
import { buildSyncResult, syncSuccessResponse } from "@/lib/integrations/sync-contract";

const FLIPKART_TOKEN_URL = "https://api.flipkart.net/oauth-service/oauth/token";
const FLIPKART_ORDERS_SEARCH_URL = "https://api.flipkart.net/sellers/v3/shipments/filter/";

/**
 * Exchanges seller self-access application credentials for a token using HTTP Basic authentication.
 * Satisfies TASK-4.1.
 */
async function getSelfAccessToken(appId: string, appSecret: string) {
  try { return { ...await flipkartToken({ grant_type: "client_credentials", scope: "Seller_Api" }, appId, appSecret) }; }
  catch (error) { return { accessToken: null, error: publicProviderError(error, "Flipkart authorization failed."), status: error instanceof ProviderRequestError ? error.status : 503 }; }
}

async function refreshOAuthToken(refreshToken: string, clientId = "", clientSecret = "") {
  try { return { ...await flipkartToken({ grant_type: "refresh_token", refresh_token: refreshToken }, clientId, clientSecret) }; }
  catch (error) { return { accessToken: null, error: publicProviderError(error, "Flipkart authorization renewal failed."), status: error instanceof ProviderRequestError ? error.status : 503 }; }
}

async function fetchShipments(accessToken: string, fromDate: string, toDate: string, verifyOnly = false): Promise<any[]> {
  const filters = [
    { type: "preDispatch", states: ["APPROVED", "PACKING_IN_PROGRESS", "PACKED", "FORM_FAILED", "READY_TO_DISPATCH"] },
    { type: "postDispatch", states: ["SHIPPED", "DELIVERED", "PICKUP_COMPLETE"], shipmentTypes: ["NORMAL"] },
    { type: "postDispatch", states: ["SHIPPED", "DELIVERED", "PICKUP_COMPLETE"], shipmentTypes: ["SELF"] },
    ...["marketplaceCancellation", "sellerCancellation", "buyerCancellation"].map(cancellationType => ({ type: "cancelled", states: ["CANCELLED"], cancellationType })),
  ];
  const items: any[] = [];
  for (const filter of verifyOnly ? filters.slice(0, 1) : filters) {
    const shipments = await collectPages<any>(FLIPKART_ORDERS_SEARCH_URL, (url, firstPage) => fetch(url, {
      method: firstPage ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      ...(firstPage ? { body: JSON.stringify({ filter: { ...filter, orderDate: { from: fromDate, to: toDate } }, pagination: { pageSize: verifyOnly ? 1 : 20 } }) } : {}),
      signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
    }), data => {
      if (data?.hasMore && !data.nextPageUrl) throw new Error("Flipkart omitted its next-page URL.");
      return { records: data.shipments, next: verifyOnly ? null : data.nextPageUrl };
    });
    for (const shipment of shipments) {
      if (!Array.isArray(shipment.orderItems)) throw new Error("Flipkart omitted shipment items.");
      items.push(...shipment.orderItems.map((item:any)=>({...item,updatedAt:item.updatedAt||shipment.updatedAt})));
    }
    if (!verifyOnly && shipments.length >= 5000) throw new Error("Flipkart retrieval limit reached; retry with a smaller date window.");
  }
  return items;
}

export async function runSync(userId: string, body: Record<string, any>) {
  try {

    let { action, appId, appSecret } = body;

    // Check vaulted credentials in PostgreSQL if not passed in request body (Zero Client-Side Master Secrets)
    let vaulted: any = null;
    let authType = "SELF_ACCESS";

    const allConnections = await getConnectionsForUser(userId);
    if (allConnections.filter(c => c.marketplace === "Flipkart" && (!body.connectionId || c.id === body.connectionId)).length > 1) throw new Error("Select an explicit store connection.");
    const flipkartConnMeta = allConnections.find((c) => c.marketplace === "Flipkart" && (!body.connectionId || c.id === body.connectionId));
    if (flipkartConnMeta) {
      authType = flipkartConnMeta.authType || "SELF_ACCESS";
    }

    if (!appId || !appSecret) {
      vaulted = await getConnectionCredentials<{
        appId?: string;
        appSecret?: string;
        accessToken?: string;
        refreshToken?: string;
        clientId?: string;
        clientSecret?: string;
        tokenExpiresAt?: string;
      }>(userId, "Flipkart", "", body.connectionId);

      if (vaulted) {
        appId = vaulted.appId || vaulted.clientId;
        appSecret = vaulted.appSecret || vaulted.clientSecret;
      }
    }

    if (body.verificationOnly && body.accessToken) {
      vaulted = body; authType = "OAUTH2"; appId = body.clientId; appSecret = body.clientSecret;
    }
    const hasOAuth = Boolean(vaulted?.refreshToken || (authType === "OAUTH2" && vaulted?.accessToken));
    const hasSelfAccess = Boolean(appId && appSecret);

    if (!hasOAuth && !hasSelfAccess) {
      return marketplaceError(
        "Flipkart",
        "FLIPKART_MISSING_CREDENTIALS",
        "Flipkart credentials not found. Please connect via OAuth 2.0 or configure Application ID and Secret in the vault.",
        400
      );
    }

    const cleanAppId = appId ? String(appId).trim() : "";
    const cleanSecret = appSecret ? String(appSecret).trim() : "";
    const refreshVaultedToken = async () => {
      if (flipkartConnMeta && !body.verificationOnly) return renewConnectionToken(userId, flipkartConnMeta.id, async current => {
        if (tokenIsCurrent(current)) return current;
        if (current.refreshTokenExpiresAt && Date.parse(current.refreshTokenExpiresAt) <= Date.now()) throw new ProviderRequestError(401, false);
        return { ...current, ...await flipkartToken({ grant_type: "refresh_token", refresh_token: current.refreshToken }, current.clientId, current.clientSecret) };
      });
      if (tokenIsCurrent(vaulted)) return { accessToken: vaulted.accessToken as string };
      if (vaulted.refreshTokenExpiresAt && Date.parse(vaulted.refreshTokenExpiresAt) <= Date.now()) return { accessToken: null, status: 401, error: "Flipkart authorization expired. Reconnect the store." };
      const auth = await refreshOAuthToken(vaulted.refreshToken, cleanAppId, cleanSecret);
      return auth;
    };

    // -------------------------------------------------------------------------
    // ACTION 1: test_connection
    // -------------------------------------------------------------------------
    if (action === "test_connection") {
      if (hasOAuth && vaulted?.refreshToken) {
        const auth = await refreshVaultedToken();
        if (!auth.accessToken) {
          return marketplaceError(
            "Flipkart",
            auth.status === 401 ? "FLIPKART_AUTH_FAILED" : "FLIPKART_GATEWAY_UNREACHABLE",
            auth.error || "Flipkart OAuth 2.0 token verification failed.",
            auth.status || 502
          );
        }

        await fetchShipments(auth.accessToken, new Date(Date.now() - 86400000).toISOString(), new Date().toISOString(), true);
        return NextResponse.json({
          success: true,
          message: "Flipkart Seller API authenticated successfully via Merchant OAuth 2.0.",
          authType: "OAUTH2",
        });
      }

      if (hasOAuth && vaulted?.accessToken && !vaulted?.refreshToken) {
        await fetchShipments(vaulted.accessToken, new Date(Date.now() - 86400000).toISOString(), new Date().toISOString(), true);
        return NextResponse.json({ success: true, authType: "OAUTH2", message: "Flipkart order access verified." });
      }

      // Track 1: Developer Self-Access staging test (TASK-4.1)
      const auth = await getSelfAccessToken(cleanAppId, cleanSecret);
      if (!auth.accessToken) {
        return marketplaceError(
          "Flipkart",
          auth.status === 401 ? "FLIPKART_AUTH_FAILED" : "FLIPKART_GATEWAY_UNREACHABLE",
          auth.error || "Invalid Flipkart Application ID or Application Secret.",
          auth.status || 401
        );
      }

      await fetchShipments(auth.accessToken, new Date(Date.now() - 86400000).toISOString(), new Date().toISOString(), true);
      return NextResponse.json({
        success: true,
        message: "Flipkart Seller API authenticated successfully via Seller Self-Access.",
        appId: cleanAppId,
        authType: "SELF_ACCESS",
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: fetch_orders
    // -------------------------------------------------------------------------
    if (action === "fetch_orders") {
      let accessToken: string | null = null;

      // Track selection: Merchant OAuth vs Developer Self-Access (TASK-4.1 & TASK-4.4)
      if (hasOAuth && vaulted?.refreshToken) {
        const auth = await refreshVaultedToken();
        if (!auth.accessToken) {
          await recordSyncLog(userId, {
            marketplace: "Flipkart",
            status: "FAILED",
            errorMessage: auth.error,
          });
          return marketplaceError("Flipkart", "FLIPKART_AUTH_FAILED", auth.error || "OAuth token refresh failed.", auth.status || 401);
        }
        accessToken = auth.accessToken;
      } else if (hasSelfAccess) {
        const auth = await getSelfAccessToken(cleanAppId, cleanSecret);
        if (!auth.accessToken) {
          await recordSyncLog(userId, {
            marketplace: "Flipkart",
            status: "FAILED",
            errorMessage: auth.error,
          });
          return marketplaceError("Flipkart", "FLIPKART_AUTH_FAILED", auth.error || "Self-access token exchange failed.", auth.status || 401);
        }
        accessToken = auth.accessToken;
      } else if (vaulted?.accessToken) {
        accessToken = vaulted.accessToken;
      }

      if (!accessToken) {
        return marketplaceError("Flipkart", "FLIPKART_AUTH_FAILED", "Could not obtain valid access token for Flipkart API.", 401);
      }

      // Formulate query with 48-hour bounded overlap window (TASK-4.4)
      const lastSyncedAt = flipkartConnMeta?.syncCheckpoints?.orders?.lastSyncedAt;
      const fromDate = body.syncWindowStart || (lastSyncedAt
        ? new Date(new Date(lastSyncedAt).getTime() - 48 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const toDate = body.syncWindowEnd || new Date().toISOString();

      const rawOrders = await fetchShipments(accessToken, fromDate, toDate);

      if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
        const nowIso = new Date().toISOString();
        await updateSyncStatus(userId, "Flipkart", "SUCCEEDED", {
          stream: body.reconciliation ? "reconciliation" : "orders", connectionId: body.connectionId,
          lastSyncedAt: toDate,
        });
        await recordSyncLog(userId, {
          marketplace: "Flipkart",
          status: "SUCCEEDED",
          fetchedCount: 0,
        });

        const syncResult = buildSyncResult({
          marketplace: "Flipkart",
          status: "succeeded",
          fetchedCount: 0,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          lastSyncedAt: toDate,
          errors: [],
        });

        return syncSuccessResponse(syncResult, {
          message: "Successfully fetched 0 orders from Flipkart.",
          orders: [],
        });
      }

      // Map authentic multi-line order items & real price components (TASK-4.4)
      const domainOrders: Order[] = rawOrders.map((ro: any, idx: number) => {
        const channelOrderId = ro.orderId;
        if (!channelOrderId || !ro.orderItemId) throw new Error("Flipkart omitted order identity.");
        const fsn = ro.fsn || ro.orderItems?.[0]?.fsn;
        const sku = ro.sku; if(!sku || !ro.orderDate)throw Error('Flipkart omitted SKU or source order date.');
        const orderItemId = ro.orderItemId || ro.orderItems?.[0]?.orderItemId || `ITEM-${idx + 1}`;
        const price=Number(ro.priceComponents?.sellingPrice); if(!Number.isFinite(price))throw Error('Flipkart omitted sellingPrice.');
        const qty = Math.max(1, Number(ro.quantity || ro.orderItems?.[0]?.quantity || 1));
        const tax = Number(ro.priceComponents?.totalTax || ro.priceComponents?.tax || 0);
        const customerPrice=Number(ro.priceComponents?.customerPrice);
        const discount=Number.isFinite(customerPrice)?sumMoney([price,-customerPrice]):Number(ro.priceComponents?.promotionDiscount??0);
        if(discount<0)throw Error('Flipkart promotion discount does not reconcile.');
        const shippingFeeCharged = Number(ro.priceComponents?.shippingCharge || 0);

        const total=Number(ro.priceComponents?.totalPrice);
        if(!Number.isFinite(total) || toPaise(sumMoney([price,-discount,shippingFeeCharged]))!==toPaise(total))throw Error('Flipkart source price components do not reconcile.');
        let status: Order["status"] = "CONFIRMED";
        const rawStatus = (ro.status || "").toUpperCase();
        if (rawStatus === "DELIVERED" || rawStatus === "COMPLETED") {
          status = "DELIVERED";
        } else if (rawStatus === "CANCELLED") {
          status = "CANCELLED";
        } else if (rawStatus === "RETURNED") {
          status = "RETURNED";
        } else if (rawStatus === "RTO") {
          status = "RTO";
        } else if (rawStatus === "SHIPPED" || rawStatus === "DISPATCHED" || rawStatus === "PICKUP_COMPLETE") {
          status = "SHIPPED";
        }

        const item: OrderItem = {
          id: `ITEM-FK-${channelOrderId}-${orderItemId}`,
          sku: String(sku).trim(),
          mfn: fsn || undefined,
          productName: ro.title || `Flipkart Product (${sku})`,
          quantity: qty,
          sellingPrice: money(price/qty),lineSubtotal:money(price),
          discount: money(discount),
          taxAmount: money(tax),
          snapshotUnitCost: 0,costEvidence:"UNKNOWN", // Dated owned catalog cost is resolved at persistence.
          returnedQuantity: status === "RETURNED" || status === "RTO" ? qty : 0,
        };

        return {
          id: `ORD-FK-${channelOrderId}`,
          channelOrderId,
          marketplace: "Flipkart" as const,
          orderDate: ro.orderDate ? ro.orderDate.split("T")[0] : new Date().toISOString().split("T")[0],
          status,
          customerName: ro.customerName || "Flipkart Customer",
          customerCity: ro.deliveryAddress?.city || "India",
          customerState: ro.deliveryAddress?.state || "India",
          items: [item],
          shippingFeeCharged,
          marketplaceChargesEstimate: 0, // No flat 14% guesswork
          notes: `Flipkart API Synced | Order: ${channelOrderId} | FSN: ${fsn || "N/A"}`,
        };
      });

      // Atomic Database Upsert into PostgreSQL (TASK-3.5 / TASK-4.4)
      const grouped = new Map<string, Order>();
      for (const order of domainOrders) {
        const previous = grouped.get(order.channelOrderId);
        if (previous) {
          for (const item of order.items) if (!previous.items.some(existing => existing.id === item.id)) {
            previous.items.push(item);
            previous.shippingFeeCharged=sumMoney([previous.shippingFeeCharged,order.shippingFeeCharged]);
          }
        } else grouped.set(order.channelOrderId, order);
      }
      const completeOrders = [...grouped.values()];
      const dbResult = await upsertOrders(userId, completeOrders, body.connectionId);

      const nowIso = new Date().toISOString();
      await updateSyncStatus(userId, "Flipkart", "SUCCEEDED", {
          stream: body.reconciliation ? "reconciliation" : "orders", connectionId: body.connectionId,
        lastSyncedAt: toDate,
      });

      await recordSyncLog(userId, {
        marketplace: "Flipkart",
        status: "SUCCEEDED",
        fetchedCount: completeOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
      });

      const syncResult = buildSyncResult({
        marketplace: "Flipkart",
        status: "succeeded",
        fetchedCount: completeOrders.length,
        importedCount: dbResult.inserted,
        updatedCount: dbResult.updated,
        skippedCount: Math.max(0, completeOrders.length - (dbResult.inserted + dbResult.updated)),
        lastSyncedAt: toDate,
        errors: [],
      });

      return syncSuccessResponse(syncResult, {
        message: `Successfully fetched ${domainOrders.length} orders from Flipkart.`,
        orders: completeOrders,
        persisted: dbResult,
      });
    }

    return marketplaceError(
      "Flipkart",
      "FLIPKART_INVALID_ACTION",
      `Invalid action specified: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      400
    );
  } catch (error: any) {
    return marketplaceError(
      "Flipkart",
      "FLIPKART_SYNC_FAILED",
      publicProviderError(error, "Internal server error during Flipkart sync."),
      error instanceof ProviderRequestError ? error.status : 502
    );
  }
}
