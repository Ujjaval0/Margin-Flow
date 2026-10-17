import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const db = '@/lib/db', session = '@/lib/security/session';
const merge = load('src/domain/sync-merge.ts');
const csv = load('src/domain/csv-auto-mapper.ts');
const snapshots = load('src/domain/snapshot-validation.ts');
const recovery = load('src/domain/recycle-bin.ts', {}, { structuredClone });
const engine = load('src/domain/profitability-engine.ts');
const item = (changes = {}) => ({ id: 'line', sku: 'SKU', productName: 'Item', quantity: 2, sellingPrice: 100, discount: 0, taxAmount: 0, snapshotUnitCost: 20, returnedQuantity: 0, ...changes });
const order = (id = 'one', changes = {}) => ({ id, channelOrderId: id, marketplace: 'WooCommerce', orderDate: '2026-10-01', status: 'DELIVERED', customerName: '', customerCity: '', customerState: '', shippingFeeCharged: 0, marketplaceChargesEstimate: 0, items: [item()], ...changes });
const product = (changes = {}) => ({ id: 'product', sku: 'SKU', name: 'Item', category: '', brand: '', supplierId: '', currentCostPrice: 20, costHistory: [], channelAliases: {}, active: true, stockQuantity: 5, ...changes });
const settlement = (id = 'receipt', changes = {}) => ({ id, marketplace: 'WooCommerce', orderId: 'one', settlementBatchId: id, settlementDate: '2026-10-10', grossAmount: 200, netSettlement: 50, deductions: [], tcsTdsTax: 0, reconciliationStatus: 'RECONCILED', ...changes });
const returned = (changes = {}) => ({ id: 'return', orderId: 'one', channelOrderId: 'one', marketplace: 'WooCommerce', returnDate: '2026-10-02', returnType: 'CUSTOMER_RETURN', returnReason: '', sku: 'SKU', quantity: 1, condition: 'SELLABLE', restockStatus: 'RESTOCKED', returnShippingCost: 0, customerReturnFee: 0, otherReturnCosts: 0, inventoryRecoveryValue: 0, lossAmount: 0, ...changes });
const claim = (id, changes = {}) => ({ id, orderId: 'one', marketplace: 'WooCommerce', claimType: 'FEE_DISPUTE', claimDate: '2026-10-02', amountClaimed: 5, amountRecovered: 0, status: 'FILED', ...changes });
const plain = value => JSON.parse(JSON.stringify(value));

test('F48: inserts do not shift indexes for subsequent updates or repeated batch identities', () => {
  const result = merge.mergeOrders([order('old')], [order('new'), order('old', { customerName: 'Updated' }), order('another'), order('new', { status: 'SHIPPED' })]);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows.find(row => row.id === 'old').customerName, 'Updated');
  assert.equal(result.rows.find(row => row.id === 'new').status, 'SHIPPED');
  assert.equal(result.added, 2);
  assert.equal(result.updated, 2);
});
test('F48: marketplace scopes external identities and immutable line costs survive updates', () => {
  const result = merge.mergeOrders([order('original')], [order('other-id', { channelOrderId: 'original', items: [item({ snapshotUnitCost: 99 })] }), order('flipkart', { channelOrderId: 'original', marketplace: 'Flipkart' })]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].id, 'original');
  assert.equal(result.rows[0].items[0].snapshotUnitCost, 20);
});
test('F48: separate receipts on an order remain distinct; a later update targets only its receipt', () => {
  const result = merge.mergeSettlements([settlement('a')], [settlement('b'), settlement('a', { netSettlement: 80 }), settlement('c', { marketplace: 'Flipkart' })]);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].netSettlement, 80);
});

