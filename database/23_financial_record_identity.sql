-- Keep aligned with production migration 20261019000200_financial_record_identity.sql.
BEGIN;
DROP INDEX IF EXISTS uq_settlements_batch_order;
DROP INDEX IF EXISTS uq_settlements_user_batch_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_user_display ON settlements(user_id, display_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user_batch_order ON settlements(user_id, settlement_batch_id, order_id);
COMMIT;
