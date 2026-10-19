-- A payout batch can contain several distinct financial records for one order.
-- Idempotency is the tenant-scoped record identity, not the batch/order pair.
BEGIN;
DROP INDEX IF EXISTS uq_settlements_batch_order;
DROP INDEX IF EXISTS uq_settlements_user_batch_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_user_display ON settlements(user_id, display_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user_batch_order ON settlements(user_id, settlement_batch_id, order_id);
COMMIT;
