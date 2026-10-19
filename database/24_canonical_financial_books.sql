-- Local bootstrap payment-allocation fidelity, then canonical-book migration.
BEGIN;
ALTER TABLE purchase_bills
  ADD COLUMN paid_amount NUMERIC(14,2),
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

COMMIT;
-- Additive operational-book persistence. Unowned legacy data stays inaccessible.
BEGIN;
ALTER TABLE ai_staged_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TYPE audit_entity_type_enum ADD VALUE IF NOT EXISTS 'SUPPLIER';
ALTER TYPE audit_entity_type_enum ADD VALUE IF NOT EXISTS 'SUPPLIER_PAYOUT';
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','purchase_bills','supplier_payments','return_records','claims','expenses','ai_staged_documents','orders','order_items','settlements','settlement_deductions'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS record_data jsonb NOT NULL DEFAULT ''{}''::jsonb', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['purchase_bills','supplier_payments','return_records','claims'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id text', t);
  END LOOP;
END $$;
UPDATE purchase_bills p SET user_id=s.user_id FROM suppliers s WHERE p.supplier_id=s.id AND p.user_id IS NULL;
UPDATE supplier_payments p SET user_id=s.user_id FROM suppliers s WHERE p.supplier_id=s.id AND p.user_id IS NULL;
UPDATE return_records r SET user_id=o.user_id FROM orders o WHERE r.order_id=o.id AND r.user_id IS NULL;
UPDATE claims c SET user_id=o.user_id FROM orders o WHERE c.order_id=o.id AND c.user_id IS NULL;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS display_id text;
UPDATE supplier_payments SET display_id='PAY-'||id::text WHERE display_id IS NULL;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS advance_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (advance_amount>=0);
ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2);
ALTER TABLE purchase_bills ALTER COLUMN paid_amount DROP NOT NULL;
-- Historical PARTIAL remains unresolved if no amount exists; never infer paid0.
UPDATE purchase_bills SET paid_amount=CASE WHEN payment_status='PAID' THEN total_amount WHEN payment_status='PENDING' THEN 0 ELSE NULL END WHERE paid_amount IS NULL;
ALTER TABLE purchase_bills DROP CONSTRAINT IF EXISTS purchase_bills_display_id_key;
ALTER TABLE return_records DROP CONSTRAINT IF EXISTS return_records_display_id_key;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_bills_owner_display ON purchase_bills(user_id,display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_payments_owner_display ON supplier_payments(user_id,display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_return_records_owner_display ON return_records(user_id,display_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_owner_display ON claims(user_id,display_id);
CREATE TABLE IF NOT EXISTS financial_commands (
  user_id text NOT NULL, request_id text NOT NULL, request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_id)
);
ALTER TABLE financial_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON financial_commands FROM PUBLIC, anon, authenticated;
-- Close the old active window BEFORE the unique partial index is checked.
DROP TRIGGER IF EXISTS trg_close_cost_window ON product_cost_history;
CREATE TRIGGER trg_close_cost_window BEFORE INSERT ON product_cost_history
  FOR EACH ROW EXECUTE FUNCTION fn_close_previous_cost_window();
CREATE TABLE IF NOT EXISTS provider_financial_events (
 user_id text NOT NULL, marketplace text NOT NULL,event_type text NOT NULL,event_identity text NOT NULL,
 source_payload jsonb NOT NULL,projection_issue text,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,marketplace,event_type,event_identity)
);
ALTER TABLE provider_financial_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON provider_financial_events FROM PUBLIC,anon,authenticated;
ALTER TABLE financial_audit_logs ADD COLUMN IF NOT EXISTS sequence bigint GENERATED BY DEFAULT AS IDENTITY;
CREATE INDEX IF NOT EXISTS financial_audit_owner_sequence ON financial_audit_logs(user_id,sequence DESC);
COMMIT;
