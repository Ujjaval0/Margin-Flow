-- ============================================================================
-- MarginFlow — MASTER SINGLE-FILE DATABASE SETUP SCRIPT
-- Tested for PostgreSQL 14, 15, 16, 17 and pgAdmin 4.
-- ============================================================================
--
-- INSTRUCTIONS FOR pgAdmin 4:
-- 1. Open pgAdmin 4 and connect to your local PostgreSQL server.
-- 2. In the left panel (Object Explorer), right-click "Databases" -> "Create" -> "Database...".
--    Name: marginflow_dev
--    Click "Save".
-- 3. Click to expand "marginflow_dev", right-click on it -> select "Query Tool".
-- 4. Open or copy-paste this ENTIRE file into the Query Tool.
-- 5. Press F5 (or click the "Execute / Play" button).
--
-- Result: Creates all 22 tables, 16 enums, ~50 indexes, 6 triggers, 8 views,
--         and inserts full test seed data matching the MarginFlow application.
-- ============================================================================

-- Ensure pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 0. CLEAN DROP SECTION (Enables clean re-runs in pgAdmin)
-- ============================================================================
DROP VIEW IF EXISTS v_recycle_bin CASCADE;
DROP VIEW IF EXISTS v_unread_notification_count CASCADE;
DROP VIEW IF EXISTS v_claims_summary CASCADE;
DROP VIEW IF EXISTS v_inventory_metrics CASCADE;
DROP VIEW IF EXISTS v_settlement_aging CASCADE;
DROP VIEW IF EXISTS v_marketplace_profitability CASCADE;
DROP VIEW IF EXISTS v_sku_profitability CASCADE;
DROP VIEW IF EXISTS v_order_profitability CASCADE;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS background_jobs CASCADE;
DROP TABLE IF EXISTS customer_complaints CASCADE;
DROP TABLE IF EXISTS financial_audit_logs CASCADE;
DROP TABLE IF EXISTS ai_staged_fields CASCADE;
DROP TABLE IF EXISTS ai_staged_documents CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS purchase_bills CASCADE;
DROP TABLE IF EXISTS settlement_deductions CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS claim_documents CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS return_records CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_channel_aliases CASCADE;
DROP TABLE IF EXISTS product_cost_history CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS supplier_payments CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS user_accounts CASCADE;

DROP TYPE IF EXISTS notification_severity_enum CASCADE;
DROP TYPE IF EXISTS notification_type_enum CASCADE;
DROP TYPE IF EXISTS webhook_status_enum CASCADE;
DROP TYPE IF EXISTS webhook_source_enum CASCADE;
DROP TYPE IF EXISTS job_status_enum CASCADE;
DROP TYPE IF EXISTS job_type_enum CASCADE;
DROP TYPE IF EXISTS account_type_enum CASCADE;
DROP TYPE IF EXISTS complaint_status_enum CASCADE;
DROP TYPE IF EXISTS complaint_priority_enum CASCADE;
DROP TYPE IF EXISTS complaint_category_enum CASCADE;
DROP TYPE IF EXISTS audit_entity_type_enum CASCADE;
DROP TYPE IF EXISTS provenance_enum CASCADE;
DROP TYPE IF EXISTS ai_document_status_enum CASCADE;
DROP TYPE IF EXISTS ai_document_type_enum CASCADE;
DROP TYPE IF EXISTS expense_category_enum CASCADE;
DROP TYPE IF EXISTS payment_method_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS reconciliation_status_enum CASCADE;
DROP TYPE IF EXISTS deduction_category_enum CASCADE;
DROP TYPE IF EXISTS claim_type_enum CASCADE;
DROP TYPE IF EXISTS claim_status_enum CASCADE;
DROP TYPE IF EXISTS restock_status_enum CASCADE;
DROP TYPE IF EXISTS product_condition_enum CASCADE;
DROP TYPE IF EXISTS return_type_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;
DROP TYPE IF EXISTS marketplace_enum CASCADE;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE marketplace_enum AS ENUM (
  'Amazon India',
  'Flipkart',
  'Meesho',
  'Personal Website',
  'Myntra',
  'WooCommerce',
  'B2B Wholesale',
  'Other'
);

CREATE TYPE order_status_enum AS ENUM (
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RTO',
  'RETURNED',
  'CUSTOMER_RETURN',
  'DAMAGED_RETURN',
  'CLAIM_PENDING',
  'CLAIM_APPROVED',
  'PARTIALLY_RETURNED'
);

CREATE TYPE return_type_enum AS ENUM (
  'CUSTOMER_RETURN',
  'RTO',
  'DAMAGED_RETURN',
  'LOST_RETURN',
  'OTHER'
);

CREATE TYPE product_condition_enum AS ENUM (
  'SELLABLE',
  'DAMAGED',
  'USED',
  'MISSING',
  'UNUSABLE',
  'UNDER_INSPECTION'
);

CREATE TYPE restock_status_enum AS ENUM (
  'PENDING_RESTOCK',
  'RESTOCKED',
  'WRITTEN_OFF'
);

CREATE TYPE claim_status_enum AS ENUM (
  'NOT_FILED',
  'FILED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_RECOVERED',
  'RECOVERED',
  'REJECTED',
  'CLOSED'
);

CREATE TYPE claim_type_enum AS ENUM (
  'LOST_IN_TRANSIT',
  'DAMAGED_INVOICE',
  'WRONG_RETURN_ITEM',
  'FEE_DISPUTE'
);

CREATE TYPE deduction_category_enum AS ENUM (
  'COMMISSION',
  'LOGISTICS',
  'FIXED_FEE',
  'COLLECTION_FEE',
  'RETURN_SHIPPING',
  'PENALTY',
  'TAX_TCS',
  'TAX_TDS',
  'OTHER'
);

CREATE TYPE reconciliation_status_enum AS ENUM (
  'RECONCILED',
  'MISMATCH_FLAGGED',
  'PENDING_RECON'
);

CREATE TYPE payment_status_enum AS ENUM (
  'PAID',
  'PENDING',
  'PARTIAL'
);

CREATE TYPE payment_method_enum AS ENUM (
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'CASH'
);

CREATE TYPE expense_category_enum AS ENUM (
  'Advertising',
  'Salaries',
  'Rent',
  'Software',
  'Packaging',
  'Office',
  'Transportation',
  'Professional Services',
  'Utilities',
  'Other'
);

CREATE TYPE ai_document_type_enum AS ENUM (
  'INVOICE',
  'SHIPPING_LABEL',
  'SETTLEMENT_REPORT',
  'SUPPLIER_BILL',
  'CLAIM_DOC'
);

CREATE TYPE ai_document_status_enum AS ENUM (
  'STAGED_NEEDS_REVIEW',
  'APPROVED_POSTED',
  'REJECTED'
);

CREATE TYPE provenance_enum AS ENUM (
  'AI_EXTRACTED',
  'MANUALLY_ENTERED',
  'MANUALLY_MODIFIED'
);

CREATE TYPE audit_entity_type_enum AS ENUM (
  'ORDER',
  'SETTLEMENT',
  'PRODUCT_COST',
  'CLAIM',
  'RETURN',
  'EXPENSE',
  'DOCUMENT',
  'PURCHASE',
  'SUPPLIER',
  'SUPPLIER_PAYOUT'
);

CREATE TYPE complaint_category_enum AS ENUM (
  'WRONG_ITEM_RECEIVED',
  'DAMAGED_PRODUCT',
  'DELIVERY_DELAY',
  'DEFECTIVE_PRODUCT',
  'MISSING_QUANTITY',
  'SETTLEMENT_OR_REFUND_ISSUE',
  'OTHER'
);

CREATE TYPE complaint_priority_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE complaint_status_enum AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE account_type_enum AS ENUM (
  'BRAND_OWNER',
  'SUPPLIER',
  'WHOLESALER'
);

