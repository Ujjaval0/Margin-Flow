import { financialJson } from "@/lib/security/financial-response";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query, ensureMarketplaceTables } from "@/lib/db";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { orderSchema } from "@/domain/snapshot-validation";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { Order, OrderItem } from "@/domain/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return financialJson(
        { success: false, error: "Authentication required to access orders." },
        { status: 401 }
      );
    }

    await ensureMarketplaceTables();

    const searchParams = req.nextUrl.searchParams;
    const marketplaceFilter = searchParams.get("marketplace") || null;
    const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 500), 2000);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    let ordersQuery = `
      SELECT 
        o.id,o.record_data,
        o.display_id,
        o.channel_order_id,
        o.marketplace,
        o.order_date,
        o.status,
        o.customer_name,
        o.customer_city,
        o.customer_state,
        o.shipping_fee_charged,
        o.marketplace_charges_estimate,
        o.fee_estimate_status,
        o.fulfilment_mode,
        o.quick_fee_rate_bps,
        o.settlement_amount,
        o.commission_percent,
        fee.total_paise AS fee_estimate_total_paise,
        fee.status AS latest_fee_estimate_status,
        fee.input_snapshot AS accounting_snapshot,
        o.notes,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT estimate.status, estimate.total_paise, estimate.input_snapshot
        FROM order_fee_estimates estimate
        WHERE estimate.user_id = o.user_id AND estimate.order_id = o.id
        ORDER BY estimate.calculated_at DESC, estimate.id DESC LIMIT 1
      ) fee ON TRUE
      WHERE o.user_id = $1 AND o.deleted_at IS NULL
    `;

    const queryParams: any[] = [userId];

    if (marketplaceFilter && marketplaceFilter !== "ALL" && marketplaceFilter !== "All Channels") {
      queryParams.push(marketplaceFilter);
      ordersQuery += ` AND o.marketplace = $${queryParams.length}`;
    }

    ordersQuery += ` ORDER BY o.order_date DESC, o.created_at DESC, o.id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};`;
    queryParams.push(limit, offset);

    let ordersRes: any;
    try {
      ordersRes = await query(ordersQuery, queryParams);
    } catch {
      return financialJson({ success: false, error: "Database temporarily unavailable." }, { status: 503 });
    }

    const orderRows = ordersRes.rows || [];
    if (orderRows.length === 0) {
      return financialJson({
        success: true,
        orders: [],
        count: 0,
      });
    }

    // Fetch order line items in single batch
    const orderUuids = orderRows.map((r: any) => r.id);
    let itemsByOrderId: Record<string, OrderItem[]> = {};

    try {
      const itemsRes = await query(
        `SELECT 
           oi.id,oi.record_data,
           oi.display_id,
           oi.order_id,
           oi.sku,
           oi.mfn,
           oi.mfn1,
           oi.product_name,
           oi.quantity,
           oi.selling_price,
           oi.line_subtotal,
           oi.discount,
           oi.tax_amount,
           oi.snapshot_unit_cost,
           oi.returned_quantity
         FROM order_items oi
         WHERE oi.order_id = ANY($1::uuid[]);`,
        [orderUuids]
      );

      for (const item of itemsRes.rows || []) {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          ...item.record_data,costEvidence:item.record_data?.costEvidence||(Number(item.snapshot_unit_cost)>0?"RECORDED":"UNKNOWN"),
          id: item.display_id || item.id,
          sku: item.sku,
          mfn: item.mfn,
          mfn1: item.mfn1,
          productName: item.product_name,
          quantity: Number(item.quantity || 1),
          sellingPrice: Number(item.selling_price || 0),
          lineSubtotal: item.line_subtotal == null ? undefined : Number(item.line_subtotal),
          discount: Number(item.discount || 0),
          taxAmount: Number(item.tax_amount || 0),
          snapshotUnitCost: Number(item.snapshot_unit_cost || 0),
          returnedQuantity: Number(item.returned_quantity || 0),
        });
      }
    } catch (itemsErr: any) {
      throw new Error("Order line items unavailable.", { cause: itemsErr });
    }

    const mappedOrders: Order[] = orderRows.map((row: any) => {
      const items = itemsByOrderId[row.id] || [];
      row.accounting_snapshot={...row.accounting_snapshot,...row.record_data};
      const calculatedTotal = items.reduce(
        (sum, it) => sum + ((it.lineSubtotal ?? it.sellingPrice * it.quantity) - it.discount + (row.accounting_snapshot?.pricesIncludeTax ? 0 : it.taxAmount)),
        0
      );

      return {
        ...row.record_data,
        id: row.display_id || row.id,
        channelOrderId: row.channel_order_id || row.display_id,
        marketplace: row.marketplace,
        orderDate: row.order_date ? new Date(row.order_date).toISOString().split("T")[0] : "",
        status: row.status,
        customerName: row.customer_name,
        customerCity: row.customer_city,
        customerState: row.customer_state,
        shippingFeeCharged: Number(row.shipping_fee_charged || 0),
        marketplaceChargesEstimate: Number(row.marketplace_charges_estimate || 0),
        pricesIncludeTax: row.accounting_snapshot?.pricesIncludeTax,
        logisticsRateSlabs: row.accounting_snapshot?.logisticsRateSlabs,
        gstRegistrationType: row.accounting_snapshot?.gstRegistrationType,
        marketplaceFeesIncludeGst: row.accounting_snapshot?.marketplaceFeesIncludeGst,
        marketplaceFeeGstRateBps: row.accounting_snapshot?.marketplaceFeeGstRateBps,
        estimatedFeeTaxAmount: row.accounting_snapshot?.estimatedFeeTaxAmount,
        shippingTaxAmount: row.accounting_snapshot?.shippingTaxAmount,
        shippingRefundAmount: row.accounting_snapshot?.shippingRefundAmount,
        feeEstimateStatus: row.latest_fee_estimate_status || row.fee_estimate_status || "LEGACY",
        feeEstimateTotalPaise: row.latest_fee_estimate_status === "CONFIGURED" ? Number(row.fee_estimate_total_paise) : null,
        fulfilmentMode: row.fulfilment_mode || undefined,
        quickFeeRateBps: row.quick_fee_rate_bps === null ? undefined : Number(row.quick_fee_rate_bps),
        settlementAmount: row.settlement_amount !== null ? Number(row.settlement_amount) : undefined,
        commissionPercent: row.commission_percent !== null ? Number(row.commission_percent) : undefined,
        items,
        totalAmount: calculatedTotal > 0 ? calculatedTotal : Number(row.shipping_fee_charged || 0),
        notes: row.notes || undefined,
      };
    });

    return financialJson({
      success: true,
      orders: mappedOrders,
      count: mappedOrders.length,
    });
  } catch (err: any) {
    console.error("[Orders API Error]:", err);
    return financialJson(
      { success: false, error: "Failed to load orders." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return financialJson(
        { success: false, error: "Authentication required to persist orders." },
        { status: 401 }
      );
    }

    const body = await readJsonBody(req, 10 * 1024 * 1024);
    const orders: Order[] = Array.isArray(body.orders) ? body.orders : [];

    if (orders.length === 0 || orders.length > 1000 || orders.some(order => !orderSchema.safeParse(order).success)) {
      return financialJson(
        { success: false, error: "No orders provided for persistence." },
        { status: 400 }
      );
    }

    const result = await upsertOrders(userId, orders, undefined, body.intent==='CREATE'?'CREATE':body.intent==='UPDATE'?'UPDATE':'SYNC');

    return financialJson({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      orderIds: result.orderIds,
      feeEstimates: result.feeEstimates,
    });
  } catch (err: any) {
    if (err instanceof RequestBodyError) return financialJson({ success: false, error: err.message }, { status: err.status });
    console.error("[Orders POST Error]:", err);
    return financialJson(
      { success: false, error: "Failed to upsert orders." },
      { status: 500 }
    );
  }
}
