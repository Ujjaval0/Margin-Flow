-- ============================================================
-- MarginFlow — Step 12: File Import Audit Metadata Table
-- Architecture Standard #3: Full File Audit Retention
-- Persists original filename, file hash (SHA-256), upload timestamp, and seller account ID.
-- ============================================================

CREATE TABLE IF NOT EXISTS file_import_logs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL,
  marketplace         TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  file_hash           TEXT NOT NULL,
  file_size           BIGINT NOT NULL DEFAULT 0,
  seller_id           TEXT DEFAULT '',
  sheet_format        TEXT NOT NULL,
  rows_processed      INTEGER NOT NULL DEFAULT 0,
  orders_created      INTEGER NOT NULL DEFAULT 0,
  settlements_created INTEGER NOT NULL DEFAULT 0,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_user 
  ON file_import_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_hash 
  ON file_import_logs(file_hash);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_marketplace 
  ON file_import_logs(user_id, marketplace, uploaded_at DESC);
