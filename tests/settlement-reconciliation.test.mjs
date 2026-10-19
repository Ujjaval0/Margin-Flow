import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const loadApp = createRequire(import.meta.url)('./helpers/load-app.cjs');

test('settlement API reports cumulative actual fees with explicit order scope across batches', async () => {
  const settlements = [
    { id: 'batch-a', display_id: 'SET-A', settlement_batch_id: 'A', marketplace: 'Amazon India', settlement_date: '2026-10-01',
      order_id: 'order-uuid', gross_amount: '100.00', tcs_tds_tax: '0', net_settlement: '88.00', reconciliation_status: 'MATCHED',
      order_uuid: 'order-uuid', order_display_id: 'ORD-1', order_channel_id: 'CHANNEL-1', fee_estimate_id: 'estimate-1',
      fee_estimate_status: 'CONFIGURED', fee_estimate_total_paise: 1500 },
    { id: 'batch-b', display_id: 'SET-B', settlement_batch_id: 'B', marketplace: 'Amazon India', settlement_date: '2026-10-02',
      order_id: 'order-uuid', gross_amount: '40.00', tcs_tds_tax: '0', net_settlement: '36.50', reconciliation_status: 'MATCHED',
      order_uuid: 'order-uuid', order_display_id: 'ORD-1', order_channel_id: 'CHANNEL-1', fee_estimate_id: 'estimate-1',
      fee_estimate_status: 'CONFIGURED', fee_estimate_total_paise: 1500 },
  ];
  const rows = [
    { settlement_id: 'batch-a', category: 'COMMISSION', name: 'Commission', amount: '12.00' },
    { settlement_id: 'batch-b', category: 'LOGISTICS', name: 'Logistics', amount: '3.50' },
  ];
  const adapter = {
    ensureMarketplaceTables: async () => {},
    query: async sql => {
      if (sql.includes('FROM settlements s JOIN settlement_deductions d')) return { rows: [
        { order_id: 'order-uuid', category: 'COMMISSION', name: 'Commission', amount: '12.00' },
        { order_id: 'order-uuid', category: 'LOGISTICS', name: 'Logistics', amount: '3.50' },
      ] };
      if (sql.includes('FROM statutory_withholding_rates')) return { rows: [] };
      if (sql.includes('FROM order_fee_estimate_components')) return { rows: [] };
      if (sql.includes('FROM settlement_deductions')) return { rows };
      if (sql.includes('FROM settlements s')) return { rows: settlements };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const route = loadApp('src/app/api/settlements/route.ts', {
    '@/lib/db': adapter,
    '@/lib/security/session': { getSessionUserId: async () => 'tenant-a' },
  });
  const request = new Request('https://example.test/api/settlements');
  request.nextUrl = { searchParams: new URLSearchParams() };
  const response = await route.GET(request);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.settlements.length, 2);
  for (const settlement of result.settlements) {
    assert.equal(settlement.feeReconciliationScope, 'ORDER');
    assert.equal(settlement.feeReconciliation.actualTotalPaise, 1550);
  }
  assert.deepEqual(result.settlements.map(settlement => settlement.deductions[0].amount), [12, 3.5]);
});
