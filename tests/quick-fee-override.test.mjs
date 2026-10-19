import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const db = '@/lib/db';

test('order persistence recalculates quick commission server-side and snapshots its rate and components', async () => {
  const statements = [];
  const ruleRows = [
    { id: 'rule-1', marketplace: 'Amazon India', sku: null, product_category: null, fulfilment_mode: null,
      min_unit_price_paise: null, max_unit_price_paise: null, effective_from: '2026-01-01', effective_to: null,
      version: 3, status: 'ACTIVE', component_id: 'commission', component_name: 'Commission', component_type: 'COMMISSION',
      calculation_method: 'PERCENT', rate_bps: 1250, amount_paise: null, calculation_base: 'ITEM_AFTER_DISCOUNT',
      tax_treatment: 'NO_TAX', tax_rate_bps: null, sequence: 1 },
    { id: 'rule-1', marketplace: 'Amazon India', sku: null, product_category: null, fulfilment_mode: null,
      min_unit_price_paise: null, max_unit_price_paise: null, effective_from: '2026-01-01', effective_to: null,
      version: 3, status: 'ACTIVE', component_id: 'logistics', component_name: 'Logistics', component_type: 'LOGISTICS',
      calculation_method: 'PERCENT', rate_bps: 500, amount_paise: null, calculation_base: 'ITEM_AFTER_DISCOUNT',
      tax_treatment: 'NO_TAX', tax_rate_bps: null, sequence: 2 },
  ];
  const client = { query: async (sql, params = []) => {
    statements.push({ sql, params });
    if (sql.includes('FROM marketplace_fee_rules')) return { rows: ruleRows };
    if (sql.includes('SELECT id, display_id, quick_fee_rate_bps FROM orders')) return { rows: [] };
    if (sql.includes('SELECT sku, category FROM products')) return { rows: [] };
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 'order-uuid', display_id: 'order-1', is_insert: true }] };
    if (sql.includes('INSERT INTO order_fee_estimates')) return { rows: [{ id: 'estimate-uuid' }] };
    return { rows: [] };
  }, release: () => {} };
  const persistence = load('src/lib/integrations/order-persistence.ts', {
    [db]: { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } },
  });
  await persistence.upsertOrders('tenant-A', [{ id: 'order-1', channelOrderId: 'channel-1', marketplace: 'Amazon India',
    orderDate: '2026-10-18', status: 'DELIVERED', customerName: 'Customer', customerCity: 'City', customerState: 'State',
    shippingFeeCharged: 0, marketplaceChargesEstimate: 999, quickFeeRateBps: 1000,
    items: [{ id: 'line-1', sku: 'SKU-A', productName: 'Item', quantity: 1, sellingPrice: 100, discount: 10,
      taxAmount: 10, snapshotUnitCost: 50, returnedQuantity: 0 }] }]);

  const header = statements.find(entry => entry.sql.includes('INSERT INTO orders'));
  assert.equal(header.params[12], 1000);
  assert.equal(header.params[14], true);
  assert.equal(header.params[15], '12.50');
  assert.notEqual(header.params[15], '999');
  const estimate = statements.find(entry => entry.sql.includes('INSERT INTO order_fee_estimates'));
  assert.equal(estimate.params[3], 1250);
  assert.equal(estimate.params[4], 2);
  const snapshot = JSON.parse(estimate.params[5]);
  assert.equal(snapshot.quickFeeRateBps, 1000);
  const components = statements.filter(entry => entry.sql.includes('INSERT INTO order_fee_estimate_components'));
  assert.equal(components.length, 2);
  const quickCommission = components.find(entry => entry.params[7] === 'COMMISSION');
  assert.ok(quickCommission);
  assert.equal(quickCommission.params[2], null);
  assert.equal(quickCommission.params[4], null);
  assert.equal(quickCommission.params[11], 800);
  const audit = statements.find(entry => entry.sql.includes("'fee_estimate_snapshot'"));
  assert.equal(JSON.parse(audit.params[2]).calculationVersion, 2);
});

test('order persistence preserves unknown fees when neither rules nor quick rate are present', async () => {
  const statements = [];
  const client = { query: async (sql, params = []) => {
    statements.push({ sql, params });
    if (sql.includes('SELECT id, display_id, quick_fee_rate_bps FROM orders')) return { rows: [] };
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 'order-uuid', display_id: 'order-1', is_insert: true }] };
    return { rows: [] };
  }, release: () => {} };
  const persistence = load('src/lib/integrations/order-persistence.ts', {
    [db]: { ensureMarketplaceTables: async () => {}, pool: { connect: async () => client } },
  });
  const result = await persistence.upsertOrders('tenant-A', [{ id: 'order-1', channelOrderId: 'channel-1', marketplace: 'Amazon India',
    orderDate: '2026-10-18', status: 'DELIVERED', marketplaceChargesEstimate: 999, items: [{ id: 'line-1', sku: 'SKU-A',
      productName: 'Item', quantity: 1, sellingPrice: 100, discount: 0, taxAmount: 0, snapshotUnitCost: 50, returnedQuantity: 0 }] }]);
  const header = statements.find(entry => entry.sql.includes('INSERT INTO orders'));
  assert.equal(header.params[14], false);
  assert.equal(result.feeEstimates[0].status, 'NOT_CONFIGURED');
  assert.equal(result.feeEstimates[0].totalPaise, null);
});
