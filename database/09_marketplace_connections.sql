-- ============================================================
-- MarginFlow — Step 09: Marketplace Connections & Vaulted Credentials
-- Architecture Standard #2: Zero Client-Side Master Secrets
-- Stores multi-tenant marketplace credentials encrypted with AES-256-GCM.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_connections (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               TEXT NOT NULL,
  marketplace           TEXT NOT NULL,
  seller_id             TEXT DEFAULT '',
  marketplace_id        TEXT,
  encrypted_credentials TEXT NOT NULL,
  auth_type             TEXT NOT NULL DEFAULT 'API_KEY', -- 'OAUTH2', 'API_KEY', 'LWA_REFRESH_TOKEN', 'SELF_ACCESS'
  token_expires_at      TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_status      TEXT DEFAULT 'IDLE', -- 'IDLE', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'
  last_sync_cursor      TEXT,
  last_synced_at        TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_marketplace_connection UNIQUE (user_id, marketplace, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_user 
  ON marketplace_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_active 
  ON marketplace_connections(user_id, is_active);

-- ============================================================
-- MARKETPLACE SYNC LOGS TABLE
-- Tracks immutable audit history of every sync run.
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_sync_logs (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id         TEXT REFERENCES marketplace_connections(id) ON DELETE SET NULL,
  user_id               TEXT NOT NULL,
  marketplace           TEXT NOT NULL,
  sync_type             TEXT NOT NULL DEFAULT 'DELTA', -- 'INITIAL', 'DELTA', 'MANUAL', 'SCHEDULED'
  status                TEXT NOT NULL, -- 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'
  fetched_count         INTEGER NOT NULL DEFAULT 0,
  imported_count        INTEGER NOT NULL DEFAULT 0,
  updated_count         INTEGER NOT NULL DEFAULT 0,
  skipped_count         INTEGER NOT NULL DEFAULT 0,
  error_message         TEXT,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user 
  ON marketplace_sync_logs(user_id, marketplace, started_at DESC);
