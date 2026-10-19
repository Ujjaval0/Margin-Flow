import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const facts = load('src/domain/order-financials.ts');
const ledger = load('src/domain/ledger-engine.ts');
const engine = load('src/domain/profitability-engine.ts');
const fees = load('src/domain/marketplace-fees.ts');
const accounting = load('src/domain/accounting-policy.ts');
const purchases = load('src/domain/purchase-accounting.ts');
const item = (changes = {}) => ({ id: 'line', sku: 'SKU', productName: 'Item', quantity: 2, sellingPrice: 500,
  discount: 0, taxAmount: 0, snapshotUnitCost: 100, costEvidence: 'RECORDED', returnedQuantity: 0, ...changes });
const order = (changes = {}) => ({ id: 'o', channelOrderId: 'c', marketplace: 'WooCommerce', orderDate: '2026-10-01',
  revenueRecognisedDate: '2026-10-01', status: 'DELIVERED', customerName: '', customerCity: '', customerState: '', shippingFeeCharged: 0,
  marketplaceChargesEstimate: 0, feeEstimateStatus: 'CONFIGURED', items: [item()], ...changes });
const returned = (changes = {}) => ({ id: 'r', orderId: 'o', channelOrderId: 'c', marketplace: 'WooCommerce', returnDate: '2026-10-10',
  returnType: 'CUSTOMER_RETURN', returnReason: '', sku: 'SKU', quantity: 1, condition: 'SELLABLE', restockStatus: 'RESTOCKED', receivedDate: '2026-10-10', returnShippingCost: 0,
  customerReturnFee: 0, otherReturnCosts: 0, inventoryRecoveryValue: 0, lossAmount: 0, ...changes });
const settlement = (changes = {}) => ({ id: 's', orderId: 'o', marketplace: 'WooCommerce', settlementDate: '2026-10-15',
  settlementBatchId: 'batch', grossAmount: 500, deductions: [], tcsTdsTax: 0, netSettlement: 500,
  evidenceType: 'BANK_RECEIPT', feeCoverage: 'COMPLETE', reconciliationStatus: 'RECONCILED', ...changes });
const gstAdjustment = (amount, creditNoteDate = '2026-10-10') => ({ status: 'ELIGIBLE', amount, creditNoteNumber: 'CN-' + creditNoteDate, creditNoteDate, originalSupplyDate: '2026-09-01', declaredDate: '2026-10-20', evidenceReference: 'verified-return-credit-note' });
const balance = (entries, code) => facts.sumMoney(entries.flatMap(entry => entry.lines)
  .filter(line => line.accountCode === code).map(line => facts.sumMoney([line.debit, -line.credit])));

test('A1: decimal halves round away from zero, including exponent notation, without negative zero', () => {
  for (const [input, expected] of [[10.075,10.08],[16.275,16.28],[-2.505,-2.51],[1.005,1.01],[-0.005,-0.01],[1e-7,0],[1.005e3,1005]])
    assert.equal(facts.money(input), expected);
  assert.equal(Object.is(facts.money(-0.001), -0), false);
  assert.throws(() => facts.money(Infinity));
  assert.throws(() => facts.money(Number.MAX_VALUE));
});

test('A2/A3: partial returns reconcile ledger revenue, snapshot COGS and receivables with operational facts', () => {
  const source = order(); const returns = [returned()]; const receipts = [settlement()];
  const result = facts.getOrderFinancialFacts(source, returns, receipts, []);
  const journals = ledger.generateGeneralLedger([source], returns, receipts, [], []);
  assert.equal(-balance(journals, '4010') - balance(journals, '4030'), result.netSales);
  assert.equal(balance(journals, '5010') + balance(journals, '5020'), facts.sumMoney([result.cogs, -result.salvageRecovery]));
  assert.equal(balance(journals, '1030'), -100);
  assert.equal(balance(journals, '1020'), 0);
  assert.ok(journals.every(entry => entry.isBalanced));
});

test('A3: oversized and duplicate returns cannot restore more than dispatched cost', () => {
  const ret = returned({ quantity: 99, inventoryRecoveryValue: 90000, lossAmount: 70000 });
  const journals = ledger.generateGeneralLedger([order()], [ret, ret], [], [], []);
  assert.equal(balance(journals, '1030'), 0);
  assert.equal(balance(journals, '5010'), 0);
});

