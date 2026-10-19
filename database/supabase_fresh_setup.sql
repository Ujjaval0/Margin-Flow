-- MarginFlow fresh Supabase setup. For a brand-new, empty Supabase project only.
-- Do not run on a database with existing MarginFlow tables or production data.
-- No demo seed data is included. Review the whole file before running in Supabase SQL Editor.

-- ===== 01_enums.sql =====
-- ============================================================
-- MarginFlow — Step 01: PostgreSQL Enum Types
-- Run this FIRST before any other SQL file.
-- ============================================================

-- Marketplace channels
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

-- Order lifecycle states
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

-- Return classification
CREATE TYPE return_type_enum AS ENUM (
  'CUSTOMER_RETURN',
  'RTO',
  'DAMAGED_RETURN',
  'LOST_RETURN',
  'OTHER'
);

-- Physical condition of a returned product
CREATE TYPE product_condition_enum AS ENUM (
  'SELLABLE',
  'DAMAGED',
  'USED',
  'MISSING',
  'UNUSABLE',
  'UNDER_INSPECTION'
);

-- Return inventory disposition
CREATE TYPE restock_status_enum AS ENUM (
  'PENDING_RESTOCK',
  'RESTOCKED',
  'WRITTEN_OFF'
);

-- Claim lifecycle states
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

-- Claim classification types
CREATE TYPE claim_type_enum AS ENUM (
  'LOST_IN_TRANSIT',
  'DAMAGED_INVOICE',
  'WRONG_RETURN_ITEM',
  'FEE_DISPUTE'
);

-- Settlement deduction line-item categories
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

-- Settlement reconciliation status
CREATE TYPE reconciliation_status_enum AS ENUM (
  'RECONCILED',
  'MISMATCH_FLAGGED',
  'PENDING_RECON'
);

-- Purchase bill payment status
CREATE TYPE payment_status_enum AS ENUM (
  'PAID',
  'PENDING',
  'PARTIAL'
);

-- Payment method for expenses and supplier payments
CREATE TYPE payment_method_enum AS ENUM (
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'CASH'
);

-- Expense category
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

-- AI document type
CREATE TYPE ai_document_type_enum AS ENUM (
  'INVOICE',
  'SHIPPING_LABEL',
  'SETTLEMENT_REPORT',
  'SUPPLIER_BILL',
  'CLAIM_DOC'
);

-- AI document staging status
CREATE TYPE ai_document_status_enum AS ENUM (
  'STAGED_NEEDS_REVIEW',
  'APPROVED_POSTED',
  'REJECTED'
);

-- Who created/modified an extracted AI field value
CREATE TYPE provenance_enum AS ENUM (
  'AI_EXTRACTED',
  'MANUALLY_ENTERED',
  'MANUALLY_MODIFIED'
);

-- Audit log entity types
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

-- Customer complaint categories
CREATE TYPE complaint_category_enum AS ENUM (
  'WRONG_ITEM_RECEIVED',
  'DAMAGED_PRODUCT',
  'DELIVERY_DELAY',
  'DEFECTIVE_PRODUCT',
  'MISSING_QUANTITY',
  'SETTLEMENT_OR_REFUND_ISSUE',
  'OTHER'
);

-- Complaint priority
CREATE TYPE complaint_priority_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- Complaint lifecycle status
CREATE TYPE complaint_status_enum AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

-- User account / role type
CREATE TYPE account_type_enum AS ENUM (
  'BRAND_OWNER',
  'SUPPLIER',
  'WHOLESALER'
);

-- Background job types
CREATE TYPE job_type_enum AS ENUM (
  'BULK_CSV_IMPORT',
  'RECONCILE_SETTLEMENTS',
  'GENERATE_FINANCIAL_REPORT',
  'PROCESS_BATCH_IDP'
);

-- Background job status
CREATE TYPE job_status_enum AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

-- ===== 02_tables.sql =====
-- ============================================================
-- MarginFlow — Step 02: Core Tables
-- Run AFTER 01_enums.sql
-- Tables are created in strict FK dependency order.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USER ACCOUNTS
-- ------------------------------------------------------------
-- Each MarginFlow account is linked to its corresponding Supabase Auth user.
CREATE TABLE user_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  account_type    account_type_enum NOT NULL DEFAULT 'BRAND_OWNER',
  company_name    TEXT NOT NULL DEFAULT 'My Company',
  gstin           TEXT,
  phone           TEXT,
  password_hash   TEXT,                   -- Populated for email/password authentication
  supplier_id     UUID,                   -- Populated only for SUPPLIER role (FK added later)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. SUPPLIERS
-- ------------------------------------------------------------
CREATE TABLE suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id      TEXT UNIQUE NOT NULL,   -- e.g. "SUP-001"
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
  total_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- Running aggregate; updated via trigger
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ             -- Soft delete
);

