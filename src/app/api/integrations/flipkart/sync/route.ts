import { NextRequest, NextResponse } from "next/server";
import { Order, OrderItem } from "@/domain/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, appId, appSecret } = body;

    if (!appId || !appSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Flipkart Application ID (App ID) and Application Secret are required.",
        },
        { status: 400 }
      );
    }

    const cleanAppId = String(appId).trim();
    const cleanSecret = String(appSecret).trim();

    if (action === "test_connection") {
      const oauthUrl = `https://api.flipkart.net/oauth-service/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(
        cleanAppId
      )}&client_secret=${encodeURIComponent(cleanSecret)}`;

      let res: Response;
      try {
        res = await fetch(oauthUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "MarginFlow-Flipkart-Sync/1.0",
          },
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (err: any) {
        // If external Flipkart gateway is unreachable or in developer staging
        return NextResponse.json(
          {
            success: false,
            error: `Could not reach Flipkart Developer API gateway: ${err.message || "Network timeout"}. Please verify your network or Developer App status in Seller Hub.`,
          },
          { status: 502 }
        );
      }

      if (res.status === 401 || res.status === 400) {
        const errorJson = await res.json().catch(() => ({}));
        return NextResponse.json(
          {
            success: false,
            error:
              errorJson.error_description ||
              errorJson.error ||
              "Invalid Flipkart Application ID or Application Secret. Verify under Seller Hub > Developer Access.",
          },
          { status: 401 }
        );
      }

      if (res.ok) {
        const tokenData = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: true,
          message: "Flipkart Seller API authenticated successfully via OAuth 2.0.",
          appId: cleanAppId,
          expiresIn: tokenData.expires_in || 3600,
        });
      }

      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Flipkart API responded with HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`,
        },
        { status: res.status }
      );
    }

    if (action === "fetch_orders") {
      // 1. Authenticate with Flipkart OAuth
      const oauthUrl = `https://api.flipkart.net/oauth-service/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(
        cleanAppId
      )}&client_secret=${encodeURIComponent(cleanSecret)}`;

      let authRes: Response;
      try {
        authRes = await fetch(oauthUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "MarginFlow-Flipkart-Sync/1.0",
          },
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Flipkart OAuth network error: ${err.message}`,
          },
          { status: 502 }
        );
      }

      if (!authRes.ok) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to authenticate with Flipkart Seller API. Check App credentials.",
          },
          { status: 401 }
        );
      }

      const tokenData = await authRes.json();
      const accessToken = tokenData.access_token;

      // 2. Query Orders Search Endpoint
      const ordersUrl = "https://api.flipkart.net/sellers/v3/orders/search";
      let ordersRes: Response;
      try {
        ordersRes = await fetch(ordersUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            filter: {
              orderDate: {
                fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                toDate: new Date().toISOString(),
              },
            },
            pagination: {
              pageSize: 50,
            },
          }),
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch orders from Flipkart: ${err.message}`,
          },
          { status: 502 }
        );
      }

      if (!ordersRes.ok) {
        const errText = await ordersRes.text().catch(() => "");
        return NextResponse.json(
          {
            success: false,
            error: `Flipkart order search error (HTTP ${ordersRes.status}): ${errText.slice(0, 200)}`,
          },
          { status: ordersRes.status }
        );
      }

      const ordersData = await ordersRes.json();
      const rawOrders = ordersData.orderItems || ordersData.orders || [];

      const domainOrders: Order[] = rawOrders.map((ro: any, idx: number) => {
        const orderId = ro.orderId || `FK-${Date.now()}-${idx + 1}`;
        const sku = ro.sku || ro.fsn || `SKU-FK-${idx + 1}`;
        const price = Number(ro.priceComponents?.sellingPrice || ro.sellingPrice) || 999;
        const qty = Number(ro.quantity) || 1;

        const item: OrderItem = {
          id: `ITEM-FK-${orderId}-1`,
          sku,
          productName: ro.title || `Flipkart Product (${sku})`,
          quantity: qty,
          sellingPrice: price,
          discount: 0,
          taxAmount: Math.round(price * 0.18 * 100) / 100,
          snapshotUnitCost: Math.round(price * 0.45),
          returnedQuantity: 0,
        };

        return {
          id: `ORD-FK-${orderId}`,
          channelOrderId: orderId,
          marketplace: "Flipkart",
          orderDate: ro.orderDate ? ro.orderDate.split("T")[0] : new Date().toISOString().split("T")[0],
          status: ro.status === "DELIVERED" ? "DELIVERED" : ro.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
          customerName: ro.customerName || "Flipkart Customer",
          customerCity: ro.deliveryAddress?.city || "Direct Customer",
          customerState: ro.deliveryAddress?.state || "Direct",
          items: [item],
          shippingFeeCharged: 0,
          marketplaceChargesEstimate: Math.round(price * 0.12 * 100) / 100,
          notes: `Flipkart API Synced | Order: ${orderId}`,
        };
      });

      return NextResponse.json({
        success: true,
        message: `Successfully fetched ${domainOrders.length} orders from Flipkart.`,
        orders: domainOrders,
        totalInStore: domainOrders.length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Invalid action: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during Flipkart sync." },
      { status: 500 }
    );
  }
}
