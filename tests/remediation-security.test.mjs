import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
const require = createRequire(import.meta.url);
const load = require('./helpers/load-app.cjs');
const db = '@/lib/db';
const session = '@/lib/security/session';
const nextRequest = (body = {}, url = 'https://app.example/api/test') => new Request(url, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('OAuth-only accounts cannot obtain password sessions', async () => {
  let mapped = false;
  const route = load('src/app/api/auth/login/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
      signInWithPassword: async credentials => {
        assert.equal(credentials.email, 'victim@example.com');
        return { data: { user: null }, error: { message: 'Invalid login credentials' } };
      },
    } }) },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: async () => { mapped = true; } },
  });
  const response = await route.POST(nextRequest({ email: 'victim@example.com', password: 'anything' }));
  assert.equal(response.status, 401);
  assert.equal(mapped, false);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('password hashes verify safely and legacy hashes remain upgradeable', async () => {
  const auth = load('src/lib/auth-crypto.ts');
  const hash = await auth.hashPassword('a-long-password');
  assert.match(hash, /^pbkdf2-sha512:220000:/);
  assert.equal(await auth.verifyPassword('a-long-password', hash), true);
  assert.equal(await auth.verifyPassword('wrong', hash), false);
  assert.equal(await auth.verifyPassword('wrong', 'bad:hash'), false);
  const salt = '11'.repeat(16);
  const legacy = salt + ':' + crypto.pbkdf2Sync('old-pass', salt, 1000, 64, 'sha512').toString('hex');
  assert.equal(await auth.verifyPassword('old-pass', legacy), true);
});

test('OAuth callback rejects missing authorization codes before accessing Auth or account storage', async () => {
  const route = load('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: () => assert.fail('Missing code must not reach Auth') },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: () => assert.fail('No identity to map') },
  });
  const response = await route.GET(new Request('https://app.example/auth/callback'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://app.example/login?error=auth_failed');
});

test('OAuth callback refuses failed Supabase PKCE exchanges before mapping a merchant', async () => {
  const route = load('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
      exchangeCodeForSession: async code => {
        assert.equal(code, 'invalid-code');
        return { data: { user: null }, error: { message: 'Invalid code verifier' } };
      },
    } }) },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: () => assert.fail('Rejected Auth must not map an account') },
  });
  const response = await route.GET(new Request('https://app.example/auth/callback?code=invalid-code'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://app.example/login?error=auth_failed');
});

test('invoice extraction refuses unknown providers rather than reusing server keys', async () => {
  const route = load('src/app/api/extract-invoice-text/route.ts', {
    [session]: { getSessionUser: () => ({ sub: 'owner' }) },
  }, { process: { env: { NODE_ENV: 'test', GEMINI_API_KEY: 'synthetic-test-key' } } });
  const form = new FormData();
  form.append('file', new Blob(['invoice text']), 'invoice.txt');
  const request = new Request('https://app.example/api/extract-invoice-text', {
    method: 'POST', body: form, headers: { 'x-ai-provider': 'unrecognized' },
  });
  assert.equal((await route.POST(request)).status, 400);
});

test('public health executes only a constant query and hides internal errors', async () => {
  const queries = [];
  let fail = false;
  const route = load('src/app/api/health/db/route.ts', { [db]: { query: async sql => {
    queries.push(sql); if (fail) throw Error('secret connection details'); return { rows: [] };
  } } });
  assert.deepEqual(await (await route.GET()).json(), { status: 'healthy', connected: true });
  assert.deepEqual(queries, ['SELECT 1']);
  fail = true;
  const response = await route.GET();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|sampleProfitability|orders/);
});

test('merchant document object prefixes are distinct and contain no raw user paths', () => {
  const { documentObjectPath } = load('src/lib/security/document-storage.ts', {}, { process });
  assert.notEqual(documentObjectPath('merchant-a','file.pdf'), documentObjectPath('merchant-b','file.pdf'));
  assert.doesNotMatch(documentObjectPath('../../merchant','file.pdf'), /\.\./);
});

