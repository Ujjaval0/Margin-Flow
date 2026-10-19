import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const fees = load('src/domain/marketplace-fees.ts');
const orderSchema = load('src/domain/snapshot-validation.ts').orderSchema;

const component = (changes = {}) => ({ id: 'commission-v1', name: 'Commission', componentType: 'COMMISSION',
  method: 'PERCENT', rateBps: 1250, calculationBase: 'ITEM_AFTER_DISCOUNT', taxTreatment: 'NO_TAX', sequence: 1, ...changes });
const rule = (changes = {}) => ({ id: 'rule-1', version: 1, marketplace: 'Amazon India', effectiveFrom: '2026-01-01',
  status: 'ACTIVE', components: [component()], ...changes });
const line = (changes = {}) => ({ pricesIncludeTax: true, sku: 'SKU-A', productCategory: 'Electronics', fulfilmentMode: 'FBA', quantity: 2,
  unitPricePaise: 10000, discountPaise: 1000, taxPaise: 0, ...changes });

test('decimal INR conversion preserves paise and rejects excess precision', () => {
  assert.equal(fees.decimalRupeesToPaise('123.45'), 12345);
  assert.equal(fees.decimalRupeesToPaise('-0.05'), -5);
  assert.equal(fees.paiseToDecimalString(12345), '123.45');
  assert.throws(() => fees.decimalRupeesToPaise('1.001'));
});

test('shared order-line builder preserves all lines, discounts, taxes, categories, and fulfilment for preview and persistence', () => {
  const inputs = fees.buildFeeOrderLineInputs([
    { sku: 'SKU-A', quantity: 2, sellingPrice: 100, discount: 10, taxAmount: 18 },
    { sku: 'SKU-B', quantity: 1, sellingPrice: 20, discount: 1, taxAmount: 3 },
  ], new Map([['SKU-A', 'Electronics'], ['SKU-B', 'Home']]), 'FBA', true);
  assert.equal(JSON.stringify(inputs), JSON.stringify([
    { sku: 'SKU-A', productCategory: 'Electronics', fulfilmentMode: 'FBA', quantity: 2, pricesIncludeTax: true, unitPricePaise: 10000, discountPaise: 1000, taxPaise: 1800 },
    { sku: 'SKU-B', productCategory: 'Home', fulfilmentMode: 'FBA', quantity: 1, pricesIncludeTax: true, unitPricePaise: 2000, discountPaise: 100, taxPaise: 300 },
  ]));
  const result = fees.calculateMarketplaceFeeEstimate([rule({ components: [component({ calculationBase: 'ITEM_EXCLUDING_TAX' })] })], inputs, 'Amazon India', '2026-10-18');
  assert.equal(result.totalPaise, 2350);
});

test('missing rules remain unknown and never resolve to zero', () => {
  const result = fees.calculateMarketplaceFeeEstimate([], [line()], 'Amazon India', '2026-10-18');
  assert.equal(result.status, 'NOT_CONFIGURED');
  assert.equal(result.totalPaise, null);
  assert.equal(result.components.length, 0);
});

test('quick commission applies 7% half-up to discounted value excluding item tax without permanent rules', () => {
  const result = fees.calculateMarketplaceFeeEstimate([], [line({ quantity: 2, unitPricePaise: 10000, discountPaise: 1000, taxPaise: 2000 })],
    'Amazon India', '2026-10-18', 700);
  assert.equal(result.status, 'CONFIGURED');
  assert.equal(result.totalPaise, 1404);
  assert.equal(result.calculationVersion, 2);
  assert.equal(result.components[0].basePaise, 17000);
  assert.equal(result.components[0].taxTreatment, 'TAXABLE');
  assert.equal(result.components[0].rateBps, 700);
  assert.equal(fees.calculateMarketplaceFeeEstimate([], [line()], 'Amazon India', '2026-10-18').status, 'NOT_CONFIGURED');
});

test('quick commission replaces all canonical commission components and retains other configured fees', () => {
  const configured = rule({ components: [
    component({ id: 'platform-commission', rateBps: 1250 }),
    component({ id: 'fixed', name: 'Closing fee', componentType: 'FIXED_FEE', method: 'FIXED_ORDER', amountPaise: 100, rateBps: undefined, calculationBase: undefined, sequence: 2 }),
    component({ id: 'logistics', name: 'Logistics', componentType: 'LOGISTICS', rateBps: 500, sequence: 3 }),
  ] });
  const result = fees.calculateMarketplaceFeeEstimate([configured], [line({ quantity: 1, unitPricePaise: 10000, discountPaise: 1000, taxPaise: 1000 })],
    'Amazon India', '2026-10-18', 1000);
  assert.equal(result.totalPaise, 1494);
  assert.deepEqual(JSON.parse(JSON.stringify(result.components.map(item => [item.componentType, item.amountPaise]))), [
    ['FIXED_FEE', 100], ['LOGISTICS', 450], ['COMMISSION', 800],
  ]);
  assert.equal(result.components.filter(item => item.componentType === 'COMMISSION').length, 1);
});