const header = 'order_id,order_date,sku,quantity,unit_price,tax,marketplace,status';
test('F49: absent and malformed unit prices, quantities and dates fail without invented financials', () => {
  for (const row of ['x,2026-10-01,SKU,1,,0,WooCommerce,delivered', 'x,2026-02-30,SKU,1,100,0,WooCommerce,delivered', 'x,2026-10-01,SKU,1.5,100,0,WooCommerce,delivered', 'x,2026-10-01,SKU,1,invalid,0,WooCommerce,delivered']) {
    const result = csv.detectAndMapCsv(header + '\n' + row, []);
    assert.equal(result.orders.length, 0);
    assert.ok(result.errors.length);
  }
});
test('F49: a legitimate zero price and zero tax survive; dates and IDs are repeatable', () => {
  const input = header + '\nx,2026-10-01,SKU,1,0,0,WooCommerce,delivered';
  const first = csv.detectAndMapCsv(input, []), second = csv.detectAndMapCsv(input, []);
  assert.equal(first.errors.length, 0);
  assert.equal(first.orders[0].items[0].sellingPrice, 0);
  assert.equal(first.orders[0].items[0].taxAmount, 0);
  assert.deepEqual(plain(first.orders), plain(second.orders));
  assert.equal(first.orders[0].customerCity, '');
});
test('F49: multi-line orders group; repeated rows do not duplicate units; explicit same-SKU line IDs remain separate', () => {
  const input = header + ',line_item_id\nx,2026-10-01,SKU,1,100,0,WooCommerce,delivered,a\nx,2026-10-01,SKU,1,100,0,WooCommerce,delivered,a\nx,2026-10-01,SKU,1,90,0,WooCommerce,delivered,b';
  const result = csv.detectAndMapCsv(input, []);
  assert.equal(result.errors.length, 0);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].items.length, 2);
});
test('F49: conflicting duplicate lines and settlement payouts are rejected as sales', () => {
  assert.ok(csv.detectAndMapCsv(header + '\nx,2026-10-01,SKU,1,100,0,WooCommerce,delivered\nx,2026-10-01,SKU,2,90,0,WooCommerce,delivered', []).errors.length);
  const result = csv.detectAndMapCsv('sub_order_no,order_date,sku,quantity,net_payable,bank_utr\nx,2026-10-01,SKU,1,80,UTR', []);
  assert.equal(result.orders.length, 0);
  assert.ok(result.errors.length);
});
test('F49: historical imports use the cost valid on the order date', () => {
  const result = csv.detectAndMapCsv(header + '\nx,2026-10-01,SKU,1,100,0,WooCommerce,delivered', [product({ currentCostPrice: 99, costHistory: [{ validFrom: '2026-01-01', validTo: '2026-10-02', costPrice: 20 }, { validFrom: '2026-10-03', costPrice: 99 }] })]);
  assert.equal(result.orders[0].items[0].snapshotUnitCost, 20);
});
test('F49: multiple files consolidate lines but reject contradictory prices and quantities', () => {
  assert.equal(csv.consolidateCsvOrders([order(), order()]).length, 1);
  assert.throws(() => csv.consolidateCsvOrders([order(), order('one', { items: [item({ sellingPrice: 99 })] })]));
  assert.equal(csv.detectAndMapCsv('order_id,order_date,sku,unit_price\nx,2026-10-01,SKU,100', []).orders.length, 0);
  assert.ok(csv.detectAndMapCsv(header + '\n"unclosed', []).errors.length);
});

test('F52: aging includes partial balances, honors marketplace and recognizes no guessed fees', () => {
  const result = engine.calculateSettlementAging([order(), order('pending', { status: 'PENDING' })], [settlement(), settlement('foreign', { marketplace: 'Flipkart', netSettlement: 999 })], '2026-10-15');
  assert.equal(result.totalOutstandingAmount, 150);
  assert.equal(result.totalUnsettledOrders, 1);
  assert.equal(result.pending.orders[0].daysOutstanding, 14);
});
test('F52: aging uses return units and excludes future orders', () => {
  const result = engine.calculateSettlementAging([order(), order('future', { orderDate: '2026-11-01' })], [], '2026-10-15', [returned()]);
  assert.equal(result.totalOutstandingAmount, 100);
  assert.equal(result.totalUnsettledOrders, 1);
});
test('F52: business date observes India midnight and report channel matching is exact', () => {
  const scope = load('src/domain/report-scope.ts');
  assert.equal(scope.businessDate(new Date('2026-10-14T19:00:00Z')), '2026-10-15');
  const data = { ...recovery.emptyLedger(), orders: [order('a', { marketplace: 'Amazon India' }), order('w', { marketplace: 'Personal Website' })] };
  assert.equal(scope.scopeReport(data, 'Amazon').orders[0].id, 'a');
  assert.equal(scope.scopeReport(data, 'Website').orders[0].id, 'w');
});

