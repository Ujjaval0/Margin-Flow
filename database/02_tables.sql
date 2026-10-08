-- ============================================================
-- MarginFlow — Step 02: Core Tables
-- Run AFTER 01_enums.sql
-- Tables are created in strict FK dependency order.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USER ACCOUNTS
-- ------------------------------------------------------------
-- NOTE: In Supabase, this references auth.users.
-- For local PostgreSQL testing, the auth_user_id column is just a UUID
-- and the REFERENCES auth.users constraint should be OMITTED locally.
CREATE TABLE user_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Uncomment the line above and remove the line below when moving to Supabase:
  auth_user_id    UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
  created_by  UUID REFERENCES user_accounts(id) ON DELETE SET NULL
);
