import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const period = load('src/domain/financial-period.ts');
const engine = load('src/domain/profitability-engine.ts');
const facts = load('src/domain/order-financials.ts');
const claimsEngine = load('src/domain/claim-attribution.ts');
const radar = load('src/domain/anomaly-radar.ts');
const ai = load('src/domain/ai-context.ts');
const analyst = load('src/domain/deterministic-analyst.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const item = (changes = {}) => ({ id: 'line', sku: 'SKU', productName: 'Product', quantity: 2, sellingPrice: 118,
  discount: 0, taxAmount: 36, snapshotUnitCost: 40, costEvidence: 'RECORDED', returnedQuantity: 0, ...changes });
const order = (changes = {}) => ({ id: 'o', channelOrderId: 'external', marketplace: 'WooCommerce', orderDate: '2026-09-28',
  revenueRecognisedDate: '2026-09-30', status: 'PARTIALLY_RETURNED', pricesIncludeTax: true, shippingFeeCharged: 23.6,
  shippingTaxAmount: 3.6, marketplaceChargesEstimate: 0, feeEstimateStatus: 'CONFIGURED', items: [item()], ...changes });
const returned = (changes = {}) => ({ id: 'r', orderId: 'o', channelOrderId: 'external', marketplace: 'WooCommerce',
  returnDate: '2026-10-05', receivedDate: '2026-10-10', returnType: 'CUSTOMER_RETURN', returnReason: '',
  sku: 'SKU', quantity: 1, condition: 'SELLABLE', restockStatus: 'RESTOCKED', returnShippingCost: 0,
  customerReturnFee: 10, otherReturnCosts: 0, inventoryRecoveryValue: 0, lossAmount: 0, ...changes });
const settlement = (changes = {}) => ({ id: 'bank', orderId: 'o', marketplace: 'WooCommerce', settlementDate: '2026-10-20',
  settlementBatchId: 'batch', grossAmount: 141.6, deductions: [], tcsTdsTax: 0, netSettlement: 131.6,
  reconciliationStatus: 'RECONCILED', evidenceType: 'BANK_RECEIPT', feeCoverage: 'COMPLETE', ...changes });
const claim = (changes = {}) => ({ id: 'claim', orderId: 'o', marketplace: 'WooCommerce', returnId: 'r',
  claimDate: '2026-10-06', recoveryDate: '2026-11-01', amountClaimed: 15, amountRecovered: 15,
  status: 'RECOVERED', claimType: 'DAMAGED_INVOICE', ...changes });
const data = () => ({ orders: [order()], returns: [returned()], settlements: [settlement()], claims: [claim()],
  expenses: [{ id: 'expense', date: '2026-10-07', amount: 5, category: 'Other', marketplace: 'WooCommerce' }] });
const range = month => ({ startDate: '2026-' + month + '-01', endDate: '2026-' + month + '-' + (month === '09' || month === '11' ? '30' : '31') });

test('period flows retain older order context and recognize receipt, restock and recovery dates independently', () => {
  const source = data(), sep = period.calculatePeriodProfitability(source, range('09')),
    oct = period.calculatePeriodProfitability(source, range('10')), nov = period.calculatePeriodProfitability(source, range('11'));
  assert.equal(sep.netSales, 220); assert.equal(sep.cogs, 80); assert.equal(sep.contributionProfit, 140);
  assert.equal(oct.netSales, -100); assert.equal(oct.cogs, -40); assert.equal(oct.directReturnCosts, 10);
  assert.equal(oct.actualSettlementsReceived, 131.6); assert.equal(oct.netPlatformPayout, 131.6);
  assert.equal(oct.contributionProfit, -70); assert.equal(oct.netOperatingProfit, -75);
  assert.equal(oct.outstandingSettlementEstimated, 0);
  assert.equal(nov.claimRecoveries, 15); assert.equal(nov.netOperatingProfit, 15);
  assert.equal(nov.outstandingSettlementEstimated, 15);
  assert.equal(oct.totalOrders, 0); assert.equal(oct.totalUnitsSold, 0); assert.equal(oct.returnRate, 0);
  const beforeRestock = period.calculatePeriodProfitability(source, { startDate: '2026-10-01', endDate: '2026-10-09' });
  assert.equal(beforeRestock.cogs, 0); assert.equal(beforeRestock.netSales, -100);
});

