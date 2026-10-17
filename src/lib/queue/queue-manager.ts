import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { EnqueueJobOptions, Job, JobStatus, JobType } from "./types";

export class QueueUnavailableError extends Error {}
export class JobProcessorUnavailableError extends Error {}
export class PermanentJobError extends Error {}

type JobRow = {
  id: string; owner_id: string; type: JobType; payload: Job["payload"];
  status: JobStatus; progress: number; result: Job["result"]; error: string | null;
  attempts: number; max_attempts: number; created_at: Date | string; updated_at: Date | string;
  available_at: Date | string; locked_at: Date | string | null;
};

const JOB_COLUMNS = `id, created_by AS owner_id, type, payload, status, progress, result,
  error, attempts, max_attempts, created_at, updated_at, available_at, locked_at`;
const JOB_RETURNING_COLUMNS = `j.id, j.created_by AS owner_id, j.type, j.payload, j.status, j.progress, j.result,
  j.error, j.attempts, j.max_attempts, j.created_at, j.updated_at, j.available_at, j.locked_at`;
const LEASE_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toJob(row: JobRow): Job {
  return {
    id: row.id, ownerId: row.owner_id, type: row.type, payload: row.payload,
    status: row.status, progress: Number(row.progress), result: row.result ?? undefined,
    error: row.error ?? undefined, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts),
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    availableAt: new Date(row.available_at).toISOString(),
  };
}

export interface JobProcessorContext<T = unknown> {
  job: Job<T>;
  /** Stable across retries. Processors must use it to make their side effects idempotent. */
  idempotencyKey: string;
  /** Use this transaction client for all database writes so completion commits atomically with effects. */
  client: PoolClient;
  updateProgress(progress: number): Promise<boolean>;
  isCancelled(): Promise<boolean>;
}
export type JobProcessor<T = unknown, R = unknown> = (context: JobProcessorContext<T>) => Promise<R>;

declare global {
  // eslint-disable-next-line no-var
  var _marginflowJobProcessors: Map<JobType, JobProcessor> | undefined;
}
const processors = global._marginflowJobProcessors || new Map<JobType, JobProcessor>();
global._marginflowJobProcessors = processors;
export function registerJobProcessor<T = unknown, R = unknown>(type: JobType, processor: JobProcessor<T, R>): void {
  processors.set(type, processor as JobProcessor);
}

/** PostgreSQL-backed queue. Processors are registered by the app route and worker startup. */
class QueueManager {
  isWorkerEnabled(): boolean { return process.env.MARGINFLOW_JOB_WORKER === "1"; }

  async enqueue<T = unknown, R = unknown>(type: JobType, payload: T, options: EnqueueJobOptions): Promise<Job<T, R>> {
    if (!options?.ownerId) throw new Error("A verified job owner is required.");
    if (!processors.has(type)) throw new JobProcessorUnavailableError(`No processor is registered for ${type}.`);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Job payload must be an object.");
    if (options.idempotencyKey && (options.idempotencyKey.length > 200 || !/^[\w:.-]+$/.test(options.idempotencyKey))) {
      throw new Error("Invalid job idempotency key.");
    }
    const requestedAttempts = Number(options.maxAttempts ?? 3);
    if (!Number.isFinite(requestedAttempts)) throw new Error("Invalid maximum job attempts.");
    const maxAttempts = Math.max(1, Math.min(10, Math.trunc(requestedAttempts)));
    const requestedPriority = Number(options.priority ?? 0);
    if (!Number.isFinite(requestedPriority)) throw new Error("Invalid job priority.");
    const requestedDelay = Number(options.delayMs ?? 0);
    if (!Number.isFinite(requestedDelay)) throw new Error("Invalid job delay.");
    try {
      const result = await pool.query<JobRow>(
        `INSERT INTO background_jobs (type, payload, created_by, idempotency_key, max_attempts, available_at, priority)
         VALUES ($1, $2::jsonb, $3, $4, $5, now() + ($6::int * interval '1 millisecond'), $7)
         ON CONFLICT (created_by, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         RETURNING ${JOB_COLUMNS}`,
        [type, JSON.stringify(payload), options.ownerId, options.idempotencyKey ?? null, maxAttempts,
          Math.max(0, Math.min(60_000, Math.trunc(requestedDelay))), Math.max(-10, Math.min(10, Math.trunc(requestedPriority)))],
      );
      if (!result.rows[0]) throw new QueueUnavailableError("Job could not be persisted.");
      return toJob(result.rows[0]) as Job<T, R>;
    } catch (error) {
      if (error instanceof QueueUnavailableError) throw error;
      throw new QueueUnavailableError("Background job storage is unavailable.", { cause: error });
    }
  }

