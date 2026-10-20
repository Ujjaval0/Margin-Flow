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

describe('Store Integration Phase 3 Verification Suite', () => {

  // =========================================================================
  // TASK-3.1: UPGRADE TO CURRENT ORDERS SP-API & INDIA MARKETPLACE
  // =========================================================================
  describe('TASK-3.1: Current Orders SP-API Endpoint & India Region', () => {
    test('Amazon sync route targets SP-API EU endpoint with India Marketplace ID A21TJRUUN4KGV', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('sellingpartnerapi-eu.amazon.com'),
        'Must target sellingpartnerapi-eu.amazon.com regional endpoint for India'
      );
      assert.ok(
        routeContent.includes('A21TJRUUN4KGV'),
        'Must specify Amazon India marketplace ID A21TJRUUN4KGV'
      );
      assert.ok(
        routeContent.includes('/orders/2026-01-01/orders'),
        'Must query /orders/2026-01-01/orders SP-API endpoint'
      );
    });

    test('Zero Client-Side Master Secrets: Retrieves vaulted credentials server-side', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('getConnectionCredentials'),
        'Must retrieve credentials from secure vault'
      );
      assert.ok(
        routeContent.includes('getSessionUserId'),
        'Must isolate multi-tenant connection credentials by user ID'
      );
    });
  });

  // =========================================================================
  // TASK-3.2: AUTHENTIC MULTI-LINE ORDER ITEMS MAPPING
  // =========================================================================
  describe('TASK-3.2: Map Authentic Multi-Line Order Items & Zero Cost Guesswork', () => {
    test('Order items fetch queries genuine SP-API orderItems endpoint or embedded payload', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('amazonOrderSource'),
        'Must decode embedded 2026 order items'
      );
      assert.ok(
        routeContent.includes('SellerSKU'),
        'Must extract genuine SellerSKU from SP-API payload'
      );
      assert.ok(
        routeContent.includes('OrderItemId'),
        'Must preserve genuine OrderItemId'
      );
    });

    test('Financial Invariant: snapshotUnitCost is locked to 0 (no synthetic cost guesswork)', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('snapshotUnitCost: 0'),
        'Must lock snapshotUnitCost to 0 at sync time. Zero financial guesswork.'
      );
      assert.ok(
        !routeContent.includes('orderTotal * 0.45'),
        'Must not contain 45% flat cost estimation'
      );
      assert.ok(
        !routeContent.includes('orderTotal * 0.14'),
        'Must not contain 14% flat marketplace charges estimation'
      );
    });

    test('Order status mapping handles standard Amazon lifecycle states', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(routeContent.includes('ao.OrderStatus === "Shipped"'), 'Must handle Shipped state');
      assert.ok(routeContent.includes('ao.OrderStatus === "Delivered"'), 'Must handle Delivered state');
      assert.ok(routeContent.includes('ao.OrderStatus === "Canceled"'), 'Must handle Canceled state');
      assert.ok(routeContent.includes('ao.OrderStatus === "Pending"'), 'Must handle Pending state');
    });
  });

  // =========================================================================
  // TASK-3.3: CURSOR-BASED PAGINATION & 48-HOUR BOUNDED OVERLAP WINDOW
  // =========================================================================
  describe('TASK-3.3: Cursor-Based Pagination & Overlap Window', () => {
    test('Supports NextToken pagination parameter and extracts nextToken from response', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('NextToken'),
        'Must forward NextToken query parameter for pagination'
      );
      assert.ok(
        routeContent.includes('responseNextToken'),
        'Must capture response NextToken for subsequent page requests'
      );
      assert.ok(
        routeContent.includes('lastSyncCursor'),
        'Must save pagination cursor in marketplace_connections'
      );
    });

    test('Calculates 48-hour bounded overlap window on LastUpdatedAfter when lastSyncedAt exists', () => {
      const routeContent = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        routeContent.includes('48 * 60 * 60 * 1000'),
        'Must subtract 48 hours for bounded overlap window'
      );
      assert.ok(
        routeContent.includes('lastUpdatedAfter'),
        'Must query LastUpdatedAfter to safely capture order status transitions'
      );
    });
  });

  // =========================================================================
  // TASK-3.4: SEPARATE AMAZON FINANCES INGESTION ROUTE
  // =========================================================================
  describe('TASK-3.4: Build Separate Amazon Finances Ingestion', () => {
    test('Route src/app/api/integrations/amazon/finances/route.ts exists and queries SP-API finances', () => {
      const financesContent = readProjectFile('src/app/api/integrations/amazon/finances/route.ts');
      assert.ok(
        financesContent.includes('/finances/v0/financialEvents'),
        'Must query SP-API Finances endpoint /finances/v0/financialEvents'
      );
      assert.ok(
        financesContent.includes('retainAmazonEvents(client,userId,financialEvents)') && readProjectFile('src/lib/integrations/amazon-financial-events.ts').includes('ShipmentEventList'),
        'Route must retain source events through the owner-scoped projection module'
      );
    });

    test('Finances route itemizes authentic deductions (Referral, Closing, Weight Handling, TCS, TDS)', () => {
      const financesContent = readProjectFile('src/app/api/integrations/amazon/finances/route.ts');
      assert.ok(financesContent.includes('categorizeAmazonFee'), 'Must categorize Amazon fee types');
      assert.ok(financesContent.includes('"COMMISSION"'), 'Must categorize Referral fee as COMMISSION');
      assert.ok(financesContent.includes('"FIXED_FEE"'), 'Must categorize Closing fee as FIXED_FEE');
      assert.ok(financesContent.includes('"LOGISTICS"'), 'Must categorize Weight Handling as LOGISTICS');
      assert.ok(financesContent.includes('"TAX_TCS"'), 'Must categorize TCS GST withheld as TAX_TCS');
      assert.ok(financesContent.includes('"TAX_TDS"'), 'Must categorize TDS Section 194-O withheld as TAX_TDS');
    });

    test('Finances projections preserve signed finance evidence without asserting bank receipt', () => {
      const financesContent = readProjectFile('src/app/api/integrations/amazon/finances/route.ts');
      const projection = readProjectFile('src/lib/integrations/amazon-financial-events.ts');
      assert.ok(projection.includes('netSettlement:sumMoney([grossAmount,-sumMoney(deductions.map(d=>d.amount))])'), 'Source charges less signed itemized deductions must reconcile exactly');
      assert.ok(projection.includes("evidenceType:'FINANCIAL_EVENT'") && projection.includes("feeCoverage:'PARTIAL'"), 'A financial event does not prove bank receipt or complete fee evidence');
      assert.ok(projection.includes('provider_financial_events') && projection.includes('source_payload'), 'Unsupported events must retain original source evidence');
      assert.ok(
        !financesContent.includes('grossAmount * 0.85'),
        'Must not use estimated 85% settlement percentage'
      );
    });
  });

  // =========================================================================
  // TASK-3.5: ATOMIC DATABASE UPSERT & FINANCIAL AUDIT LOGS
  // =========================================================================
  describe('TASK-3.5: Atomic Database Upsert for Ingested Orders and Settlements', () => {
    test('Migration database/10_orders_idempotency.sql creates unique idempotency indexes', () => {
      const sql = readProjectFile('database/10_orders_idempotency.sql');
      assert.ok(
        sql.includes('uq_orders_channel_marketplace'),
        'Must create unique index uq_orders_channel_marketplace on (channel_order_id, marketplace)'
      );
      assert.ok(
        sql.includes('uq_settlements_batch_order'),
        'Must create unique index uq_settlements_batch_order on (settlement_batch_id, order_id)'
      );
      assert.ok(
        sql.includes('uq_order_items_order_sku'),
        'Must create unique index uq_order_items_order_sku on (order_id, sku)'
      );
    });

    test('src/lib/integrations/order-persistence.ts implements upsertOrders with ON CONFLICT DO UPDATE', () => {
      const persContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(
        persContent.includes('ON CONFLICT (user_id, channel_order_id, marketplace)'),
        'Must execute ON CONFLICT (user_id, channel_order_id, marketplace) DO UPDATE'
      );
      assert.ok(
        persContent.includes('financial_audit_logs'),
        'Must append to append-only financial_audit_logs'
      );
    });

    test('Order items updates respect immutable snapshot_unit_cost invariant (Trigger 2)', () => {
      const persContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(
        persContent.includes('UPDATE order_items'),
        'Must update existing order_items'
      );
      assert.ok(
        !persContent.includes('snapshot_unit_cost = EXCLUDED.snapshot_unit_cost'),
        'Must NEVER update snapshot_unit_cost to uphold trigger 2 invariant'
      );
    });

    test('src/lib/integrations/order-persistence.ts implements upsertSettlements', () => {
      const persContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(
        persContent.includes('ON CONFLICT (user_id, display_id)'),
        'Must upsert the same tenant record without overwriting other records in its batch'
      );
      assert.ok(
        persContent.includes('settlement_deductions'),
        'Must persist itemized deductions in settlement_deductions'
      );
    });
  });

  // =========================================================================
  // STORE CONTEXT: syncExternalSettlements INTEGRATION
  // =========================================================================
  describe('Store Context Integration', () => {
    test('src/domain/store.tsx provides syncExternalSettlements with audit logging', () => {
      const storeContent = readProjectFile('src/domain/store.tsx');
      assert.ok(
        storeContent.includes('syncExternalSettlements: (incomingSettlements: Settlement[])'),
        'Must declare syncExternalSettlements in StoreContextType'
      );
      assert.ok(
        storeContent.includes('const syncExternalSettlements = useCallback'),
        'Must implement syncExternalSettlements callback'
      );
      assert.ok(
        storeContent.includes("await fetch('/api/settlements'") && storeContent.includes('await refreshFromDatabase()'),
        'Store must await settlement persistence then refresh the authoritative ledger'
      );
      const writer = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(writer.includes("'SETTLEMENT'") && writer.includes('financial_audit_logs'), 'Settlement audit evidence must be committed by the server writer');
    });
  });
});
