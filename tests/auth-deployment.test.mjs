import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import nextConfig from '../next.config.mjs';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const projectUrl = 'https://fixture.supabase.co';
const globals = env => ({ process: { env }, atob });

for (const name of ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  test(`${name} configures browser, server and session middleware consistently`, async () => {
    const calls = [];
    const settings = { NEXT_PUBLIC_SUPABASE_URL: projectUrl, [name]: 'public-fixture-key' };
    const mocks = {
      '@supabase/ssr': {
        createBrowserClient: (url, key) => { calls.push([url, key]); return { browser: true }; },
        createServerClient: (url, key) => { calls.push([url, key]); return { auth: { getClaims: async () => {} } }; },
      },
      'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
      'next/server': { NextResponse: { next: () => ({ forwarded: true }) } },
    };
    assert.equal(load('src/lib/supabase/browser.ts', mocks, globals(settings)).createSupabaseBrowserClient().browser, true);
    await load('src/lib/supabase/server.ts', mocks, globals(settings)).createSupabaseServerClient();
    await load('middleware.ts', mocks, globals(settings)).middleware({ cookies: { getAll: () => [] } });
    assert.deepEqual(calls, Array.from({ length: 3 }, () => [projectUrl, 'public-fixture-key']));
  });
}

test('public configuration rejects missing values and server-only keys without creating a client', () => {
  const serviceKey = ['header', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.');
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: projectUrl },
    { NEXT_PUBLIC_SUPABASE_URL: projectUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' },
    { NEXT_PUBLIC_SUPABASE_URL: projectUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: serviceKey }]) {
    const browser = load('src/lib/supabase/browser.ts', { '@supabase/ssr': { createBrowserClient: () => assert.fail('Unsafe configuration must not reach the SDK') } }, globals(env));
    assert.throws(() => browser.createSupabaseBrowserClient(), error => {
      assert.doesNotMatch(error.message, /sb_secret_fixture|signature|fixture.supabase/); return true;
    });
  }
});

test('Vercel production builds reject absent Auth configuration and private keys before publishing', () => {
  const names = ['VERCEL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    names.forEach(name => delete process.env[name]); process.env.VERCEL = '1';
    assert.throws(() => nextConfig('phase-production-build'), /Vercel build blocked: set NEXT_PUBLIC_SUPABASE_URL/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = projectUrl;
    assert.throws(() => nextConfig('phase-production-build'), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-fixture-key';
    assert.equal(nextConfig('phase-production-build').distDir, '.next');
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_fixture';
    assert.throws(() => nextConfig('phase-production-build'), error => {
      assert.match(error.message, /never a server secret/); assert.doesNotMatch(error.message, /sb_secret_fixture/); return true;
    });
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ['header', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.');
    assert.throws(() => nextConfig('phase-production-build'), /never a server secret/);
    delete process.env.VERCEL;
    assert.equal(nextConfig('phase-development-server').distDir, '.next-dev');
  } finally {
    for (const name of names) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
  }
});

test('missing server Auth configuration returns a retryable safe error instead of suggesting bad credentials', async () => {
  const logs = [];
  const route = load('src/app/api/auth/login/route.ts', {
    '@supabase/ssr': { createServerClient: () => assert.fail('No configured Auth project') },
    'next/headers': { cookies: () => assert.fail('Configuration fails before cookies') },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: () => assert.fail('No verified identity') },
  }, { ...globals({}), console: { ...console, error: (...args) => logs.push(args) } });
  const response = await route.POST(new Request('https://app.example/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'fixture@example.invalid', password: 'fixture-password' }) }));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'AUTH_NOT_CONFIGURED');
  assert.equal(logs[0][1].stage, 'configuration'); assert.doesNotMatch(JSON.stringify(logs), /fixture-password|fixture@example/);
});

test('account-setup diagnostics record the failing stage without logging SQL or credentials', async () => {
  const logs = [];
  const route = load('src/app/api/auth/login/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { signInWithPassword: async () => ({ data: { user: { id: 'auth-fixture' } }, error: null }) } }) },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: async () => { throw Object.assign(Error('database password private-value'), { code: '42501', detail: 'SQL and account details' }); } },
  }, { console: { ...console, error: (...args) => logs.push(args) } });
  const response = await route.POST(new Request('https://app.example/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'fixture@example.invalid', password: 'fixture-password' }) }));
  assert.equal(response.status, 500); assert.equal(logs[0][1].stage, 'account_setup'); assert.equal(logs[0][1].code, '42501');
  assert.doesNotMatch(JSON.stringify(logs), /private-value|SQL|fixture-password|auth-fixture/);
});
