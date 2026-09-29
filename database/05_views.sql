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
