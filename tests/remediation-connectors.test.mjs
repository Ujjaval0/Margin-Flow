import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');

function connector(name, fetch, credentials = {}, connections = []) {
  const writes = [], checkpoints = [], saves = [];
  const transport = (url, options) => fetch(String(url), options || {});
  const internal = name !== 'generic/sync';
  const entry = internal ? 'src/lib/integrations/providers/' + name.replace('/', '-') + '.ts' : 'src/app/api/integrations/' + name + '/route.ts';
  const route = load(entry, {
    '@/lib/db': { query: async () => ({ rows: [] }), pool: { connect: async () => ({ query: async () => ({ rows: [] }), release() {} }) } },
    '@/lib/security/session': { getSessionUserId: () => 'tenant-A' },
    '@/lib/security/marketplace-vault': {
      getConnectionCredentials: async () => credentials,
      getConnectionsForUser: async () => connections,
      updateSyncStatus: async (...args) => checkpoints.push(args), recordSyncLog: async () => {},
      saveConnection: async (...args) => saves.push(args),
    },
    '@/lib/integrations/deferred-orders': { deferProviderOrder: async () => {}, resolveDeferredOrders: async () => {} },
    '@/lib/integrations/connection-orders': { upsertOrders: async (owner, rows) => { writes.push({ owner, rows }); return { inserted: rows.length, updated: 0 }; } },
    '@/lib/integrations/provider-auth': {
      ...load('src/lib/integrations/provider-auth.ts', { '@/lib/db': {} }, { fetch: transport }),
      renewConnectionToken: async (owner, id, renew) => { const updated = await renew(credentials); saves.push([owner, { id, credentials: updated }]); return updated; },
      persistTokenUpdate: async (owner, id, previous, update) => saves.push([owner, { id, credentials: { ...previous, ...update } }]),
    },
    '@/lib/integrations/order-persistence': {
      upsertOrders: async (owner, rows) => { writes.push({ owner, rows }); return { inserted: rows.length, updated: 0 }; },
      upsertSettlements: async (owner, rows) => { writes.push({ owner, rows }); return { inserted: rows.length, updated: 0 }; },
    },
    '@/lib/security/ssrf-guard': { safeOutboundFetch: transport, validateSafeOutboundUrl: async url => ({ isSafe: true, normalizedUrl: url }) },
    '@/lib/security/rate-limiter': { amazonSpApiLimiter: { consume: () => ({ allowed: true }) }, marketplaceSyncLimiter: { consume: () => ({ allowed: true }) } },
  }, { fetch: transport });
  return { writes, checkpoints, saves, post: body => internal ? route.runSync('tenant-A', { action: name.endsWith('finances') ? 'fetch_finances' : 'fetch_orders', ...body }) : route.POST(new Request('https://app.example/api/sync', { method: 'POST', body: JSON.stringify(body) })) };
}
const amazonCredentials = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
const amazonOrder = id => ({ orderId: id, createdTime: '2026-10-14T10:00:00Z', fulfillment: { fulfillmentStatus: 'SHIPPED' }, proceeds: { grandTotal: { amount: '200', currencyCode: 'INR' } }, orderItems: ['1','2'].map(amazonItem) });
function amazonItem(id) { return { orderItemId: id, product: { sellerSku: 'sku' }, quantityOrdered: 2, proceeds: { breakdowns: [{ type: 'ITEM', subtotal: { amount: '100', currencyCode: 'INR' } }] } }; }

test('Amazon pending prices produce a truthful partial result without blocking a valid order or advancing beyond the window', async () => {
  const c = connector('amazon/sync', async raw => raw.includes('/auth/') ? Response.json({ access_token: 'access' })
    : Response.json({ orders: [amazonOrder('ready'), { orderId: 'pending', createdTime: '2026-10-01T00:00:00Z', fulfillment: { fulfillmentStatus: 'PENDING' }, orderItems: [] }] }), amazonCredentials);
  const end = '2026-10-02T00:00:00.000Z';
  const response = await c.post({ action: 'fetch_orders', connectionId: 'conn_owned', syncWindowStart: '2026-10-01T00:00:00Z', syncWindowEnd: end });
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.status, 'partial'); assert.equal(body.fetchedCount, 2); assert.equal(body.skippedCount, 1);
  assert.equal(c.writes[0].rows.length, 1); assert.equal(c.checkpoints[0][3].lastSyncedAt, end);
});

