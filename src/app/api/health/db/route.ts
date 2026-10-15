import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    await query('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      connected: true,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        connected: false,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
