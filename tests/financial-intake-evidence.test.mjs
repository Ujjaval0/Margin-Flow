import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const loadApp = createRequire(import.meta.url)('./helpers/load-app.cjs');
const load = (entry, mocks = {}, globals = {}) => loadApp(entry, { '@/lib/db': { query: () => { throw Error('Unexpected database access in intake unit test'); } }, ...mocks }, globals);
const { invoiceToOrder } = load('src/domain/invoice-order.ts');
const { detectAndMapCsv } = load('src/domain/csv-auto-mapper.ts');
const { mapGenericSourceOrder } = load('src/lib/integrations/generic-order.ts');
const { getOrderFinancialFacts } = load('src/domain/order-financials.ts');
const { generateGeneralLedger } = load('src/domain/ledger-engine.ts');
const shopify = load('src/lib/webhooks/schemas/shopify-schema.ts');
const woo = load('src/lib/webhooks/schemas/woocommerce-schema.ts');
const amazon = load('src/lib/integrations/amazon-financial-events.ts');
const catalog = ['A', 'B'].map(sku => ({ id: 'P-' + sku, sku, name: sku, active: true,
  category: '', brand: '', currentCostPrice: 0, costHistory: [], supplierId: '', channelAliases: {} }));
const line = (sku, unitPrice, taxAmount) => ({ sku, quantity: 1, unitPrice, discount: 0, taxAmount });
const invoice = () => ({ invoiceNumber: 'INV-354', orderDate: '2026-10-15', currency: 'INR',
  pricesIncludeTax: false, lineItems: [line('A', 100, 18), line('B', 200, 36)], totalAmount: 354 });
const importInvoice = source => invoiceToOrder({ text: '', parsedData: source }, 'verified-invoice.pdf', catalog);
const generic = () => ({ id: 'G-1', currency: 'INR', orderDate: '2026-10-15', status: 'DELIVERED',
  revenueRecognisedDate: '2026-10-15', sku: 'A', quantity: 2, total: 200, taxAmount: 0 });

test('invoice import preserves every source line and reconciles 100 + 200 + 54 tax to 354', () => {
  const order = importInvoice(invoice());
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].sellingPrice, 100);
  assert.equal(order.items[1].sellingPrice, 200);
  assert.equal(order.items.reduce((sum, item) => sum + item.taxAmount, 0), 54);
  assert.equal(order.sourceTotal, 354);
  assert.equal(order.pricesIncludeTax, false);
  assert.ok(order.items.every(item => item.costEvidence === 'UNKNOWN'));
  assert.throws(() => importInvoice({ ...invoice(), totalAmount: 118 }), /all invoice lines/i);
});

test('invoice import rejects missing currency, date, SKU, unit price and unknown taxable price basis', () => {
  for (const field of ['currency', 'orderDate']) {
    const source = invoice(); delete source[field];
    assert.throws(() => importInvoice(source), undefined, field);
  }
  for (const field of ['sku', 'unitPrice']) {
    const source = invoice(); delete source.lineItems[1][field];
    assert.throws(() => importInvoice(source), /evidenced SKU, quantity, unit price/i, field);
  }
  const source = invoice(); delete source.pricesIncludeTax;
  assert.throws(() => importInvoice(source), /price basis/i);
  assert.throws(() => importInvoice({ ...invoice(), currency: 'USD' }), /INR/);
});

test('invoice import rejects fractional paise instead of rounding source totals into validity', () => {
  const source = invoice(); source.lineItems[0].unitPrice = 100.001; source.totalAmount = 354.001;
  assert.throws(() => importInvoice(source), /precision|financial fields/i);
});

