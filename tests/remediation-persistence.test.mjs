import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const db = '@/lib/db';
const session = '@/lib/security/session';

test('tenant caches reject unowned and wrongly labelled snapshots without deleting legacy data', () => {
  const cache = load('src/domain/tenant-cache.ts');
  const memory = new Map([[cache.LEDGER_STORAGE_KEY, JSON.stringify({ data: { orders: ['private'] } })]]);
  const storage = { getItem: key => memory.get(key) ?? null };
  assert.equal(cache.readTenantSnapshot(storage, 'B'), null);
  assert.ok(memory.has(cache.LEDGER_STORAGE_KEY));
  memory.set(cache.tenantLedgerKey('B'), JSON.stringify({ version: 1, ownerId: 'A', data: { orders: ['private'] } }));
  assert.equal(cache.readTenantSnapshot(storage, 'B'), null);
  assert.notEqual(cache.tenantLedgerKey('A'), cache.tenantLedgerKey('B'));
});

test('actual provider clears tenant A on switch to an empty tenant B', async () => {
  let hookIndex = 0;
  const slots = [];
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState: initial => {
      const index = hookIndex++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef: initial => { const index = hookIndex++; return slots[index] ?? (slots[index] = { current: initial }); },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
  };
  let owner = 'A';
  let authenticated = true;
  const order = { id: 'A-order', channelOrderId: '1', marketplace: 'WooCommerce', orderDate: '2026-10-15', status: 'DELIVERED', items: [], shippingFeeCharged: 0, marketplaceChargesEstimate: 0 };
  const provider = load('src/domain/store.tsx', { react }, {
    window: {}, localStorage: { getItem: () => null },
    fetch: async url => {
      if (url === '/api/auth/me') return Response.json({ user: { id: owner } }, { status: authenticated ? 200 : 401 });
      if (url === '/api/ledger-records') return Response.json({ success: true, data: { ...load('src/domain/recycle-bin.ts').emptyLedger(), orders: owner === 'A' ? [order] : [] } });
      if (url.startsWith('/api/orders')) return Response.json({ orders: owner === 'A' ? [order] : [] });
      if (url.startsWith('/api/products')) return Response.json({ products: [] });
      return Response.json({ settlements: [] });
    },
  });
  const render = () => { hookIndex = 0; return provider.PlatformProvider({ children: null }).props.value; };
  assert.equal(render().orders.length, 0);
  await render().refreshFromDatabase();
  assert.equal(render().orders[0].id, 'A-order');
  owner = 'B';
  await render().refreshFromDatabase();
  assert.equal(render().orders.length, 0);
  assert.equal(render().currentUser.id, 'B');
  authenticated = false;
  await render().refreshFromDatabase();
  assert.equal(render().orders.length, 0);
});

test('core read APIs return errors during outages instead of successful empty ledgers', async () => {
  for (const name of ['orders', 'products', 'settlements']) {
    const route = load('src/app/api/' + name + '/route.ts', {
      [session]: { getSessionUserId: () => 'A' },
      [db]: { ensureMarketplaceTables: async () => {}, query: async () => { throw Error('secret database details'); } },
    });
    const request = { nextUrl: new URL('https://app.example/api/' + name), headers: new Headers() };
    const response = await route.GET(request);
    assert.equal(response.status, 503, name);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.doesNotMatch(JSON.stringify(body), /secret|offline_fallback/);
  }
});

test('internal-service account lookup rejects missing accounts and database outages', async () => {
  let offline = false;
  const route = load('src/app/api/auth/me/route.ts', {
    [session]: { getSessionUser: () => ({ sub: 'deleted-account', sid: 'internal-service' }) },
    [db]: { query: async () => { if (offline) throw Error('offline'); return { rows: [] }; } },
  });
  assert.equal((await route.GET(new Request('https://app.example'))).status, 401);
  offline = true;
  assert.equal((await route.GET(new Request('https://app.example'))).status, 503);
});

test('catalog batches roll back if a later product write fails', async () => {
  const statements = [];
  let writes = 0;
  const client = { query: async sql => {
    statements.push(sql);
    if (sql.includes('INSERT INTO products')) { if (++writes === 2) throw Error('constraint failure'); return { rows: [{ is_insert: true }] }; }
    return { rows: [] };
  }, release: () => statements.push('release') };
  const route = load('src/app/api/products/route.ts', {
    [session]: { getSessionUserId: () => 'A' },
    [db]: { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } },
  }, { console: { ...console, error: () => {} } });
  const response = await route.POST(new Request('https://app.example', { method: 'POST', body: JSON.stringify({ products: [{ sku: 'a' }, { sku: 'b' }] }) }));
  assert.equal(response.status, 500);
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.includes('COMMIT'));
  assert.equal(statements.at(-1), 'release');
});

