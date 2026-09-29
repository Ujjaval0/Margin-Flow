import { Pool, QueryResult, QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/marginflow_dev';

const pool =
  global._postgresPool ||
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresPool = pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;
