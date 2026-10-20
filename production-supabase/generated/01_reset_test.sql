-- DESTRUCTIVE: deletes MarginFlow app tables and their data only.
-- Managed auth/storage schemas, buckets, identities and unrelated extensions stay intact.
-- Stop writes and take a backup first. Run separately from 02_create.sql.
BEGIN;
DO $$
DECLARE confirmation text := 'CHANGE_ME'; t text; unexpected text;
BEGIN
  IF confirmation IS DISTINCT FROM 'DELETE MARGINFLOW TEST DATA' THEN
    RAISE EXCEPTION 'Reset is locked. Replace CHANGE_ME only after confirming this is disposable test data.';
  END IF;
  SELECT string_agg(c.relname, ', ') INTO unexpected
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
    AND c.relname <> ALL(ARRAY['ai_staged_documents','ai_staged_fields','auth_sessions','background_jobs','channel_accounting_policies','claim_documents','claims','customer_complaints','expenses','file_import_logs','financial_audit_logs','financial_commands','ledger_archives','marketplace_connections','marketplace_fee_rule_components','marketplace_fee_rules','marketplace_quick_fee_rates','marketplace_sync_logs','notifications','oauth_states','order_fee_estimate_components','order_fee_estimates','order_items','orders','product_channel_aliases','product_cost_history','products','provider_financial_events','purchase_bills','return_records','settlement_deductions','settlements','statutory_withholding_rates','supplier_payment_allocations','supplier_payments','suppliers','user_accounts','webhook_events','webhook_receipts','v_claims_summary','v_inventory_metrics','v_marketplace_profitability','v_order_profitability','v_recycle_bin','v_settlement_aging','v_sku_profitability','v_unread_notification_count','marginflow_schema_migrations']);
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Unrecognized public objects: %. Review dependencies before resetting.',unexpected;
  END IF;
  FOREACH t IN ARRAY ARRAY['v_claims_summary','v_inventory_metrics','v_marketplace_profitability','v_order_profitability','v_recycle_bin','v_settlement_aging','v_sku_profitability','v_unread_notification_count'] LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ai_staged_documents','ai_staged_fields','auth_sessions','background_jobs','channel_accounting_policies','claim_documents','claims','customer_complaints','expenses','file_import_logs','financial_audit_logs','financial_commands','ledger_archives','marketplace_connections','marketplace_fee_rule_components','marketplace_fee_rules','marketplace_quick_fee_rates','marketplace_sync_logs','notifications','oauth_states','order_fee_estimate_components','order_fee_estimates','order_items','orders','product_channel_aliases','product_cost_history','products','provider_financial_events','purchase_bills','return_records','settlement_deductions','settlements','statutory_withholding_rates','supplier_payment_allocations','supplier_payments','suppliers','user_accounts','webhook_events','webhook_receipts','marginflow_schema_migrations'] LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fn_block_audit_log_mutations','fn_block_snapshot_cost_update','fn_close_previous_cost_window','fn_set_updated_at','fn_sync_product_current_cost','fn_sync_supplier_total_paid','reject_ambiguous_marketplace_fee_rule','reject_order_fee_snapshot_mutation','seed_marketplace_quick_fee_rates_for_account'] LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I() CASCADE',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['account_type_enum','ai_document_status_enum','ai_document_type_enum','audit_entity_type_enum','claim_status_enum','claim_type_enum','complaint_category_enum','complaint_priority_enum','complaint_status_enum','deduction_category_enum','expense_category_enum','job_status_enum','job_type_enum','marketplace_enum','notification_severity_enum','notification_type_enum','order_status_enum','payment_method_enum','payment_status_enum','product_condition_enum','provenance_enum','reconciliation_status_enum','restock_status_enum','return_type_enum','webhook_source_enum','webhook_status_enum'] LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE',t);
  END LOOP;
END $$;
COMMIT;
