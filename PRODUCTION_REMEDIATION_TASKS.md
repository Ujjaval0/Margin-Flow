# MarginFlow production remediation task list

Created: 15 October 2026. Status: IN PROGRESS. This replaces neither the audit nor evidence from actual tests.

## Execution rules

- Work through phases in order. Within a phase, critical/high findings precede medium/low findings, except a prerequisite must be implemented first. On 15 October the user authorized deferring Phase 1's open items to pending.md and starting Phase 2, then explicitly starting Phase 3 while Phase 2 remained unfinished. Earlier open tasks are not considered complete.
- Each finding keeps its original audit ID. Checked means implemented AND its stated local verification passed; partial means more work remains. Never mark a phase complete while any task/test is skipped or unresolved.
- Preserve existing uncommitted work and UI/UX standards. No cosmetic redesign, new optional workflows, production-store calls or secret output.
- No production or local database mutation during implementation unless a disposable test target is explicitly identified. Schema changes are supplied as reviewed migrations; existing merchant data must not be reassigned automatically.
- Real API keys, Amazon/Meesho/Flipkart partner access, real store connection and production database deployment are deferred by the user. Implement and test everything possible locally; mark those external checks pending rather than simulate success.

## Phase 1: Critical access, data-leak and dependency fixes

Status: DEFERRED WITH OPEN ITEMS — see pending.md. Locally completed fixes remain checked; unfinished engineering and external verification remain open.

- [x] F01: CRITICAL: password login bypass for accounts without a password hash
- [x] F02: HIGH: public database health diagnostics disclose financial records
- [x] F03: HIGH: document downloads lack ownership authorization
- [x] F07: HIGH: anonymous job listing, creation, retrieval and cancellation
- [ ] F08: HIGH: anonymous server-funded AI/OCR processing
- [x] F09: HIGH: AI custom-provider URLs enable server-side request forgery
- [x] F10: HIGH: Shopify domain handling permits token exfiltration and non-Shopify requests
- [x] F11: HIGH: outbound DNS validation does not constrain the eventual fetch
- [ ] F12: HIGH: weak password hashing and no authentication throttling
- [x] F13: MEDIUM: Google audience verification is optional in production
- [x] F14: MEDIUM: server Gemini key can be sent to a different AI provider
- [ ] F16: MEDIUM: incomplete upload/parser resource controls
- [ ] F17: LOW: public error details disclose implementation
- [ ] F19: CRITICAL integrity defect: webhooks choose tenant from unsigned query data
- [x] F58: HIGH: vulnerable spreadsheet parser processes untrusted files
- [x] F59: HIGH priority, deployment-dependent: framework/image stack is behind security patches

Acceptance gate: Block unauthorized requests before processing; lock outbound destinations; stop critical credential/financial leaks. Regression tests use synthetic tenants, mocked providers and real route functions.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 2: Tenant isolation and durable persistence

Status: IN PROGRESS.