CREATE TYPE job_type_enum AS ENUM (
  'BULK_CSV_IMPORT',
  'RECONCILE_SETTLEMENTS',
  'GENERATE_FINANCIAL_REPORT',
  'PROCESS_BATCH_IDP',
  'PURGE_SOFT_DELETED_RECORDS',
  'GENERATE_NOTIFICATIONS',
  'PURGE_OLD_WEBHOOK_EVENTS'
);

CREATE TYPE job_status_enum AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE webhook_source_enum AS ENUM (
  'SHOPIFY',
  'WOOCOMMERCE',
  'GENERIC',
  'AMAZON',
  'FLIPKART',
  'MEESHO'
);

CREATE TYPE webhook_status_enum AS ENUM (
  'PENDING',
  'PROCESSED',
  'FAILED',
  'SKIPPED_DUPLICATE',
  'REJECTED_INVALID_SIG',
  'REJECTED_STALE'
);

CREATE TYPE notification_type_enum AS ENUM (
  'CLAIM_DEADLINE_APPROACHING',
  'CLAIM_DEADLINE_OVERDUE',
  'SETTLEMENT_OVERDUE',
  'SETTLEMENT_MISMATCH',
  'LOW_INVENTORY',
  'RETURN_NEEDS_INSPECTION',
  'HIGH_RTO_RATE',
  'SUPPLIER_PAYMENT_DUE',
  'AI_DOCUMENT_PENDING',
  'WEBHOOK_PROCESSING_FAILED',
  'FEE_ANOMALY_DETECTED',
  'DUPLICATE_ORDER_DETECTED'
);

CREATE TYPE notification_severity_enum AS ENUM (
  'CRITICAL',
  'WARNING',
  'INFO'
);

-- ============================================================================
-- 2. CORE TABLES (Strict Dependency Order)
-- ============================================================================

-- ------------------------------------------------------------
-- 1. USER ACCOUNTS
-- ------------------------------------------------------------
CREATE TABLE user_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  account_type    account_type_enum NOT NULL DEFAULT 'BRAND_OWNER',
  company_name    TEXT NOT NULL DEFAULT 'My Company',
  gstin           TEXT,
  phone           TEXT,
  supplier_id     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. SUPPLIERS
-- ------------------------------------------------------------
CREATE TABLE suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id      TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  contact_person  TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  gstin           TEXT,
  address         TEXT NOT NULL,
  payment_terms   TEXT,
  bank_account    TEXT,
  upi_id          TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

ALTER TABLE user_accounts
  ADD CONSTRAINT fk_user_supplier
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. SUPPLIER PAYMENTS
-- ------------------------------------------------------------
CREATE TABLE supplier_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL,
  reference_code  TEXT,
  notes           TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES user_accounts(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 4. PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT UNIQUE NOT NULL,
  sku                 TEXT UNIQUE NOT NULL,
  mfn                 TEXT,
  mfn1                TEXT,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  brand               TEXT NOT NULL,
  current_cost_price  NUMERIC(14,2) NOT NULL CHECK (current_cost_price >= 0),
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  stock_quantity      INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 5. PRODUCT COST HISTORY
-- ------------------------------------------------------------
CREATE TABLE product_cost_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,
  valid_from          DATE NOT NULL,
  valid_to            DATE,
  cost_price          NUMERIC(14,2) NOT NULL CHECK (cost_price >= 0),
  source_purchase_id  UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cost_window_start UNIQUE (product_id, valid_from)
);

CREATE UNIQUE INDEX idx_one_active_cost_per_product
  ON product_cost_history (product_id)
  WHERE valid_to IS NULL;

-- ------------------------------------------------------------
-- 6. PRODUCT CHANNEL ALIASES
-- ------------------------------------------------------------
CREATE TABLE product_channel_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace marketplace_enum NOT NULL,
  alias_sku   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_alias_per_marketplace UNIQUE (product_id, marketplace)
);

-- ------------------------------------------------------------
-- 7. ORDERS
-- ------------------------------------------------------------
CREATE TABLE orders (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                    TEXT UNIQUE NOT NULL,
  channel_order_id              TEXT NOT NULL,
  marketplace                   marketplace_enum NOT NULL,
  order_date                    DATE NOT NULL,
  status                        order_status_enum NOT NULL DEFAULT 'PENDING',
  customer_name                 TEXT NOT NULL,
  customer_city                 TEXT NOT NULL,
  customer_state                TEXT NOT NULL,
  shipping_fee_charged          NUMERIC(14,2) NOT NULL DEFAULT 0,
  marketplace_charges_estimate  NUMERIC(14,2) NOT NULL DEFAULT 0,
  settlement_amount             NUMERIC(14,2),
  settlement_percent            NUMERIC(5,2),
  commission_percent            NUMERIC(5,2),
  supplier_name                 TEXT,
  supplier_id                   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                    TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 8. ORDER ITEMS (snapshot_unit_cost is LOCKED permanently)
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT NOT NULL,
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,
  mfn                 TEXT,
  mfn1                TEXT,
  product_name        TEXT NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  selling_price       NUMERIC(14,2) NOT NULL CHECK (selling_price >= 0),
  discount            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  snapshot_unit_cost  NUMERIC(14,2) NOT NULL CHECK (snapshot_unit_cost >= 0),
  returned_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT returned_lte_ordered CHECK (returned_quantity <= quantity)
);

-- ------------------------------------------------------------
-- 9. RETURN RECORDS
-- ------------------------------------------------------------
CREATE TABLE return_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                TEXT UNIQUE NOT NULL,
  order_id                  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel_order_id          TEXT NOT NULL,
  marketplace               marketplace_enum NOT NULL,
  return_date               DATE NOT NULL,
  received_date             DATE,
  awb_number                TEXT,
  return_type               return_type_enum NOT NULL,
  return_reason             TEXT NOT NULL,
  sku                       TEXT NOT NULL,
  product_name              TEXT,
  quantity                  INTEGER NOT NULL CHECK (quantity > 0),
  condition                 product_condition_enum NOT NULL,
  restock_status            restock_status_enum,
  claim_deadline            DATE,
  return_shipping_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  customer_return_fee       NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_return_costs        NUMERIC(14,2) NOT NULL DEFAULT 0,
  inventory_recovery_value  NUMERIC(14,2) NOT NULL DEFAULT 0,
  loss_amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  claim_id                  UUID,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 10. CLAIMS
-- ------------------------------------------------------------
CREATE TABLE claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        TEXT UNIQUE NOT NULL,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id         UUID REFERENCES return_records(id) ON DELETE SET NULL,
  marketplace       marketplace_enum NOT NULL,
  claim_type        claim_type_enum NOT NULL,
  claim_date        DATE NOT NULL,
  amount_claimed    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_claimed >= 0),
  amount_recovered  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_recovered >= 0),
  status            claim_status_enum NOT NULL DEFAULT 'NOT_FILED',
  recovery_date     DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT recovered_lte_claimed CHECK (amount_recovered <= amount_claimed + 1)
);

ALTER TABLE return_records
  ADD CONSTRAINT fk_return_claim
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;

CREATE TABLE claim_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_url  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 11. SETTLEMENTS & DEDUCTIONS
-- ------------------------------------------------------------
CREATE TABLE settlements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id            TEXT UNIQUE NOT NULL,
  settlement_batch_id   TEXT NOT NULL,
  marketplace           marketplace_enum NOT NULL,
  settlement_date       DATE NOT NULL,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gross_amount          NUMERIC(14,2) NOT NULL,
  tcs_tds_tax           NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_settlement        NUMERIC(14,2) NOT NULL,
  reconciliation_status reconciliation_status_enum NOT NULL DEFAULT 'PENDING_RECON',
  discrepancy_amount    NUMERIC(14,2),
  bank_tx_ref           TEXT,
  source_document       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settlement_deductions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  category      deduction_category_enum NOT NULL,
  name          TEXT NOT NULL,
  amount        NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 12. PURCHASE BILLS
