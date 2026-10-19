import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const dbName = '@/lib/db', sessionName = '@/lib/security/session', supabaseName = '@/lib/supabase/server';
const user = { id: 'merchant-A', email: 'a@example.com' };
const request = (headers = {}) => new Request('https://app.example/api/orders', { headers });
const logoutRequest = origin => new Request('https://app.example/api/auth/logout', { method: 'POST', headers: { origin: origin || 'https://app.example' } });

// Models Auth and account-storage boundaries, never a second token verifier.
function authBackend() {
  let live = true, authOffline = false, dbOffline = false, accountExists = true, logoutFails = false;
  const calls = [], queries = [];
  const authUser = { id: 'supabase-auth-A', email: user.email, user_metadata: { avatarUrl: '/avatar.png', sub: 'untrusted-account', accountType: 'ADMIN' } };
  const auth = {
    getClaims: async () => { calls.push('getClaims'); return { data: { claims: { sub: authUser.id, email: authUser.email, exp: Math.floor(Date.now() / 1000) + 3600 } }, error: null }; },
    getUser: async () => { calls.push('getUser'); if (authOffline) throw Error('private auth detail'); return live ? { data: { user: authUser }, error: null } : { data: { user: null }, error: { message: 'session revoked' } }; },
    signOut: async () => { calls.push('signOut'); if (logoutFails) return { error: { message: 'private logout failure' } }; live = false; return { error: null }; },
  };
  const query = async (sql, params) => {
    queries.push([sql, params]); if (dbOffline) throw Error('private database detail');
    assert.match(sql, /WHERE auth_user_id = \$1/); assert.deepEqual(Array.from(params), [authUser.id]);
    return { rows: accountExists ? [{ id: user.id, name: 'Merchant A', email: user.email, account_type: 'BRAND_OWNER', company_name: 'Brand', phone: '123' }] : [] };
  };
  const mocks = { [dbName]: { query }, [supabaseName]: { createSupabaseServerClient: async () => { calls.push('client'); return { auth }; } } };
  return { mocks, auth, authUser, calls, queries, revoke() { live = false; }, authOffline(value) { authOffline = value; }, dbOffline(value) { dbOffline = value; }, account(value) { accountExists = value; }, logoutFails(value) { logoutFails = value; } };
}
const sessions = backend => load('src/lib/security/session.ts', backend.mocks);

test('F15: live Supabase identity maps only through auth_user_id to the merchant account', async () => {
  const backend = authBackend(), session = sessions(backend);
  const identity = await session.getSessionUser(request({ 'x-user-id': 'attacker', authorization: 'Bearer forged' }));
  assert.equal(identity.sub, user.id);
  assert.equal(identity.email, user.email);
  assert.equal(identity.accountType, 'BRAND_OWNER');
  assert.equal(identity.avatarUrl, '/avatar.png');
  assert.equal(backend.calls.filter(value => value === 'getUser').length, 1);
  assert.equal(backend.calls.includes('getClaims'), false);
});

test('F15: an unexpired verified JWT cannot bypass live Supabase revocation across replicas', async () => {
  const backend = authBackend(), first = sessions(backend), second = sessions(backend);
  assert.equal(await first.getSessionUserId(request()), user.id);
  backend.revoke();
  assert.equal((await backend.auth.getClaims()).data.claims.sub, backend.authUser.id);
  const reads = backend.queries.length;
  for (const verifier of [first, second, sessions(backend)]) assert.equal(await verifier.getSessionUserId(request()), null);
  assert.equal(backend.queries.length, reads, 'A revoked identity must not reach account lookup');
});

test('F15: deleted accounts and Auth or database outages fail closed', async () => {
  const backend = authBackend(), session = sessions(backend);
  backend.account(false); assert.equal(await session.getSessionUser(request()), null);
  backend.account(true); backend.authOffline(true);
  const reads = backend.queries.length;
  assert.equal(await session.getSessionUser(request()), null);
  assert.equal(backend.queries.length, reads);
  backend.authOffline(false); backend.dbOffline(true);
  assert.equal(await session.getSessionUser(request()), null);
});

