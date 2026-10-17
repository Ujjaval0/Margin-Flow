-- Read-only post-migration checks for a disposable Supabase project.
-- Run after all migrations. Returns findings; it does not change schema or data.

-- 1. Public tables and whether RLS is enabled.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. Any direct table or column privileges granted to browser roles.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
UNION ALL
SELECT table_name, grantee, privilege_type
FROM information_schema.role_column_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 3. Any tenant owner columns that are not UUID or lack a foreign key.
WITH owner_columns AS (
  SELECT c.table_name, c.column_name, c.data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'user_id'
), owner_fks AS (
  SELECT DISTINCT tc.table_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.constraint_schema = tc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.constraint_schema = tc.constraint_schema
  WHERE tc.constraint_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name = 'user_accounts'
    AND ccu.column_name = 'id'
)
SELECT o.table_name, o.data_type, (f.table_name IS NOT NULL) AS references_user_accounts
FROM owner_columns o
LEFT JOIN owner_fks f USING (table_name)
WHERE o.data_type <> 'uuid' OR f.table_name IS NULL
ORDER BY o.table_name;

-- 4. Sensitive global tables must not be directly reachable from browser roles.
SELECT table_name,
       has_table_privilege('anon', format('public.%I', table_name), 'SELECT') AS anon_can_select,
       has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') AS authenticated_can_select
FROM (VALUES ('webhook_events'), ('notifications'), ('marketplace_connections'),
             ('webhook_receipts'), ('financial_audit_logs')) AS t(table_name)
ORDER BY table_name;

-- 5. Profile identity must reference Supabase Auth.
SELECT tc.constraint_name, kcu.column_name, ccu.table_schema, ccu.table_name, ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_schema = 'public'
  AND tc.table_name = 'user_accounts'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Tenant tables must have row-level security enabled.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'user_accounts','suppliers','supplier_payments','supplier_payment_allocations',
    'products','product_cost_history','product_channel_aliases','orders','order_items',
    'return_records','settlements','settlement_deductions','claims','claim_documents',
    'purchase_bills','expenses','ai_staged_documents','ai_staged_fields',
    'financial_audit_logs','customer_complaints','background_jobs',
    'marketplace_connections','marketplace_sync_logs','oauth_states','file_import_logs',
    'webhook_receipts','ledger_archives','auth_sessions'
  )
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 7. Tenant-scoped uniqueness required by current write paths.
SELECT required.index_name
FROM (VALUES
  ('uq_products_user_sku'),
  ('uq_orders_user_channel_marketplace'),
  ('uq_settlements_user_batch_order'),
  ('uq_orders_user_display'),
  ('uq_products_user_display'),
  ('uq_settlements_user_display'),
  ('uq_suppliers_user_display'),
  ('uq_documents_user_display'),
  ('uq_expenses_user_display'),
  ('uq_customer_complaints_owner_ticket'),
  ('uq_financial_audit_logs_owner_display')
) AS required(index_name)
LEFT JOIN pg_class i ON i.relname = required.index_name
LEFT JOIN pg_namespace n ON n.oid = i.relnamespace AND n.nspname = 'public'
WHERE i.oid IS NULL OR n.oid IS NULL
ORDER BY required.index_name;

-- 8. Supabase CLI migration history should contain all three package versions.
SELECT required.version
FROM (VALUES ('20261017000100'), ('20261017000200'), ('20261017000300')) AS required(version)
LEFT JOIN supabase_migrations.schema_migrations applied USING (version)
WHERE applied.version IS NULL
ORDER BY required.version;
