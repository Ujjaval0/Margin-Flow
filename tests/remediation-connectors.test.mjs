import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');

function connector(name, fetch, credentials = {}, connections = []) {
  const writes = [], checkpoints = [], saves = [];
  const route = load(`src/app/api/integrations/${name}/route.ts`, {
    '@/lib/security/session': { getSessionUserId: () => 'tenant-A' },
    '@/lib/security/marketplace-vault': {
      getConnectionCredentials: async () => credentials,
      getConnectionsForUser: async () => connections,
      updateSyncStatus: async (...args) => checkpoints.push(args), recordSyncLog: async () => {},
      saveConnection: async (...args) => saves.push(args),
    },
    '@/lib/integrations/order-persistence': {
      upsertOrders: async (owner, rows) => { writes.push({ owner, rows }); return { inserted: rows.length, updated: 0 }; },
      upsertSettlements: async (owner, rows) => { writes.push({ owner, rows }); return { inserted: rows.length, updated: 0 }; },
    },
    '@/lib/security/ssrf-guard': { safeOutboundFetch: fetch, validateSafeOutboundUrl: async url => ({ isSafe: true, normalizedUrl: url }) },
    '@/lib/security/rate-limiter': { amazonSpApiLimiter: { consume: () => ({ allowed: true }) }, marketplaceSyncLimiter: { consume: () => ({ allowed: true }) } },
  }, { fetch });
  return { writes, checkpoints, saves, post: body => route.POST(new Request('https://app.example/api/sync', { method: 'POST', body: JSON.stringify(body) })) };
}
const amazonCredentials = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
const amazonOrder = id => ({ AmazonOrderId: id, PurchaseDate: '2026-10-14T10:00:00Z', OrderStatus: 'Shipped' });
const amazonItem = id => ({ OrderItemId: id, SellerSKU: 'sku', QuantityOrdered: 2, ItemPrice: { Amount: '100' } });

test('Amazon exhausts order and item tokens before a single tenant-owned write', async () => {
  const urls = [];
  const c = connector('amazon/sync', async raw => {
    const url = new URL(raw); urls.push(url);
    if (url.hostname === 'api.amazon.com') return Response.json({ access_token: 'access' });
    if (url.pathname.endsWith('/orderItems')) return Response.json({ payload: { OrderItems: [amazonItem(url.searchParams.has('NextToken') ? '2' : '1')], ...(!url.searchParams.has('NextToken') ? { NextToken: 'items-2' } : {}) } });
    return Response.json({ payload: { Orders: [amazonOrder(url.searchParams.has('NextToken') ? 'B' : 'A')], ...(!url.searchParams.has('NextToken') ? { NextToken: 'orders-2' } : {}) } });
  }, amazonCredentials, [{ marketplace: 'Amazon India', syncCheckpoints: { orders: { lastSyncedAt: '2026-10-13T00:00:00Z' }, finances: { lastSyncedAt: '2026-10-15T00:00:00Z' } } }]);
  const response = await c.post({ action: 'fetch_orders' });
  assert.equal(response.status, 200, await response.text());
  assert.equal(c.writes.length, 1);
  assert.equal(c.writes[0].owner, 'tenant-A');
  assert.equal(c.writes[0].rows.length, 2);
  assert.equal(c.writes[0].rows[0].items.length, 2);
  assert.equal(c.writes[0].rows[0].items[0].sellingPrice, 50);
  assert.equal(urls.find(u => u.pathname === '/orders/v0/orders').searchParams.get('LastUpdatedAfter'), '2026-10-11T00:00:00.000Z');
  assert.equal(c.checkpoints[0][3].stream, 'orders');
});

