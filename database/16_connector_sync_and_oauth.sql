-- Apply explicitly after migration 15. Unbound legacy OAuth states cannot be consumed.
BEGIN;
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS redirect_uri TEXT;
ALTER TABLE marketplace_connections ADD COLUMN IF NOT EXISTS sync_checkpoints JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
