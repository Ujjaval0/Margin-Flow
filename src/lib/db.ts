import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}
const connectionString = process.env.DATABASE_URL ||
  (process.env.NODE_ENV !== 'production' ? 'postgresql://postgres:postgres@localhost:5432/marginflow_dev' : undefined);
const postgresPool = global._postgresPool || new Pool({
  connectionString, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  statement_timeout: 15000, query_timeout: 20000,
});
if (process.env.NODE_ENV !== 'production') global._postgresPool = postgresPool;
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
export async function ensureMarketplaceTables(): Promise<void> {
  const result = await query<{ ready: boolean }>("SELECT NOT EXISTS (SELECT 1 FROM (VALUES ('orders','user_id'),('settlements','user_id'),('products','user_id'),('suppliers','user_id'),('ai_staged_documents','user_id'),('marketplace_connections','encrypted_credentials'),('marketplace_sync_logs','user_id'),('oauth_states','state'),('oauth_states','client_id'),('oauth_states','redirect_uri'),('marketplace_connections','sync_checkpoints'),('file_import_logs','user_id'),('webhook_receipts','connection_id'),('ledger_archives','patch'),('settlements','deleted_at'),('expenses','user_id'),('return_records','recovered_at'),('claims','recovered_at'),('expenses','recovered_at'),('auth_sessions','token_hash'),('auth_sessions','revoked_at')) AS required(table_name,column_name) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=required.table_name AND c.column_name=required.column_name)) AS ready");
  if (result.rows[0]?.ready !== true) throw new Error('Database migrations through step 18 are required.');
}
export default pool;