-- Back-fill the FK from user_accounts -> suppliers
ALTER TABLE user_accounts
  ADD CONSTRAINT fk_user_supplier
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. SUPPLIER PAYMENTS
-- Normalized payment ledger — replaces the single totalPaid scalar.
-- ------------------------------------------------------------
CREATE TABLE supplier_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL,          -- Free text for flexibility
  reference_code  TEXT,                   -- UTR, cheque no., transaction ref
  notes           TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES user_accounts(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 4. PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT UNIQUE NOT NULL,       -- e.g. "PROD-01"
  sku                 TEXT UNIQUE NOT NULL,        -- Master SKU (primary lookup key)
  mfn                 TEXT,                        -- Primary MFN identifier
  mfn1                TEXT,                        -- Secondary MFN identifier
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
-- Immutable time-series of cost price windows.
-- Only ONE row per product should have valid_to = NULL (the active cost).
-- ------------------------------------------------------------
CREATE TABLE product_cost_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,              -- Denormalized for fast lookups
  valid_from          DATE NOT NULL,
  valid_to            DATE,                        -- NULL = currently active window
  cost_price          NUMERIC(14,2) NOT NULL CHECK (cost_price >= 0),
  source_purchase_id  UUID,                        -- FK to purchase_bills (set after insert)
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_cost_window_start UNIQUE (product_id, valid_from)
);

-- Enforce: only one active (valid_to IS NULL) cost window per product
CREATE UNIQUE INDEX idx_one_active_cost_per_product
  ON product_cost_history (product_id)
  WHERE valid_to IS NULL;

-- ------------------------------------------------------------
-- 6. PRODUCT CHANNEL ALIASES
-- Maps marketplace-specific SKU/ASIN/listing IDs to master SKU.
-- Replaces the channelAliases JSON object in the TypeScript model.
-- ------------------------------------------------------------
CREATE TABLE product_channel_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace marketplace_enum NOT NULL,
  alias_sku   TEXT NOT NULL,             -- Marketplace's own SKU/ASIN
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_alias_per_marketplace UNIQUE (product_id, marketplace)
);

-- ------------------------------------------------------------
-- 7. ORDERS
-- ------------------------------------------------------------
CREATE TABLE orders (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                    TEXT UNIQUE NOT NULL,        -- e.g. "ORD-1001"
  channel_order_id              TEXT NOT NULL,               -- Platform order ID (Amazon, Flipkart, etc.)
  marketplace                   marketplace_enum NOT NULL,
  order_date                    DATE NOT NULL,
  status                        order_status_enum NOT NULL DEFAULT 'PENDING',
  customer_name                 TEXT NOT NULL,
  customer_city                 TEXT NOT NULL,
  customer_state                TEXT NOT NULL,
  shipping_fee_charged          NUMERIC(14,2) NOT NULL DEFAULT 0,
  marketplace_charges_estimate  NUMERIC(14,2) NOT NULL DEFAULT 0,
  settlement_amount             NUMERIC(14,2),               -- Optional: direct settlement override
  settlement_percent            NUMERIC(5,2),                -- Optional: percentage-based settlement
  commission_percent            NUMERIC(5,2),
  supplier_name                 TEXT,                        -- Denormalized snapshot
  supplier_id                   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                    TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 8. ORDER ITEMS
-- CRITICAL: snapshot_unit_cost is IMMUTABLE after creation.
-- A trigger below enforces this invariant.
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT NOT NULL,                    -- e.g. "ITEM-101"
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,
  mfn                 TEXT,
  mfn1                TEXT,
  product_name        TEXT NOT NULL,                    -- Snapshot of name at time of order
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  selling_price       NUMERIC(14,2) NOT NULL CHECK (selling_price >= 0),
  discount            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  snapshot_unit_cost  NUMERIC(14,2) NOT NULL CHECK (snapshot_unit_cost >= 0),  -- LOCKED. Never update.
  returned_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT returned_lte_ordered CHECK (returned_quantity <= quantity)
);

-- ------------------------------------------------------------
-- 9. RETURN RECORDS
-- ------------------------------------------------------------
CREATE TABLE return_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id                TEXT UNIQUE NOT NULL,         -- e.g. "RET-201"
  order_id                  UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel_order_id          TEXT NOT NULL,
  marketplace               marketplace_enum NOT NULL,
  return_date               DATE NOT NULL,
  received_date             DATE,
  awb_number                TEXT,                          -- Courier AWB/tracking number
  return_type               return_type_enum NOT NULL,
  return_reason             TEXT NOT NULL,
  sku                       TEXT NOT NULL,
  product_name              TEXT,
  quantity                  INTEGER NOT NULL CHECK (quantity > 0),
  condition                 product_condition_enum NOT NULL,
  restock_status            restock_status_enum,
  claim_deadline            DATE,                          -- Marketplace SLA expiry
  return_shipping_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  customer_return_fee       NUMERIC(14,2) NOT NULL DEFAULT 0,  -- Always 0 for RTO
  other_return_costs        NUMERIC(14,2) NOT NULL DEFAULT 0,
  inventory_recovery_value  NUMERIC(14,2) NOT NULL DEFAULT 0,  -- Scrap / salvage value
  loss_amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  claim_id                  UUID,                          -- Linked claim (FK added after claims table)
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
  display_id        TEXT UNIQUE NOT NULL,         -- e.g. "CLM-301"
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

  CONSTRAINT recovered_lte_claimed CHECK (amount_recovered <= amount_claimed + 1)  -- Small tolerance
);

