import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { databaseConnectionOptions } from '@/lib/database-connection';
declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _marketplaceSchemaReadiness: { expiresAt: number; promise: Promise<void> } | undefined;
}
const connectionString = process.env.DATABASE_URL ||
  (process.env.NODE_ENV !== 'production' ? 'postgresql://postgres:postgres@localhost:5432/marginflow_dev' : undefined);
const postgresPool = global._postgresPool || new Pool({
  // A job transaction and its independent progress/cancellation query need two connections.
  ...databaseConnectionOptions(connectionString), max: process.env.VERCEL === '1' ? 2 : 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 300000,
  statement_timeout: 15000, query_timeout: 20000,
});
// Reuse warm connections across route bundles as well as development reloads.
global._postgresPool = postgresPool;
function requireDatabaseConfiguration(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.trim())
    throw new Error('DATABASE_URL must be configured before database operations.');
}
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  requireDatabaseConfiguration();
  return postgresPool.query<T>(text, params);
}
// Every direct transaction uses the same configuration and timeout guards.
export const pool = {
  connect(): Promise<PoolClient> { requireDatabaseConfiguration(); return postgresPool.connect(); },
  query,
};
/** Read-only schema readiness check. Migrations run outside request handlers. */
async function checkMarketplaceTables(): Promise<void> {
  const result = await query<{ ready: boolean }>("SELECT NOT EXISTS (SELECT 1 FROM (VALUES ('orders','user_id'),('orders','fee_estimate_status'),('orders','fulfilment_mode'),('orders','quick_fee_rate_bps'),('order_items','line_subtotal'),('products','weight_grams'),('settlements','tcs_tax'),('settlement_deductions','gst_amount'),('settlements','user_id'),('products','user_id'),('suppliers','user_id'),('ai_staged_documents','user_id'),('marketplace_connections','encrypted_credentials'),('marketplace_sync_logs','user_id'),('oauth_states','state'),('oauth_states','client_id'),('oauth_states','redirect_uri'),('marketplace_connections','sync_checkpoints'),('file_import_logs','user_id'),('webhook_receipts','connection_id'),('ledger_archives','patch'),('settlements','deleted_at'),('expenses','user_id'),('return_records','recovered_at'),('claims','recovered_at'),('expenses','recovered_at'),('auth_sessions','token_hash'),('auth_sessions','revoked_at'),('orders','record_data'),('order_items','record_data'),('settlements','record_data'),('settlement_deductions','record_data'),('purchase_bills','user_id'),('supplier_payments','advance_amount'),('ai_staged_documents','deleted_at'),('financial_audit_logs','sequence'),('customer_complaints','record_data'),('integration_tasks','lease_token'),('integration_tasks','encrypted_payload'),('provider_deferred_orders','encrypted_payload')) AS required(table_name,column_name) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=required.table_name AND c.column_name=required.column_name)) AND to_regclass('public.statutory_withholding_rates') IS NOT NULL AND to_regclass('public.channel_accounting_policies') IS NOT NULL AND to_regclass('public.marketplace_fee_rules') IS NOT NULL AND to_regclass('public.marketplace_fee_rule_components') IS NOT NULL AND to_regclass('public.order_fee_estimates') IS NOT NULL AND to_regclass('public.order_fee_estimate_components') IS NOT NULL AND to_regclass('public.marketplace_quick_fee_rates') IS NOT NULL AND to_regclass('public.financial_commands') IS NOT NULL AND to_regclass('public.provider_financial_events') IS NOT NULL AND to_regclass('public.v_order_profitability') IS NULL AS ready");
  if (result.rows[0]?.ready !== true) throw new Error('Database migrations through 20261020000300_store_connection_reliability.sql are required.');
}

// Schema migrations are deployment-time work; avoid querying information_schema
// on every authenticated ledger request. Retry immediately after failures and
// refresh the successful readiness result once per minute.
export function ensureMarketplaceTables(): Promise<void> {
  const cached = global._marketplaceSchemaReadiness;
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const entry: { expiresAt: number; promise: Promise<void> } = {
    expiresAt: Date.now() + 60_000,
    promise: Promise.resolve(),
  };
  entry.promise = checkMarketplaceTables().catch(error => {
    if (global._marketplaceSchemaReadiness === entry) global._marketplaceSchemaReadiness = undefined;
    throw error;
  });
  global._marketplaceSchemaReadiness = entry;
  return entry.promise;
}
export default pool;