- [x] F04: HIGH: shared browser ledger leaks data between accounts — locally verified account switching, owner-labelled caches and empty authoritative responses; browser staging verification remains pending.
- [ ] F05: HIGH, deployment-dependent: RLS policies grant all authenticated users all business rows
- [x] F06: HIGH: OCR processing crosses tenant boundaries — OCR owner is required for catalog lookup and document insert; actual Phase 2 PostgreSQL test confirmed cross-owner catalog isolation and document/field rollback on a forced write error.
- [x] F18: MEDIUM: private artifacts can enter version control; browser secrets are shared — `/data/` is ignored; AI settings now use verified owner-scoped keys and discard the unowned legacy key.
- [x] F20: HIGH: webhook deduplication can lose retries and fails across replicas — real PostgreSQL receipt uniqueness, transaction rollback/retry, owner scoping and concurrent replay checks passed in the Phase 1 isolated database; signed provider and restart acceptance remains F19.
- [ ] F21: HIGH: generic webhooks and background workers can report simulated success — durable queue lifecycle implemented; CSV import and financial summary jobs now use real transactional processors, while reconciliation and batch IDP fail closed as unregistered. Generic webhook behavior and supervised worker-host acceptance remain open.
- [ ] F22: HIGH: rolled-back or failed writes are counted as successful imports
- [x] F23: HIGH: global display-ID uniqueness defeats tenant isolation keys — owner-scoped display IDs accepted across owners and duplicate same-owner IDs rejected on PostgreSQL after migration 15.
- [x] F24: HIGH: line items collapse by SKU — repeated SKU lines with distinct line IDs persist; duplicate order-line identity is rejected on PostgreSQL after migration 15.
- [x] F31: HIGH reliability defect: connection save/disconnect silently falls back to memory — all memory fallback branches removed; outage rejection locally verified. Provider revocation remains separate from local disconnect.
- [ ] F33: MEDIUM: multi-store accounts lack consistent connection identity
- [x] F38: MEDIUM: import audit trusts caller claims instead of durable source/result — upload route derives file hash/size and parsed counts from original server-read files and commits audit with persisted orders; caller-supplied summaries are ignored.
- [ ] F39: HIGH: most business mutations are browser-only
- [ ] F40: HIGH: optimistic mutations ignore HTTP rejection
- [x] F61: HIGH operational risk: setup omits migrations and API paths execute suppressed DDL — explicit clean bootstrap covers migrations 01–18 without demo seed; request-time schema readiness is read-only and passed on the clean Phase 2 database. Populated upgrade and least-privilege deployment checks remain pending.

Acceptance gate: Make tenant/connection ownership structural and all existing mutations transactional, acknowledged and recoverable. Verify schema, rollback, retry, account switching and restart behavior.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 3: Financial, ledger and inventory correctness

Status: IN PROGRESS — started at the user's explicit instruction; earlier-phase open work remains tracked.

- [ ] F29: HIGH: connector mappings invent charges, lose lifecycle state and lock zero costs
- [ ] F30: HIGH: Amazon financial events are mislabeled as reconciled settlements
- [x] F41: HIGH: dashboard estimates are reported as received cash — locally verified recorded cash/receivable separation; no default 75% payout is counted as received cash.
- [x] F42: HIGH: partial returns distort entire-order profit — shared line calculations bound returned units, reverse sellable cost and retain damaged cost; partial order status and same-SKU quantity allocation corrected.
- [x] F43: HIGH: Suppliers page can crash on unassigned imported products — optional supplier access guarded; actual view regression test passes.
- [ ] F44: HIGH: document approval posts fictional and duplicate accounting data
- [ ] F45: HIGH: balanced general ledger contains economically incorrect entries
- [x] F46: HIGH: purchase intake does not restock inventory — local intake updates stock once per bill; actual provider test passes. Durable inventory/payment posting remains tied to Phase 2 CRUD work.
- [x] F50: MEDIUM: partial supplier payments cannot settle the correct bill balance — recorded per-bill allocation and oldest-invoice-first behavior verified; legacy partial amounts require reconciliation.
- [ ] F51: MEDIUM: return edits and repeated restock corrupt inventory
- [ ] F53: MEDIUM: P&L labels do not match financial calculations
- [x] F56: MEDIUM: zero GST selection becomes 18% — actual modal tests verify 0% and fractional-tax precision.

Acceptance gate: Use source facts and exact lifecycle events; reconcile cash, profit, tax, inventory, supplier balances and ledger with deterministic fixtures.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 4: Store connector contracts and synchronization

Status: IN PROGRESS — local fixes and isolated PostgreSQL acceptance are verified; provider, browser, restricted-role and complete multi-store verification remain pending.

