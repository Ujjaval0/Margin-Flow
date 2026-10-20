import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const pg = new PGlite({ extensions: { pgcrypto } });
const environment = { process: { env: { NODE_ENV: 'test', ENCRYPTION_MASTER_KEY: 'e'.repeat(64) } } };
const database = { query: (sql, args) => pg.query(sql, args), ensureMarketplaceTables: async () => {},
  pool: { connect: async () => ({ query: (sql, args) => pg.query(sql, args), release() {} }) } };
let owner, other, connection, vault, queue, providerCalls = 0, responseStatus = 200, webhookWrites = 0;
after(async () => pg.close());

test('stable vault keys survive isolated processes; missing keys fail closed', () => {
  const a = load('src/lib/security/encryption.ts', {}, environment);
  const b = load('src/lib/security/encryption.ts', {}, environment);
  const encrypted = a.encryptPayload({ secret: 'synthetic-secret' });
  assert.equal(b.decryptPayload(encrypted).secret, 'synthetic-secret');
  assert.doesNotMatch(encrypted, /synthetic-secret/);
  assert.throws(() => load('src/lib/security/encryption.ts').encryptPayload({ secret: 'x' }), /ENCRYPTION_MASTER_KEY/);
});

test('credential inputs reject unsupported platforms and fields and retain blank saved values', () => {
  const { connectionInput } = load('src/lib/integrations/connection-input.ts');
  for (const platform of ['Magento', 'Meesho', 'Myntra']) assert.throws(() => connectionInput(platform, { apiKey: 'x' }), /unavailable/);
  assert.throws(() => connectionInput('WooCommerce', { storeUrl: 'http://store.example', consumerKey: 'x', consumerSecret: 'y' }), /HTTPS/);
  assert.throws(() => connectionInput('Shopify', { shopDomain: 'shop', accessToken: 'x', verifiedAt: 'fake' }), /Unsupported/);
  const updated = connectionInput('Shopify', { shopDomain: '', accessToken: '' }, { shopDomain: 'shop.myshopify.com', accessToken: 'saved' });
  assert.equal(updated.credentials.accessToken, 'saved');
  const rotated = connectionInput('Shopify', { clientSecret: 'new' }, { shopDomain: 'shop.myshopify.com', clientId: 'id', clientSecret: 'old', accessToken: 'old-token', webhookSecret: 'old' });
  assert.equal(rotated.credentials.accessToken, undefined); assert.equal(rotated.credentials.webhookSecret, 'new');
});