test('adjacent periods and event months conserve every monetary P&L flow and gross-to-net bridge', () => {
  const source = data(), months = ['09', '10', '11'].map(month => period.calculatePeriodProfitability(source, range(month)));
  const combined = period.calculatePeriodProfitability(source, { startDate: '2026-09-01', endDate: '2026-11-30' });
  for (const key of ['grossSales', 'discounts', 'refundedSales', 'outputTaxExcluded', 'shippingRevenue', 'netSales', 'cogs', 'directReturnCosts', 'claimRecoveries', 'contributionProfit', 'operatingExpenses', 'netOperatingProfit', 'actualSettlementsReceived'])
    assert.equal(facts.sumMoney(months.map(month => month[key] || 0)), combined[key], key);
  for (const total of [...months, combined]) assert.equal(facts.sumMoney([total.grossSales, -total.discounts, -total.refundedSales, -total.outputTaxExcluded, total.shippingRevenue]), total.netSales);
  const trend = period.monthlyFinancialTrend(source);
  assert.deepEqual(plain(trend.map(row => row.sortKey)), ['2026-09', '2026-10', '2026-11']);
  assert.equal(facts.sumMoney(trend.map(row => row.profit)), combined.netOperatingProfit);
  assert.equal(facts.sumMoney(trend.map(row => row.revenue)), combined.netSales);
});

test('bank cash includes unmatched and cancelled-order receipts but excludes marketplace finance events', () => {
  const source = { ...data(), orders: [], returns: [], claims: [], expenses: [],
    settlements: [settlement(), settlement({ id: 'finance', evidenceType: 'FINANCIAL_EVENT', netSettlement: 500 })] };
  const total = period.calculatePeriodProfitability(source, range('10'));
  assert.equal(total.actualSettlementsReceived, 131.6); assert.equal(total.netPlatformPayout, 131.6);
  assert.equal(total.netSales, 0);
  const channels = period.periodMarketplace(source, range('10'));
  assert.equal(channels[0].actualSettlementsReceived, total.actualSettlementsReceived);
});

test('period return rates use matching bounded shipment cohorts even when old returns exceed current shipments', () => {
  const source = data(); source.orders.push(order({ id: 'new', channelOrderId: 'new-ext', orderDate: '2026-10-01', revenueRecognisedDate: '2026-10-02',
    shippingFeeCharged: 0, items: [item({ quantity: 1, taxAmount: 18 })] }));
  source.returns.push(returned({ id: 'new-ret', orderId: 'new', channelOrderId: 'new-ext', quantity: 99 }));
  const total = period.calculatePeriodProfitability(source, range('10'));
  assert.equal(total.customerReturnCount, 2); assert.equal(total.returnRateDenominator, 1);
  assert.equal(total.returnRateUnits, 1); assert.equal(total.returnRate, 1);
  assert.equal(total.customerReturnRate, 1); assert.equal(total.rtoRate, 0);
  assert.ok(period.periodSku(source, range('10')).every(row => row.returnRate >= 0 && row.returnRate <= 1));
});

