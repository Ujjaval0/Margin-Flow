# MarginFlow — Production Supabase Database Discovery

**Prepared:** 17 October 2026  
**Purpose:** Map the running product’s code-defined data needs and persistence flows before designing or applying a production Supabase database.  
**Scope:** Read-only codebase research, including `pending.md`, `src/`, `tests/`, and the checked-in SQL. No database was changed and no test suite was run for this report.

## Executive summary

The codebase defines a real multi-area commerce and finance product, but the current application does not yet persist every feature to the database. The domain model and views cover products/inventory, orders, returns, settlements, claims, suppliers, purchases, expenses, document staging, audit history, customer complaints, integrations, and reporting. Today, the ordinary database-backed ledger APIs cover products, orders, and settlements; most other ledger state is hydrated from and saved to owner-keyed browser `localStorage`. A production migration must therefore pair schema design with server-side persistence work, or those currently local records will still be lost across devices and browsers.

The checked-in SQL already contains a substantial, evolving schema (29 distinct table names across the SQL files), so this is not a blank-schema exercise. It should be treated as a candidate implementation to reconcile against code and operational requirements. Several setup paths differ, owner columns are nullable `TEXT` without account foreign keys in the tenant migration, and the Supabase RLS setup deliberately grants no direct table access to client roles. Production readiness still depends on selecting one canonical migration path, an identity/tenant model, and a restricted server database role.

Store API credentials are a distinct requirement: marketplace credentials are stored per merchant/store in `marketplace_connections.encrypted_credentials`, encrypted on the server. Their key material belongs in deployment secrets, never in the schema or this report. Real provider credentials and seller access are needed only for live connector acceptance; local tests cannot establish real permissions, OAuth callback behavior, or sync correctness against a provider.

## Sources reviewed

- Product/domain contract: `src/domain/types.ts`, `src/domain/snapshot-validation.ts`
- App state and hydration: `src/domain/store.tsx`, `src/domain/tenant-cache.ts`
- Database access and ordinary ledger APIs: `src/lib/db.ts`, `src/app/api/products/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/settlements/route.ts`
- Authentication: `src/lib/supabase/server.ts`, `src/lib/auth/supabase-account.ts`, `src/lib/security/session.ts`
- Integration vault and persistence: `src/lib/security/marketplace-vault.ts`, `src/lib/integrations/order-persistence.ts`, `src/lib/integrations/webhook-persistence.ts`, `src/lib/integrations/file-audit.ts`
- Database candidates: `database/00_run_all.sql`, `database/01_enums.sql` through `database/19_durable_jobs.sql`, `database/07_rls_supabase.sql`, `database/supabase_fresh_setup.sql`
- Release/test evidence: `pending.md`, `PRODUCTION_REMEDIATION_TASKS.md`, and the `tests/` suites

## Current product and data map

