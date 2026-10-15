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
- [ ] F06: HIGH: OCR processing crosses tenant boundaries
- [ ] F18: MEDIUM: private artifacts can enter version control; browser secrets are shared
- [ ] F20: HIGH: webhook deduplication can lose retries and fails across replicas
- [ ] F21: HIGH: generic webhooks and background workers report simulated success
- [ ] F22: HIGH: rolled-back or failed writes are counted as successful imports
- [ ] F23: HIGH: global display-ID uniqueness defeats tenant isolation keys
- [ ] F24: HIGH: line items collapse by SKU
- [x] F31: HIGH reliability defect: connection save/disconnect silently falls back to memory — all memory fallback branches removed; outage rejection locally verified. Provider revocation remains separate from local disconnect.
- [ ] F33: MEDIUM: multi-store accounts lack consistent connection identity
- [ ] F38: MEDIUM: import audit trusts caller claims instead of durable source/result
- [ ] F39: HIGH: most business mutations are browser-only
- [ ] F40: HIGH: optimistic mutations ignore HTTP rejection
- [ ] F61: HIGH operational risk: setup omits migrations and API paths execute suppressed DDL

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

Status: IN PROGRESS — local fixes implemented; provider, browser and disposable-PostgreSQL verification remain pending.

- [x] F25: HIGH: synchronization silently truncates records — local multi-page fixtures pass; incomplete/repeated/unsafe pagination fails before persistence or checkpoint advancement.
- [ ] F26: HIGH contract risk: Flipkart endpoint differs from reviewed official contract — shipment filter contract, lifecycle filters, page traversal and grouping implemented/tested; real partner/seller contract verification pending.
- [x] F27: HIGH: Amazon item failures manufacture incorrect financial lines — item pagination exhausts; HTTP/malformed/empty item failures reject the run with no fictional fallback or write.
- [ ] F28: MEDIUM: obsolete Shopify API version and unsupported assurance — pinned to 2026-10 with actual order-access verification. REST remains a legacy integration; new-public-app GraphQL eligibility and real-store compatibility are not certified.
- [ ] F32: MEDIUM: sync checkpoints are read from the wrong data and shared across streams — metadata-backed order/finance checkpoints implemented; migration 16 and real PostgreSQL isolation/restart tests pending. Selected multi-store identity remains under F33.
- [x] F34: MEDIUM: connection UI ignores failed saves and cannot reuse vaulted secrets reliably — actual component tests verify rejected saves leave new connections inactive and reload verification uses the server vault; browser staging still pending.
- [x] F35: MEDIUM: connection verification can pass without usable API access — actual Orders/Finances resource access required; custom endpoints require a successful orders collection, not reachability alone. Real provider permissions remain an external check.
- [x] F36: MEDIUM: credentials are embedded in request URLs — WooCommerce uses Basic headers only; Flipkart self-access uses the documented Basic header, with no client secret in the URL.
- [ ] F37: MEDIUM: OAuth state is non-atomic and incompletely bound — durable atomic DELETE/RETURNING binds owner, marketplace, configured client and registered redirect; no memory fallback or staging credentials. Real database race/restart and browser callback checks pending.

Acceptance gate: Repair pagination, current provider contracts, connection verification, refresh/checkpoint behavior and credential handling. Use fixtures now; user supplies real seller credentials/partner access later.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 5: Imports, reports and existing workflow integrity

Status: IN PROGRESS — local fixes implemented; real database, provider-file and browser acceptance checks remain pending in pending.md. Started at the user's explicit request while earlier phases remain open.

