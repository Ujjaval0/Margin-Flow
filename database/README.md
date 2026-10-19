# MarginFlow Database Setup Guide

Phase 2 update (18 October 2026): `00_run_all.sql` is for a **fresh, disposable database** only. It applies schema migrations through 19 and 21 and does not run the demo seed. Migration 20 is Supabase Storage-specific and is not part of local PostgreSQL setup. For an existing database, review and apply only unapplied numbered migrations after backup; do not rerun the bootstrap. Request handlers never execute DDL.

API handlers now perform read-only readiness checks. Apply migrations 13–19 and 21 in order to an existing local database after backup. Migration 21 is the local PostgreSQL adaptation of the production fee-engine migration; it keeps tenant IDs as text to match the local schema. Existing records without proven ownership are not assigned to a default merchant. Resolve ambiguous ownership before production use.

Phase 4 requires `16_connector_sync_and_oauth.sql` for separate order/finance checkpoints and durable, bound OAuth state. Configure `FLIPKART_APP_ID`, `FLIPKART_APP_SECRET`, and `FLIPKART_REDIRECT_URI` on the server; production callbacks must use the registered HTTPS URI. Pending OAuth flows from before this migration must be restarted. The local `marginflow_dev` database has migrations 13–19 and 21 applied after a verified backup; the production Supabase database was not changed.

For Supabase, use the separately reviewed migrations in `../production-supabase/migrations/`; do not apply the local text-owner migration 21 to Supabase. The revised `07_rls_supabase.sql` runs **after** local numbered migrations and denies direct business-table access to `anon` and `authenticated` by default. Any direct-access ownership policies need separate verification against the real Supabase identity mapping. See `../pending.md` for outstanding database and provider tests.

## Local PostgreSQL (Testing Phase)

### Prerequisites
- PostgreSQL 15+ installed and running locally
- `psql` available in your terminal

### Step 1: Create the database
```bash
psql -U postgres -c "CREATE DATABASE marginflow_dev;"
```

### Step 2: Run the full schema
```bash
# Navigate to the database folder
cd "c:\Users\freak\Desktop\Unified platform\database"

# Run everything in one command
psql -U postgres -d marginflow_dev -f 00_run_all.sql
```

### Step 3: Verify
```bash
# Connect and check tables
psql -U postgres -d marginflow_dev -c "\dt"

# Check a view works
psql -U postgres -d marginflow_dev -c "SELECT * FROM v_inventory_metrics;"

# Check seed data loaded
psql -U postgres -d marginflow_dev -c "SELECT display_id, marketplace, status FROM orders ORDER BY order_date;"
```

---

## File Execution Order

| File | Contents | Notes |
|------|----------|-------|
| `01_enums.sql` | All PostgreSQL enum types | Run first |
| `02_tables.sql` | 20 core tables with FK constraints | Requires enums |
| `03_indexes.sql` | ~45 performance indexes | Requires tables |
| `04_triggers.sql` | 6 invariant-enforcement triggers | Requires tables |
| `05_views.sql` | 6 computed SQL views | Requires tables |
| `06_seed.sql` | Mock data from `mock-data.ts` | Requires all above |
| `07_rls_supabase.sql` | Supabase RLS policies | **Supabase only** |
| `21_marketplace_fee_engine.sql` | Local fee rules, saved per-marketplace quick rates, per-order overrides, estimates, and immutable fee snapshots | Local PostgreSQL; text tenant IDs |

---

## Key Invariants Enforced by Triggers

| Trigger | Rule |
|---------|------|
| `trg_audit_log_immutable` | `financial_audit_logs` is append-only — no UPDATE or DELETE |
| `trg_snapshot_cost_immutable` | `order_items.snapshot_unit_cost` can never be changed after creation |
| `trg_supplier_payment_sync` | `suppliers.total_paid` auto-updates when a payment is inserted/deleted |
| `trg_close_cost_window` | Only one active cost window (valid_to IS NULL) per product |
| `trg_sync_current_cost` | `products.current_cost_price` syncs automatically with new cost history |
| `trg_*_updated_at` | All `updated_at` columns auto-set on any UPDATE |