- [x] F25: HIGH: synchronization silently truncates records — local multi-page fixtures pass; incomplete/repeated/unsafe pagination fails before persistence or checkpoint advancement.
- [ ] F26: HIGH contract risk: Flipkart endpoint differs from reviewed official contract — shipment filter contract, lifecycle filters, page traversal and grouping implemented/tested; real partner/seller contract verification pending.
- [x] F27: HIGH: Amazon item failures manufacture incorrect financial lines — item pagination exhausts; HTTP/malformed/empty item failures reject the run with no fictional fallback or write.
- [ ] F28: MEDIUM: obsolete Shopify API version and unsupported assurance — pinned to 2026-10 with actual order-access verification. REST remains a legacy integration; new-public-app GraphQL eligibility and real-store compatibility are not certified.
- [ ] F32: MEDIUM: sync checkpoints are read from the wrong data and shared across streams — metadata-backed order/finance checkpoints and migration 16 are verified; isolated PostgreSQL checks passed for independent streams, cursor clearing, rollback/retry, tenant isolation and persistence through a fresh pool. Acceptance with the intended restricted app role and an application-process restart remains pending. Selected multi-store identity remains under F33.
- [x] F34: MEDIUM: connection UI ignores failed saves and cannot reuse vaulted secrets reliably — actual component tests verify rejected saves leave new connections inactive and reload verification uses the server vault; browser staging still pending.
- [x] F35: MEDIUM: connection verification can pass without usable API access — actual Orders/Finances resource access required; custom endpoints require a successful orders collection, not reachability alone. Real provider permissions remain an external check.
- [x] F36: MEDIUM: credentials are embedded in request URLs — WooCommerce uses Basic headers only; Flipkart self-access uses the documented Basic header, with no client secret in the URL.
- [ ] F37: MEDIUM: OAuth state is non-atomic and incompletely bound — durable atomic DELETE/RETURNING binds owner, marketplace, configured client and registered redirect; no memory fallback or staging credentials. Real database race/restart and browser callback checks pending.

Acceptance gate: Repair pagination, current provider contracts, connection verification, refresh/checkpoint behavior and credential handling. Use fixtures now; user supplies real seller credentials/partner access later.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 5: Imports, reports and existing workflow integrity

Status: IN PROGRESS — local fixes and isolated PostgreSQL archive/recovery acceptance are verified; restricted-role, restart, seller-file and browser acceptance remain pending in pending.md. Started at the user's explicit request while earlier phases remain open.

- [ ] F47: HIGH: recycle-bin recovery is simulated — demo records/timed success removed; durable owner-scoped archive/restore, cascades, stock conflicts, recovered canonical records and acknowledgement implemented. Actual route/persistence acceptance passed on isolated PostgreSQL for transaction rollback/retry, stock restoration, tenant isolation and concurrent single-use recovery. Restricted-role/process restart/browser acceptance and earlier Phase 2 inventory/CRUD dependencies remain open.
- [x] F48: MEDIUM: sync merge can update the wrong existing record — stable indexes, marketplace identities, separate receipt identities, canonical server IDs and acknowledged merges locally verified.
- [x] F49: MEDIUM: CSV import manufactures financial values and duplicates orders — missing/invalid source fields reject; zero amounts survive; dated costs, source-line grouping, conflicting-file rejection, idempotent upserts and atomic original-file audit locally verified. Real seller-file compatibility remains pending.
- [x] F52: MEDIUM: report scope and aging use inconsistent datasets/time — report tables/charts/exports share scope; current India business date and partially outstanding balances use recorded lifetime receipts/returns. Local calculation/view tests pass; accounting-policy/source reconciliation remains F53.
- [x] F54: MEDIUM: malformed snapshot imports can poison application state — full versioned, owner-bound domain validation precedes every setter; malformed, foreign, duplicate and oversized snapshots/caches reject. Legacy ownership/repair remains pending.
- [x] F55: MEDIUM: exported CSV is unsafe for spreadsheet formulas and escaping — dashboard, orders, returns and both report exports share tested formula neutralization, cell quoting and Blob download handling.
- [x] F57: MEDIUM: acquisition actions are local stubs — landing actions route to real login; dummy session and unrendered contact-success stub removed. Live identity/Google provisioning verification remains pending.

Acceptance gate: Repair recovery, merging, import validation, exports and existing acquisition actions. Preserve established layout/styles/modal standards.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 6: Session lifecycle, operational hardening and release gates

Status: IN PROGRESS — local session/release fixes and public browser smoke checks pass; migrations 18 and 19 have isolated acceptance evidence, while deployed-role/session resilience, real job processors, remaining build dependencies and infrastructure acceptance remain open in pending.md. Earlier incomplete phases remain open.