| Product area | Data the code models | Current persistence evidence | Production data requirement |
|---|---|---|---|
| Accounts and onboarding | Supabase identity mapped to a MarginFlow account, account type, company/profile fields, onboarding preferences | Supabase Auth verifies the identity; `user_accounts` maps `auth_user_id` to the internal account ID. | Keep Supabase `auth.users` as identity authority; profile/account row must have a real FK and a stable internal tenant ID. Decide which onboarding/profile fields are durable. |
| Catalog and inventory | Product/SKU, supplier link, stock, MFN IDs, per-channel aliases, historical cost windows | `/api/products` GET/POST persists product rows; read path joins cost history, aliases, and supplier. Some state still uses local cache. | Products, costs, aliases, stock changes, and supplier references need tenant scope and transactional updates. Keep historical cost snapshots immutable on existing order lines. |
| Orders | Order header and line items, marketplace identity/status, customer/location, pricing, tax, discounts, return quantities, cost snapshot | `/api/orders` GET/POST and connector/webhook imports use transactional upserts into orders and order items. Natural identity is merchant + channel order ID + marketplace. | Preserve order/line identity, source fields, tenant-scoped idempotency, currency/source facts if supplied, immutable `snapshot_unit_cost`, and return quantities. |
| Returns and RTO | Return type/reason, dates, AWB, item/quantity, condition, restock state, costs/loss, claim link | In the normal UI these are in the tenant localStorage ledger; recycle-bin paths persist archive/recovery state. | Durable return records with order/item/product references where known; atomic return edits, inventory restock, and recovery transitions. |
| Settlements | Batch/date/order, gross/net, tax, deductions, discrepancy/reconciliation and bank reference | `/api/settlements` reads/writes settlement headers and normalized deductions. Integration finance routes also upsert settlement data. | Tenant-scoped settlement identity, normalized deduction rows, source provenance, and transaction-safe reconciliation. Do not invent provider fees or missing values. |
| Claims and supporting files | Claim type, amount/status/recovery, linked return/order and supporting documents | Mostly local ledger state; upload/document references exist in domain model and schema candidates. | Durable claims, claim-document links, and explicit attachment ownership. Store file bytes in private Supabase Storage; database stores metadata/path, not large file blobs. |
| Suppliers and purchases | Supplier contact/payment terms/bank metadata; invoice/bill lines, quantity/cost/tax/paid amount/status; payment actions | Normal CRUD is local ledger state. Purchase/payment actions update local bill allocations and supplier aggregates; no normal CRUD API currently persists them. | Persist supplier, bill, payment-event, and bill-allocation facts transactionally. Retain `paidAmount`/partial payment semantics and payment method/reference/notes; don't rely on a single mutable total. |
| Expenses | Date/category/amount/vendor/payment method, optional channel/SKU attribution and receipt | Local ledger state apart from recycle-bin support. | Tenant-scoped expense rows and attachment metadata, with auditable writes. |
| AI document staging | Upload metadata, extracted fields/confidence/provenance/page/geometry, validation and review status | Upload/extraction APIs write staged-document and field records; underlying file storage is a separate requirement. | Document and extracted-field records with owner, state transitions, and private storage object metadata. Preserve original source and review/audit trail. |
| Audit and reporting | Financial field-change audit entries, dashboard metrics, profitability, aging, guardrails | Some sync/import routes write audit records; the app's broad audit array is also local state. Reports/metrics are computed from ledger data. | Persist immutable audit events for financial mutations. Keep report totals and dashboard metrics derived unless a measured performance need justifies materialization. |
| Customer complaints | Ticket, customer contact, category/priority/status, order/SKU link, resolution | Typed and shown in UI, but normal state is local ledger storage. | Durable complaint rows only if the complaint workflow remains in the shipped product; avoid making derived notifications a source of truth. |
| Store connections | Marketplace/provider, seller/store identity, auth type, encrypted credentials, connection state, sync cursor/checkpoints | Server-only AES-GCM vault persists per-user credentials and returns metadata without secrets. Sync/OAuth routes use this state. | Tenant/store-scoped connection table, encrypted credential payload, key version/rotation strategy, OAuth state, sync logs/checkpoints, and strict server-only access. Never expose credentials to browser or logs. |
| Webhooks, imports, and jobs | Webhook idempotency receipts; file import audit; durable jobs and retries | These operational flows have database persistence in code. Current handlers use `webhook_receipts`; queue uses `background_jobs`; file audit uses `file_import_logs`. | Preserve idempotency and restart behavior; ensure all operational rows are tenant-scoped where appropriate, indexed, retained/expired intentionally, and only accessible to backend roles. |
| Recycle bin | Seven-day archive/restore patches and recovered-row markers | `ledger_archives` plus record soft-delete/recovery fields and API routes. | Keep only if recycle/restore remains an accepted feature. Use transactions and tenant ownership checks for archive and restore. |

`src/domain/types.ts` is the best single inventory of modeled business data. `src/domain/store.tsx` is the critical persistence caveat: it loads an owner-scoped local snapshot, then overwrites products/orders/settlements from their APIs; most other lists remain local. A TypeScript interface or an SQL table by itself does not prove a feature is durably wired.

## Candidate production schema boundary

The following is a code-derived target inventory, not an instruction to create all tables immediately. Confirm each feature is still in product scope before migration.

### Core tenant ledger

- `user_accounts` (or a clearly named `merchant_accounts`) linked to `auth.users`
- `suppliers`, `supplier_payments`, and a payment-to-bill allocation relation
- `products`, `product_cost_history`, `product_channel_aliases`
- `orders`, `order_items
- `
- `return_records`
- `settlements`, `settlement_deductions`
- `claims`, `claim_documents`
- `purchase_bills` (and bill-line child rows if the product adds multi-SKU bills; current type is one SKU per bill)
- `expenses`
- `financial_audit_logs`
- `customer_complaints` only if the support workflow is retained

