-- Durable job queue lifecycle metadata. Apply after migration 18.
-- Job records are tenant-owned and removed when their account is deleted.
BEGIN;

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_token UUID,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_created_by_fkey;
ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_accounts(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_jobs_attempts_check') THEN
    ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_attempts_check CHECK (attempts >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_jobs_max_attempts_check') THEN
    ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 10);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_owner_idempotency
  ON background_jobs (created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_available
  ON background_jobs (priority DESC, available_at ASC, created_at ASC)
  WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_jobs_expired_lease
  ON background_jobs (locked_at ASC)
  WHERE status = 'PROCESSING';

COMMIT;
