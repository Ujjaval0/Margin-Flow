import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { queueManager } from '@/lib/queue/queue-manager';
import '@/lib/queue/job-processors';

export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from('Bearer ' + (secret || ''));
  if (!secret || secret.length < 32 || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const deadline = Date.now() + 200_000;
    let processed = 0;
    while (processed < 5 && Date.now() < deadline && await queueManager.runNextJob()) processed++;
    return NextResponse.json({ success: true, processed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Queue processing is unavailable.' }, { status: 503 });
  }
}
