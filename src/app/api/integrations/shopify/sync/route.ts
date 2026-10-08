import { NextRequest, NextResponse } from "next/server";
import {
  ShopifyOrderWebhookSchema,
  mapShopifyOrderToDomain,
} from "@/lib/webhooks/schemas/shopify-schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, shopDomain, accessToken, limit = 50 } = body;

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Store domain and Admin API Access Token are required.",
        },
        { status: 400 }
      );
    }

    // Clean shop domain: e.g. "my-brand.myshopify.com"
    let cleanDomain = String(shopDomain).trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!cleanDomain.includes(".myshopify.com")) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    const cleanToken = String(accessToken).trim();
    const headers = {
      "X-Shopify-Access-Token": cleanToken,
      "Content-Type": "application/json",
      "User-Agent": "MarginFlow-Shopify-Sync/1.0",
      Accept: "application/json",
    };

    if (action === "test_connection") {
      const testUrl = `https://${cleanDomain}/admin/api/2024-01/shop.json`;

      let res: Response;
      try {
        res = await fetch(testUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Could not reach Shopify store at ${cleanDomain}. Network error: ${err.message || "Timeout"}`,
          },
          { status: 502 }
        );
      }

      if (res.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Authentication failed (401). Invalid Admin API Access Token. Please verify your token in Shopify Admin > Settings > Apps > Develop apps.",
          },
          { status: 401 }
        );
      }

      if (res.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied (403). Ensure your custom app has 'read_orders' and 'read_products' API scopes enabled.",
          },
          { status: 403 }
        );
      }

      if (res.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: `Store domain '${cleanDomain}' not found on Shopify. Please check your .myshopify.com address.`,
          },
          { status: 404 }
        );
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          {
            success: false,
            error: `Shopify responded with HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`,
          },
          { status: res.status }
        );
      }

      const data = await res.json();
      const shopInfo = data?.shop || {};

      return NextResponse.json({
        success: true,
        message: `Connected successfully to Shopify store: ${shopInfo.name || cleanDomain}`,
        storeName: shopInfo.name,
        currency: shopInfo.currency,
        domain: cleanDomain,
      });
    }

    if (action === "fetch_orders") {
      const fetchUrl = `https://${cleanDomain}/admin/api/2024-01/orders.json?status=any&limit=${Math.min(Number(limit) || 50, 100)}`;

      let res: Response;
      try {
        res = await fetch(fetchUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch orders from Shopify. Network error: ${err.message || "Timeout"}`,
          },
          { status: 502 }
        );
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          {
            success: false,
            error: `Shopify order fetch error (HTTP ${res.status}): ${errText.slice(0, 200)}`,
          },
          { status: res.status }
        );
      }

      const json = await res.json();
      const rawOrders = json?.orders || [];

      if (!Array.isArray(rawOrders)) {
        return NextResponse.json(
          { success: false, error: "Expected an array of orders from Shopify." },
          { status: 502 }
        );
      }

      const domainOrders = rawOrders.map((raw: any) => {
        const parsed = ShopifyOrderWebhookSchema.safeParse(raw);
        if (parsed.success) {
          return mapShopifyOrderToDomain(parsed.data);
        } else {
          return mapShopifyOrderToDomain({
            id: String(raw.id),
            name: String(raw.name || `#${raw.order_number || raw.id}`),
            created_at: String(raw.created_at || new Date().toISOString()),
            financial_status: String(raw.financial_status || "paid"),
            fulfillment_status: raw.fulfillment_status,
            currency: String(raw.currency || "INR"),
            total_price: Number(raw.total_price) || 0,
            subtotal_price: Number(raw.subtotal_price) || 0,
            total_tax: Number(raw.total_tax) || 0,
            total_discounts: Number(raw.total_discounts) || 0,
            customer: raw.customer,
            shipping_address: raw.shipping_address,
            line_items: Array.isArray(raw.line_items) ? raw.line_items : [],
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Successfully fetched ${domainOrders.length} orders from Shopify.`,
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
      { success: false, error: error.message || "Internal server error during Shopify sync." },
      { status: 500 }
    );
  }
}
