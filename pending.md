# Pending implementation and verification

Updated: 17 October 2026. This file contains only work that remains open, needs external access or lacks acceptance evidence. Verified local test results and completed implementation slices are recorded in [PRODUCTION_REMEDIATION_TASKS.md](./PRODUCTION_REMEDIATION_TASKS.md). A phase remains open until every required local and external gate is accepted.

## Current release blockers

- [ ] **Full test suite:** latest `npm test` result on 17 October 2026 was 235 passed and 20 failed (255 total). Failures cluster around legacy custom-session/Google route expectations after the Supabase Auth migration and one store-integration session-wiring assertion. Reconcile tests with the current Supabase flow, then investigate any behavior failures they expose.
- [x] **Build verification:** `npm run build` passed on 17 October 2026, including TypeScript validation, static page generation (55/55), and build trace collection. This resolves the earlier `/_not-found` page-data collection failure for this local run; deployment build acceptance remains open.
- [ ] **Production acceptance:** intended restricted database roles, authenticated staging, deployed secrets, provider accounts, monitoring, load and backup recovery have not been verified.
- [ ] **Financial source validation:** representative marketplace, settlement, supplier, return and refund records are needed to verify source mapping and accounting assumptions.

## Phase 1 — security and identity

### Verification run — 15 October 2026

**Passed checks**

- [x] Read-only connection to the configured Supabase database succeeded; `user_accounts`, `webhook_receipts` and `auth_sessions` exist.
- [x] Read-only privilege check confirmed RLS is enabled and `anon`/`authenticated` have no direct SELECT or INSERT grants on those three tables.
- [x] Supabase Auth settings endpoint returned HTTP 200; email and Google providers are enabled, and email auto-confirm is disabled (confirmation is required).
- [x] Existing isolated PostgreSQL webhook receipt/replay checks remain recorded as passed in the remediation register; they cover durable idempotency, retries, rollback and concurrent duplicate delivery.

**Still pending or incomplete**

- [ ] Verify least-privilege server-role behavior; the configured connection currently uses the `postgres` role.
- [ ] Successful login, signup, confirmation-email delivery and authenticated Supabase claims were not exercised; no disposable test account/project was identified, and signup could create a real identity and send email.
- [ ] `npm run test:security`: 15/18 pass. Three auth cases fail because the harness lacks Supabase configuration or expects the retired Google route; update/replace those checks before treating the suite as accepted.
- [ ] Phase 1 static/integration test files: 23/29 pass. Six failures assert the retired custom session/token and Google route architecture; reconcile them with Supabase Auth.
- [ ] Full `npm test`: 234/254 pass; see current release blockers above.
- [ ] The initial build attempt was blocked by Google Fonts DNS; a later network-enabled build compiled and passed TypeScript but failed during page-data collection. See current release blockers above.

### Local engineering and PostgreSQL acceptance

- [ ] **F08/F12 — shared quotas and trusted proxies:** implement atomic quotas shared across processes and accept forwarded client addresses only from explicitly configured trusted proxies. Current code uses process-local token buckets; no trusted-proxy configuration was found. No provider key is needed.
- [ ] **F16 — parser resource isolation:** enforce decoded dimensions/page limits and bounded CPU, memory and execution time; test malformed inputs and decompression/resource exhaustion. Current review found no decoded image/PDF page bounds or bounded OCR execution.
- [ ] **F17 — public error review:** finish route-by-route behavioral checks that public errors omit secrets, SQL, filesystem paths, provider payloads and stack traces. Current review found upload/extraction routes that return raw exception messages; behavioral coverage remains incomplete.
- [ ] **F19 — webhook route and restart acceptance:** verify route credential resolution and HMAC using signed provider fixtures; exercise independent app processes, retry after restart and intended database-role privileges. PostgreSQL receipt/replay behavior is already verified locally (see the remediation register). The configured Supabase database check confirmed RLS and no direct client grants, but used the `postgres` role and does not verify the intended restricted role.
- [ ] **F03 — legacy uploaded files:** migrate only with an authoritative merchant-to-file ownership mapping. Do not infer ownership or reassign ambiguous files.

### External access

- [ ] Verify AI/marketplace permissions, token expiry and refresh, timeouts, webhook registration and signed fixtures using approved sandbox credentials/stores.
- [ ] Verify Supabase Auth claims, storage/network behavior and deployed grants/RLS in a staging project. Read-only checks on the configured project confirmed table RLS/no direct client grants, but did not exercise authenticated claims, storage behavior or the intended restricted server role. The local server session does not create `auth.uid()` claims.

## Phase 2 — tenant isolation and durable persistence

### Verification run — 15 October 2026

**Passed checks**

