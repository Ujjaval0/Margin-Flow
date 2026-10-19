import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const engine = load('src/domain/profitability-engine.ts');
const ledger = load('src/domain/ledger-engine.ts');
const facts = load('src/domain/order-financials.ts');
const purchases = load('src/domain/purchase-accounting.ts');
const item = (changes = {}) => ({ id: 'line-1', sku: 'SKU', productName: 'Item', quantity: 2, sellingPrice: 100,
  discount: 20, taxAmount: 0, snapshotUnitCost: 40, returnedQuantity: 0, ...changes });
const order = (changes = {}) => ({ id: 'order-1', channelOrderId: 'channel-1', marketplace: 'WooCommerce',
  orderDate: '2026-10-15', status: 'DELIVERED', items: [item()], shippingFeeCharged: 0, marketplaceChargesEstimate: 0, ...changes });
const returned = (changes = {}) => ({ id: 'return-1', orderId: 'order-1', channelOrderId: 'channel-1', marketplace: 'WooCommerce',
  returnDate: '2026-10-15', returnType: 'CUSTOMER_RETURN', sku: 'SKU', quantity: 1, condition: 'SELLABLE',
  returnShippingCost: 0, customerReturnFee: 0, otherReturnCosts: 0, inventoryRecoveryValue: 0, lossAmount: 0, ...changes });
const settlement = (changes = {}) => ({ id: 'settlement-1', orderId: 'order-1', marketplace: 'WooCommerce',
  settlementDate: '2026-10-15', settlementBatchId: 'batch', grossAmount: 180, netSettlement: 150,
  deductions: [], tcsTdsTax: 0, reconciliationStatus: 'RECONCILED', ...changes });

test('unpaid delivered revenue is a receivable, never fabricated cash or a fee', () => {
  const result = engine.calculateBusinessProfitability([order()], [], [], [], []);
  assert.equal(result.actualSettlementsReceived, 0);
  assert.equal(result.outstandingSettlementEstimated, null);
  assert.equal(result.unknownFeeOrders, 1);
  assert.equal(result.netSales, 180);
  assert.equal(result.cogs, 80);
  assert.equal(result.grossProfit, 100);
  assert.equal(result.contributionProfit, 100);
  assert.equal(result.marketplaceCharges, 0);
});

test('configured estimates produce a forecast and actual settlement deductions replace rather than add to estimates', () => {
  const configured = order({ feeEstimateStatus: 'CONFIGURED', marketplaceChargesEstimate: 30 });
  const forecast = facts.getOrderFinancialFacts(configured, [], [], []);
  assert.equal(forecast.fees, 30);
  assert.equal(forecast.feeStatus, 'ESTIMATE');
  assert.equal(forecast.expectedPayout, 150);
  const actual = facts.getOrderFinancialFacts(configured, [], [settlement({ deductions: [
    { category: 'COMMISSION', name: 'Commission', amount: 20 },
    { category: 'LOGISTICS', name: 'Shipping', amount: 5 },
    { category: 'TAX_TCS', name: 'TCS', amount: 2 },
  ] })], []);
  assert.equal(actual.fees, 25);
  assert.equal(actual.feeStatus, 'ACTUAL');
  assert.equal(actual.expectedPayout, 155);
});

test('explicit no-rule status ignores any preserved legacy numeric fee and withholds payout', () => {
  const result = facts.getOrderFinancialFacts(order({ feeEstimateStatus: 'NOT_CONFIGURED', marketplaceChargesEstimate: 999 }), [], [], []);
  assert.equal(result.fees, 0);
  assert.equal(result.feeStatus, 'UNKNOWN');
  assert.equal(result.expectedPayout, null);
  assert.equal(result.outstanding, null);
});

test('percentage and fee estimates never become observed cash', () => {
  const result = engine.calculateOrderProfitability(order({ settlementPercent: 75, marketplaceChargesEstimate: 30, feeEstimateStatus: 'LEGACY' }), [], [], []);
  assert.equal(result.settledAmount, 0);
  assert.equal(result.isSettled, false);
  assert.equal(result.contributionProfit, 70);
});

test('pending and cancelled orders do not recognise revenue or COGS', () => {
  for (const status of ['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED']) {
    const result = engine.calculateBusinessProfitability([order({ status })], [], [], [], []);
    assert.equal(result.netSales, 0, status);
    assert.equal(result.cogs, 0, status);
    assert.equal(result.contributionProfit, 0, status);
    assert.equal(ledger.generateGeneralLedger([order({ status })], [], [], [], []).length, 0, status);
  }
});