test('F15: forged headers and obsolete application cookies cannot create a Supabase session', async () => {
  const backend = authBackend(); backend.revoke(); const session = sessions(backend);
  for (const headers of [ { 'x-user-id': user.id }, { authorization: 'Bearer unsigned' },
    { cookie: 'marginflow_session_token=%', 'x-user-id': user.id },
    { cookie: 'marginflow_session={"id":"merchant-A"}' } ]) assert.equal(await session.getSessionUser(request(headers)), null);
  assert.equal(backend.queries.length, 0);
});

test('F15: missing Auth configuration, missing user IDs, and provider errors with user data fail closed', async () => {
  for (const getUser of [async () => ({ data: { user: { id: '' } }, error: null }),
    async () => ({ data: { user: { id: 'supabase-auth-A' } }, error: { message: 'invalid' } })]) {
    const backend = authBackend(); backend.auth.getUser = getUser;
    assert.equal(await sessions(backend).getSessionUser(request()), null); assert.equal(backend.queries.length, 0);
  }
  const session = load('src/lib/security/session.ts', { [dbName]: { query: () => assert.fail('No identity lookup') },
    [supabaseName]: { createSupabaseServerClient: async () => { throw Error('unconfigured'); } } });
  assert.equal(await session.getSessionUser(request()), null);
});

test('F15: internal service impersonation requires a configured long secret and exact constant-time key match', async () => {
  const secret = 'synthetic-internal-secret-at-least-thirty-two-bytes';
  const backend = authBackend(); backend.revoke();
  for (const configured of [undefined, 'short', secret]) {
    const session = load('src/lib/security/session.ts', backend.mocks, { process: { env: { INTERNAL_SERVICE_KEY: configured } } });
    assert.equal(await session.getSessionUserId(request({ 'x-user-id': user.id, 'x-internal-service-key': 'wrong' })), null);
    assert.equal(await session.getSessionUserId(request({ 'x-user-id': user.id, 'x-internal-service-key': secret })), configured === secret ? user.id : null);
    assert.equal(await session.getSessionUserId(request({ 'x-internal-service-key': secret })), null);
  }
});

test('F15: actual logout delegates to Supabase and later live checks reject the session', async () => {
  const backend = authBackend(), first = sessions(backend), second = sessions(backend);
  assert.equal(await second.getSessionUserId(request()), user.id);
  const logout = load('src/app/api/auth/logout/route.ts', backend.mocks);
  const response = await logout.POST(logoutRequest());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(backend.calls.filter(call => call === 'signOut').length, 1);
  assert.equal(await first.getSessionUser(request()), null); assert.equal(await second.getSessionUser(request()), null);
});

test('F15: failed Supabase logout reports failure and keeps the session retryable', async () => {
  const backend = authBackend(); backend.logoutFails(true);
  const logout = load('src/app/api/auth/logout/route.ts', backend.mocks);
  const response = await logout.POST(logoutRequest());
  assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await response.text(), /private logout/);
  assert.equal(await sessions(backend).getSessionUserId(request()), user.id);
  backend.logoutFails(false); assert.equal((await logout.POST(logoutRequest())).status, 200);
  assert.equal(await sessions(backend).getSessionUserId(request()), null);
});

test('F15: cross-origin logout rejects before accessing Supabase', async () => {
  const backend = authBackend(), route = load('src/app/api/auth/logout/route.ts', backend.mocks);
  assert.equal((await route.POST(logoutRequest('https://attacker.example'))).status, 403);
  assert.deepEqual(backend.calls, []);
});

test('F15: actual login authenticates with Supabase and returns its mapped merchant identity', async () => {
  let credentials, mapped = false;
  const route = load('src/app/api/auth/login/route.ts', {
    [supabaseName]: { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async value => { credentials = value; return { data: { user: { id: 'auth-A', user_metadata: { onboardingCompleted: true } } }, error: null }; } } }) },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: async identity => { assert.equal(identity.id, 'auth-A'); mapped = true; return { account: { id: user.id, name: 'Merchant A', email: user.email, account_type: 'BRAND_OWNER' }, isNewUser: false }; } },
  });
  const response = await route.POST(new Request('https://app.example/api/auth/login', { method: 'POST', body: JSON.stringify({ email: '  A@EXAMPLE.COM  ', password: 'fixture-password' }) }));
  assert.equal(response.status, 200); assert.equal(mapped, true);
  assert.deepEqual(JSON.parse(JSON.stringify(credentials)), { email: user.email, password: 'fixture-password' });
  assert.equal((await response.json()).user.id, user.id);
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
