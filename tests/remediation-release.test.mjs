import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const key = 'synthetic-session-key-at-least-thirty-two-bytes';
const env = { NODE_ENV: 'production', SESSION_SECRET: key };
const dbName = '@/lib/db', sessionName = '@/lib/security/session';
const user = { id: 'merchant-A', email: 'a@example.com' };
const request = token => new Request('https://app.example/api/orders', { headers: { authorization: 'Bearer ' + token } });
const cookieRequest = token => new Request('https://app.example/api/auth/logout', { method: 'POST', headers: { cookie: 'marginflow_session_token=' + token, origin: 'https://app.example' } });

// Models only the database boundary, never an alternative authentication implementation.
function registry() {
  const rows = new Map(), queries = [];
  let offline = false, accountExists = true;
  const query = async (sql, params) => {
    queries.push([sql, params]);
    if (offline) throw Error('private database connection failure');
    if (sql.startsWith('INSERT INTO auth_sessions')) {
      if (!accountExists) return { rows: [] };
      rows.set(params[0], { owner: params[1], expires: params[2], revoked: false });
      return { rows: [{ token_hash: params[0] }] };
    }
    if (sql.startsWith('SELECT s.user_id')) {
      const row = rows.get(params[0]);
      return { rows: accountExists && row && row.owner === params[1] && !row.revoked && row.expires > Date.now() / 1000 ? [{ user_id: row.owner }] : [] };
    }
    if (sql.startsWith('UPDATE auth_sessions')) {
      const row = rows.get(params[0]);
      if (row?.owner === params[1]) row.revoked = true;
      return { rows: [] };
    }
    throw Error('Unexpected test query');
  };
  return { db: { query }, rows, queries, outage(value) { offline = value; }, account(value) { accountExists = value; } };
}
const sessions = backend => load('src/lib/security/session.ts', { [dbName]: backend.db }, { process: { env } });

