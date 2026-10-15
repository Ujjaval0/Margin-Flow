# Pending implementation and verification

Updated: 15 October 2026. The user has authorized Phase 6. Unchecked items below remain deferred; completed local verification is identified explicitly. Earlier incomplete phases remain open.

## Phase 1 — external verification

| Item | What remains | Reason / needed input | Acceptance check |
|---|---|---|---|
| F19 — webhook ownership and receipts | Real transaction/replay/isolation tests and signed provider deliveries | Disposable PostgreSQL test database with migrations through 14 applied; approved provider sandbox, webhook signing secret and connection-specific URL | Tenant A cannot target B; invalid signatures fail; duplicate/concurrent deliveries apply once; failure rolls back receipt and order; retry succeeds after restart |
| F03 — existing uploaded documents | Verified migration of shared-root legacy files | An authoritative document-to-merchant ownership mapping | Move only proven ownership; verify A cannot download B's file. Existing files must not be guessed, deleted or reassigned |
| F08/F12 — distributed quotas | Validate throttling across independent processes | Shared quota backend/ingress configuration and a disposable deployment target | Two replicas share account/IP/processing budgets; restart does not reset limits; unknown proxy headers cannot bypass controls |
| Live AI/store behavior | Provider authentication, permissions, timeouts, token expiry, webhook registration and receipt of real fixtures | User supplies/configures credentials and approved sandbox stores later | Run each provider's success/error/scope/retry matrix without production merchant data |

The local database is not assumed to be disposable. Do not run destructive setup, seed scripts or migrations against it merely to make a test pass. No production credentials are needed for isolated unit tests.

## Phase 1 — unfinished engineering (not blocked by API keys)

- [ ] F08/F12: implement shared quota enforcement and trusted client-address handling. Authentication and process-local budgets already exist; they do not prove distributed enforcement.
- [ ] F16: parser CPU/page/image-dimension isolation, worker deadlines and resource tests. Request/file byte bounds already exist. No provider credentials are needed to finish these controls.
- [ ] F17: finish reviewing public error paths for raw exceptions/provider bodies. Add behavioral tests ensuring secrets, SQL and stack paths never appear. This is local engineering work, not a database/API-key prerequisite.
- [ ] F19: apply/test the supplied receipt migration in an explicitly disposable database. Isolated owner-resolution/rollback tests pass, but they do not prove PostgreSQL concurrency or provider interoperability.

## Previously failing tests — resolved in Phase 6

- [x] `tests/ui-ux-analyst.test.mjs`: dashboard assertion now checks the established greeting/name/date markup instead of an obsolete hardcoded heading.
- [x] `tests/ui-ux-analyst.test.mjs`: landing assertion renders the actual route-comparison component and parses its desktop/tablet/mobile grid rules instead of expecting obsolete Tailwind class strings.

These two assertions failed before remediation. Both now pass without changing UI layout or styling and remain included in `npm test`. Final Phase 6 full suite: 247 passed, 0 failed/skipped/cancelled. Earlier checkpoint counts below are historical results.

## Phase 1 evidence already obtained

- Production build and type checking passed on Next.js 15.5.28.
- New behavioral security suite: 18 passed, 0 failed.
- Full suite at Phase 1 checkpoint: 158 tests, 156 passed, 2 failed, 0 skipped.
- Patched Next.js, sharp and SheetJS. The last install still reported 15 dependency advisories; remaining dependency triage belongs to Phase 6.

## Phase 2 and release checks requiring external state

- [ ] Exercise migrations against empty and populated disposable PostgreSQL databases; verify rollback, required roles, constraints, RLS and cross-tenant child references. Do not infer deployed isolation from SQL files alone.
- [ ] Verify actual Supabase roles/grants/policies if Supabase is used. Application-cookie authentication is not automatically a Supabase JWT.
- [ ] Verify durable storage, queue crash recovery and multi-instance consistency on the chosen deployment host.
- [ ] Run approved provider sandboxes, authenticated browser workflows, backup restore/load tests and deployment TLS/egress/logging checks before declaring production readiness.

