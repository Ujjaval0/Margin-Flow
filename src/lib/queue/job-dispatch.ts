import { after } from 'next/server';
import { queueManager } from '@/lib/queue/queue-manager';

/** Vercel extends the invocation through after(); no permanent in-process loop. */
export function dispatchJob(ownerId: string, jobId: string) {
  if (process.env.VERCEL !== '1') return;
  after(async () => {
    try { await import('@/lib/queue/job-processors'); await queueManager.runNextJob({ ownerId, jobId }); }
    catch { console.error('Queued job dispatch failed; the durable job can be retried.'); }
  });
}