- [x] Phase 2 focused suites passed **66/66** after the mutation-acknowledgement change: tenant-isolation, Phase 2 store-integration, persistence and remediation-workflow suites. Coverage uses source checks and isolated adapters; it is not authenticated live CRUD acceptance.
- [x] `npx tsc --noEmit` passed with no TypeScript errors.
- [x] Single-product creation now waits for a successful `/api/products` response before updating local state; its regression test verifies rejected writes leave the catalog unchanged.
- [x] Read-only catalog inspection of the configured Supabase project found **29/29 public tables with RLS enabled** and no direct table privileges for `anon` or `authenticated`.

**Still pending or incomplete**

- [ ] Verify Supabase policies with real authenticated claims and the intended restricted server role; current database access uses `postgres`, and metadata checks do not prove tenant policy behavior.
- [ ] Run authenticated CRUD, rollback and account-switching checks against a disposable database/staging project. No writes were made to the configured Supabase database during this review.

### Local engineering and database acceptance

- [ ] **F21 — remaining job types/operations:** implement safe reconciliation and batch IDP processors; exercise worker supervision and restart on the selected persistent host. Durable queue lifecycle and CSV/financial-summary processors passed isolated checks; reconciliation and batch IDP remain unregistered and fail closed.
- [ ] **F22/F40 — mutation acknowledgement:** make every existing mutation await server acknowledgement and ensure rejected/rolled-back writes are never shown as successful. Single-product creation now waits for server acknowledgement; order and settlement actions, bulk product writes and other mutation paths still need a route-by-route pass.
- [ ] **F33 — selected store identity:** pass an authenticated, owner-owned connection ID consistently through sync, credential, status and checkpoint operations. Current ambiguity rejection does not complete multi-store routing.
- [ ] **F39 — durable CRUD:** persist every existing domain/action transactionally with tenant scoping, including supplier payments, purchases, returns, claims, expenses, documents and complaints; include inventory and per-bill `paidAmount`.
- [ ] **Least-privilege database roles:** verify readiness and CRUD using the intended restricted server role and a separate restricted client role. Existing local checks used the configured PostgreSQL role.
- [ ] **Upgrade acceptance:** test migrations 13–19 against a sanitized populated prior-version database, including duplicate legacy identities, rollback/failure behavior and child ownership. Current clean-schema checks do not prove upgrade safety.
- [ ] **Authenticated browser matrix:** verify login/logout, account switching, stale/in-flight requests, failed writes and owner-scoped AI settings using synthetic authenticated accounts.

### Supabase and deployment access

- [ ] **F05 — effective RLS/grants:** verify actual `anon`, `authenticated` and server-role privileges/policies in staging. Read-only inspection of the configured Supabase project found RLS enabled on all 29 public tables and no direct `anon`/`authenticated` table grants; authenticated policy behavior and the restricted server role remain unverified.
- [ ] Verify hosted storage ownership, queue/process restart, multi-instance consistency, backup restore, TLS/egress/proxy behavior and redacted logging on the selected host.
- [ ] Run signed provider webhooks and marketplace sandbox syncs with approved credentials.

## Phase 3 — financial, ledger and inventory correctness

### Verification run — 15 October 2026

- [x] Focused Phase 3 persistence, financial-engine and integration suites: **47 passed, 0 failed** (`tests/phase3-persistence-ledger.test.mjs`, `tests/remediation-financials.test.mjs`, `tests/store-integration-phase3.test.mjs`). This verifies the tested local behavior and synthetic fixtures; it does not verify provider statements or production accounting mappings.
- [x] Workflow regression suite: **31 passed, 0 failed** (`tests/remediation-workflows.test.mjs`). The F51 repeated-restock guard passes for duplicate calls within one provider session, invalid/missing products stay pending, and inventory changes once.
- [ ] F51 remains open: the verified guard is in-memory; return edits/restock are not yet atomic and durably persisted or safe across concurrent requests/processes.
- [ ] F44 remains open: code inspection found approval still fabricates order/bill fields and posts locally (including fallback supplier/SKU/cost and a hard-coded `PAID` status). The tests above do not verify safe document approval.
- [ ] Real settlement, supplier-bill, return/refund and claim-recovery records were not available, so F29/F30/F45/F53 and accounting assumptions remain unverified.

### Local engineering

- [ ] **F29:** map connector charges, currencies, lifecycle state and catalog costs to source facts; do not invent missing fees or costs.
- [ ] **F30:** reconcile Amazon event identity, signed adjustments/refunds and actual bank or settlement statements.
- [ ] **F44:** replace fictional document approval with validated, idempotent server posting using real supplier, cost and payment data.
- [ ] **F45:** complete ledger tax, refund/revenue reversal, claim recovery and supplier-payment journal events.
- [ ] **F51:** make return edits and restock transitions atomic, durable and safe under concurrent/repeated requests. The repeated-restock guard is only a verified subcase.
- [ ] **F53:** reconcile every report, return detail and ledger calculation, including legacy return fees, tax and shipping; identify fee source events to prevent double charging.
- [ ] Persist per-bill `paidAmount` through durable purchase/payment CRUD. Reconcile legacy PARTIAL bills without an amount rather than assuming they are unpaid.
- [ ] Confirm accounting assumptions against representative records: delivered/returned revenue, separately recorded cash and tax, recoverable costs on sellable returns, and explicit treatment of estimates or unknown costs.