test('partial sellable return reverses only returned revenue and COGS despite a stale whole-order status', () => {
  const result = engine.calculateBusinessProfitability([order({ status: 'CUSTOMER_RETURN' })], [returned()], [], [], []);
  assert.equal(result.refundedSales, 90);
  assert.equal(result.netSales, 90);
  assert.equal(result.cogs, 40);
  assert.equal(result.grossProfit, 50);
  assert.equal(result.returnRate, 0.5);
});

test('damaged partial return retains damaged cost without refunding all units', () => {
  const result = engine.calculateOrderProfitability(order({ status: 'PARTIALLY_RETURNED' }), [returned({ condition: 'DAMAGED', customerReturnFee: 5 })], [], []);
  assert.equal(result.netSales, 90);
  assert.equal(result.cogs, 80);
  assert.equal(result.contributionProfit, 5);
});

test('duplicate return records and oversized quantities cannot double-count same-SKU lines', () => {
  const source = order({ items: [item({ id: 'one', quantity: 1, discount: 0 }), item({ id: 'two', quantity: 1, discount: 0 })] });
  const result = facts.getOrderFinancialFacts(source, [returned(), returned()], [], []);
  assert.equal(result.returnedUnits, 1);
  assert.equal(result.cogs, 40);
  const oversized = facts.getOrderFinancialFacts(source, [returned({ quantity: 99 })], [], []);
  assert.equal(oversized.returnedUnits, 2);
  assert.equal(oversized.refundedSales, 200);
});

test('actual partial settlements preserve an outstanding balance and do not invent fees', () => {
  const result = engine.calculateBusinessProfitability([order()], [], [settlement()], [], []);
  assert.equal(result.actualSettlementsReceived, 150);
  assert.equal(result.outstandingSettlementEstimated, null);
  assert.equal(result.marketplaceCharges, 0);
  assert.equal(result.contributionProfit, 100);
});

test('settlements from another marketplace cannot attach by a coincident order ID', () => {
  const result = engine.calculateOrderProfitability(order(), [], [settlement({ marketplace: 'Flipkart' })], []);
  assert.equal(result.settledAmount, 0);
});

test('recorded cash and fee refunds retain their signs and duplicate receipts are not summed twice', () => {
  const source = settlement({ netSettlement: -15, deductions: [{ category: 'COMMISSION', amount: -2, name: 'Fee reversal' }] });
  const result = engine.calculateOrderProfitability(order(), [], [source, source], []);
  assert.equal(result.settledAmount, -15);
  assert.equal(result.chargesDeducted, -2);
});

test('business, order and SKU totals agree on discounted multi-line partial returns', () => {
  const source = order({ items: [item({ id: 'one', sku: 'A', quantity: 1, sellingPrice: 100, discount: 10 }),
    item({ id: 'two', sku: 'B', quantity: 1, sellingPrice: 60, discount: 0 })], marketplaceChargesEstimate: 11.11 });
  const returns = [returned({ sku: 'A', customerReturnFee: 3.33 })];
  const business = engine.calculateBusinessProfitability([source], returns, [], [], []);
  const detail = engine.calculateOrderProfitability(source, returns, [], []);
  const skus = engine.calculateSkuProfitability([source], returns, [], []);
  assert.equal(detail.contributionProfit, business.contributionProfit);
  assert.equal(facts.money(skus.reduce((sum, sku) => sum + sku.profit, 0)), business.contributionProfit);
  assert.equal(facts.money(skus.reduce((sum, sku) => sum + sku.revenue, 0)), business.netSales);
});

test('cent allocation is deterministic and reconciles signed totals', () => {
  for (const amount of [0.01, 0.02, -0.01, 11.11]) {
    assert.equal(facts.money(facts.allocateMoney(amount, [1, 1, 1]).reduce((sum, value) => sum + value, 0)), amount);
  }
});

test('supplier partial payments accumulate against remaining balances and allocate oldest-first', () => {
  const bill = (id, date, total) => ({ id, invoiceDate: date, supplierId: 'supplier', totalAmount: total, paymentStatus: 'PENDING' });
  let bills = [bill('new', '2026-10-15', 100), bill('old', '2026-10-01', 100)];
  bills = purchases.allocateSupplierPayment(bills, 'supplier', 40);
  assert.equal(bills[1].paidAmount, 40);
  assert.equal(bills[1].paymentStatus, 'PARTIAL');
  bills = purchases.allocateSupplierPayment(bills, 'supplier', 60);
  assert.equal(bills[1].paidAmount, 100);
  assert.equal(bills[1].paymentStatus, 'PAID');
  assert.equal(bills[0].paymentStatus, 'PENDING');
  assert.throws(() => purchases.allocateSupplierPayment(bills, 'supplier', -1));
});

