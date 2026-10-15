import { createRequire } from "node:module";
const loadApp = createRequire(import.meta.url)("./helpers/load-app.cjs");
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
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Phase 2 Database Multi-Tenancy & Single Source of Truth Test Suite', () => {

  // =========================================================================
  // SUITE 1: DDL & SCHEMA MULTI-TENANT ISOLATION
  // =========================================================================
  describe('Suite 1: Database DDL & Schema Multi-Tenant Isolation', () => {
    test('1.1 Migration file 13_multitenant_isolation.sql exists with user_id columns', () => {
      const sql = readProjectFile('database/13_multitenant_isolation.sql');
      assert.ok(sql.includes('ALTER TABLE orders ADD COLUMN user_id') && sql.includes("column_name = 'user_id'"), 'orders table must have user_id');
      assert.ok(sql.includes('ALTER TABLE settlements ADD COLUMN user_id') && sql.includes("column_name = 'user_id'"), 'settlements table must have user_id');
      assert.ok(sql.includes('ALTER TABLE products ADD COLUMN user_id') && sql.includes("column_name = 'user_id'"), 'products table must have user_id');
      assert.ok(sql.includes('ALTER TABLE suppliers ADD COLUMN user_id') && sql.includes("column_name = 'user_id'"), 'suppliers table must have user_id');
    });

    test('1.2 Composite unique constraints are scoped to user_id', () => {
      const sql = readProjectFile('database/13_multitenant_isolation.sql');
      assert.ok(sql.includes('uq_orders_user_channel_marketplace'), 'orders must have uq_orders_user_channel_marketplace');
      assert.ok(sql.includes('(user_id, channel_order_id, marketplace)'), 'orders constraint must scope to user_id, channel_order_id, marketplace');
      assert.ok(sql.includes('uq_settlements_user_batch_order'), 'settlements must have uq_settlements_user_batch_order');
      assert.ok(sql.includes('(user_id, settlement_batch_id, order_id)'), 'settlements constraint must scope to user_id, settlement_batch_id, order_id');
      assert.ok(sql.includes('uq_products_user_sku'), 'products must have uq_products_user_sku');
      assert.ok(sql.includes('(user_id, sku)'), 'products constraint must scope to user_id, sku');
    });

    test('1.3 schema readiness checks are read-only and fail closed', () => {
      const source = readProjectFile('src/lib/db.ts');
      assert.ok(source.includes('information_schema.columns'));
      assert.ok(source.includes('Database migrations through step 18 are required.'));
      assert.ok(!/CREATE TABLE|ALTER TABLE|CREATE INDEX/.test(source), 'Request handlers must not migrate schema');
      assert.ok(source.includes('connectionTimeoutMillis') && source.includes('statement_timeout'));
    });
  });

  // =========================================================================
  // SUITE 2: MULTI-TENANT PERSISTENCE LAYER (order-persistence.ts)
  // =========================================================================
  describe('Suite 2: Multi-Tenant Persistence Layer', () => {
    test('2.1 upsertOrders requires userId parameter and binds it in SQL', () => {
      const persistenceContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(persistenceContent.includes('export async function upsertOrders(') && persistenceContent.includes('userId: string,'), 'upsertOrders signature must enforce userId');
      assert.ok(persistenceContent.includes('if (!userId || typeof userId !== "string")'), 'Must guard against empty/null userId');
      assert.ok(persistenceContent.includes('user_id'), 'Must insert user_id into orders table');
      assert.ok(persistenceContent.includes('ON CONFLICT (user_id, channel_order_id, marketplace)'), 'Must resolve conflicts scoped to user_id');
    });

    test('2.2 upsertSettlements requires userId parameter and binds it in SQL', () => {
      const persistenceContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(persistenceContent.includes('export async function upsertSettlements(') && persistenceContent.includes('userId: string,'), 'upsertSettlements signature must enforce userId');
      assert.ok(persistenceContent.includes('if (!userId || typeof userId !== "string")'), 'Must guard against empty/null userId in settlements');
      assert.ok(persistenceContent.includes('user_id'), 'Must insert user_id into settlements table');
      assert.ok(persistenceContent.includes('ON CONFLICT (user_id, settlement_batch_id, order_id)'), 'Must resolve conflicts scoped to user_id in settlements');
    });

    test('2.3 Linked order lookups in settlements are scoped to tenant', () => {
      const persistenceContent = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(persistenceContent.includes('WHERE user_id = $1 AND (display_id = $2 OR channel_order_id = $2)'), 'Linked order lookups must be scoped to user_id to prevent cross-tenant linking');
    });
  });

  // =========================================================================
  // SUITE 3: SERVER-SIDE MULTI-TENANT API ROUTES
  // =========================================================================
  describe('Suite 3: Server-Side Multi-Tenant API Routes', () => {
    test('3.1 GET & POST /api/orders enforces session and filters by user_id', () => {
      const ordersRoute = readProjectFile('src/app/api/orders/route.ts');
      assert.ok(ordersRoute.includes('getSessionUserId(req)'), 'Must extract authenticated userId from session');
      assert.ok(ordersRoute.includes('status: 401') && ordersRoute.includes('Authentication required to access orders'), 'Must return 401 if unauthenticated on GET');
      assert.ok(ordersRoute.includes('WHERE o.user_id = $1'), 'GET query must strictly filter by user_id');
      assert.ok(ordersRoute.includes('upsertOrders(userId, orders)'), 'POST must pass authenticated userId to upsertOrders');
    });

    test('3.2 GET & POST /api/settlements enforces session and filters by user_id', () => {
      const settlementsRoute = readProjectFile('src/app/api/settlements/route.ts');
      assert.ok(settlementsRoute.includes('getSessionUserId(req)'), 'Must extract authenticated userId from session');
      assert.ok(settlementsRoute.includes('status: 401') && settlementsRoute.includes('Authentication required to access settlements'), 'Must return 401 if unauthenticated on GET');
      assert.ok(settlementsRoute.includes('WHERE s.user_id = $1'), 'GET query must strictly filter by user_id');
      assert.ok(settlementsRoute.includes('upsertSettlements(userId, settlements)'), 'POST must pass authenticated userId to upsertSettlements');
    });

    test('3.3 GET & POST /api/products enforces session and filters by user_id', () => {
      const productsRoute = readProjectFile('src/app/api/products/route.ts');
      assert.ok(productsRoute.includes('getSessionUserId(req)'), 'Must extract authenticated userId from session');
      assert.ok(productsRoute.includes('status: 401') && productsRoute.includes('Authentication required to access catalog products'), 'Must return 401 if unauthenticated on GET');
      assert.ok(productsRoute.includes('WHERE p.user_id = $1'), 'GET query must strictly filter by user_id');
      assert.ok(productsRoute.includes('ON CONFLICT (user_id, sku)'), 'POST upsert must be scoped to (user_id, sku)');
    });
  });

  // =========================================================================
  // SUITE 4: STORE HYDRATION & SINGLE SOURCE OF TRUTH
  // =========================================================================
  describe('Suite 4: Client Store Hydration & Single Source of Truth', () => {
    test('4.1 store.tsx exposes refreshFromDatabase and isSyncingWithDb in context', () => {
      const storeContent = readProjectFile('src/domain/store.tsx');
      assert.ok(storeContent.includes('refreshFromDatabase: () => Promise<void>;'), 'PlatformContextType must declare refreshFromDatabase');
      assert.ok(storeContent.includes('isSyncingWithDb: boolean;'), 'PlatformContextType must declare isSyncingWithDb');
      assert.ok(storeContent.includes('const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);'), 'PlatformProvider must declare isSyncingWithDb state');
    });

    test('4.2 refreshFromDatabase hydrates orders, settlements, and products from server APIs', () => {
      const storeContent = readProjectFile('src/domain/store.tsx');
      assert.ok(storeContent.includes('fetch("/api/auth/me"'), 'Must check user session before server sync');
      assert.ok(storeContent.includes('fetch("/api/orders?limit=2000"'), 'Must fetch orders from server API');
      assert.ok(storeContent.includes('fetch("/api/settlements?limit=2000"'), 'Must fetch settlements from server API');
      assert.ok(storeContent.includes('fetch("/api/products?limit=2000"'), 'Must fetch products from server API');
      assert.ok(storeContent.includes('setOrders(ordersJson.orders);'), 'Must update orders state from server response');
      assert.ok(storeContent.includes('setSettlements(settlementsJson.settlements);'), 'Must update settlements state from server response');
      assert.ok(storeContent.includes('setProducts(productsJson.products);'), 'Must update products state from server response');
    });

    test('4.3 caches are selected only using verified tenant identity', () => {
      const source = readProjectFile('src/domain/store.tsx');
      assert.ok(source.includes('readTenantSnapshot(localStorage, ownerId)'));
      assert.ok(source.includes('tenantLedgerKey(ownerId)'));
      assert.ok(source.includes('verifiedOwner.current === ownerId'));
      assert.ok(!source.includes('localStorage.getItem(LEDGER_STORAGE_KEY)'));
    });

    test('4.4 Store action mutations asynchronously persist to backend APIs', () => {
      const storeContent = readProjectFile('src/domain/store.tsx');
      assert.ok(storeContent.includes('fetch("/api/orders", {\n        method: "POST"'), 'addOrder and syncExternalOrders must push to /api/orders');
      assert.ok(storeContent.includes('fetch("/api/settlements", {\n        method: "POST"'), 'addSettlement and syncExternalSettlements must push to /api/settlements');
      assert.ok(storeContent.includes('fetch("/api/products", {\n        method: "POST"'), 'addProduct and bulkAddProducts must push to /api/products');
    });
  });

  // =========================================================================
  // SUITE 5: BEHAVIORAL CROSS-TENANT DATA ISOLATION SIMULATION
  // =========================================================================
  describe('Suite 5: Actual writer parameter binding with isolated adapters (not PostgreSQL isolation proof)', () => {
    test('5.1 Actual order and catalog writers bind each tenant for coincident source identifiers', async () => {
      const writes = [];
      for (const owner of ['A', 'B']) {
        const client = { query: async (sql, params) => {
          if (sql.includes('INSERT INTO orders')) { writes.push([sql, params]); return { rows: [{ id: 'uuid-' + owner, display_id: 'same-order', is_insert: true }] }; }
          if (sql.includes('INSERT INTO products')) { writes.push([sql, params]); return { rows: [{ is_insert: true }] }; }
          return { rows: [] };
        }, release() {} };
        const adapter = { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } };
        const persistence = loadApp('src/lib/integrations/order-persistence.ts', { '@/lib/db': adapter });
        await persistence.upsertOrders(owner, [{ id: 'same-order', channelOrderId: 'same-channel', marketplace: 'WooCommerce', items: [] }]);
        const route = loadApp('src/app/api/products/route.ts', { '@/lib/db': adapter, '@/lib/security/session': { getSessionUserId: () => owner } });
        const response = await route.POST(new Request('https://app.example', { method: 'POST', body: JSON.stringify({ product: { sku: 'SAME-SKU', currentCostPrice: owner === 'A' ? 20 : 30 } }) }));
        assert.equal(response.status, 200);
      }
      assert.deepEqual(writes.map(([, params]) => params[0]), ['A', 'A', 'B', 'B']);
      for (const [sql] of writes) assert.match(sql, /ON CONFLICT \(user_id,/);
      assert.equal(writes[0][1][2], writes[2][1][2]);
      assert.equal(writes[1][1][2], writes[3][1][2]);
    });
  });
});