async function extractInvoice(extraction) {
  const idp = load('src/domain/idp-pipeline.ts', {
    ai: { generateObject: async ({ schema }) => ({ object: schema.parse(extraction) }) },
    '@ai-sdk/google': { createGoogleGenerativeAI: () => () => ({}) },
  }, { console: { ...console, warn: () => {} } });
  return idp.executeIDPPipeline('invoice.pdf', 'Source invoice text', { apiKey: 'test-key', customType: 'INVOICE' });
}
const extracted = () => ({ invoiceNumber: 'INV-354', invoiceDate: '2026-10-15', currency: 'INR', pricesIncludeTax: false,
  subtotal: 300, taxTotal: 54, grandTotal: 354, lineItems: [
    { sku: 'A', quantity: 1, unitPrice: 100, cgst: 9, sgst: 9, igst: 0 },
    { sku: 'B', quantity: 1, unitPrice: 200, cgst: 18, sgst: 18, igst: 0 },
  ] });

test('structured IDP verifies all lines and keeps its 354 proposal staged for human review', async () => {
  const result = await extractInvoice(extracted());
  assert.equal(result.source, 'LLM_STRUCTURED_IDP');
  assert.equal(result.validation.passed, true);
  assert.equal(result.validation.calculatedTotal, 354);
  assert.equal(result.stagedDocument.status, 'STAGED_NEEDS_REVIEW');
  assert.equal(result.stagedDocument.lineItems.length, 2);
  assert.equal(result.stagedDocument.lineItems[1].taxAmount, 36);
  const order = importInvoice({ ...invoice(), lineItems: result.stagedDocument.lineItems });
  assert.equal(order.sourceTotal, 354);
});

test('structured IDP does not verify an invoice whose currency or source date is missing', async () => {
  for (const field of ['currency', 'invoiceDate']) {
    const source = extracted(); delete source[field];
    const result = await extractInvoice(source);
    assert.equal(result.validation.passed, false, field);
    assert.equal(result.stagedDocument.status, 'STAGED_NEEDS_REVIEW');
  }
});

test('structured IDP cannot mark a missing price or SKU as a verified zero-value line', async () => {
  for (const missing of ['unitPrice', 'sku']) {
    const item = { sku: 'A', quantity: 1, unitPrice: 0, cgst: 0, sgst: 0, igst: 0 };
    delete item[missing];
    const result = await extractInvoice({ invoiceNumber: 'ZERO', invoiceDate: '2026-10-15', currency: 'INR', lineItems: [item], grandTotal: 0 });
    assert.equal(result.validation.passed, false, 'Missing ' + missing + ' must remain unresolved');
    assert.equal(result.stagedDocument.status, 'STAGED_NEEDS_REVIEW');
  }
});

const csvText = (cgst = '9.00', sgst = '9.00', gst = '18.00') => [
  'Order ID,Order Date,SKU,Quantity,Unit Price,CGST,SGST,Total Tax,Currency,Prices Include Tax',
  `CSV-1,2026-10-15,A,1,100.00,${cgst},${sgst},${gst},INR,false`,
].join('\n');

test('CSV preserves both CGST and SGST and rejects inconsistent aggregate GST', () => {
  const result = detectAndMapCsv(csvText(), catalog);
  assert.equal(result.errors.length, 0, result.errors.join('; '));
  assert.equal(result.orders[0].items[0].taxAmount, 18);
  assert.equal(result.orders[0].taxEvidenceStatus, 'RECORDED');
  const inconsistent = detectAndMapCsv(csvText('9', '9', '9'), catalog);
  assert.equal(inconsistent.orders.length, 0);
  assert.match(inconsistent.errors.join('; '), /total GST disagrees/i);
});

test('CSV rejects fractional-paise GST and price input as a complete batch', () => {
  for (const text of [csvText('9.001', '9', '18'), csvText().replace('100.00', '100.001')]) {
    const result = detectAndMapCsv(text, catalog);
    assert.equal(result.orders.length, 0);
    assert.ok(result.errors.length > 0);
  }
});

test('generic source extended amount 200 for quantity two stays 200 instead of becoming 400', () => {
  const order = mapGenericSourceOrder(generic(), 'Other');
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].sellingPrice, 100);
  assert.equal(order.items[0].lineSubtotal, 200);
  assert.equal(getOrderFinancialFacts(order, [], [], []).netSales, 200);
  const thirds = mapGenericSourceOrder({ ...generic(), quantity: 3, total: 100 }, 'Other');
  assert.equal(thirds.items[0].lineSubtotal, 100);
  assert.equal(getOrderFinancialFacts(thirds, [], [], []).netSales, 100);
});