test('returns on different dates retain their own journal dates and conserve fractional refunds', () => {
  const source = order({ orderDate: '2026-09-01', revenueRecognisedDate: '2026-09-01', items: [item({ quantity: 3, sellingPrice: 33.33, lineSubtotal: 100, taxAmount: 1 })], pricesIncludeTax: true });
  const returns = [returned({ id: 'r1', returnDate: '2026-09-30', gstAdjustment: gstAdjustment(0.33, '2026-09-30') }), returned({ id: 'r2', returnDate: '2026-10-10', gstAdjustment: gstAdjustment(0.34) })];
  const result = facts.getOrderFinancialFacts(source, returns, [], []);
  const journals = ledger.generateGeneralLedger([source], returns, [], [], []);
  assert.equal(journals.find(entry => entry.id === 'JE-RET-r1').timestamp, '2026-09-30T14:00:00.000Z');
  assert.equal(journals.find(entry => entry.id === 'JE-RET-r2').timestamp, '2026-10-10T14:00:00.000Z');
  assert.equal(balance(journals, '4030'), result.refundedRevenue);
  assert.equal(-balance(journals, '2020'), result.retainedTax);
});

test('A4/A5: return fee components reach the ledger, settlement reverse shipping wins exactly once', () => {
  const returns = [returned({ returnShippingCost: 60, customerReturnFee: 10, otherReturnCosts: 5 })];
  const receipts = [settlement({ deductions: [{ category: 'RETURN_SHIPPING', name: 'Reverse shipping', amount: 60 }], netSettlement: 425 })];
  const result = facts.getOrderFinancialFacts(order(), returns, receipts, []);
  assert.equal(result.returnCosts, 15);
  assert.equal(result.fees, 60);
  assert.equal(result.contributionProfit, 325);
  const journals = ledger.generateGeneralLedger([order()], returns, receipts, [], []);
  assert.equal(balance(journals, '6010'), 10);
  assert.equal(balance(journals, '6020'), 65);
  assert.equal(balance(journals, '1020'), 0);
});

test('A6/B14: supplier payments retain dates, references and excess advances without duplicate cash postings', () => {
  const bill = { id: 'bill', supplierId: 'vendor', supplierName: 'Vendor', invoiceDate: '2026-10-01', invoiceNumber: 'I',
    quantity: 1, unitCost: 100, taxes: 0, totalAmount: 100, paymentStatus: 'PENDING', sku: 'SKU' };
  const recorded = purchases.createSupplierPayment([bill], { id: 'pay', supplierId: 'vendor', date: '2026-10-19', amount: 125,
    reference: 'UTR-123', paymentMethod: 'BANK_TRANSFER' });
  assert.equal(recorded.bills[0].paidAmount, 100);
  assert.equal(recorded.payment.advanceAmount, 25);
  const journals = ledger.generateGeneralLedger([], [], [], recorded.bills, [], [recorded.payment]);
  assert.equal(balance(journals, '2010'), 0);
  assert.equal(balance(journals, '1010'), -125);
  assert.equal(balance(journals, '1050'), 25);
  assert.match(journals.find(entry => entry.referenceType === 'SUPPLIER_PAYMENT').timestamp, /^2026-10-19/);
  const legacy = ledger.generateGeneralLedger([], [], [], [{ ...bill, paidAmount: 30, paymentStatus: 'PARTIAL' }], []);
  assert.equal(balance(legacy, '2010'), -100);
  assert.equal(balance(legacy, '1010'), 0);
  assert.equal(ledger.calculateTrialBalance(legacy).isComplete, false);
});

test('A7: one-paisa imbalances fail both journal and trial balance validation', () => {
  const lines = [{ accountCode: '1010', debit: 1, credit: 0 }, { accountCode: '4010', debit: 0, credit: 0.99 }];
  assert.equal(ledger.validateJournalBalance(lines).isBalanced, false);
  assert.equal(ledger.calculateTrialBalance([{ lines }]).isBalanced, false);
});

test('A8: discounted SKU weights allocate paise exactly', () => {
  const rows = engine.calculateSkuProfitability([order({ marketplaceChargesEstimate: 90, items: [
    item({ id: 'a', sku: 'A', quantity: 1, sellingPrice: 100, discount: 90 }),
    item({ id: 'b', sku: 'B', quantity: 1, sellingPrice: 100, discount: 0 }),
  ] })], [], [], []);
  assert.equal(rows[0].marketplaceCharges, 8.18);
  assert.equal(rows[1].marketplaceCharges, 81.82);
  assert.equal(facts.sumMoney(rows.map(row => row.marketplaceCharges)), 90);
});

