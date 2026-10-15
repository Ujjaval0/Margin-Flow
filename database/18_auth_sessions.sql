-- Explicit migration after 17. Old stateless tokens require a fresh sign-in.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_owner ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_sessions FROM PUBLIC;
COMMIT;
