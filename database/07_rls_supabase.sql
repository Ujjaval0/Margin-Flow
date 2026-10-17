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
