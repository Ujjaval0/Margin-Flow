import { z } from "zod";
import { Order, OrderItem, ReturnRecord } from "@/domain/types";

export const ShopifyLineItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().default("Shopify Item"),
  sku: z.string().default("SKU-UNASSIGNED"),
  quantity: z.number().int().positive().default(1),
  price: z.string().or(z.number()).transform((val) => Number(val) || 0),
  total_discount: z.string().or(z.number()).transform((val) => Number(val) || 0).default(0),
  tax_lines: z
    .array(
      z.object({
        price: z.string().or(z.number()).transform((val) => Number(val) || 0),
        rate: z.number().optional(),
      })
    )
    .default([]),
});

export const ShopifyOrderWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().default("#1001"), // Order number e.g. #1001
  created_at: z.string().optional().default(() => new Date().toISOString()),
  financial_status: z.string().default("paid"),
  fulfillment_status: z.string().nullable().optional(),
  currency: z.string().default("INR"),
  total_price: z.string().or(z.number()).transform((val) => Number(val) || 0),
  subtotal_price: z.string().or(z.number()).transform((val) => Number(val) || 0).default(0),
  total_tax: z.string().or(z.number()).transform((val) => Number(val) || 0).default(0),
  total_discounts: z.string().or(z.number()).transform((val) => Number(val) || 0).default(0),
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
  const customerName = payload.customer
    ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() || "Shopify Customer"
    : "Shopify Customer";

  const city = payload.shipping_address?.city || "Direct Customer";
  const state = payload.shipping_address?.province || "Direct";

  const orderDate = payload.created_at ? payload.created_at.split("T")[0] : new Date().toISOString().split("T")[0];

  const items: OrderItem[] = (payload.line_items || []).map((item, idx) => {
    const unitPrice = item.price;
    const itemTaxes = item.tax_lines.reduce((sum, t) => sum + t.price, 0);
    const unitCost = catalogCostLookup?.[item.sku] || Math.round(unitPrice * 0.45); // Standard 45% default if uncataloged

    return {
      id: `ITEM-SHP-${payload.id}-${idx + 1}`,
      sku: item.sku || `SKU-SHP-${item.id}`,
      productName: item.title,
      quantity: item.quantity,
      sellingPrice: unitPrice,
      discount: item.total_discount,
      taxAmount: itemTaxes,
      snapshotUnitCost: unitCost,
      returnedQuantity: 0,
    };
  });

  // Estimated Shopify payments fee (2% gateway + platform fee estimate)
  const totalAmount = payload.total_price;
  const estimatedGatewayFee = Math.round(totalAmount * 0.02 * 100) / 100;
  const estimatedShipping = 80;

  return {
    id: `ORD-SHP-${payload.id}`,
    channelOrderId: payload.name,
    marketplace: "Personal Website",
    orderDate,
    status: payload.fulfillment_status === "fulfilled" ? "DELIVERED" : "CONFIRMED",
    customerName,
    customerCity: city,
    customerState: state,
    items,
    shippingFeeCharged: estimatedShipping,
    marketplaceChargesEstimate: estimatedGatewayFee,
    notes: `Shopify Webhook Ingested | Status: ${payload.financial_status}`,
  };
}
