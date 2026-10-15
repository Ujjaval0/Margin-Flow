-- Explicit deployment only. Existing unowned expenses are not assigned to a merchant.
BEGIN;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE return_records ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_user_display ON expenses(user_id, display_id);
CREATE TABLE IF NOT EXISTS ledger_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('orders','returns','claims','expenses','products')),
  record_ids TEXT[] NOT NULL,
  patch JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ledger_archives_owner ON ledger_archives(user_id, deleted_at DESC);
ALTER TABLE ledger_archives ENABLE ROW LEVEL SECURITY;
-- Application routes use the server database role; direct client roles have no policies/grants.
REVOKE ALL ON ledger_archives FROM PUBLIC;
COMMIT;
