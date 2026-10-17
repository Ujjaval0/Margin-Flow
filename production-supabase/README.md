# MarginFlow production Supabase schema package

This folder is the isolated, reviewable production-schema package requested for MarginFlow. It contains a fresh-project baseline derived from the codebase's consolidated Supabase setup, a small fidelity/security delta, and the implementation/acceptance plan.

## Files

- `migrations/20261017000100_initial_schema.sql` — seedless baseline schema for an empty Supabase project. It preserves the existing application table and column names where possible, links `user_accounts.auth_user_id` to `auth.users`, changes tenant keys from untyped text to account UUID foreign keys, and keeps direct browser table access denied.
- `migrations/20261017000200_production_data_fidelity.sql` — adds purchase bill partial-payment storage, explicit supplier-payment allocations, tenant metadata for audit/complaint records, tenant-scoped uniqueness for SKU/ticket/audit identifiers, and locks down legacy global event/notification tables.
- `migrations/20261017000300_private_documents_bucket.sql` — creates a private document bucket with no browser policies; app upload/download integration is still required.
- `IMPLEMENTATION_PLAN.md` — staged work to make the application, database roles, migrations, and acceptance evidence line up.
- `verification/001_read_only_schema_check.sql` — post-migration catalog and privilege checks; performs no writes.

## Important boundary

These are reviewed local schema artifacts, not a production deployment. They have **not** been applied to a Supabase project and do not create the cloud project, credentials, roles, or provider connections. `20261017000100` is for a brand-new empty database only; it is not an upgrade script for `marginflow_dev` or any production database. Do not paste it into an existing project.

The application currently connects to Postgres through `pg` and uses Supabase Auth for identity. The checked-in Supabase RLS strategy denies direct `anon`/`authenticated` table access and expects server-side owner-scoped SQL. A production deployment still needs a dedicated, least-privilege runtime role and authenticated tenant-isolation acceptance. Do not use the Supabase `postgres` role as the app runtime role. The SQL package intentionally does not create a role or embed any secret; role provisioning depends on the selected Supabase deployment and must be tested there.

## Before any production use

1. Review the plan and confirm retained product scope, especially customer complaints, legacy notification/webhook event tables, and custom `auth_sessions`.
2. Apply the three ordered migrations to an empty disposable Supabase project using the supported migration runner; capture the SQL output and inspect tables, constraints, indexes, RLS, and grants.
3. Update the app persistence adapters for all durable ledger mutations. Returns, claims, suppliers, supplier payments/allocations, purchases, expenses, complaints, and staged-document review still lack complete server-acknowledged CRUD; the presence of a table does not make those writes durable.
4. Configure a restricted server role, private Storage buckets/policies, encrypted marketplace credentials, and deployment secrets outside these files.
5. Complete the acceptance gates in `IMPLEMENTATION_PLAN.md` before importing data or using this schema in production.

## Local verification status

- The source-level schema and application inventory is documented in `../PRODUCTION_SUPABASE_DATABASE_DISCOVERY.md`.
- The migration package includes read-only catalog/privilege checks, but migration execution and tenant-role acceptance are still open because no disposable Supabase target or PostgreSQL/Supabase CLI is available in this workspace.
- The current application test suite and production build results are recorded in `IMPLEMENTATION_PLAN.md`. Passing a local build does not certify the database or the unfinished persistence paths.

The baseline retains some legacy schema objects found in the current SQL so the migration is reviewable against the existing project. They are not automatically endorsed as current features; the plan classifies them and prohibits destructive cleanup until product scope is confirmed.
