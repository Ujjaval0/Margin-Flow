-- ============================================================
-- MarginFlow — Step 10: Orders & Settlements Idempotency Constraints
-- Architecture Standard #3: Idempotent Upserts
-- Ensures safe synchronization with 48-hour overlap window without duplicate rows.
-- ============================================================

-- 1. Unique index on orders (channel_order_id, marketplace)
-- Allows: ON CONFLICT (channel_order_id, marketplace) DO UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_channel_marketplace
  ON orders (channel_order_id, marketplace);

-- 2. Unique index on settlements (settlement_batch_id, order_id)
-- Allows: ON CONFLICT (settlement_batch_id, order_id) DO UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_batch_order
  ON settlements (settlement_batch_id, order_id);

-- 3. Unique index on order_items (order_id, sku) for idempotent line item upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_order_sku
  ON order_items (order_id, sku);