### Documents and files

- `ai_staged_documents`, `ai_staged_fields`
- Private Supabase Storage buckets/objects for original uploads and attachments, with owner-scoped metadata and lifecycle cleanup
- Optional generalized document-attachment relation if one file can link to several entities; currently several types carry URL/ID fields in different shapes

### Integrations and operations

- `marketplace_connections` with encrypted secret payloads and sync checkpoints
- `oauth_states` with short expiry and one-time use
- `marketplace_sync_logs`
- `webhook_receipts` for replay/idempotency (current webhook code path); retain `webhook_events` only if a distinct active consumer is found
- `file_import_logs`
- `background_jobs` for workflows actually registered and deployed
- `ledger_archives` and soft-delete/recovery columns only for retained recycle-bin behavior

### Keep derived or client-only unless requirements change

- Dashboard/report/ledger summaries, inventory metrics, settlement aging, and claim summaries are computed from source records and should normally be views/queries.
- The notification bell currently derives notifications from store state; a durable `notifications` table is not evidenced as necessary.
- `acknowledgedLossLeaderSkus` and presentation filters are UI/user preference state; they need a small preferences representation only if cross-device persistence is a product requirement.
- User-provided AI provider keys are intentionally held in owner-keyed browser `localStorage` by `src/lib/security/ai-vault.ts`; do not create a database table for them without a change in product/security requirements. Server provider keys such as Gemini belong in deployment secrets.
- `auth_sessions` and the legacy custom-session schema need a deliberate decision: current identity verification calls Supabase `auth.getUser()`, so do not retain a parallel app session store unless a live route still depends on it.

## Production design decisions and risks to resolve

1. **One setup/migration path.** `database/02_tables.sql` contains a commented Supabase `auth.users` reference and locally generated `auth_user_id`; `database/supabase_fresh_setup.sql` is a separate consolidated bootstrap. Reconcile these definitions and make one ordered, repeatable migration path authoritative before production.
2. **Owner identity and relational integrity.** Tenant migrations add nullable `user_id TEXT` fields and tenant indexes, but do not establish foreign keys to `user_accounts`. Core tenant ownership and child ownership should use one stable internal account UUID (or a documented alternative) with foreign keys. Enforce that parent/child records cannot cross tenants; do not infer ownership for legacy unowned rows.
3. **RLS and server-role model.** `database/07_rls_supabase.sql` enables RLS, removes policies, and revokes direct `anon`/`authenticated` access intentionally. The app uses server-side `pg` queries through `DATABASE_URL`; its owner-scoped SQL is not itself proof of least privilege. Define and test a dedicated restricted runtime DB role, grant only required operations, and decide whether tenant policies are evaluated through a trusted transaction claim or the server API boundary. Do not deploy with `postgres` as the application role.
4. **Credential handling and store identity.** Continue encrypting marketplace secrets server-side; place the encryption master key in managed deployment secrets and document rotation/versioning. Provider API credentials are needed for live integration acceptance, not stored as plaintext schema columns. Resolve the pending selected-store identity issue (F33) across sync, credentials, status, and checkpoints before enabling multiple connections per marketplace.
5. **Financial fidelity.** Persist facts rather than computed guesses. Protect order cost snapshots; model supplier payments and allocations as events; keep bill partial-payment amounts; define currency/source identity and ledger reversal treatment before importing live financial records.
6. **Files and retention.** Supabase Database is not file storage. Decide private Storage buckets, owner checks, signed download behavior, retention, backup/restore, and how DB rows and object deletion stay consistent.
7. **Durability before cutover.** Route every current ledger mutation through acknowledged, tenant-scoped server transactions before treating Supabase as authoritative. Current `pending.md` tracks this gap as F39/F22 and related work.
8. **Schema readiness check is incomplete.** `src/lib/db.ts` checks a selected set of columns and reports that migrations through step 18 are required, while the durable queue relies on migration 19. It does not validate constraints, indexes, grants, or effective RLS/role behavior; it should not be treated as a production schema certification.

## Recommended implementation plan

### Phase A — Freeze the code-defined scope