test('additive migrations, owner-scoped vault updates, and durable jobs execute in PostgreSQL', async () => {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const name of fs.readdirSync('production-supabase/migrations').filter(name => name.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync('production-supabase/migrations/' + name, 'utf8'));
  // The upgrade is safe to reapply and has no destructive reset step.
  await pg.exec(fs.readFileSync('production-supabase/migrations/20261020000300_store_connection_reliability.sql', 'utf8'));
  const users = await pg.query(`WITH u AS (INSERT INTO auth.users VALUES(gen_random_uuid()),(gen_random_uuid()) RETURNING id)
    INSERT INTO user_accounts(id,auth_user_id,name,email,account_type) SELECT gen_random_uuid(),id,'Fixture',id::text||'@example.test','BRAND_OWNER' FROM u RETURNING id`);
  [owner, other] = users.rows.map(row => row.id);
  vault = load('src/lib/security/marketplace-vault.ts', { '@/lib/db': database }, environment);
  connection = await vault.saveConnection(owner, { marketplace: 'WooCommerce', sellerId: 'https://store.example', credentials: {
    storeUrl: 'https://store.example', consumerKey: 'fixture-key', consumerSecret: 'fixture-secret', webhookSecret: 'signing', verifiedAt: new Date().toISOString(),
  } });
  assert.doesNotMatch(JSON.stringify(connection), /fixture-secret|fixture-key|encrypted_credentials|signing/);
  assert.equal(await vault.getConnectionById(other, connection.id), null);
  assert.equal(await vault.getConnectionCredentials(other, 'WooCommerce', '', connection.id), null);
  const before = connection;
  connection = await vault.saveConnection(owner, { marketplace: 'WooCommerce', connectionId: before.id, expectedUpdatedAt: before.updatedAt,
    credentials: { storeUrl: before.storeUrl, consumerKey: 'fixture-key', consumerSecret: 'new-secret', verifiedAt: new Date().toISOString() } });
  assert.equal(connection.id, before.id); assert.equal(connection.webhookPath, before.webhookPath);
  await assert.rejects(vault.saveConnection(other, { marketplace: 'WooCommerce', connectionId: connection.id, credentials: {} }), /unavailable/);
  await assert.rejects(pg.query(`INSERT INTO integration_tasks(user_id,connection_id,kind,dedupe_key) VALUES($1,$2,'ORDERS','cross-tenant')`, [other, connection.id]), /foreign key/);
  const policies = await pg.query(`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('integration_tasks','provider_deferred_orders')`);
  assert.ok(policies.rows.every(row => row.relrowsecurity));
  queue = load('src/lib/integrations/task-queue.ts', {
    '@/lib/db': database, '@/lib/security/marketplace-vault': vault, 'next/server': { after() {} },
    './connection-service': { providerOperation: async (_platform, who, body) => {
      assert.equal(who, owner); assert.equal(body.connectionId, connection.id); providerCalls++;
      return Response.json({ success: responseStatus === 200, fetchedCount: 1, importedCount: 1 }, { status: responseStatus });
    } },
    './webhook-persistence': { persistWebhookOrder: async () => { webhookWrites++; } },
  }, environment);
  const taskId = await queue.enqueueStoreSync(owner, connection.id);
  assert.equal(await queue.enqueueStoreSync(owner, connection.id), taskId);
  await queue.runIntegrationTasks({ ownerId: other, limit: 1 }); assert.equal(providerCalls, 0);
  await queue.runIntegrationTasks({ ownerId: owner, limit: 1 }); assert.equal(providerCalls, 1);
  let task = (await pg.query('SELECT * FROM integration_tasks WHERE id=$1', [taskId])).rows[0];
  assert.equal(task.status, 'QUEUED'); assert.equal(task.result.status, 'running'); assert.equal(task.attempts, 0);
  assert.doesNotMatch(JSON.stringify(task.payload), /secret|token|fixture-key/);
  responseStatus = 413; await queue.runIntegrationTasks({ ownerId: owner, limit: 1 });
  task = (await pg.query('SELECT * FROM integration_tasks WHERE id=$1', [taskId])).rows[0];
  assert.ok(task.payload.windowEnd); assert.equal(task.payload.pendingEnds.length, 1);
  responseStatus = 503; await queue.runIntegrationTasks({ ownerId: owner, limit: 1 });
  task = (await pg.query('SELECT * FROM integration_tasks WHERE id=$1', [taskId])).rows[0];
  assert.equal(task.attempts, 1); assert.equal(task.status, 'QUEUED'); assert.ok(task.available_at > new Date());
  await pg.query("UPDATE integration_tasks SET status='PROCESSING',locked_at=NOW()-interval '10 minutes',available_at=NOW() WHERE id=$1", [taskId]);
  responseStatus = 401; await queue.runIntegrationTasks({ ownerId: owner, limit: 1 });
  assert.equal((await vault.getConnectionById(owner, connection.id)).credentialStatus, 'REAUTH_REQUIRED');
  assert.equal((await pg.query('SELECT status FROM integration_tasks WHERE id=$1', [taskId])).rows[0].status, 'REAUTH_REQUIRED');
  const signed = Buffer.from('{"synthetic":"payload"}');
  assert.equal((await queue.enqueueWebhook({ id: connection.id, userId: owner }, 'delivery', signed, { id: 'order' })).isDuplicate, false);
  assert.equal((await queue.enqueueWebhook({ id: connection.id, userId: owner }, 'delivery', signed, { id: 'order' })).isDuplicate, true);
  await assert.rejects(queue.enqueueWebhook({ id: connection.id, userId: owner }, 'delivery', Buffer.from('different'), {}), /conflicts/);
  let webhook = (await pg.query("SELECT * FROM integration_tasks WHERE kind='WEBHOOK'")).rows[0];
  assert.doesNotMatch(webhook.encrypted_payload, /synthetic/); assert.equal(webhook.payload.rawBody, undefined);
  await queue.runIntegrationTasks({ ownerId: owner, limit: 1 }); assert.equal(webhookWrites, 1);
  webhook = (await pg.query("SELECT * FROM integration_tasks WHERE kind='WEBHOOK'")).rows[0];
  assert.equal(webhook.status, 'COMPLETED'); assert.equal(webhook.encrypted_payload, null);
  await vault.disconnectConnection(owner, 'WooCommerce', undefined, connection.id);
  assert.equal(await vault.getConnectionById(owner, connection.id), null);
  assert.equal((await pg.query('SELECT encrypted_credentials FROM marketplace_connections WHERE id=$1', [connection.id])).rows[0].encrypted_credentials, '');
});

