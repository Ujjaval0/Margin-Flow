-- ============================================================
-- MarginFlow — Step 07: Supabase RLS Policies
-- Run AFTER migrations through 15 — FOR SUPABASE PRODUCTION ONLY.
-- Skip this file for local PostgreSQL testing.
-- ============================================================

-- Business data is private by default. Tenant-aware direct access requires verified ownership policies.

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE user_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cost_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_channel_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims                ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_staged_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_staged_fields      ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: Check if the calling user is authenticated
-- ============================================================
CREATE OR REPLACE FUNCTION fn_is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- USER ACCOUNTS: Users can only read/update their own row
-- ============================================================
CREATE POLICY "user_accounts_select_own"
  ON user_accounts FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "user_accounts_update_own"
  ON user_accounts FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- The trigger fn_handle_new_user() inserts the row on auth signup — no INSERT policy needed.

-- ============================================================
-- BUSINESS TABLES: deny direct access until tenant ownership is enforceable.
-- No fn_is_authenticated() blanket policies are permitted.
-- Run after migrations through 15; application cookies do not establish auth.uid().
-- Existing permissive policies are removed by migration 15.
-- Add narrowly scoped direct-access policies only after validating the actual
-- Supabase identity/account mapping and parent-child ownership in staging.
REVOKE ALL ON suppliers, supplier_payments, products, product_cost_history,
  product_channel_aliases, orders, order_items, return_records, settlements,
  settlement_deductions, claims, claim_documents, purchase_bills, expenses,
  ai_staged_documents, ai_staged_fields, financial_audit_logs, customer_complaints,
  background_jobs, marketplace_connections, marketplace_sync_logs, oauth_states,
  file_import_logs, webhook_receipts FROM anon, authenticated;
