-- ============================================================
-- MarginFlow — Step 07: Supabase RLS Policies
-- Run AFTER 06_seed.sql — FOR SUPABASE PRODUCTION ONLY.
-- Skip this file for local PostgreSQL testing.
-- ============================================================

-- NOTE: These policies assume single-tenant (one user = one company).
-- For multi-tenant SaaS, add a company_id column to each table and
-- replace the auth.uid() check with a company membership check.

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
-- ALL OTHER TABLES: Authenticated users have full access
-- (single-tenant model — all data belongs to the authenticated user)
-- ============================================================

-- SUPPLIERS
CREATE POLICY "suppliers_all_authenticated" ON suppliers
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- SUPPLIER PAYMENTS
CREATE POLICY "supplier_payments_all_authenticated" ON supplier_payments
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- PRODUCTS
CREATE POLICY "products_all_authenticated" ON products
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- PRODUCT COST HISTORY
CREATE POLICY "product_cost_history_all_authenticated" ON product_cost_history
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- PRODUCT CHANNEL ALIASES
CREATE POLICY "product_channel_aliases_all_authenticated" ON product_channel_aliases
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- ORDERS
CREATE POLICY "orders_all_authenticated" ON orders
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- ORDER ITEMS
CREATE POLICY "order_items_all_authenticated" ON order_items
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- RETURN RECORDS
CREATE POLICY "return_records_all_authenticated" ON return_records
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- SETTLEMENTS
CREATE POLICY "settlements_all_authenticated" ON settlements
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- SETTLEMENT DEDUCTIONS
CREATE POLICY "settlement_deductions_all_authenticated" ON settlement_deductions
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- CLAIMS
CREATE POLICY "claims_all_authenticated" ON claims
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- CLAIM DOCUMENTS
CREATE POLICY "claim_documents_all_authenticated" ON claim_documents
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- PURCHASE BILLS
CREATE POLICY "purchase_bills_all_authenticated" ON purchase_bills
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- EXPENSES
CREATE POLICY "expenses_all_authenticated" ON expenses
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- AI STAGED DOCUMENTS
CREATE POLICY "ai_staged_documents_all_authenticated" ON ai_staged_documents
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- AI STAGED FIELDS
CREATE POLICY "ai_staged_fields_all_authenticated" ON ai_staged_fields
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- FINANCIAL AUDIT LOGS: INSERT only (no UPDATE or DELETE via RLS)
CREATE POLICY "audit_logs_insert_authenticated" ON financial_audit_logs
  FOR INSERT WITH CHECK (fn_is_authenticated());
CREATE POLICY "audit_logs_select_authenticated" ON financial_audit_logs
  FOR SELECT USING (fn_is_authenticated());
-- No UPDATE or DELETE policy = those operations are blocked for all roles

-- CUSTOMER COMPLAINTS
CREATE POLICY "customer_complaints_all_authenticated" ON customer_complaints
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- BACKGROUND JOBS
CREATE POLICY "background_jobs_all_authenticated" ON background_jobs
  FOR ALL USING (fn_is_authenticated()) WITH CHECK (fn_is_authenticated());

-- ============================================================
-- SUPABASE AUTH TRIGGER: Auto-create user_accounts row on signup
-- ============================================================
CREATE OR REPLACE FUNCTION fn_handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_accounts (auth_user_id, name, email, company_name, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    COALESCE((NEW.raw_user_meta_data->>'account_type')::account_type_enum, 'BRAND_OWNER')
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to Supabase's auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_auth_user();