const snapshot = data => JSON.stringify({ version: 1, ownerId: 'A', data });
test('F54: valid snapshots pass; foreign, partial, wrong-version and malformed domain data fail atomically', () => {
  const data = { ...recovery.emptyLedger(), products: [product()], orders: [order()] };
  assert.ok(snapshots.parseLedgerSnapshot(snapshot(data), 'A'));
  assert.equal(snapshots.parseLedgerSnapshot(snapshot(data), 'B'), null);
  assert.equal(snapshots.parseLedgerSnapshot('{"data":{"orders":[]}}', 'A'), null);
  for (const bad of [order('x', { items: null }), order('x', { status: 'FICTIONAL' }), order('x', { items: [item({ quantity: -1 })] }), order('x', { orderDate: '2026-02-30' })]) {
    assert.equal(snapshots.parseLedgerSnapshot(snapshot({ ...data, orders: [bad] }), 'A'), null);
  }
  assert.equal(snapshots.parseLedgerSnapshot(snapshot({ ...data, orders: [order(), order()] }), 'A'), null);
  assert.equal(snapshots.parseLedgerSnapshot(snapshot(data).replace('"version":1', '"version":2'), 'A'), null);
});
test('F54: prototype keys, numeric strings and oversized snapshots are rejected', () => {
  assert.equal(snapshots.parseLedgerSnapshot(snapshot({ ...recovery.emptyLedger(), products: [product({ currentCostPrice: '20' })] }), 'A'), null);
  assert.equal(snapshots.parseLedgerSnapshot(snapshot(recovery.emptyLedger()).replace('"data":{', '"data":{"__proto__":{},'), 'A'), null);
  assert.equal(snapshots.parseLedgerSnapshot(' '.repeat(10 * 1024 * 1024 + 1), 'A'), null);
});
test('F55: CSV round-trips commas, quotes, CR/LF and formula-like text safely', () => {
  const writer = load('src/lib/csv.ts');
  const serialized = writer.serializeCsv([['a,b', 'say "hi"', 'two\nlines', '=SUM(A1)', ' \t+cmd', '@evil', '-formula', -12.5]]);
  const parsed = csv.parseRawCsv(serialized)[0];
  assert.deepEqual(plain(parsed), ['a,b', 'say "hi"', 'two\nlines', "'=SUM(A1)", "' \t+cmd", "'@evil", "'-formula", '-12.5']);
});

