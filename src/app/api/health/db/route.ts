import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const startTime = Date.now();
  try {
    const tableCountRes = await query(`
      SELECT count(*)::int AS count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    const viewCountRes = await query(`
      SELECT count(*)::int AS count 
      FROM information_schema.views 
      WHERE table_schema = 'public';
    `);

    const orderCountRes = await query(`
      SELECT count(*)::int AS count FROM orders;
    `);

    const sampleOrders = await query(`
      SELECT display_id, marketplace, order_date, status, gross_sales, total_cogs, contribution_profit
      FROM v_order_profitability
      ORDER BY order_date DESC
      LIMIT 3;
    `);

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'marginflow_dev',
      connected: true,
      latencyMs,
      tables: tableCountRes.rows[0].count,
      views: viewCountRes.rows[0].count,
      seededOrders: orderCountRes.rows[0].count,
      sampleProfitability: sampleOrders.rows,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'marginflow_dev',
        connected: false,
        latencyMs,
        error: error.message,
        hint:
          error.code === '28P01'
            ? 'Password authentication failed. Please update DATABASE_URL in .env.local with your pgAdmin password.'
            : error.code === 'ECONNREFUSED'
            ? 'PostgreSQL server is not reachable on localhost:5432. Please ensure PostgreSQL is running.'
            : error.message,
      },
      { status: 500 }
    );
  }
}
