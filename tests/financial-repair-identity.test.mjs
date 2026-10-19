import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const db = '@/lib/db';
const session = '@/lib/security/session';
const order = (changes = {}) => ({ id: 'external-order', channelOrderId: 'INV-B', marketplace: 'WooCommerce',
  orderDate: '2026-10-18', status: 'SHIPPED', customerName: 'Buyer', customerCity: '', customerState: '',
  shippingFeeCharged: 0, marketplaceChargesEstimate: 0, currency: 'INR', taxEvidenceStatus: 'RECORDED', pricesIncludeTax: false,
  items: [{ id: 'line-1', sku: 'SKU-1', productName: 'Item', quantity: 1, sellingPrice: 100, discount: 0,
    taxAmount: 0, snapshotUnitCost: 40, returnedQuantity: 0 }], ...changes });
const receipt = (id = 'receipt-1', changes = {}) => ({ id, orderId: 'external-order', marketplace: 'WooCommerce',
  settlementDate: '2026-10-19', settlementBatchId: 'batch', grossAmount: 100, deductions: [],
  tcsTdsTax: 0, netSettlement: 100, reconciliationStatus: 'PENDING_RECON', ...changes });

test('display collision cannot reassign another external order or delete its lines', async () => {
  const sql = [];
  const client = { query: async (text) => {
    sql.push(text);
    if (text.includes('SELECT id, display_id, channel_order_id')) return { rows: [{
      id: 'original', display_id: 'ORD-1234', channel_order_id: 'INV-A', marketplace: 'WooCommerce' }] };
    return { rows: [] };
  }, release() {} };
  const { upsertOrders } = load('src/lib/integrations/order-persistence.ts', { [db]: {
    ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } } });
  await assert.rejects(upsertOrders('owner', [order({ id: 'ORD-1234' })]), error => {
    assert.match(error.cause?.message || error.message, /conflicts with a different external order/);
    return true;
  });
  assert.ok(sql.some(statement => statement.includes('SELECT id, display_id, channel_order_id')), 'valid fixture must reach the collision lookup');
  assert.ok(sql.includes('ROLLBACK'));
  assert.ok(!sql.some(s => /UPDATE orders SET|DELETE FROM order_items|INSERT INTO orders/.test(s)));
});

test('settlement batch has one transaction and rolls back earlier rows on a later failure', async () => {
  const statements = [];
  let inserts = 0;
  const client = { query: async (sql) => {
    statements.push(sql);
    if (sql.includes('SELECT id FROM orders')) return { rows: [{ id: 'order-uuid' }] };
    if (sql.includes('INSERT INTO settlements')) {
      if (++inserts === 2) throw Error('constraint failure');
      return { rows: [{ id: 'receipt-uuid', display_id: 'receipt-1', is_insert: true }] };
    }
    return { rows: [] };
  }, release: () => statements.push('release') };
  const { upsertSettlements } = load('src/lib/integrations/order-persistence.ts', { [db]: {
    ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } } });
  await assert.rejects(upsertSettlements('owner', [receipt(), receipt('receipt-2')]));
  assert.equal(inserts, 2);
  assert.equal(statements.filter(s => s === 'BEGIN').length, 1);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
  assert.equal(statements.at(-1), 'release');
});

test('split records for one batch/order retain distinct IDs and replay the same receipt', async () => {
  const saved = new Map();
  let commits = 0;
  const client = { query: async (sql, params = []) => {
    if (sql === 'COMMIT') commits++;
    if (sql.includes('SELECT id FROM orders')) return { rows: [{ id: 'order-uuid' }] };
    if (sql.includes('INSERT INTO settlements')) {
      assert.match(sql, /ON CONFLICT \(user_id, display_id\)/);
      assert.match(sql, /settlements\.order_id = EXCLUDED\.order_id/);
      const existed = saved.has(params[1]);
      saved.set(params[1], params[8]);
      return { rows: [{ id: params[1], display_id: params[1], is_insert: !existed }] };
    }
    return { rows: [] };
  }, release() {} };
  const { upsertSettlements } = load('src/lib/integrations/order-persistence.ts', { [db]: {
    ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } } });
  const split = [receipt('shipment-A', { netSettlement: 90 }), receipt('shipment-B', { netSettlement: 45 })];
  assert.equal((await upsertSettlements('owner', split)).inserted, 2);
  assert.equal((await upsertSettlements('owner', split)).updated, 2);
  assert.equal(saved.size, 2);
  assert.equal([...saved.values()].reduce((a, b) => a + b, 0), 135);
  assert.equal(commits, 2);
});

