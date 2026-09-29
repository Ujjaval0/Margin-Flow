-- ============================================================
-- MarginFlow — MASTER RUNNER
-- Runs all SQL files in the correct dependency order.
-- Usage (local PostgreSQL):
--   psql -U postgres -d marginflow_dev -f 00_run_all.sql
-- ============================================================

\echo '=== [1/6] Creating enum types...'
\i 01_enums.sql

\echo '=== [2/6] Creating tables...'
\i 02_tables.sql

\echo '=== [3/6] Creating indexes...'
\i 03_indexes.sql

\echo '=== [4/6] Creating triggers...'
\i 04_triggers.sql

\echo '=== [5/6] Creating computed views...'
\i 05_views.sql

\echo '=== [6/6] Seeding initial data...'
\i 06_seed.sql

\echo ''
\echo '✅ MarginFlow database setup complete.'
\echo 'Tables created: 20'
\echo 'Enum types:     12'
\echo 'Indexes:        ~45'
\echo 'Triggers:        6'
\echo 'Views:           6'
\echo ''
\echo 'NOTE: For Supabase production, also run 07_rls_supabase.sql'
\echo '      in the Supabase SQL Editor (NOT locally).'
