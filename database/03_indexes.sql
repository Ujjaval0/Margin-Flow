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

-- ------------------------------------------------------------
-- SUPPLIER PAYMENTS — lookup payments per supplier
-- ------------------------------------------------------------
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX idx_supplier_payments_date     ON supplier_payments (paid_at DESC);