test('SKU return costs and claim recoveries stay on the affected SKU as later returns arrive', () => {
  const o = order({ shippingFeeCharged: 0, items: [
    item({ id: 'a', sku: 'A', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
    item({ id: 'b', sku: 'B', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
  ] });
  const r1 = returned({ id: 'ra', sku: 'A', orderItemId: 'a', condition: 'DAMAGED', customerReturnFee: 7, inventoryRecoveryValue: 5,
    returnDate: '2026-10-01', receivedDate: '2026-10-01' });
  const r2 = returned({ id: 'rb', sku: 'B', orderItemId: 'b', returnDate: '2026-11-01', receivedDate: '2026-11-01', customerReturnFee: 13 });
  const c = claim({ returnId: 'ra', claimDate: '2026-10-02', recoveryDate: '2026-10-03', amountClaimed: 10, amountRecovered: 10 });
  const source = { orders: [o], returns: [r2, r1], settlements: [], claims: [c], expenses: [] };
  const oct = period.periodSku(source, range('10')), nov = period.periodSku(source, range('11'));
  assert.equal(oct.find(row => row.sku === 'A').returnLosses, 7);
  assert.equal(oct.find(row => row.sku === 'A').claimRecoveries, 10);
  assert.equal(oct.find(row => row.sku === 'A').salvageRecovery, 5);
  assert.equal(oct.find(row => row.sku === 'B').returnLosses, 0);
  assert.equal(nov.find(row => row.sku === 'A').returnLosses, 0);
  assert.equal(nov.find(row => row.sku === 'A').claimRecoveries, 0);
  assert.equal(nov.find(row => row.sku === 'B').returnLosses, 13);
  for (const month of [range('10'), range('11')]) {
    const business = period.calculatePeriodProfitability(source, month), skus = period.periodSku(source, month);
    assert.equal(facts.sumMoney(skus.map(row => row.revenue)), business.netSales);
    assert.equal(facts.sumMoney(skus.map(row => row.profit)), business.contributionProfit);
  }
});

test('explicit return claim links and multiple claims allocate once; closing never erases dated recovery', () => {
  const r1 = returned(), r2 = returned({ id: 'second', returnDate: '2026-10-06' });
  const c = claim({ recoveryDate: '2026-10-10' }), c2 = claim({ id: 'other', amountClaimed: 5, amountRecovered: 5, recoveryDate: '2026-10-10', status: 'CLOSED' });
  const allocations = claimsEngine.returnClaimAllocations(order(), [r1, r2, r1], [c, c2, c]);
  assert.equal(allocations.has('second'), false);
  assert.equal(facts.sumMoney(allocations.get('r').map(row => row.recovered)), 20);
  const first = engine.computeReturnFinancials(r1, [order()], [], [c, c2], [], [r1, r2]);
  const second = engine.computeReturnFinancials(r2, [order()], [], [c, c2], [], [r1, r2]);
  assert.equal(first.reimbursementAmount, 20); assert.equal(second.reimbursementAmount, 0);
});

test('separate one-paise fee events retain their original SKU allocation across periods', () => {
  const o = order({ pricesIncludeTax: false, shippingFeeCharged: 0, items: [
    item({ id: 'a', sku: 'A', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
    item({ id: 'b', sku: 'B', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
  ] });
  const source = { orders: [o], returns: [], claims: [], expenses: [], settlements: [
    settlement({ id: 'fee1', evidenceType: 'FINANCIAL_EVENT', settlementDate: '2026-10-01', deductions: [{ category: 'COMMISSION', name: 'First', amount: 0.01 }] }),
    settlement({ id: 'fee2', evidenceType: 'FINANCIAL_EVENT', settlementDate: '2026-11-01', deductions: [{ category: 'COMMISSION', name: 'Second', amount: 0.01 }] }),
  ] };
  for (const month of ['10', '11']) {
    const rows = period.periodSku(source, range(month));
    assert.equal(rows.find(row => row.sku === 'A').marketplaceCharges, 0.01);
    assert.equal(rows.find(row => row.sku === 'B').marketplaceCharges, 0);
    assert.equal(facts.sumMoney(rows.map(row => row.marketplaceCharges)), period.calculatePeriodProfitability(source, range(month)).marketplaceCharges);
  }
});

test('linked bank deductions clear source financial-event accruals once in every period and SKU', () => {
  const o = order({ pricesIncludeTax: false, gstRegistrationType: 'REGULAR', shippingFeeCharged: 0, items: [
    item({ id: 'a', sku: 'A', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
    item({ id: 'b', sku: 'B', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
  ] });
  const deductions = [{ category: 'COMMISSION', name: 'Commission', amount: 11.81,
    gstAmount: 1.8, eligibleGstAmount: 1.8, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'fee-invoice' }];
  const finance = settlement({ id: 'accrual', settlementDate: '2026-10-01', evidenceType: 'FINANCIAL_EVENT',
    deductions, tcsTax: 1, tdsTax: 0.2, netSettlement: 0 });
  const bank = settlement({ id: 'receipt', settlementDate: '2026-11-01', financialEventIds: ['accrual'],
    deductions, tcsTax: 1, tdsTax: 0.2, grossAmount: 200, netSettlement: 186.99 });
  const source = { orders: [o], returns: [], claims: [], expenses: [], settlements: [bank, finance] };
  const oct = period.calculatePeriodProfitability(source, range('10'));
  const nov = period.calculatePeriodProfitability(source, range('11'));
  assert.equal(oct.marketplaceCharges, 10.01); assert.equal(oct.actualSettlementsReceived, 0);
  assert.equal(nov.marketplaceCharges, 0); assert.equal(nov.actualSettlementsReceived, 186.99);
  const all = period.calculatePeriodProfitability(source);
  assert.equal(all.marketplaceCharges, 10.01); assert.equal(all.actualSettlementsReceived, 186.99);
  assert.equal(all.outstandingSettlementEstimated, 0);
  for (const month of ['10', '11']) {
    const rows = period.periodSku(source, range(month));
    assert.equal(facts.sumMoney(rows.map(row => row.marketplaceCharges)), period.calculatePeriodProfitability(source, range(month)).marketplaceCharges);
    assert.equal(rows.find(row => row.sku === 'A').marketplaceCharges, month === '10' ? 5.01 : 0);
    assert.equal(rows.find(row => row.sku === 'B').marketplaceCharges, month === '10' ? 5 : 0);
  }
});

test('partial claim recovery events retain their dates and original return/SKU rounding allocations', () => {
  const o = order({ revenueRecognisedDate: '2026-09-01', orderDate: '2026-09-01', shippingFeeCharged: 0, items: [
    item({ id: 'a', sku: 'A', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
    item({ id: 'b', sku: 'B', quantity: 1, sellingPrice: 100, taxAmount: 0 }),
  ] });
  const rs = [returned({ id: 'ra', sku: 'A', returnDate: '2026-09-02', receivedDate: '2026-09-02', customerReturnFee: 0 }),
    returned({ id: 'rb', sku: 'B', returnDate: '2026-09-02', receivedDate: '2026-09-02', customerReturnFee: 0 })];
  const c = claim({ returnId: undefined, claimDate: '2026-09-03', recoveryDate: '2026-11-01', amountClaimed: 0.03, amountRecovered: 0.02, status: 'PARTIALLY_RECOVERED',
    recoveries: [{ id: 'first', date: '2026-10-01', amount: 0.01 }, { id: 'second', date: '2026-11-01', amount: 0.01 }] });
  const source = { orders: [o], returns: rs, settlements: [], claims: [c], expenses: [] };
  for (const month of ['10', '11']) {
    const total = period.calculatePeriodProfitability(source, range(month)), rows = period.periodSku(source, range(month));
    assert.equal(total.claimRecoveries, 0.01);
    assert.equal(rows.find(row => row.sku === 'A').claimRecoveries, 0.01);
    assert.equal(rows.find(row => row.sku === 'B').claimRecoveries, 0);
  }
  assert.equal(period.calculatePeriodProfitability(source, range('10')).pendingClaimsAmount, 0.02);
  assert.equal(period.calculatePeriodProfitability(source, range('11')).pendingClaimsAmount, 0.01);
  assert.deepEqual(plain(period.monthlyFinancialTrend(source).map(row => row.sortKey)), ['2026-09', '2026-10', '2026-11']);
});

test('unknown partial-payment receivables remain in aging and radar; known amounts use discounts and partial receipts', () => {
  const o = order({ orderDate: '2026-09-01', revenueRecognisedDate: '2026-09-02', shippingFeeCharged: 0,
    pricesIncludeTax: false, items: [item({ quantity: 1, sellingPrice: 20000, discount: 10000, taxAmount: 0 })] });
  const paid = settlement({ settlementDate: '2026-10-10', netSettlement: 10, deductions: [{ category: 'COMMISSION', name: 'Partial fee', amount: 100 }], feeCoverage: 'PARTIAL' });
  const aging = engine.calculateSettlementAging([o], [paid], '2026-10-19');
  assert.equal(aging.overdue.orderCount, 1); assert.equal(aging.overdue.unknownAmountOrders, 1);
  const unknown = radar.computeAnomalyRadar({ orders: [o], returns: [], settlements: [paid], claims: [], products: [], asOf: '2026-10-19' });
  assert.equal(unknown.unknownExposureOrders, 1); assert.match(unknown.items.find(row => row.category === 'SETTLEMENT_LAG').metricHighlight, /unknown/);
  const known = radar.computeAnomalyRadar({ orders: [o], returns: [], settlements: [{ ...paid, feeCoverage: 'COMPLETE' }], claims: [], products: [], asOf: '2026-10-19' });
  assert.equal(known.items.find(row => row.category === 'SETTLEMENT_LAG').impactAmount, 9890);
});

test('grounded assistant distinguishes contribution and OPEX and does not subtract return costs twice', () => {
  const source = data(), profitability = period.calculatePeriodProfitability(source, range('10'));
  const context = ai.serializeFinancialContext({ selectedMarketplace: 'ALL', datePreset: 'CUSTOM', profitability,
    profitabilityTrends: { netSalesChange: 0, grossProfitChange: 0, contributionProfitChange: 0, netOperatingProfitChange: 0, ordersChange: 0 },
    skuBreakdown: period.periodSku(source, range('10')), marketplaceBreakdown: period.periodMarketplace(source, range('10')),
    settlementAging: engine.calculateSettlementAging(source.orders, source.settlements, '2026-10-31', source.returns, source.claims), ...source });
  assert.equal(context.waterfall.returnAndRtoLoss, 10);
  assert.equal(context.heroSkus[0].contributionProfit, -70);
  assert.equal('netProfit' in context.heroSkus[0], false);
  const response = analyst.analyzeFinancialQuery('returns', { ...context, evidence: { isComplete: false, issues: ['test evidence missing'] } });
  assert.match(response.answer, /Provisional/); assert.match(response.answer, /already included in COGS/);
  assert.doesNotMatch(response.answer, /30.day|all physical damaged/i);
});

test('return radar uses bounded facts and recorded reverse freight once instead of stale raw loss fields', () => {
  const o = order({ items: [item({ quantity: 4 })] });
  const r = returned({ customerReturnFee: 0, returnShippingCost: 3000, lossAmount: 99999 });
  const reverse = settlement({ evidenceType: 'FINANCIAL_EVENT', settlementDate: '2026-10-15',
    deductions: [{ category: 'RETURN_SHIPPING', name: 'Actual reverse freight', amount: 3000 }] });
  const result = radar.computeAnomalyRadar({ orders: [o], returns: [r, r], settlements: [reverse, reverse], claims: [], products: [], asOf: '2026-10-31' });
  assert.equal(result.items.find(row => row.category === 'RTO_BLEED').impactAmount, 3000);
});

test('retained unmapped-source and pending-migration issues survive all-time and dated projections', () => {
  const source = { ...data(), financialIssues: ['Unmapped source finance event retained', 'Local snapshot awaits reconciliation'] };
  for (const selected of [undefined, range('10')]) {
    const total = period.calculatePeriodProfitability(source, selected);
    assert.equal(total.isComplete, false);
    for (const issue of source.financialIssues) assert.ok(total.issues.includes(issue));
  }
});

function reportHooks() {
  const slots = []; let cursor = 0;
  const react = { useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => slots[index] = typeof value === 'function' ? value(slots[index]) : value]; },
    useMemo: fn => fn(), useEffect() {} };
  return { react, render: fn => { cursor = 0; return fn(); } };
}
test('actual Reports view uses full financialContext and reportRange in both exports and shows the complete bridge', () => {
  const source = { ...data(), financialIssues: ['Unmapped source finance retained'] }, harness = reportHooks(), downloads = [];
  const view = load('src/components/modules/reports-view.tsx', { react: harness.react,
    recharts: Object.fromEntries(['ResponsiveContainer','BarChart','Bar','XAxis','YAxis','Tooltip','Legend','CartesianGrid','AreaChart','Area','Cell'].map(name => [name, name])),
    '@/lib/csv': { downloadCsv: rows => downloads.push(plain(rows)) },
    '@/domain/store': { usePlatform: () => ({ selectedMarketplace: 'ALL',
      orders: [order({ items: [item({ sellingPrice: 999999 })] })],
      reportDataset: { orders: [], returns: source.returns, settlements: source.settlements, claims: [], expenses: source.expenses,
        financialContext: source, reportRange: range('10') } }) },
  });
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
  const render = () => harness.render(() => view.ReportsView());
  const buttons = () => nodes(render()).filter(node => node.type === 'button');
  const exportCSV = () => buttons().find(node => nodes(node.props.children).some(child => child.props?.children === 'Export CSV')).props.onClick();
  exportCSV();
  assert.equal(Number(downloads[0][1][4]), -100);
  assert.equal(Number(downloads[0][1][5]), -70);
  assert.equal(downloads[0][0][5], 'Contribution Profit');
  buttons().find(node => node.props.children === 'P&L Ledger').props.onClick();
  exportCSV();
  const rows = new Map(downloads[1].slice(1).map(row => [row[0], Number(row[2])]));
  assert.equal(rows.get('Gross Sales'), 0);
  assert.equal(rows.get('Sales Refunds'), -118);
  assert.equal(rows.get('Included Output GST'), 18);
  assert.equal(rows.get('Net Sales'), -100);
  assert.equal(rows.get('Net Operating Profit'), -75);
  assert.equal(facts.sumMoney(['Gross Sales','Discounts','Sales Refunds','Included Output GST','Shipping & Customer Charges'].map(label => rows.get(label))), rows.get('Net Sales'));
  assert.equal(facts.sumMoney(['Gross Profit','Marketplace Fees','Direct Return Costs','Dispute Claims','Recovered Inventory Cost'].map(label => rows.get(label))), rows.get('Contribution Profit'));
  const serialized = JSON.stringify(render());
  assert.match(serialized, /Unmapped source finance retained/);
  assert.match(serialized, /Recovered Inventory Cost/);
  assert.doesNotMatch(serialized, /Net Profit/);
});
