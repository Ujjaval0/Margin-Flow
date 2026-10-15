-- ============================================================
-- MarginFlow — Step 11: OAuth 2.0 State Security Table
-- Architecture Standard #2 & #4: CSRF Protection & Multi-Tenant Isolation
-- Stores transient, single-use state nonces with 10-minute expiry for marketplace OAuth flows.
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_user 
  ON oauth_states(user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry 
  ON oauth_states(expires_at);