test('B1: one entered return fee is recorded once and reimbursements never become salvage or loss offsets', () => {
  const damaged = facts.getManualReturnCosts(100, 2, true, 10);
  assert.equal(damaged.customerReturnFee, 10);
  assert.equal(damaged.returnShippingCost, 0);
  assert.equal(damaged.inventoryRecoveryValue, 0);
  assert.equal(damaged.lossAmount, 200);
  assert.equal(facts.getManualReturnCosts(100, 2, false, 10).lossAmount, 0);
});

test('B2: customer shipping revenue offsets recorded logistics and only explicit refunds reduce it', () => {
  const source = order({ shippingFeeCharged: 60 });
  const receipts = [settlement({ deductions: [{ category: 'LOGISTICS', name: 'Freight', amount: 60 }] })];
  assert.equal(facts.getOrderFinancialFacts(source, [], receipts, []).contributionProfit, 800);
  assert.equal(facts.getOrderFinancialFacts(source, [returned({ quantity: 2 })], receipts, []).shippingRevenue, 60);
  assert.equal(facts.getOrderFinancialFacts({ ...source, shippingRefundAmount: 60, shippingRefundDate: '2026-10-10' }, [returned()], receipts, []).shippingRevenue, 0);
  const refunded = facts.getOrderFinancialFacts({ ...source, shippingTaxAmount: 9.15, shippingRefundAmount: 60, shippingRefundDate: '2026-10-10' }, [returned()], receipts, []);
  assert.equal(refunded.shippingTax, 0);
});

test('B3: inclusive and exclusive representations of one invoice produce identical sales and payout', () => {
  const inclusive = order({ pricesIncludeTax: true, items: [item({ sellingPrice: 118, taxAmount: 36 })] });
  const exclusive = order({ pricesIncludeTax: false, items: [item({ sellingPrice: 100, taxAmount: 36 })] });
  for (const returns of [[], [returned({ gstAdjustment: gstAdjustment(18) })]]) {
    const left = facts.getOrderFinancialFacts(inclusive, returns, [], []), right = facts.getOrderFinancialFacts(exclusive, returns, [], []);
    assert.equal(left.netSales, right.netSales);
    assert.equal(left.expectedPayout, right.expectedPayout);
    const journals = ledger.generateGeneralLedger([inclusive], returns, [], [], []);
    assert.equal(-balance(journals, '4010') - balance(journals, '4030'), left.netSales);
    assert.equal(-balance(journals, '2020'), left.retainedTax);
  }
  const unknown = facts.getOrderFinancialFacts(order({ items: [item({ taxAmount: 18 })] }), [], [], []);
  assert.equal(unknown.taxBasisKnown, false);
  assert.equal(unknown.expectedPayout, null);
  assert.equal(fees.calculateMarketplaceFeeEstimate([], [{ sku: 'SKU', quantity: 1, unitPricePaise: 11800,
    discountPaise: 0, taxPaise: 1800 }], 'WooCommerce', '2026-10-19', 1000).status, 'NOT_CONFIGURED');
});

test('B4: used/lost returns, RTO costs and salvage follow the same return and order policy', () => {
  for (const changes of [{ condition: 'USED', inventoryRecoveryValue: 20 }, { returnType: 'LOST_RETURN' }, { returnType: 'RTO' }]) {
    const ret = returned({ customerReturnFee: 5, returnShippingCost: 10, otherReturnCosts: 3, ...changes });
    const result = facts.getOrderFinancialFacts(order(), [ret], [], []);
    const view = engine.computeReturnFinancials(ret, [order()], [], []);
    assert.equal(view.damageLoss, result.damageLoss);
    assert.equal(view.baseLoss, facts.sumMoney([result.damageLoss, result.returnCosts]));
    const journals = ledger.generateGeneralLedger([order()], [ret], [], [], []);
    assert.equal(balance(journals, '5010') + balance(journals, '5020'), facts.sumMoney([result.cogs, -result.salvageRecovery]));
  }
  const recovery = facts.getOrderFinancialFacts(order(), [returned({ condition: 'DAMAGED', inventoryRecoveryValue: 150 })], [], []);
  assert.equal(recovery.damageLoss, 0);
  assert.equal(recovery.salvageRecovery, 100);
  const journals = ledger.generateGeneralLedger([order()], [returned({ condition: 'DAMAGED', inventoryRecoveryValue: 150 })], [], [], []);
  assert.equal(balance(journals, '5020'), 0);
  assert.equal(balance(journals, '4040'), 0);
  assert.equal(balance(journals, '1030'), -100);
});

