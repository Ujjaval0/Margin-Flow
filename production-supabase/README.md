# MarginFlow production Supabase package

Start with [DEPLOYMENT.md](DEPLOYMENT.md): live read-only findings, disposable-data reset, restricted role, Auth/SMTP/Google setup, Vercel variables, verification and outstanding release blockers.

You confirmed the current business records are disposable test data. No remote mutations were performed while preparing these files.

| File | Purpose |
| --- | --- |
| audit.mjs | Read-only hosted catalogs, counts and ownership findings |
| live-schema-audit.json | Evidence before changes, without credentials or business rows |
| prepare.mjs | Generate SQL Editor files locally; no database connection |
| operations/00_lock_down_legacy_tables.sql | Remove dangerous legacy browser grants without deleting records |
| generated/01_reset_test.sql | Guarded destructive reset of app objects; preserves managed Auth/Storage |
| generated/02_create.sql | Empty-app-schema bootstrap from all ordered migrations |
| operations/20_runtime_role.sql | Explicit trusted-server grants/policies; password set separately |
| operations/30_profile_avatars.sql | Profile bucket and owner-only policies, including SELECT for replacement |
| verification/001_read_only_schema_check.sql | Catalog, ownership, index, browser-grant and package receipt checks |
| verification/002_financial_readiness.sql | Canonical financial schema checks |
| verification/003_runtime_crud.sql | Runtime CRUD/audit checks with row changes rolled back |

Regenerate from the repository root with `node production-supabase/prepare.mjs`. Edit only the reset confirmation in the copy you execute; regeneration locks it again. Edit source migrations/operations instead of generated creation SQL. Keep applied migration files immutable and add future changes as new versions.

The SQL Editor bootstrap records marginflow_schema_migrations checksums separately from Supabase CLI history. Reconcile histories before changing runners. This reset/bootstrap is not a data-preserving upgrade for populated databases.

The app uses Supabase Auth and owner-scoped server-side pg queries. Browser business-table access remains denied. The runtime role is trusted across accounts without database-admin privileges; its policies do not enforce per-tenant SQL isolation.

IMPLEMENTATION_PLAN.md is historical and has outdated status statements. Use the deployment guide and current acceptance evidence. Private document storage, worker/producer deployment and complaint persistence still need implementation for a full-feature release.