See `PRODUCTION_REMEDIATION_TASKS.md` for the complete six-phase task list. Phase 1 is deferred with open items; it is not marked complete.

## Phase 2 checkpoint — additional pending verification

- [ ] Apply migrations through `15_tenant_document_and_identity.sql` on a disposable database; test owner-scoped uniqueness, duplicate-SKU line identity and rollback against actual PostgreSQL constraints.
- [ ] Verify the read-only schema readiness check and bounded connection/query timeouts using the intended database role. Runtime API requests no longer create or alter schema.
- [ ] Verify OCR document/field transactions against the real schema. Existing unowned records remain unowned; no blanket assignment to ACC-001 is made.
- [ ] Review/run the revised Supabase setup only if Supabase is selected. Direct business-table access is denied by default; approved tenant-aware policies for direct access remain to be implemented/tested where needed.
- [ ] Exercise a real authenticated browser through login, logout, account switching and stale/in-flight requests. Isolated tests execute the actual provider and verify an empty second account clears the first account's records.

Phase 2 still has local engineering work: complete transactional CRUD for all existing domains, remove simulated background processing, make connection identity explicit throughout imports/sync, validate import audit provenance, and finish acknowledgement/error handling for client mutations. These items are not blocked by missing API keys and are not declared complete.

## Phase 3 — still open after the first implementation pass

- [ ] F29: source-accurate connector charges, currency/lifecycle mapping and catalog cost resolution. Correcting engine calculations does not repair missing or fabricated source inputs.
- [ ] F30: Amazon event identity, signed adjustments/refunds and actual bank/statement settlement reconciliation.
- [ ] F44: replace fictional document approval with validated, idempotent server posting and real supplier/cost/payment data. The existing approval workflow is not certified by the new engine tests.
- [ ] F45: complete ledger tax, refund/revenue reversal, claim recovery and supplier-payment journal events. Cancelled/pending/shipped order recognition, discount handling and the invented fee split have been corrected; these are only part of this finding.
- [ ] F51: validate return edits, restock state changes and repeated restock atomically. Quantity-based profit corrections do not by themselves make inventory transitions safe.
- [ ] F53: complete reconciliation of every report/return detail/ledger calculation, including legacy return-fee logic and tax/shipping treatment. Business/order/marketplace/SKU calculations now share tested recognition/return facts; other projections still need review.
- [ ] Identify return fees by source event before combining return records with settlement deductions, so the same fee cannot be charged twice in profitability projections.
- [ ] Preserve and migrate new per-bill `paidAmount` through durable purchase/payment CRUD before cross-device production use. Legacy PARTIAL bills without an amount must be reconciled rather than assumed unpaid.
- [ ] Verify accounting assumptions against representative real records: delivered/returned states recognise goods revenue; cash is recorded separately; selling prices exclude separately recorded tax; sellable returns reverse recoverable unit costs. Estimates remain estimates, and unrecorded costs are still unknown rather than proven zero.

No live credentials or database migrations were used for this Phase 3 pass. Earlier pending items remain open.

## Phase 5 — external inputs and deployment verification

