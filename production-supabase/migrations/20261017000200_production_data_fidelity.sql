-- MarginFlow production schema delta: purchase payment fidelity and tenant metadata.
-- Apply only after 20261017000100_initial_schema.sql on a NEW Supabase project.
-- This is a schema artifact; it has not been applied to any database.

BEGIN;

-- The current PurchaseBill model includes partial payment amounts. The older
-- baseline stored only a status, which cannot reconstruct allocations.
ALTER TABLE purchase_bills
  ADD COLUMN paid_amount NUMERIC(14,2) NOT NULL,
  ADD CONSTRAINT purchase_bills_paid_amount_nonnegative CHECK (paid_amount >= 0),
  ADD CONSTRAINT purchase_bills_paid_amount_lte_total CHECK (paid_amount <= total_amount);

-- Keep payment details and allocations as auditable events. Existing UI code
-- currently allocates locally; a server persistence adapter must use a single
-- transaction to write the payment, allocations, bill balances, and audit row.
ALTER TABLE supplier_payments
  ADD CONSTRAINT supplier_payments_id_supplier_key UNIQUE (id, supplier_id);

ALTER TABLE purchase_bills
  ADD CONSTRAINT purchase_bills_id_supplier_key UNIQUE (id, supplier_id);

CREATE TABLE supplier_payment_allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_payment_id UUID NOT NULL,
  purchase_bill_id    UUID NOT NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payment_allocations_payment_fk
    FOREIGN KEY (supplier_payment_id, supplier_id)
    REFERENCES supplier_payments(id, supplier_id) ON DELETE CASCADE,
  CONSTRAINT supplier_payment_allocations_bill_fk
    FOREIGN KEY (purchase_bill_id, supplier_id)
    REFERENCES purchase_bills(id, supplier_id) ON DELETE CASCADE,
  CONSTRAINT supplier_payment_allocations_once UNIQUE (supplier_payment_id, purchase_bill_id)
);

CREATE INDEX supplier_payment_allocations_bill_idx
  ON supplier_payment_allocations (supplier_id, purchase_bill_id);

ALTER TABLE supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON supplier_payment_allocations FROM PUBLIC, anon, authenticated;

-- These entities are currently represented in the client ledger but do not
-- have complete server CRUD. Owner columns are nullable until that adapter is
-- deployed; production application code must populate and require them before
-- these tables are exposed to any role.
ALTER TABLE financial_audit_logs
  ADD COLUMN user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE;

ALTER TABLE customer_complaints
  ADD COLUMN user_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE;

-- Identifiers and master SKUs belong to a tenant. Global unique constraints
-- copied from the original single-tenant schema would reject valid data when
-- two merchants use the same SKU, ticket number, or generated display ID.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_sku
  ON products (user_id, sku);

ALTER TABLE customer_complaints DROP CONSTRAINT IF EXISTS customer_complaints_ticket_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_complaints_owner_ticket
  ON customer_complaints (user_id, ticket_number);

ALTER TABLE financial_audit_logs DROP CONSTRAINT IF EXISTS financial_audit_logs_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_audit_logs_owner_display
  ON financial_audit_logs (user_id, display_id);

CREATE INDEX financial_audit_logs_owner_time_idx
  ON financial_audit_logs (user_id, timestamp DESC);

CREATE INDEX customer_complaints_owner_created_idx
  ON customer_complaints (user_id, created_at DESC);

-- Keep legacy global alert/event tables inaccessible through client roles.
-- Current app alerts are derived in the UI and webhook idempotency uses
-- webhook_receipts, so these legacy tables are not tenant-facing APIs.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON webhook_events, notifications FROM PUBLIC, anon, authenticated;

COMMIT;
