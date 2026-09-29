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