test('settlement API rejects fractional paise and invalid batches before persistence', async () => {
  let writes = 0;
  const route = load('src/app/api/settlements/route.ts', {
    [session]: { getSessionUserId: () => 'owner' }, [db]: {},
    '@/lib/integrations/order-persistence': { upsertSettlements: async () => { writes++; return {}; } },
  });
  for (const settlements of [[receipt('r', { netSettlement: 0.001 })], [receipt('r', { settlementDate: '2026-02-30' })],
    [receipt('r', { deductions: undefined })], [receipt(), receipt()], Array(1001).fill(receipt())]) {
    const response = await route.POST(new Request('https://app.example/api/settlements', {
      method: 'POST', body: JSON.stringify({ settlements }) }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('a supplier audit entry survives snapshot validation without losing the books', () => {
  const { emptyLedger } = load('src/domain/recycle-bin.ts');
  const { parseLedgerSnapshot } = load('src/domain/snapshot-validation.ts');
  const data = emptyLedger();
  data.auditLogs = ['SUPPLIER', 'SUPPLIER_PAYOUT'].map((entityType, i) => ({
    id: `audit-${i}`, timestamp: '2026-10-19T12:00:00Z', entityType, entityId: 'supplier',
    fieldName: 'amount', oldValue: '0', newValue: '100', modifiedBy: 'Operator' }));
  assert.equal(parseLedgerSnapshot(JSON.stringify({ version: 1, ownerId: 'owner', data }), 'owner').auditLogs.length, 2);
});

test('internal IDs remain distinct at the same clock time', () => {
  const { createRecordId } = load('src/domain/record-id.ts');
  const ids = Array.from({ length: 1000 }, () => createRecordId('ORD'));
  assert.equal(new Set(ids).size, 1000);
});

test('financial hydration includes records after the 2000 row boundary and rejects incomplete reads', async () => {
  const records = Array.from({ length: 2001 }, (_, i) => ({ id: `order-${i}` }));
  let failSecondPage = false;
  const { loadFinancialPages } = load('src/domain/load-financial-pages.ts', {}, { fetch: async url => {
    const offset = Number(new URL(url, 'https://app.example').searchParams.get('offset'));
    if (offset && failSecondPage) return Response.json({ error: 'offline' }, { status: 503 });
    return Response.json({ orders: records.slice(offset, offset + 2000) });
  } });
  assert.equal((await loadFinancialPages('/api/orders', 'orders')).length, 2001);
  failSecondPage = true;
  await assert.rejects(loadFinancialPages('/api/orders', 'orders'));
});

test('manual settlement does not enter state when persistence fails, and uses acknowledged ID on success', async () => {
  let index = 0;
  const slots = [];
  const react = { createContext: () => ({ Provider: 'Provider' }), useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn,
    useState(initial) { const n = index++; if (!(n in slots)) slots[n] = typeof initial === 'function' ? initial() : initial;
      return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value; }]; },
    useRef(initial) { const n = index++; return slots[n] ?? (slots[n] = { current: initial }); } };
  const backend = load.makeLedgerBackend({ orders: [order()] }, { owner: 'owner' });
  const store = load('src/domain/store.tsx', { react }, { window: {}, localStorage: { getItem: () => null, removeItem() {} },
    fetch: backend.fetch });
  const render = () => { index = 0; return store.PlatformProvider({ children: null }).props.value; };
  await render().refreshFromDatabase();
  backend.reject(true);
  await assert.rejects(render().addSettlement(receipt()));
  assert.equal(render().settlements.length, 0);
  assert.equal(backend.data.settlements.length, 0);
  backend.reject(false);
  await render().addSettlement(receipt());
  assert.equal(render().settlements[0].id, 'canonical');
  assert.equal(render().settlements[0].id, backend.data.settlements[0].id);
  assert.ok(backend.requests.some(request => request.url === '/api/ledger-records' && !request.init.method), 'saved books must be reloaded from canonical ledger');
});

test('actual settlement form retains failed input identity, prevents concurrent save, and invents no bank evidence', async () => {
  const sent = [], alerts = [], changes = [], slots = [];
  let cursor = 0, rejectFirst;
  const react = { useEffect() {}, useState(initial) { const i = cursor++;
    if (!(i in slots)) slots[i] = i === 0 || i === 3 ? true : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; changes.push(value); }];
  }, useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); } };
  const { calculateSettlementAging } = load('src/domain/profitability-engine.ts');
  const view = load('src/components/modules/settlements-view.tsx', {
    react, 'react-dom': { createPortal: node => node },
    '@/components/ui/data-table': { DataTable: 'DataTable' },
    '@/domain/store': { usePlatform: () => ({ selectedMarketplace: 'ALL', settlements: [], orders: [order({ marketplace: 'Amazon India' })],
      settlementAging: calculateSettlementAging([], [], '2026-10-19'),
      addSettlement: async row => { sent.push(row); if (sent.length === 1) await new Promise((resolve, reject) => { rejectFirst = reject; }); } }) },
  }, { document: { body: {} }, alert: message => alerts.push(message) });
  const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : !node || typeof node !== 'object' ? [] : [node, ...descendants(node.props?.children)];
  const render = () => { cursor = 0; return view.SettlementsView(); };
  const text = node => Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' ? node : node?.props ? text(node.props.children) : '';
  const field = labelText => {
    const nodes = descendants(render());
    const label = nodes.find(node => node.type === 'label' && text(node).trim() === labelText);
    assert.ok(label, 'label exists: ' + labelText);
    let control = descendants(label).find(node => node.props?.onChange);
    if (!control) {
      const parent = nodes.find(node => (Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).includes(label));
      control = descendants(parent).find(node => node.props?.onChange);
    }
    assert.ok(control, 'control exists: ' + labelText);
    return control;
  };
  const form = () => descendants(render()).find(node => node.props?.id === 'record-settlement-form');
  for (const label of ['Batch ID', 'Bank receipt date', 'Gross Payout (₹)', 'Net Bank Deposit Received (₹)']) {
    assert.equal(field(label).props.value, '', label + ' must start without invented source facts');
    assert.equal(field(label).props.required, true);
  }
  field('Batch ID').props.onChange({ target: { value: 'bank-batch-original' } });
  field('Bank receipt date').props.onChange({ target: { value: '2026-10-17' } });
  field('Gross Payout (₹)').props.onChange({ target: { value: '100.00' } });
  field('Net Bank Deposit Received (₹)').props.onChange({ target: { value: '100.00' } });
  changes.length = 0;
  const first = form().props.onSubmit({ preventDefault() {} });
  await form().props.onSubmit({ preventDefault() {} });
  assert.equal(sent.length, 1);
  rejectFirst(Error('Not saved'));
  await first;
  assert.equal(alerts.length, 1);
  assert.equal(changes.length, 0);
  await form().props.onSubmit({ preventDefault() {} });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].id, sent[1].id);
  assert.equal(sent[1].bankTxRef, undefined);
  assert.equal(sent[1].settlementDate, '2026-10-17');
  assert.equal(sent[1].settlementBatchId, 'bank-batch-original');
  assert.equal(sent[1].grossAmount, 100);
  assert.equal(sent[1].netSettlement, 100);
  assert.equal(sent[1].evidenceType, 'BANK_RECEIPT');
  assert.equal(sent[1].feeCoverage, 'PARTIAL');
  assert.equal(sent[1].reconciliationStatus, 'PENDING_RECON');
  assert.deepEqual(changes, [false]);
  descendants(render()).find(node => node.type === 'button' && text(node).trim() === 'Record Settlement').props.onClick();
  field('Bank reference').props.onChange({ target: { value: 'BANK-ORIGINAL-123' } });
  field('All order fee categories are covered by this evidence').props.onChange({ target: { checked: true } });
  await form().props.onSubmit({ preventDefault() {} });
  assert.equal(sent.length, 3);
  assert.notEqual(sent[2].id, sent[1].id, 'success releases the saved draft identity');
  assert.equal(sent[2].bankTxRef, 'BANK-ORIGINAL-123');
  assert.equal(sent[2].feeCoverage, 'COMPLETE');
  assert.equal(sent[2].reconciliationStatus, 'PENDING_RECON', 'a typed bank reference and matching totals do not replace bank matching');
});