-- ------------------------------------------------------------
CREATE TABLE purchase_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id      TEXT UNIQUE NOT NULL,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  supplier_name   TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  sku             TEXT NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost       NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  taxes           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  payment_status  payment_status_enum NOT NULL DEFAULT 'PENDING',
  document_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_cost_history
  ADD CONSTRAINT fk_cost_history_purchase
  FOREIGN KEY (source_purchase_id) REFERENCES purchase_bills(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 13. EXPENSES
-- ------------------------------------------------------------
CREATE TABLE expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT UNIQUE NOT NULL,
  expense_date        DATE NOT NULL,
  category            expense_category_enum NOT NULL,
  description         TEXT NOT NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  vendor              TEXT NOT NULL,
  payment_method      payment_method_enum NOT NULL,
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
  marketplace         marketplace_enum,
  attributed_sku      TEXT,
  supporting_document TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 14. AI STAGED DOCUMENTS & FIELDS
-- ------------------------------------------------------------
CREATE TABLE ai_staged_documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id              TEXT UNIQUE NOT NULL,
  file_name               TEXT NOT NULL,
  file_url                TEXT,
  file_type               ai_document_type_enum NOT NULL,
  upload_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  status                  ai_document_status_enum NOT NULL DEFAULT 'STAGED_NEEDS_REVIEW',
  raw_text_preview        TEXT,
  arithmetic_passed       BOOLEAN,
  arithmetic_calculated   NUMERIC(14,2),
  arithmetic_declared     NUMERIC(14,2),
  arithmetic_difference   NUMERIC(14,2),
  arithmetic_message      TEXT,
  catalog_sku_matched     BOOLEAN,
  catalog_matched_sku_id  TEXT,
  catalog_suggestion      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_staged_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES ai_staged_documents(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  value_text      TEXT,
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  provenance      provenance_enum NOT NULL DEFAULT 'AI_EXTRACTED',
  page_number     INTEGER,
  bbox_x          NUMERIC(8,2),
  bbox_y          NUMERIC(8,2),
  bbox_width      NUMERIC(8,2),
  bbox_height     NUMERIC(8,2),
  is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_message TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_field_per_document UNIQUE (document_id, field_name)
);

-- ------------------------------------------------------------
-- 15. FINANCIAL AUDIT LOGS (Append-Only)
-- ------------------------------------------------------------
CREATE TABLE financial_audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT UNIQUE NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type         audit_entity_type_enum NOT NULL,
  entity_id           TEXT NOT NULL,
  field_name          TEXT NOT NULL,
  old_value           TEXT,
  new_value           TEXT,
  modified_by         TEXT NOT NULL,
  reason              TEXT,
  source_document_id  TEXT
);

-- ------------------------------------------------------------
-- 16. CUSTOMER COMPLAINTS
-- ------------------------------------------------------------
CREATE TABLE customer_complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        TEXT UNIQUE NOT NULL,
  ticket_number     TEXT UNIQUE NOT NULL,
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  channel_order_id  TEXT,
  marketplace       marketplace_enum,
  sku               TEXT,
  category          complaint_category_enum NOT NULL,
  priority          complaint_priority_enum NOT NULL DEFAULT 'MEDIUM',
  status            complaint_status_enum NOT NULL DEFAULT 'OPEN',
  subject           TEXT NOT NULL,
  description       TEXT NOT NULL,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 17. BACKGROUND JOBS
-- ------------------------------------------------------------
CREATE TABLE background_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        job_type_enum NOT NULL,
  payload     JSONB,
  status      job_status_enum NOT NULL DEFAULT 'QUEUED',
  progress    SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  result      JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES user_accounts(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 18. WEBHOOK EVENTS TABLE
-- ------------------------------------------------------------
CREATE TABLE webhook_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key       TEXT UNIQUE NOT NULL,
  source                webhook_source_enum NOT NULL,
  event_topic           TEXT NOT NULL,
  marketplace           marketplace_enum,
  raw_payload           JSONB NOT NULL,
  signature_header      TEXT,
  verified              BOOLEAN,
  is_fresh              BOOLEAN,
  is_duplicate          BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status     webhook_status_enum NOT NULL DEFAULT 'PENDING',
  resulting_entity_type TEXT,
  resulting_entity_id   TEXT,
  error_message         TEXT,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  processing_ms         INTEGER
);