- [ ] F47: HIGH: recycle-bin recovery is simulated — demo records/timed success removed; durable owner-scoped archive/restore, cascades, stock conflicts, recovered canonical records and acknowledgement implemented and locally tested. Migration 17, real SQL/restart/concurrency/browser tests and earlier Phase 2 inventory/CRUD dependencies remain open.
- [x] F48: MEDIUM: sync merge can update the wrong existing record — stable indexes, marketplace identities, separate receipt identities, canonical server IDs and acknowledged merges locally verified.
- [x] F49: MEDIUM: CSV import manufactures financial values and duplicates orders — missing/invalid source fields reject; zero amounts survive; dated costs, source-line grouping, conflicting-file rejection, idempotent upserts and atomic original-file audit locally verified. Real seller-file compatibility remains pending.
- [x] F52: MEDIUM: report scope and aging use inconsistent datasets/time — report tables/charts/exports share scope; current India business date and partially outstanding balances use recorded lifetime receipts/returns. Local calculation/view tests pass; accounting-policy/source reconciliation remains F53.
- [x] F54: MEDIUM: malformed snapshot imports can poison application state — full versioned, owner-bound domain validation precedes every setter; malformed, foreign, duplicate and oversized snapshots/caches reject. Legacy ownership/repair remains pending.
- [x] F55: MEDIUM: exported CSV is unsafe for spreadsheet formulas and escaping — dashboard, orders, returns and both report exports share tested formula neutralization, cell quoting and Blob download handling.
- [x] F57: MEDIUM: acquisition actions are local stubs — landing actions route to real login; dummy session and unrendered contact-success stub removed. Live identity/Google provisioning verification remains pending.

Acceptance gate: Repair recovery, merging, import validation, exports and existing acquisition actions. Preserve established layout/styles/modal standards.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Phase 6: Session lifecycle, operational hardening and release gates

Status: IN PROGRESS — local session/release fixes and public browser smoke checks pass; migration 18, real SQL/session resilience, remaining build dependencies and infrastructure acceptance remain open in pending.md. Earlier incomplete phases remain open.

- [ ] F15: MEDIUM: logout does not revoke copied sessions — durable token-digest registration/revocation, unique login IDs, awaited verification throughout protected APIs/workspace navigation and retryable failed logout implemented. Actual handlers pass isolated behavioral tests; migration 18 and real PostgreSQL/multi-process/restart acceptance remain pending.
- [ ] F60: MEDIUM: other dependency advisories remain unresolved — unused potrace/Jimp chain removed; PostCSS, selector parser and source-map-js updated. Production audit reports 0; full audit reports 5 high build-tool advisories through unpatched braces. No force-upgrade or audit suppression; finding remains open.
- [x] F62: HIGH assurance gap: tests and prior reports overstate readiness — mirrored auth/tenant/rate-limit/math simulations replaced with actual module execution, remaining source checks labelled accurately, stale UI assertions repaired against the existing UI, all 247 tests pass together with none skipped. Current evidence explicitly separates isolated tests, anonymous browser checks and unverified production acceptance; historical completion claims are not release evidence.
- [ ] F63: MEDIUM assurance gap: production resilience and browser interactions are unverified — simulated jobs now reject production operations with 503 instead of claiming completion; public desktop/mobile navigation smoke checks pass. Durable workers, shared quotas, authenticated browser workflows, monitoring/load/backup recovery and deployment checks remain open.

Acceptance gate: Verify session revocation, all dependency paths, complete behavioral tests, production build, controlled migrations, durability/monitoring/backup recovery and full UI/provider staging matrix.

Required before closing: meaningful regression checks for the changed behavior, TypeScript, affected tests, production build, and recorded remaining limitations. A failing test is repaired or remains explicitly open; it is never hidden by narrowing the test command.

## Verification register

- [x] Behavioral tests load actual application TypeScript and isolate external side effects; source-wiring tests are identified separately and do not prove real SQL/provider behavior.
- [x] All previously discovered test failures triaged; stale test assertions repaired against the established UI without changing its layout or styling.
- [x] All application test suites run together, with no skipped security/integration tests: 247/247 pass at the Phase 6 checkpoint.
- [x] npm run build completes successfully after final application edits, including TypeScript and all 53 static-page generation steps.
- [ ] Live provider contracts and credentials checked later in approved sandboxes (EXTERNAL/PENDING).
- [ ] Migrations/RLS tested on disposable real PostgreSQL, then explicitly deployed later (EXTERNAL/PENDING until target available).
- [ ] Production monitoring, load, backup restore, TLS/egress and multi-instance checks (EXTERNAL/PENDING).

## Progress log

- Baseline: audit has 63 findings/gaps; build and TypeScript passed, executed suites had 130 passes and 10 failures; no live provider proof.
- Implementation started with Phase 1. All unchecked items remain open.


## Phase 1 implementation checkpoint — 15 October 2026

