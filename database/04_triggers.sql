-- ============================================================
-- MarginFlow — Step 04: Triggers & Invariant Enforcement
-- Run AFTER 03_indexes.sql
-- ============================================================

-- ------------------------------------------------------------
-- TRIGGER 1: Block UPDATE/DELETE on financial_audit_logs
-- The audit log is append-only. No record can ever be modified.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_block_audit_log_mutations()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'financial_audit_logs is append-only. UPDATE and DELETE are not permitted. Entity: %, ID: %',
    OLD.entity_type, OLD.entity_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON financial_audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_block_audit_log_mutations();

-- ------------------------------------------------------------
-- TRIGGER 2: Block UPDATE on order_items.snapshot_unit_cost
-- This value is locked at creation time. It is the foundation
-- of every profitability calculation in the engine.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_block_snapshot_cost_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.snapshot_unit_cost IS DISTINCT FROM NEW.snapshot_unit_cost THEN
    RAISE EXCEPTION
      'snapshot_unit_cost is immutable after creation. Order item: %. Attempted change: % → %',
      OLD.id, OLD.snapshot_unit_cost, NEW.snapshot_unit_cost;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_cost_immutable
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_block_snapshot_cost_update();

-- ------------------------------------------------------------
-- TRIGGER 3: Auto-update updated_at timestamp on mutations
-- Applied to all tables with an updated_at column.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_accounts_updated_at
  BEFORE UPDATE ON user_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_return_records_updated_at
  BEFORE UPDATE ON return_records
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_purchase_bills_updated_at
  BEFORE UPDATE ON purchase_bills
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_ai_staged_documents_updated_at
  BEFORE UPDATE ON ai_staged_documents
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_ai_staged_fields_updated_at
  BEFORE UPDATE ON ai_staged_fields
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_background_jobs_updated_at
  BEFORE UPDATE ON background_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ------------------------------------------------------------
-- TRIGGER 4: Auto-update supplier.total_paid when a payment is recorded
-- Keeps the running total in sync without requiring application-layer logic.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_supplier_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE suppliers
      SET total_paid = total_paid + NEW.amount
    WHERE id = NEW.supplier_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE suppliers
      SET total_paid = GREATEST(0, total_paid - OLD.amount)
    WHERE id = OLD.supplier_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_payment_sync
  AFTER INSERT OR DELETE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_supplier_total_paid();

-- ------------------------------------------------------------
-- TRIGGER 5: Enforce only one active cost window per product
-- When a new cost history row is inserted with valid_to = NULL,
-- automatically close the previous open window.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_close_previous_cost_window()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when the new row is the current active window (valid_to IS NULL)
  IF NEW.valid_to IS NULL THEN
    UPDATE product_cost_history
      SET valid_to = NEW.valid_from - INTERVAL '1 day'
    WHERE product_id = NEW.product_id
      AND id <> NEW.id
      AND valid_to IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_close_cost_window
  AFTER INSERT ON product_cost_history
  FOR EACH ROW EXECUTE FUNCTION fn_close_previous_cost_window();

-- ------------------------------------------------------------
-- TRIGGER 6: Auto-update products.current_cost_price
-- When a new cost window is inserted, sync the denormalized
-- current_cost_price on the products table.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_product_current_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valid_to IS NULL THEN
    UPDATE products
      SET current_cost_price = NEW.cost_price,
          updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_current_cost
  AFTER INSERT ON product_cost_history
  FOR EACH ROW EXECUTE FUNCTION fn_sync_product_current_cost();
