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
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 1 Security & Identity Hardening Test Suite', () => {

  // =========================================================================
  // SUITE 1: CRYPTOGRAPHIC SESSION ARCHITECTURE & INTEGRITY
  // =========================================================================
  describe('Suite 1: Cryptographic Session Architecture', () => {
    test('1.1 session.ts exists and enforces server-only execution', () => {
      const content = readProjectFile('src/lib/security/session.ts');
      assert.ok(content.includes('typeof window !== "undefined"'), 'Must guard against client bundling');
      assert.ok(content.includes('createHmac("sha256"'), 'Must use HMAC-SHA256');
      assert.ok(content.includes('timingSafeEqual'), 'Must use constant-time comparison against timing attacks');
      assert.ok(content.includes('SESSION_COOKIE_NAME'), 'Must define standard session cookie name');
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
      assert.ok(content.includes('verifySessionToken(token)'), 'Cookies must be cryptographically verified');
    });

    test('1.4 Actual session signer verifies signatures and rejects payload tampering', () => {
      const session = loadApp('src/lib/security/session.ts', { '@/lib/db': { query: () => assert.fail('Pure signature checks must not access the database') } }, { process: { env: { NODE_ENV: 'test', SESSION_SECRET: 'synthetic-test-key-with-at-least-32-bytes' } } });
      const token = session.signSessionToken({ id: 'merchant', email: 'merchant@example.com' });
      assert.equal(session.verifySessionToken(token).sub, 'merchant');
      const parts = token.split('.');
      parts[1] = Buffer.from(JSON.stringify({ ...session.verifySessionToken(token), sub: 'attacker' })).toString('base64url');
      assert.equal(session.verifySessionToken(parts.join('.')), null);
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

    test('3.2 private secure vault directory exists outside web root', () => {
      const privateVault = path.join(ROOT_DIR, 'data', 'secure-vault', 'documents');
      assert.ok(fs.existsSync(privateVault), 'data/secure-vault/documents must exist');
    });

    test('3.3 upload-bill route saves to secure vault and enforces authentication', () => {
      const uploadRoute = readProjectFile('src/app/api/upload-bill/route.ts');
      assert.ok(uploadRoute.includes('getDocumentDirectory(userId)') || uploadRoute.includes('data", "secure-vault", "documents'), 'Uploads must be saved to secure-vault');
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
    test('4.1 login route enforces password verification and sets HTTP-only cookie', () => {
      const loginRoute = readProjectFile('src/app/api/auth/login/route.ts');
      assert.ok(loginRoute.includes('verifyPassword'), 'Must verify password hash');
      assert.ok(loginRoute.includes('issueSessionToken'), 'Must issue a durably registered session token');
      assert.ok(loginRoute.includes('response.cookies.set'), 'Must set HTTP-only cookie');
      assert.ok(!loginRoute.includes('id: "usr_fallback"'), 'Insecure usr_fallback on bad password must be purged');
    });

    test('4.2 signup route sets HTTP-only cookie and enforces minimum password requirements', () => {
      const signupRoute = readProjectFile('src/app/api/auth/signup/route.ts');
      assert.ok(signupRoute.includes('issueSessionToken'), 'Must issue a durably registered session token');
      assert.ok(signupRoute.includes('response.cookies.set'), 'Must set HTTP-only cookie');
      assert.ok(signupRoute.includes('password.length < 12'), 'Must enforce minimum password length');
    });

    test('4.3 google auth route verifies Google ID tokens and forbids unauthenticated takeover', () => {
      const googleRoute = readProjectFile('src/app/api/auth/google/route.ts');
      assert.ok(googleRoute.includes('oauth2.googleapis.com/tokeninfo'), 'Must verify token with Google OAuth API');
      assert.ok(googleRoute.includes('email_verified'), 'Must verify email is confirmed by Google');
      assert.ok(googleRoute.includes('issueSessionToken'), 'Must issue a durably registered session token');
      assert.ok(googleRoute.includes('response.cookies.set'), 'Must set HTTP-only cookie');
    });

    test('4.4 encryption vault forbids hardcoded static key fallbacks in production', () => {
      const encContent = readProjectFile('src/lib/security/encryption.ts');
      assert.ok(!encContent.includes('"marginflow_production_vault_secret_key_v1"'), 'Hardcoded fallback secret must be purged');
      assert.ok(encContent.includes('FATAL SECURITY CONFIGURATION ERROR'), 'Must throw fatal error if missing key in production');
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