Implemented and locally exercised: missing-password-hash rejection; async versioned PBKDF2-SHA512 at 220,000 iterations with legacy verification/upgrade; mandatory Google audience; minimal health response; merchant-owned document directories; authenticated owner-scoped jobs; AI authentication and process-level budgets; bounded JSON/multipart reads; provider-specific key selection; pinned outbound DNS with redirect rejection; strict Shopify domains; connection-bound webhook URLs and atomic receipt transactions; failure propagation instead of fake imported counts.

Patched dependencies: Next.js 15.5.28, sharp 0.35.5, SheetJS 0.20.3 from the vendor distribution. Installer reports 15 remaining dependency advisories (7 high, 8 moderate); F60 remains open. No automatic force-fix was used.

Phase 1 remains IN PROGRESS. F08/F12 are partial: authentication and bounded process-local throttling are implemented, but shared multi-instance quotas still need Phase 2/6 infrastructure. F16 is partial: request/file byte limits are implemented; parser CPU/page/pixel isolation remains. F17 is partial: health/copilot/auth/webhook generic errors are safer; remaining public error paths still need review. F19 has implementation and isolated owner tests, but real database/provider verification is pending. These tasks stay unchecked.

Prerequisites introduced without declaring Phase 2 complete: failed persistence now rejects, generic webhooks persist synchronously, receipt/ledger commit together, and server-generated webhook routing capabilities are exposed only through the authenticated connection metadata. Connection-save calls now await HTTP acknowledgement. Existing UI styling/layout was not changed.

Operational compatibility: legacy shared-root documents are intentionally not reassigned or deleted; an ownership-verified migration is required. Existing connections must be saved again to receive a server-generated connection-specific webhook URL. Configure providers with that URL; the old bare URL and user_id routing are rejected. database/14_webhook_receipts.sql must be applied after earlier connection/tenant migrations before accepting webhook events. No database migrations or store calls were executed.

Test infrastructure: npm test now includes every test suite. Legacy TypeScript unit imports run through the isolated application loader with database access mocked, and obsolete assertions were updated for tenant conflict keys, stronger passwords and transactional webhook ingestion. The existing visual title/grid assertions remain open; no UI was changed to satisfy brittle source-string checks.

Password work-factor reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Verified checkpoint

- Final production build: PASS on Next.js 15.5.28; type checking and all 52 static-page generation steps completed.
- New behavioral security suite: 18/18 PASS, exercising actual handlers/modules with isolated dependencies.
- Full npm test after repairs: 158 tests, 156 PASS, 2 FAIL, 0 skipped. Remaining failures are the pre-existing dashboard hardcoded-title and landing route-comparison grid-string assertions in ui-ux-analyst.test.mjs. They remain visible; existing UI was preserved.
- Phase 1 has 11 locally verified completed audit items, with 5 partial/open items. Phases 2–6 remain pending; preliminary dependencies implemented in this pass do not close those phases.
- No live stores were connected, no real credentials were requested, and no existing database records or document files were migrated.

## Phase 2 implementation checkpoint — 15 October 2026

Per the user's instruction, Phase 1's unfinished work and external verification are carried in pending.md; Phase 2 has started, not completed.

Implemented in this pass:

- F04: production ledger arrays start empty; the server session selects an owner-labelled, tenant-specific cache. Account changes and authentication failures clear financial state; empty server datasets replace stale rows. Login triggers revalidation, and generation checks prevent older refreshes from overwriting newer ones. Legacy unowned browser snapshots are not loaded or deleted.
- F06 (implementation; database verification pending): OCR requires the verified owner, scopes catalog queries, stores document ownership, and commits document/field records in one transaction. Persistence errors now fail the upload instead of claiming a staged record was saved.
- F22/F40 (partial): core reads no longer return successful empty results during outages; catalog batches and order batches use transactions, and settlement lookups include marketplace. Remaining domain mutation acknowledgement and full settlement-batch atomicity are still open.
- F23/F24 (implementation; migration verification pending): migration 15 supplies per-tenant display-ID uniqueness and per-order line identity instead of SKU uniqueness. Persistence preserves repeated-SKU lines, immutable costs and removes deleted source lines. Duplicate/legacy-data migration checks remain pending on a disposable database.
- F31: memory vault fallback was removed for all environments; save/disconnect/status/audit failures propagate. Credential lookup refuses ambiguous multiple stores. Complete selected-connection routing remains open under F33.
- F05/F61 (partial): removed runtime DDL, added bounded database pool/query timeouts and production configuration guards, supplied an explicit bootstrap through migration 15 without demo seed, removed blanket Supabase business policies/grants, and stopped assigning unowned legacy rows to ACC-001. Direct Supabase business access stays denied until explicit ownership policies are validated. These SQL changes have not been applied to any database.