test('ledger recognises discounted goods revenue without an invented 65/35 fee split', () => {
  const journals = ledger.generateGeneralLedger([order({ marketplaceChargesEstimate: 20 })], [], [], [], []);
  assert.equal(journals[0].lines.find(line => line.accountCode === '4010').credit, 180);
  assert.equal(journals[0].lines.find(line => line.accountCode === '6020').debit, 0);
  assert.equal(journals[0].lines.find(line => line.accountCode === '6010').debit, 0);
  assert.ok(journals.every(journal => journal.isBalanced));
});

function hooks() {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
  };
  return { react, render: fn => { cursor = 0; return fn(); }, flush: () => { effects.splice(0).forEach(fn => fn()); } };
}

test('actual purchase action adds stock exactly once for a repeated bill', async () => {
  const harness = hooks();
  const app = load('src/domain/store.tsx', { react: harness.react }, {
    window: {}, localStorage: { getItem: () => null }, fetch: async (url, options) => {
      if (url === '/api/auth/me') return Response.json({ user: { id: 'tenant-A' } });
      if (url.startsWith('/api/orders')) return Response.json({ orders: [] });
      if (url.startsWith('/api/products') && options?.method !== 'POST') return Response.json({ products: [] });
      if (url.startsWith('/api/settlements')) return Response.json({ settlements: [] });
      if (url === '/api/recycle-bin?recovered=true') return Response.json({ recovered: { returns: [], claims: [], expenses: [] } });
      return Response.json({ success: true });
    },
  });
  const render = () => harness.render(() => app.PlatformProvider({ children: null }).props.value);
  await render().refreshFromDatabase();
  await render().addProduct({ id: 'p', sku: 'SKU', name: 'Item', currentCostPrice: 40, costHistory: [], channelAliases: {}, active: true, supplierId: 's', stockQuantity: 5 });
  const state = render();
  const bill = { id: 'purchase', supplierId: 's', supplierName: 'Supplier', invoiceDate: '2026-10-15', invoiceNumber: 'INV',
    sku: 'SKU', quantity: 3, unitCost: 40, taxes: 0, totalAmount: 120, paymentStatus: 'PENDING' };
  state.addPurchase(bill);
  state.addPurchase(bill);
  assert.equal(render().products[0].stockQuantity, 8);
  assert.equal(render().purchases.length, 1);
});

test('purchase modal preserves zero GST and rounds fractional tax to cents', () => {
  const harness = hooks();
  const modal = load('src/components/modals/add-purchase-modal.tsx', {
    react: harness.react, 'react-dom': { createPortal: element => element },
  }, { window: { addEventListener() {}, removeEventListener() {} }, document: { body: {} } });
  let bill;
  const props = { isOpen: true, onClose() {}, suppliers: [{ id: 's', name: 'Supplier' }],
    products: [{ sku: 'SKU', currentCostPrice: 12.34 }], onAddPurchase: value => { bill = value; } };
  const render = () => harness.render(() => modal.AddPurchaseModal(props));
  render(); harness.flush();
  const descendants = element => {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(descendants);
    return [element, ...descendants(element.props?.children)];
  };
  let nodes = descendants(render());
  nodes.find(node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '2' } });
  const taxSelect = () => descendants(render()).find(node => node.type === 'select' && descendants(node).some(child => child.type === 'option' && child.props.value === 0));
  taxSelect().props.onChange({ target: { value: '0' } });
  descendants(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(bill.taxes, 0);
  assert.equal(bill.totalAmount, 24.68);
  taxSelect().props.onChange({ target: { value: '5' } });
  descendants(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(bill.taxes, 1.23);
  assert.equal(bill.totalAmount, 25.91);
});

test('Suppliers view tolerates a catalog product without an assigned supplier', () => {
  const harness = hooks();
  const view = load('src/components/modules/suppliers-view.tsx', {
    react: harness.react, 'react-dom': { createPortal: value => value }, 'next/dynamic': () => () => null,
    '@/domain/store': { usePlatform: () => ({
      suppliers: [{ id: 's', name: 'Supplier', email: '', phone: '', address: '', contactPerson: '', openingBalance: 0, totalPaid: 0 }],
      orders: [order()], products: [{ id: 'p', sku: 'SKU', name: 'Item', currentCostPrice: 40, channelAliases: {} }],
      purchases: [], returns: [], claims: [],
    }) },
  });
  assert.doesNotThrow(() => harness.render(() => view.SuppliersView()));
});