- Confirm which visible modules are release features: complaints, AI document staging/approval, recycle bin, multi-store connections, and background jobs.
- Use `src/domain/types.ts`, `src/domain/store.tsx`, the route tree, and action handlers as the feature inventory. Mark derived data separately from source-of-truth records.
- Build a field-level mapping from each retained type and mutation to table/column/child relation, nullability, precision, source provenance, and tenant key.

### Phase B — Choose and reconcile identity/schema

- Select the only supported fresh-install and upgrade migration path; reconcile `02_tables.sql` versus `supabase_fresh_setup.sql`.
- Define Supabase Auth ↔ internal account mapping, owner key type, FK cascade behavior, store/connection identity, financial natural keys, and child composite ownership constraints.
- Compare every retained code field with the candidate SQL. Explicitly classify each SQL-only table/column as active operational support, feature still in scope, or legacy candidate. Do not drop based only on a search miss.

### Phase C — Make the core ledger durable

- Implement tenant-scoped transactional CRUD for returns, claims, suppliers, supplier payment events/allocations, purchases, expenses, documents, complaints, and all existing actions that currently only update local state.
- Ensure create/update/delete responses are acknowledged before presenting mutations as saved; preserve audit, cost snapshot, inventory, recovery, and rollback invariants.
- Replace local snapshots as authority with a cache only; test reload, multiple devices, account switching, failed writes, concurrent restock/payment/recovery, and child ownership.

### Phase D — Harden Supabase operations

- Create separate client and restricted server roles, explicit grants, and the selected RLS policy strategy. Validate policies using authenticated Supabase claims and verify the runtime role cannot access other tenants.
- Decide direct-client access policy explicitly; current design is server API access with client table access revoked.
- Configure private Storage, secrets, connection pooling/runtime limits, TLS/egress, backups, retention, logs/alerts, and worker hosting.

### Phase E — Safe migration and acceptance

- Inventory source and target rows; define deduplication and ownership mapping. Quarantine ambiguous/null-owner legacy records rather than assigning them to a merchant.
- Dry-run and verify row counts, financial totals, referential integrity, duplicate keys, import replay, and rollback on a sanitized populated prior-version database.
- Only then migrate production data in a reviewed, backed-up cutover with a reconciliation report and restore path.
- Complete authenticated staging CRUD/RLS, browser/account-switching, restart/multi-instance, provider sandbox/OAuth/webhook, and backup-restore gates before release.

## `pending.md` test and acceptance review

The local suites are broad but do not amount to production acceptance. The focused suites recorded there (Phase 2: 66/66; Phase 3: 47/47; Phase 4: 36/36; Phase 5: 43/43) use synthetic data, mocks, or isolated adapters for their stated coverage. Live provider permissions, Supabase authenticated RLS behavior, the intended restricted database role, populated upgrade migrations, real financial source mappings, and deployment recovery remain open.

There is a material status conflict that should be corrected in `pending.md` before using it as the release checklist:

- `pending.md` says the latest full suite had **235 passed / 20 failed** and describes a build failure at `/_not-found`.
- `PRODUCTION_REMEDIATION_TASKS.md` records a later workspace verification: focused F21/security/release tests **34/34**, `npm run build` passed with 53 static pages, and full `npm test` **253 passed / 1 failed**. The sole recorded failure is a UI analyst expectation for `grid-cols-1 sm:grid-cols-3` in `marginflow-hero.tsx`.
- The same remediation register labels an earlier **247/247** result as historical. Saved test logs are historical snapshots too; they should not override the later register entry.
- Phase 5 focused suite counts also differ: `pending.md` records **43/43**, while the remediation register records **42/42** for its listed workflow and integration suites. Confirm the intended suite set and use one dated result.

So the test follow-up is not “all tests are done”: update the stale pending counts, investigate the one remaining UI test assertion, and retain all external acceptance items. Marketplace credentials are specifically needed for live provider verification; keep their values in the provider console/local secret manager and out of `pending.md`, reports, and chat. No credentials were inspected for this report.

## Research limits

This is a code/schema discovery report, not a final DDL specification. Search results showing no reference to a table are evidence to review, not proof the object is safe to drop. The database project was not mutated, no credentials were tested, no test suite was rerun, and no representative merchant exports were available to validate accounting semantics.
