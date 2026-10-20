import { safeOutboundFetch } from "@/lib/security/ssrf-guard";
import { providerFetch, ProviderRequestError } from "./provider-http";

const money = "shopMoney { amount currencyCode }";
const lineFields = `id title sku quantity originalUnitPriceSet { ${money} }
  discountAllocations { allocatedAmountSet { ${money} } } taxLines { priceSet { ${money} } }`;
const pageInfo = "pageInfo { hasNextPage endCursor }";

export async function shopifyGraphql(shop: string, token: string, query: string, variables: Record<string, any>) {
  const response = await providerFetch(() => safeOutboundFetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
    method: "POST", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000), cache: "no-store",
  }));
  const result = await response.json();
  if (result.errors?.length) {
    const codes = result.errors.map((error: any) => error.extensions?.code);
    throw new ProviderRequestError(codes.includes("ACCESS_DENIED") ? 403 : codes.includes("THROTTLED") ? 429 : 502);
  }
  if (!result.data) throw new ProviderRequestError(502);
  return result.data;
}

/** Every item page is fetched; no silent truncation of a large multi-line order. */
export async function shopifyOrdersPage(shop: string, token: string, query: string, cursor?: string, verifyOnly = false, deadline = Date.now() + 90000) {
  if (Date.now() > deadline) throw new ProviderRequestError(503);
  const data = await shopifyGraphql(shop, token, `query Orders($after: String, $query: String, $first: Int!) {
    orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
      nodes { id legacyResourceId name createdAt updatedAt cancelledAt currencyCode taxesIncluded displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { ${money} } refunds { id } fulfillments(first: 1) { createdAt }
        lineItems(first: 100) { nodes { ${lineFields} } ${pageInfo} }
        shippingLines(first: 100) { nodes { originalPriceSet { ${money} } discountedPriceSet { ${money} } taxLines { priceSet { ${money} } } } ${pageInfo} }
      } ${pageInfo}
    }
  }`, { after: cursor || null, query, first: verifyOnly ? 1 : 25 });
  if (!Array.isArray(data.orders?.nodes)) throw new ProviderRequestError(502);
  const orders: any[] = [];
  for (const order of data.orders.nodes) {
    if (Date.now() > deadline) throw new ProviderRequestError(503);
    const items = [...(order.lineItems?.nodes || [])];
    let next = order.lineItems?.pageInfo;
    const visited = new Set<string>();
    while (!verifyOnly && next?.hasNextPage) {
      if (!next.endCursor || visited.has(next.endCursor) || visited.size >= 100 || Date.now() > deadline) throw new ProviderRequestError(502);
      visited.add(next.endCursor);
      const extra = await shopifyGraphql(shop, token, `query Items($id: ID!, $after: String!) { order(id: $id) { lineItems(first: 100, after: $after) { nodes { ${lineFields} } ${pageInfo} } } }`, { id: order.id, after: next.endCursor });
      if (!Array.isArray(extra.order?.lineItems?.nodes)) throw new ProviderRequestError(502);
      items.push(...extra.order.lineItems.nodes); next = extra.order.lineItems.pageInfo;
    }
    if (order.shippingLines?.pageInfo?.hasNextPage) throw new ProviderRequestError(422, false);
    orders.push({
      id: String(order.legacyResourceId || order.id.split("/").pop()), name: order.name, created_at: order.createdAt, updated_at: order.updatedAt,
      cancelled_at: order.cancelledAt, currency: order.currencyCode, taxes_included: order.taxesIncluded,
      total_price: order.totalPriceSet?.shopMoney?.amount, financial_status: String(order.displayFinancialStatus).toLowerCase(),
      fulfillment_status: order.displayFulfillmentStatus === "FULFILLED" ? "fulfilled" : null,
      refunds: order.refunds || [], fulfillments: (order.fulfillments || []).map((f: any) => ({ created_at: f.createdAt })),
      line_items: items.map((item: any) => ({ id: String(item.id.split("/").pop()), title: item.title, sku: item.sku, quantity: item.quantity,
        price: item.originalUnitPriceSet?.shopMoney?.amount,
        discount_allocations: (item.discountAllocations || []).map((discount: any) => ({ amount: discount.allocatedAmountSet?.shopMoney?.amount })),
        tax_lines: (item.taxLines || []).map((tax: any) => ({ price: tax.priceSet?.shopMoney?.amount })),
      })),
      shipping_lines: (order.shippingLines?.nodes || []).map((line: any) => ({ price: line.originalPriceSet?.shopMoney?.amount,
        discounted_price: line.discountedPriceSet?.shopMoney?.amount,
        tax_lines: (line.taxLines || []).map((tax: any) => ({ price: tax.priceSet?.shopMoney?.amount })),
      })),
    });
  }
  return { orders, next: data.orders.pageInfo?.hasNextPage ? data.orders.pageInfo.endCursor as string : undefined };
}