test('Amazon finance split events have distinct repeatable identities across pages and replays', async () => {
  const shipment = amount => ({ AmazonOrderId: 'A', PostedDate: '2026-10-19T10:00:00Z',
    ShipmentItemList: [{ ItemChargeList: [{ ChargeType: 'Principal', ChargeAmount: { CurrencyAmount: amount, CurrencyCode: 'INR' } }] }] });
  const c = connector('amazon/finances', async raw => new URL(raw).hostname === 'api.amazon.com'
    ? Response.json({ access_token: 'access' })
    : Response.json({ payload: { FinancialEvents: { ShipmentEventList: [shipment(90), shipment(45)] } } }), amazonCredentials);
  assert.equal((await c.post({})).status, 200);
  assert.equal((await c.post({})).status, 200);
  const first = c.writes[0].rows;
  assert.equal(new Set(first.map(row => row.id)).size, 2);
  assert.equal(first.reduce((total, row) => total + row.netSettlement, 0), 135);
  assert.deepEqual(first.map(row => row.id), c.writes[1].rows.map(row => row.id));
});

test('Amazon exhausts order and item tokens before a single tenant-owned write', async () => {
  const urls = [];
  const c = connector('amazon/sync', async raw => {
    const url = new URL(raw); urls.push(url);
    if (url.hostname === 'api.amazon.com') return Response.json({ access_token: 'access' });
    return Response.json({ orders: [amazonOrder(url.searchParams.has('paginationToken') ? 'B' : 'A')], ...(!url.searchParams.has('paginationToken') ? { pagination: { nextToken: 'orders-2' } } : {}) });
  }, amazonCredentials, [{ marketplace: 'Amazon India', syncCheckpoints: { orders: { lastSyncedAt: '2026-10-13T00:00:00Z' }, finances: { lastSyncedAt: '2026-10-15T00:00:00Z' } } }]);
  const response = await c.post({ action: 'fetch_orders' });
  assert.equal(response.status, 200, await response.text());
  assert.equal(c.writes.length, 1);
  assert.equal(c.writes[0].owner, 'tenant-A');
  assert.equal(c.writes[0].rows.length, 2);
  assert.equal(c.writes[0].rows[0].items.length, 2);
  assert.equal(c.writes[0].rows[0].items[0].sellingPrice, 50);
  assert.equal(urls.find(u => u.pathname === '/orders/2026-01-01/orders').searchParams.get('lastUpdatedAfter'), '2026-10-11T00:00:00.000Z');
  assert.equal(c.checkpoints[0][3].stream, 'orders');
});

