-- Apply explicitly after migrations 08-14. Existing unowned documents stay unowned.
-- No merchant ownership is inferred or reassigned by this migration.
BEGIN;
ALTER TABLE ai_staged_documents ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_staged_documents_user ON ai_staged_documents(user_id);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_display_id_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_display_id_key;
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_display_id_key;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_display_id_key;
ALTER TABLE ai_staged_documents DROP CONSTRAINT IF EXISTS ai_staged_documents_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_user_display ON orders(user_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_display ON products(user_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlements_user_display ON settlements(user_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_user_display ON suppliers(user_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_user_display ON ai_staged_documents(user_id, display_id);

-- A SKU may occur on multiple legitimate order lines; immutable line identity is distinct.
DROP INDEX IF EXISTS uq_order_items_order_sku;
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_order_display ON order_items(order_id, display_id);

-- Supabase hardening: remove the old blanket authenticated-user business policies.
-- No replacement broad grant is added. Direct Supabase access stays denied until
-- ownership policies have been verified for the actual auth.uid()/account mapping.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND (policyname LIKE '%\_all_authenticated' ESCAPE '\'
      OR policyname IN ('audit_logs_insert_authenticated', 'audit_logs_select_authenticated'))
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;
COMMIT;