test('vault save and disconnect never report memory success during a database outage', async () => {
  const vault = load('src/lib/security/marketplace-vault.ts', {
    [db]: { ensureMarketplaceTables: async () => {}, query: async () => { throw Error('offline'); } },
  });
  await assert.rejects(vault.saveConnection('A', { marketplace: 'Shopify', credentials: { accessToken: 'synthetic' } }));
  await assert.rejects(vault.disconnectConnection('A', 'Shopify'));
});

test('fresh setup applies required migrations without seeding demo data', () => {
  const sql = fs.readFileSync(new URL('../database/00_run_all.sql', import.meta.url), 'utf8');
  assert.match(sql, /ON_ERROR_STOP on/);
  for (const file of ['13_multitenant_isolation.sql', '14_webhook_receipts.sql', '15_tenant_document_and_identity.sql']) assert.ok(sql.includes(file));
  assert.doesNotMatch(sql, /\\i[r ]+06_seed\.sql/);
  const source = fs.readFileSync(new URL('../src/lib/db.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
});

test('OCR scopes catalog matching and commits document fields with owner metadata', async () => {
  const lookups = [];
  const statements = [];
  let failField = false;
  const client = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('INSERT INTO ai_staged_documents')) return { rows: [{ id: 'document-uuid', display_id: 'doc-1' }] };
    if (failField && sql.includes('INSERT INTO ai_staged_fields')) throw Error('field write failed');
    return { rows: [] };
  }, release: () => statements.push(['release']) };
  const extractor = load('src/lib/ocr/extractor.ts', {
    [db]: { query: async (sql, params) => { lookups.push([sql, params]); return { rows: [] }; }, pool: { connect: async () => client } },
    '@/domain/ocr-engine': { processDocumentOCR: () => ({ extractedData: { sku: { value: 'SKU-1' } }, fileType: 'INVOICE', status: 'STAGED_NEEDS_REVIEW' }) },
    '@/domain/idp-pipeline': {},
  });
  await extractor.processAndStageDocument('tenant-A', 'invoice.txt', '/private', Buffer.from('Invoice contents'));
  assert.match(lookups[0][0], /user_id = \$1/);
  assert.equal(lookups[0][1][0], 'tenant-A');
  const inserted = statements.find(([sql]) => sql.includes('INSERT INTO ai_staged_documents'));
  assert.equal(inserted[1].at(-1), 'tenant-A');
  assert.ok(statements.some(([sql]) => sql === 'COMMIT'));
  statements.length = 0;
  failField = true;
  await assert.rejects(extractor.processAndStageDocument('tenant-A', 'invoice.txt', '/private', Buffer.from('Invoice contents')), /Document persistence failed/);
  assert.ok(statements.some(([sql]) => sql === 'ROLLBACK'));
  assert.ok(!statements.some(([sql]) => sql === 'COMMIT'));
});

test('same-SKU order lines remain separate and removed source lines are reconciled', async () => {
  const items = new Map();
  const client = { query: async (sql, params = []) => {
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 'uuid', display_id: 'order-1', is_insert: true }] };
    if (sql.includes('SELECT id, sku, snapshot_unit_cost FROM order_items')) {
      assert.match(sql, /display_id = \$2/);
      return { rows: items.has(params[1]) ? [{ id: params[1], snapshot_unit_cost: items.get(params[1]).cost }] : [] };
    }
    if (sql.includes('INSERT INTO order_items')) items.set(params[0], { quantity: params[4], price: params[5], cost: params[8] });
    if (sql.includes('UPDATE order_items')) items.set(params[8], { ...items.get(params[8]), quantity: params[1], price: params[2] });
    if (sql.includes('DELETE FROM order_items')) for (const id of items.keys()) if (!params[1].includes(id)) items.delete(id);
    return { rows: [] };
  }, release: () => {} };
  const persistence = load('src/lib/integrations/order-persistence.ts', { [db]: { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } } });
  const line = (id, quantity, price, cost = 10) => ({ id, sku: 'SAME', productName: 'Item', quantity, sellingPrice: price, discount: 0, taxAmount: 0, snapshotUnitCost: cost, returnedQuantity: 0 });
  const order = { id: 'order-1', channelOrderId: 'channel-1', marketplace: 'WooCommerce', orderDate: '2026-10-01', status: 'CONFIRMED', customerName: '', customerCity: '', customerState: '', shippingFeeCharged: 0, marketplaceChargesEstimate: 0, items: [line('line-1', 1, 100), line('line-2', 2, 80)] };
  await persistence.upsertOrders('tenant-A', [order]);
  assert.equal(items.size, 2);
  assert.equal(items.get('line-1').quantity, 1);
  assert.equal(items.get('line-2').price, 80);
  await persistence.upsertOrders('tenant-A', [{ ...order, items: [line('line-2', 3, 80, 99)] }]);
  assert.equal(items.size, 1);
  assert.equal(items.get('line-2').quantity, 3);
  assert.equal(items.get('line-2').cost, 10);
});