test('F47: order archival recovers cascade records and exact inventory, including repeated-SKU lines', () => {
  const data = { ...recovery.emptyLedger(), products: [product()], orders: [order('one', { items: [item({ id: 'a', quantity: 1, returnedQuantity: 1 }), item({ id: 'b', quantity: 1 })] })], returns: [returned()], settlements: [settlement()], claims: [claim('claim')] };
  const patch = recovery.archiveRecords(data, 'orders', ['one']);
  const deleted = recovery.applyArchivePatch(data, patch);
  assert.equal(deleted.products[0].stockQuantity, 6);
  assert.equal(deleted.orders.length + deleted.returns.length + deleted.settlements.length + deleted.claims.length, 0);
  const restored = recovery.applyArchivePatch(deleted, plain(patch), true);
  assert.deepEqual(plain(restored), plain(data));
  assert.throws(() => recovery.applyArchivePatch(restored, patch, true));
});
test('F47: return archival removes only linked claims; restock reversal is exact and cannot silently clamp stock', () => {
  const data = { ...recovery.emptyLedger(), products: [product()], orders: [order('one', { items: [item({ returnedQuantity: 1 })], returnIds: ['return'], claimIds: ['linked', 'other'] })], returns: [returned({ claimId: 'linked' })], claims: [claim('linked', { returnId: 'return' }), claim('other')] };
  const patch = recovery.archiveRecords(data, 'returns', ['return']);
  const deleted = recovery.applyArchivePatch(data, patch);
  assert.equal(deleted.claims.length, 1);
  assert.equal(deleted.claims[0].id, 'other');
  assert.equal(deleted.products[0].stockQuantity, 4);
  assert.equal(deleted.orders[0].items[0].returnedQuantity, 0);
  const restored = recovery.applyArchivePatch(deleted, patch, true);
  assert.deepEqual(plain(restored.claims).sort((a,b) => a.id.localeCompare(b.id)), plain(data.claims).sort((a,b) => a.id.localeCompare(b.id)));
  assert.deepEqual(plain({ ...restored, claims: [] }), plain({ ...data, claims: [] }));
  assert.throws(() => recovery.archiveRecords({ ...data, products: [product({ stockQuantity: 0 })] }, 'returns', ['return']));
});
test('F47: later edits and SKU collisions prevent recovery from overwriting newer state', () => {
  const data = { ...recovery.emptyLedger(), products: [product()], orders: [order()] };
  const patch = recovery.archiveRecords(data, 'orders', ['one']);
  const deleted = recovery.applyArchivePatch(data, patch);
  assert.throws(() => recovery.applyArchivePatch({ ...deleted, products: [product({ stockQuantity: 100 })] }, patch, true));
  const productPatch = recovery.archiveRecords(data, 'products', ['product']);
  const withoutProduct = recovery.applyArchivePatch(data, productPatch);
  assert.throws(() => recovery.applyArchivePatch({ ...withoutProduct, products: [product({ id: 'new-id' })] }, productPatch, true));
});
test('F47: SQL scope, expiry, row lock and failed recovery keep receipt unconsumed', async () => {
  const statements = [];
  const client = { query: async (sql, params) => { statements.push([sql, params]); if (sql.includes('SELECT patch')) return { rows: [] }; return { rows: [] }; }, release() { statements.push(['release']); } };
  const route = load('src/app/api/recycle-bin/route.ts', { [session]: { getSessionUserId: () => 'A' }, [db]: { pool: { connect: async () => client } }, '@/lib/recycle-persistence': { persistArchivePatch: async () => { throw Error('Must not reach'); } } });
  const result = await route.POST(new Request('https://app.example/api/recycle-bin', { method: 'POST', body: JSON.stringify({ action: 'restore', id: '68b62e88-4ddc-4fef-a6ef-11567b9a7fdd' }) }));
  assert.equal(result.status, 409);
  const lookup = statements.find(([sql]) => sql.includes('SELECT patch'));
  assert.match(lookup[0], /user_id = \$2.*restored_at IS NULL.*7 days.*FOR UPDATE/);
  assert.equal(lookup[1][1], 'A');
  assert.ok(statements.some(([sql]) => sql === 'ROLLBACK'));
  assert.ok(!statements.some(([sql]) => sql.includes('SET restored_at') || sql === 'COMMIT'));
});
test('F47: archive write failure rolls back relational changes and never reports success', async () => {
  let changed = false;
  const statements = [];
  const client = { query: async sql => { statements.push(sql); if (sql.includes('INSERT INTO ledger_archives')) throw Error('offline'); return { rows: [] }; }, release() {} };
  const route = load('src/app/api/recycle-bin/route.ts', { [session]: { getSessionUserId: () => 'A' }, [db]: { pool: { connect: async () => client } }, '@/lib/recycle-persistence': { persistArchivePatch: async () => { changed = true; } } });
  const data = { ...recovery.emptyLedger(), products: [product()] };
  const response = await route.POST(new Request('https://app.example', { method: 'POST', body: JSON.stringify({ action: 'archive', type: 'products', ids: ['product'], patch: recovery.archiveRecords(data, 'products', ['product']) }) }));
  assert.equal(response.status, 409);
  assert.equal(changed, true);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
});
test('F47/F49: unauthenticated routes reject before database or parser work', async () => {
  for (const path of ['src/app/api/recycle-bin/route.ts', 'src/app/api/integrations/reports/upload/route.ts']) {
    const route = load(path, { [session]: { getSessionUserId: () => null }, [db]: { query: () => { throw Error('Database must not be reached'); } } });
    assert.equal((await route.POST(new Request('https://app.example', { method: 'POST', body: '{}' }))).status, 401);
  }
});
test('F49: actual upload ignores caller counts, commits orders and audit on the same connection', async () => {
  const statements = [], audits = [];
  const client = { query: async sql => { statements.push(sql); return { rows: [] }; }, release() {} };
  let fail = false;
  const route = load('src/app/api/integrations/reports/upload/route.ts', { [session]: { getSessionUserId: () => 'A' }, [db]: { ensureMarketplaceTables: async () => {}, query: async () => ({ rows: [] }), pool: { connect: async () => client } },
    '@/lib/integrations/order-persistence': { upsertOrders: async (owner, orders, tx) => { assert.equal(owner, 'A'); assert.equal(tx, client); return { inserted: 1, updated: 0, orderIds: ['canonical'], insertedOrderIds: ['canonical'] }; } },
    '@/lib/integrations/file-audit': { calculateFileHash: () => 'actual-source-hash', recordFileImportAudit: async (owner, params, content, tx) => { assert.equal(tx, client); audits.push(params); if (fail) throw Error('audit failed'); }, getFileImportHistory: async () => [] } });
  const request = () => { const form = new FormData(); form.append('file', new Blob([header + '\nx,2026-10-01,SKU,1,100,0,WooCommerce,delivered']), 'orders.csv'); form.append('ordersCreated', '999'); return new Request('https://app.example', { method: 'POST', body: form }); };
  let response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).orders[0].id, 'canonical');
  assert.equal(audits[0].ordersCreated, 1);
  assert.equal(audits[0].fileHash, 'actual-source-hash');
  assert.ok(statements.includes('COMMIT'));
  statements.length = 0; fail = true;
  response = await route.POST(request());
  assert.equal(response.status, 503);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
});
test('F57: landing acquisition routes to real login without a fabricated session or contact success', () => {
  const page = fs.readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /router.push\("\/login"\)/);
  assert.doesNotMatch(page, /dummyUser|localStorage.setItem|setContactSubmitted|handleContactSubmit/);
});