test('F15: signed but unregistered tokens cannot access protected APIs', async () => {
  const backend = registry(), session = sessions(backend);
  const token = session.signSessionToken(user);
  assert.equal(session.verifySessionToken(token).sub, user.id);
  assert.equal(await session.getSessionUser(request(token)), null);
  const route = load('src/app/api/orders/route.ts', { [dbName]: backend.db, '@/lib/integrations/order-persistence': { upsertOrders: () => assert.fail('Unauthenticated write') } }, { process: { env } });
  assert.equal((await route.POST(new Request('https://app.example/api/orders', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: '{}' }))).status, 401);
});
test('F15: issuance persists only a token digest and rejects missing accounts or failed registration', async () => {
  const backend = registry(), session = sessions(backend);
  const token = await session.issueSessionToken(user);
  assert.equal(await session.getSessionUserId(request(token)), user.id);
  const insert = backend.queries[0];
  assert.match(insert[0], /FROM user_accounts.*RETURNING token_hash/);
  assert.equal(insert[1][0], crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify([...backend.rows]).includes(token));
  backend.account(false);
  await assert.rejects(session.issueSessionToken(user));
  backend.outage(true);
  await assert.rejects(session.issueSessionToken(user));
});
test('F15: cookie logout revokes a copied Bearer token across independent server module instances', async () => {
  const backend = registry(), first = sessions(backend), otherReplica = sessions(backend);
  const token = await first.issueSessionToken(user);
  assert.equal(await otherReplica.getSessionUserId(request(token)), user.id);
  const logout = load('src/app/api/auth/logout/route.ts', { [dbName]: backend.db }, { process: { env } });
  const response = await logout.POST(cookieRequest(token));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.match(response.headers.get('set-cookie'), /SameSite=lax/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await first.getSessionUser(request(token)), null);
  assert.equal(await otherReplica.getSessionUser(request(token)), null);
  assert.equal(await sessions(backend).getSessionUser(request(token)), null);
  assert.equal((await logout.POST(cookieRequest(token))).status, 200);
});
test('F15: distinct logins in one second have different identities and revoke independently', async () => {
  const backend = registry(), session = sessions(backend);
  const a = await session.issueSessionToken(user), b = await session.issueSessionToken(user);
  const c = await session.issueSessionToken({ id: 'merchant-B', email: 'b@example.com' });
  assert.notEqual(a, b);
  assert.notEqual(session.verifySessionToken(a).sid, session.verifySessionToken(b).sid);
  await session.revokeSessionToken(a);
  assert.equal(await session.getSessionUserId(request(a)), null);
  assert.equal(await session.getSessionUserId(request(b)), 'merchant-A');
  assert.equal(await session.getSessionUserId(request(c)), 'merchant-B');
});
test('F15: revocation outages do not report logout success or clear the retryable cookie', async () => {
  const backend = registry(), session = sessions(backend);
  const token = await session.issueSessionToken(user);
  backend.outage(true);
  const logout = load('src/app/api/auth/logout/route.ts', { [dbName]: backend.db }, { process: { env } });
  const response = await logout.POST(cookieRequest(token));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.doesNotMatch(await response.text(), /private database/);
  assert.equal(await session.getSessionUser(request(token)), null);
  backend.outage(false);
  assert.equal(await session.getSessionUserId(request(token)), user.id);
  assert.equal((await logout.POST(cookieRequest(token))).status, 200);
  assert.equal(await session.getSessionUserId(request(token)), null);
});
test('F15: cross-origin logout is rejected before revocation', async () => {
  const backend = registry(), session = sessions(backend), token = await session.issueSessionToken(user);
  const route = load('src/app/api/auth/logout/route.ts', { [dbName]: backend.db }, { process: { env } });
  const response = await route.POST(new Request('https://app.example/api/auth/logout', { method: 'POST', headers: { origin: 'https://attacker.example', cookie: 'marginflow_session_token=' + token } }));
  assert.equal(response.status, 403);
  assert.equal(await session.getSessionUserId(request(token)), user.id);
});
test('F15: malformed cookies, unsigned identities, expired/boundary and legacy tokens reject without registry reads', async () => {
  const backend = registry(), session = sessions(backend), token = session.signSessionToken(user);
  const sign = (header, payload) => {
    const content = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
    const secret = crypto.createHash('sha256').update(key).digest();
    return content + '.' + crypto.createHmac('sha256', secret).update(content).digest('base64url');
  };
  const payload = session.verifySessionToken(token), now = Math.floor(Date.now() / 1000);
  const { sid, ...legacy } = payload;
  for (const bad of [sign({ alg: 'none', typ: 'JWT' }, payload), sign({ alg: 'HS256', typ: 'JWT' }, legacy), sign({ alg: 'HS256', typ: 'JWT' }, { ...payload, exp: now }), sign({ alg: 'HS256', typ: 'JWT' }, { ...payload, exp: now - 1 }), sign({ alg: 'HS256', typ: 'JWT' }, { ...payload, iat: now + 10 }), 'x'.repeat(8193)]) assert.equal(await session.getSessionUser(request(bad)), null);
  assert.equal(await session.getSessionUser(new Request('https://app.example', { headers: { cookie: 'marginflow_session_token=%', 'x-user-id': user.id } })), null);
  assert.equal(await session.getSessionUser(new Request('https://app.example', { headers: { cookie: 'marginflow_session={"id":"merchant-A"}', 'x-user-id': user.id } })), null);
  assert.equal(backend.queries.length, 0);
});
test('F15: removed accounts and registry outages deny already-issued sessions', async () => {
  const backend = registry(), session = sessions(backend), token = await session.issueSessionToken(user);
  backend.account(false);
  assert.equal(await session.getSessionUserId(request(token)), null);
  assert.match(backend.queries.at(-1)[0], /EXISTS.*user_accounts/);
  backend.account(true); backend.outage(true);
  assert.equal(await session.getSessionUserId(request(token)), null);
});
test('F15: actual login cannot set a cookie when durable issuance fails', async () => {
  const route = load('src/app/api/auth/login/route.ts', { [dbName]: { query: async sql => {
    if (sql.trimStart().startsWith('SELECT') && sql.includes('FROM user_accounts')) return { rows: [{ id: user.id, email: user.email, password_hash: 'pbkdf2-sha512:220000:fixture', account_type: 'BRAND_OWNER' }] };
    throw Error('Session registry offline');
  } }, '@/lib/auth-crypto': { verifyPassword: async () => true } }, { process: { env }, console: { ...console, error() {} } });
  const response = await route.POST(new Request('https://app.example/api/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: 'fixture-password' }) }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
});
test('F15: production signing rejects missing or short keys without creating ephemeral credentials', () => {
  for (const secret of [undefined, 'too-short']) {
    const session = load('src/lib/security/session.ts', { [dbName]: {} }, { process: { env: { NODE_ENV: 'production', SESSION_SECRET: secret } }, console: { ...console, warn: () => assert.fail('Production must not create an ephemeral key') } });
    assert.throws(() => session.signSessionToken(user), /SESSION_SECRET/);
  }
});
test('F15/F62: every API and workspace template awaits the actual asynchronous verifier', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  let calls = 0;
  for (const file of [...walk('src/app/api'), 'src/app/(dashboard)/template.tsx'].filter(file => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['getSessionUserId', 'getSessionUser'].includes(node.expression.text)) {
        calls++;
        assert.ok(ts.isAwaitExpression(node.parent), file + ': unawaited session verification');
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(calls >= 30, 'Inspect the complete existing protected route surface');
});
test('F63: protected workspace navigation redirects expired sessions without modifying the shell', async () => {
  let active = false;
  const template = load('src/app/(dashboard)/template.tsx', { 'next/headers': { headers: async () => new Headers() }, 'next/navigation': { redirect: target => { throw Error('REDIRECT ' + target); } }, [sessionName]: { getSessionUser: async () => active ? { sub: user.id } : null } });
  await assert.rejects(template.default({ children: 'workspace' }), /REDIRECT \/login/);
  active = true;
  assert.equal(await template.default({ children: 'workspace' }), 'workspace');
});
test('F21: job records require durable PostgreSQL and never fall back to simulated success', async () => {
  const db = { pool: { query: async () => { throw Error('unavailable'); }, connect: async () => { throw Error('unavailable'); } } };
  const queue = load('src/lib/queue/queue-manager.ts', { [dbName]: db });
  queue.registerJobProcessor('GENERATE_FINANCIAL_REPORT', async () => ({ synthetic: true }));
  await assert.rejects(queue.queueManager.enqueue('GENERATE_FINANCIAL_REPORT', {}, { ownerId: user.id }), /storage is unavailable/);
  await assert.rejects(queue.queueManager.listJobs({ ownerId: user.id }));
  const mocks = { [sessionName]: { getSessionUserId: async () => user.id }, [dbName]: db, '@/lib/queue/job-processors': {} };
  const globals = {};
  const route = load('src/app/api/jobs/route.ts', mocks, globals);
  assert.equal((await route.POST(new Request('https://app.example/api/jobs', { method: 'POST', body: JSON.stringify({ type: 'GENERATE_FINANCIAL_REPORT' }) }))).status, 503);
  assert.equal((await route.GET(new Request('https://app.example/api/jobs'))).status, 503);
  const detail = load('src/app/api/jobs/[id]/route.ts', mocks, globals);
  for (const method of ['GET', 'DELETE']) assert.equal((await detail[method](new Request('https://app.example/api/jobs/x'), { params: Promise.resolve({ id: 'x' }) })).status, 404);
  let writes = 0;
  const unavailableType = load('src/app/api/jobs/route.ts', {
    [sessionName]: { getSessionUserId: async () => user.id },
    [dbName]: { pool: { query: async () => { writes++; throw Error('should not persist unsupported jobs'); } } },
    '@/lib/queue/job-processors': {},
  }, { process: { env: { MARGINFLOW_JOB_WORKER: '1' } } });
  const unsupported = await unavailableType.POST(new Request('https://app.example/api/jobs', { method: 'POST', body: JSON.stringify({ type: 'BULK_CSV_IMPORT', payload: {} }) }));
  assert.equal(unsupported.status, 503);
  assert.equal(writes, 0);
});

test('F21: durable enqueue scopes ownership and stores bounded retry/idempotency settings', async () => {
  const inserted = [];
  const row = { id: crypto.randomUUID(), owner_id: user.id, type: 'PROCESS_BATCH_IDP', payload: { documents: [] }, status: 'QUEUED', progress: 0, result: null, error: null, attempts: 0, max_attempts: 4, created_at: new Date(), updated_at: new Date(), available_at: new Date(), locked_at: null };
  const queue = load('src/lib/queue/queue-manager.ts', { [dbName]: { pool: { query: async (sql, params) => { inserted.push([sql, params]); return { rows: [row] }; } } } });
  await assert.rejects(queue.queueManager.enqueue('PROCESS_BATCH_IDP', { documents: [] }, { ownerId: user.id }), /No processor is registered/);
  queue.registerJobProcessor('PROCESS_BATCH_IDP', async () => ({ synthetic: true }));
  const job = await queue.queueManager.enqueue('PROCESS_BATCH_IDP', { documents: [] }, { ownerId: user.id, idempotencyKey: 'upload:abc', maxAttempts: 4 });
  assert.equal(job.id, row.id);
  assert.equal(job.ownerId, user.id);
  assert.equal(job.attempts, 0);
  assert.match(inserted[0][0], /INSERT INTO background_jobs/);
  assert.match(inserted[0][0], /ON CONFLICT \(created_by, idempotency_key\)/);
  assert.equal(inserted[0][1][2], user.id);
  assert.equal(inserted[0][1][3], 'upload:abc');
  assert.equal(inserted[0][1][4], 4);
});

test('F21: worker claims atomically, supplies stable idempotency, and persists processor result', async () => {
  const sql = [];
  let resultUpdates = 0;
  const claimed = { id: crypto.randomUUID(), owner_id: user.id, type: 'PROCESS_BATCH_IDP', payload: { documents: [] }, status: 'PROCESSING', progress: 0, result: null, error: null, attempts: 1, max_attempts: 3, created_at: new Date(), updated_at: new Date(), available_at: new Date(), locked_at: new Date(), lock_token: crypto.randomUUID() };
  const pool = { connect: async () => ({ query: async (query, params) => { sql.push([query, params]); if (query.includes('RETURNING j.id, j.created_by AS owner_id')) return { rows: [claimed] }; if (query.includes("SET status = 'COMPLETED'")) { resultUpdates++; return { rowCount: 1, rows: [claimed] }; } return { rowCount: 1, rows: [] }; }, release() {} }), query: async (query, params) => { sql.push([query, params]); return { rowCount: 1, rows: [] }; } };
  const queue = load('src/lib/queue/queue-manager.ts', { [dbName]: { pool } });
  let processorKey;
  queue.registerJobProcessor('PROCESS_BATCH_IDP', async context => { processorKey = context.idempotencyKey; assert.equal(await context.updateProgress(45), true); return { processedCount: 0 }; });
  assert.equal(await queue.queueManager.runNextJob(), true);
  assert.equal(processorKey, claimed.id);
  assert.equal(resultUpdates, 1);
  assert.ok(sql.some(([statement]) => statement.includes('FOR UPDATE SKIP LOCKED')));
  assert.ok(sql.some(([statement]) => statement.includes("SET status = 'COMPLETED'")));
});

test('F21: processor failures retry with backoff and only fail after the configured attempt limit', async () => {
  const sql = [];
  const claimed = { id: crypto.randomUUID(), owner_id: user.id, type: 'PROCESS_BATCH_IDP', payload: {}, status: 'PROCESSING', progress: 0, result: null, error: null, attempts: 1, max_attempts: 2, created_at: new Date(), updated_at: new Date(), available_at: new Date(), locked_at: new Date(), lock_token: crypto.randomUUID() };
  const pool = { connect: async () => ({ query: async (query, params) => { sql.push([query, params]); return query.includes('RETURNING j.id, j.created_by AS owner_id') ? { rows: [claimed] } : { rowCount: query.includes("SET status = 'COMPLETED'") ? 1 : 0, rows: [] }; }, release() {} }), query: async (query, params) => { sql.push([query, params]); return { rowCount: 1, rows: [] }; } };
  const queue = load('src/lib/queue/queue-manager.ts', { [dbName]: { pool } });
  queue.registerJobProcessor('PROCESS_BATCH_IDP', async () => { throw Error('do not persist this processor detail'); });
  assert.equal(await queue.queueManager.runNextJob(), true);
  const failure = sql.find(([statement]) => statement.includes('error = $1, available_at'));
  assert.ok(failure);
  assert.match(failure[0], /CASE WHEN \$5::boolean OR attempts >= max_attempts THEN 'FAILED'.*ELSE 'QUEUED'/s);
  assert.match(failure[0], /available_at = CASE WHEN \$5::boolean OR attempts >= max_attempts THEN available_at ELSE now\(\) \+ \(\$2::int \* interval '1 millisecond'\) END/);
  assert.equal(failure[1][0], 'Background job attempt failed.');
});