Verification:

- Production build and type checking: PASS; all 52 static-page generation steps completed.
- Focused behavioral suites: 27/27 PASS (18 security + 9 persistence/tenant tests).
- Full npm test: 167 tests; 165 PASS, 2 FAIL, 0 skipped. Remaining failures are the same existing dashboard-title and landing grid-string assertions, listed in pending.md.
- Database/provider/browser staging checks remain pending; unit tests use synthetic data and isolated adapters, including the actual PlatformProvider and OCR/persistence functions.

Phase 2 remaining engineering includes F18 credential/cache handling, durable real job processors (F21), all-domain CRUD (F39), explicit connection identity (F33), import provenance (F38), full client acknowledgement/error handling (F40), and complete database ownership/constraint verification. No whole-phase completion is claimed.

## Phase 3 implementation checkpoint — 15 October 2026

Phase 3 has started and remains IN PROGRESS. Earlier incomplete phases remain open in pending.md.

- Financial calculations now share bounded line-level facts across business, order, marketplace and SKU projections. Only recorded settlement amounts count as received cash; unpaid revenue remains an estimated receivable. Pending, confirmed, shipped and cancelled orders do not recognise goods revenue or COGS.
- Partial returns reverse the returned share of discounted revenue and recoverable sellable cost. Damaged units retain their cost. Duplicate records and repeated-SKU lines cannot apply the same returned quantity repeatedly. Source return line identity and all report/ledger projections still require further work.
- Purchase intake adds catalog stock once per bill locally. Supplier payments retain cumulative per-bill paid amounts and allocate against remaining balances oldest-first. This does not close durable server posting or inventory transaction requirements.
- The Suppliers view tolerates an unassigned supplier. Purchase entry preserves zero GST and rounds fractional tax to cents. No visual styling/layout changes were made.
- Ledger changes gate order recognition, subtract actual discounts and replace the invented commission/logistics split with recorded deduction categories. Tax, refund/revenue reversal, claim recovery and purchase-payment events remain open under F45.

Remaining Phase 3 engineering includes source mapping/cost completeness (F29), Amazon financial event reconciliation (F30), safe document approval posting (F44), the remaining ledger events (F45), atomic return edit/restock transitions (F51), and complete report/detail reconciliation (F53). Estimates and missing cost data are not proof of observed costs. Return fees already present in settlement deductions also need explicit source identity to prevent duplicate expense recognition. No live credentials were used, and no database migrations were executed in this pass.

Verification at this checkpoint:

- Final production build: PASS, including type checking and all 52 static-page generation steps.
- Financial behavioral regression suite: 16/16 PASS, including actual provider purchase intake, Suppliers view rendering and purchase-modal GST calculations with isolated dependencies.
- Final full npm test: 205 tests, 203 PASS, 2 FAIL, 0 skipped. The remaining failures are the existing dashboard hardcoded-title and landing route-comparison grid-string assertions. The TypeScript test passes in the final run. Earlier intermediate Shopify/schema assertions were rechecked, and the stale migration-15 expectation was updated to the current migration-16 readiness requirement.
- Whitespace/diff validation for the touched Phase 3 files: PASS. Tests use synthetic records and mocked external adapters; these results do not prove real database durability, provider interoperability or production readiness.


## Phase 4 implementation checkpoint — 15 October 2026

Implemented within the existing connector workflows:

