import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const guard = env => load('src/lib/security/api-guard.ts', {}, { process: { env } });
const login = (headers = {}, url = 'http://localhost:3000/api/auth/login') => new Request(url, { method: 'POST', headers });

test('development accepts same-origin LAN requests despite Next normalizing its URL to localhost', () => {
  const app = guard({ NODE_ENV: 'development' });
  for (const host of ['localhost:3000', '192.168.1.50:3000', '10.0.0.25:3000', '[fd00::12]:3000']) {
    assert.equal(app.rejectCrossOrigin(login({ host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' })), null);
  }
  assert.equal(app.rejectCrossOrigin(login({ origin: 'http://localhost:3000' })), null);
});

test('development still rejects foreign origins, mismatched ports, schemes and cross-site requests', () => {
  const app = guard({ NODE_ENV: 'development' }), host = '192.168.1.50:3000';
  for (const origin of ['https://attacker.example', 'http://192.168.1.50:3001', 'https://192.168.1.50:3000', 'null']) {
    assert.equal(app.rejectCrossOrigin(login({ host, origin })).status, 403);
  }
  assert.equal(app.rejectCrossOrigin(login({ host, origin: `http://${host}`, 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal(app.rejectCrossOrigin(login({ host, origin: 'https://attacker.example', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' })).status, 403);
});

test('production and an explicit APP_ORIGIN retain strict origin checks', () => {
  const production = guard({ NODE_ENV: 'production' });
  assert.equal(production.rejectCrossOrigin(login({ host: '192.168.1.50:3000', origin: 'http://192.168.1.50:3000' })).status, 403);
  assert.equal(production.rejectCrossOrigin(login({ origin: 'https://app.example', host: 'attacker.example' }, 'https://app.example/api/auth/login')), null);
  for (const mode of ['development', 'production']) {
    const pinned = guard({ NODE_ENV: mode, APP_ORIGIN: 'https://app.example' });
    assert.equal(pinned.rejectCrossOrigin(login({ host: '192.168.1.50:3000', origin: 'http://192.168.1.50:3000' })).status, 403);
    assert.equal(pinned.rejectCrossOrigin(login({ host: 'internal:3000', origin: 'https://app.example' })), null);
  }
});

test('LAN login reaches credential validation, while foreign login never accesses authentication', async () => {
  let authCalls = 0;
  const route = load('src/app/api/auth/login/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { authCalls++; throw Error('must not authenticate'); } },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount() { throw Error('must not map an account'); } },
  }, { process: { env: { NODE_ENV: 'development' } } });
  for (const [origin, status] of [['http://192.168.1.50:3000', 400], ['https://attacker.example', 403]]) {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST', headers: { host: '192.168.1.50:3000', origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    });
    const response = await route.POST(request);
    assert.equal(response.status, status);
    if (status === 400) assert.equal((await response.json()).error, 'Email is required');
  }
  assert.equal(authCalls, 0);
});