-- Back-fill claim_id FK on return_records now that claims table exists
ALTER TABLE return_records
  ADD CONSTRAINT fk_return_claim
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL;

-- Supporting documents attached to a claim
CREATE TABLE claim_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_url  TEXT NOT NULL,                   -- Supabase Storage URL or local path
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 11. SETTLEMENTS
-- ------------------------------------------------------------
CREATE TABLE settlements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id            TEXT UNIQUE NOT NULL,         -- e.g. "SET-AZ-901"
  settlement_batch_id   TEXT NOT NULL,                -- Marketplace batch/cycle reference
  marketplace           marketplace_enum NOT NULL,
  settlement_date       DATE NOT NULL,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gross_amount          NUMERIC(14,2) NOT NULL,
  tcs_tds_tax           NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_settlement        NUMERIC(14,2) NOT NULL,
  reconciliation_status reconciliation_status_enum NOT NULL DEFAULT 'PENDING_RECON',
  discrepancy_amount    NUMERIC(14,2),
  bank_tx_ref           TEXT,
  source_document       TEXT,                          -- File name or storage URL
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deduction line items within a settlement
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
  display_id      TEXT UNIQUE NOT NULL,     -- e.g. "PUR-1001"
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  supplier_name   TEXT NOT NULL,            -- Denormalized snapshot
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  sku             TEXT NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost       NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  taxes           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  payment_status  payment_status_enum NOT NULL DEFAULT 'PENDING',
  document_url    TEXT,                     -- Storage URL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Back-fill source_purchase_id FK on product_cost_history
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
  marketplace         marketplace_enum,              -- Optional channel attribution
  attributed_sku      TEXT,                           -- Optional SKU attribution
  supporting_document TEXT,                           -- Storage URL
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 14. AI STAGED DOCUMENTS
-- Documents uploaded for AI extraction, pending HITL review.
-- ------------------------------------------------------------
CREATE TABLE ai_staged_documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id              TEXT UNIQUE NOT NULL,   -- e.g. "DOC-001"
  file_name               TEXT NOT NULL,
  file_url                TEXT,                    -- Supabase Storage URL
  file_type               ai_document_type_enum NOT NULL,
  upload_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  status                  ai_document_status_enum NOT NULL DEFAULT 'STAGED_NEEDS_REVIEW',
  raw_text_preview        TEXT,                    -- First ~500 chars of OCR output

  -- Arithmetic validation result (from guardrails engine)
  arithmetic_passed       BOOLEAN,
  arithmetic_calculated   NUMERIC(14,2),
  arithmetic_declared     NUMERIC(14,2),
  arithmetic_difference   NUMERIC(14,2),
  arithmetic_message      TEXT,

  -- Catalog SKU match result
  catalog_sku_matched     BOOLEAN,
  catalog_matched_sku_id  TEXT,
  catalog_suggestion      TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 15. AI STAGED FIELDS
-- Per-field extracted data with confidence scores and bounding boxes.
-- Normalized from extractedData: { marketplace, orderId, ... }
-- ------------------------------------------------------------
CREATE TABLE ai_staged_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES ai_staged_documents(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,            -- 'marketplace' | 'orderId' | 'totalAmount' | etc.
  value_text      TEXT,                     -- All values stored as text; cast in application layer
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  provenance      provenance_enum NOT NULL DEFAULT 'AI_EXTRACTED',
  page_number     INTEGER,
  bbox_x          NUMERIC(8,2),             -- Source bounding box for UI highlighting
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
-- 16. FINANCIAL AUDIT LOGS
-- APPEND-ONLY. Every mutation in the system writes a row here.
-- No UPDATE or DELETE is permitted (enforced by trigger below).
-- ------------------------------------------------------------
CREATE TABLE financial_audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id          TEXT UNIQUE NOT NULL,   -- e.g. "AUD-1001"
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type         audit_entity_type_enum NOT NULL,
  entity_id           TEXT NOT NULL,          -- display_id of the mutated record
  field_name          TEXT NOT NULL,
  old_value           TEXT,
  new_value           TEXT,
  modified_by         TEXT NOT NULL,          -- Username or system process name
  reason              TEXT,
  source_document_id  TEXT                    -- File name if mutation came from AI pipeline
);

-- ------------------------------------------------------------
-- 17. CUSTOMER COMPLAINTS
-- ------------------------------------------------------------
CREATE TABLE customer_complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        TEXT UNIQUE NOT NULL,     -- e.g. "TKT-1002"
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
-- 18. BACKGROUND JOBS
-- Async queue for: CSV import, batch IDP, reconciliation, reports.
-- ------------------------------------------------------------
CREATE TABLE background_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        job_type_enum NOT NULL,
  payload     JSONB,                        -- Job-specific input data
  status      job_status_enum NOT NULL DEFAULT 'QUEUED',
  progress    SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  result      JSONB,                        -- Output on completion
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  idempotency_key TEXT,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts SMALLINT NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  lock_token UUID,
  priority SMALLINT NOT NULL DEFAULT 0
);

