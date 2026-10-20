/** Adapter from Amazon's published 2026 proceeds breakdown into the existing audited financial mapper. */
export function amazonOrderSource(order: any): Record<string, any> | null {
  if (!order.orderId || !order.createdTime || !Array.isArray(order.orderItems)) throw new Error("Invalid Amazon order identity.");
  const amount = (value: any) => {
    if (!value || value.amount == null || String(value.amount).trim() === "" || value.currencyCode !== "INR" || !Number.isFinite(Number(value.amount))) throw new Error("Amazon requires evidenced INR amounts.");
    return Number(value.amount);
  };
  const cash = (value: number) => ({ CurrencyCode: "INR", Amount: String(value) });
  const items = order.orderItems.map((item: any) => {
    const breakdowns = item.proceeds?.breakdowns;
    if (!Array.isArray(breakdowns) || !breakdowns.some((entry: any) => entry.type === "ITEM")) return null;
    const subtotal = (type: string) => breakdowns.filter((entry: any) => entry.type === type).reduce((sum: number, entry: any) => sum + amount(entry.subtotal), 0);
    const detail = (type: string, subtype: string) => breakdowns.filter((entry: any) => entry.type === type)
      .flatMap((entry: any) => entry.detailedBreakdowns || []).filter((entry: any) => entry.subtype === subtype)
      .reduce((sum: number, entry: any) => sum + amount(entry.value), 0);
    for (const entry of breakdowns.filter((entry: any) => ["TAX", "DISCOUNT"].includes(entry.type))) {
      if (amount(entry.subtotal) && !entry.detailedBreakdowns?.length) throw new Error("Amazon tax/discount allocation requires source detail.");
    }
    return {
      OrderItemId: item.orderItemId, SellerSKU: item.product?.sellerSku, Title: item.product?.title,
      QuantityOrdered: item.quantityOrdered, ItemPrice: cash(subtotal("ITEM")),
      ItemTax: cash(detail("TAX", "ITEM")), PromotionDiscount: cash(Math.abs(detail("DISCOUNT", "ITEM"))),
      PromotionDiscountTax: cash(Math.abs(detail("TAX", "DISCOUNT"))),
      ShippingPrice: cash(subtotal("SHIPPING")), ShippingTax: cash(detail("TAX", "SHIPPING")),
      ShippingDiscount: cash(Math.abs(detail("DISCOUNT", "SHIPPING"))),
      GiftWrapPrice: cash(subtotal("GIFT_WRAP") + subtotal("OTHER")), GiftWrapTax: cash(detail("TAX", "GIFT_WRAP") + detail("TAX", "COD_FEE") + detail("TAX", "OTHER")),
      CODFee: cash(subtotal("COD_FEE")),
    };
  });
  const pending = ["PENDING", "PENDING_AVAILABILITY"].includes(order.fulfillment?.fulfillmentStatus);
  if (!order.proceeds?.grandTotal || items.some((item: any) => !item)) {
    if (pending || ["CANCELLED", "UNFULFILLABLE"].includes(order.fulfillment?.fulfillmentStatus)) return null;
    throw new Error("Amazon omitted financial proceeds for a non-pending order.");
  }
  const status: Record<string, string> = { PENDING: "Pending", PENDING_AVAILABILITY: "Pending", UNSHIPPED: "Unshipped",
    PARTIALLY_SHIPPED: "PartiallyShipped", SHIPPED: "Shipped", CANCELLED: "Canceled", UNFULFILLABLE: "Unfulfillable" };
  return { AmazonOrderId: order.orderId, PurchaseDate: order.createdTime, LastUpdateDate: order.lastUpdatedTime,
    OrderStatus: status[order.fulfillment?.fulfillmentStatus] || "Unshipped", OrderTotal: cash(amount(order.proceeds.grandTotal)), OrderItems: items };
}