- [ ] F15: MEDIUM: logout does not revoke copied sessions — durable token-digest registration/revocation, unique login IDs, awaited verification throughout protected APIs/workspace navigation and retryable failed logout implemented. Actual handlers and isolated PostgreSQL registration/digest/revocation/account-deletion checks pass; intended-role, real process/replica restart and authenticated browser acceptance remain pending.
- [ ] F60: MEDIUM: other dependency advisories remain unresolved — unused potrace/Jimp chain removed; PostCSS, selector parser and source-map-js updated. Production audit reports 0; full audit reports 5 high build-tool advisories through unpatched braces. No force-upgrade or audit suppression; finding remains open.
- [x] F62: HIGH assurance gap: tests and prior reports overstate readiness — mirrored auth/tenant/rate-limit/math simulations replaced with actual module execution, remaining source checks labelled accurately, stale UI assertions repaired against the existing UI, all 247 tests pass together with none skipped. Current evidence explicitly separates isolated tests, anonymous browser checks and unverified production acceptance; historical completion claims are not release evidence.
- [ ] F63: MEDIUM assurance gap: production resilience and browser interactions are unverified — job APIs persist only types with registered processors and reject unsupported work; durable queue lifecycle plus CSV/report processing passed isolated PostgreSQL acceptance. Supervised worker hosting, reconciliation/IDP processors, shared quotas, authenticated browser workflows, monitoring/load/backup recovery and deployment checks remain open.

Acceptance gate: Verify session revocation, all dependency paths, complete behavioral tests, production build, controlled migrations, durability/monitoring/backup recovery and full UI/provider staging matrix.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Verified implementation and test register

This register consolidates completed work and passed checks previously repeated in `pending.md` and dated progress notes. A locally verified slice does not close a finding when the phase checklist above remains unchecked; outstanding acceptance and dependencies are tracked in [`pending.md`](./pending.md).

### Phase 1 — security and identity

- [x] Local behavioral security suite: `tests/remediation-security.test.mjs` passed **18/18**, using actual application modules with isolated dependencies. Coverage includes authentication boundaries, SSRF/provider URL handling, outbound request validation and public error behavior. It does not prove hosted provider signatures, roles or deployment behavior.
- [x] Isolated PostgreSQL webhook receipt checks: migration set applied to `marginflow_phase1_security_test_20261015`; verified unique receipts, first delivery, exact replay deduplication, conflicting-body rejection, failed-order rollback/retry, same external order identity across tenants, and concurrent duplicate delivery (one applied, one deduplicated). Evidence: [`phase1-local-postgres-check.json`](./phase1-local-postgres-check.json), [`phase1-local-postgres-webhook-check.json`](./phase1-local-postgres-webhook-check.json).
- [x] Session revocation filtering and selected schema-readiness checks passed on the isolated database. Synthetic fixtures were cleaned; append-only synthetic audit rows remain in that test-only database. `marginflow_dev` was not modified.

### Phase 2 — tenant isolation and durable persistence

- [x] Actual PostgreSQL OCR checks verified owner-scoped catalog matching and document/field persistence, plus rollback on forced field-write failure.
- [x] PostgreSQL tenant identity checks accepted the same display ID and external order identity for separate owners, rejected duplicates within an owner, preserved repeated-SKU order lines with distinct line IDs and rejected duplicate line identity.
- [x] Webhook receipt deduplication/retry and import audit provenance checks passed; audit hash, byte size and parsed counts are derived from the uploaded source rather than caller summaries.
- [x] Fresh-schema bootstrap/readiness checks covered migrations 01–05 and 08–18 without demo seed; actual read-only `ensureMarketplaceTables()` passed. Supabase-only migration 07 was reviewed but not applied locally.
- [x] Focused Phase 2/persistence/workflow suites passed **54/54** at the recorded checkpoint; production build/type checking passed with 53 static pages.
- [x] Private-file Git ignore and owner-scoped AI settings checks passed. The legacy unowned shared key is discarded after owner verification.
- [x] The Phase 2 isolated database checks used synthetic acceptance data; `marginflow_dev` was not changed. Detailed PostgreSQL evidence is linked above where a result file is available.

### Phase 3 — financial, ledger and inventory correctness