function hooks() {
  const slots = []; let cursor = 0;
  const react = { createContext: () => ({ Provider: 'Provider' }), useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); }, useMemo: fn => fn(), useCallback: fn => fn, useEffect() {} };
  return { react, render: fn => { cursor = 0; return fn(); } };
}
function providerHarness() {
  const harness = hooks(); let reject = false, owner = 'A';
  const alerts = [];
  const app = load('src/domain/store.tsx', { react: harness.react }, { structuredClone, window: {}, localStorage: { getItem: () => null }, alert: message => alerts.push(message), fetch: async (url, options) => {
    if (url === '/api/auth/me') return Response.json({ user: { id: owner } });
    if (url === '/api/recycle-bin?recovered=true') return Response.json({ success: true, recovered: { returns: [], claims: [], expenses: [] } });
    if (options?.method === 'POST') return Response.json({ success: !reject, orderIds: ['canonical'] }, { status: reject ? 503 : 200 });
    if (url.startsWith('/api/orders')) return Response.json({ orders: [order()] });
    if (url.startsWith('/api/products')) return Response.json({ products: [product()] });
    return Response.json({ settlements: [] });
  } });
  return { render: () => harness.render(() => app.PlatformProvider({ children: null }).props.value), reject: value => { reject = value; }, owner: value => { owner = value; }, alerts };
}
test('F54: actual provider leaves every collection untouched on a rejected snapshot and exports owner binding', async () => {
  const app = providerHarness(); await app.render().refreshFromDatabase();
  const before = app.render().exportLedgerSnapshot();
  const data = JSON.parse(before).data;
  assert.equal(JSON.parse(before).ownerId, 'A');
  assert.equal(app.render().importLedgerSnapshot(snapshot({ ...data, products: [product({ name: 'Must not apply' })], orders: [order('bad', { items: null })] })), false);
  assert.deepEqual(JSON.parse(app.render().exportLedgerSnapshot()).data, data);
  assert.equal(app.render().importLedgerSnapshot(before), true);
});
test('F48/F49: actual provider rejects failed saves, uses canonical IDs and deduplicates consecutive imports', async () => {
  const app = providerHarness(); await app.render().refreshFromDatabase();
  app.reject(true);
  await assert.rejects(app.render().syncExternalOrders([order('new')]));
  assert.equal(app.render().orders.length, 1);
  app.reject(false);
  const actions = app.render();
  await actions.syncExternalOrders([order('new')]);
  await actions.syncExternalOrders([order('new', { status: 'SHIPPED' })]);
  assert.equal(app.render().orders.length, 2);
  assert.equal(app.render().orders.find(row => row.channelOrderId === 'new').id, 'canonical');
  assert.equal(app.render().orders.find(row => row.channelOrderId === 'new').status, 'SHIPPED');
});
test('F22/F40: product creation waits for server acknowledgement before updating local state', async () => {
  const app = providerHarness(); await app.render().refreshFromDatabase();
  app.reject(true);
  await assert.rejects(app.render().addProduct(product({ id: 'new-product', sku: 'NEW-SKU' })), /Product could not be saved/);
  assert.deepEqual(plain(app.render().products.map(row => row.sku)), ['SKU']);
  app.reject(false);
  await app.render().addProduct(product({ id: 'new-product', sku: 'NEW-SKU' }));
  assert.deepEqual(plain(app.render().products.map(row => row.sku)), ['NEW-SKU', 'SKU']);
});
test('F47: failed archival leaves actual provider inventory and records untouched', async () => {
  const app = providerHarness(); await app.render().refreshFromDatabase();
  app.reject(true);
  app.render().deleteOrder('one');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.render().orders.length, 1);
  assert.equal(app.render().products[0].stockQuantity, 5);
  assert.equal(app.alerts.length, 1);
});
test('F51: restocking is idempotent and missing products remain pending', async () => {
  const app = providerHarness(); await app.render().refreshFromDatabase();
  const actions = app.render();
  actions.addReturn(returned({ id: 'pending-restock', quantity: 2, restockStatus: 'PENDING_RESTOCK' }));
  const before = app.render();
  assert.equal(before.products[0].stockQuantity, 5);
  const restock = before.restockReturn;
  restock('pending-restock');
  restock('pending-restock');
  const after = app.render();
  assert.equal(after.products[0].stockQuantity, 7);
  assert.equal(after.returns.find(record => record.id === 'pending-restock').restockStatus, 'RESTOCKED');

  after.addReturn(returned({ id: 'missing-product', sku: 'UNKNOWN', restockStatus: 'PENDING_RESTOCK' }));
  app.render().restockReturn('missing-product');
  const missing = app.render();
  assert.equal(missing.products[0].stockQuantity, 7);
  assert.equal(missing.returns.find(record => record.id === 'missing-product').restockStatus, 'PENDING_RESTOCK');
});
test('F47: canonical recovered records retain tenant-scoped identities and numeric amounts', async () => {
  const queries = [];
  const reader = load('src/lib/recovered-records.ts', { [db]: { query: async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('FROM return_records')) return { rows: [{ id: 'uuid', display_id: 'return', order_display_id: 'one', marketplace: 'WooCommerce', quantity: 1, return_shipping_cost: '5.25', return_date: '2026-10-02', claim_display_id: 'claim' }] };
    return { rows: [] };
  } } });
  const result = await reader.getRecoveredRecords('A');
  assert.equal(result.returns[0].id, 'return');
  assert.equal(result.returns[0].orderId, 'one');
  assert.equal(result.returns[0].claimId, 'claim');
  assert.equal(result.returns[0].returnShippingCost, 5.25);
  for (const [sql, params] of queries) { assert.match(sql, /user_id = \$1/); assert.equal(params[0], 'A'); }
});
test('F47: actual relational recovery refuses a conflicting stock balance before any write', async () => {
  const queries = [];
  const persistence = load('src/lib/recycle-persistence.ts', { [db]: {} });
  const data = { ...recovery.emptyLedger(), products: [product()], orders: [order()] };
  const patch = recovery.archiveRecords(data, 'orders', ['one']);
  const client = { query: async (sql, params) => { queries.push([sql, params]); return { rows: [{ stock_quantity: 999, deleted_at: null }] }; } };
  await assert.rejects(persistence.persistArchivePatch(client, 'A', patch, true));
  assert.equal(queries.length, 1);
  assert.match(queries[0][0], /user_id = \$1.*FOR UPDATE/);
  assert.equal(queries[0][1][0], 'A');
});
test('F52/F55: actual Reports view and both export tabs use only the scoped dataset', () => {
  const harness = hooks(); const downloads = [];
  const view = load('src/components/modules/reports-view.tsx', { react: harness.react,
    recharts: Object.fromEntries(['ResponsiveContainer','BarChart','Bar','XAxis','YAxis','Tooltip','Legend','CartesianGrid','AreaChart','Area','Cell'].map(name => [name, name])),
    '@/lib/csv': { downloadCsv: rows => downloads.push(plain(rows)) },
    '@/domain/store': { usePlatform: () => ({ selectedMarketplace: 'ALL', products: [], orders: [order('excluded')], returns: [], settlements: [], claims: [], reportDataset: { orders: [order()], returns: [], settlements: [], claims: [], expenses: [] } }) },
  });
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
  const render = () => harness.render(() => view.ReportsView());
  const buttons = () => nodes(render()).filter(node => node.type === 'button');
  const exportButton = () => buttons().find(node => nodes(node.props.children).some(child => child.props?.children === 'Export CSV'));
  exportButton().props.onClick();
  assert.equal(downloads[0].length, 2);
  assert.equal(downloads[0][1][1], 'SKU');
  assert.equal(Number(downloads[0][1][4]), 200);
  buttons().find(node => node.props.children === 'P&L Ledger').props.onClick();
  exportButton().props.onClick();
  assert.equal(Number(downloads[1].find(row => row[0] === 'Gross Sales')[2]), 200);
});
