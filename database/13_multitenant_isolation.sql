-- ============================================================
-- MarginFlow — Step 13: Multi-Tenant Database Isolation
-- Enforces merchant-level tenant isolation across orders, settlements,
-- catalog products, and suppliers.
-- ============================================================

-- Legacy rows without proven ownership remain NULL and inaccessible through tenant APIs.
-- 1. Ensure user_id column exists on orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user_id 
  ON orders(user_id, order_date DESC);

-- Drop old global unique index if present and create multi-tenant composite unique constraint
DROP INDEX IF EXISTS uq_orders_channel_marketplace;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_channel_marketplace
  ON orders (user_id, channel_order_id, marketplace);

-- 2. Ensure user_id column exists on settlements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settlements' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE settlements ADD COLUMN user_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_settlements_user_id 
  ON settlements(user_id, settlement_date DESC);

-- Drop old global settlements index and create multi-tenant unique constraint
DROP INDEX IF EXISTS uq_settlements_batch_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_user_batch_order
  ON settlements (user_id, settlement_batch_id, order_id);

-- 3. Ensure user_id column exists on products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE products ADD COLUMN user_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_user_id 
  ON products(user_id);

-- Drop old global unique SKU constraint and create multi-tenant SKU constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_sku 
  ON products(user_id, sku);

-- 4. Ensure user_id column exists on suppliers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN user_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id 
  ON suppliers(user_id);

-- 5. Ensure user_id column exists on ai_staged_documents table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_staged_documents') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_staged_documents' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE ai_staged_documents ADD COLUMN user_id TEXT;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_ai_staged_documents_user_id ON ai_staged_documents(user_id);
  END IF;
END $$;