### Inputs needed

- [ ] Supply sanitized marketplace order/fee exports and settlement statements, especially Amazon financial events, for source identity, currency, refunds and payout reconciliation.
- [ ] Supply sanitized supplier bills and return/refund examples to confirm tax, shipping, refund and claim-recovery treatment. Keep credentials in the local environment/provider console; do not put secrets in this file.

## Phase 4 — connector and synchronization acceptance

### Local verification run — 15 October 2026

- [x] Connector behavior and Phase 4 store-integration suites: **36 passed, 0 failed** (`tests/remediation-connectors.test.mjs`, `tests/store-integration-phase4.test.mjs`). Fixture coverage includes Shopify same-origin pagination/token protection, Flipkart shipment paging and item preservation, repeated-cursor/250-page incomplete-run handling, separate order/finance checkpoints, OAuth binding/rotation, and connection-vault UI failure/reload behavior.
- [ ] These are local tests with mocked provider/database responses; no seller/shop account, live API permissions, provider callback, settlement, or restricted-role deployment was exercised.
- [ ] **F33 remains open:** current tests verify checkpoint guards, but do not establish consistent owner-owned selected-connection identity across every sync, credential, status and checkpoint operation.
- [ ] **F26/F28/F32/F34/F35/F37 external acceptance remains open:** the focused suites do not validate Flipkart seller-contract behavior, Shopify public-app GraphQL eligibility, restricted-role/restart checkpoints, real Orders/Finances/shipment permissions, or the registered HTTPS OAuth callback in staging.
- [ ] Large-dataset verification is limited to the 250-page incomplete-run guard; provider throttling and execution deadlines were not measured.

- [ ] **F26:** verify Flipkart cancellation filters, SELF/NORMAL lifecycle and retrieval limits using approved seller/partner access. Flipkart Advantage is outside the documented shipment endpoint.
- [ ] **F28:** verify Shopify against an approved shop and determine whether this is a new public app. If so, implement/test GraphQL order retrieval with required scopes and cursor handling; REST fixtures do not certify that path.
- [ ] **F32:** repeat checkpoint tests with the least-privilege app role and after an application-process restart.
- [ ] **F37:** configure the registered HTTPS Flipkart OAuth callback and verify a real authenticated callback, refresh and seller permissions; restart legacy OAuth flows created before migration 16.
- [ ] **F34/F35:** use an authenticated browser/provider account to exercise vault failures, reload, disconnect rejection, scope rejection, pagination, expired OAuth and actual Orders/Finances/shipment permissions.
- [ ] **F33:** finish selected-store routing across all sync and checkpoint operations (tracked under Phase 2 as the implementation item).
- [ ] Measure large datasets, provider throttling and execution deadlines. Current sync has a 250-page bound and reports incomplete work; it is not unlimited backfill or durable background orchestration.

## Phase 5 — recovery, imports, reports and acquisition

### Local verification run — 15 October 2026

- [x] Workflow and Phase 5 integration suites: **43 passed, 0 failed** (`tests/remediation-workflows.test.mjs`, `tests/store-integration-phase5.test.mjs`). Covered recovery conflict/rollback and scope guards, CSV validation/idempotency/audit, report scoping and aging, snapshot rejection, formula-safe CSV exports, and acquisition routing to real login.
- [x] Isolated PostgreSQL recovery acceptance is recorded in `PRODUCTION_REMEDIATION_TASKS.md`: transaction rollback/retry, stock restoration, tenant isolation and concurrent single-use recovery passed after migration 17. The migration was not applied to `marginflow_dev` or a deployment database.
- [ ] These results do not certify the restricted app role, process-restart behavior, authenticated browser workflows, account switching, or a disposable deployment; keep F47 deployment/browser acceptance open.
- [ ] No representative seller exports or verified merchant ownership mapping were available; real-file compatibility (F49), legacy unowned snapshot repair (F54), and live identity/Google provisioning (F57) remain pending.

