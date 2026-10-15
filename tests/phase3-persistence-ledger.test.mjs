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

describe('Phase 3 Transactional Persistence, Queues & Financial Ledger Rigor Test Suite', () => {

  // =========================================================================
  // SUITE 1: TRANSACTIONAL ACID PERSISTENCE (order-persistence.ts)
  // =========================================================================
  describe('Suite 1: Transactional ACID Persistence', () => {
    test('1.1 upsertOrders wraps database mutations in BEGIN...COMMIT / ROLLBACK', () => {
      const code = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(code.includes('await client.query("BEGIN")'), 'upsertOrders must begin an explicit database transaction');
      assert.ok(code.includes('await client.query("COMMIT")'), 'upsertOrders must commit the transaction on completion');
      assert.ok(code.includes('await client.query("ROLLBACK")'), 'upsertOrders must rollback the transaction on failure');
      assert.ok(code.includes('client.release()'), 'upsertOrders must release the connection back to the pool');
    });

    test('1.2 upsertSettlements wraps database mutations in BEGIN...COMMIT / ROLLBACK', () => {
      const code = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(code.includes('upsertSettlements'), 'upsertSettlements function must exist');
      // Verify both functions invoke transactional BEGIN
      const beginMatches = code.match(/client\.query\("BEGIN"\)/g);
      assert.ok(beginMatches && beginMatches.length >= 2, 'Both upsertOrders and upsertSettlements must invoke BEGIN');
      const commitMatches = code.match(/client\.query\("COMMIT"\)/g);
      assert.ok(commitMatches && commitMatches.length >= 2, 'Both upsertOrders and upsertSettlements must invoke COMMIT');
      const rollbackMatches = code.match(/client\.query\("ROLLBACK"\)/g);
      assert.ok(rollbackMatches && rollbackMatches.length >= 2, 'Both upsertOrders and upsertSettlements must invoke ROLLBACK');
    });

    test('1.3 order-persistence.ts imports and uses connection pool from db.ts', () => {
      const code = readProjectFile('src/lib/integrations/order-persistence.ts');
      assert.ok(code.includes('pool') && code.includes('@/lib/db'), 'Must import pool from db.ts');
      assert.ok(code.includes('pool.connect()'), 'Must acquire dedicated client connection for transactions');
    });
  });

  // =========================================================================
  // SUITE 2: RESILIENT WEBHOOK INGESTION & DURABLE DB PERSISTENCE
  // =========================================================================
  describe('Suite 2: Resilient Webhook Ingestion & Durable DB Persistence', () => {
    test('2.1 WooCommerce webhook captures x-wc-webhook-delivery-id for per-delivery idempotency', () => {
      const code = readProjectFile('src/app/api/webhooks/woocommerce/route.ts');
      assert.ok(code.includes('x-wc-webhook-delivery-id'), 'Must read x-wc-webhook-delivery-id header');
      assert.ok(code.includes('webhookDeliveryId'), 'Must use per-delivery ID for idempotency check');
    });

    test('2.2 WooCommerce webhook persists incoming orders directly to PostgreSQL', () => {
      const code = readProjectFile('src/app/api/webhooks/woocommerce/route.ts');
      assert.ok(code.includes('persistWebhookOrder'), 'Must import and invoke upsertOrders');
      assert.ok(code.includes('await persistWebhookOrder('), 'Must persist domainOrder directly to PostgreSQL');
    });

    test('2.3 Shopify webhook persists incoming orders directly to PostgreSQL', () => {
      const code = readProjectFile('src/app/api/webhooks/shopify/route.ts');
      assert.ok(code.includes('persistWebhookOrder'), 'Must import and invoke upsertOrders');
      assert.ok(code.includes('await persistWebhookOrder('), 'Must persist domainOrder directly to PostgreSQL');
    });
  });

  // =========================================================================
  // SUITE 3: FINANCIAL LEDGER RIGOR & HEURISTIC PURGE
  // =========================================================================
  describe('Suite 3: Financial Ledger Rigor & Heuristic Purge', () => {
    test('3.1 Purge 45% COGS heuristic from WooCommerce webhook schema', () => {
      const code = readProjectFile('src/lib/webhooks/schemas/woocommerce-schema.ts');
      assert.ok(!code.includes('* 0.45'), 'Arbitrary 45% COGS calculation must be purged');
      assert.ok(code.includes('catalogCostLookup?.[sku] ?? 0'), 'Uncataloged items must evaluate to 0 instead of guessing');
    });

    test('3.2 Purge 45% COGS heuristic from Shopify webhook schema', () => {
      const code = readProjectFile('src/lib/webhooks/schemas/shopify-schema.ts');
      assert.ok(!code.includes('* 0.45'), 'Arbitrary 45% COGS calculation must be purged');
      assert.ok(code.includes('catalogCostLookup?.[item.sku] ?? 0'), 'Uncataloged items must evaluate to 0 instead of guessing');
    });

    test('3.3 Purge 45% COGS heuristic from Generic webhook schema', () => {
      const code = readProjectFile('src/lib/webhooks/schemas/generic-schema.ts');
      assert.ok(!code.includes('* 0.45'), 'Arbitrary 45% COGS calculation must be purged');
    });

    test('3.4 Purge ₹350 fallback from computeReturnFinancials in profitability-engine.ts', () => {
      const code = readProjectFile('src/domain/profitability-engine.ts');
      assert.ok(!code.includes('currentCostPrice ?? 350'), '350 fallback in computeReturnFinancials must be purged');
      assert.ok(code.includes('currentCostPrice ?? 0'), 'Unset product costs must resolve to 0');
    });

    test('3.5 calculateBusinessProfitability accurately computes discounts and netSales', () => {
      const engine = loadApp("src/domain/profitability-engine.ts");
      const result = engine.calculateBusinessProfitability([{
        id: "order", channelOrderId: "order", marketplace: "WooCommerce", status: "DELIVERED", orderDate: "2026-10-15",
        shippingFeeCharged: 0, marketplaceChargesEstimate: 0,
        items: [{ id: "item", sku: "SKU", quantity: 2, sellingPrice: 100, discount: 20, snapshotUnitCost: 40, returnedQuantity: 0 }],
      }], [], [], [], []);
      assert.equal(result.discounts, 20);
      assert.equal(result.netSales, 180);
      assert.equal(result.grossProfit, 100);
    });
  });

  // =========================================================================
  // SUITE 4: TOKEN-BUCKET RATE LIMITER DEFENSE
  // =========================================================================
  describe('Suite 4: Token-Bucket Rate Limiter Defense', () => {
    test('4.1 rate-limiter.ts exists and enforces server-only execution', () => {
      const code = readProjectFile('src/lib/security/rate-limiter.ts');
      assert.ok(code.includes('typeof window !== "undefined"'), 'Must guard against client bundling');
      assert.ok(code.includes('TokenBucketRateLimiter'), 'Must declare TokenBucketRateLimiter class');
      assert.ok(code.includes('amazonSpApiLimiter'), 'Must export amazonSpApiLimiter preset');
      assert.ok(code.includes('marketplaceSyncLimiter'), 'Must export marketplaceSyncLimiter preset');
    });

    test('4.2 Amazon sync route enforces amazonSpApiLimiter', () => {
      const code = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(code.includes('amazonSpApiLimiter'), 'Must import amazonSpApiLimiter');
      assert.ok(code.includes('amazonSpApiLimiter.consume(userId)'), 'Must consume tokens per merchant user');
      assert.ok(code.includes('status: 429'), 'Must return 429 Too Many Requests when rate limit is exceeded');
      assert.ok(code.includes('"Retry-After"'), 'Must return Retry-After header with cooldown seconds');
    });

    test('4.3 WooCommerce & Generic sync routes enforce marketplaceSyncLimiter', () => {
      const wcCode = readProjectFile('src/app/api/integrations/woocommerce/sync/route.ts');
      assert.ok(wcCode.includes('marketplaceSyncLimiter.consume(userId)'), 'WooCommerce sync must enforce marketplaceSyncLimiter');
      assert.ok(wcCode.includes('status: 429'), 'WooCommerce sync must return 429 on exhaustion');

      const genCode = readProjectFile('src/app/api/integrations/generic/sync/route.ts');
      assert.ok(genCode.includes('marketplaceSyncLimiter.consume(userId)'), 'Generic sync must enforce marketplaceSyncLimiter');
      assert.ok(genCode.includes('status: 429'), 'Generic sync must return 429 on exhaustion');
    });
  });

  // =========================================================================
  // SUITE 5: BEHAVIORAL RATE LIMITER & FINANCIAL MATH SIMULATION
  // =========================================================================
  describe('Suite 5: Actual rate limiter and financial engine behavior with synthetic fixtures', () => {
    test('5.1 Actual limiter rejects a burst and reports the real retry delay', () => {
      const { TokenBucketRateLimiter } = loadApp('src/lib/security/rate-limiter.ts');
      const limiter = new TokenBucketRateLimiter({ capacity: 3, refillRatePerSec: 1 });
      for (let i = 0; i < 3; i++) assert.equal(limiter.consume('merchant').allowed, true);
      const denied = limiter.consume('merchant');
      assert.equal(denied.allowed, false);
      assert.equal(denied.retryAfterSeconds, 1);
      assert.equal(limiter.consume('another-merchant').allowed, true);
    });
    test('5.2 Actual financial engine recognizes source discounts and never guesses COGS', () => {
      const { calculateBusinessProfitability } = loadApp('src/domain/profitability-engine.ts');
      const order = { id: 'one', channelOrderId: 'one', marketplace: 'WooCommerce', orderDate: '2026-10-15', status: 'DELIVERED', shippingFeeCharged: 0, marketplaceChargesEstimate: 0, items: [
        { id: 'a', sku: 'A', quantity: 2, sellingPrice: 1000, discount: 200, snapshotUnitCost: 400, taxAmount: 0, returnedQuantity: 0 },
        { id: 'b', sku: 'B', quantity: 1, sellingPrice: 500, discount: 50, snapshotUnitCost: 0, taxAmount: 0, returnedQuantity: 0 },
      ] };
      const result = calculateBusinessProfitability([order], [], [], [], []);
      assert.equal(result.grossSales, 2500);
      assert.equal(result.discounts, 250);
      assert.equal(result.netSales, 2250);
      assert.equal(result.cogs, 800);
      assert.equal(result.grossProfit, 1450);
    });
  });
});
