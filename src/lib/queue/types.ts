export type JobType =
  | "BULK_CSV_IMPORT"
  | "RECONCILE_SETTLEMENTS"
  | "GENERATE_FINANCIAL_REPORT"
  | "PROCESS_BATCH_IDP";

export type JobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Job<T = any, R = any> {
  id: string;
  ownerId?: string;
  type: JobType;
  payload: T;
  status: JobStatus;
  progress: number; // 0 to 100
  result?: R;
  error?: string;
  createdAt: string;
  updatedAt: string;
  availableAt?: string;
  attempts: number;
  maxAttempts: number;
}

export interface EnqueueJobOptions {
  ownerId?: string;
  priority?: number;
  delayMs?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}
