import { readIntegrationSource } from './helpers/integration-source.mjs';
import { createRequire } from "node:module";
const loadApp = createRequire(import.meta.url)("./helpers/load-app.cjs");
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return readIntegrationSource(relPath);
}

describe('Phase 1 Security & Identity Hardening Test Suite', () => {

  // =========================================================================
  // SUITE 1: CRYPTOGRAPHIC SESSION ARCHITECTURE & INTEGRITY
  // =========================================================================
  describe('Suite 1: Cryptographic Session Architecture', () => {
    test('1.1 session.ts exists and enforces server-only execution', () => {
      const content = readProjectFile('src/lib/security/session.ts');
      assert.ok(content.includes('typeof window !== "undefined"'), 'Must guard against client bundling');
      assert.ok(content.includes('supabase.auth.getUser()'), 'Financial access must verify the live Supabase session');
      assert.ok(content.includes('WHERE auth_user_id = $1'), 'Verified Auth identity must map to the account owner');
      assert.throws(() => loadApp('src/lib/security/session.ts', {
        '@/lib/db': {}, '@/lib/supabase/server': {},
      }, { window: {} }), /client bundle/);
    });

    test('1.2 session.ts rejects unsigned x-user-id header spoofing', () => {
      const content = readProjectFile('src/lib/security/session.ts');
      // Verify blind trust of x-user-id is eliminated
      assert.ok(!content.includes('const headerUser = req.headers.get("x-user-id");\n  if (headerUser && headerUser.trim()) {\n    return headerUser.trim();'), 'Blind x-user-id header trust must be purged');
      assert.ok(content.includes('INTERNAL_SERVICE_KEY'), 'Only authorized internal services can pass system user headers');
    });

    test('1.3 session.ts rejects unsigned client cookies and default ACC-001 fallback', () => {
      const content = readProjectFile('src/lib/security/session.ts');
      assert.ok(!content.includes('return "ACC-001";'), 'Insecure default return "ACC-001" must be purged');
      assert.ok(content.includes('supabase.auth.getUser()'), 'Client cookies must go through Supabase verification');
      assert.ok(!content.includes('verifySessionToken'), 'Obsolete application JWT verification must not replace Supabase');
    });

    test('1.4 Actual verifier rejects an Auth error even when a provider response contains a user', async () => {
      const session = loadApp('src/lib/security/session.ts', {
        '@/lib/db': { query: () => assert.fail('Invalid Auth must not access the database') },
        '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
          getUser: async () => ({ data: { user: { id: 'untrusted' } }, error: { message: 'invalid token' } }),
        } }) },
      });
      assert.equal(await session.getSessionUser(new Request('https://app.example', {
        headers: { 'x-user-id': 'attacker', cookie: 'marginflow_session_token=tampered' },
      })), null);
    });
  });

  // =========================================================================
  // SUITE 2: SSRF GUARD & OUTBOUND URL DEFENSE
  // =========================================================================
  describe('Suite 2: Outbound SSRF Guard Defense', () => {
    test('2.1 ssrf-guard.ts exists and enforces server-only execution', () => {
      const content = readProjectFile('src/lib/security/ssrf-guard.ts');
      assert.ok(content.includes('validateSafeOutboundUrl'), 'Must export validateSafeOutboundUrl');
      assert.ok(content.includes('safeOutboundFetch'), 'Must export safeOutboundFetch');
      assert.ok(content.includes('typeof window !== "undefined"'), 'Must guard against client bundling');
    });

    test('2.2 ssrf-guard.ts blocks AWS/GCP/Azure link-local metadata (169.254.169.254)', () => {
      const content = readProjectFile('src/lib/security/ssrf-guard.ts');
      assert.ok(content.includes('169') && content.includes('254'), 'Must block 169.254.0.0/16 metadata subnet');
      assert.ok(content.includes('metadata.google.internal'), 'Must block metadata hostnames');
    });

    test('2.3 ssrf-guard.ts blocks RFC 1918 private subnets and loopback', () => {
      const content = readProjectFile('src/lib/security/ssrf-guard.ts');
      assert.ok(content.includes('a === 10'), 'Must block 10.0.0.0/8');
      assert.ok(content.includes('a === 127'), 'Must block 127.0.0.0/8');
      assert.ok(content.includes('a === 172 && b >= 16 && b <= 31'), 'Must block 172.16.0.0/12');
      assert.ok(content.includes('a === 192 && b === 168'), 'Must block 192.168.0.0/16');
    });

    test('2.4 WooCommerce and Generic sync routes enforce SSRF guard and session auth', () => {
      const wcRoute = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');
      assert.ok(wcRoute.includes('validateSafeOutboundUrl'), 'WooCommerce sync must call validateSafeOutboundUrl');
      assert.ok(wcRoute.includes('SSRF_SECURITY_VIOLATION'), 'WooCommerce must return SSRF_SECURITY_VIOLATION on malicious IP');
      assert.ok(wcRoute.includes('AUTHENTICATION_REQUIRED'), 'WooCommerce must require authenticated session');

      const genericRoute = readProjectFile('src/app/api/integrations/generic/sync/route.ts');
      assert.ok(genericRoute.includes('validateSafeOutboundUrl'), 'Generic sync must call validateSafeOutboundUrl');
      assert.ok(genericRoute.includes('SSRF_SECURITY_VIOLATION'), 'Generic sync must return SSRF_SECURITY_VIOLATION on malicious IP');
      assert.ok(genericRoute.includes('AUTHENTICATION_REQUIRED'), 'Generic sync must require authenticated session');
    });
  });

  // =========================================================================
  // SUITE 3: DOCUMENT VAULT & PRIVACY ISOLATION
  // =========================================================================
  describe('Suite 3: Document Vault & Storage Privacy', () => {
    test('3.1 public/uploads directory is purged from static web root', () => {
      const publicUploads = path.join(ROOT_DIR, 'public', 'uploads');
      assert.ok(!fs.existsSync(publicUploads), 'public/uploads must NOT exist in static web root');
    });

    test('3.2 private documents use durable Storage without a local vault directory', () => {
      const storage = readProjectFile('src/lib/security/document-storage.ts');
      assert.ok(storage.includes('DOCUMENT_BUCKET'), 'Private document storage must use the configured bucket');
      assert.ok(!storage.includes('process.cwd()'), 'Document persistence must not depend on a local app directory');
    });

    test('3.3 upload-bill route saves to secure vault and enforces authentication', () => {
      const uploadRoute = readProjectFile('src/app/api/upload-bill/route.ts');
      assert.ok(uploadRoute.includes('storeDocument(userId, file, buffer)'), 'Uploads must be saved in durable private Storage');
      assert.ok(!uploadRoute.includes('public/uploads/bills') && !uploadRoute.includes('public", "uploads", "bills'), 'Must not write to public/uploads/bills');
      assert.ok(uploadRoute.includes('/api/documents/stream?file='), 'Must route document access through authenticated stream');
      assert.ok(uploadRoute.includes('getSessionUserId'), 'Must enforce authenticated merchant session');
    });

    test('3.4 authenticated document stream route exists and defends against directory traversal', () => {
      const streamRoute = readProjectFile('src/app/api/documents/stream/route.ts');
      assert.ok(streamRoute.includes('getSessionUser'), 'Must verify user session');
      assert.ok(streamRoute.includes('path.basename'), 'Must sanitize filename against traversal');
      assert.ok(streamRoute.includes('X-Content-Type-Options') && streamRoute.includes('nosniff'), 'Must set nosniff security header');
    });
  });

  // =========================================================================
  // SUITE 4: AUTHENTICATION HARDENING & SECRET VAULT ISOLATION
  // =========================================================================
  describe('Suite 4: Auth Hardening & Secret Vault Isolation', () => {
    test('4.1 login rejects absent passwords before calling Supabase', async () => {
      const route = loadApp('src/app/api/auth/login/route.ts', {
        '@/lib/supabase/server': { createSupabaseServerClient: () => assert.fail('Missing password must not reach Auth') },
        '@/lib/auth/supabase-account': {},
      });
      const response = await route.POST(new Request('https://app.example/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email: 'merchant@example.com', password: '' }),
      }));
      assert.equal(response.status, 400);
    });

    test('4.2 signup validates passwords and waits for Supabase email confirmation', async () => {
      let signups = 0;
      const route = loadApp('src/app/api/auth/signup/route.ts', {
        '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
          signUp: async () => { signups++; return { data: { session: null, user: { id: 'pending' } }, error: null }; },
        } }) },
        '@/lib/auth/supabase-account': { ensureMarginFlowAccount: () => assert.fail('Unconfirmed signup must not create merchant books') },
      });
      const request = password => new Request('https://app.example/api/auth/signup', {
        method: 'POST', body: JSON.stringify({ name: 'Merchant', email: 'new@example.com', password }),
      });
      assert.equal((await route.POST(request('short'))).status, 400);
      assert.equal(signups, 0);
      const response = await route.POST(request('long-enough-password'));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).confirmationRequired, true);
      assert.equal(signups, 1);
    });

    test('4.3 successful Supabase OAuth callbacks reject external redirect targets', async () => {
      const route = loadApp('src/app/auth/callback/route.ts', {
        '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
          exchangeCodeForSession: async () => ({ data: { user: { id: 'verified', user_metadata: { onboardingCompleted: true } } }, error: null }),
        } }) },
        '@/lib/auth/supabase-account': { ensureMarginFlowAccount: async () => ({ isNewUser: false }) },
      });
      for (const next of ['https://attacker.example', '//attacker.example', '/\\attacker.example']) {
        const url = new URL('https://app.example/auth/callback?code=valid'); url.searchParams.set('next', next);
        const response = await route.GET(new Request(url));
        assert.equal(response.headers.get('location'), 'https://app.example/dashboard');
      }
    });

    test('4.4 encryption vault forbids hardcoded static key fallbacks in production', () => {
      const encContent = readProjectFile('src/lib/security/encryption.ts');
      assert.ok(!encContent.includes('"marginflow_production_vault_secret_key_v1"'), 'Hardcoded fallback secret must be purged');
      assert.ok(encContent.includes('ENCRYPTION_MASTER_KEY must be configured'), 'Must throw fatal error if missing key in production');
    });

    test('4.5 secret vault forbids hardcoded dev webhook secrets in production', () => {
      const secretContent = readProjectFile('src/lib/security/secret-vault.ts');
      assert.ok(secretContent.includes('process.env.NODE_ENV === "production"'), 'Must check production environment');
      assert.ok(secretContent.includes('return "";'), 'Must not leak dev secrets in production');
    });

    test('4.6 sync routes (Amazon, Flipkart, Shopify) all enforce authenticated merchant sessions', () => {
      const amzn = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(amzn.includes('AUTHENTICATION_REQUIRED'), 'Amazon sync must require authentication');

      const flip = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(flip.includes('AUTHENTICATION_REQUIRED'), 'Flipkart sync must require authentication');

      const shop = readProjectFile('src/app/api/integrations/shopify/sync/route.ts');
      assert.ok(shop.includes('AUTHENTICATION_REQUIRED'), 'Shopify sync must require authentication');
    });
  });
});