test('the HTTP sync boundary binds saved credentials to the authenticated owner and strips internal flags', async () => {
  let operations = 0, captured;
  const boundary = load('src/lib/integrations/integration-route.ts', {
    '@/lib/security/session': { getSessionUserId: async () => 'owner' },
    '@/lib/security/marketplace-vault': { getConnectionById: async (who, id) => who === 'owner' && id === 'conn_owned' ? { marketplace: 'Shopify' } : null },
    './task-queue': { enqueueStoreSync: async () => 'task', dispatchIntegrationTasks() {} },
  });
  const post = body => boundary.integrationRoute(new Request('https://app.example/api/sync', { method: 'POST', body: JSON.stringify(body) }), 'Shopify', async (who, body) => {
    assert.equal(who, 'owner'); operations++; captured = body; return Response.json({ success: true });
  }, 'fetch_orders');
  assert.equal((await post({ action: 'fetch_orders' })).status, 400);
  assert.equal((await post({ action: 'fetch_orders', connectionId: 'conn_foreign' })).status, 404);
  assert.equal(operations, 0);
  assert.equal((await post({ action: 'test_connection', connectionId: 'conn_owned', accessToken: 'attacker', verificationOnly: true, reconciliation: true, syncWindowStart: 'bad' })).status, 200);
  assert.equal(captured.accessToken, undefined); assert.equal(captured.verificationOnly, false); assert.equal(captured.reconciliation, false);
  assert.equal((await post({ action: 'fetch_orders', connectionId: 'conn_owned', background: true })).status, 202);
});

test('Shopify callback signatures reject duplicate parameters and tampering', () => {
  const { validShopifyCallback } = load('src/lib/integrations/oauth-routes.ts', { '@/lib/db': {} });
  const params = new URLSearchParams({ code: 'code', shop: 'fixture.myshopify.com', state: 'state', timestamp: '1' });
  params.set('hmac', crypto.createHmac('sha256', 'secret').update(params.toString().replaceAll('%2E', '.')).digest('hex'));
  assert.equal(validShopifyCallback(params, 'secret'), true);
  params.append('shop', 'attacker.myshopify.com'); assert.equal(validShopifyCallback(params, 'secret'), false);
});

test('a rejected credential replacement leaves the saved store untouched and never echoes provider secrets', async () => {
  let writes = 0, candidate;
  const service = load('src/lib/integrations/connection-service.ts', {
    '@/lib/security/marketplace-vault': {
      getConnectionById: async () => ({ id: 'conn_owned', marketplace: 'WooCommerce', storeUrl: 'https://store.example', updatedAt: '2026-10-20T00:00:00Z' }),
      getConnectionCredentials: async () => ({ storeUrl: 'https://store.example', consumerKey: 'saved-key', consumerSecret: 'working-secret' }),
      saveConnection: async () => { writes++; },
    },
    './providers/woocommerce-sync': { runSync: async (who, body) => {
      assert.equal(who, 'owner'); assert.equal(body.verificationOnly, true); candidate = body;
      return Response.json({ success: false, error: 'provider echoed bad-secret' }, { status: 401 });
    } },
  });
  await assert.rejects(service.verifyAndSaveConnection('owner', { marketplace: 'WooCommerce', connectionId: 'conn_owned', credentials: { consumerKey: '', consumerSecret: 'bad-secret' } }), error => {
    assert.doesNotMatch(error.message, /bad-secret|working-secret|saved-key/); return true;
  });
  assert.equal(candidate.consumerKey, 'saved-key'); assert.equal(candidate.consumerSecret, 'bad-secret'); assert.equal(writes, 0);
});

