-- Read-only deployment evidence. Run with the intended role; inspect every result.
SELECT current_user AS checked_role, r.rolsuper, r.rolbypassrls
FROM pg_roles r WHERE r.rolname=current_user;

SELECT name,to_regclass('public.'||name) IS NOT NULL AS present
FROM (VALUES ('financial_commands'),('provider_financial_events'),('supplier_payment_allocations'),('product_cost_history')) required(name);

SELECT table_name,column_name,EXISTS(
 SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
 AND c.table_name=required.table_name AND c.column_name=required.column_name
) AS present
FROM (VALUES ('orders','record_data'),('order_items','record_data'),('settlements','record_data'),
 ('settlement_deductions','record_data'),('financial_audit_logs','sequence'),('purchase_bills','paid_amount'),
 ('purchase_bills','user_id'),('supplier_payments','user_id'),('supplier_payments','advance_amount'),
 ('return_records','user_id'),('claims','user_id'),('ai_staged_documents','deleted_at')) required(table_name,column_name);

SELECT name,to_regclass('public.'||name) IS NULL AS retired
FROM (VALUES ('v_order_profitability'),('v_sku_profitability'),('v_marketplace_profitability'),
 ('v_settlement_aging'),('v_inventory_metrics'),('v_claims_summary')) legacy(name);

SELECT c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_has_business_access,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_has_business_access
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('financial_commands','provider_financial_events','orders',
 'products','suppliers','purchase_bills','supplier_payments','return_records','claims','expenses','financial_audit_logs');
