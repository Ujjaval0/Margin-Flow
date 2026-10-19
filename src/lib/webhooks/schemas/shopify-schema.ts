import { money, sumMoney } from "@/domain/order-financials";
import { z } from "zod";
import { Order, OrderItem, ReturnRecord } from "@/domain/types";

export const ShopifyLineItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().default("Shopify Item"),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.string().or(z.number()).transform(Number).pipe(z.number().finite()),
  total_discount: z.string().or(z.number()).transform(Number).pipe(z.number().finite()).default(0),
  discount_allocations:z.array(z.object({amount:z.string().or(z.number()).transform(Number)})).optional(),
  tax_lines: z
    .array(
      z.object({
        price: z.string().or(z.number()).transform(Number).pipe(z.number().finite()),
        rate: z.number().optional(),
      })
    )
    .default([]),
});

export const ShopifyOrderWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().default("#1001"), // Order number e.g. #1001
  created_at: z.string(),
  updated_at:z.string().optional(),cancelled_at:z.string().nullable().optional(),
  refunds:z.array(z.unknown()).default([]),fulfillments:z.array(z.object({created_at:z.string().optional()})).default([]),
  financial_status: z.string().default("paid"),
  fulfillment_status: z.string().nullable().optional(),
  currency: z.string(),
  total_price: z.string().or(z.number()).transform(Number).pipe(z.number().finite()),
  subtotal_price: z.string().or(z.number()).transform(Number).pipe(z.number().finite()).default(0),
  taxes_included: z.boolean().optional(),
  total_shipping_price_set: z.object({ shop_money: z.object({ amount: z.string().or(z.number()).transform(Number) }) }).optional(),
  shipping_lines: z.array(z.object({ price: z.string().or(z.number()).transform(Number), discounted_price: z.string().or(z.number()).transform(Number).optional(), tax_lines: z.array(z.object({ price: z.string().or(z.number()).transform(Number) })).default([]) })).default([]),
  total_tax: z.string().or(z.number()).transform(Number).pipe(z.number().finite()).default(0),
  total_discounts: z.string().or(z.number()).transform(Number).pipe(z.number().finite()).default(0),
  customer: z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
    })
    .nullable()
    .optional(),
  shipping_address: z
    .object({
      city: z.string().optional(),
      province: z.string().optional(),
      country: z.string().optional(),
    })
    .nullable()
    .optional(),
  line_items: z.array(ShopifyLineItemSchema).default([]),
});

export type ShopifyOrderWebhookPayload = z.infer<typeof ShopifyOrderWebhookSchema>;

/**
 * Maps validated Shopify payload into MarginFlow canonical Order domain model
 */
export function mapShopifyOrderToDomain(
  payload: ShopifyOrderWebhookPayload,
  catalogCostLookup?: Record<string, number>
): Order {
  if(payload.currency!=='INR')throw Error('Unsupported currency: only INR invoices can be posted.');
  if(payload.refunds.length || /refunded/.test(payload.financial_status) || payload.cancelled_at && payload.fulfillment_status==='fulfilled')throw Error('Refunded/fulfilled-cancelled Shopify orders require dated refund/return reconciliation before import. No records were posted.');
  const customerName = payload.customer
    ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() || "Shopify Customer"
    : "Shopify Customer";

  const city = payload.shipping_address?.city || "Direct Customer";
  const state = payload.shipping_address?.province || "Direct";

  const orderDate = payload.created_at ? payload.created_at.split("T")[0] : new Date().toISOString().split("T")[0];

  const items: OrderItem[] = (payload.line_items || []).map((item, idx) => {
    const unitPrice = item.price;
    const itemTaxes = item.tax_lines.reduce((sum, t) => sum + t.price, 0);
    const unitCost = catalogCostLookup?.[item.sku] ?? 0;

    return {
      id: `ITEM-SHP-${payload.id}-${item.id}`,
      sku: item.sku || `SKU-SHP-${item.id}`,
      productName: item.title,
      quantity: item.quantity,
      sellingPrice: unitPrice,
      discount: item.discount_allocations?sumMoney(item.discount_allocations.map(allocation=>allocation.amount)):item.total_discount,
      taxAmount: itemTaxes,
      snapshotUnitCost: unitCost,
      costEvidence:catalogCostLookup?.[item.sku]!==undefined?'RECORDED':'UNKNOWN',
      returnedQuantity: 0,
    };
  });

  const shipping = sumMoney(payload.shipping_lines.map(line => line.discounted_price ?? line.price));
  const shippingTax = sumMoney(payload.shipping_lines.flatMap(line => line.tax_lines.map(tax => tax.price)));
  const shippingCharge = payload.total_shipping_price_set?.shop_money.amount ?? shipping;
  const sourceCalculated=sumMoney([sumMoney(items.map(item=>sumMoney([item.quantity*item.sellingPrice,-item.discount,payload.taxes_included?0:item.taxAmount]))),shippingCharge,payload.taxes_included?0:shippingTax]);
  if(Math.abs(sumMoney([sourceCalculated,-payload.total_price]))>0.01)throw Error('Shopify line/discount/tax/shipping totals do not reconcile to source total.');

  return {
    id: `ORD-SHP-${payload.id}`,
    channelOrderId: payload.name,
    marketplace: "Personal Website",
    orderDate,
    currency:'INR',sourceTotal:payload.total_price,sourceUpdatedAt:payload.updated_at,
    revenueRecognisedDate:payload.fulfillment_status==='fulfilled'?payload.fulfillments[0]?.created_at?.slice(0,10):undefined,
    status:payload.cancelled_at?'CANCELLED': payload.fulfillment_status === "fulfilled" ? "DELIVERED" : "CONFIRMED",
    customerName,
    customerCity: city,
    customerState: state,
    items,
    shippingFeeCharged: sumMoney([shippingCharge, payload.taxes_included ? 0 : shippingTax]),
    shippingTaxAmount: shippingTax,
    pricesIncludeTax: payload.taxes_included,
    feeEstimateStatus: "NOT_CONFIGURED",
    marketplaceChargesEstimate: 0,
    notes: `Shopify Webhook Ingested | Status: ${payload.financial_status}`,
  };
}