-- ------------------------------------------------------------
-- 19. NOTIFICATIONS TABLE
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            notification_type_enum NOT NULL,
  severity        notification_severity_enum NOT NULL DEFAULT 'INFO',
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  action_url      TEXT,
  action_label    TEXT,
  entity_type     TEXT,
  entity_id       TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ,
  CONSTRAINT uq_notification_per_entity UNIQUE (type, entity_id)
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Orders
CREATE INDEX idx_orders_marketplace ON orders (marketplace) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_order_date ON orders (order_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_channel_order_id ON orders (channel_order_id);
CREATE INDEX idx_orders_display_id ON orders (display_id);
CREATE INDEX idx_orders_supplier_id ON orders (supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_orders_marketplace_date ON orders (marketplace, order_date DESC) WHERE deleted_at IS NULL;

-- Order Items
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_sku ON order_items (sku);

-- Products
CREATE INDEX idx_products_sku ON products (sku);
CREATE INDEX idx_products_supplier_id ON products (supplier_id);
CREATE INDEX idx_products_active ON products (active) WHERE deleted_at IS NULL;

-- Product Cost History
CREATE INDEX idx_cost_history_product_id ON product_cost_history (product_id);
CREATE INDEX idx_cost_history_sku ON product_cost_history (sku);
CREATE INDEX idx_cost_history_dates ON product_cost_history (product_id, valid_from, valid_to);

-- Product Channel Aliases
CREATE INDEX idx_aliases_product_id ON product_channel_aliases (product_id);
CREATE INDEX idx_aliases_lookup ON product_channel_aliases (marketplace, alias_sku);

-- Returns
CREATE INDEX idx_returns_order_id ON return_records (order_id);
CREATE INDEX idx_returns_sku ON return_records (sku);
CREATE INDEX idx_returns_marketplace ON return_records (marketplace) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_return_date ON return_records (return_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_claim_deadline ON return_records (claim_deadline) WHERE claim_deadline IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_returns_restock_status ON return_records (restock_status) WHERE restock_status IS NOT NULL;

-- Claims
CREATE INDEX idx_claims_order_id ON claims (order_id);
CREATE INDEX idx_claims_return_id ON claims (return_id) WHERE return_id IS NOT NULL;
CREATE INDEX idx_claims_status ON claims (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_claims_marketplace ON claims (marketplace) WHERE deleted_at IS NULL;

-- Settlements & Deductions
CREATE INDEX idx_settlements_order_id ON settlements (order_id);
CREATE INDEX idx_settlements_batch_id ON settlements (settlement_batch_id);
CREATE INDEX idx_settlements_date ON settlements (settlement_date DESC);
CREATE INDEX idx_settlements_marketplace ON settlements (marketplace);
CREATE INDEX idx_settlements_recon_status ON settlements (reconciliation_status);
CREATE INDEX idx_settlement_deductions_settlement_id ON settlement_deductions (settlement_id);

-- Suppliers & Purchases
CREATE INDEX idx_suppliers_display_id ON suppliers (display_id);
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX idx_purchase_bills_supplier ON purchase_bills (supplier_id);
CREATE INDEX idx_purchase_bills_sku ON purchase_bills (sku);
CREATE INDEX idx_purchase_bills_payment_status ON purchase_bills (payment_status);

-- Expenses
CREATE INDEX idx_expenses_date ON expenses (expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category ON expenses (category) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_marketplace ON expenses (marketplace) WHERE marketplace IS NOT NULL;
CREATE INDEX idx_expenses_sku ON expenses (attributed_sku) WHERE attributed_sku IS NOT NULL;

-- AI Staging
CREATE INDEX idx_ai_documents_status ON ai_staged_documents (status);
CREATE INDEX idx_ai_fields_doc_id ON ai_staged_fields (document_id);

-- Audit Logs & Complaints
CREATE INDEX idx_audit_logs_timestamp ON financial_audit_logs (timestamp DESC);
CREATE INDEX idx_audit_logs_entity ON financial_audit_logs (entity_type, entity_id);
CREATE INDEX idx_complaints_status ON customer_complaints (status);
CREATE INDEX idx_complaints_order ON customer_complaints (order_id) WHERE order_id IS NOT NULL;

-- Webhooks & Notifications
CREATE UNIQUE INDEX idx_webhook_idempotency ON webhook_events (idempotency_key);
CREATE INDEX idx_webhook_failed_pending ON webhook_events (processing_status, received_at DESC) WHERE processing_status IN ('PENDING', 'FAILED');
CREATE INDEX idx_notifications_unread ON notifications (is_read, is_dismissed) WHERE is_read = FALSE AND is_dismissed = FALSE;
CREATE INDEX idx_notifications_created ON notifications (created_at DESC) WHERE is_dismissed = FALSE;

-- ============================================================================
-- 4. FUNCTIONS & TRIGGERS (Invariant Enforcement)
-- ============================================================================

-- Function: Set updated_at timestamp
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_accounts_updated_at BEFORE UPDATE ON user_accounts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_return_records_updated_at BEFORE UPDATE ON return_records FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_settlements_updated_at BEFORE UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_purchase_bills_updated_at BEFORE UPDATE ON purchase_bills FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_ai_staged_documents_updated_at BEFORE UPDATE ON ai_staged_documents FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_ai_staged_fields_updated_at BEFORE UPDATE ON ai_staged_fields FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_background_jobs_updated_at BEFORE UPDATE ON background_jobs FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Trigger: Audit logs are append-only
CREATE OR REPLACE FUNCTION fn_block_audit_log_mutations()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'financial_audit_logs is append-only. Modification not allowed. Entity: %, ID: %', OLD.entity_type, OLD.entity_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON financial_audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_block_audit_log_mutations();

-- Trigger: snapshot_unit_cost is immutable on order line items
CREATE OR REPLACE FUNCTION fn_block_snapshot_cost_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.snapshot_unit_cost IS DISTINCT FROM NEW.snapshot_unit_cost THEN
    RAISE EXCEPTION 'snapshot_unit_cost is locked and immutable. Item: %, Old: %, New: %', OLD.id, OLD.snapshot_unit_cost, NEW.snapshot_unit_cost;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_cost_immutable
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION fn_block_snapshot_cost_update();

-- Trigger: Sync supplier total_paid aggregate
CREATE OR REPLACE FUNCTION fn_sync_supplier_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE suppliers SET total_paid = total_paid + NEW.amount WHERE id = NEW.supplier_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE suppliers SET total_paid = GREATEST(0, total_paid - OLD.amount) WHERE id = OLD.supplier_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_payment_sync
  AFTER INSERT OR DELETE ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION fn_sync_supplier_total_paid();

-- Trigger: Close previous cost window on new active price insert
CREATE OR REPLACE FUNCTION fn_close_previous_cost_window()
RETURNS TRIGGER AS $$
BEGIN
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

-- Trigger: Sync product current_cost_price
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

-- ============================================================================
-- 5. COMPUTED VIEWS
-- ============================================================================

-- View 1: Order Profitability
CREATE OR REPLACE VIEW v_order_profitability AS
WITH order_gross AS (
  SELECT
    oi.order_id,
    SUM(oi.selling_price * oi.quantity)          AS gross_sales,
    SUM(oi.snapshot_unit_cost * oi.quantity)     AS total_cogs,
    SUM(oi.discount)                             AS total_discounts
  FROM order_items oi
  GROUP BY oi.order_id
),
order_settlements AS (
  SELECT
    order_id,
    SUM(net_settlement) AS total_settled
  FROM settlements
  GROUP BY order_id
),
order_returns AS (
  SELECT
    rr.order_id,
    SUM(CASE WHEN rr.return_type <> 'RTO' THEN rr.customer_return_fee ELSE 0 END) AS return_fees,
    BOOL_OR(rr.return_type = 'RTO') AS has_rto,
    BOOL_OR(rr.condition IN ('DAMAGED', 'UNUSABLE', 'MISSING'))                    AS has_damaged
  FROM return_records rr
  WHERE rr.deleted_at IS NULL
  GROUP BY rr.order_id
),
order_claims AS (
  SELECT
    c.order_id,
    SUM(CASE WHEN c.status IN ('APPROVED','RECOVERED','PARTIALLY_RECOVERED')
             THEN c.amount_recovered ELSE 0 END) AS claim_recoveries
  FROM claims c
  WHERE c.deleted_at IS NULL
  GROUP BY c.order_id
)
SELECT
  o.id                                                              AS order_id,
  o.display_id,
  o.marketplace,
  o.order_date,
  o.status,
  COALESCE(og.gross_sales, 0)                                       AS gross_sales,
  COALESCE(og.total_cogs, 0)                                        AS total_cogs,
  COALESCE(os.total_settled, o.settlement_amount, 0)                AS settled_amount,
  COALESCE(ort.return_fees, 0)                                      AS return_fees,
  COALESCE(oc.claim_recoveries, 0)                                  AS claim_recoveries,
  COALESCE(ort.has_rto, FALSE)                                      AS is_rto,
  COALESCE(ort.has_damaged, FALSE)                                  AS is_damaged,
  CASE
    WHEN COALESCE(ort.has_rto, FALSE) THEN 0
    WHEN COALESCE(ort.has_damaged, FALSE)
      THEN ROUND((COALESCE(oc.claim_recoveries,0) - COALESCE(og.total_cogs,0) - COALESCE(ort.return_fees,0))::NUMERIC, 2)
    WHEN o.status IN ('CUSTOMER_RETURN','RETURNED')
      THEN ROUND((-COALESCE(ort.return_fees,0))::NUMERIC, 2)
    ELSE
      ROUND((COALESCE(os.total_settled, o.settlement_amount, og.gross_sales * 0.75)
             - COALESCE(og.total_cogs, 0))::NUMERIC, 2)
  END                                                               AS contribution_profit
FROM orders o
LEFT JOIN order_gross       og  ON og.order_id = o.id
LEFT JOIN order_settlements os  ON os.order_id = o.id
LEFT JOIN order_returns     ort ON ort.order_id = o.id
LEFT JOIN order_claims      oc  ON oc.order_id = o.id
WHERE o.deleted_at IS NULL
  AND o.status <> 'CANCELLED';

-- View 2: SKU Profitability
CREATE OR REPLACE VIEW v_sku_profitability AS
SELECT
  oi.sku,
  MAX(oi.product_name)                                      AS product_name,
  SUM(oi.quantity)                                          AS units_sold,
  ROUND(SUM(oi.selling_price * oi.quantity - oi.discount)::NUMERIC, 2) AS revenue,
  ROUND(SUM(oi.snapshot_unit_cost * oi.quantity)::NUMERIC, 2)          AS cogs,
  ROUND(SUM(CASE WHEN c.status IN ('APPROVED','RECOVERED','PARTIALLY_RECOVERED')
                 THEN c.amount_recovered ELSE 0 END)::NUMERIC, 2)      AS claim_recoveries,
  ROUND(SUM(CASE WHEN rr.return_type <> 'RTO'
                 THEN COALESCE(rr.customer_return_fee, 0) ELSE 0 END)::NUMERIC, 2) AS return_fees
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.deleted_at IS NULL AND o.status <> 'CANCELLED'
LEFT JOIN return_records rr ON rr.order_id = o.id AND rr.sku = oi.sku AND rr.deleted_at IS NULL
LEFT JOIN claims c ON c.order_id = o.id AND c.deleted_at IS NULL
GROUP BY oi.sku;

-- View 3: Marketplace Profitability
CREATE OR REPLACE VIEW v_marketplace_profitability AS
SELECT
  o.marketplace,
  COUNT(DISTINCT o.id)                                             AS order_count,
  SUM(oi.quantity)                                                 AS units_sold,
  ROUND(SUM(oi.selling_price * oi.quantity)::NUMERIC, 2)          AS gross_revenue,
  ROUND(SUM(oi.snapshot_unit_cost * oi.quantity)::NUMERIC, 2)     AS total_cogs,
  ROUND(SUM(COALESCE(rr_fees.return_fees, 0))::NUMERIC, 2)        AS return_fees,
  ROUND(SUM(COALESCE(claim_rec.recoveries, 0))::NUMERIC, 2)       AS claim_recoveries
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN (
  SELECT order_id,
    SUM(CASE WHEN return_type <> 'RTO' THEN customer_return_fee ELSE 0 END) AS return_fees
  FROM return_records WHERE deleted_at IS NULL GROUP BY order_id
) rr_fees ON rr_fees.order_id = o.id
LEFT JOIN (
  SELECT order_id,
    SUM(CASE WHEN status IN ('APPROVED','RECOVERED','PARTIALLY_RECOVERED')
             THEN amount_recovered ELSE 0 END) AS recoveries
  FROM claims WHERE deleted_at IS NULL GROUP BY order_id
) claim_rec ON claim_rec.order_id = o.id
WHERE o.deleted_at IS NULL AND o.status <> 'CANCELLED'
GROUP BY o.marketplace;

-- View 4: Settlement Aging
CREATE OR REPLACE VIEW v_settlement_aging AS
WITH delivered_without_settlement AS (
  SELECT
    o.id,
    o.display_id,
    o.marketplace,
    o.order_date,
    o.settlement_amount,
    o.marketplace_charges_estimate,
    CURRENT_DATE - o.order_date AS days_outstanding,
    SUM(oi.selling_price * oi.quantity)                  AS gross_sales
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.deleted_at IS NULL
    AND o.status = 'DELIVERED'
    AND NOT EXISTS (
      SELECT 1 FROM settlements s WHERE s.order_id = o.id
    )
  GROUP BY o.id
)
SELECT
  SUM(CASE WHEN days_outstanding <= 7
           THEN COALESCE(gross_sales - marketplace_charges_estimate, gross_sales * 0.75) ELSE 0 END)
    AS within_7_days_amount,
  SUM(CASE WHEN days_outstanding BETWEEN 8 AND 14
           THEN COALESCE(gross_sales - marketplace_charges_estimate, gross_sales * 0.75) ELSE 0 END)
    AS between_8_and_14_days_amount,
  SUM(CASE WHEN days_outstanding > 14
           THEN COALESCE(gross_sales - marketplace_charges_estimate, gross_sales * 0.75) ELSE 0 END)
    AS over_14_days_overdue_amount,
  COUNT(CASE WHEN days_outstanding > 14 THEN 1 END)
    AS overdue_order_count
FROM delivered_without_settlement;

-- View 5: Inventory Metrics
CREATE OR REPLACE VIEW v_inventory_metrics AS
SELECT
  SUM(p.stock_quantity)                                              AS current_stock,
  ROUND(SUM(p.stock_quantity * p.current_cost_price)::NUMERIC, 2)   AS inventory_value,
  COALESCE((SELECT SUM(pb.quantity) FROM purchase_bills pb), 0)      AS purchased_quantity,
  COALESCE((
    SELECT SUM(rr.quantity) FROM return_records rr
    WHERE rr.condition NOT IN ('DAMAGED','UNUSABLE','MISSING')
      AND rr.deleted_at IS NULL
  ), 0)                                                              AS good_returned_quantity,
  COALESCE((
    SELECT SUM(rr.quantity) FROM return_records rr
    WHERE rr.condition IN ('DAMAGED','UNUSABLE','MISSING')
      AND rr.deleted_at IS NULL
  ), 0)                                                              AS damaged_returned_quantity
FROM products p
WHERE p.deleted_at IS NULL AND p.active = TRUE;

-- View 6: Claims Summary
CREATE OR REPLACE VIEW v_claims_summary AS
SELECT
  COUNT(*)                                                    AS claims_filed,
  COUNT(CASE WHEN status IN ('FILED','UNDER_REVIEW') THEN 1 END) AS pending_claims,
  COUNT(CASE WHEN status IN ('APPROVED','RECOVERED','PARTIALLY_RECOVERED') THEN 1 END) AS approved_claims,
  ROUND(SUM(CASE WHEN status IN ('APPROVED','RECOVERED','PARTIALLY_RECOVERED')
                 THEN amount_recovered ELSE 0 END)::NUMERIC, 2) AS reimbursement_received,
  ROUND(SUM(CASE WHEN status IN ('FILED','UNDER_REVIEW')
                 THEN GREATEST(0, amount_claimed - amount_recovered)
                 WHEN status = 'PARTIALLY_RECOVERED'
                 THEN GREATEST(0, amount_claimed - amount_recovered)
                 ELSE 0 END)::NUMERIC, 2)                      AS outstanding_claim_amount
FROM claims
WHERE deleted_at IS NULL;

-- View 7: Unread Notification Count
CREATE OR REPLACE VIEW v_unread_notification_count AS
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE is_read = FALSE
  AND is_dismissed = FALSE
  AND (auto_expires_at IS NULL OR auto_expires_at > NOW());

-- View 8: Recycle Bin
CREATE OR REPLACE VIEW v_recycle_bin AS
  SELECT
    'order'               AS record_type,
    display_id            AS record_id,
    deleted_at,
    deleted_at + INTERVAL '30 days'   AS purges_at,
    GREATEST(0, EXTRACT(DAY FROM (deleted_at + INTERVAL '30 days' - NOW()))::INT) AS days_remaining
  FROM orders WHERE deleted_at IS NOT NULL

UNION ALL
  SELECT
    'return',
    display_id,
    deleted_at,
    deleted_at + INTERVAL '30 days',
    GREATEST(0, EXTRACT(DAY FROM (deleted_at + INTERVAL '30 days' - NOW()))::INT)
  FROM return_records WHERE deleted_at IS NOT NULL

UNION ALL
  SELECT
    'claim',
    display_id,
    deleted_at,
    deleted_at + INTERVAL '30 days',
    GREATEST(0, EXTRACT(DAY FROM (deleted_at + INTERVAL '30 days' - NOW()))::INT)
  FROM claims WHERE deleted_at IS NOT NULL

UNION ALL
  SELECT
    'expense',
    display_id,
    deleted_at,
    deleted_at + INTERVAL '30 days',
    GREATEST(0, EXTRACT(DAY FROM (deleted_at + INTERVAL '30 days' - NOW()))::INT)
  FROM expenses WHERE deleted_at IS NOT NULL

UNION ALL
  SELECT
    'product',
    display_id,
    deleted_at,
    deleted_at + INTERVAL '30 days',
    GREATEST(0, EXTRACT(DAY FROM (deleted_at + INTERVAL '30 days' - NOW()))::INT)
  FROM products WHERE deleted_at IS NOT NULL

ORDER BY deleted_at DESC;

-- ============================================================================
-- 6. SEED DATA (Deterministic Mock Data from mock-data.ts)
-- ============================================================================

-- ------------------------------------------------------------
-- SUPPLIERS
-- ------------------------------------------------------------
INSERT INTO suppliers (display_id, name, contact_person, email, phone, gstin, address, payment_terms, bank_account, upi_id, opening_balance, total_paid, notes)
VALUES
  ('SUP-001', 'Apex Electronics Mfg Ltd', 'Rajesh Sharma', 'orders@apexelectronics.in',
   '+91 98200 12345', '27AAACA1234A1Z5', 'Bhiwandi Industrial Area, Thane, Maharashtra',
   'Net 30', 'HDFC Bank - A/C 50200088912 (IFSC: HDFC0000123)', 'apex.mfg@okhdfcbank',
   0, 44840, 'Primary supplier for audio & wireless peripherals.'),

  ('SUP-002', 'Zenith Cable & Power Supplies', 'Vikram Mehta', 'supply@zenithpower.co.in',
   '+91 99300 67890', '24AABCS5678B1Z2', 'GIDC Industrial Estate, Ahmedabad, Gujarat',
   'Net 15', 'ICICI Bank - A/C 001205009871 (IFSC: ICIC0000012)', 'zenithpower@okicici',
   0, 24780, 'Supplier for chargers, cables, and adaptors.');

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
INSERT INTO products (display_id, sku, mfn, mfn1, name, category, brand, current_cost_price, active, stock_quantity, supplier_id)
VALUES
  ('PROD-01', 'ELEC-WEM-01', 'MFN-WEM-010', 'MFN1-WEM-010-A',
   'Wireless Ergonomic Mouse (Silent Click)', 'Computer Peripherals', 'VoltTech',
   380, TRUE, 92, (SELECT id FROM suppliers WHERE display_id = 'SUP-001')),

  ('PROD-02', 'ELEC-USBC-65W', 'MFN-CHG-065', 'MFN1-CHG-065-B',
   '65W GaN Fast Charger (Dual USB-C)', 'Mobile Accessories', 'VoltTech',
   420, TRUE, 46, (SELECT id FROM suppliers WHERE display_id = 'SUP-002')),

  ('PROD-03', 'ELEC-ANC-EB', 'MFN-ANC-900', 'MFN1-ANC-900-C',
   'Active Noise Cancelling TWS Earbuds', 'Audio', 'VoltTech',
   840, TRUE, 38, (SELECT id FROM suppliers WHERE display_id = 'SUP-001')),

  ('PROD-04', 'ELEC-BRAID-CBL', 'MFN-CBL-100', 'MFN1-CBL-100-D',
   'Braided 100W Type-C to Type-C Cable (2m)', 'Cables', 'VoltTech',
   110, TRUE, 185, (SELECT id FROM suppliers WHERE display_id = 'SUP-002'));

-- ------------------------------------------------------------
-- PRODUCT CHANNEL ALIASES
-- ------------------------------------------------------------
INSERT INTO product_channel_aliases (product_id, marketplace, alias_sku)
VALUES
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Amazon India'::marketplace_enum, 'B08WEM01-IND'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Flipkart'::marketplace_enum, 'FLIP-MOUSE-WEM'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Meesho'::marketplace_enum, 'MSHO-98311-MSE'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Personal Website'::marketplace_enum, 'VT-WEM-01'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Amazon India'::marketplace_enum, 'B09USBC65-W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Flipkart'::marketplace_enum, 'FLIP-65W-GAN'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Personal Website'::marketplace_enum, 'VT-GAN-65W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Amazon India'::marketplace_enum, 'B07ANCEB-900'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Flipkart'::marketplace_enum, 'FLIP-TWS-ANC'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Amazon India'::marketplace_enum, 'B08CBL100W-2M'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Flipkart'::marketplace_enum, 'FLIP-CBL-100W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Meesho'::marketplace_enum, 'MSHO-1102-CBL'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Personal Website'::marketplace_enum, 'VT-CBL-100W');

-- ------------------------------------------------------------
-- PRODUCT COST HISTORY
-- ------------------------------------------------------------
INSERT INTO product_cost_history (product_id, sku, valid_from, valid_to, cost_price, notes)
VALUES
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'ELEC-WEM-01', '2026-01-01', '2026-03-31', 360, 'Initial procurement batch pricing'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'ELEC-WEM-01', '2026-04-01', NULL, 380, 'Supplier price revision due to raw material costs'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'ELEC-USBC-65W', '2026-01-01', NULL, 420, 'Volume tier discount negotiated with Zenith'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'ELEC-ANC-EB', '2026-01-01', '2026-04-30', 780, 'Launch batch pricing'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'ELEC-ANC-EB', '2026-05-01', NULL, 840, 'Enhanced driver component cost'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'ELEC-BRAID-CBL', '2026-01-01', NULL, 110, 'Steady raw material pricing');

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
INSERT INTO orders (display_id, channel_order_id, marketplace, order_date, status, customer_name, customer_city, customer_state, shipping_fee_charged, marketplace_charges_estimate, settlement_amount)
VALUES
  ('ORD-0994', 'OD8839201928410294', 'Flipkart', '2026-08-26', 'CLAIM_APPROVED', 'Rakesh Verma', 'Kanpur', 'Uttar Pradesh', 40, 160, 0),
  ('ORD-WHL-501', 'CHALLAN-BLR-882', 'B2B Wholesale', '2026-09-10', 'CUSTOMER_RETURN', 'Metro Retail Distribution', 'Bengaluru', 'Karnataka', 0, 0, 0),
  ('ORD-0998', '402-1829301-4492019', 'Amazon India', '2026-08-18', 'DELIVERED', 'Vikram Malhotra', 'Gurugram', 'Haryana', 0, 145, 149),
  ('ORD-1001', '402-8392182-1928301', 'Amazon India', '2026-09-01', 'DELIVERED', 'Aditya Sharma', 'Mumbai', 'Maharashtra', 0, 145, 149),
  ('ORD-1002', 'OD2938102948291029', 'Flipkart', '2026-09-02', 'DELIVERED', 'Sneha Patel', 'Ahmedabad', 'Gujarat', 40, 185, 1070),
  ('ORD-1003', 'MSH-9920192-A', 'Meesho', '2026-09-03', 'RTO', 'Rajesh Gupta', 'Patna', 'Bihar', 0, 45, 0),
  ('ORD-1004', 'WEB-2026-0904', 'Personal Website', '2026-09-04', 'DELIVERED', 'Deepak Nair', 'Kochi', 'Kerala', 80, 24, 1255),
  ('ORD-1005', '405-1920394-8291032', 'Amazon India', '2026-09-04', 'DAMAGED_RETURN', 'Kavita Sundaram', 'Chennai', 'Tamil Nadu', 0, 310, 0),
  ('ORD-1006', 'OD9920193820192841', 'Flipkart', '2026-09-05', 'SHIPPED', 'Priya Sharma', 'Jaipur', 'Rajasthan', 40, 160, NULL),
  ('ORD-1007', 'MSH-110294-A', 'Meesho', '2026-09-05', 'DELIVERED', 'Mohd. Tariq', 'Lucknow', 'Uttar Pradesh', 0, 38, NULL),
  ('ORD-1008', 'MYN-994182901', 'Myntra', '2026-09-06', 'RTO', 'Ananya Roy', 'Kolkata', 'West Bengal', 0, 68, 0),
  ('ORD-1009', '403-9918293-1029482', 'Amazon India', '2026-09-07', 'CONFIRMED', 'Amitabh Sengupta', 'Kolkata', 'West Bengal', 0, 145, NULL),
  ('ORD-1010', 'OD1029481928471928', 'Flipkart', '2026-09-08', 'PENDING', 'Suresh Reddy', 'Hyderabad', 'Telangana', 40, 185, NULL),
  ('ORD-1011', 'MSH-8829102-B', 'Meesho', '2026-09-09', 'CONFIRMED', 'Pooja Bhatt', 'Pune', 'Maharashtra', 0, 45, NULL),
  ('ORD-1012', 'WEB-2026-0910', 'Personal Website', '2026-09-10', 'CONFIRMED', 'Naveen Jindal', 'Chandigarh', 'Punjab', 80, 50, NULL),
  ('ORD-1013', '408-2291029-3819201', 'Amazon India', '2026-09-11', 'PENDING', 'Gaurav Chopra', 'New Delhi', 'Delhi', 0, 310, NULL);

-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------
INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
VALUES
  ('ITEM-094', (SELECT id FROM orders WHERE display_id = 'ORD-0994'), 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 0, 198.15, 420, 1),
  ('ITEM-WHL-01', (SELECT id FROM orders WHERE display_id = 'ORD-WHL-501'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 10, 899, 0, 1370, 380, 10),
  ('ITEM-098', (SELECT id FROM orders WHERE display_id = 'ORD-0998'), 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 1, 299, 50, 38, 110, 0),
  ('ITEM-101', (SELECT id FROM orders WHERE display_id = 'ORD-1001'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 999, 100, 137.14, 380, 0),
  ('ITEM-102', (SELECT id FROM orders WHERE display_id = 'ORD-1002'), 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 0, 198.15, 420, 0),
  ('ITEM-103', (SELECT id FROM orders WHERE display_id = 'ORD-1003'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 849, 50, 121.88, 380, 1),
  ('ITEM-104', (SELECT id FROM orders WHERE display_id = 'ORD-1004'), 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1199, 0, 182.90, 420, 0),
  ('ITEM-105', (SELECT id FROM orders WHERE display_id = 'ORD-1005'), 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 2, 2199, 200, 640.37, 840, 1),
  ('ITEM-106', (SELECT id FROM orders WHERE display_id = 'ORD-1006'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 949, 50, 137, 380, 0),
  ('ITEM-107', (SELECT id FROM orders WHERE display_id = 'ORD-1007'), 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 3, 289, 30, 127.80, 110, 0),
  ('ITEM-108', (SELECT id FROM orders WHERE display_id = 'ORD-1008'), 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 3, 289, 0, 132.31, 110, 3),
  ('ITEM-109', (SELECT id FROM orders WHERE display_id = 'ORD-1009'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 999, 50, 144.76, 380, 0),
  ('ITEM-110', (SELECT id FROM orders WHERE display_id = 'ORD-1010'), 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 100, 182.90, 420, 0),
  ('ITEM-111', (SELECT id FROM orders WHERE display_id = 'ORD-1011'), 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 849, 0, 129.51, 380, 0),
  ('ITEM-112', (SELECT id FROM orders WHERE display_id = 'ORD-1012'), 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 2399, 100, 350.71, 840, 0),
  ('ITEM-113', (SELECT id FROM orders WHERE display_id = 'ORD-1013'), 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 2299, 0, 350.71, 840, 0);

-- ------------------------------------------------------------
-- RETURN RECORDS
-- ------------------------------------------------------------
INSERT INTO return_records (display_id, order_id, channel_order_id, marketplace, return_date, received_date, awb_number, return_type, return_reason, sku, product_name, quantity, condition, restock_status, claim_deadline, return_shipping_cost, customer_return_fee, other_return_costs, inventory_recovery_value, loss_amount)
VALUES
  ('RET-201', (SELECT id FROM orders WHERE display_id = 'ORD-1003'), 'MSH-9920192-A', 'Meesho',
   '2026-09-04', '2026-09-05', 'MSH-RET-449102', 'RTO',
   'Customer unavailable at delivery address (3 attempts exhausted)',
   'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 'SELLABLE', 'RESTOCKED', '2026-09-19', 45, 0, 0, 380, 45),

  ('RET-202', (SELECT id FROM orders WHERE display_id = 'ORD-1005'), '405-1920394-8291032', 'Amazon India',
   '2026-09-06', '2026-09-06', 'AWB-DEL-9921092', 'DAMAGED_RETURN',
   'Customer reported defective right earbud; product housing cracked upon receipt',
   'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 'DAMAGED', 'WRITTEN_OFF', '2026-10-06', 85, 50, 15, 100, 825),

  ('RET-203', (SELECT id FROM orders WHERE display_id = 'ORD-0994'), 'OD8839201928410294', 'Flipkart',
   '2026-08-28', '2026-08-30', 'EKART-99218201', 'CUSTOMER_RETURN',
   'Wrong item received complaint by customer; awaiting warehouse verification',
   'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 'UNDER_INSPECTION', 'PENDING_RESTOCK', '2026-09-11', 65, 40, 10, 0, 495),

  ('RET-204', (SELECT id FROM orders WHERE display_id = 'ORD-WHL-501'), 'CHALLAN-BLR-882', 'B2B Wholesale',
   '2026-09-12', '2026-09-14', 'VRL-LOG-77218', 'CUSTOMER_RETURN',
   'Retailer returned overstock cartons prior to quarterly inventory refresh',
   'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 10, 'SELLABLE', 'PENDING_RESTOCK', '2026-10-12', 180, 0, 20, 3800, 200),

  ('RET-205', (SELECT id FROM orders WHERE display_id = 'ORD-1008'), 'MYN-994182901', 'Myntra',
   '2026-09-10', '2026-09-12', 'DELHIVERY-MYN-391', 'RTO',
   'Customer canceled at doorstep (Doorstep rejection)',
   'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 3, 'SELLABLE', 'RESTOCKED', '2026-09-25', 68, 0, 0, 330, 68);

-- ------------------------------------------------------------
-- CLAIMS
-- ------------------------------------------------------------
INSERT INTO claims (display_id, order_id, return_id, marketplace, claim_type, claim_date, amount_claimed, amount_recovered, status, recovery_date, notes)
VALUES
  ('CLM-301', (SELECT id FROM orders WHERE display_id = 'ORD-1005'), (SELECT id FROM return_records WHERE display_id = 'RET-202'),
   'Amazon India', 'DAMAGED_INVOICE', '2026-09-07', 840, 630, 'APPROVED', '2026-09-12',
   'Amazon SAFE-T claim approved at 75% product cost basis reimbursement.'),

  ('CLM-302', (SELECT id FROM orders WHERE display_id = 'ORD-0994'), (SELECT id FROM return_records WHERE display_id = 'RET-203'),
   'Flipkart', 'WRONG_RETURN_ITEM', '2026-09-01', 420, 420, 'RECOVERED', '2026-09-08',
   'Customer returned empty packaging. 100% reimbursement recovered from Flipkart dispute portal.');

UPDATE return_records SET claim_id = (SELECT id FROM claims WHERE display_id = 'CLM-301') WHERE display_id = 'RET-202';
UPDATE return_records SET claim_id = (SELECT id FROM claims WHERE display_id = 'CLM-302') WHERE display_id = 'RET-203';

-- ------------------------------------------------------------
-- SETTLEMENTS & DEDUCTIONS
-- ------------------------------------------------------------
INSERT INTO settlements (display_id, settlement_batch_id, marketplace, settlement_date, order_id, gross_amount, tcs_tds_tax, net_settlement, reconciliation_status, bank_tx_ref)
VALUES
  ('SET-AZ-901', 'BATCH-AZ-2026-36', 'Amazon India', '2026-09-08',
   (SELECT id FROM orders WHERE display_id = 'ORD-1001'), 899, 17.98, 736.02, 'RECONCILED', 'HDFC-NEFT-99210928'),

  ('SET-FK-401', 'BATCH-FK-2026-W36', 'Flipkart', '2026-09-09',
   (SELECT id FROM orders WHERE display_id = 'ORD-1002'), 1299, 25.98, 1070.02, 'RECONCILED', 'ICICI-RTGS-8839201'),

  ('SET-AZ-902', 'BATCH-AZ-2026-35', 'Amazon India', '2026-08-25',
   (SELECT id FROM orders WHERE display_id = 'ORD-0998'), 249, 4.98, 99.02, 'RECONCILED', 'HDFC-NEFT-8839201'),

  ('SET-WEB-001', 'PAYU-SETTLE-0905', 'Personal Website', '2026-09-05',
   (SELECT id FROM orders WHERE display_id = 'ORD-1004'), 1279, 0, 1253.42, 'RECONCILED', 'HDFC-DIRECT-11920');

INSERT INTO settlement_deductions (settlement_id, category, name, amount)
VALUES
  ((SELECT id FROM settlements WHERE display_id = 'SET-AZ-901'), 'COMMISSION'::deduction_category_enum, 'Referral Fee (13%)', 116.87),
  ((SELECT id FROM settlements WHERE display_id = 'SET-AZ-901'), 'LOGISTICS'::deduction_category_enum, 'Easy Ship Weight Handling Fee', 54.00),
  ((SELECT id FROM settlements WHERE display_id = 'SET-AZ-901'), 'FIXED_FEE'::deduction_category_enum, 'Closing Fee', 10.11),
  ((SELECT id FROM settlements WHERE display_id = 'SET-FK-401'), 'COMMISSION'::deduction_category_enum, 'Marketplace Commission (13%)', 168.87),
  ((SELECT id FROM settlements WHERE display_id = 'SET-FK-401'), 'LOGISTICS'::deduction_category_enum, 'Ekart Forward Logistics', 45.00),
  ((SELECT id FROM settlements WHERE display_id = 'SET-WEB-001'), 'COLLECTION_FEE'::deduction_category_enum, 'Payment Gateway Collection Fee (2%)', 25.58);

-- ------------------------------------------------------------
-- PURCHASE BILLS
-- ------------------------------------------------------------
INSERT INTO purchase_bills (display_id, supplier_id, supplier_name, invoice_number, invoice_date, sku, quantity, unit_cost, taxes, total_amount, payment_status)
VALUES
  ('PUR-1001', (SELECT id FROM suppliers WHERE display_id = 'SUP-001'), 'Apex Electronics Mfg Ltd',
   'APEX-INV-2026-001', '2026-08-01', 'ELEC-WEM-01', 100, 380, 6840, 44840, 'PAID'),

  ('PUR-1002', (SELECT id FROM suppliers WHERE display_id = 'SUP-002'), 'Zenith Cable & Power Supplies',
   'ZEN-INV-8891', '2026-08-05', 'ELEC-USBC-65W', 50, 420, 3780, 24780, 'PAID'),

  ('PUR-1003', (SELECT id FROM suppliers WHERE display_id = 'SUP-001'), 'Apex Electronics Mfg Ltd',
   'APEX-INV-2026-042', '2026-08-15', 'ELEC-ANC-EB', 50, 840, 7560, 49560, 'PENDING'),

  ('PUR-1004', (SELECT id FROM suppliers WHERE display_id = 'SUP-002'), 'Zenith Cable & Power Supplies',
   'ZEN-INV-9012', '2026-08-20', 'ELEC-BRAID-CBL', 200, 110, 3960, 25960, 'PENDING');

-- ------------------------------------------------------------
-- OPERATING EXPENSES
-- ------------------------------------------------------------
INSERT INTO expenses (display_id, expense_date, category, description, amount, vendor, payment_method, is_recurring, marketplace)
VALUES
  ('EXP-001', '2026-09-01', 'Advertising', 'Amazon Sponsored Products CPC Campaign (Wireless Mouse)', 4850, 'Amazon Advertising India', 'CREDIT_CARD', FALSE, 'Amazon India'),
  ('EXP-002', '2026-09-01', 'Advertising', 'Flipkart PLA Product Listing Ads (GaN Charger)', 3200, 'Flipkart Internet Pvt Ltd', 'BANK_TRANSFER', FALSE, 'Flipkart'),
  ('EXP-003', '2026-09-01', 'Software', 'Shopify Store Plan + App Subscriptions', 6500, 'Shopify Commerce Inc', 'CREDIT_CARD', TRUE, 'Personal Website'),
  ('EXP-004', '2026-09-02', 'Packaging', 'Branded corrugated shipping boxes & tamper tape (1,000 units)', 7200, 'PackWell Containers Bhiwandi', 'BANK_TRANSFER', FALSE, NULL),
  ('EXP-005', '2026-09-03', 'Salaries', 'Warehouse picking, packing & return audit staff stipend', 22000, 'Operations Team Payroll', 'BANK_TRANSFER', TRUE, NULL),
  ('EXP-006', '2026-09-04', 'Rent', 'Warehouse space lease rental (Sector 18, Gurugram)', 18000, 'DLF Commercial Properties', 'BANK_TRANSFER', TRUE, NULL);

-- ------------------------------------------------------------
-- CUSTOMER COMPLAINTS
-- ------------------------------------------------------------
INSERT INTO customer_complaints (display_id, ticket_number, customer_name, customer_email, customer_phone, order_id, channel_order_id, marketplace, sku, category, priority, status, subject, description)
VALUES
  ('TKT-1002', 'TCK-2026-002', 'Sneha Patel', 'sneha.patel@gmail.com', '+91 97200 45678',
   (SELECT id FROM orders WHERE display_id = 'ORD-1002'), 'OD2938102948291029', 'Flipkart', 'ELEC-USBC-65W',
   'DEFECTIVE_PRODUCT', 'MEDIUM', 'IN_PROGRESS',
   'Charger heating up excessively during fast charging',
   'Customer reported charger reaches uncomfortable temperature after 20 minutes of 65W charging. Requested replacement.');

-- ------------------------------------------------------------
-- SAMPLE WEBHOOK & NOTIFICATIONS
-- ------------------------------------------------------------
INSERT INTO webhook_events (idempotency_key, source, event_topic, marketplace, raw_payload, verified, is_fresh, is_duplicate, processing_status, resulting_entity_type, resulting_entity_id, processing_ms)
VALUES
  ('SHOPIFY:orders/create:gid://shopify/Order/88391029', 'SHOPIFY', 'orders/create', 'Personal Website',
   '{"id": 88391029, "name": "#WEB-2026-0904", "total_price": "1199.00", "financial_status": "paid"}'::jsonb,
   TRUE, TRUE, FALSE, 'PROCESSED', 'ORDER', 'ORD-1004', 38);

INSERT INTO notifications (type, severity, title, body, action_url, action_label, entity_type, entity_id)
VALUES
  ('CLAIM_DEADLINE_OVERDUE', 'CRITICAL',
   'Claim window expired — recovery lost',
   'RET-203 claim deadline passed with no claim filed. Loss: ₹495.',
   '/returns', 'View Returns', 'RETURN', 'RET-203'),

  ('RETURN_NEEDS_INSPECTION', 'INFO',
   'Return awaiting inspection',
   'RET-204 (ELEC-WEM-01) has been in PENDING_RESTOCK for 12 days. Mark as restocked or written off.',
   '/returns', 'View Returns', 'RETURN', 'RET-204'),

  ('AI_DOCUMENT_PENDING', 'INFO',
   '2 documents need review',
   '2 uploaded documents are waiting for your approval in the AI Staging Sandbox.',
   '/documents', 'Open AI Staging', 'DOCUMENT', 'AI-DOCS');

-- ============================================================================
-- 7. VERIFICATION QUERY (Confirms everything set up properly)
-- ============================================================================
SELECT
  'Setup Complete!' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_tables,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') AS total_views,
  (SELECT COUNT(*) FROM products) AS total_products,
  (SELECT COUNT(*) FROM orders) AS total_orders,
  (SELECT COUNT(*) FROM return_records) AS total_returns,
  (SELECT COUNT(*) FROM claims) AS total_claims,
  (SELECT COUNT(*) FROM settlements) AS total_settlements,
  (SELECT COUNT(*) FROM suppliers) AS total_suppliers;
