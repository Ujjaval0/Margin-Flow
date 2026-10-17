# Production Supabase implementation and acceptance plan

This plan follows the codebase discovery in `../PRODUCTION_SUPABASE_DATABASE_DISCOVERY.md`. The goal is to make the database schema, application persistence, tenant boundaries, and production operations agree before a production cutover.

## Execution status — 17 October 2026

- The code-derived fresh-project migration package and read-only verification queries are present. The fidelity migration now removes global uniqueness for tenant SKUs, complaint ticket numbers, and audit display IDs and replaces it with owner-scoped uniqueness.
- `npm run build` passed locally, including TypeScript validation and generation of all 55 pages.
- `npm test` completed with 235 passed and 20 failed (255 total). The open auth/session assertions are tracked in `../pending.md`.
- Migration SQL was not executed: this workspace has no `psql`, Docker, or Supabase CLI, and no disposable database target was identified. The SQL artifacts therefore remain unverified by PostgreSQL execution.
- Production readiness is **not yet accepted**. Remaining blockers include the failing test cases, a restricted runtime role/RLS acceptance, missing durable CRUD paths, provider sandbox/API-key configuration, and backup/restore and deployment acceptance.

## Phase 1 — Confirm the contract

- [ ] Confirm feature scope for products, orders, returns, settlements, claims, suppliers/payments, purchases, expenses, staged documents, audit, complaints, recycle-bin recovery, jobs, and integrations.
- [ ] Decide whether `webhook_events`, `notifications`, and `auth_sessions` remain. Current code uses `webhook_receipts`, derives alerts in the UI, and verifies sessions through Supabase Auth; the legacy tables are retained only as locked-down compatibility candidates in the baseline.
- [ ] Confirm stable public IDs, natural idempotency keys, currency/source fields, financial precision, and retention policy against representative sanitized exports.
- [ ] Confirm this package targets a new empty Supabase project. Existing data must use a separate reviewed upgrade/migration path.

## Phase 2 — Review the schema in disposable Supabase

- [ ] Apply migrations `20261017000100` then `20261017000200`, then the private storage bucket migration `20261017000300` to a disposable empty project with a migration runner and record the exact revision/result.
- [ ] Inspect every table and confirm account UUID ownership, foreign keys, cascade/restrict behavior, natural-key uniqueness, checks, indexes, triggers, and views.
- [ ] Confirm RLS is enabled for all tenant or sensitive tables and `anon`/`authenticated` have no unintended direct privileges.
- [ ] Provision a dedicated restricted runtime role using the platform-supported process. Verify the app can perform only intended operations; reject use of the project owner/postgres role as runtime.
- [ ] Test authenticated account A/B isolation, child-row isolation, rollback, stale account switching, and owner deletion/cascade behavior with synthetic accounts.

## Phase 3 — Complete durable application persistence

- [ ] Replace local-only CRUD for returns, claims, suppliers, supplier payments/allocations, purchases, expenses, customer complaints, and staged-document review state with server-acknowledged, tenant-scoped transactions.
- [ ] Add tenant owner IDs to audit writes and require them for new audit/complaint rows before those tables carry production data. Migration 0002 leaves these columns nullable so current SQL insert paths are not silently broken; this is a release blocker until adapters are updated and null rows are ruled out.
- [ ] Preserve order cost snapshots, order/item identity, settlement deductions, partial bill `paid_amount`, return restock/recovery invariants, payment allocation totals, and audit immutability.
- [ ] Store document bytes in private Supabase Storage. Persist owner-scoped object metadata, storage paths, content hashes, access lifecycle, and retention. Never use public URLs for supplier, claim, or financial records.
- [ ] Keep user-supplied AI API keys client-only as currently designed unless product requirements change; keep marketplace encryption keys and operator AI credentials in managed deployment secrets.
- [ ] Update readiness checks to validate the full migration revision, constraints/indexes/RLS, required grants and operational tables, not just selected column names.

## Phase 4 — Connector and operational readiness

- [ ] Resolve selected-store connection identity across all sync, credential, status, and checkpoint routes before enabling multiple stores per provider.
- [ ] Using approved sandbox accounts, test real API permissions, token refresh/expiry, OAuth callback binding, webhook signatures/replay, throttling, pagination, and failure/retry behavior.
- [ ] Verify durable queue worker hosting, restart recovery, idempotency, retry policy, multi-instance consistency, and per-tenant job access.
- [ ] Configure encryption-key rotation, database connection pooling, TLS/egress, redacted logs, alerts, retention cleanup, backups, and a tested restore with a stated recovery point/time target.

## Phase 5 — Data migration and cutover

- [ ] Inventory the old database and source files; report row counts and financial totals by tenant/table before moving any data.
- [ ] Use only a verified merchant-to-record ownership map. Quarantine rows with missing or ambiguous ownership; never infer a tenant from email, marketplace, or filename.
- [ ] Dry-run against a sanitized populated copy; verify duplicate handling, parent/child counts, order and settlement totals, cost snapshots, partial payments, return inventory, audit trail, and retry idempotency.
- [ ] Test rollback and restore from backup. Record row-count and reconciliation results.
- [ ] Cut over only after an approved backup, a reviewed migration runbook, and the authenticated staging/browser/provider matrix all pass.

## Release blockers carried from `pending.md`

- Supabase authenticated policy and restricted-role acceptance.
- Server durability for all existing ledger mutations and mutation acknowledgement.
- Selected-store identity routing (F33) and provider sandbox acceptance.
- Representative marketplace/settlement/supplier/return/refund data for financial source validation.
- Upgrade safety for populated migrations; backup/restore, worker restart, authenticated browser and operations acceptance.
- Resolve the stale test/build counts and the one remaining UI analyst assertion described in the discovery report before treating the checklist as current.