- [x] Behavioral tests verified recorded cash versus receivables, bounded partial-return quantity/cost effects, optional supplier handling, purchase intake restock-once behavior, per-bill partial payment allocation and 0%/fractional GST handling.
- [x] F51 repeated-restock subcase passed through the actual `PlatformProvider` harness: only positive integer quantities from pending-restock returns with a known SKU restock, and duplicate calls in one provider session change inventory once. Test: `tests/remediation-workflows.test.mjs`.
- [x] Focused financial, persistence/ledger, workflow and store-integration suites passed **77/77** after the restock guard; `npm run build` passed TypeScript and all 53 static pages.

### Phase 4 — connectors and synchronization

- [x] Fixture-based connector tests verified pagination failure behavior, Amazon item failure handling without fictional fallback, Flipkart shipment/cancellation filters and grouping, Shopify pinned-version cursor pagination and foreign-origin rejection, server-side credential use, resource-based connection verification and credentials excluded from URLs.
- [x] Isolated PostgreSQL checks verified independent order/finance checkpoints, cursor clearing, rollback/retry, tenant isolation, ambiguous connection rejection and persistence through a fresh pool. OAuth checks verified client/owner/redirect binding, expiry rejection and exactly one concurrent state consume. Evidence: [`phase4-postgres-check.json`](./phase4-postgres-check.json).
- [x] Connector and Phase 4 store integration suites passed **35/35** at the recorded checkpoint. Evidence: `tests/remediation-connectors.test.mjs` and `tests/store-integration-phase4.test.mjs`.

### Phase 5 — recovery, imports, reports and acquisition

- [x] Actual recycle-bin route and persistence modules passed isolated PostgreSQL checks for archive/restore, exact stock reversal, stale-stock conflict rollback and retry, cross-tenant rejection, concurrent single-use restore, replay rejection and seven-day expiry. Evidence: [`phase5-postgres-check.json`](./phase5-postgres-check.json).
- [x] Workflow and Phase 5 integration suites passed **42/42**, covering merge identity, CSV validation/idempotency/audit, report scope/aging, snapshot rejection, spreadsheet-safe exports and acquisition routing. Tests: `tests/remediation-workflows.test.mjs` and `tests/store-integration-phase5.test.mjs`.
- [x] Phase 5 production build/type checking passed with all 53 static pages. Full-suite status is recorded below using the latest run.

### Phase 6 — sessions, queue and release assurance

- [x] F15 actual session handlers and isolated PostgreSQL checks verified account existence, digest-only token storage, independent logins, fresh-pool/module persistence, registration in one Node process and validation/revocation in another, copied-token logout, account-deletion denial, retryable logout and malformed/unsigned/expired/unregistered token rejection. Evidence: [`phase6-postgres-check.json`](./phase6-postgres-check.json).
- [x] F21 queue migration/lifecycle passed isolated PostgreSQL checks for idempotent enqueue, owner-scoped read/cancel, atomic claims, retry/backoff/final failure, expired-lease recovery, cancellation safety, processor rollback and account-delete cascade. CSV order import and tenant-scoped financial-summary processors completed real transactional work. Evidence: [`phase6-queue-postgres-check.json`](./phase6-queue-postgres-check.json).
- [x] Focused current F21/security/release tests passed **34/34**. `npm run build` passed TypeScript and all 53 static pages. The previous checkpoint of 247/247 is historical; use the latest totals below for release decisions.
- [x] Dependency/CSS checks recorded removal of unused potrace/Jimp dependencies, direct build-tool updates, a clean production-only audit, and comparison of 9,986 CSS records. The full-tree advisory remains open and is listed in `pending.md`.
- [x] F62 assurance work replaced simulated behavior with actual module execution where recorded and repaired stale UI test assertions against the established UI. No visual redesign was made.

### Current workspace verification

- **Focused F21/security/release suites:** 34 passed, 0 failed.
- **Production build:** passed, including TypeScript and 53 static pages.
- **Full `npm test`:** 253 passed, 1 failed (254 total). The remaining UI analyst assertion expects `grid-cols-1 sm:grid-cols-3` in `marginflow-hero.tsx`; investigate/resolve before release. It is tracked as open in [`pending.md`](./pending.md).
- **External acceptance:** no live provider credentials, Google OAuth staging, Supabase role/RLS deployment, restricted production role or deployment-host operations were used for these local results.
