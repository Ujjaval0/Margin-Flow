import { z } from "zod";
import { Order, OrderItem, Marketplace } from "@/domain/types";

export const GenericOrderItemSchema = z.object({
  sku: z.string().min(1),
  productName: z.string().default("Generic Item"),
  quantity: z.number().int().positive().default(1),
  sellingPrice: z.number().nonnegative(),
  unitCost: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
});

export const GenericOrderWebhookSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.string().optional(),
  channelOrderId: z.string().min(1),
  marketplace: z.enum([
    "Amazon India",
    "Flipkart",
    "Meesho",
    "Personal Website",
    "Myntra",
    "WooCommerce",
    "B2B Wholesale",
    "Other",
  ]),
  customerName: z.string().default("Retail Customer"),
  customerCity: z.string().default("Direct"),
  customerState: z.string().default("Direct"),
  status: z
    .enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"])
    .default("CONFIRMED"),
  shippingFeeCharged: z.number().nonnegative().default(0),
  marketplaceChargesEstimate: z.number().nonnegative().default(0),
  items: z.array(GenericOrderItemSchema).min(1),
  notes: z.string().optional(),
});

export type GenericOrderWebhookPayload = z.infer<typeof GenericOrderWebhookSchema>;

/**
 * Maps generic payload to native Order domain entity
 */
export function mapGenericOrderToDomain(
  payload: GenericOrderWebhookPayload,
  catalogCostLookup?: Record<string, number>
): Order {
  const orderDate = (payload.timestamp ? new Date(payload.timestamp) : new Date())
    .toISOString()
    .split("T")[0];

  const items: OrderItem[] = payload.items.map((item, idx) => {
    const cost =
      item.unitCost ??
      catalogCostLookup?.[item.sku] ??
      Math.round(item.sellingPrice * 0.45);

    return {
      id: `ITEM-GEN-${payload.eventId}-${idx + 1}`,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      discount: item.discount,
      taxAmount: item.taxAmount,
      snapshotUnitCost: cost,
      returnedQuantity: 0,
    };
  });

  return {
    id: `ORD-WEB-${Date.now().toString().slice(-6)}`,
    channelOrderId: payload.channelOrderId,
    marketplace: payload.marketplace as Marketplace,
    orderDate,
    status: payload.status,
    customerName: payload.customerName,
    customerCity: payload.customerCity,
    customerState: payload.customerState,
    items,
    shippingFeeCharged: payload.shippingFeeCharged,
    marketplaceChargesEstimate: payload.marketplaceChargesEstimate,
    notes: payload.notes || `Ingested via Generic Webhook Gateway (${payload.marketplace})`,
  };
}
