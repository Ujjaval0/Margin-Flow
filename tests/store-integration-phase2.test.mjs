import { readIntegrationSource } from './helpers/integration-source.mjs';
import { createRequire } from "node:module";
const loadApp = createRequire(import.meta.url)("./helpers/load-app.cjs");
const loadIsolated = (file) => loadApp(file.replace("../", ""), { "@/lib/db": { ensureMarketplaceTables: async () => {}, query: async () => { throw new Error("Isolated test database unavailable"); } } }, { process: { env: { NODE_ENV: "test", ENCRYPTION_MASTER_KEY: "a".repeat(64) } } });
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

describe('Store Integration Phase 2 Verification Suite', () => {

  // =========================================================================
  // TASK-2.1: DATABASE SCHEMA MIGRATION FOR MARKETPLACE CONNECTIONS
  // =========================================================================
  describe('TASK-2.1: Database Schema Migration for Marketplace Connections', () => {
    test('Migration script database/09_marketplace_connections.sql exists with required tables', () => {
      const sql = readProjectFile('database/09_marketplace_connections.sql');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS marketplace_connections'), 'Must create marketplace_connections table');
      assert.ok(sql.includes('encrypted_credentials'), 'marketplace_connections must contain encrypted_credentials');
      assert.ok(sql.includes('user_id'), 'marketplace_connections must contain user_id');
      assert.ok(sql.includes('uq_marketplace_connection'), 'Must enforce unique constraint on (user_id, marketplace, seller_id)');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS marketplace_sync_logs'), 'Must create marketplace_sync_logs table');
    });

    test('src/lib/db.ts exports a cached read-only readiness check and never migrates on requests', () => {
      const dbContent = readProjectFile('src/lib/db.ts');
      assert.match(dbContent, /export function ensureMarketplaceTables\(\): Promise<void>/);
      assert.ok(dbContent.includes('marketplace_connections') && dbContent.includes('marketplace_sync_logs'), 'Readiness must verify connector schema');
      assert.ok(dbContent.includes('information_schema.columns') && dbContent.includes('cached.expiresAt > Date.now()'), 'Verify schema and cache only successful readiness');
      assert.ok(dbContent.includes('global._marketplaceSchemaReadiness = undefined'), 'Failed readiness must allow a retry');
      assert.doesNotMatch(dbContent, /CREATE TABLE|ALTER TABLE|CREATE INDEX/);
    });
  });

  // =========================================================================
  // TASK-2.2: SERVER-SIDE AES-256-GCM ENCRYPTION VAULT
  // =========================================================================
  describe('TASK-2.2: Server-Side AES-256-GCM Encryption Vault', async () => {
    test('src/lib/security/encryption.ts implements client-side bundle barrier', () => {
      const encContent = readProjectFile('src/lib/security/encryption.ts');
      assert.ok(encContent.includes('typeof window !== "undefined"'), 'Must check for window to block client-side imports');
      assert.ok(encContent.includes('FATAL SECURITY VIOLATION'), 'Must throw fatal error on client bundle import');
    });

    test('AES-256-GCM encryptPayload and decryptPayload round-trip successfully', async () => {
      const { encryptPayload, decryptPayload } = loadIsolated('../src/lib/security/encryption.ts');

      const testPayload = {
        clientId: 'amzn_client_12345',
        clientSecret: 'secret_master_key_987654321',
        refreshToken: 'Atzr|IwEBIE_test_refresh_token_abcdef',
        sellerId: 'A2TEST12345678',
      };

      const encrypted = encryptPayload(testPayload);
      assert.ok(typeof encrypted === 'string', 'Encrypted payload must be a string');
      assert.ok(encrypted.includes(':'), 'Encrypted envelope must format as iv:authTag:ciphertext');

      const parts = encrypted.split(':');
      assert.equal(parts.length, 3, 'Must have exactly 3 parts: iv, tag, ciphertext');
      assert.equal(parts[0].length, 24, 'IV must be 12 bytes (24 hex characters)');
      assert.equal(parts[1].length, 32, 'Auth tag must be 16 bytes (32 hex characters)');

      const decrypted = decryptPayload(encrypted);
      assert.deepEqual(JSON.parse(JSON.stringify(decrypted)), testPayload, 'Decrypted payload must match original data exactly');
    });

    test('Tampered ciphertext fails authentication check', async () => {
      const { encryptPayload, decryptPayload } = loadIsolated('../src/lib/security/encryption.ts');

      const encrypted = encryptPayload({ token: 'secure_value' });
      const parts = encrypted.split(':');

      // Tamper with ciphertext by flipping last character
      const tamperedCipher = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
      const tamperedBlob = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

      assert.throws(
        () => decryptPayload(tamperedBlob),
        /Unsupported state or unable to authenticate data/,
        'Tampered ciphertext must fail GCM MAC verification'
      );
    });
  });

  // =========================================================================
  // TASK-2.3: PURGE SECRETS FROM BROWSER LOCALSTORAGE
  // =========================================================================
  describe('TASK-2.3: Purge Secrets from Browser localStorage', () => {
    test('saveChannelCredentials in webhook-simulator.tsx strictly strips secrets', () => {
      const comp = readProjectFile('src/components/modules/webhook-simulator.tsx');
      assert.ok(comp.includes('// Zero Client-Side Master Secrets'), 'Must document zero master secret standard');
      assert.ok(comp.includes('const safeMetadata: StoredChannelCredentials = {'), 'Must project only safeMetadata');
      assert.ok(!comp.includes('next = { ...prev, [channelId]: { ...(prev[channelId] || {}), ...creds } };'), 'Must not store raw creds');
    });

    test('webhook-simulator.tsx cleanses legacy secrets from localStorage on mount', () => {
      const comp = readProjectFile('src/components/modules/webhook-simulator.tsx');
      assert.ok(comp.includes('initVaultConnections'), 'Must initialize connections from server vault on mount');
      assert.ok(comp.includes('/api/integrations/connections'), 'Must query server connections API');
      assert.ok(comp.includes('sanitized[k] = {'), 'Must sanitize localStorage on mount');
    });
  });

  // =========================================================================
  // TASK-2.4 & 2.5: CONNECTION MANAGEMENT ROUTES & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('TASK-2.4 & 2.5: Server Connection Management & Multi-Tenant Query Isolation', () => {
    test('src/app/api/integrations/connections/route.ts exports GET, POST, DELETE handlers', () => {
      const routeContent = readProjectFile('src/app/api/integrations/connections/route.ts');
      assert.ok(routeContent.includes('export async function GET'), 'Must export GET handler');
      assert.ok(routeContent.includes('export async function POST'), 'Must export POST handler');
      assert.ok(routeContent.includes('export async function DELETE'), 'Must export DELETE handler');
      assert.ok(routeContent.includes('getSessionUserId'), 'Must extract authenticated session user_id');
    });

    test('marketplace-vault.ts strictly enforces multi-tenant query isolation (WHERE user_id = $1)', () => {
      const vaultContent = readProjectFile('src/lib/security/marketplace-vault.ts');
      assert.ok(vaultContent.includes('export async function getConnectionsForUser'), 'Must export getConnectionsForUser');
      assert.ok(vaultContent.includes('export async function saveConnection'), 'Must export saveConnection');
      assert.ok(vaultContent.includes('export async function getConnectionCredentials'), 'Must export getConnectionCredentials');
      assert.ok(vaultContent.includes('export async function disconnectConnection'), 'Must export disconnectConnection');
      assert.ok(vaultContent.includes('WHERE user_id = $1'), 'Must filter strictly by user_id = $1');
      assert.ok(vaultContent.includes('encryptPayload'), 'saveConnection must encrypt credentials with AES-256-GCM');
      assert.ok(vaultContent.includes('decryptPayload'), 'getConnectionCredentials must verify and decrypt credentials');
    });

    test('Sync routes (Amazon, Flipkart, Shopify, WooCommerce) resolve credentials from server vault', () => {
      const syncRoutes = [
        'src/app/api/integrations/amazon/sync/route.ts',
        'src/app/api/integrations/flipkart/sync/route.ts',
        'src/app/api/integrations/shopify/sync/route.ts',
        'src/app/api/integrations/woocommerce/sync/route.ts',
      ];

      for (const route of syncRoutes) {
        const content = readProjectFile(route);
        assert.ok(
          content.includes('getConnectionCredentials'),
          `${route} must resolve credentials from server vault`
        );
        assert.ok(
          content.includes('recordSyncLog'),
          `${route} must record sync logs in server vault`
        );
      }
    });
  });
});
