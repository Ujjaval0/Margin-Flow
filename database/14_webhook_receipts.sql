-- Apply after the marketplace connections and tenant migrations.
CREATE TABLE IF NOT EXISTS webhook_receipts (
  connection_id TEXT NOT NULL REFERENCES marketplace_connections(id),
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connection_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_user ON webhook_receipts(user_id, processed_at DESC);