| Item | What remains | Required input / access | Acceptance check |
|---|---|---|---|
| F47 — durable deletion/recovery | Apply and exercise `17_recycle_bin.sql` after migrations 01–16; verify real transaction rollback, row locks, repeat recovery, expiry, restart and tenant isolation | Explicitly disposable PostgreSQL target and the intended server database role; deployment approval later | Archive and relational visibility/stock changes commit together; failed recovery leaves the archive available; concurrent/repeated recovery changes stock once; A cannot list or restore B's records |
| F47 — browser and restart matrix | Verify existing single/bulk delete buttons, cascades, recoveries, account switching and in-flight edits against the migrated database | Authenticated disposable staging workspace with representative synthetic records | No success on rejected writes; records and inventory survive recovery and reload; conflicting newer edits are preserved and require reconciliation |
| F49 — real seller export compatibility | Validate exact gross/unit-price, quantity, line identity, tax, currency and cost-window semantics against real export formats | Sanitized representative Amazon/Flipkart/Meesho/Myntra/Shopify/WooCommerce order files and, separately, settlement statements | Repeated imports preserve one order per marketplace/reference and separate source lines; source totals reconcile. Payout-only settlement files currently reject as sales rather than manufacture prices; provider-specific settlement ingestion remains open where not already implemented |
| F54 — legacy snapshot ownership | Recover old backups that have no verified `ownerId`, or fail the new complete-domain validation | Proven merchant ownership and a reviewed mapping/repair of invalid or missing fields | No automatic attribution of unowned backups; repaired snapshot validates in full before any state changes. Original backups/caches are left untouched |
| F57 — live account acquisition | Verify signup/login/onboarding against the deployed identity database; complete Google browser-token provisioning separately | Approved staging account/database; for Google, a configured public OAuth client ID, allowed origins and matching server audience | Landing actions reach `/login`; a genuine server session is required before onboarding/dashboard. The existing Google button cannot authenticate by submitting a name/email alone |
| Release gate | Run the migrated application in the browser and then verify on the chosen host | Disposable deployment and later explicit production deployment authorization | Verify persistence/reload, downloads, formula-safe exports, date/channel filters, protected navigation and the intended database role's grants/RLS |

No API key is needed for the isolated Phase 5 tests. No existing database was treated as disposable, and migration 17 was not applied. The application readiness check now requires migration 17; deploy it explicitly before using these routes.

Recovery stores original records and related changes, hides relational rows transactionally and restores recovered browser-origin returns/claims/expenses into canonical tables. This does not finish Phase 2's unrelated all-domain create/edit/payment persistence or Phase 3's return-edit/restock correctness. Older hard-deleted browser records cannot be reconstructed without an authoritative backup. Legacy unowned database expenses remain unowned.

If a legacy/manual browser inventory balance differs from the database, deletion/recovery rejects rather than overwriting the authoritative stock value. Completing the earlier Phase 2 transactional inventory/CRUD work and reconciling those balances is still required. Snapshot import now validates safely but remains a local restore; durable whole-snapshot database posting remains under F39, and an authoritative refresh can replace local core collections.

Archive recovery is deliberately refused when a related record changed or an active business identity would collide. Such cases require reconciliation, not a silent overwrite. Archived data becomes unavailable for recovery after seven days; automated physical data retention/purge policy remains a deployment/Phase 6 decision and is not claimed to be implemented.

At the Phase 5 checkpoint, the two pre-existing `ui-ux-analyst.test.mjs` failures were still open; Phase 6 repaired the assertions against the existing UI. Parser CPU/decompression isolation, distributed quotas, complete source financial reconciliation and the earlier pending items above remain open under their original phases.

Phase 3 checkpoint verification: production build/type checking passed; 16 financial behavioral tests passed. Final full suite: 205 tests, 203 passed, 2 failed, none skipped. The remaining failures are the two UI assertions already listed above. Phase 3 remains in progress; live database/provider and durable inventory/payment checks remain pending.


## Phase 4 — external verification and integration limits

The unchecked Phase 4 findings in PRODUCTION_REMEDIATION_TASKS.md are F26, F28, F32 and F37. Their remaining work and the additional acceptance checks are tracked below; Phase 4 remains incomplete.

