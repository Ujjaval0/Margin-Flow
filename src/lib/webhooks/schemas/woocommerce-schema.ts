import { z } from "zod";
import { Order, OrderItem } from "@/domain/types";

export const WooLineItemSchema = z.object({
  id: z.number().or(z.string()).transform(String),
  name: z.string().default("WooCommerce Product"),
  product_id: z.number().or(z.string()).transform(String),
  sku: z.string().default(""),
  quantity: z.number().int().positive().default(1),
  subtotal: z.string().or(z.number()).transform(Number).default(0),
  total: z.string().or(z.number()).transform(Number).default(0),
  total_tax: z.string().or(z.number()).transform(Number).default(0),
  price: z.number().or(z.string()).transform(Number).default(0),
});

export const WooCommerceOrderWebhookSchema = z.object({
  id: z.number().or(z.string()).transform(String),
  number: z.string().default("1001"),
  status: z.string().default("processing"),
  date_created: z.string().optional().default(() => new Date().toISOString()),
  total: z.string().or(z.number()).transform(Number).default(0),
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
  const customerName = payload.billing
    ? `${payload.billing.first_name || ""} ${payload.billing.last_name || ""}`.trim() || "WooCommerce Buyer"
    : "WooCommerce Buyer";

  const city = payload.shipping?.city || payload.billing?.city || "Direct Customer";
  const state = payload.shipping?.state || payload.billing?.state || "Direct";
  const orderDate = payload.date_created ? payload.date_created.split("T")[0] : new Date().toISOString().split("T")[0];

  const items: OrderItem[] = (payload.line_items || []).map((item, idx) => {
    const unitPrice = item.price || (item.quantity > 0 ? item.total / item.quantity : item.total);
    const sku = item.sku || `SKU-WC-${item.product_id}`;
    const unitCost = catalogCostLookup?.[sku] || Math.round(unitPrice * 0.45);

    return {
      id: `ITEM-WC-${payload.id}-${idx + 1}`,
      sku,
      productName: item.name,
      quantity: item.quantity,
      sellingPrice: unitPrice,
      discount: item.subtotal > item.total ? item.subtotal - item.total : 0,
      taxAmount: item.total_tax,
      snapshotUnitCost: unitCost,
      returnedQuantity: 0,
    };
  });

  const gatewayFee = Math.round(payload.total * 0.02 * 100) / 100;

  let status: Order["status"] = "CONFIRMED";
  const st = (payload.status || "").toLowerCase();
  if (st === "completed") status = "DELIVERED";
  else if (st === "cancelled" || st === "failed") status = "CANCELLED";
  else if (st === "refunded") status = "RETURNED";
  else if (st === "pending") status = "PENDING";
  else status = "CONFIRMED";

  return {
    id: `ORD-WC-${payload.id}`,
    channelOrderId: `WC-${payload.number || payload.id}`,
    marketplace: "WooCommerce",
    orderDate,
    status,
    customerName,
    customerCity: city,
    customerState: state,
    items,
    shippingFeeCharged: payload.shipping_total,
    marketplaceChargesEstimate: gatewayFee,
    notes: `WooCommerce Order | Method: ${payload.payment_method_title}`,
  };
}
