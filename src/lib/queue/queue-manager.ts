import { Job, JobType, JobStatus, EnqueueJobOptions } from "./types";

// Development simulator only. This registry is not durable and cannot run production work.
const jobsStore: Map<string, Job> = new Map();
export class QueueUnavailableError extends Error {}
function requireDevelopmentQueue() {
  if (process.env.NODE_ENV === "production") throw new QueueUnavailableError("Durable background workers are not configured.");
}

/**
 * Universal Queue Manager
 * Provides a unified API for background asynchronous processing.
 * Simulates work locally. REDIS_URL alone does not install a durable worker;
 * production operations fail closed until a real queue is implemented.
 */
class QueueManager {
  /**
   * Enqueue a new background task
   */
  async enqueue<T = any, R = any>(
    type: JobType,
    payload: T,
    options?: EnqueueJobOptions
  ): Promise<Job<T, R>> {
    requireDevelopmentQueue();
    // Bound the temporary registry until durable workers replace it.
    for (const [existingId, existing] of jobsStore) {
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(existing.status) &&
          Date.now() - Date.parse(existing.updatedAt) > 86_400_000) jobsStore.delete(existingId);
    }
    if (jobsStore.size >= 1000) throw new Error("Job capacity reached. Try again later.");
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: Job<T, R> = {
      id,
      ownerId: options?.ownerId,
      type,
      payload,
      status: "QUEUED",
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobsStore.set(id, job);

    // Schedule background execution
    const delay = options?.delayMs || 50;
    setTimeout(() => {
      this.executeJob(id);
    }, delay);

    return job;
  }

  /**
   * Retrieve job state and current progress
   */
  getJob(jobId: string): Job | undefined {
    requireDevelopmentQueue();
    return jobsStore.get(jobId);
  }

  /**
   * List recent jobs
   */
  listJobs(filter?: { status?: JobStatus; type?: JobType; ownerId?: string }): Job[] {
    requireDevelopmentQueue();
    const list = Array.from(jobsStore.values());
    return list
      .filter((j) => {
        if (filter?.ownerId && j.ownerId !== filter.ownerId) return false;
        if (filter?.status && j.status !== filter.status) return false;
        if (filter?.type && j.type !== filter.type) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Cancel an active or queued job
   */
  cancelJob(jobId: string): boolean {
    requireDevelopmentQueue();
    const job = jobsStore.get(jobId);
    if (!job || job.status === "COMPLETED" || job.status === "FAILED") {
      return false;
    }
    job.status = "CANCELLED";
    job.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Background execution runner
   */
  private async executeJob(jobId: string) {
    const job = jobsStore.get(jobId);
    if (!job || job.status === "CANCELLED") return;

    job.status = "PROCESSING";
    job.progress = 10;
    job.updatedAt = new Date().toISOString();

    try {
      switch (job.type) {
        case "BULK_CSV_IMPORT": {
          // Emulate or process batch row chunks
          const rowCount = job.payload?.rowCount || 100;
          for (let step = 20; step <= 90; step += 25) {
            await new Promise((res) => setTimeout(res, 120));
            if (jobsStore.get(jobId)?.status === "CANCELLED") return;
            job.progress = step;
            job.updatedAt = new Date().toISOString();
          }
          job.progress = 100;
          job.status = "COMPLETED";
          job.result = {
            success: true,
            importedCount: rowCount,
            anomaliesCount: 0,
            completedAt: new Date().toISOString(),
          };
          break;
        }

        case "RECONCILE_SETTLEMENTS": {
          for (let step = 25; step <= 85; step += 30) {
            await new Promise((res) => setTimeout(res, 150));
            if (jobsStore.get(jobId)?.status === "CANCELLED") return;
            job.progress = step;
            job.updatedAt = new Date().toISOString();
          }
          job.progress = 100;
          job.status = "COMPLETED";
          job.result = {
            success: true,
            reconciledCount: job.payload?.batchSize || 50,
            discrepanciesFound: 0,
            totalRecoverable: 0,
          };
          break;
        }

        case "GENERATE_FINANCIAL_REPORT": {
          await new Promise((res) => setTimeout(res, 200));
          job.progress = 50;
          await new Promise((res) => setTimeout(res, 200));
          job.progress = 100;
          job.status = "COMPLETED";
          job.result = {
            reportUrl: `/reports/export_${Date.now()}.pdf`,
            generatedAt: new Date().toISOString(),
          };
          break;
        }

        case "PROCESS_BATCH_IDP": {
          const docsCount = job.payload?.documents?.length || 1;
          for (let i = 1; i <= docsCount; i++) {
            await new Promise((res) => setTimeout(res, 200));
            job.progress = Math.round((i / docsCount) * 100);
            job.updatedAt = new Date().toISOString();
          }
          job.status = "COMPLETED";
          job.result = {
            processedCount: docsCount,
            stagedCount: docsCount,
          };
          break;
        }

        default: {
          job.progress = 100;
          job.status = "COMPLETED";
          job.result = { success: true };
        }
      }
    } catch (err: any) {
      job.status = "FAILED";
      job.error = err.message || "Execution error in background worker.";
    } finally {
      job.updatedAt = new Date().toISOString();
    }
  }
}

export const queueManager = new QueueManager();