- [ ] **F32 — independent sync checkpoints:** Apply migration 16 after migration 15 on an explicitly identified disposable PostgreSQL target; verify checkpoint stream separation, cursor clearing, rollback/retry, tenant isolation and restart behavior against real PostgreSQL. No existing database was changed.
- [ ] **F37 — atomic, bound OAuth state:** Configure server-side Flipkart app credentials and the registered HTTPS callback URI; verify OAuth initiation/callback, authenticated-session/client/redirect binding, expiry, replay rejection, concurrent single-use consumption and restart behavior against real PostgreSQL and a browser. Verify refresh rotation and API permissions in the approved seller environment. Legacy in-flight OAuth states must be restarted.
- [ ] **F26 — Flipkart provider contract:** Verify shipment pagination, cancellation filters, SELF/NORMAL lifecycle coverage, sibling order lines and the documented retrieval cap with real seller/partner access. Flipkart Advantage coverage is outside this documented shipment endpoint; do not claim all seller orders are covered.
- [ ] **F28 — Shopify compatibility and support assurance:** Verify Shopify 2026-10 against an approved store and confirm the intended app's eligibility for the legacy REST integration. Complete and verify the GraphQL path where required for new public apps; REST fixtures do not certify that path or production compatibility.
- [ ] **F34/F35 acceptance checks:** Exercise the existing connection component in a real browser: vault failure, reload secret reuse, rejected disconnect, scope rejection, multi-page sync and expired OAuth callbacks. Verify actual Orders/Finances/shipment permissions with approved provider credentials. Local implementation tests pass; browser staging and live-provider proof remain pending.
- [ ] Complete selected multi-store routing under F33. Amazon/Flipkart ambiguous selection rejects; checkpoint updates do not bulk-update multiple active connections. This does not claim complete multi-store support.
- [ ] Check large datasets and real throttling/runtime budgets. Sync drains up to 250 pages and fails explicitly when incomplete; it is not a durable background job or unlimited backfill. Custom cursor-only APIs need an explicitly supported next-URL/Link contract.

Phase 4 local evidence: 22/22 new connector tests pass; full suite 203/205 pass with the same 2 pre-existing UI source-string failures; production build passes. F29/F30 financial-source accuracy and settlement reconciliation remain open in Phase 3. Full Phase 4 completion is not claimed.

Latest Phase 5 local verification: production build/TypeScript PASS; 29/29 new workflow tests PASS; full suite 234 tests, 232 PASS, the two existing UI assertions FAIL, 0 skipped/cancelled. These checks do not replace the external acceptance work listed above.

## Phase 6 — session deployment and production acceptance

| Item | What remains | Required input / access | Acceptance check |
|---|---|---|---|
| F15 — durable session registry | Apply `18_auth_sessions.sql` after migrations 01–17; validate privileges/RLS and actual SQL execution | Explicitly identified disposable PostgreSQL target and intended server role; production deployment approval later | Issue only after registration commits; copied cookie/Bearer tokens fail after logout, including another process and after restart; separate logins/tenants remain valid; deleted accounts and registry outages deny access |
| F15 — deployment configuration | Configure one stable, randomly generated signing secret of at least 32 bytes, shared by all replicas; use an authoritative database for every session check | Hosting secret configuration: `SESSION_SECRET` (or the existing `ENCRYPTION_MASTER_KEY` fallback); no key values need to be sent in chat | Reject absent/short production secrets; no stale read replica or cached active-session result can accept a revoked token. Old stateless tokens lack the new login ID/registry record and require fresh sign-in |
| F15/F57 — authenticated browser matrix | Exercise signup/password/Google login, logout/retry, account switching, copied-session rejection and protected navigation after deployment | Disposable staging database/accounts; Google OAuth client ID, allowed origins and matching audience for the Google path | No cookie or successful login when session persistence fails; failed revocation remains retryable; no account data leaks through reload/back/in-flight requests. Anonymous navigation checks do not certify authenticated behavior |
| F63 — infrastructure resilience | Verify storage persistence/ownership, database outage/recovery, independent replicas, connection/runtime budgets, TLS/egress and proxy/cache settings | Chosen deployment host, intended database/storage roles and disposable staging deployment | Controlled failure/restart/load tests preserve acknowledged data, fail explicitly on rejected writes, keep sensitive responses private and maintain tenant boundaries |
| F63 — monitoring and recovery | Configure redacted operational logs, useful failure/latency alerts, backup retention and a tested restore procedure | Hosting/logging/backup access; agreed recovery time/data-loss targets and retention policy | Restore a backup into an isolated database, reconcile records/receipts/archives, verify private documents and prove alerts fire without disclosing tokens, provider secrets or merchant documents |
| Session/archive retention | Choose and implement scheduled cleanup after the required audit/retention period | Agreed retention policy and scheduler/host ownership | Expired/revoked sessions never authorize; expired archives cannot recover. Physical purge, cleanup scheduling and restored-backup handling are not implemented by migrations 17/18 |