test('B5/B6: commission GST changes cash and eligible expense separately; unconfirmed registration grants no credit', () => {
  const estimate = fees.calculateMarketplaceFeeEstimate([], [{ sku: 'SKU', quantity: 1, unitPricePaise: 100000,
    discountPaise: 0, taxPaise: 0, pricesIncludeTax: false }], 'WooCommerce', '2026-10-19', 1500);
  assert.equal(estimate.totalPaise, 17700);
  assert.equal(estimate.components[0].taxPaise, 2700);
  const receipts = [settlement({ deductions: [{ category: 'COMMISSION', name: 'Commission', amount: 177, gstAmount: 27, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'FEE-INV' }] })];
  const regular = order({ gstRegistrationType: 'REGULAR' });
  const result = facts.getOrderFinancialFacts(regular, [], receipts, []);
  assert.equal(result.fees, 150); assert.equal(result.cashFees, 177);
  assert.equal(result.expectedPayout, 823);
  const journals = ledger.generateGeneralLedger([regular], [], receipts, [], []);
  assert.equal(balance(journals, '1040'), 27);
  assert.equal(balance(journals, '6010'), 150);
  for (const gstRegistrationType of [undefined, 'COMPOSITION', 'UNREGISTERED'])
    assert.equal(facts.getOrderFinancialFacts(order({ gstRegistrationType }), [], receipts, []).fees, 177);
});

test('B7: webhook fees remain unknown, Shopify shipping is recorded and Woo discounts apply once', () => {
  const shopify = load('src/lib/webhooks/schemas/shopify-schema.ts');
  const woo = load('src/lib/webhooks/schemas/woocommerce-schema.ts');
  const shp = shopify.mapShopifyOrderToDomain(shopify.ShopifyOrderWebhookSchema.parse({ id: 1, currency: 'INR', created_at: '2026-10-01T00:00:00Z', total_price: '60', taxes_included: true,
    shipping_lines: [{ price: '60', tax_lines: [{ price: '9.15' }] }] }));
  assert.equal(shp.shippingFeeCharged, 60); assert.equal(shp.shippingTaxAmount, 9.15);
  assert.equal(shp.feeEstimateStatus, 'NOT_CONFIGURED'); assert.equal(shp.marketplaceChargesEstimate, 0);
  const wc = woo.mapWooCommerceOrderToDomain(woo.WooCommerceOrderWebhookSchema.parse({ id: 1, status: 'completed', currency: 'INR', date_created: '2026-10-01T00:00:00Z', total: '180',
    line_items: [{ id: 1, product_id: 1, sku: 'SKU', quantity: 2, price: '90', subtotal: '200', total: '180', total_tax: '0' }] }));
  assert.equal(facts.getOrderFinancialFacts(wc, [], [], []).netSales, 180);
  assert.equal(wc.feeEstimateStatus, 'NOT_CONFIGURED');
  const thirds = woo.mapWooCommerceOrderToDomain(woo.WooCommerceOrderWebhookSchema.parse({ id: 2, status: 'completed', currency: 'INR', date_created: '2026-10-01T00:00:00Z', total: '100',
    line_items: [{ id: 2, product_id: 2, sku: 'SKU', quantity: 3, subtotal: '100', total: '100', total_tax: '0' }] }));
  assert.equal(facts.getOrderFinancialFacts(thirds, [], [], []).netSales, 100);
  assert.equal(fees.buildFeeOrderLineInputs(thirds.items, new Map(), null, false)[0].lineSubtotalPaise, 10000);
});

test('B8: weight warnings require recorded weights, configured slabs and actual LOGISTICS deductions', () => {
  const radar = load('src/domain/anomaly-radar.ts');
  const params = { orders: [order({ shippingFeeCharged: 999, items: [item({ quantity: 1 })] })], returns: [], claims: [],
    products: [{ sku: 'SKU', weightGrams: 220 }], settlements: [], logisticsRateSlabs: [{ marketplace: 'WooCommerce', maxWeightGrams: 500, amount: 50, effectiveFrom: '2026-01-01' }] };
  const weightAlerts = input => radar.computeAnomalyRadar(input).items.filter(item => item.category === 'WEIGHT_DISCREPANCY');
  assert.equal(weightAlerts(params).length, 0);
  const actual = { ...params, settlements: [settlement({ deductions: [{ category: 'LOGISTICS', name: 'Freight', amount: 90.25 }] })] };
  assert.equal(weightAlerts(actual)[0].impactAmount, 40.25);
  assert.equal(weightAlerts({ ...actual, products: [{ sku: 'SKU' }] }).length, 0);
  assert.equal(weightAlerts({ ...actual, logisticsRateSlabs: [] }).length, 0);
});

