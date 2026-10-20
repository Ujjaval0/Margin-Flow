-- Run as the Supabase SQL Editor administrator AFTER all schema migrations.
-- This server role is trusted across accounts. API SQL MUST filter by verified
-- MarginFlow account ID; these policies do not provide per-user SQL isolation.
-- It cannot bypass RLS, administer the database, or access Auth/Storage tables.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='marginflow_runtime') THEN
    CREATE ROLE marginflow_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='marginflow_runtime'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='marginflow_runtime')) THEN
    RAISE EXCEPTION 'Existing runtime role is privileged or inherits another role. Review it before continuing.';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO marginflow_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, marginflow_runtime;

DO $$ DECLARE t text; permissions text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_accounts','suppliers','supplier_payments','supplier_payment_allocations',
    'products','product_cost_history','product_channel_aliases','orders','order_items',
    'return_records','claims','claim_documents','settlements','settlement_deductions',
    'purchase_bills','expenses','ai_staged_documents','ai_staged_fields','financial_audit_logs',
    'background_jobs','marketplace_connections','marketplace_sync_logs','oauth_states',
    'file_import_logs','webhook_receipts','ledger_archives','marketplace_fee_rules',
    'marketplace_fee_rule_components','marketplace_quick_fee_rates','order_fee_estimates',
    'order_fee_estimate_components','channel_accounting_policies','statutory_withholding_rates',
    'financial_commands','provider_financial_events','auth_sessions','customer_complaints'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE oid=format('public.%I',t)::regclass
      AND relowner=(SELECT oid FROM pg_roles WHERE rolname='marginflow_runtime')) THEN
      RAISE EXCEPTION 'Runtime role must not own table %',t;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, marginflow_runtime',t);
    permissions := CASE
      WHEN t IN ('financial_audit_logs','order_fee_estimates','order_fee_estimate_components','financial_commands','provider_financial_events') THEN 'SELECT, INSERT'
      WHEN t='user_accounts' THEN 'SELECT, INSERT, UPDATE'
      WHEN t='auth_sessions' THEN 'SELECT'
      ELSE 'SELECT, INSERT, UPDATE, DELETE' END;
    EXECUTE format('GRANT %s ON public.%I TO marginflow_runtime',permissions,t);
    EXECUTE format('DROP POLICY IF EXISTS marginflow_server ON public.%I',t);
    EXECUTE format('CREATE POLICY marginflow_server ON public.%I TO marginflow_runtime USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;

-- Identity sequence used by append-only audit inserts.
GRANT USAGE, SELECT ON SEQUENCE public.financial_audit_logs_sequence_seq TO marginflow_runtime;
REVOKE ALL ON public.notifications, public.webhook_events
  FROM PUBLIC, anon, authenticated, marginflow_runtime;
-- Only grants the administrator membership in the restricted role, never vice versa.
GRANT marginflow_runtime TO postgres;
COMMIT;

-- Set a generated password separately (never commit a real password here):
-- ALTER ROLE marginflow_runtime WITH LOGIN PASSWORD '<64-random-hex-characters>';
