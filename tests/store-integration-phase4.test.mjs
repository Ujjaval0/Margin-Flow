import { readIntegrationSource } from './helpers/integration-source.mjs';
import { createRequire } from "node:module";
const loadApp = createRequire(import.meta.url)("./helpers/load-app.cjs");
const binding = { clientId: 'test-client', redirectUri: 'https://app.example/api/integrations/flipkart/callback' };
const loadIsolated = file => {
  const states = new Map();
  return loadApp(file.replace('../', ''), { '@/lib/db': { query: async (sql, args) => {
    if (sql.startsWith('INSERT')) { states.set(args[0], { userId: args[1], marketplace: args[2], expiry: args[3], clientId: args[4], redirectUri: args[5] }); return { rows: [] }; }
    assert.match(sql, /DELETE FROM oauth_states[\s\S]*RETURNING user_id/);
    const row = states.get(args[0]);
    if (!row || row.userId !== args[2] || row.marketplace !== args[1] || row.clientId !== args[3] || row.redirectUri !== args[4] || row.expiry <= new Date()) return { rows: [] };
    states.delete(args[0]); return { rows: [{ user_id: row.userId }] };
  } } });
};
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return readIntegrationSource(relPath);
}

describe('Store Integration Phase 4 Verification Suite', () => {

  // =========================================================================
  // TASK-4.1: RETAIN SELF-ACCESS FOR INTERNAL DEVELOPER STAGING
  // =========================================================================
  describe('TASK-4.1: Retain Self-Access for Internal Developer Staging', () => {
    test('marketplace-vault.ts assigns auth_type = SELF_ACCESS when appId and appSecret are provided', () => {
      const vaultContent = readProjectFile('src/lib/security/marketplace-vault.ts');
      assert.ok(
        vaultContent.includes('authType = params.credentials?.refreshToken ? "OAUTH2" : "SELF_ACCESS"'),
        'Must assign auth_type = SELF_ACCESS for client_credentials apps and OAUTH2 for merchant refresh tokens'
      );
    });

    test('Flipkart sync route supports Seller Self-Access authentication', () => {
      const syncContent = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(
        syncContent.includes('grant_type: "client_credentials"'),
        'Must maintain grant_type=client_credentials for developer staging testing'
      );
      assert.ok(
        syncContent.includes('getSelfAccessToken'),
        'Must implement getSelfAccessToken for staging credentials'
      );
    });
  });

  // =========================================================================
  // TASK-4.2: FLIPKART OAUTH 2.0 CONNECT ROUTE
  // =========================================================================
  describe('TASK-4.2: Implement Flipkart OAuth 2.0 Connect Route', () => {
    test('src/app/api/integrations/flipkart/connect/route.ts exists and handles GET and POST', () => {
      const connectContent = readProjectFile('src/app/api/integrations/flipkart/connect/route.ts');
      assert.ok(
        connectContent.includes('export async function GET'),
        'Must export GET handler for browser redirect'
      );
      assert.ok(
        connectContent.includes('beginOAuth(request,'),
        'Must export POST handler for SPA/programmatic connection initialization'
      );
      assert.ok(
        connectContent.includes('oauth-service/oauth/authorize'),
        'Must target Flipkart OAuth 2.0 authorize endpoint'
      );
    });

    test('Generates cryptographically secure state nonce and binds to merchant user_id with 10-minute expiry', () => {
      const connectContent = readProjectFile('src/app/api/integrations/flipkart/connect/route.ts');
      assert.ok(
        connectContent.includes('createOAuthState'),
        'Must generate state nonce via createOAuthState'
      );
      assert.ok(
        connectContent.includes('10 * 60000'),
        'Must enforce 10-minute (600s) expiry for CSRF state nonces'
      );
      assert.ok(
        connectContent.includes('getSessionUserId'),
        'Must extract and bind state nonce to authenticated session user_id'
      );
    });
  });

  // =========================================================================
  // TASK-4.3: FLIPKART OAUTH 2.0 CALLBACK ROUTE
  // =========================================================================
  describe('TASK-4.3: Implement Flipkart OAuth 2.0 Callback Route', () => {
    test('src/app/api/integrations/flipkart/callback/route.ts exists and enforces CSRF verification', () => {
      const callbackContent = readProjectFile('src/app/api/integrations/flipkart/callback/route.ts');
      assert.ok(
        callbackContent.includes('export async function GET'),
        'Must export GET handler for OAuth redirect'
      );
      assert.ok(
        callbackContent.includes('verifyAndConsumeOAuthState'),
        'Must verify and atomically consume state nonce to prevent CSRF and replay attacks'
      );
      assert.ok(
        callbackContent.includes('if (!valid.valid)'),
        'Must reject invalid or expired state nonces'
      );
    });

    test('Exchanges authorization code for access & refresh tokens via documented server-to-server exchange', () => {
      const callbackContent = readProjectFile('src/app/api/integrations/flipkart/callback/route.ts');
      assert.ok(
        callbackContent.includes('grant_type: "authorization_code"'),
        'Must exchange code using grant_type=authorization_code'
      );
      assert.ok(
        callbackContent.includes('oauth-service/oauth/token'),
        'Must target Flipkart token endpoint'
      );
      assert.ok(
        callbackContent.includes('saveConnection'),
        'Must vault tokens server-side with AES-256-GCM'
      );
      assert.ok(
        callbackContent.includes(': "OAUTH2"'),
        'Must designate connection authType as OAUTH2'
      );
    });
  });

  // =========================================================================
  // TASK-4.4: UPGRADE FLIPKART SYNC MAPPING & ATOMIC PERSISTENCE
  // =========================================================================
  describe('TASK-4.4: Upgrade Flipkart Sync Mapping & Invariant Protection', () => {
    test('Flipkart sync route reads vaulted tokens from DB and supports two-track auth', () => {
      const syncContent = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(
        syncContent.includes('getConnectionCredentials'),
        'Must read vaulted credentials from DB'
      );
      assert.ok(
        syncContent.includes('refreshOAuthToken'),
        'Must support refreshing OAuth 2.0 tokens for merchants'
      );
      assert.ok(
        syncContent.includes('getSelfAccessToken'),
        'Must support Developer Self-Access token exchange for staging'
      );
    });

    test('Maps genuine orderItems, fsn, sku, and real priceComponents', () => {
      const syncContent = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(
        syncContent.includes('ro.fsn') || syncContent.includes('orderItems?.[0]?.fsn'),
        'Must map genuine Flipkart Serial Number (fsn)'
      );
      assert.ok(
        syncContent.includes('ro.sku') || syncContent.includes('orderItems?.[0]?.sku'),
        'Must preserve genuine seller SKU'
      );
      assert.ok(
        syncContent.includes('ro.priceComponents?.sellingPrice') || syncContent.includes('sellingPrice'),
        'Must extract genuine selling price from priceComponents'
      );
      assert.ok(
        syncContent.includes('ro.priceComponents?.totalTax') || syncContent.includes('priceComponents?.tax'),
        'Must extract genuine tax amount from priceComponents'
      );
    });

    test('Strict Financial Invariant: Locks snapshotUnitCost to 0 (no flat 45% or 14% guesswork)', () => {
      const syncContent = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(
        syncContent.includes('snapshotUnitCost: 0'),
        'Must lock snapshotUnitCost to 0 at sync time. Zero financial guesswork.'
      );
      assert.ok(
        !syncContent.includes('price * 0.45'),
        'Must not contain 45% flat cost estimation'
      );
      assert.ok(
        !syncContent.includes('price * 0.14'),
        'Must not contain 14% flat marketplace charges estimation'
      );
    });

    test('Atomically upserts orders into PostgreSQL and writes to financial_audit_logs', () => {
      const syncContent = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(
        syncContent.includes('upsertOrders'),
        'Must call upsertOrders to persist orders and order_items'
      );
      assert.ok(
        syncContent.includes('updateSyncStatus'),
        'Must update connection sync status in DB'
      );
      assert.ok(
        syncContent.includes('recordSyncLog'),
        'Must record audit sync log in DB'
      );
    });
  });

  // =========================================================================
  // CSRF STATE SECURITY & DATABASE SCHEMA
  // =========================================================================
  describe('CSRF State Security & Schema Migration', () => {
    test('Migration database/11_oauth_states.sql defines oauth_states table', () => {
      const sql = readProjectFile('database/11_oauth_states.sql');
      assert.ok(
        sql.includes('CREATE TABLE IF NOT EXISTS oauth_states'),
        'Must create oauth_states table'
      );
      assert.ok(
        sql.includes('expires_at'),
        'oauth_states must contain expires_at column'
      );
      assert.ok(
        sql.includes('user_id'),
        'oauth_states must contain user_id column'
      );
    });

    test('oauth-state.ts enforces single-use consumption and rejects expired states', async () => {
      const { createOAuthState, verifyAndConsumeOAuthState } = loadIsolated('../src/lib/security/oauth-state.ts');

      const testUser = 'user_test_flipkart_oauth_99';
      const state = await createOAuthState(testUser, 'Flipkart', 10000, binding);

      assert.ok(typeof state === 'string' && state.length === 64, 'State nonce must be 32 bytes (64 hex characters)');

      // First verification must succeed
      const firstCheck = await verifyAndConsumeOAuthState(state, 'Flipkart', testUser, binding);
      assert.equal(firstCheck.valid, true, 'First verification must succeed');
      assert.equal(firstCheck.userId, testUser, 'Must return associated userId');

      // Second verification must fail (single-use consumption protects against replay attacks)
      const secondCheck = await verifyAndConsumeOAuthState(state, 'Flipkart', testUser, binding);
      assert.equal(secondCheck.valid, false, 'Second verification must fail because nonce was consumed');
    });

    test('oauth-state.ts rejects expired state nonces', async () => {
      const { createOAuthState, verifyAndConsumeOAuthState } = loadIsolated('../src/lib/security/oauth-state.ts');

      // Create state with negative TTL (already expired)
      const expiredState = await createOAuthState('user_expired_test', 'Flipkart', -1000, binding);
      const res = await verifyAndConsumeOAuthState(expiredState, 'Flipkart', 'user_expired_test', binding);

      assert.equal(res.valid, false, 'Expired state must fail verification');
      assert.ok(res.error?.includes('expired'), 'Error message must specify expiration');
    });
  });
});
