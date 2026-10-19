import { money, sumMoney } from "@/domain/order-financials";
import { z } from "zod";
import { Order, OrderItem } from "@/domain/types";

export const WooLineItemSchema = z.object({
  id: z.number().or(z.string()).transform(String),
  name: z.string().default("WooCommerce Product"),
  product_id: z.number().or(z.string()).transform(String),
  sku: z.string().default(""),
  quantity: z.number().int().positive(),
  subtotal: z.string().or(z.number()).transform(Number).pipe(z.number().finite()),
  total: z.string().or(z.number()).transform(Number).pipe(z.number().finite()),
  total_tax: z.string().or(z.number()).transform(Number).default(0),
  price: z.number().or(z.string()).transform(Number).default(0),
});

export const WooCommerceOrderWebhookSchema = z.object({
  id: z.number().or(z.string()).transform(String),
  number: z.string().default("1001"),
  status: z.string().default("processing"),
  date_created: z.string(),
  date_modified:z.string().optional(),date_completed:z.string().nullable().optional(),currency:z.string(),
  fee_lines:z.array(z.object({total:z.string().or(z.number()).transform(Number),total_tax:z.string().or(z.number()).transform(Number).default(0)})).default([]),
  refunds:z.array(z.unknown()).default([]),
  total: z.string().or(z.number()).transform(Number).default(0),
  shipping_tax: z.string().or(z.number()).transform(Number).default(0),
  shipping_total: z.string().or(z.number()).transform(Number).default(0),
  total_tax: z.string().or(z.number()).transform(Number).default(0),
  discount_total: z.string().or(z.number()).transform(Number).default(0),
  payment_method_title: z.string().nullable().optional().transform((v) => v || "Online Payment"),
  billing: z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  shipping: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  line_items: z.array(WooLineItemSchema).default([]),
});

export type WooCommerceOrderWebhookPayload = z.infer<typeof WooCommerceOrderWebhookSchema>;

/**
 * Maps validated WooCommerce payload into MarginFlow canonical Order domain model
 */
export function mapWooCommerceOrderToDomain(
  payload: WooCommerceOrderWebhookPayload,
  catalogCostLookup?: Record<string, number>
): Order {
  if(payload.currency!=='INR')throw Error('Unsupported currency: only INR invoices can be posted.');
  if(payload.refunds.length || payload.status==='refunded')throw Error('WooCommerce refunds require dated refund/return reconciliation before import. No records were posted.');
  const customerName = payload.billing
    ? `${payload.billing.first_name || ""} ${payload.billing.last_name || ""}`.trim() || "WooCommerce Buyer"
    : "WooCommerce Buyer";

  const city = payload.shipping?.city || payload.billing?.city || "Direct Customer";
  const state = payload.shipping?.state || payload.billing?.state || "Direct";
  const orderDate = payload.date_created ? payload.date_created.split("T")[0] : new Date().toISOString().split("T")[0];

  const items: OrderItem[] = (payload.line_items || []).map((item, idx) => {
    const unitPrice = item.quantity > 0 ? money(item.subtotal / item.quantity) : 0;
    const sku = item.sku || `SKU-WC-${item.product_id}`;
    const unitCost = catalogCostLookup?.[sku] ?? 0;

    return {
      id: `ITEM-WC-${payload.id}-${item.id}`,
      sku,
      productName: item.name,
      quantity: item.quantity,
      sellingPrice: unitPrice,
      lineSubtotal: money(item.subtotal),
      discount: item.subtotal > item.total ? item.subtotal - item.total : 0,
      taxAmount: item.total_tax,
      snapshotUnitCost: unitCost,
      costEvidence:catalogCostLookup?.[sku]!==undefined?'RECORDED':'UNKNOWN',
      returnedQuantity: 0,
    };
  });



  let status: Order["status"] = "CONFIRMED";
  const st = (payload.status || "").toLowerCase();
  if (st === "completed") status = "DELIVERED";
  else if (st === "cancelled" || st === "failed") status = "CANCELLED";
  else if (st === "refunded") status = "RETURNED";
  else if (st === "pending") status = "PENDING";
  else status = "CONFIRMED";

  const customerCharges=sumMoney(payload.fee_lines.map(f=>f.total)),customerChargesTax=sumMoney(payload.fee_lines.map(f=>f.total_tax));
  const sourceCalculated=sumMoney([sumMoney(items.map(item=>sumMoney([item.lineSubtotal||0,-item.discount,item.taxAmount]))),payload.shipping_total,payload.shipping_tax,customerCharges,customerChargesTax]);
  if(Math.abs(sumMoney([sourceCalculated,-payload.total]))>0.01)throw Error('WooCommerce line/fee/tax/shipping totals do not reconcile to source total.');
  return {
    id: `ORD-WC-${payload.id}`,
    channelOrderId: `WC-${payload.number || payload.id}`,
    marketplace: "WooCommerce",
    orderDate,
    currency:'INR',sourceTotal:payload.total,sourceUpdatedAt:payload.date_modified,
    revenueRecognisedDate:payload.date_completed?.slice(0,10),customerCharges,customerChargesTax,
    status,
    customerName,
    customerCity: city,
    customerState: state,
    items,
    shippingFeeCharged: sumMoney([payload.shipping_total, payload.shipping_tax]),
    shippingTaxAmount: payload.shipping_tax,
    pricesIncludeTax: false,
    feeEstimateStatus: "NOT_CONFIGURED",
    marketplaceChargesEstimate: 0,
    notes: `WooCommerce Order | Method: ${payload.payment_method_title}`,
  };
}