---

## What is NEVER stored in the DB

- AI API keys (`marginflow_ai_vault_v1` stays in browser localStorage only)
- Computed metrics: `grossProfit`, `contributionProfit`, `ROAS`, `POAS`, dashboard totals
- UI filter state: `selectedMarketplace`, `datePreset`
- Guardrail diagnostic results (computed on demand)

Use the SQL **Views** (`v_order_profitability`, `v_sku_profitability`, etc.) instead.

---

## Next Steps: Connecting to Next.js

```bash
# Install the PostgreSQL client
npm install pg @types/pg

# Or for Supabase
npm install @supabase/supabase-js
```

Add to `.env.local`:
```
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/marginflow_dev

# Supabase (production)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Phase 5 archive migration

Apply `17_recycle_bin.sql` explicitly after migrations 01–16, first on an approved disposable database. The fresh bootstrap includes it; request handlers never execute DDL. It adds tenant-owned archives, settlement soft-delete visibility and recovery metadata for returns, claims and expenses. Existing unowned expenses are not assigned to an account.

The server database role must have the required table privileges and a verified RLS strategy. `ledger_archives` enables RLS and grants no public/direct-client access. Test archival/recovery rollback, competing restores, stock conflicts, expiry and cross-tenant access using the actual intended server role before deployment. Seven days is the recovery window; this migration does not schedule physical purges.

## Phase 6 session migration

Apply `18_auth_sessions.sql` explicitly after migrations 01–17, first on an approved disposable target with the intended server role. Bootstrap includes it and the read-only readiness check requires it; request handlers never create the table. It stores SHA-256 token digests, owner, expiry and revocation timestamps. RLS is enabled with no public grants. Provision and test the server's privileges/RLS strategy; do not grant direct browser access to session records.

All replicas need the same stable, randomly generated `SESSION_SECRET` of at least 32 bytes (or the existing `ENCRYPTION_MASTER_KEY` fallback). Authentication checks require an authoritative database without stale active-session caching/read replicas. Login fails if registration cannot persist; logout clears the browser cookie only after revocation succeeds. Old stateless tokens are rejected and users must sign in again after deployment.

Before release, verify real SQL issuance, copied cookie/Bearer revocation, selective logout, outages/retry, deleted accounts, restart and separate replicas. The isolated test registry does not certify PostgreSQL behavior. Choose retention and scheduled cleanup for expired/revoked sessions separately; this migration schedules no deletion.

## Phase 6 durable job migration

Apply `19_durable_jobs.sql` after migration 18 to an approved database. It adds enqueue idempotency keys, retry limits, scheduling, priority and worker leases to `background_jobs`; job records are deleted with their owner account. The application does not apply this migration automatically. The migration was applied and rerun against the isolated `marginflow_phase2_acceptance_20261015` database; evidence is in `../phase6-queue-postgres-check.json`.

The worker lifecycle uses PostgreSQL row locking, bounded retries and lease recovery. Set `MARGINFLOW_JOB_WORKER=1` only on a persistent Node.js host to start a worker from Next.js instrumentation; serverless request instances are not a durable worker runtime. CSV order imports and tenant-scoped financial summary reports have real processors. Reconciliation and batch IDP remain unavailable until their business contracts are implemented. Only registered job types can be enqueued. Verify worker supervision and shutdown/restart behavior on the selected host before production use.

## Supabase profile avatar storage

For an existing Supabase project, apply `20_profile_avatars.sql` after migrations 01–19. It creates the public `profile-avatars` bucket with a 2 MB image limit and JPEG, PNG and WebP allowlist. Authenticated users can upload, replace or delete only their own `<auth-user-id>/avatar` object; public reads are enabled so the profile image can render in the dashboard. The Supabase fresh setup script includes the same bucket and policies. No service-role key is required by the application.