test('quick rate boundaries use basis points and reject invalid or over-100-percent values', () => {
  const inputs = [line({ quantity: 1, unitPricePaise: 1, discountPaise: 0, taxPaise: 0 })];
  assert.equal(fees.calculateMarketplaceFeeEstimate([], inputs, 'Amazon India', '2026-10-18', 0).totalPaise, 0);
  assert.equal(fees.calculateMarketplaceFeeEstimate([], inputs, 'Amazon India', '2026-10-18', 10000).totalPaise, 1);
  for (const rate of [-1, 10001, 1.5]) assert.throws(() => fees.calculateMarketplaceFeeEstimate([], inputs, 'Amazon India', '2026-10-18', rate));
});

test('order snapshots accept nullable quick rates only as integer basis points from 0 to 10000', () => {
  const order = { id: 'order-1', channelOrderId: 'channel-1', marketplace: 'Amazon India', orderDate: '2026-10-18', status: 'DELIVERED',
    customerName: 'Customer', customerCity: 'City', customerState: 'State', items: [{ id: 'line-1', sku: 'SKU-A', productName: 'Item',
      quantity: 1, sellingPrice: 100, discount: 0, taxAmount: 0, snapshotUnitCost: 50, returnedQuantity: 0 }],
    shippingFeeCharged: 0, marketplaceChargesEstimate: 999 };
  for (const quickFeeRateBps of [null, 0, 700, 10000]) assert.equal(orderSchema.safeParse({ ...order, quickFeeRateBps }).success, true);
  for (const quickFeeRateBps of [-1, 10001, 7.5]) assert.equal(orderSchema.safeParse({ ...order, quickFeeRateBps }).success, false);
});

test('percentage bases distinguish before-discount, after-discount, and tax-excluded amounts', () => {
  const before = fees.calculateMarketplaceFeeEstimate([rule({ components: [component({ calculationBase: 'ITEM_BEFORE_DISCOUNT' })] })], [line()], 'Amazon India', '2026-10-18');
  const after = fees.calculateMarketplaceFeeEstimate([rule()], [line()], 'Amazon India', '2026-10-18');
  const excludingTax = fees.calculateMarketplaceFeeEstimate([rule({ components: [component({ calculationBase: 'ITEM_EXCLUDING_TAX' })] })], [line({ taxPaise: 2000 })], 'Amazon India', '2026-10-18');
  assert.equal(before.totalPaise, 2500);
  assert.equal(after.totalPaise, 2375);
  assert.equal(excludingTax.totalPaise, 2125);
});

test('fixed-order applies once and per-unit applies quantity times', () => {
  const result = fees.calculateMarketplaceFeeEstimate([rule({ components: [
    component({ id: 'fixed', method: 'FIXED_ORDER', amountPaise: 25, rateBps: undefined, calculationBase: undefined }),
    component({ id: 'unit', method: 'PER_UNIT', amountPaise: 7, rateBps: undefined, calculationBase: undefined, sequence: 2 }),
  ] })], [line()], 'Amazon India', '2026-10-18');
  assert.equal(result.totalPaise, 39);
  assert.equal(JSON.stringify(result.components.map(value => value.amountPaise)), JSON.stringify([25, 14]));
  const repeatedRule = rule({ components: [component({ id: 'fixed', method: 'FIXED_ORDER', amountPaise: 25, rateBps: undefined, calculationBase: undefined })] });
  const twoLines = fees.calculateMarketplaceFeeEstimate([repeatedRule], [line(), line({ sku: 'SKU-B' })], 'Amazon India', '2026-10-18');
  assert.equal(twoLines.totalPaise, 25);
  assert.equal(twoLines.components[0].quantity, 1);
  assert.equal(twoLines.components[0].basePaise, 0);
});

test('matching uses specificity, half-open price bands, and effective dates', () => {
  const broad = rule({ id: 'broad', components: [component({ rateBps: 500 })] });
  const scoped = rule({ id: 'scoped', sku: 'SKU-A', minUnitPricePaise: 10000, maxUnitPricePaise: 20000, components: [component({ rateBps: 1000 })] });
  assert.equal(fees.calculateMarketplaceFeeEstimate([broad, scoped], [line()], 'Amazon India', '2026-10-18').totalPaise, 1900);
  assert.equal(fees.calculateMarketplaceFeeEstimate([scoped], [line({ unitPricePaise: 20000 })], 'Amazon India', '2026-10-18').status, 'NOT_CONFIGURED');
  assert.equal(fees.calculateMarketplaceFeeEstimate([scoped], [line()], 'Amazon India', '2025-12-31').status, 'NOT_CONFIGURED');
});