- Amazon Orders, Amazon order items, Amazon Finances, Shopify Link headers, WooCommerce numbered pages and Flipkart shipment nextPageUrl are drained before business persistence. Custom APIs accept same-endpoint next URLs/Link headers and reject cursor-only incomplete responses. Pagination loops, foreign destinations, malformed collections and the 250-page ceiling fail explicitly; no partial run reports success. Existing default date windows remain; this is not an unlimited historical backfill.
- Amazon no longer invents a financial item when item retrieval fails, or a random order ID when the source omits identity. Flipkart uses the documented shipment endpoint, 20-record pages, separate lifecycle/shipment filters, and groups sibling source lines before writing. Flipkart refresh tokens and expiry are saved before the new access token is used.
- Order and finance watermarks live in connection metadata, not decrypted credentials. Only an exhausted, persisted full run advances the stream watermark, using the run start time. Caller-supplied Amazon continuations and single-order finance queries cannot advance a global watermark. Completed cursors are cleared. Ambiguous Amazon/Flipkart stores reject; complete multi-store routing is still F33.
- Shopify uses 2026-10 and verifies Orders access. Amazon verifies Orders/Finances access and Flipkart verifies shipment access after token exchange. WooCommerce/custom verification validates an actual JSON record collection. Existing unavailable Meesho/Myntra integrations remain unavailable.
- The connection component waits for successful vault persistence before reporting a new active connection. Metadata permits verification/sync without returning secrets to the browser. Failed disconnects retain the established state. Existing layout, styles and modal structure were preserved.
- OAuth creation/consumption requires durable storage. One DELETE ... RETURNING statement enforces single use with owner/client/redirect/marketplace/expiry predicates. Initiation and callback use server configuration; caller overrides and hardcoded staging defaults were removed.

Verification:

- New behavioral connector suite: 22/22 PASS; actual handlers, pagination helpers, OAuth module and connection component execute with isolated synthetic adapters.
- Full npm test: 205 tests, 203 PASS, 2 FAIL, 0 skipped. The same pre-existing UI source-string assertions remain: dashboard hardcoded heading and landing route-comparison responsive grid. They were not hidden or changed.
- Production build: PASS; compilation, TypeScript validation and all 52 static-page generation steps completed. An initial sandbox EPERM creating .next/types was resolved by rerunning the same build with approved execution permissions.
- Updated stale legacy tests that expected memory-backed OAuth state or the obsolete Shopify shop endpoint; no guarantees were weakened to retain those behaviors.

Migration/deployment requirements: apply database/16_connector_sync_and_oauth.sql after migration 15 on an explicitly approved disposable target first. Fresh bootstrap and read-only readiness checks now include migration 16. Configure FLIPKART_APP_ID, FLIPKART_APP_SECRET and FLIPKART_REDIRECT_URI server-side. Production requires the registered HTTPS callback. Restart pending OAuth flows after upgrade. No database mutation, live seller call or real credential use occurred.

Limitations: bounded synchronous sync can still hit provider rate limits/runtime deadlines, in which case it fails rather than claims completion. Durable background orchestration is still Phase 2/6 work. Flipkart's documented shipment API excludes Flipkart Advantage orders and has a retrieval ceiling; partner scope and cancellation filters need real seller proof. Shopify REST is legacy and new public apps require a separately verified GraphQL path. F29/F30 financial mapping and settlement correctness remain Phase 3 work. Migration, real SQL concurrency/RLS/restart, browser staging and live provider permissions remain pending; Phase 4 is not declared complete.