test('document stream cannot read another owner directory', async () => {
  let readPath;
  const route = load('src/app/api/documents/stream/route.ts', {
    [session]: { getSessionUser: () => ({ sub: 'merchant-b' }) },
    '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ createSignedUrl: async path => {
      readPath=path; return { data:null,error:{message:'not found'} };
    } }) } }) },
  }, { process:{env:{ NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'server-only-test-key' }} });
  const response = await route.GET(new Request('https://app.example/api/documents/stream?file=merchant-a-file.pdf'));
  assert.equal(response.status, 404);
  assert.ok(readPath.includes(crypto.createHash('sha256').update('merchant-b').digest('hex')));
});

test('anonymous AI and jobs requests are rejected before side effects', async () => {
  const mocks = { [session]: { getSessionUserId: () => null }, '@/domain/idp-pipeline': {},
    '@/lib/queue/queue-manager': { queueManager: {} }, '@/lib/queue/job-processors': {} };
  for (const name of ['idp-extract', 'ai-vault', 'jobs']) {
    const route = load('src/app/api/' + name + '/route.ts', mocks);
    assert.equal((await route.POST(nextRequest())).status, 401, name);
  }
});

test('job listing and cancellation enforce owner identity', async () => {
  let cancelled = false;
  const manager = { getJob: (_id, owner) => owner === 'merchant-a' ? ({ id: 'job-a', ownerId: 'merchant-a' }) : undefined, cancelJob: (_id, owner) => { if (owner === 'merchant-a') cancelled = true; return owner === 'merchant-a'; } };
  const route = load('src/app/api/jobs/[id]/route.ts', {
    [session]: { getSessionUserId: () => 'merchant-b' }, '@/lib/queue/queue-manager': { queueManager: manager },
  });
  const context = { params: Promise.resolve({ id: 'job-a' }) };
  assert.equal((await route.GET(new Request('https://app.example'), context)).status, 404);
  assert.equal((await route.DELETE(nextRequest(), context)).status, 404);
  assert.equal(cancelled, false);
});

test('Shopify domains reject suffix, path, credentials, scheme and IP tricks', () => {
  const { normalizeShopifyDomain } = load('src/lib/security/shopify-domain.ts');
  assert.equal(normalizeShopifyDomain('brand'), 'brand.myshopify.com');
  assert.equal(normalizeShopifyDomain('https://brand.myshopify.com/'), 'brand.myshopify.com');
  for (const domain of ['brand.myshopify.com.attacker.example', '127.0.0.1/.myshopify.com',
    'https://user@brand.myshopify.com', 'http://brand.myshopify.com', 'brand.myshopify.com/admin']) {
    assert.throws(() => normalizeShopifyDomain(domain), undefined, domain);
  }
});

test('outbound guard blocks private IPv4 and mapped IPv6 without network access', async () => {
  const guard = load('src/lib/security/ssrf-guard.ts');
  for (const url of ['https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]']) {
    assert.equal((await guard.validateSafeOutboundUrl(url)).isSafe, false, url);
  }
});

test('request limits reject chunked oversize and malformed JSON', async () => {
  const { readRequestBytes, readJsonBody } = load('src/lib/security/request-body.ts');
  await assert.rejects(readRequestBytes(nextRequest({ data: 'a'.repeat(100) }), 10), error => error.status === 413);
  await assert.rejects(readJsonBody(new Request('https://app.example', { method: 'POST', body: '{' })), error => error.status === 400);
});