Migration 18 is supplied and included in bootstrap/readiness checks; it has **not** been applied to any database. RLS is enabled with no public grants. The intended server role must be explicitly provisioned and verified; do not enable broad direct-client access to make session queries work. No existing database is assumed disposable.

### F60 — remaining dependency work

- [ ] Resolve the five high full-tree audit entries (`braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`). They trace to the Tailwind 3 build chain's braces advisory, for which the reviewed advisory lists no patched version: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). A compatible upstream fix or a separately verified major Tailwind migration remains engineering work, not an API-key blocker. Do not force a major migration or suppress the audit to declare completion.
- [ ] Recheck the dependency tree/advisories before release and review vendor-distributed packages separately. The current `npm audit --omit=dev` reports zero advisories; it is not proof that every distributed artifact is vulnerability-free. Tailwind currently scans repository-controlled `./src/**/*.{js,ts,jsx,tsx,mdx}`; this limits the observed build exposure but does not resolve the advisory.

Removed the unused potrace/Jimp dependency chain and updated PostCSS to 8.5.30, postcss-selector-parser to 7.1.6 and source-map-js to 1.2.2. Full audit fell from 15 (7 high/8 moderate) to 5 high; production audit is 0. `npm ls --all` succeeds. All 9,986 compiled selector/declaration/enclosing-rule records match the saved pre-update CSS records; this does not replace authenticated visual acceptance.

### F63 — unfinished engineering and release limits

- [ ] F21: implement actual durable job storage, workers, idempotent processors, ownership, retry/backoff, cancellation and crash recovery. Production job APIs now return 503 rather than report simulated success. Setting `REDIS_URL` alone does not create these workers. This is engineering work, not merely missing Redis credentials.
- [ ] Finish shared quotas/trusted proxy handling (F08/F12), parser resource isolation (F16), remaining public error review (F17), transactional domain CRUD/inventory (F39/F40), selected-store routing (F33) and the earlier financial/provider findings. Those original tasks remain open; Phase 6 does not certify them.
- [ ] Run the authenticated browser/provider matrix with representative synthetic records: import failure/retry, reconciliation, recovery/conflicts/reload, account switching, exports, modal dismissal, connector scopes/refresh and signed webhook replay across crashes. Approved disposable data and provider sandboxes are required for external checks; local implementation work above does not require live keys.

Phase 6 local evidence: `phase6-test-output.log` records 247/247 passed, none skipped/cancelled; 13 new release tests execute actual session/logout/auth/workspace/queue modules with isolated adapters. `phase6-build-output.log` records a successful build, TypeScript and all 53 static pages. Production/full audits are recorded separately in `phase6-audit-production.json` and `phase6-audit-after.json`; `phase6-css-comparison.json` records the CSS comparison.

The built app was tested in the browser on a separate local origin: the existing landing action opened `/login`, Sign In switched the existing form, and anonymous `/dashboard` navigation returned to `/login`. Landing/login fit the default desktop viewport and a 390px mobile override without horizontal document overflow; no console warnings/errors were observed in this limited session. Anonymous HTTP checks additionally verified `/` and `/login` return 200, `/dashboard` and `/orders` redirect 307 to `/login`, and `/api/auth/me` / `/api/jobs` return 401 (`phase6-http-smoke.json`). No credentials were entered, database routes exercised, provider calls made or migrations executed. Real multi-process/PostgreSQL/restart resilience and full authenticated browser coverage remain unverified. Phase 6 remains IN PROGRESS.
