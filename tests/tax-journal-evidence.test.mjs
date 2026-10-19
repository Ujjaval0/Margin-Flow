import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const ledger = load('src/domain/ledger-engine.ts');
const policy = load('src/domain/accounting-policy.ts');
const item = { id: 'line', sku: 'SKU', productName: 'Item', quantity: 1, sellingPrice: 1180,
  discount: 0, taxAmount: 180, snapshotUnitCost: 100, costEvidence: 'RECORDED', returnedQuantity: 0 };
const order = (changes = {}) => ({ id: 'o', channelOrderId: 'c', marketplace: 'WooCommerce', orderDate: '2026-09-01',
  revenueRecognisedDate: '2026-10-03', taxPointDate: '2026-09-30', taxEvidenceReference: 'INV-1', gstRegistrationType: 'REGULAR',
  status: 'DELIVERED', customerName: '', customerCity: '', customerState: '', shippingFeeCharged: 0,
  marketplaceChargesEstimate: 0, feeEstimateStatus: 'CONFIGURED', pricesIncludeTax: true, items: [{ ...item }], ...changes });
const settlement = (changes = {}) => ({ id: 's', orderId: 'o', marketplace: 'WooCommerce', settlementDate: '2026-10-15',
  settlementBatchId: 'batch', grossAmount: 1180, deductions: [], tcsTdsTax: 0, netSettlement: 1180,
  tcsTax: 0, tdsTax: 0, evidenceType: 'BANK_RECEIPT', feeCoverage: 'COMPLETE', reconciliationStatus: 'RECONCILED', ...changes });
const returned = (changes = {}) => ({ id: 'r', orderId: 'o', channelOrderId: 'c', marketplace: 'WooCommerce', returnDate: '2026-10-10',
  returnType: 'CUSTOMER_RETURN', returnReason: '', sku: 'SKU', quantity: 1, condition: 'SELLABLE', restockStatus: 'PENDING_RESTOCK',
  returnShippingCost: 0, customerReturnFee: 0, otherReturnCosts: 0, inventoryRecoveryValue: 0, lossAmount: 0, ...changes });
const purchase = (changes = {}) => ({ id: 'p', supplierId: 'sup', supplierName: 'Supplier', invoiceNumber: 'PI-1',
  invoiceDate: '2026-10-01', sku: 'SKU', quantity: 1, unitCost: 1000, taxes: 180, totalAmount: 1180, paymentStatus: 'PENDING', ...changes });
const balance = (entries, code) => Math.round(entries.flatMap(entry => entry.lines).filter(line => line.accountCode === code)
  .reduce((sum, line) => sum + line.debit - line.credit, 0) * 100) / 100;
const journals = (orders = [], returns = [], settlements = [], purchases = []) => ledger.generateGeneralLedger(orders, returns, settlements, purchases, []);

test('tax point is independent of revenue recognition, including invoiced shipped goods', () => {
  const entries = journals([order()]);
  assert.equal(entries.find(entry => entry.referenceType === 'OUTPUT_GST').timestamp.slice(0, 10), '2026-09-30');
  assert.equal(entries.find(entry => entry.referenceType === 'ORDER_FULFILLMENT').timestamp.slice(0, 10), '2026-10-03');
  assert.equal(balance(entries, '2020'), -180);
  assert.equal(balance(entries, '1020'), 1180);
  const shipped = journals([order({ status: 'SHIPPED', revenueRecognisedDate: undefined })]);
  assert.equal(balance(shipped, '2020'), -180);
  assert.equal(balance(shipped, '4010'), 0);
  assert.equal(balance(shipped, '5010'), 0);
});

test('unresolved price basis suppresses speculative sales while preserving known tax and cost evidence', () => {
  const entries = journals([order({ pricesIncludeTax: undefined })]);
  assert.equal(balance(entries, '4010'), 0);
  assert.equal(balance(entries, '1020'), 180);
  assert.equal(balance(entries, '5010'), 100);
  const trial = ledger.calculateTrialBalance(entries);
  assert.equal(trial.isBalanced, true);
  assert.equal(trial.isComplete, false);
  assert.ok(trial.issues.some(issue => issue.includes('Price tax basis')));
});

test('actual fees and eligible input GST post at settlement date, including cancelled order fees', () => {
  const receipt = settlement({ netSettlement: 1062, deductions: [{ category: 'COMMISSION', name: 'Commission', amount: 118,
    gstAmount: 18, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'FEE-INV' }] });
  const entries = journals([order({ status: 'CANCELLED', revenueRecognisedDate: undefined })], [], [receipt]);
  assert.equal(balance(entries, '6010'), 100);
  assert.equal(balance(entries, '1040'), 18);
  assert.equal(entries.find(entry => entry.referenceType === 'MARKETPLACE_FEE').timestamp.slice(0, 10), '2026-10-15');
  assert.ok(entries.every(entry => entry.isBalanced));
});