test('outbound transport pins validated DNS and refuses redirects', async () => {
  let status = 200;
  let pinned;
  const transport = { request: (_url, options, callback) => {
    options.lookup('store.example', { all: true }, (_error, addresses) => { pinned = addresses[0].address; });
    const outgoing = new EventEmitter();
    outgoing.end = () => {
      const incoming = new PassThrough(); incoming.statusCode = status; incoming.headers = {};
      callback(incoming);
      if (status === 200) incoming.end('{"ok":true}');
    };
    return outgoing;
  } };
  const guard = load('src/lib/security/ssrf-guard.ts', {
    'dns/promises': { lookup: async () => [{ address: '8.8.8.8', family: 4 }] }, https: transport,
  });
  assert.deepEqual(await (await guard.safeOutboundFetch('https://store.example')).json(), { ok: true });
  assert.equal(pinned, '8.8.8.8');
  status = 302;
  await assert.rejects(guard.safeOutboundFetch('https://store.example'), /redirects are prohibited/);
});

test('processing budgets and cross-origin rejection run before provider calls', () => {
  const guard = load('src/lib/security/api-guard.ts');
  const request = nextRequest();
  for (let i = 0; i < 10; i++) assert.equal(guard.checkProcessingBudget(request, 'owner'), null);
  assert.equal(guard.checkProcessingBudget(request, 'owner').status, 429);
  const foreign = new Request('https://app.example', { method: 'POST', headers: { origin: 'https://attacker.example' } });
  assert.equal(guard.rejectCrossOrigin(foreign).status, 403);
});

test('webhook owner cannot be selected using user_id or a wrong routing key', async () => {
  const resolver = load('src/lib/security/webhook-connection.ts', {
    [db]: { query: async () => ({ rows: [{ id: 'c', user_id: 'owner', marketplace: 'Shopify', encrypted_credentials: 'opaque' }] }) },
    './encryption': { decryptPayload: () => ({ webhookRoutingKey: 'a'.repeat(64), webhookSecret: 'secret' }) },
  });
  assert.equal(await resolver.resolveWebhookConnection(new Request('https://app.example?user_id=victim'), 'shopify'), null);
  assert.equal(await resolver.resolveWebhookConnection(new Request('https://app.example?connection_id=c&routing_key=' + 'b'.repeat(64)), 'shopify'), null);
  const connection = await resolver.resolveWebhookConnection(new Request('https://app.example?connection_id=c&routing_key=' + 'a'.repeat(64)), 'shopify');
  assert.equal(connection.userId, 'owner');
});

test('failed order writes reject instead of counting imports', async () => {
  const persistence = load('src/lib/integrations/order-persistence.ts', {
    [db]: { ensureMarketplaceTables: async () => {}, pool: { connect: async () => { throw Error('offline'); } } },
  });
  await assert.rejects(persistence.upsertOrders('owner', [{ id: 'order-1', channelOrderId: 'source-1', marketplace: 'WooCommerce', orderDate: '2026-10-01', status: 'CONFIRMED', customerName: '', customerCity: '', customerState: '', shippingFeeCharged: 0, marketplaceChargesEstimate: 0, items: [{ id: 'line', sku: 'SKU', productName: 'Item', quantity: 1, sellingPrice: 100, discount: 0, taxAmount: 0, snapshotUnitCost: 0, returnedQuantity: 0 }] }]), /Order persistence failed/);
});

test('webhook failure rolls back the receipt and releases its transaction', async () => {
  const statements = [];
  const client = { query: async sql => { statements.push(sql); return { rows: sql.startsWith('SELECT id FROM marketplace_connections') ? [{ id: 'c' }] : [] }; }, release: () => statements.push('release') };
  const persistence = load('src/lib/integrations/webhook-persistence.ts', {
    [db]: { pool: { connect: async () => client } }, './order-persistence': { upsertOrders: async () => { throw Error('write failure'); } },
  });
  await assert.rejects(persistence.persistWebhookOrder({ id: 'c', userId: 'u' }, 'event', Buffer.from('{}'), {}));
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.some(sql => sql.startsWith('INSERT INTO webhook_receipts')));
  assert.equal(statements.at(-1), 'release');
});