test('B9/B10/B11: unknown payouts stay in aging, ratios use percentage points and contribution has no net-profit alias', () => {
  const source = order({ feeEstimateStatus: 'NOT_CONFIGURED' });
  const aging = engine.calculateSettlementAging([source], [], '2026-10-19');
  assert.equal(aging.totalUnsettledOrders, 1);
  assert.equal(aging.overdue.unknownAmountOrders, 1);
  assert.equal(aging.totalOutstandingAmount, null);
  assert.equal(aging.overdue.orders[0].estimatedPayout, null);
  assert.equal(engine.calculatePercentageChange(0.25, 0.20, 'RATIO'), 5);
  assert.equal(engine.calculatePercentageChange(25, 20), 25);
  assert.equal('trueProfit' in engine.calculateBusinessProfitability([source], [], [], [], []), false);
});

test('B13: statutory warnings use dated rates, separate TCS/TDS, and never block or rewrite amounts', () => {
  const input = { tdsApplicability: 'VERIFIED_APPLICABLE', tdsDate: '2024-10-01', date: '2024-10-01', netTaxableValue: 1000, grossExcludingGst: 1000, tcsTax: 5, tdsTax: 1 };
  assert.equal(accounting.validateStatutoryWithholding(input).length, 0);
  const warnings = accounting.validateStatutoryWithholding({ ...input, date: '2024-07-09', tdsDate: '2024-07-09' });
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].expected, 10);
  assert.equal(accounting.validateStatutoryWithholding({ ...input, tcsTax: undefined, tdsTax: undefined }).length, 0);
  const guardrails = load('src/domain/guardrails.ts');
  const warning = guardrails.runSystemGuardrailDiagnostics([], [], [], [settlement({ tcsTax: 50, tcsTaxableValue: 1000, tcsCollectionDate: '2026-10-15' })], [], [])
    .find(result => result.name === 'Statutory Withholding Rates');
  assert.equal(warning.status, 'WARNING');
  assert.equal(accounting.getSettlementWithholding({ tcsTdsTax: 8, tcsTax: 5 }), 8);
  assert.equal(accounting.getSettlementWithholding({ tcsTdsTax: 8, tcsTax: 5, tdsTax: 1 }), 6);
});

test('supplier payment snapshots round-trip and old snapshots default to an empty payment history', () => {
  const snapshots = load('src/domain/snapshot-validation.ts');
  const recycle = load('src/domain/recycle-bin.ts');
  const data = { ...recycle.emptyLedger(), supplierPayments: [{ id: 'payment', supplierId: 's', date: '2026-10-19',
    amount: 125, allocations: [{ purchaseId: 'bill', amount: 100 }], advanceAmount: 25, reference: 'UTR', paymentMethod: 'UPI' }] };
  const parsed = snapshots.parseLedgerSnapshot(JSON.stringify({ version: 1, ownerId: 'tenant', data }), 'tenant');
  assert.equal(parsed.supplierPayments[0].reference, 'UTR');
  assert.equal(parsed.supplierPayments[0].advanceAmount, 25);
  assert.equal(snapshots.parseLedgerSnapshot(JSON.stringify({ version: 1, ownerId: 'tenant', data: recycle.emptyLedger() }), 'tenant').supplierPayments.length, 0);
  assert.equal(snapshots.parseLedgerSnapshot(JSON.stringify({ version: 1, ownerId: 'tenant', data: { ...data,
    supplierPayments: [{ ...data.supplierPayments[0], advanceAmount: 24 }] } }), 'tenant'), null);
});

test('ledger and operational outstanding agree after return fees, withholding, GST and recorded claims', () => {
  const source = order({ pricesIncludeTax: false, gstRegistrationType: 'REGULAR', shippingFeeCharged: 60,
    items: [item({ sellingPrice: 100, taxAmount: 36, snapshotUnitCost: 40 })] });
  const ret = returned({ customerReturnFee: 10, gstAdjustment: gstAdjustment(18) });
  const receipt = settlement({ netSettlement: 100, tcsTax: 0.5, tdsTax: 0.1,
    deductions: [{ category: 'COMMISSION', name: 'Commission', amount: 11.8, gstAmount: 1.8, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'FEE-INV' }] });
  const claim = { id: 'claim', orderId: 'o', marketplace: 'WooCommerce', status: 'RECOVERED', amountRecovered: 5, claimDate: '2026-10-15', recoveryDate: '2026-10-15' };
  const result = facts.getOrderFinancialFacts(source, [ret], [receipt], [claim]);
  const journals = ledger.generateGeneralLedger([source], [ret], [receipt], [], [], [], [claim]);
  assert.equal(balance(journals, '1020'), result.outstanding);
  assert.equal(-balance(journals, '4020'), result.claimRecovery);
  assert.ok(journals.every(entry => entry.isBalanced));
});

