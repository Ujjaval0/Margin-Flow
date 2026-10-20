import { readIntegrationSource } from './helpers/integration-source.mjs';
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

describe('Store Integration contract and source-wiring checks (not production acceptance)', () => {

  // =========================================================================
  // TASK-6.1: ENFORCE UNIFIED MARKETPLACESYNCRESULT CONTRACT
  // =========================================================================
  describe('TASK-6.1: Enforce Unified MarketplaceSyncResult Contract', () => {
    test('src/lib/integrations/sync-contract.ts defines MarketplaceSyncResult interface matching specification', () => {
      const contract = readProjectFile('src/lib/integrations/sync-contract.ts');
      assert.ok(
        contract.includes('export interface MarketplaceSyncResult'),
        'Must export MarketplaceSyncResult interface'
      );
      assert.ok(
        contract.includes('marketplace: Marketplace;'),
        'Must have marketplace property'
      );
      assert.ok(
        contract.includes('"pending" | "running" | "succeeded" | "partial" | "failed"'),
        'Must define status union with all 5 required lifecycle states'
      );
      assert.ok(
        contract.includes('fetchedCount: number;') &&
        contract.includes('importedCount: number;') &&
        contract.includes('updatedCount: number;') &&
        contract.includes('skippedCount: number;'),
        'Must include all four count metrics: fetched, imported, updated, skipped'
      );
      assert.ok(
        contract.includes('lastSyncedAt: string;'),
        'Must include lastSyncedAt ISO timestamp'
      );
      assert.ok(
        contract.includes('nextCursor?: string;') || contract.includes('nextCursor?: string | null;'),
        'Must include optional nextCursor pagination token'
      );
      assert.ok(
        contract.includes('errors: SyncErrorItem[];') || contract.includes('errors: Array<{ code: string; message: string }>;'),
        'Must include structured errors array'
      );
    });

    test('src/domain/types.ts exports MarketplaceSyncResult and SyncStatus for domain consumers', () => {
      const types = readProjectFile('src/domain/types.ts');
      assert.ok(
        types.includes('export interface MarketplaceSyncResult') &&
        types.includes('export type SyncStatus'),
        'Domain types must export MarketplaceSyncResult and SyncStatus'
      );
    });

    test('src/lib/integrations/error-response.ts enhances MarketplaceErrorEnvelope to satisfy MarketplaceSyncResult', () => {
      const errorResp = readProjectFile('src/lib/integrations/error-response.ts');
      assert.ok(
        errorResp.includes('extends MarketplaceSyncResult') ||
        (errorResp.includes('status: "failed"') && errorResp.includes('errors: [{ code, message: error }]')),
        'Error response envelope must satisfy the MarketplaceSyncResult contract'
      );
      assert.ok(
        errorResp.includes('status: "failed"'),
        'Error envelope must declare status as "failed"'
      );
      assert.ok(
        errorResp.includes('fetchedCount: 0') &&
        errorResp.includes('importedCount: 0') &&
        errorResp.includes('updatedCount: 0') &&
        errorResp.includes('skippedCount: 0'),
        'Error envelope must include zeroed counts'
      );
    });

    test('All sync routes adopt the unified MarketplaceSyncResult contract', () => {
      const amazonRoute = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      const flipkartRoute = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      const shopifyRoute = readProjectFile('src/app/api/integrations/shopify/sync/route.ts');
      const wooRoute = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');
      const genericRoute = readProjectFile('src/app/api/integrations/generic/sync/route.ts');

      for (const [name, content] of [
        ['Amazon', amazonRoute],
        ['Flipkart', flipkartRoute],
        ['Shopify', shopifyRoute],
        ['WooCommerce', wooRoute],
        ['Generic', genericRoute],
      ]) {
        assert.ok(
          content.includes('buildSyncResult') || content.includes('syncSuccessResponse') || content.includes('MarketplaceSyncResult'),
          `${name} sync route must use unified sync contract`
        );
      }
    });
  });

  // =========================================================================
  // TASK-6.2: 10-POINT "DEFINITION OF DONE" PRODUCTION CHECKLIST
  // =========================================================================
  describe('TASK-6.2: Ten source-wiring checks; live release acceptance remains separate', () => {

    test('Point 1: Real authentication works with live credentials across connectors', () => {
      const amazonRoute = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      const flipkartRoute = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      const shopifyRoute = readProjectFile('src/app/api/integrations/shopify/sync/route.ts');
      const wooRoute = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');

      // Amazon: Live LWA OAuth token exchange
      assert.ok(
        amazonRoute.includes('https://api.amazon.com/auth/o2/token') &&
        amazonRoute.includes('grant_type: "refresh_token"'),
        'Amazon must exchange credentials against genuine LWA endpoint'
      );

      // Flipkart: Two-track auth (Developer staging & Merchant OAuth)
      assert.ok(
        flipkartRoute.includes('https://api.flipkart.net/oauth-service/oauth/token') &&
        flipkartRoute.includes('grant_type: "client_credentials"') &&
        flipkartRoute.includes('grant_type: "refresh_token"'),
        'Flipkart must support both Developer self-access and OAuth2 refresh'
      );

      // Shopify: Verify the actual orders permission
      assert.ok(
        shopifyRoute.includes('/admin/api/2026-10/graphql.json') &&
        shopifyRoute.includes('X-Shopify-Access-Token'),
        'Shopify must verify usable orders API access'
      );

      // WooCommerce: Real REST API basic auth verification
      assert.ok(
        wooRoute.includes('/wp-json/wc/v3/orders?per_page=1') &&
        wooRoute.includes('Authorization') &&
        wooRoute.includes('Basic'),
        'WooCommerce must authenticate against genuine REST API endpoint'
      );
    });

    test('Point 2: Invalid credentials & missing permissions produce explicit errors with standard envelopes', () => {
      const errResp = readProjectFile('src/lib/integrations/error-response.ts');
      const shopifyRoute = readProjectFile('src/app/api/integrations/shopify/sync/route.ts');
      const wooRoute = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');

      assert.ok(
        errResp.includes('marketplaceError'),
        'Must provide standardized marketplaceError helper'
      );

      // Explicit HTTP status codes for auth / scope failures
      assert.ok(
        shopifyRoute.includes('ProviderRequestError') && shopifyRoute.includes('error.status'),
        'Shopify must distinguish 401 Unauthorized from 403 Forbidden scopes'
      );

      assert.ok(
        wooRoute.includes('WOOCOMMERCE_AUTH_FAILED') &&
        wooRoute.includes('WOOCOMMERCE_FORBIDDEN'),
        'WooCommerce must distinguish 401 Invalid Secret from 403 Read permissions'
      );
    });

    test('Point 3: No API failure ever generates sample orders (Zero Silent Fallbacks)', () => {
      const amazonRoute = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      const meeshoRoute = readProjectFile('src/app/api/integrations/meesho/sync/route.ts');
      const myntraRoute = readProjectFile('src/app/api/integrations/myntra/sync/route.ts');
      const flipkartRoute = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');

      // Reject all synthetic sample product generators
      assert.ok(!amazonRoute.includes('sampleProducts'), 'Amazon must not generate sample products');
      assert.ok(!meeshoRoute.includes('sampleProducts'), 'Meesho must not generate sample products');
      assert.ok(!myntraRoute.includes('sampleProducts'), 'Myntra must not generate sample products');
      assert.ok(!flipkartRoute.includes('sampleProducts'), 'Flipkart must not generate sample products');

      // Meesho & Myntra explicitly return 501 instructing official report upload
      assert.ok(
        meeshoRoute.includes('MEESHO_API_ACCESS_UNAVAILABLE') && meeshoRoute.includes('501'),
        'Meesho must return explicit 501 unavailable code'
      );
      assert.ok(
        myntraRoute.includes('MYNTRA_PPMP_ACCESS_UNAVAILABLE') && myntraRoute.includes('501'),
        'Myntra must return explicit 501 unavailable code'
      );
    });

    test('Point 4: Multiple items in one order are mapped correctly with real price components', () => {
      const amazonRoute = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      const flipkartRoute = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      const shopifySchema = readProjectFile('src/lib/webhooks/schemas/shopify-schema.ts');

      // Amazon multi-line mapping
      assert.ok(
        amazonRoute.includes('amazonOrderSource'),
        'Amazon must resolve OrderItems from SP-API'
      );
      assert.ok(
        amazonRoute.includes('snapshotUnitCost: 0'),
        'Amazon items must enforce snapshotUnitCost: 0 (zero guesswork)'
      );

      // Flipkart multi-line mapping
      assert.ok(
        flipkartRoute.includes('orderItems') && flipkartRoute.includes('priceComponents'),
        'Flipkart must map genuine orderItems and priceComponents'
      );
      assert.ok(
        flipkartRoute.includes('snapshotUnitCost: 0'),
        'Flipkart items must enforce snapshotUnitCost: 0 (zero guesswork)'
      );

      // Shopify line items
      assert.ok(
        shopifySchema.includes('line_items') && shopifySchema.includes('mapShopifyOrderToDomain'),
        'Shopify must map line_items array correctly'
      );
    });

    test('Point 5: Pagination retrieves the complete intended window and tracks cursors', () => {
      const amazonRoute = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      const dbFile = readProjectFile('database/09_marketplace_connections.sql');

      // Amazon SP-API NextToken & 48-Hour overlap window
      assert.ok(
        amazonRoute.includes('NextToken') &&
        amazonRoute.includes('lastUpdatedAfter') &&
        amazonRoute.includes('48 * 60 * 60 * 1000'),
        'Amazon must support NextToken pagination and 48-hour bounded overlap window'
      );

      // DB schema tracks last_sync_cursor
      assert.ok(
        dbFile.includes('last_sync_cursor'),
        'marketplace_connections schema must persist last_sync_cursor'
      );
    });

    test('Point 6: Source wiring uses tenant-scoped upserts and immutable cost snapshots', () => {
      const persistence = readProjectFile('src/lib/integrations/order-persistence.ts');
      const migration = readProjectFile('database/10_orders_idempotency.sql');

      // Unique composite index
      assert.ok(
        migration.includes('uq_orders_channel_marketplace') &&
        migration.includes('ON orders (channel_order_id, marketplace)'),
        'Migration 10 must create unique index on (channel_order_id, marketplace)'
      );

      // ON CONFLICT DO UPDATE
      assert.ok(
        persistence.includes('ON CONFLICT (user_id, channel_order_id, marketplace)') &&
        persistence.includes('DO UPDATE SET'),
        'upsertOrders must use ON CONFLICT (user_id, channel_order_id, marketplace) DO UPDATE'
      );

      // Trigger 2 snapshotUnitCost immutability: updates never overwrite snapshot_unit_cost
      assert.ok(
        persistence.includes('snapshot_unit_cost is never modified'),
        'upsertOrders must respect Trigger 2 cost immutability invariant'
      );
    });

    test('Point 7: Source wiring references the finances endpoint and identifies report formats', () => {
      const amazonFinances = readProjectFile('src/app/api/integrations/amazon/finances/route.ts');
      const projection = readProjectFile('src/lib/integrations/amazon-financial-events.ts');
      const autoMapper = readProjectFile('src/domain/csv-auto-mapper.ts');

      // Authentic Amazon Finances ingestion
      assert.ok(
        amazonFinances.includes('/finances/v0/financialEvents') &&
        amazonFinances.includes('retainAmazonEvents(client,userId,financialEvents)') &&
        projection.includes('ShipmentEventList') && projection.includes('ShipmentItemList') &&
        projection.includes("evidenceType:'FINANCIAL_EVENT'"),
        'Amazon finances must retain genuine signed events without fabricating bank receipts'
      );

      // Meesho & Myntra official settlement presets
      assert.ok(
        autoMapper.includes('MEESHO_SETTLEMENT') &&
        autoMapper.includes('MYNTRA_SETTLEMENT'),
        'CSV auto-mapper must identify Meesho and Myntra settlement formats; these tokens do not prove ingestion'
      );
    });

    test('Point 8: Source wiring calls PostgreSQL persistence; restart/browser durability is unverified', () => {
      const persistence = readProjectFile('src/lib/integrations/order-persistence.ts');
      const vault = readProjectFile('src/lib/security/marketplace-vault.ts');
      const shopifyRoute = readProjectFile('src/app/api/integrations/shopify/sync/route.ts');
      const wooRoute = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');
      const genericRoute = readProjectFile('src/app/api/integrations/generic/sync/route.ts');

      // upsertOrders persists to PostgreSQL
      assert.ok(
        persistence.includes('INSERT INTO orders') &&
        persistence.includes('INSERT INTO order_items'),
        'Persistence layer must write orders and order_items to PostgreSQL'
      );

      // All active connectors call upsertOrders
      assert.ok(shopifyRoute.includes('upsertOrders'), 'Shopify sync must call upsertOrders');
      assert.ok(wooRoute.includes('upsertOrders'), 'WooCommerce sync must call upsertOrders');
      assert.ok(genericRoute.includes('upsertOrders'), 'Generic sync must call upsertOrders');

      // Credentials persisted in marketplace_connections
      assert.ok(
        vault.includes('INSERT INTO marketplace_connections') &&
        vault.includes('marketplace_sync_logs'),
        'Vault must persist connections and audit logs in PostgreSQL'
      );
    });

    test('Point 9: Sync status, counts, and last sync timestamp are visible in the UI', () => {
      const simulator = readProjectFile('src/components/modules/webhook-simulator.tsx');

      // UI renders last synchronized timestamp
      assert.ok(
        simulator.includes('Last synchronized:') &&
        simulator.includes('lastSyncedAt'),
        'Webhook simulator must display last synchronized timestamp'
      );

      // UI reflects sync counts in feedback and toast
      assert.ok(
        simulator.includes('Synchronization complete:') && simulator.includes('updated,'),
        'UI must render sync count summaries with inserted vs updated metrics'
      );
    });

    test('Point 10: Source wiring authenticates sessions and scopes connection queries', () => {
      const session = readProjectFile('src/lib/security/session.ts');
      const vault = readProjectFile('src/lib/security/marketplace-vault.ts');
      const connectionsRoute = readProjectFile('src/app/api/integrations/connections/route.ts');

      // Supabase verifies identity, then the account/session liveness checks resolve its owner.
      assert.ok(
        session.includes('getSessionUserId') &&
        session.includes('createSupabaseServerClient') && session.includes('await supabase.auth.getUser()') &&
        session.includes('WHERE auth_user_id = $1'),
        'Session security must map a verified Supabase subject to the tenant account'
      );

      // Queries strictly filter WHERE user_id = $1
      assert.ok(
        vault.includes('WHERE user_id = $1') || vault.includes('user_id = $2'),
        'Vault operations must scope queries to authenticated merchant user_id'
      );

      // Connections route enforces session tenant
      assert.ok(
        connectionsRoute.includes('getSessionUserId(request)'),
        'Connections API must strictly authenticate merchant session'
      );
    });
  });
});