test('generic source requires explicit currency, date, price or extended amount, SKU and positive quantity', () => {
  for (const field of ['currency', 'orderDate', 'total', 'sku', 'quantity']) {
    const source = generic(); delete source[field];
    assert.throws(() => mapGenericSourceOrder(source, 'Other'), undefined, field);
  }
  assert.throws(() => mapGenericSourceOrder({ ...generic(), currency: 'USD' }, 'Other'), /INR/);
  assert.throws(() => mapGenericSourceOrder({ ...generic(), total: 200.001 }, 'Other'), /financial input/);
});

// Contract fields come from the provider's official webhook/REST references:
// https://shopify.dev/docs/api/admin-rest/latest/resources/webhook
// https://shopify.dev/docs/api/admin-graphql/latest/objects/DiscountAllocation
const shopifyPayload = () => ({ id: 101, name: '#101', currency: 'INR', created_at: '2026-10-15T10:00:00+05:30',
  total_price: '80.00', taxes_included: false, fulfillment_status: 'fulfilled',
  fulfillments: [{ created_at: '2026-10-16T10:00:00+05:30' }],
  line_items: [{ id: 1, sku: 'A', quantity: 1, price: '100.00', total_discount: '0.00', discount_allocations: [{ amount: '20.00' }] }] });

test('Shopify allocated 20 discount reduces a 100 item to the evidenced 80 total', () => {
  const order = shopify.mapShopifyOrderToDomain(shopify.ShopifyOrderWebhookSchema.parse(shopifyPayload()));
  assert.equal(order.items[0].discount, 20);
  assert.equal(order.sourceTotal, 80);
  assert.equal(order.revenueRecognisedDate, '2026-10-16');
  assert.equal(getOrderFinancialFacts(order, [], [], []).netSales, 80);
  assert.throws(() => shopify.mapShopifyOrderToDomain(shopify.ShopifyOrderWebhookSchema.parse({ ...shopifyPayload(), total_price: '100' })), /reconcile/);
});

// https://woocommerce.github.io/woocommerce-rest-api-docs/#orders
const wooPayload = () => ({ id: 201, number: '201', currency: 'INR', date_created: '2026-10-15T10:00:00',
  date_completed: '2026-10-16T10:00:00', status: 'completed', total: '120.00',
  line_items: [{ id: 1, product_id: 1, sku: 'A', quantity: 1, subtotal: '100.00', total: '100.00', total_tax: '0.00' }],
  fee_lines: [{ total: '20.00', total_tax: '0.00' }] });

test('WooCommerce customer fee line 20 preserves a 100 sale plus 20 revenue as 120', () => {
  const order = woo.mapWooCommerceOrderToDomain(woo.WooCommerceOrderWebhookSchema.parse(wooPayload()));
  assert.equal(order.customerCharges, 20);
  assert.equal(order.sourceTotal, 120);
  const facts = getOrderFinancialFacts(order, [], [], []);
  assert.equal(facts.netSales, 100);
  assert.equal(facts.shippingRevenue, 20);
  assert.equal(facts.netSales + facts.shippingRevenue, 120);
  assert.throws(() => woo.mapWooCommerceOrderToDomain(woo.WooCommerceOrderWebhookSchema.parse({ ...wooPayload(), total: '100' })), /reconcile/);
});

test('official webshop schemas reject omitted currency and source creation dates', () => {
  for (const [schema, fixture, dateField] of [[shopify.ShopifyOrderWebhookSchema, shopifyPayload, 'created_at'], [woo.WooCommerceOrderWebhookSchema, wooPayload, 'date_created']]) {
    for (const field of ['currency', dateField]) {
      const source = fixture(); delete source[field];
      assert.equal(schema.safeParse(source).success, false, field);
    }
  }
});