test('regular registration alone grants no fee ITC and explicit zero partial credit stays zero', () => {
  const deduction = { category: 'COMMISSION', name: 'Commission', amount: 118, gstAmount: 18 };
  assert.equal(policy.marketplaceFeeFacts(order(), deduction).provisionalInputCredit, 0);
  assert.equal(policy.marketplaceFeeFacts(order(), { ...deduction, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'INV', eligibleGstAmount: 0 }).provisionalInputCredit, 0);
  assert.throws(() => policy.marketplaceFeeFacts(order(), { ...deduction, eligibleGstAmount: 19 }));
});

test('purchase GST requires evidence; ineligible tax is inventory cost and partial tax remains unresolved', () => {
  const unknown = journals([], [], [], [purchase()]);
  assert.equal(balance(unknown, '1040'), 0);
  assert.equal(balance(unknown, '1070'), 180);
  assert.equal(ledger.calculateTrialBalance(unknown).isComplete, false);
  const ineligible = journals([], [], [], [purchase({ gstCreditStatus: 'INELIGIBLE' })]);
  assert.equal(balance(ineligible, '1030'), 1180);
  assert.equal(balance(ineligible, '1040'), 0);
  const partial = journals([], [], [], [purchase({ gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'INV', eligibleGstAmount: 90 })]);
  assert.equal(balance(partial, '1040'), 90);
  assert.equal(balance(partial, '1070'), 90);
  assert.ok(partial.every(entry => entry.isBalanced));
  assert.throws(() => journals([], [], [], [purchase({ gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'INV', eligibleGstAmount: 181 })]));
});

test('GST credit-note adjustment uses note period and never infers eligibility from a return', () => {
  const adjustment = { status: 'ELIGIBLE', amount: 180, creditNoteNumber: 'CN-1', creditNoteDate: '2026-10-10',
    originalSupplyDate: '2026-09-30', declaredDate: '2026-11-01', evidenceReference: 'CN/RETURN' };
  const entries = journals([order()], [returned({ gstAdjustment: adjustment })]);
  assert.equal(balance(entries, '2020'), 0);
  assert.equal(balance(entries, '1070'), 0);
  assert.equal(entries.find(entry => entry.id === 'JE-GST-RET-r').timestamp.slice(0, 10), '2026-10-10');
  const unresolved = journals([order()], [returned()]);
  assert.equal(balance(unresolved, '2020'), -180);
  assert.equal(balance(unresolved, '1070'), 180);
  const ineligible = journals([order()], [returned({ gstAdjustment: { status: 'INELIGIBLE', amount: 0 } })]);
  assert.equal(balance(ineligible, '2020'), -180);
  assert.equal(balance(ineligible, '6040'), 180);
});

test('late or invalid-calendar credit-note evidence cannot reduce output GST', () => {
  const adjustment = { status: 'ELIGIBLE', amount: 180, creditNoteNumber: 'CN-1', creditNoteDate: '2026-10-10',
    originalSupplyDate: '2023-04-01', declaredDate: '2026-10-20', evidenceReference: 'CN' };
  assert.throws(() => policy.eligibleReturnGst(returned({ gstAdjustment: adjustment }), 180));
  assert.throws(() => policy.eligibleReturnGst(returned({ gstAdjustment: { ...adjustment, originalSupplyDate: '2026-02-30' } }), 180));
  const entries = journals([order()], [returned({ gstAdjustment: adjustment })]);
  assert.equal(balance(entries, '2020'), -180);
  assert.equal(ledger.calculateTrialBalance(entries).isComplete, false);
  const withinWindow = { ...adjustment, originalSupplyDate: '2026-04-01', declaredDate: '2026-10-20' };
  assert.equal(policy.eligibleReturnGst(returned({ gstAdjustment: withinWindow }), 180), 180);
  assert.throws(() => policy.eligibleReturnGst(returned({ gstAdjustment: { ...withinWindow, annualReturnFiledDate: '2026-10-19' } }), 180));
});

test('stock is restored only on evidenced receipt date and undated paid totals never invent bank movement', () => {
  const entries = journals([order()], [returned({ restockStatus: 'RESTOCKED', receivedDate: '2026-11-02' })]);
  assert.equal(entries.find(entry => entry.id === 'JE-RET-STOCK-r').timestamp.slice(0, 10), '2026-11-02');
  assert.equal(balance(entries, '1030'), 0);
  const undated = journals([], [], [], [purchase({ paymentStatus: 'PAID', gstCreditStatus: 'INELIGIBLE' })]);
  assert.equal(balance(undated, '1010'), 0);
  assert.equal(ledger.calculateTrialBalance(undated).isComplete, false);
});