test('tax policy is tenant-scoped, dated, snapshotted and used by server-side commission calculations', async () => {
  const statements = [];
  const client = { query: async (sql, params = []) => {
    statements.push({ sql, params });
    if (sql.includes('FROM channel_accounting_policies')) return { rows: [{ prices_include_tax: false,
      gst_registration_type: 'REGULAR', marketplace_fee_gst_rate_bps: 1800, marketplace_fees_include_gst: true }] };
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 'uuid', display_id: 'o', is_insert: true }] };
    if (sql.includes('INSERT INTO order_fee_estimates')) return { rows: [{ id: 'estimate' }] };
    return { rows: [] };
  }, release() {} };
  const persistence = load('src/lib/integrations/order-persistence.ts', { '@/lib/db': { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } } });
  await persistence.upsertOrders('tenant', [order({ quickFeeRateBps: 1000, items: [item({ quantity: 1, sellingPrice: 100, taxAmount: 18 })] })]);
  const policy = statements.find(statement => statement.sql.includes('FROM channel_accounting_policies'));
  assert.deepEqual(Array.from(policy.params), ['tenant', 'WooCommerce', '2026-10-01']);
  const estimate = statements.find(statement => statement.sql.includes('INSERT INTO order_fee_estimates'));
  assert.equal(estimate.params[3], 1180);
  const snapshot = JSON.parse(estimate.params[5]);
  assert.equal(snapshot.pricesIncludeTax, false);
  assert.equal(snapshot.gstRegistrationType, 'REGULAR');
  assert.equal(snapshot.estimatedFeeTaxAmount, 1.8);
});

test('C: cent allocation conserves totals for signed and uneven orders', () => {
  for (const amount of [0.01, -0.01, 10.075, -2.505, 99999.99])
    for (const weights of [[1,1,1], [0,0], [100,0.01,3]])
      assert.equal(facts.sumMoney(facts.allocateMoney(amount, weights)), facts.money(amount));
});

test('C: ledger contribution reconciles to report facts across tax bases, quantities and return conditions', () => {
  for (const quantity of [1,2,3,7]) for (const pricesIncludeTax of [false,true])
    for (const condition of ['SELLABLE','DAMAGED','USED','UNDER_INSPECTION']) {
      const source = order({ pricesIncludeTax, gstRegistrationType: 'REGULAR', shippingFeeCharged: 23.45, shippingTaxAmount: 3.58,
        items: [item({ quantity, sellingPrice: 27.19, discount: 1.13, taxAmount: 3.17, snapshotUnitCost: 10.07 })] });
      const ret = returned({ condition, quantity: Math.min(quantity, 2), inventoryRecoveryValue: 1.23,
        customerReturnFee: 2.15, returnShippingCost: 3.14, otherReturnCosts: 0.27, gstAdjustment: gstAdjustment(facts.prorateMoney(3.17, Math.min(quantity, 2), quantity)) });
      const receipt = settlement({ netSettlement: 0, deductions: [{ category: 'COMMISSION', name: 'Commission', amount: 5.9, gstAmount: 0.9 }] });
      const result = facts.getOrderFinancialFacts(source, [ret], [receipt], []);
      const journals = ledger.generateGeneralLedger([source], [ret], [receipt], [], []);
      const trial = ledger.calculateTrialBalance(journals);
      const revenue = facts.sumMoney(trial.rows.filter(row => row.type === 'REVENUE').map(row => facts.sumMoney([row.totalCredit,-row.totalDebit])));
      const expense = facts.sumMoney(trial.rows.filter(row => row.type === 'EXPENSE').map(row => facts.sumMoney([row.totalDebit,-row.totalCredit])));
      assert.equal(facts.sumMoney([revenue,-expense]), result.contributionProfit, `${quantity}/${pricesIncludeTax}/${condition}`);
      assert.equal(trial.isBalanced, true);
    }
});