Provider references reviewed: [Flipkart shipments](https://seller.flipkart.com/api-docs/order-api-docs/v3/PostShipmentSearch.html), [Flipkart authentication](https://seller.flipkart.com/api-docs/FMSAPI.html), [Shopify pagination and REST legacy status](https://shopify.dev/docs/api/admin-rest/usage/pagination), [Shopify 2026-10](https://shopify.dev/changelog/release-notes/2026-10), [Amazon order-item pagination](https://developer-docs.amazon/sp-api/lang-us/reference/getorderitems).


## Phase 5 implementation checkpoint — 15 October 2026

The user's Phase 5 instruction supersedes sequential execution for this pass; earlier open phases remain open. Six Phase 5 findings have locally verified fixes. F47 has working local implementation and isolated regression coverage but stays unchecked until migration/real database acceptance and earlier inventory-persistence prerequisites are satisfied. Phase 5 is not complete.

Implementation evidence:

- New tests/remediation-workflows.test.mjs: 29 behavioral tests pass, 0 fail, 0 skipped. These execute actual merge/import/aging/snapshot/CSV modules, actual upload/archive handlers with isolated database adapters, actual PlatformProvider actions and both Reports export tabs. Tests cover rejected saves without state mutation, canonical IDs, source-line duplication/conflicts, tax/price zeros, historical costs, partial receipts, tenant binding, rollback, cascades, repeated recovery and stale-stock refusal.
- Full regression checkpoint: 234 tests, 232 passed, 2 failed, 0 skipped. Both failures are the existing ui-ux-analyst.test.mjs dashboard-title and landing-grid source-string assertions. They remain included and unchanged. Stale migration-16 and CSV implementation-string checks were updated for migration 17, dated costs and original-file uploads; settlement payout rejection also has a behavioral assertion.
- Production build passed with compilation, TypeScript validation and all 53 static-page generation steps. The first attempt hit a Windows EPERM under .next/server/app/api; an unchanged retry passed without a dependency/configuration change. Final verification is recorded below after the last source edits.
- git diff --check passed. Existing UI styling, layout, navigation and modal conventions were preserved.

Deployment: database/17_recycle_bin.sql is included in explicit bootstrap/readiness checks and is not applied by request handlers. No database, seed, real store or real credential was used. pending.md lists the disposable database/role, actual source files, legacy ownership/repair and identity/browser checks needed before release. Earlier F16/F23/F29/F30/F33/F39/F51/F53 and operational limits remain open under their original phases.

Final verification after the last source edits: npm run build PASS (compilation, TypeScript and 53 static-page generation steps); focused workflows 29/29 PASS; full npm test 234 total, 232 PASS, 2 existing UI assertions FAIL, 0 skipped/cancelled. No new failing test remains. Phase 5 stays open for the acceptance items above.

## Phase 6 implementation checkpoint — 15 October 2026

Session issuance now registers a SHA-256 token digest before returning a cookie. Each login has a unique signed ID; every protected API and workspace navigation awaits a registry check. Logout commits revocation before clearing the cookie; registry failure returns a retryable 503. Unregistered/legacy/expired/malformed tokens and deleted accounts reject. Production requires a stable signing secret of at least 32 bytes. Migration 18 is supplied, bootstrap/readiness references it, and no database was modified. Real intended-role/RLS, independent process, restart and browser session acceptance remain open under F15.

Dependency work removed unused potrace/Jimp and updated PostCSS 8.5.30, postcss-selector-parser 7.1.6 and source-map-js 1.2.2 through the locked tree. Full npm audit: 5 high, 0 moderate/critical, down from 15; production-only audit: 0. The remaining entries trace to the unpatched braces/Tailwind 3 build chain ([advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)); F60 stays open. npm ls --all succeeds. Sorted compiled CSS rule records match the saved baseline: 9,986 records, 0 added/removed. No UI style/layout change or force upgrade was used.

Verification now executes real signer/tenant upsert/product handler/rate-limiter/financial engine behavior in place of mirrored simulations. Source-wiring checks are identified accurately and do not assert production durability. The two stale UI tests now check the existing dashboard greeting/date and rendered responsive route-comparison CSS; the UI was preserved. The production queue refuses its development simulator and returns 503; actual durable workers remain F21 engineering work.

- Full npm test: **247 passed, 0 failed, 0 skipped/cancelled**, including all existing suites and 13 new release tests. Session tests use actual handlers with an isolated registry adapter; separate module instances/reloads are not real PostgreSQL or multi-process proof.
- npm run build: **PASS**, including TypeScript and all 53 static-page generation steps. No warnings were reported by the final build.
- Public browser smoke: existing landing CTA reaches /login, Sign In switches the form, and anonymous dashboard navigation redirects to /login. Desktop and 390px mobile landing/login checks show no horizontal document overflow; no console warnings/errors observed in that limited session.
- Anonymous HTTP: public landing/login 200, dashboard/orders 307 to /login, auth/me and jobs 401. Protected workspace redirects are private/no-store. No credentials, authenticated database calls, provider calls or migrations were used.

Evidence: phase6-test-output.log, phase6-build-output.log, phase6-audit-before.json, phase6-audit-after.json, phase6-audit-production.json, phase6-dependency-tree.json, phase6-css-comparison.json and phase6-http-smoke.json. pending.md records migration/secret configuration, authenticated staging, remaining dependencies, real workers/shared quotas, monitoring/load/backup restore and earlier incomplete findings. Phase 6 remains IN PROGRESS; no whole-phase or production-readiness claim is made.
