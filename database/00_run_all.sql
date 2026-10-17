-- Fresh-database bootstrap only. Never run this against an existing populated schema.
-- Production upgrades must apply only reviewed, unapplied numbered migrations.
\set ON_ERROR_STOP on
\ir 01_enums.sql
\ir 02_tables.sql
\ir 03_indexes.sql
\ir 04_triggers.sql
\ir 05_views.sql
\ir 08_webhooks_notifications_softdelete.sql
\ir 09_marketplace_connections.sql
\ir 10_orders_idempotency.sql
\ir 11_oauth_states.sql
\ir 12_file_import_audit.sql
\ir 13_multitenant_isolation.sql
\ir 14_webhook_receipts.sql
\ir 15_tenant_document_and_identity.sql
\ir 16_connector_sync_and_oauth.sql
\ir 17_recycle_bin.sql
\ir 18_auth_sessions.sql
\ir 19_durable_jobs.sql
\echo 'Schema bootstrap complete. No demo seed was applied.'
\echo 'Supabase only: review and run 07_rls_supabase.sql after all migrations.'
