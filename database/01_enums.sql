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