-- ===== 03_indexes.sql =====
-- ============================================================
-- MarginFlow — Step 03: Indexes & Performance
-- Run AFTER 02_tables.sql
-- ============================================================

-- ------------------------------------------------------------
-- ORDERS — most queried table (marketplace, status, date range)
-- ------------------------------------------------------------
CREATE INDEX idx_orders_marketplace   ON orders (marketplace);
CREATE INDEX idx_orders_status        ON orders (status);
CREATE INDEX idx_orders_order_date    ON orders (order_date DESC);
CREATE INDEX idx_orders_channel_id    ON orders (channel_order_id);
CREATE INDEX idx_orders_supplier_id   ON orders (supplier_id);
CREATE INDEX idx_orders_active        ON orders (deleted_at) WHERE deleted_at IS NULL;

-- Composite: the most common dashboard filter pattern
CREATE INDEX idx_orders_mp_date       ON orders (marketplace, order_date DESC);
CREATE INDEX idx_orders_status_date   ON orders (status, order_date DESC);

-- ------------------------------------------------------------
-- ORDER ITEMS — SKU-level profitability lookups
-- ------------------------------------------------------------
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_sku      ON order_items (sku);

-- ------------------------------------------------------------
-- RETURN RECORDS — frequent queries by order, SKU, marketplace
-- ------------------------------------------------------------
CREATE INDEX idx_returns_order_id     ON return_records (order_id);
CREATE INDEX idx_returns_sku          ON return_records (sku);
CREATE INDEX idx_returns_marketplace  ON return_records (marketplace);
CREATE INDEX idx_returns_return_date  ON return_records (return_date DESC);
CREATE INDEX idx_returns_return_type  ON return_records (return_type);
CREATE INDEX idx_returns_condition    ON return_records (condition);
CREATE INDEX idx_returns_active       ON return_records (deleted_at) WHERE deleted_at IS NULL;

-- Claim deadline alerting (near-expiry returns)
CREATE INDEX idx_returns_claim_deadline ON return_records (claim_deadline ASC)
  WHERE claim_deadline IS NOT NULL AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- SETTLEMENTS — lookup by order, date
-- ------------------------------------------------------------
CREATE INDEX idx_settlements_order_id   ON settlements (order_id);
CREATE INDEX idx_settlements_date       ON settlements (settlement_date DESC);
CREATE INDEX idx_settlements_marketplace ON settlements (marketplace);
CREATE INDEX idx_settlements_recon_status ON settlements (reconciliation_status);

-- ------------------------------------------------------------
-- SETTLEMENT DEDUCTIONS — lookup by settlement
-- ------------------------------------------------------------
CREATE INDEX idx_deductions_settlement_id ON settlement_deductions (settlement_id);
CREATE INDEX idx_deductions_category      ON settlement_deductions (category);