  async getJob(jobId: string, ownerId: string): Promise<Job | undefined> {
    if (!UUID_PATTERN.test(jobId)) return undefined;
    const result = await pool.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM background_jobs WHERE id = $1 AND created_by = $2`, [jobId, ownerId]);
    return result.rows[0] ? toJob(result.rows[0]) : undefined;
  }

  async listJobs(filter: { status?: JobStatus; type?: JobType; ownerId: string }): Promise<Job[]> {
    if (!filter.ownerId) throw new Error("A verified job owner is required.");
    const result = await pool.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM background_jobs
       WHERE created_by = $1 AND ($2::job_status_enum IS NULL OR status = $2)
         AND ($3::job_type_enum IS NULL OR type = $3)
       ORDER BY created_at DESC LIMIT 100`,
      [filter.ownerId, filter.status ?? null, filter.type ?? null],
    );
    return result.rows.map(toJob);
  }

  async cancelJob(jobId: string, ownerId: string): Promise<boolean> {
    if (!UUID_PATTERN.test(jobId)) return false;
    const result = await pool.query(
      `UPDATE background_jobs SET status = 'CANCELLED', locked_at = NULL, lock_token = NULL
       WHERE id = $1 AND created_by = $2 AND status IN ('QUEUED', 'PROCESSING') RETURNING id`,
      [jobId, ownerId],
    );
    return result.rowCount === 1;
  }

  /** Claim one job with SKIP LOCKED, execute its registered processor, and persist retry/completion. */
  async runNextJob(): Promise<boolean> {
    const supportedTypes = [...processors.keys()];
    if (!supportedTypes.length) return false;
    const client = await pool.connect();
    let job: Job | undefined;
    let lockToken = "";
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE background_jobs SET
           status = CASE WHEN attempts >= max_attempts THEN 'FAILED'::job_status_enum ELSE 'QUEUED'::job_status_enum END,
           error = CASE WHEN attempts >= max_attempts THEN 'Worker lease expired after the final attempt.' ELSE error END,
           available_at = CASE WHEN attempts >= max_attempts THEN available_at
             ELSE now() + (LEAST(300, POWER(2, attempts))::int * interval '1 second') END,
           locked_at = NULL, lock_token = NULL
         WHERE status = 'PROCESSING' AND (locked_at IS NULL OR locked_at < now() - ($1::int * interval '1 millisecond'))`,
        [LEASE_MS],
      );
      const claimed = await client.query<JobRow & { lock_token: string }>(
        `WITH candidate AS (
           SELECT id FROM background_jobs
           WHERE status = 'QUEUED' AND available_at <= now() AND type = ANY($1::job_type_enum[])
           ORDER BY priority DESC, available_at ASC, created_at ASC
           FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE background_jobs j SET status = 'PROCESSING', progress = 0,
           attempts = attempts + 1, locked_at = now(), lock_token = gen_random_uuid(), error = NULL
         FROM candidate WHERE j.id = candidate.id
         RETURNING ${JOB_RETURNING_COLUMNS}, j.lock_token`,
        [supportedTypes],
      );
      if (!claimed.rows[0]) { await client.query("COMMIT"); return false; }
      lockToken = claimed.rows[0].lock_token;
      job = toJob(claimed.rows[0]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw new QueueUnavailableError("Unable to claim a background job.", { cause: error });
    } finally { client.release(); }

    const processor = processors.get(job.type);
    if (!processor) return false;
    const updateProgress = async (progress: number) => {
      const safeProgress = Math.max(0, Math.min(99, Math.trunc(progress)));
      const result = await pool.query(
        `UPDATE background_jobs SET progress = $1, locked_at = now()
         WHERE id = $2 AND status = 'PROCESSING' AND lock_token = $3`,
        [safeProgress, job!.id, lockToken],
      );
      return result.rowCount === 1;
    };
    const isCancelled = async () => {
      const result = await pool.query(`SELECT status = 'CANCELLED' AS cancelled FROM background_jobs WHERE id = $1`, [job!.id]);
      return result.rows[0]?.cancelled !== false;
    };
    const workClient = await pool.connect();
    try {
      await workClient.query("BEGIN");
      const result = await processor({ job, idempotencyKey: job.id, client: workClient, updateProgress, isCancelled });
      const completed = await workClient.query(
        `UPDATE background_jobs SET status = 'COMPLETED', progress = 100, result = $1::jsonb,
          locked_at = NULL, lock_token = NULL
         WHERE id = $2 AND status = 'PROCESSING' AND lock_token = $3 RETURNING id`,
        [JSON.stringify(result ?? null), job.id, lockToken],
      );
      if (completed.rowCount !== 1) {
        await workClient.query("ROLLBACK");
        return true;
      }
      await workClient.query("COMMIT");
    } catch (error) {
      await workClient.query("ROLLBACK").catch(() => {});
      const delayMs = Math.min(MAX_BACKOFF_MS, 1000 * (2 ** Math.min(job.attempts - 1, 8)));
      await pool.query(
        `UPDATE background_jobs SET
           status = CASE WHEN $5::boolean OR attempts >= max_attempts THEN 'FAILED'::job_status_enum ELSE 'QUEUED'::job_status_enum END,
           error = $1, available_at = CASE WHEN $5::boolean OR attempts >= max_attempts THEN available_at ELSE now() + ($2::int * interval '1 millisecond') END,
           locked_at = NULL, lock_token = NULL
         WHERE id = $3 AND status = 'PROCESSING' AND lock_token = $4`,
        ["Background job attempt failed.", delayMs, job.id, lockToken, error instanceof PermanentJobError],
      );
    } finally { workClient.release(); }
    return true;
  }

  async runWorker(options: { pollIntervalMs?: number; signal: AbortSignal }): Promise<void> {
    const interval = Math.max(250, Math.min(30_000, options.pollIntervalMs ?? 1000));
    while (!options.signal.aborted) {
      try { if (await this.runNextJob()) continue; } catch { /* retry database/worker failures on the next poll */ }
      if (options.signal.aborted) break;
      await new Promise<void>(resolve => {
        const finish = () => { options.signal.removeEventListener("abort", onAbort); resolve(); };
        const timer = setTimeout(finish, interval);
        const onAbort = () => { clearTimeout(timer); finish(); };
        options.signal.addEventListener("abort", onAbort, { once: true });
      });
    }
  }
}

export const queueManager = new QueueManager();