// Amazon's signed ShipmentEvent model also represents RefundEventList:
// https://developer-docs.amazon/sp-api/reference/finances-v0
// https://developer-docs.amazon/sp-api/lang-fr_FR/reference/listfinancialevents
const refund = () => ({ AmazonOrderId: 'AMZ-1', PostedDate: '2026-10-17T08:00:00Z', ShipmentItemAdjustmentList: [{
  OrderAdjustmentItemId: 'REF-1', SellerSKU: 'A',
  ItemChargeAdjustmentList: [{ ChargeType: 'Principal', ChargeAmount: { CurrencyCode: 'INR', CurrencyAmount: -100 } }],
  ItemFeeAdjustmentList: [{ FeeType: 'Commission', FeeAmount: { CurrencyCode: 'INR', CurrencyAmount: 10 } }],
}] });

test('Amazon negative refund and positive fee reversal survive as signed financial evidence without bank cash', () => {
  const projection = amazon.projectAmazonEvent('RefundEventList', refund());
  const settlement = projection.settlement;
  assert.ok(settlement, projection.issue);
  assert.equal(settlement.grossAmount, -100);
  assert.equal(settlement.deductions[0].amount, -10);
  assert.equal(settlement.netSettlement, -90);
  assert.equal(settlement.evidenceType, 'FINANCIAL_EVENT');
  assert.equal(settlement.reconciliationStatus, 'PENDING_RECON');
  assert.match(projection.issue, /commercial refund and physical-return/i);
  const order = { ...mapGenericSourceOrder(generic(), 'Amazon India'), id: 'AMZ-1', channelOrderId: 'AMZ-1' };
  const facts = getOrderFinancialFacts(order, [], [settlement], []);
  assert.equal(facts.cash, 0);
  assert.equal(facts.isSettled, false);
  assert.equal(facts.fees, -10);
  assert.equal(facts.refundedSales, 0, 'Financial evidence alone cannot fabricate a commercial item return');
  const entries = generateGeneralLedger([order], [], [settlement], [], []);
  assert.ok(entries.length > 0);
  assert.equal(entries.flatMap(entry => entry.lines).filter(line => line.accountCode === '6010').reduce((sum, line) => sum + line.credit - line.debit, 0), 10);
  assert.ok(entries.every(entry => entry.lines.every(line => line.accountCode !== '1010')), 'No bank posting follows a finance event');
});

test('Amazon unsupported account-level events retain the raw source plus a reconciliation issue', async () => {
  const writes = [];
  const client = { query: async (sql, params) => { writes.push({ sql, params }); return { rows: [] }; } };
  const event = { AdjustmentType: 'ReserveAdjustment', PostedDate: '2026-10-17T08:00:00Z',
    AdjustmentAmount: { CurrencyCode: 'INR', CurrencyAmount: -25 } };
  const result = await amazon.retainAmazonEvents(client, 'tenant-A', { AdjustmentEventList: [event] });
  assert.equal(result.count, 1);
  assert.equal(result.settlements.length, 0);
  assert.match(result.issues.join('; '), /account-level reconciliation/);
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /INSERT INTO provider_financial_events/);
  assert.equal(writes[0].params[0], 'tenant-A');
  assert.equal(writes[0].params[1], 'AdjustmentEventList');
  assert.deepEqual(JSON.parse(writes[0].params[3]), event);
  assert.match(writes[0].params[4], /account-level reconciliation/);
});

test('Amazon unsupported currency and fractional-paise event amounts stay unresolved with their source retained', async () => {
  for (const amount of [{ CurrencyCode: 'USD', CurrencyAmount: -100 }, { CurrencyCode: 'INR', CurrencyAmount: -100.001 }]) {
    const event = refund(); event.ShipmentItemAdjustmentList[0].ItemChargeAdjustmentList[0].ChargeAmount = amount;
    const writes = [];
    const result = await amazon.retainAmazonEvents({ query: async (sql, params) => { writes.push({ sql, params }); return { rows: [] }; } }, 'tenant-A', { RefundEventList: [event] });
    assert.equal(result.settlements.length, 0);
    assert.ok(result.issues.length);
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].params[3]), event);
  }
});