-- ------------------------------------------------------------
-- CLAIMS — by order, status (most common claim queries)
-- ------------------------------------------------------------
CREATE INDEX idx_claims_order_id  ON claims (order_id);
CREATE INDEX idx_claims_return_id ON claims (return_id);
CREATE INDEX idx_claims_status    ON claims (status);
CREATE INDEX idx_claims_active    ON claims (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- PRODUCTS — by SKU, supplier, active status
-- ------------------------------------------------------------
CREATE INDEX idx_products_sku        ON products (sku);
CREATE INDEX idx_products_supplier   ON products (supplier_id);
CREATE INDEX idx_products_active     ON products (active, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category   ON products (category);

-- ------------------------------------------------------------
-- PRODUCT COST HISTORY — active cost lookup per product
-- ------------------------------------------------------------
CREATE INDEX idx_cost_history_product_date
  ON product_cost_history (product_id, valid_from DESC);

-- ------------------------------------------------------------
-- PRODUCT CHANNEL ALIASES — reverse lookup by marketplace alias
-- ------------------------------------------------------------
CREATE INDEX idx_channel_aliases_marketplace ON product_channel_aliases (marketplace);
CREATE INDEX idx_channel_aliases_alias_sku   ON product_channel_aliases (alias_sku);

-- ------------------------------------------------------------
-- PURCHASE BILLS — by supplier, payment status
-- ------------------------------------------------------------
CREATE INDEX idx_purchases_supplier      ON purchase_bills (supplier_id);
CREATE INDEX idx_purchases_payment_status ON purchase_bills (payment_status);
CREATE INDEX idx_purchases_sku           ON purchase_bills (sku);
CREATE INDEX idx_purchases_invoice_date  ON purchase_bills (invoice_date DESC);

-- ------------------------------------------------------------
-- EXPENSES — filter by date, category, marketplace, SKU
-- ------------------------------------------------------------
CREATE INDEX idx_expenses_date        ON expenses (expense_date DESC);
CREATE INDEX idx_expenses_category    ON expenses (category);
CREATE INDEX idx_expenses_marketplace ON expenses (marketplace);
CREATE INDEX idx_expenses_sku         ON expenses (attributed_sku);
CREATE INDEX idx_expenses_active      ON expenses (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- AI STAGED DOCUMENTS — filter by status
-- ------------------------------------------------------------
CREATE INDEX idx_staged_docs_status   ON ai_staged_documents (status);
CREATE INDEX idx_staged_docs_type     ON ai_staged_documents (file_type);
CREATE INDEX idx_staged_docs_date     ON ai_staged_documents (upload_date DESC);

-- ------------------------------------------------------------
-- AI STAGED FIELDS — lookup fields by document
-- ------------------------------------------------------------
CREATE INDEX idx_staged_fields_doc_id   ON ai_staged_fields (document_id);
CREATE INDEX idx_staged_fields_flagged  ON ai_staged_fields (document_id)
  WHERE is_flagged = TRUE;

-- ------------------------------------------------------------
-- FINANCIAL AUDIT LOGS — immutable append-only event log
-- ------------------------------------------------------------
CREATE INDEX idx_audit_entity     ON financial_audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_timestamp  ON financial_audit_logs (timestamp DESC);

-- ------------------------------------------------------------
-- CUSTOMER COMPLAINTS — filter by status, marketplace, order
-- ------------------------------------------------------------
CREATE INDEX idx_complaints_order_id  ON customer_complaints (order_id);
CREATE INDEX idx_complaints_status    ON customer_complaints (status);
CREATE INDEX idx_complaints_priority  ON customer_complaints (priority);
CREATE INDEX idx_complaints_marketplace ON customer_complaints (marketplace);

-- ------------------------------------------------------------
-- BACKGROUND JOBS — filter by status for job runner
-- ------------------------------------------------------------
CREATE INDEX idx_jobs_status      ON background_jobs (status);
CREATE INDEX idx_jobs_type_status ON background_jobs (type, status);
CREATE INDEX idx_jobs_created_at  ON background_jobs (created_at ASC)
  WHERE status = 'QUEUED';
CREATE UNIQUE INDEX idx_jobs_owner_idempotency
  ON background_jobs (created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_jobs_available
  ON background_jobs (priority DESC, available_at ASC, created_at ASC)
  WHERE status = 'QUEUED';
CREATE INDEX idx_jobs_expired_lease
  ON background_jobs (locked_at ASC)
  WHERE status = 'PROCESSING';

-- ------------------------------------------------------------
-- SUPPLIER PAYMENTS — lookup payments per supplier
-- ------------------------------------------------------------
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX idx_supplier_payments_date     ON supplier_payments (paid_at DESC);

-- ===== 04_triggers.sql =====
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

-- ===== 05_views.sql =====
-- ============================================================
-- MarginFlow — Step 05: Computed Views
-- These replace all calculations currently done in:
--   - profitability-engine.ts
--   - ledger-engine.ts
-- Run AFTER 04_triggers.sql
-- ============================================================

-- ------------------------------------------------------------
-- VIEW: v_order_profitability
-- Order-level P&L per the 20-point profitability specification.
-- Mirrors calculateOrderProfitability() in profitability-engine.ts
-- ------------------------------------------------------------
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
  -- Contribution profit per the engine specification
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

-- ------------------------------------------------------------
-- VIEW: v_sku_profitability
-- SKU-level aggregation. Mirrors calculateSkuProfitability()
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- VIEW: v_marketplace_profitability
-- Per-marketplace breakdown. Mirrors calculateMarketplaceProfitability()
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- VIEW: v_settlement_aging
-- Mirrors calculateSettlementAging() in profitability-engine.ts
-- Buckets: 0-7 days, 8-14 days, 15+ days overdue (no settlement)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- VIEW: v_inventory_metrics
-- Mirrors the inventoryMetrics useMemo in store.tsx
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- VIEW: v_claims_summary
-- Mirrors the claimsSummary useMemo in store.tsx
-- ------------------------------------------------------------
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

-- ===== 08_webhooks_notifications_softdelete.sql =====
-- ============================================================
-- MarginFlow — Step 08: Webhook Events, Notifications, Recycle Bin
-- Run AFTER 07_rls_supabase.sql (or after 06_seed.sql for local).
-- Adds: webhook_events table, notifications table, recycle bin view.
-- ============================================================

-- ============================================================
-- NEW ENUM TYPES
-- ============================================================

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

-- ============================================================
-- WEBHOOK EVENTS TABLE
-- Every incoming webhook from Shopify / WooCommerce / any channel
-- is logged here immediately — before any processing begins.
-- ============================================================
CREATE TABLE webhook_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique fingerprint: prevents duplicate processing.
  -- Format: "source:topic:platform_event_id"
  -- e.g. "SHOPIFY:orders/create:gid://shopify/Order/123456789"
  idempotency_key       TEXT UNIQUE NOT NULL,

  source                webhook_source_enum NOT NULL,
  event_topic           TEXT NOT NULL,                -- e.g. 'orders/create', 'refunds/create'
  marketplace           marketplace_enum,

  -- Complete raw webhook body stored as JSONB.
  -- Essential for debugging failures and replaying events.
  raw_payload           JSONB NOT NULL,

  -- Security verification results
  signature_header      TEXT,                         -- The HMAC header that arrived with the webhook
  verified              BOOLEAN,                      -- Did HMAC-SHA256 check pass?
  is_fresh              BOOLEAN,                      -- Was timestamp within the 5-minute replay window?
  is_duplicate          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Processing outcome
  processing_status     webhook_status_enum NOT NULL DEFAULT 'PENDING',
  resulting_entity_type TEXT,                         -- 'ORDER', 'RETURN', 'SETTLEMENT', 'NONE'
  resulting_entity_id   TEXT,                         -- e.g. 'ORD-1001' (if a record was created)
  error_message         TEXT,                         -- Error detail if processing_status = 'FAILED'

  -- Timing
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  processing_ms         INTEGER                       -- Processing duration in milliseconds
);

-- Unique index for duplicate detection (checked before any processing)
CREATE UNIQUE INDEX idx_webhook_idempotency
  ON webhook_events (idempotency_key);

-- Index for retry/monitoring dashboard (only active problem rows indexed)
CREATE INDEX idx_webhook_failed_pending
  ON webhook_events (processing_status, received_at DESC)
  WHERE processing_status IN ('PENDING', 'FAILED');

-- Index for chronological browsing per source
CREATE INDEX idx_webhook_source_date
  ON webhook_events (source, received_at DESC);


-- ============================================================
-- NOTIFICATIONS TABLE
-- System-generated alerts based on live data analysis.
-- One row per unique condition (deduplicated by type + entity_id).
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            notification_type_enum NOT NULL,
  severity        notification_severity_enum NOT NULL DEFAULT 'INFO',
  title           TEXT NOT NULL,                     -- Short headline for the panel
  body            TEXT NOT NULL,                     -- Full explanation with specific amounts/dates
  action_url      TEXT,                              -- Page to navigate to on click
  action_label    TEXT,                              -- Button text e.g. "Go to Claims"

  -- Which record this is about (for deep-linking and deduplication)
  entity_type     TEXT,                              -- 'RETURN', 'ORDER', 'SETTLEMENT', 'PRODUCT', etc.
  entity_id       TEXT,                              -- e.g. 'RET-203', 'ORD-1001', 'ELEC-ANC-EB'

  -- User interaction state
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timing
  auto_expires_at TIMESTAMPTZ,                       -- NULL = never auto-expires
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ,

  -- Deduplication: only one active notification per type+entity combination.
  -- When the same condition triggers again, UPDATE the existing row instead of INSERTing.
  CONSTRAINT uq_notification_per_entity UNIQUE (type, entity_id)
);

-- Primary index: fast unread badge count query
CREATE INDEX idx_notifications_unread
  ON notifications (is_read, is_dismissed)
  WHERE is_read = FALSE AND is_dismissed = FALSE;

-- Deduplication check index
CREATE INDEX idx_notifications_type_entity
  ON notifications (type, entity_id)
  WHERE is_dismissed = FALSE;

-- Sorted panel display
CREATE INDEX idx_notifications_created
  ON notifications (created_at DESC)
  WHERE is_dismissed = FALSE;


-- ============================================================
-- EXTEND job_type_enum WITH NEW JOB TYPES
-- ============================================================
-- NOTE: PostgreSQL requires ALTER TYPE ADD VALUE outside a transaction.
-- Run these individually if psql gives a transaction error.

ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'PURGE_SOFT_DELETED_RECORDS';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'GENERATE_NOTIFICATIONS';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'PURGE_OLD_WEBHOOK_EVENTS';


-- ============================================================
-- VIEWS
-- ============================================================

-- Unread notification count (used by navbar badge)
CREATE OR REPLACE VIEW v_unread_notification_count AS
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE is_read = FALSE
  AND is_dismissed = FALSE
  AND (auto_expires_at IS NULL OR auto_expires_at > NOW());


-- Recycle bin: all soft-deleted records across all tables
-- Shows type, id, when deleted, when it will be purged, and days remaining.
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


-- ============================================================
-- TRIGGER: Auto-mark notifications as expired
-- Sets auto_expires_at for time-sensitive notification types
-- This is applied in the application layer, but here is the
-- cleanup query to run periodically:
--
-- DELETE FROM notifications
--   WHERE auto_expires_at IS NOT NULL AND auto_expires_at < NOW();
-- ============================================================


-- ============================================================
-- SOFT DELETE PURGE: Reference query (run as background job)
-- Permanently deletes records that have been in recycle bin >30 days.
--
-- DELETE FROM orders         WHERE deleted_at < NOW() - INTERVAL '30 days';
-- DELETE FROM return_records WHERE deleted_at < NOW() - INTERVAL '30 days';
-- DELETE FROM claims         WHERE deleted_at < NOW() - INTERVAL '30 days';
-- DELETE FROM expenses       WHERE deleted_at < NOW() - INTERVAL '30 days';
-- DELETE FROM products       WHERE deleted_at < NOW() - INTERVAL '30 days';
--
-- WEBHOOK EVENTS PURGE: (run as background job)
-- DELETE FROM webhook_events
--   WHERE processing_status = 'PROCESSED' AND received_at < NOW() - INTERVAL '90 days';
-- ============================================================

-- ===== 09_marketplace_connections.sql =====
-- ============================================================
-- MarginFlow — Step 09: Marketplace Connections & Vaulted Credentials
-- Architecture Standard #2: Zero Client-Side Master Secrets
-- Stores multi-tenant marketplace credentials encrypted with AES-256-GCM.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_connections (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               TEXT NOT NULL,
  marketplace           TEXT NOT NULL,
  seller_id             TEXT DEFAULT '',
  marketplace_id        TEXT,
  encrypted_credentials TEXT NOT NULL,
  auth_type             TEXT NOT NULL DEFAULT 'API_KEY', -- 'OAUTH2', 'API_KEY', 'LWA_REFRESH_TOKEN', 'SELF_ACCESS'
  token_expires_at      TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_status      TEXT DEFAULT 'IDLE', -- 'IDLE', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'
  last_sync_cursor      TEXT,
  last_synced_at        TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_marketplace_connection UNIQUE (user_id, marketplace, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_user 
  ON marketplace_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_connections_active 
  ON marketplace_connections(user_id, is_active);

-- ============================================================
-- MARKETPLACE SYNC LOGS TABLE
-- Tracks immutable audit history of every sync run.
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_sync_logs (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connection_id         TEXT REFERENCES marketplace_connections(id) ON DELETE SET NULL,
  user_id               TEXT NOT NULL,
  marketplace           TEXT NOT NULL,
  sync_type             TEXT NOT NULL DEFAULT 'DELTA', -- 'INITIAL', 'DELTA', 'MANUAL', 'SCHEDULED'
  status                TEXT NOT NULL, -- 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'
  fetched_count         INTEGER NOT NULL DEFAULT 0,
  imported_count        INTEGER NOT NULL DEFAULT 0,
  updated_count         INTEGER NOT NULL DEFAULT 0,
  skipped_count         INTEGER NOT NULL DEFAULT 0,
  error_message         TEXT,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user 
  ON marketplace_sync_logs(user_id, marketplace, started_at DESC);

-- ===== 10_orders_idempotency.sql =====
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

-- ===== 11_oauth_states.sql =====
-- ============================================================
-- MarginFlow — Step 11: OAuth 2.0 State Security Table
-- Architecture Standard #2 & #4: CSRF Protection & Multi-Tenant Isolation
-- Stores transient, single-use state nonces with 10-minute expiry for marketplace OAuth flows.
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_user 
  ON oauth_states(user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry 
  ON oauth_states(expires_at);

-- ===== 12_file_import_audit.sql =====
-- ============================================================
-- MarginFlow — Step 12: File Import Audit Metadata Table
-- Architecture Standard #3: Full File Audit Retention
-- Persists original filename, file hash (SHA-256), upload timestamp, and seller account ID.
-- ============================================================

CREATE TABLE IF NOT EXISTS file_import_logs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL,
  marketplace         TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  file_hash           TEXT NOT NULL,
  file_size           BIGINT NOT NULL DEFAULT 0,
  seller_id           TEXT DEFAULT '',
  sheet_format        TEXT NOT NULL,
  rows_processed      INTEGER NOT NULL DEFAULT 0,
  orders_created      INTEGER NOT NULL DEFAULT 0,
  settlements_created INTEGER NOT NULL DEFAULT 0,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_user 
  ON file_import_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_hash 
  ON file_import_logs(file_hash);

CREATE INDEX IF NOT EXISTS idx_file_import_logs_marketplace 
  ON file_import_logs(user_id, marketplace, uploaded_at DESC);

-- ===== 13_multitenant_isolation.sql =====
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

-- ===== 14_webhook_receipts.sql =====
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

-- ===== 15_tenant_document_and_identity.sql =====
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

-- ===== 16_connector_sync_and_oauth.sql =====
-- Apply explicitly after migration 15. Unbound legacy OAuth states cannot be consumed.
BEGIN;
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS redirect_uri TEXT;
ALTER TABLE marketplace_connections ADD COLUMN IF NOT EXISTS sync_checkpoints JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;

-- ===== 17_recycle_bin.sql =====
-- Explicit deployment only. Existing unowned expenses are not assigned to a merchant.
BEGIN;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE return_records ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_user_display ON expenses(user_id, display_id);
CREATE TABLE IF NOT EXISTS ledger_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('orders','returns','claims','expenses','products')),
  record_ids TEXT[] NOT NULL,
  patch JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ledger_archives_owner ON ledger_archives(user_id, deleted_at DESC);
ALTER TABLE ledger_archives ENABLE ROW LEVEL SECURITY;
-- Application routes use the server database role; direct client roles have no policies/grants.
REVOKE ALL ON ledger_archives FROM PUBLIC;
COMMIT;

-- ===== 18_auth_sessions.sql =====
-- Explicit migration after 17. Old stateless tokens require a fresh sign-in.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_owner ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_sessions FROM PUBLIC;
COMMIT;

-- ===== 19_durable_jobs.sql =====
-- Durable job queue lifecycle metadata. Apply after migration 18.
-- Job records are tenant-owned and removed when their account is deleted.
BEGIN;

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_token UUID,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE background_jobs DROP CONSTRAINT IF EXISTS background_jobs_created_by_fkey;
ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_accounts(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_jobs_attempts_check') THEN
    ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_attempts_check CHECK (attempts >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'background_jobs_max_attempts_check') THEN
    ALTER TABLE background_jobs ADD CONSTRAINT background_jobs_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 10);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_owner_idempotency
  ON background_jobs (created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_available
  ON background_jobs (priority DESC, available_at ASC, created_at ASC)
  WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_jobs_expired_lease
  ON background_jobs (locked_at ASC)
  WHERE status = 'PROCESSING';

COMMIT;

-- ===== 07_rls_supabase.sql =====
-- ============================================================
-- MarginFlow — Step 07: Supabase RLS and direct-client access
-- Run AFTER migrations through 19 — FOR SUPABASE ONLY.
-- Skip this file for local PostgreSQL testing.
-- ============================================================

BEGIN;

-- These views are used by the server application, not directly by browser clients.
-- Make any future grants respect caller permissions and keep direct API access closed.
ALTER VIEW v_order_profitability SET (security_invoker = true);
ALTER VIEW v_sku_profitability SET (security_invoker = true);
ALTER VIEW v_marketplace_profitability SET (security_invoker = true);
ALTER VIEW v_settlement_aging SET (security_invoker = true);
ALTER VIEW v_inventory_metrics SET (security_invoker = true);
ALTER VIEW v_claims_summary SET (security_invoker = true);
ALTER VIEW v_unread_notification_count SET (security_invoker = true);
ALTER VIEW v_recycle_bin SET (security_invoker = true);

-- MarginFlow uses its own server-verified session cookie. It does not establish
-- auth.uid(), so Supabase client roles get no direct table access. The server
-- database role performs owner-scoped queries. RLS without policies fails closed
-- if a future grant is accidentally added.

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_channel_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_staged_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_staged_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- Remove any older broad or identity-mismatched policies. Direct access remains
-- denied until a Supabase JWT-to-account mapping and every child policy are tested.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'user_accounts','suppliers','supplier_payments','products','product_cost_history',
        'product_channel_aliases','orders','order_items','return_records','settlements',
        'settlement_deductions','claims','claim_documents','purchase_bills','expenses',
        'ai_staged_documents','ai_staged_fields','financial_audit_logs','customer_complaints',
        'background_jobs','marketplace_connections','marketplace_sync_logs','oauth_states',
        'file_import_logs','webhook_receipts','ledger_archives','auth_sessions'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

REVOKE ALL ON user_accounts, suppliers, supplier_payments, products, product_cost_history,
  product_channel_aliases, orders, order_items, return_records, settlements,
  settlement_deductions, claims, claim_documents, purchase_bills, expenses,
  ai_staged_documents, ai_staged_fields, financial_audit_logs, customer_complaints,
  background_jobs, marketplace_connections, marketplace_sync_logs, oauth_states,
  file_import_logs, webhook_receipts, ledger_archives, auth_sessions FROM anon, authenticated;
REVOKE ALL ON user_accounts, suppliers, supplier_payments, products, product_cost_history,
  product_channel_aliases, orders, order_items, return_records, settlements,
  settlement_deductions, claims, claim_documents, purchase_bills, expenses,
  ai_staged_documents, ai_staged_fields, financial_audit_logs, customer_complaints,
  background_jobs, marketplace_connections, marketplace_sync_logs, oauth_states,
  file_import_logs, webhook_receipts, ledger_archives, auth_sessions FROM PUBLIC;
REVOKE ALL ON v_order_profitability, v_sku_profitability, v_marketplace_profitability,
  v_settlement_aging, v_inventory_metrics, v_claims_summary,
  v_unread_notification_count, v_recycle_bin FROM anon, authenticated, PUBLIC;

COMMIT;

-- Persistent profile avatars (Supabase Storage; owner-only writes).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile avatar owner insert" ON storage.objects;
CREATE POLICY "profile avatar owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-avatars' AND name = auth.uid()::text || '/avatar');

DROP POLICY IF EXISTS "profile avatar owner update" ON storage.objects;
CREATE POLICY "profile avatar owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-avatars' AND name = auth.uid()::text || '/avatar')
WITH CHECK (bucket_id = 'profile-avatars' AND name = auth.uid()::text || '/avatar');

DROP POLICY IF EXISTS "profile avatar owner delete" ON storage.objects;
CREATE POLICY "profile avatar owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-avatars' AND name = auth.uid()::text || '/avatar');