test('financial events do not fabricate bank receipts and GST TCS stays separate from income-tax TDS', () => {
  const entries = journals([], [], [settlement({ evidenceType: 'FINANCIAL_EVENT', netSettlement: 1168, tcsTax: 10, tdsTax: 2, tcsTdsTax: 12 })]);
  assert.equal(balance(entries, '1010'), 0);
  assert.equal(balance(entries, '1080'), 10);
  assert.equal(balance(entries, '1090'), 2);
  assert.equal(balance(entries, '2030'), 0);
  assert.equal(balance(entries, '1020'), -12);
  const legacy = journals([], [], [settlement({ tcsTax: 10, tdsTax: undefined, tcsTdsTax: 12 })]);
  assert.equal(balance(legacy, '1080'), 10);
  assert.equal(balance(legacy, '2030'), 2);
});

test('signed refunds normalize journal sides and finite-value validation rejects NaN', () => {
  const entries = journals([order()], [], [settlement({ netSettlement: -118, deductions: [{ category: 'COMMISSION', name: 'Fee refund', amount: -118,
    gstAmount: -18, gstCreditStatus: 'ELIGIBLE', gstEvidenceReference: 'FEE-CN' }] })]);
  assert.ok(entries.flatMap(entry => entry.lines).every(line => line.debit >= 0 && line.credit >= 0));
  assert.ok(entries.every(entry => entry.isBalanced));
  assert.equal(balance(entries, '6010'), -100);
  assert.throws(() => ledger.validateJournalBalance([{ debit: NaN, credit: 0 }]));
});

test('dated shipping refunds reverse commercial shipping without assuming a GST credit note', () => {
  const entries = journals([order({ shippingFeeCharged: 118, shippingTaxAmount: 18, shippingRefundAmount: 118, shippingRefundDate: '2026-10-20' })]);
  assert.equal(balance(entries, '4050'), 0);
  assert.equal(balance(entries, '2020'), -198);
  assert.equal(balance(entries, '1070'), 18);
  assert.equal(entries.find(entry => entry.id === 'JE-SHIP-RET-o').timestamp.slice(0, 10), '2026-10-20');
  const undated = journals([order({ shippingFeeCharged: 118, shippingTaxAmount: 18, shippingRefundAmount: 118 })]);
  assert.equal(balance(undated, '4050'), -100);
  assert.ok(ledger.calculateTrialBalance(undated).issues.some(issue => issue.includes('Shipping refund date')));
});

test('closed or rejected claims preserve recorded recoveries; missing dates remain visibly provisional', () => {
  const claim = { id: 'claim', orderId: 'o', marketplace: 'WooCommerce', claimType: 'FEE_DISPUTE', claimDate: '2026-10-01',
    amountClaimed: 25, amountRecovered: 25, recoveryDate: '2026-10-05', status: 'CLOSED' };
  for (const status of ['CLOSED', 'REJECTED']) {
    const entries = ledger.generateGeneralLedger([order()], [], [], [], [], [], [{ ...claim, status }]);
    assert.equal(balance(entries, '4020'), -25);
  }
  const entries = ledger.generateGeneralLedger([order()], [], [], [], [], [], [{ ...claim, recoveryDate: undefined }]);
  assert.equal(balance(entries, '4020'), 0);
  assert.ok(entries.find(entry => entry.referenceId === 'claim').isProvisional);
});

test('withholding advisory uses independent evidenced events and does not guess TDS applicability', () => {
  const input = { date: '2026-10-01', netTaxableValue: 10000, grossExcludingGst: 10000, tcsTax: 50, tdsTax: 0 };
  assert.equal(policy.validateStatutoryWithholding(input).length, 0);
  assert.equal(policy.validateStatutoryWithholding({ ...input, tdsApplicability: 'VERIFIED_EXEMPT' }).length, 0);
  assert.equal(policy.validateStatutoryWithholding({ ...input, tdsApplicability: 'VERIFIED_APPLICABLE' }).length, 0);
  const warning = policy.validateStatutoryWithholding({ ...input, tdsApplicability: 'VERIFIED_APPLICABLE', tdsDate: '2026-10-01' });
  assert.equal(warning.length, 1);
  assert.equal(warning[0].expected, 10);
  assert.equal(policy.validateStatutoryWithholding({ ...input, date: '2020-12-01', tcsTax: 100, tdsTax: 75,
    tdsApplicability: 'VERIFIED_APPLICABLE', tdsDate: '2020-12-01' }).length, 0);
  assert.equal(policy.validateStatutoryWithholding({ ...input, date: '2024-10-02', tdsTax: 100,
    tdsApplicability: 'VERIFIED_APPLICABLE', tdsDate: '2024-09-30' }).length, 0);
});
