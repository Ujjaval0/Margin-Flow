import { NextRequest, NextResponse } from "next/server";
import {
  WooCommerceOrderWebhookSchema,
  mapWooCommerceOrderToDomain,
} from "@/lib/webhooks/schemas/woocommerce-schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, storeUrl, consumerKey, consumerSecret, perPage = 50 } = body;

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Store URL, Consumer Key, and Consumer Secret are required.",
        },
        { status: 400 }
      );
    }

    // Normalize URL
    let cleanUrl = String(storeUrl).trim().replace(/\/+$/, "");
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const cleanKey = String(consumerKey).trim();
    const cleanSecret = String(consumerSecret).trim();

    const basicAuth = Buffer.from(`${cleanKey}:${cleanSecret}`).toString("base64");
    const authHeaders = {
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": "MarginFlow-Integration-Sync/1.0",
      Accept: "application/json",
    };

    // Both Basic auth header and query params for compatibility with Apache/LiteSpeed setups that strip auth headers
    const urlParams = `consumer_key=${encodeURIComponent(cleanKey)}&consumer_secret=${encodeURIComponent(cleanSecret)}`;

    if (action === "test_connection") {
      // Test with orders endpoint (orders?per_page=1 requires standard Read permission)
      const testUrl = `${cleanUrl}/wp-json/wc/v3/orders?per_page=1&${urlParams}`;

      let res: Response;
      try {
        res = await fetch(testUrl, {
          method: "GET",
          headers: authHeaders,
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (fetchErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Could not connect to store at ${cleanUrl}. Network error: ${fetchErr.message || "Connection refused/timed out"}. Ensure your store URL is accessible.`,
          },
          { status: 502 }
        );
      }

      if (res.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication failed (401). Invalid Consumer Key or Consumer Secret. Please check your WooCommerce > Settings > Advanced > REST API credentials.",
          },
          { status: 401 }
        );
      }

      if (res.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied (403). Ensure your REST API key has 'Read' or 'Read/Write' permissions in WooCommerce.",
          },
          { status: 403 }
        );
      }

      if (res.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: "WooCommerce REST API not found (404). Ensure WooCommerce is installed and active, and WordPress Permalinks are set to 'Post name' under Settings > Permalinks.",
          },
          { status: 404 }
        );
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return NextResponse.json(
          {
            success: false,
            error: `Store responded with HTTP ${res.status}: ${errorText.slice(0, 150) || res.statusText}`,
          },
          { status: res.status }
        );
      }

      const totalCount = Number(res.headers.get("x-wp-total")) || 0;

      return NextResponse.json({
        success: true,
        message: "Successfully connected to WooCommerce store.",
        storeUrl: cleanUrl,
        totalOrdersInStore: totalCount,
      });
    }

    if (action === "fetch_orders") {
      const fetchUrl = `${cleanUrl}/wp-json/wc/v3/orders?per_page=${Math.min(Number(perPage) || 50, 100)}&status=any&${urlParams}`;

      let res: Response;
      try {
        res = await fetch(fetchUrl, {
          method: "GET",
          headers: authHeaders,
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
      } catch (fetchErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch orders from ${cleanUrl}. Network error: ${fetchErr.message || "Timeout"}`,
          },
          { status: 502 }
        );
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return NextResponse.json(
          {
            success: false,
            error: `WooCommerce error (HTTP ${res.status}): ${errorText.slice(0, 200) || res.statusText}`,
          },
          { status: res.status }
        );
      }

      const rawOrders = await res.json();
      if (!Array.isArray(rawOrders)) {
        return NextResponse.json(
          {
            success: false,
            error: "Unexpected response format from WooCommerce. Expected an array of orders.",
          },
          { status: 502 }
        );
      }

      const domainOrders = rawOrders.map((rawOrder: any) => {
        const parsed = WooCommerceOrderWebhookSchema.safeParse(rawOrder);
        if (parsed.success) {
          return mapWooCommerceOrderToDomain(parsed.data);
        } else {
          return mapWooCommerceOrderToDomain({
            id: String(rawOrder.id),
            number: String(rawOrder.number || rawOrder.id),
            status: String(rawOrder.status || "processing"),
            date_created: String(rawOrder.date_created || new Date().toISOString()),
            total: Number(rawOrder.total) || 0,
            shipping_total: Number(rawOrder.shipping_total) || 0,
            total_tax: Number(rawOrder.total_tax) || 0,
            discount_total: Number(rawOrder.discount_total) || 0,
            payment_method_title: String(rawOrder.payment_method_title || "Online Payment"),
            billing: rawOrder.billing || {},
            shipping: rawOrder.shipping || {},
            line_items: Array.isArray(rawOrder.line_items) ? rawOrder.line_items : [],
          });
        }
      });

      const totalCount = Number(res.headers.get("x-wp-total")) || domainOrders.length;

      return NextResponse.json({
        success: true,
        message: `Successfully retrieved ${domainOrders.length} orders from WooCommerce.`,
        orders: domainOrders,
        totalInStore: totalCount,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Invalid action specified: '${action}'. Expected 'test_connection' or 'fetch_orders'.`,
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error during WooCommerce sync." },
      { status: 500 }
    );
  }
}