test('equally specific matching rules fail as ambiguous independent of row order', () => {
  const overlap = rule({ id: 'rule-2', sku: 'SKU-A', components: [component({ rateBps: 900 })] });
  const first = rule({ id: 'rule-1', sku: 'SKU-A' });
  assert.throws(() => fees.calculateMarketplaceFeeEstimate([first, overlap], [line()], 'Amazon India', '2026-10-18'), /equally specific/);
  assert.throws(() => fees.calculateMarketplaceFeeEstimate([overlap, first], [line()], 'Amazon India', '2026-10-18'), /equally specific/);
});

test('component and tax rounding use half-up integer paise; repeated calculations are identical', () => {
  const half = rule({ components: [component({ rateBps: 5000 })] });
  const input = [line({ quantity: 1, unitPricePaise: 1, discountPaise: 0 })];
  assert.equal(fees.calculateMarketplaceFeeEstimate([half], input, 'Amazon India', '2026-10-18').totalPaise, 1);
  const taxable = rule({ components: [component({ rateBps: 10000, taxTreatment: 'TAXABLE', taxRateBps: 5000 })] });
  const first = fees.calculateMarketplaceFeeEstimate([taxable], [line({ quantity: 1, unitPricePaise: 1, discountPaise: 0 })], 'Amazon India', '2026-10-18');
  const again = fees.calculateMarketplaceFeeEstimate([taxable], [line({ quantity: 1, unitPricePaise: 1, discountPaise: 0 })], 'Amazon India', '2026-10-18');
  assert.equal(first.components[0].taxPaise, 1);
  assert.equal(JSON.stringify(first), JSON.stringify(again));
  assert.equal(first.totalPaise, first.components.reduce((sum, item) => sum + item.amountPaise + item.taxPaise, 0));
});

test('zero-quantity and return-reduced lines preserve nonnegative deterministic totals', () => {
  const result = fees.calculateMarketplaceFeeEstimate([rule()], [line({ quantity: 0, discountPaise: 0 })], 'Amazon India', '2026-10-18');
  assert.equal(result.status, 'CONFIGURED');
  assert.equal(result.totalPaise, 0);
  assert.throws(() => fees.calculateMarketplaceFeeEstimate([rule()], [line({ quantity: -1 })], 'Amazon India', '2026-10-18'));
});

test('settlement reconciliation keeps absent actual fees unavailable and reports unmatched totals without relabeling them', () => {
  const estimate = fees.calculateMarketplaceFeeEstimate([rule()], [line()], 'Amazon India', '2026-10-18');
  const absent = fees.reconcileMarketplaceFees({ status: 'NOT_CONFIGURED', totalPaise: null, components: [] }, []);
  assert.equal(absent.status, 'UNAVAILABLE');
  assert.equal(absent.actualTotalPaise, null);
  const unmatched = fees.reconcileMarketplaceFees(estimate, [{ category: 'OTHER', name: 'Unmapped marketplace deduction', amountPaise: 2000 }]);
  assert.equal(unmatched.status, 'UNMATCHED_TOTAL');
  assert.equal(unmatched.variancePaise, 2000 - estimate.totalPaise);
});

test('component reconciliation uses matching names and net-settlement variance preserves credit signs', () => {
  const estimate = fees.calculateMarketplaceFeeEstimate([rule()], [line()], 'Amazon India', '2026-10-18');
  const matched = fees.reconcileMarketplaceFees(estimate, [{ category: 'COMMISSION', name: 'Commission', amountPaise: estimate.totalPaise + 10 }]);
  assert.equal(matched.status, 'MATCHED_COMPONENTS');
  assert.equal(matched.variancePaise, 10);
  assert.equal(fees.reconcileSettlementNet({ grossPaise: 10000, deductionPaise: [2000, -100], taxPaise: 500, netPaise: 7600 }), 0);
});

test('actual fee deductions from multiple settlement batches aggregate once at explicit order scope', () => {
  const actualByOrder = fees.aggregateMarketplaceFeeDeductionsByOrder([
    { orderId: 'order-1', category: 'COMMISSION', name: 'Commission', amountPaise: 1200 },
    { orderId: 'order-1', category: 'LOGISTICS', name: 'Logistics', amountPaise: 350 },
    { orderId: 'order-1', category: 'COMMISSION', name: 'Commission credit', amountPaise: -50 },
    { orderId: 'order-2', category: 'COMMISSION', name: 'Commission', amountPaise: 200 },
  ]);
  assert.equal(actualByOrder['order-1'].length, 3);
  assert.equal(actualByOrder['order-1'].reduce((sum, deduction) => sum + deduction.amountPaise, 0), 1500);
  assert.equal(actualByOrder['order-2'].reduce((sum, deduction) => sum + deduction.amountPaise, 0), 200);
  assert.throws(() => fees.aggregateMarketplaceFeeDeductionsByOrder([{ orderId: 'bad', category: 'OTHER', name: 'Bad', amountPaise: 1.5 }]));
});
