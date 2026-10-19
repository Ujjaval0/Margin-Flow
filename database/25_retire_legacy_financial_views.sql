-- These unused views embed prototype payout estimates and unsafe join fan-out.
-- The authenticated canonical TypeScript projection is the sole reporting contract.
-- Dropping views changes no source transactions. No CASCADE is used.
BEGIN;
DROP VIEW IF EXISTS v_order_profitability;
DROP VIEW IF EXISTS v_sku_profitability;
DROP VIEW IF EXISTS v_marketplace_profitability;
DROP VIEW IF EXISTS v_settlement_aging;
DROP VIEW IF EXISTS v_inventory_metrics;
DROP VIEW IF EXISTS v_claims_summary;
COMMIT;