- [ ] **F47 — deployment acceptance:** repeat archive/restore, stock conflict/retry, tenant isolation and single-use recovery using the restricted role, after process restart and in an authenticated browser with a migrated database.
- [ ] **F47 — workflow matrix:** exercise single/bulk deletion, cascades, recovery, account switching and in-flight edits; verify persistence after reload and that conflicts preserve newer edits.
- [ ] **F49 — real seller-file compatibility:** validate gross/unit price, quantity, line identity, tax, currency and cost-window semantics against sanitized representative exports from supported marketplaces. Settlement-only files must not be treated as sales; provider settlement ingestion needs separate verification.
- [ ] **F54 — legacy snapshot ownership:** recover backups without verified `ownerId` only with proven merchant ownership and reviewed repair mapping. Never auto-attribute unowned backups or mutate the original backup.
- [ ] **F57 — live acquisition:** verify signup/login/onboarding against the deployed identity database. For Google, configure a public OAuth client ID, allowed origins and matching server audience, then verify real token provisioning; a submitted name/email is not authentication.
- [ ] **Release browser gate:** on a disposable deployment, verify persistence/reload, downloads, formula-safe exports, date/channel filters, protected navigation and database grants/RLS.

Migration 17 was applied to an isolated acceptance database for local recovery tests; it was not applied to `marginflow_dev` or a deployment database. Apply migrations explicitly to the intended target. Older hard-deleted browser records require an authoritative backup. Legacy unowned records remain unowned. Recovery correctly rejects conflicting related edits/identities; reconcile those cases instead of overwriting. The seven-day recovery window is implemented, but scheduled physical purge/retention policy is not.

## Phase 6 — session lifecycle, dependencies and operations

### Verification run — 15 October 2026

- [x] Existing isolated PostgreSQL session and queue checks are documented in `phase6-postgres-check.json` and `phase6-queue-postgres-check.json`; both explicitly state that the database was `marginflow_phase2_acceptance_20261015`, synthetic rows were cleaned, and `marginflow_dev` was not touched. These are recorded results, not rerun in this pass.
- [ ] Focused release and Phase 6 store-integration suites: **19 passed, 11 failed** (`tests/remediation-release.test.mjs`, `tests/store-integration-phase6.test.mjs`). Failures show stale assertions for removed `signSessionToken`/`issueSessionToken` HMAC APIs and the old `marginflow_session` cookie wiring; current `src/lib/security/session.ts` verifies identity through Supabase `auth.getUser()` and resolves the MarginFlow account. Confirm the intended auth contract and update these assertions before treating F15 as locally accepted.
- [ ] Security/Phase 1 regression suites: **27 passed, 9 failed** (`tests/remediation-security.test.mjs`, `tests/phase1-security.test.mjs`), also including legacy HMAC-session and removed Google-route expectations.
- [ ] Full `npm test`: **235 passed, 20 failed** (255 total). Failures overlap the obsolete session/auth assertions above; fix or replace tests against the intended Supabase identity flow, then rerun.
- [ ] Fresh `npm run build`: compilation and TypeScript checks passed, then Next.js page-data collection failed with `Invariant: no direct app page entry found for /_not-found`.
- [ ] No staging host, restricted app role, independent deployed replica, Google credentials, or authenticated browser was exercised. Worker supervision, monitoring, backup recovery, retention scheduling and infrastructure resilience remain operational acceptance work.

- [ ] **F15 — restricted role and replicas:** validate session registration/revocation with the intended least-privilege role and independently configured deployed replicas. Core PostgreSQL and two-process restart behavior passed locally.
- [ ] **F15 — deployment configuration:** configure a stable random signing secret of at least 32 bytes (`SESSION_SECRET` or supported `ENCRYPTION_MASTER_KEY` fallback) and an authoritative database for every session check. Do not send secret values in chat.
- [ ] **F15/F57 — authenticated browser:** exercise password/Google sign-in, logout/retry, account switching, copied-token rejection and protected navigation in staging. Anonymous smoke tests do not certify authenticated behavior.
- [ ] **F60 — full dependency audit:** resolve the five remaining high full-tree audit entries (`braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`) through a compatible upstream fix or separately verified migration. The reviewed braces advisory lists no patched version: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Recheck before release; do not force an unverified major upgrade or suppress the audit. Production-only audit is currently clean.
- [ ] **F63 — worker operations:** host/supervise the persistent queue worker and verify restart/recovery; reconciliation and batch IDP remain unavailable until implemented.
- [ ] **F63 — infrastructure resilience:** verify storage ownership/persistence, database outage recovery, independent replicas, connection/runtime budgets, TLS/egress and proxy/cache settings on the chosen host.
- [ ] **F63 — monitoring and backups:** configure redacted logs, useful failure/latency alerts, retention and backup restore; agree recovery time/data-loss targets and verify restore in an isolated database without exposing secrets or merchant documents.
- [ ] **Retention operations:** choose a retention policy and implement scheduled cleanup for sessions and expired archives, including restored-backup behavior.
- [ ] **Authenticated end-to-end matrix:** cover imports/retries, reconciliation, recovery/conflicts/reload, account switching, exports, connector scopes/refresh and signed webhook replay across crashes using approved synthetic staging data/provider sandboxes.