test('native WooCommerce setup probes cannot enqueue orders; Shopify requires a valid store-bound signature', async () => {
  let writes = 0;
  const mocks = {
    '@/lib/security/webhook-connection': { resolveWebhookConnection: async () => ({ id: 'conn_owned', userId: 'owner', shopDomain: 'shop.myshopify.com', secret: 'signing-secret' }) },
    '@/lib/integrations/task-queue': { enqueueWebhook: async () => { writes++; return { isDuplicate: false }; } },
  };
  const woo = load('src/app/api/webhooks/woocommerce/route.ts', mocks);
  assert.equal((await woo.POST(new Request('https://app.example/hook', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'webhook_id=123' }))).status, 200);
  assert.equal(writes, 0);
  assert.equal((await woo.POST(new Request('https://app.example/hook', { method: 'POST', body: '{}' }))).status, 401);
  const shopify = load('src/app/api/webhooks/shopify/route.ts', mocks);
  const body = JSON.stringify({ id: 1, name: '#1', created_at: '2026-10-20T00:00:00Z', currency: 'INR', total_price: '100', line_items: [{ id: 1, sku: 'SKU', quantity: 1, price: '100' }] });
  const signature = crypto.createHmac('sha256', 'signing-secret').update(body).digest('base64');
  const send = (shop, hmac) => shopify.POST(new Request('https://app.example/hook', { method: 'POST', body, headers: { 'X-Shopify-Shop-Domain': shop, 'X-Shopify-Hmac-Sha256': hmac, 'X-Shopify-Webhook-Id': 'delivery' } }));
  assert.equal((await send('other.myshopify.com', signature)).status, 401);
  assert.equal((await send('shop.myshopify.com', 'invalid')).status, 401);
  assert.equal(writes, 0);
  assert.equal((await send('shop.myshopify.com', signature)).status, 200); assert.equal(writes, 1);
});

test('renewal locks and reloads stored tokens before issuing another rotating grant', async () => {
  const stored = await vault.saveConnection(owner, { marketplace: 'Shopify', sellerId: 'shop.myshopify.com', credentials: {
    shopDomain: 'shop.myshopify.com', accessToken: 'old', refreshToken: 'refresh-old', clientSecret: 'server-secret', verifiedAt: new Date().toISOString(),
  } });
  const auth = load('src/lib/integrations/provider-auth.ts', { '@/lib/db': database }, environment);
  let grants = 0;
  const renew = async current => {
    if (auth.tokenIsCurrent(current)) return current;
    grants++;
    return { ...current, accessToken: 'new', refreshToken: 'refresh-new', tokenExpiresAt: new Date(Date.now()+3600000).toISOString() };
  };
  await auth.renewConnectionToken(owner, stored.id, renew);
  await auth.renewConnectionToken(owner, stored.id, renew);
  assert.equal(grants, 1);
  const credentials = await vault.getConnectionCredentials(owner, 'Shopify', '', stored.id);
  assert.equal(credentials.refreshToken, 'refresh-new'); assert.equal(credentials.clientSecret, 'server-secret');
  await assert.rejects(auth.renewConnectionToken(other, stored.id, renew)); assert.equal(grants, 1);
  await queue.enqueueStoreSync(owner, stored.id);
  await pg.query(`INSERT INTO provider_deferred_orders(user_id,connection_id,source_id,reason,encrypted_payload) VALUES($1,$2,'source','fixture','encrypted')`, [owner,stored.id]);
  await pg.query('DELETE FROM marketplace_connections WHERE user_id=$1 AND id=$2', [owner,stored.id]);
  assert.equal((await pg.query('SELECT id FROM integration_tasks WHERE connection_id=$1', [stored.id])).rows.length, 0);
  assert.equal((await pg.query('SELECT source_id FROM provider_deferred_orders WHERE connection_id=$1', [stored.id])).rows.length, 0);
});