for (const failure of ['http', 'empty', 'malformed']) test(`Amazon ${failure} item response never manufactures or persists an order`, async () => {
  const c = connector('amazon/sync', async url => url.includes('/auth/') ? Response.json({ access_token: 'access' }) :
    url.includes('/orderItems') ? failure === 'http' ? new Response('', { status: 429 }) : Response.json({ payload: failure === 'empty' ? { OrderItems: [] } : {} }) :
    Response.json({ payload: { Orders: [amazonOrder('A')] } }), amazonCredentials);
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 502);
  assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

test('Shopify follows same-origin Link pages on the supported version', async () => {
  const urls = [];
  const c = connector('shopify/sync', async url => {
    urls.push(url);
    return Response.json({ orders: [{ id: urls.length, line_items: [] }] }, { headers: urls.length === 1 ? { link: '<https://demo.myshopify.com/admin/api/2026-10/orders.json?page_info=second>; rel="next"' } : {} });
  }, { shopDomain: 'demo.myshopify.com', accessToken: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 200);
  assert.equal(urls.length, 2); assert.equal(c.writes[0].rows.length, 2);
});

test('Shopify never forwards tokens to a foreign next-page origin', async () => {
  let calls = 0;
  const c = connector('shopify/sync', async () => { calls++; return Response.json({ orders: [] }, { headers: { link: '<https://attacker.example/admin/api/2026-10/orders.json>; rel="next"' } }); }, { shopDomain: 'demo.myshopify.com', accessToken: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 500);
  assert.equal(calls, 1); assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

test('WooCommerce exhausts numbered pages with secrets only in Authorization', async () => {
  const urls = [];
  const c = connector('woocommerce/sync', async (raw, options) => {
    const url = new URL(raw); urls.push(url);
    assert.equal(url.searchParams.has('consumer_secret'), false);
    assert.equal(url.searchParams.has('consumer_key'), false);
    assert.match(options.headers.Authorization, /^Basic /);
    return Response.json([{ id: urls.length, line_items: [] }], { headers: { 'x-wp-totalpages': '2' } });
  }, { storeUrl: 'https://store.example', consumerKey: 'key', consumerSecret: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 200);
  assert.equal(urls[1].searchParams.get('page'), '2'); assert.equal(c.writes[0].rows.length, 2);
});

test('a later WooCommerce page failure does not persist or advance the checkpoint', async () => {
  let calls = 0;
  const c = connector('woocommerce/sync', async () => ++calls === 1 ? Response.json([], { headers: { 'x-wp-totalpages': '2' } }) : new Response('', { status: 503 }), { storeUrl: 'https://store.example', consumerKey: 'key', consumerSecret: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 500);
  assert.equal(c.writes.length, 0); assert.equal(c.checkpoints.length, 0);
});

test('custom connector follows documented next URL and rejects incomplete cursor-only results', async () => {
  let calls = 0;
  const c = connector('generic/sync', async () => Response.json({ orders: [{ id: ++calls }], ...(calls === 1 ? { nextPageUrl: '?page=2' } : {}) }));
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
    assert.equal((await c.post({ action: 'test_connection' })).status, 502);
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
    if (options.method === 'GET') return Response.json({ shipments: [{ orderItems: [{ orderId: 'A', orderItemId: '2', sku: 'B', priceComponents: { sellingPrice: 20 } }] }], hasMore: false });
    const body = JSON.parse(options.body);
    assert.equal(body.pagination.pageSize, 20); assert.ok(body.filter.orderDate.from);
    return Response.json(body.filter.type === 'preDispatch' ? { shipments: [{ orderItems: [{ orderId: 'A', orderItemId: '1', sku: 'A', priceComponents: { sellingPrice: 10 } }] }], hasMore: true, nextPageUrl: '/sellers/v3/shipments/filter/?page=2' } : { shipments: [], hasMore: false });
  }, { appId: 'id', appSecret: 'secret' });
  assert.equal((await c.post({ action: 'fetch_orders' })).status, 200);
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
  }, { clientId: 'client', clientSecret: 'secret', refreshToken: 'old-refresh' }, [{ marketplace: 'Flipkart', authType: 'OAUTH2', sellerId: 'seller' }]);
  assert.equal((await c.post({ action: 'test_connection' })).status, 200);
  assert.equal(c.saves[0][1].credentials.refreshToken, 'rotated-refresh');
  assert.equal(c.saves[0][1].sellerId, 'seller');
});

test('Flipkart OAuth callback binds the session and ignores caller credential/redirect overrides', async () => {
  const config = { clientId: 'registered-client', clientSecret: 'server-secret', redirectUri: 'https://app.example/api/integrations/flipkart/callback' };
  let exchanged = false;
  const route = load('src/app/api/integrations/flipkart/callback/route.ts', {
    '@/lib/security/session': { getSessionUserId: () => 'A' },
    '@/lib/integrations/flipkart-oauth': { flipkartOAuthConfig: () => config },
    '@/lib/security/oauth-state': { verifyAndConsumeOAuthState: async (state, marketplace, owner, binding) => {
      assert.equal(owner, 'A'); assert.equal(binding.redirectUri, config.redirectUri);
      return { valid: true, userId: 'A' };
    } },
    '@/lib/security/marketplace-vault': { saveConnection: async () => {}, recordSyncLog: async () => {} },
  }, { fetch: async (url, options) => {
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('client_id'), config.clientId); assert.equal(body.get('client_secret'), config.clientSecret);
    assert.equal(body.get('redirect_uri'), config.redirectUri); exchanged = true;
    return Response.json({ access_token: 'access', refresh_token: 'refresh' });
  } });
  const result = await route.POST(new Request('https://app.example/callback', { method: 'POST', body: JSON.stringify({ code: 'code', state: 'state', clientId: 'other', clientSecret: 'attacker', redirectUri: 'https://attacker.example' }) }));
  assert.equal(result.status, 200); assert.equal(exchanged, true);
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
    if (url === '/api/integrations/connections') return Response.json({ success: true, connections: [{ marketplace: 'Shopify', isActive: true }] });
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