for (const failure of ['empty', 'malformed']) test(`Amazon ${failure} item evidence never manufactures or persists an order`, async () => {
  const order = amazonOrder('A'); order.orderItems = failure === 'empty' ? [] : [{ orderItemId: '1' }];
  const c = connector('amazon/sync', async url => url.includes('/auth/') ? Response.json({ access_token: 'access' }) : Response.json({ orders: [order] }), amazonCredentials);
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 502);
  assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

const shopifyOrder = id => ({ id: 'gid://shopify/Order/'+id, legacyResourceId: String(id), name: '#'+id, currencyCode: 'INR', createdAt: '2026-10-01T00:00:00Z', taxesIncluded: false, totalPriceSet: { shopMoney: { amount: '100', currencyCode: 'INR' } }, displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'UNFULFILLED', lineItems: { nodes: [{ id: 'gid://shopify/LineItem/'+id, sku: 'SKU', quantity: 1, originalUnitPriceSet: { shopMoney: { amount: '100', currencyCode: 'INR' } } }], pageInfo: { hasNextPage: false } }, shippingLines: { nodes: [], pageInfo: { hasNextPage: false } } });
test('Shopify exhausts GraphQL cursors on the supported version and preserves REST identities', async () => {
  const calls = [];
  const c = connector('shopify/sync', async (url, options) => {
    const variables = JSON.parse(options.body).variables; calls.push(variables);
    assert.equal(new URL(url).pathname, '/admin/api/2026-10/graphql.json');
    assert.equal(options.headers['X-Shopify-Access-Token'], 'secret');
    return Response.json({ data: { orders: { nodes: [shopifyOrder(calls.length)], pageInfo: { hasNextPage: calls.length === 1, endCursor: 'second' } } } });
  }, { shopDomain: 'demo.myshopify.com', accessToken: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 200);
  assert.equal(calls[1].after, 'second'); assert.equal(c.writes[0].rows.length, 2);
  assert.equal(c.writes[0].rows[0].items[0].id, 'ITEM-SHP-1-1');
});
test('Shopify rejects an attacker-controlled store domain before forwarding a token', async () => {
  let calls = 0;
  const c = connector('shopify/sync', async () => { calls++; return Response.json({}); }, { shopDomain: 'demo.myshopify.com.attacker.example', accessToken: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 502);
  assert.equal(calls, 0); assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

test('WooCommerce exhausts numbered pages with secrets only in Authorization', async () => {
  const urls = [];
  const c = connector('woocommerce/sync', async (raw, options) => {
    const url = new URL(raw); urls.push(url);
    assert.equal(url.searchParams.has('consumer_secret'), false);
    assert.equal(url.searchParams.has('consumer_key'), false);
    assert.match(options.headers.Authorization, /^Basic /);
    return Response.json([{ id: urls.length, currency: 'INR', date_created: '2026-10-01T00:00:00Z', total: '100', line_items: [{ id: urls.length, product_id: 1, sku: 'SKU', quantity: 1, price: '100', subtotal: '100', total: '100', total_tax: '0' }] }], { headers: { 'x-wp-totalpages': '2' } });
  }, { storeUrl: 'https://store.example', consumerKey: 'key', consumerSecret: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 200);
  assert.equal(urls[1].searchParams.get('page'), '2'); assert.equal(c.writes[0].rows.length, 2);
});

test('a later WooCommerce page failure does not persist or advance the checkpoint', async () => {
  let calls = 0;
  const c = connector('woocommerce/sync', async () => ++calls === 1 ? Response.json([], { headers: { 'x-wp-totalpages': '2' } }) : new Response('', { status: 503 }), { storeUrl: 'https://store.example', consumerKey: 'key', consumerSecret: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 503);
  assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

test('custom connector follows documented next URL and rejects incomplete cursor-only results', async () => {
  let calls = 0;
  const c = connector('generic/sync', async () => Response.json({ orders: [{ id: ++calls, currency: 'INR', orderDate: '2026-10-01', sku: 'SKU', quantity: 1, unitPrice: 100 }], ...(calls === 1 ? { nextPageUrl: '?page=2' } : {}) }));
  assert.equal((await c.post({ action: 'fetch_orders', endpointUrl: 'https://store.example/orders' })).status, 200);
  assert.equal(c.writes[0].rows.length, 2);
  const incomplete = connector('generic/sync', async () => Response.json({ orders: [], hasMore: true, nextCursor: '2' }));
  assert.equal((await incomplete.post({ action: 'fetch_orders', endpointUrl: 'https://store.example/orders' })).status, 500);
  assert.equal(incomplete.writes.length, 0);
});

for (const status of [404, 500, 200]) test(`custom verification rejects ${status === 200 ? 'unusable JSON' : status}`, async () => {
  const c = connector('generic/sync', async () => Response.json({ message: 'not orders' }, { status }));
  assert.equal((await c.post({ action: 'test_connection', endpointUrl: 'https://store.example/orders' })).status, 502);
});

test('Amazon token exchange alone does not verify Orders or Finances access', async () => {
  for (const route of ['amazon/sync', 'amazon/finances']) {
    const c = connector(route, async url => url.includes('/auth/') ? Response.json({ access_token: 'access' }) : new Response('', { status: 403 }), amazonCredentials);
    assert.equal((await c.post({ action: 'test_connection' })).status, 403);
    assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
  }
});

test('Flipkart uses shipment contract, follows pages and preserves sibling order items', async () => {
  const calls = [];
  const c = connector('flipkart/sync', async (raw, options) => {
    const url = new URL(raw); calls.push({ url, options });
    if (url.pathname.includes('/oauth/token')) {
      assert.equal(url.searchParams.has('client_secret'), false); assert.match(options.headers.Authorization, /^Basic /);
      return Response.json({ access_token: 'access' });
    }
    assert.equal(url.pathname, '/sellers/v3/shipments/filter/');
    if (options.method === 'GET') return Response.json({ shipments: [{ orderItems: [{ orderId: 'A', orderDate: '2026-10-01T00:00:00Z', quantity: 1, orderItemId: '2', sku: 'B', priceComponents: { sellingPrice: 20, customerPrice: 20, totalPrice: 20 } }] }], hasMore: false });
    const body = JSON.parse(options.body);
    assert.equal(body.pagination.pageSize, 20); assert.ok(body.filter.orderDate.from);
    return Response.json(body.filter.type === 'preDispatch' ? { shipments: [{ orderItems: [{ orderId: 'A', orderDate: '2026-10-01T00:00:00Z', quantity: 1, orderItemId: '1', sku: 'A', priceComponents: { sellingPrice: 10, customerPrice: 10, totalPrice: 10 } }] }], hasMore: true, nextPageUrl: '/sellers/v3/shipments/filter/?page=2' } : { shipments: [], hasMore: false });
  }, { appId: 'id', appSecret: 'secret' });
  const response = await c.post({ action: 'fetch_orders' });
  assert.equal(response.status, 200, await response.text());
  assert.equal(c.writes[0].rows.length, 1); assert.equal(c.writes[0].rows[0].items.length, 2);
  assert.equal(calls.filter(call => call.options.method === 'GET' && !call.url.pathname.includes('oauth')).length, 1);
});

test('pagination rejects repeated cursors and a bounded incomplete run explicitly', async () => {
  const { collectPages } = load('src/lib/integrations/provider-pagination.ts');
  await assert.rejects(collectPages('https://store.example/orders', async () => Response.json({}), () => ({ records: [], next: 'https://store.example/orders' })), /incomplete/);
  let page = 0;
  await assert.rejects(collectPages('https://store.example/orders', async () => Response.json({}), () => ({ records: [], next: `https://store.example/orders?page=${++page}` })), /incomplete/);
  assert.equal(page, 250);
});

test('OAuth state requires durable storage and atomically binds owner, client, redirect and expiry', async () => {
  const states = new Map(); const binding = { clientId: 'client', redirectUri: 'https://app.example/callback' };
  const oauth = load('src/lib/security/oauth-state.ts', { '@/lib/db': { query: async (sql, args) => {
    if (sql.startsWith('INSERT')) { states.set(args[0], args); return { rows: [] }; }
    assert.match(sql, /DELETE FROM oauth_states[\s\S]*expires_at > NOW\(\)[\s\S]*RETURNING user_id/);
    const row = states.get(args[0]);
    if (!row || row[1] !== args[2] || row[2] !== args[1] || row[4] !== args[3] || row[5] !== args[4] || row[3] <= new Date()) return { rows: [] };
    states.delete(args[0]); return { rows: [{ user_id: row[1] }] };
  } } });
  const state = await oauth.createOAuthState('A', 'Flipkart', 600000, binding);
  for (const [owner, bound] of [['B', binding], ['A', { ...binding, clientId: 'other' }], ['A', { ...binding, redirectUri: 'https://other.example' }]]) {
    assert.equal((await oauth.verifyAndConsumeOAuthState(state, 'Flipkart', owner, bound)).valid, false);
  }
  const results = await Promise.all([oauth.verifyAndConsumeOAuthState(state, 'Flipkart', 'A', binding), oauth.verifyAndConsumeOAuthState(state, 'Flipkart', 'A', binding)]);
  assert.equal(results.filter(result => result.valid).length, 1);
  const offline = load('src/lib/security/oauth-state.ts', { '@/lib/db': { query: async () => { throw Error('offline'); } } });
  await assert.rejects(offline.createOAuthState('A', 'Flipkart', 600000, binding), /offline/);
  await assert.rejects(offline.verifyAndConsumeOAuthState(state, 'Flipkart', 'A', binding), /offline/);
});

test('Finances pagination reads its own checkpoint and cannot advance the Orders stream', async () => {
  const urls = [];
  const c = connector('amazon/finances', async raw => {
    if (raw.includes('/auth/')) return Response.json({ access_token: 'access' });
    const url = new URL(raw); urls.push(url);
    return Response.json({ payload: { FinancialEvents: { ShipmentEventList: [] }, ...(urls.length === 1 ? { NextToken: 'finances-page-2' } : {}) } });
  }, amazonCredentials, [{ marketplace: 'Amazon India', syncCheckpoints: { orders: { lastSyncedAt: '2026-10-14T00:00:00Z' }, finances: { lastSyncedAt: '2026-10-12T00:00:00Z' } } }]);
  assert.equal((await c.post({ action: 'fetch_finances' })).status, 200);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get('PostedAfter'), '2026-10-10T00:00:00.000Z');
  assert.equal(c.checkpoints[0][3].stream, 'finances');
});

test('checkpoint updates persist independent streams under the owner and one active connection guard', async () => {
  const statements = [];
  const vault = load('src/lib/security/marketplace-vault.ts', {
    '@/lib/db': {
      ensureMarketplaceTables: async () => {},
      query: async (sql, args) => { statements.push({ sql, args }); return { rows: [], rowCount: 1 }; },
    },
    './encryption': { encryptPayload: () => '', decryptPayload: () => ({}) },
    './webhook-connection': { webhookPath: () => '' },
  });
  await vault.updateSyncStatus('tenant-A', 'Amazon India', 'SUCCEEDED', {
    stream: 'orders', lastSyncedAt: '2026-10-15T00:00:00.000Z', lastSyncCursor: null,
  });
  await vault.updateSyncStatus('tenant-A', 'Amazon India', 'SUCCEEDED', {
    stream: 'finances', lastSyncedAt: '2026-10-14T00:00:00.000Z', lastSyncCursor: 'finance-next',
  });

  assert.equal(statements.length, 2);
  for (const { sql, args } of statements) {
    assert.match(sql, /jsonb_set\(sync_checkpoints, ARRAY\[\$7::text\], \$8::jsonb, true\)/);
    assert.match(sql, /WHERE user_id = \$5 AND marketplace = \$6 AND is_active = true/);
    assert.match(sql, /COUNT\(\*\).*is_active = true\) = 1/);
    assert.equal(args[4], 'tenant-A');
    assert.equal(args[5], 'Amazon India');
  }
  assert.equal(statements[0].args[6], 'orders');
  assert.deepEqual(JSON.parse(statements[0].args[7]), { lastSyncedAt: '2026-10-15T00:00:00.000Z', cursor: null });
  assert.equal(statements[1].args[6], 'finances');
  assert.deepEqual(JSON.parse(statements[1].args[7]), { lastSyncedAt: '2026-10-14T00:00:00.000Z', cursor: 'finance-next' });
});

test('Flipkart refresh persists rotated tokens before using the new access token', async () => {
  const c = connector('flipkart/sync', async (url, options) => {
    if (url.includes('/oauth/token')) return Response.json({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 1200 });
    assert.equal(c.saves.length, 1);
    assert.equal(options.headers.Authorization, 'Bearer new-access');
    return Response.json({ shipments: [], hasMore: false });
  }, { clientId: 'client', clientSecret: 'secret', refreshToken: 'old-refresh' }, [{ id: 'conn_flipkart', marketplace: 'Flipkart', authType: 'OAUTH2', sellerId: 'seller' }]);
  assert.equal((await c.post({ action: 'test_connection' })).status, 200);
  assert.equal(c.saves[0][1].credentials.refreshToken, 'rotated-refresh');
  assert.equal(c.saves[0][1].id, 'conn_flipkart');
});

test('Flipkart OAuth callback binds the session and uses the server app through HTTP Basic', async () => {
  const config = { clientId: 'registered-client', clientSecret: 'server-secret', redirectUri: 'https://app.example/api/integrations/flipkart/callback' };
  let exchanged = false;
  const route = load('src/app/api/integrations/flipkart/callback/route.ts', {
    '@/lib/security/session': { getSessionUserId: () => 'A' },
    './flipkart-oauth': { flipkartOAuthConfig: () => config },
    '@/lib/integrations/connection-service': { providerOperation: async () => Response.json({ success: true }) },
    './connection-service': { providerOperation: async () => Response.json({ success: true }) },
    '@/lib/security/oauth-state': { verifyAndConsumeOAuthState: async (state, marketplace, owner, binding) => {
      assert.equal(owner, 'A'); assert.equal(binding.redirectUri, config.redirectUri); return { valid: true, userId: 'A' };
    } },
    '@/lib/security/marketplace-vault': { getConnectionsForUser: async () => [], saveConnection: async () => {}, recordSyncLog: async () => {} },
    '@/lib/db': {},
  }, { fetch: async (raw, options) => {
    const url = new URL(raw); assert.equal(url.searchParams.get('grant_type'), 'authorization_code');
    assert.equal(url.searchParams.has('client_secret'), false);
    assert.equal(Buffer.from(options.headers.Authorization.slice(6), 'base64').toString(), config.clientId+':'+config.clientSecret);
    assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri); exchanged = true;
    return Response.json({ access_token: 'access', refresh_token: 'refresh' });
  } });
  const result = await route.GET(new Request('https://app.example/callback?code=code&state=state&clientSecret=attacker&redirectUri=https://attacker.example'));
  assert.equal(result.status, 307); assert.equal(exchanged, true);
});

test('an unbound continuation or single-order finance fetch cannot advance a global checkpoint', async () => {
  for (const body of [{ cursor: 'external-cursor' }, { orderId: 'single-order' }]) {
    const c = connector('amazon/finances', async url => url.includes('/auth/') ? Response.json({ access_token: 'access' }) : Response.json({ payload: { FinancialEvents: { ShipmentEventList: [] } } }), amazonCredentials);
    assert.equal((await c.post({ action: 'fetch_finances', ...body })).status, 200);
    assert.equal(c.checkpoints.length, 0);
  }
});

function connectionScreen(fetch) {
  const slots = [], effects = []; let index = 0, initialRender = true;
  const react = {
    useState: initial => {
      const current = index++;
      if (!(current in slots)) slots[current] = initial;
      return [slots[current], value => { slots[current] = typeof value === 'function' ? value(slots[current]) : value; }];
    },
    useMemo: fn => fn(), useEffect: fn => { if (initialRender) effects.push(fn); },
  };
  const component = load('src/components/modules/webhook-simulator.tsx', {
    react, 'react-dom': { createPortal: node => node },
    '@/domain/store': { usePlatform: () => ({ orders: [], products: [], syncExternalOrders: () => ({ added: 0, updated: 0 }) }) },
    '@/components/modals/csv-import-modal': { CsvImportModal: () => null },
  }, { fetch, window: { location: { origin: 'https://app.example' }, addEventListener() {}, removeEventListener() {} }, document: { body: {} }, localStorage: { getItem: () => null, setItem() {} } });
  const render = () => { index = 0; const tree = component.WebhookSimulatorView(); initialRender = false; return tree; };
  const tree = render(); effects.forEach(fn => fn());
  return { tree, render };
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

test('connection screen reuses vaulted credentials after reload without fetching secrets', async () => {
  const requests = [];
  const ui = connectionScreen(async (url, options) => {
    requests.push({ url, options });
    if (url === '/api/integrations/connections') return Response.json({ success: true, connections: [{ id: 'conn_shopify', marketplace: 'Shopify', isActive: true, credentialStatus: 'VERIFIED' }] });
    return Response.json({ success: true, domain: 'demo.myshopify.com' });
  });
  await new Promise(resolve => setImmediate(resolve));
  const tree = ui.render();
  const verify = nodes(tree, node => node.type === 'button' && node.props.title === 'Verify API connection with third-party credentials')[0];
  await verify.props.onClick();
  assert.equal(requests[1].url, '/api/integrations/shopify/sync');
  assert.equal(JSON.parse(requests[1].options.body).action, 'test_connection');
  assert.equal(JSON.parse(requests[1].options.body).accessToken, undefined);
});

test('connection screen does not mark a new connection active when the vault rejects its save', async () => {
  let saves = 0;
  const ui = connectionScreen(async (url, options) => {
    if (url === '/api/integrations/connections') {
      if (options?.method === 'POST') { saves++; return Response.json({ success: false }, { status: 503 }); }
      return Response.json({ success: true, connections: [] });
    }
    return Response.json({ success: true, domain: 'demo.myshopify.com' });
  });
  await new Promise(resolve => setImmediate(resolve));
  nodes(ui.render(), node => node.type === 'button' && node.props.children === 'Configure')[0].props.onClick();
  const inputs = nodes(ui.render(), node => node.type === 'input');
  inputs.find(node => node.props.placeholder?.includes('myshopify')).props.onChange({ target: { value: 'demo.myshopify.com' } });
  inputs.find(node => node.props.placeholder?.includes('shpat_')).props.onChange({ target: { value: 'secret' } });
  const testButton = nodes(ui.render(), node => node.type === 'button' && node.props.onClick?.name === 'handleTestShopifyConnection')[0];
  await testButton.props.onClick();
  assert.equal(saves, 1);
  const badges = nodes(ui.render(), node => node.type === 'button' && node.props.title?.startsWith('Channel is'));
  assert.ok(badges[0].props.title.includes('inactive'));
});
