# MarginFlow — sequential financial correction plan

Prepared 19 October 2026. Status: application remediation and local acceptance complete; deployment/evidence gates open. Completion is tracked below; unchecked work remains open.

## Implementation progress

The detailed evidence is in [FINANCIAL_REPAIR_PROGRESS.md](./FINANCIAL_REPAIR_PROGRESS.md). Checked items mean the identified application behavior has a passing focused test; they do not mean that an unapplied database migration or a live integration has been verified.

- [x] Prevent a colliding order display reference from overwriting a different external order (A17).
- [x] Validate settlement inputs, reject duplicate identities within a request and roll back an entire failed batch (A15, application tests).
- [x] Use distinct settlement record identities within one payout batch/order and repeatable Amazon event fingerprints (A8, application tests; database rollout pending).
- [x] Wait for successful settlement persistence before adding the receipt or closing the form; preserve failed input and retry identity (A15).
- [x] Accept supplier and supplier-payout audit types in validated snapshots (A2).
- [x] Load all order/settlement pages instead of truncating after 2,000 records (A14).
- [x] Stop generating a fictitious bank reference on manual settlement entry (U4, bank-reference portion).
- [x] Execute both full migration chains in disposable PostgreSQL; verify rollback, ownership, cost windows, partial payments, archive/restore and recovery.
- [x] Complete canonical persistence, stock effects, full hydration and conflict-detecting opening recovery.
- [x] Complete application remediation in Phases 0–10 within the documented operational scope; see the per-phase findings register.
- [x] Run the full 354-test suite, production build, TypeScript and production dependency audit.
- [ ] Apply/deploy to actual staging/production and demonstrate backup/restore, runtime-role and live acceptance.
- [ ] Resolve real business tax/source facts and legacy/unmapped records. Sample values do not authorize fabricated corrections or statutory certification.

**Final status (19 October 2026):** application controls and local acceptance complete; live rollout and authentic-data reconciliation remain release gates. FINANCIAL_REPAIR_PROGRESS.md records evidence and guarded unsupported paths. Original research below is retained as plan rationale.

## 1. Meaning of the local numbers

The user's clarification is the starting assumption: existing local values may be demonstration/sample data rather than real transactions. An unusual sample amount does not establish an incorrect calculation or a misstatement in actual business books. This plan does not propose changing sample values to make a dashboard look plausible, deleting the local database, or treating local records as audited business evidence.

Three different things must be distinguished:

| Kind | Treatment |
| --- | --- |
| Sample transaction or display metadata | Preserve it as an example. Judge formulas with controlled fixtures and explicit expected results, independent of its arbitrary amount. Sample account names/GSTIN-shaped text do not establish tax registration. |
| Real transaction evidence | Preserve original invoice/provider/bank references and amounts. Reconcile and correct only from that evidence. Do not overwrite it with a plausible guess. |
| A placeholder embedded in an executable financial path | Correct the behavior even if it originated in a prototype: e.g. the ₹380 invoice cost, demo supplier, forced PAID status or 75% payout fallback must not become an accepted real posting. |

The checked source has empty initial financial arrays in `src/domain/mock-data.ts`; it retains example account metadata. The production initial migration says it contains no demo seed data. Those facts do not establish what a particular local or deployed database currently contains. Inventory that is legitimately free can have a verified zero cost; missing cost evidence must not silently become that same zero.

No repair of historical business data is assumed necessary until Phase 0 identifies real affected records. Code defects remain actionable because the audit reproduced them using known inputs through actual application functions.

## 2. Scope and fixed requirements

- Repair the existing financial workflows and their data paths. Reuse the existing Next.js/PostgreSQL architecture and existing tables wherever possible; do not introduce a new service or rewrite the application.
- Preserve layout, navigation, styles and interaction behavior. Only change values, necessary accuracy labels, validation and the minimum existing form controls required to supply a missing financial fact. Apply `AGENTS.md` and `UI_UX_STANDARDS.md` to any necessary UI edit.
- Preserve the user's already agreed policies: one customer-return fee from its input, customer-paid shipping as revenue, shipping retained unless explicitly refunded, and unpaid orders with unknown fees visible in aging with an unknown amount.
- Keep monetary arithmetic in paise and conserve allocated totals. Preserve existing tenant ownership, transaction, deduplication and queue controls.
- Do not infer GST registration, product tax classification, price tax basis, inventory valuation policy or receipt of cash from sample metadata. Missing facts remain unresolved and must not be represented as confirmed zero, eligible ITC, a paid bill or a reconciled bank receipt.
- All existing API, import, manual-entry and invoice-approval paths must enforce the same posting requirements at the server/domain boundary. Disabling a button alone is insufficient.
- Start with the audit's reproducible defects. Conditional statutory capabilities have an explicit decision and closure criterion in Phase 8; this plan does not silently expand the product into a tax-filing platform.

## 3. Financial definitions to settle before changing formulas

Phase 0 documents these definitions against actual existing fields and Phase 3 implements them. This is a small domain contract, not a replacement architecture.

1. **Source amount:** preserve whether an amount is a unit price, extended line subtotal, document discount, tax, fee, refund or receipt. Preserve signs and currency. Check reconstructed totals against the source's documented semantics and rounding.
2. **Revenue:** recognized merchandise consideration after discounts and commercial refunds, excluding collected output GST, plus retained customer-paid shipping and any other evidenced earned customer charges. Include a separate fulfillment/recognition date; order placement is not a universal recognition event.
3. **COGS and inventory:** expense the cost assigned under the supported valuation policy; reverse it only for an evidenced inventory recovery at the appropriate carrying value. A refund does not by itself prove restock. Damage retained in COGS is not another deduction from profit.
4. **Fees:** distinguish confirmed expense, provisional tax credit, estimates and uncovered fee categories. Partial actual evidence must not turn all unobserved categories into zero. Choose fee-expense versus recovery presentation consistently for credits.
5. **Profit bridge:** net revenue minus recognized COGS, minus platform and other direct costs, plus separately recognized recoveries not already netted in those costs, equals contribution. Deduct operating expenses to reach operating profit. Show an estimate or an incomplete result explicitly when required facts are unknown. An estimated salvage/NRV value is not cash or automatically earned income.
6. **Cash:** sum independently evidenced dated receipts/payments once, including reversal/refund movements. Net platform receipt already includes the deductions netted in it; do not subtract them again. Status changes cannot erase actual historical cash.
7. **Receivables:** reconcile recognized debtor balances, credits, receipts and withholding credits. Distinguish customer/order receivables from a forecast of net platform payout. Do not subtract withholding twice or compare gross invoice value with net bank receipts without a bridge. A negative balance must be classified as an overpayment/advance or another explained credit, not silently lost by clamping to zero.
8. **Periods and ratios:** event-period reports select the dates of economic events while retaining their parent context. Order-cohort analytics may select placement date but must be identified as such. Return rates must use compatible populations: unique returned orders/orders or returned units/units; return-record count is neither of those numerators.
9. **Tax:** commercial recognition/refund, statutory tax timing/adjustment, recoverability and withholding realization are separate decisions. Keep their source evidence and dates distinct.

## 4. Implementation sequence

Each numbered phase is a separate reviewable change or a short series of focused changes. Finish its acceptance checks before moving dependent work forward. This sequence prioritizes preventing data loss, then posting correct inputs, then reconciling calculations and consumers.

### Phase 0 — Establish the baseline and classify evidence

**Work**

- Preserve the current dirty working tree and reports. Inventory active routes, migrations, SQL views and manual/domain posting entry points; do not assume a migration file is applied to any database.
- Record which local datasets are sample-only, real, or unverified. Use fixture/source context; do not infer authenticity from names, IDs or amounts. Avoid a new tagging UI unless actual mixed-data handling requires it.
- Reuse the saved audit probes as known-input regressions. Capture the existing 299-test baseline (276 pass, 23 fail at audit time), classify failures by current behavior versus obsolete source assertions, and record the TypeScript/build baseline. Fix genuine failures as part of the owning phase; do not delete or weaken tests to obtain green output.
- Finalize the definitions in section 3 and a source-to-field map, especially cost provenance, fee coverage, event dates, payment status and tax basis. List unavailable facts without blocking independent fixes.

**Likely files:** audit reports; `tests/helpers/load-app.cjs`; `financial-review-2026-10-19/*`; existing domain types and production migration inventory.

**Done when:** every audit item has an owner phase and expected behavior; sample data is not used as tax/business evidence; affected real-data repair is explicitly either required, unnecessary or unresolved.

### Phase 1 — Prevent identity collisions and unsafe financial writes

**Covers:** A17; identity portion of A8; write-acknowledgement and batch portion of A15.

**Work**

- Replace time-suffix internal identities with collision-resistant identities while retaining human/provider references separately. Enforce owner + provider + external order/line/event identity at the database boundary.
- Give create/update operations explicit identity-conflict behavior. A matching display reference must never authorize changing a different external order's identity or deleting its lines. Handle existing unique-key conflicts without a blind upsert.
- Validate settlement inputs, precision and batch bounds before writes. Make each accepted batch atomic, or provide an explicit supported partial-result contract; choose atomicity for the current all-or-failure response.
- Await acknowledged successful responses before treating a write as saved. Failed HTTP responses and retries must preserve recoverable input and cannot create duplicate payments.

**Likely files:** `src/domain/store.tsx`; `src/lib/integrations/order-persistence.ts`; orders/settlements API routes; additive database migration and relevant ID producers.

**Acceptance:** colliding display IDs for INV-A and INV-B never overwrite; repeated event import is idempotent; distinct split shipment events are preserved; failure on the second settlement rolls back the batch; HTTP 500 never leaves a purported committed receipt.

### Phase 2 — Make existing books durable and fully readable

**Covers:** A1–A2, A14; durability portions of A13 and A15.

**Work**

- Wire ordinary supplier, purchase, supplier-payment, expense, return, claim and relevant staged-document/audit changes to authenticated server persistence using the existing tables. Commit associated stock, cost and status effects atomically; apply the refined movement rules in Phase 5.
- Hydrate all those authoritative collections. Make browser snapshots a versioned cache/recovery aid rather than the only copy. Repair supplier audit-event schema compatibility and preserve valid old snapshots through deliberate migration.
- If a real local-only record must move to the server, use a tenant-scoped, conflict-detecting and idempotent migration; do not repeatedly auto-import a stale cache over newer server data.
- Replace the 2,000-row silent ceiling with complete, stable pagination or complete server-side projections. A refresh must not present partial totals as complete.
- Make server acknowledgment, owner changes, error handling and refresh concurrency consistent for all persisted financial workflows. Keep archive/restore under the same durability rules.

**Likely files:** `store.tsx`, `snapshot-validation.ts`, existing API/persistence modules, existing suppliers/payment/purchase/expense/return/claim tables.

**Acceptance:** create/edit in browser A, refresh, then read in browser B and obtain the same committed books and stock; a supplier action survives export/import; 2,001+ records contribute to totals; switching tenants never hydrates another tenant's cache; retrying local-data migration does not duplicate records.

### Phase 3 — Establish shared financial facts and cost evidence

**Covers:** A3, A6, A13 cost-history portion; partial-actual-fee gap; model portions of C1–C5/T1/T3/T7.

**Work**

- Extend existing types/storage only as needed to retain source identity, currency, recognition/refund/payment dates, tax basis, cost provenance and fee-evidence coverage. Use additive migrations and compatibility reads for old records.
- Resolve authenticated SKU aliases and dated historical cost before posting imported COGS. Persist product cost history/aliases. Distinguish verified zero cost from unknown cost; keep unknown/incomplete profit visible rather than manufacturing a zero-cost gain.
- Preserve genuine immutable cost snapshots. Correct erroneous historical snapshots through an evidenced, logged correction process rather than disabling the immutability control globally. Historical cost policy must be stated before choosing snapshot values.
- Keep the current INR product scope: reject unsupported currency at posting/import with a clear existing error path. Do not build a speculative FX conversion system.
- Implement one domain contract for actual/estimated/unknown fee components, tax basis, claim evidence and net receipt versus expected payout. Avoid one generic status driving unrelated financial meanings.

**Likely files:** `types.ts`, `money.ts`, `accounting-policy.ts`, `order-financials.ts`, `marketplace-fees.ts`, products API, shared persistence, additive migrations.

**Acceptance:** matching historical SKU cost is used; absent cost is unresolved rather than a confirmed zero; valid zero remains valid; aliases/history survive reload; USD 100 cannot enter INR books as ₹100; a ₹20 actual logistics deduction cannot silently prove the missing commission is zero.

### Phase 4 — Repair every existing ingestion path

**Covers:** A4–A8, A10–A12, A16; T2.

**Order within this phase**

1. **CSV:** preserve and reconcile CGST/SGST/IGST/total tax without double counting; preserve line identity, effective cost and source dates; detect inconsistent totals.
2. **Invoice/OCR approval:** retain every line and currency; resolve SKU/supplier/cost from evidence; remove ₹380/demo-vendor/demo-SKU/forced-PAID posting fallbacks. Enforce complete arithmetic, required mappings and payment facts at the actual approval boundary. Reuse normal validated purchase/order posting.
3. **Generic sync:** require a documented unit-price versus line/order-total contract; preserve lines/status; reject ambiguous or incomplete financial input instead of inventing it.
4. **Shopify:** use source line IDs; reconcile documented discount allocations/tax/shipping; preserve cancellations, source revisions and refund events. Do not treat a financial refund as evidence of physical restock.
5. **WooCommerce:** preserve fees, stable lines, tax, cancellation and partial-refund evidence including required refund detail retrieval. Reconcile the source total before posting.
6. **Flipkart:** honor documented promotion/price components and per-line fulfillment/return states. Return-request/pickup status is not automatically completed refund or returned inventory.
7. **Amazon:** preserve signed financial-event types and unique source identities, including refund/adjustment/reimbursement/service-fee evidence needed for supported totals. Keep shipment financial accruals distinct from payout transfers; mark a receipt reconciled only with independent matching evidence. If event coverage cannot be completed, show the import as incomplete rather than silently omit money.
8. **Webhook revisions:** compare supported source revision/timestamp evidence transactionally. Distinct older deliveries cannot overwrite newer financial state; preserve delivery deduplication and retry safety.

Meesho/Myntra direct sync currently returns 501. Keep its availability truthful and verify shared CSV handling; this remediation does not promise new restricted partner integrations.

**Likely files:** existing connector routes, webhook schemas/mappers, `csv-auto-mapper.ts`, `idp-pipeline.ts`, invoice-approval types/store path and shared persistence.

**Acceptance:** CGST90 + SGST90 = tax180; invoice lines100 + 200 + tax54 retain total354; generic total200/qty2 does not become400; Shopify allocation20 reduces100 to80; Woo customer fee20 bridges100 to120; Amazon90 +45 remains135; signed refunds survive; stale/repeated/reordered events cannot regress or duplicate books. Use fixtures based on official provider schemas, then a permitted staging integration check.

### Phase 5 — Correct order, return, claim and stock lifecycles

**Covers:** C2, C3, C6, C8; U2; claim-status defect; cancelled-cash gap.

**Work**

- Separate fulfillment, return, claim and payment status effects within existing models. A recovered FEE_DISPUTE cannot turn a sale into a physical return or erase its recognized revenue.
- Link claims by explicit return identity first, with tenant/marketplace/order scope. Sum eligible claims and allocate an order-wide recovery once; do not reuse it across returns or net it twice against fees.
- Post identified inventory movements once. Aggregate same-SKU line quantities or use stable line attribution. Editing condition/status reverses only a movement that was actually posted. Apply the same logic to archive/restore and repeat requests.
- Keep sellable, used, damaged, pending-restock and RTO treatment consistent between stock and COGS. Prevent quantities exceeding the actual dispatched/returnable population; fix false guardrails for valid duplicate-SKU lines.
- Preserve the entered customer-return fee once, including the accepted RTO case; retain shipping revenue unless an explicit shipping refund exists.
- Separate estimated salvage/NRV from actual disposal proceeds. Apply a supported cost ceiling to recovered inventory, without inventing a profit or cash receipt; actual disposal needs an evidenced disposal/sale movement and cost derecognition.
- Record commercial refunds and bank refunds as their own dated effects. Cancellation can stop future recognition but cannot erase an already recorded receipt.

**Likely files:** `store.tsx`, `order-financials.ts`, `profitability-engine.ts`, `guardrails.ts`, `recycle-bin.ts`, `ledger-engine.ts`, return/claim persistence.

**Acceptance:** sale100/cost40 + separate recovered fee dispute5 retains sales100 and contribution65 under the agreed presentation; one100 claim is attributed100 in total; stock10 less same-SKU quantities2+3 becomes5; pending-restock→damaged does not remove unposted stock; archive/restore round-trips real movements; RTO fee5 remains5; salvage500/cost100 creates no unsupported400 gain.

### Phase 6 — Reconcile fees, receipts, receivables and supplier payments

**Covers:** C4–C5, C7; A15 remaining parts; fee-completeness/cancelled-cash gaps; U4 bank-reference issue.

**Work**

- Generate dated manual settlement/payment evidence through the same receipt path as other sources. For an undated legacy `order.settlementAmount`, resolve its evidence or keep it explicitly unresolved consistently across engine, ledger and aging.
- Actual net platform payout equals the linked actual receipt movements. Deduct/add costs and claim receipts only when their separate cash movement is evidenced outside those receipts.
- Reconcile complete fee-category coverage, credit/refund signs, fee GST, TCS/TDS, partial receipts and residual balances. Ensure external claim recoveries cannot also be recognized as embedded settlement cash twice.
- Use shared outstanding facts in settlement aging and anomaly radar. Keep unknown amounts visible, remove the hard-coded September date floor, and distinguish configured payment terms from advisory thresholds. Preserve overpayment/negative-settlement information.
- Verify supplier partial-payment/advance allocation with real payable and cash effects, no duplicate settlement and no over-allocation. A purchase bill is not automatically paid merely because it was entered or approved; retain its evidenced invoice/payment dates. Expense versus payment liability treatment must agree with the supported payment methods.
- Preserve genuine bank references; generated internal IDs must not claim to be bank UTRs.

**Likely files:** `order-financials.ts`, `profitability-engine.ts`, `purchase-accounting.ts`, `ledger-engine.ts`, `anomaly-radar.ts`, purchase/settlement entry/store paths and their persistence.

**Acceptance:** net receipt490 stays490; manual receipt1000 generates the same bank/receivable result in every view; partial10 against known1000 leaves990 in both aging and radar; gross10000 less discount9000 produces a1000 basis before other evidenced adjustments; an unknown-fee order is present with unknown exposure; claims/refunds/cancellations and supplier advances reconcile to movements.

### Phase 7 — Fix applicable tax treatment and evidence

**Covers:** T1, T3–T9; T2 already addressed in Phase 4.

**Work**

- Keep recipient registration and inclusive/exclusive basis unknown unless evidenced. Unknown basis cannot generate a definite exclusive-tax statutory journal. Preserve the commercial amount while withholding final unresolved classifications rather than losing the transaction.
- Separate recoverable, pending, blocked/nonrecoverable and reversed purchase/fee tax. Nonrecoverable inventory tax belongs in the relevant cost treatment; an estimated fee credit is not a confirmed filed ITC claim.
- Preserve CGST/SGST/IGST components, original invoice/credit-note identity, tax dates and commercial recognition dates. Gate statutory output-tax reductions separately from commercial refunds by applicable admissibility/date/evidence conditions.
- Correct the historical 2020–21 TDS interval; retain effective dates and legal-reference versions. Treat rate checks as advisory unless taxpayer applicability, threshold and earlier credit/payment-event evidence are present. Do not alter correct ordinary current rates merely because old section labels remain.
- Allow evidenced purchase taxes/rates required by actual supported invoices; do not force every purchase into the current fixed dropdown/default. Preserve historical rates and avoid universal category assumptions.
- Keep GST TCS and income-tax TDS separately reconcilable with their respective official records and utilization state. Neither is a platform fee or interchangeable with purchase GST ITC.

**Likely files:** `accounting-policy.ts`, `types.ts`, `order-financials.ts`, `ledger-engine.ts`, `guardrails.ts`, tax CSV fields, purchase entry and additive tax-evidence storage.

**Acceptance:** unknown registration does not become eligible ITC; inclusive1180/tax180 gives revenue1000 and invoice1180 when verified; unknown basis never posts1360 as a confirmed answer; a late commercial return does not automatically reduce statutory GST; historical base10000/TDS75 in the relevant interval passes; lawful exemption is not labelled a confirmed short deduction; component and withholding balances reconcile independently.

**Evidence still required:** actual recipient registration, invoice price basis, product tax classification and entity-specific applicability. These cannot be obtained from the user's sample local data or by guessing from marketplace names. Most code repairs can proceed while those facts remain unresolved.

### Phase 8 — Unify period reports, ledger, SQL jobs, exports and AI

**Covers:** C1–C2, C9, A9; U1, U3–U4; return-loss anomaly gap; statutory-scope limitations.

**Work**

- Implement event-period selection with full parent context. Use recognition dates for revenue, return/credit dates for adjustments and receipt dates for cash. Keep cohort analytics explicit. Preserve evidence status for missing legacy dates rather than inventing delivery dates.
- Make the verified domain model drive interactive reports and queued reports. Either invoke the shared model server-side or maintain tightly specified equivalent SQL projections with parity tests. Replace obsolete dependent profitability/aging views through a new migration; do not only edit an initial migration already potentially deployed.
- Reconcile net revenue → COGS → fees/direct costs → recoveries → contribution → operating expenses. Display damage already in COGS and RTO costs only once in the bridge; preserve the correct headline when fixing an incorrect explanation.
- Include every supported channel in reconciled totals. Use one explicit ratio definition per label, retain paise in unit economics, and distinguish gross chart series from net revenue.
- Align anomaly inputs and AI/CSV terminology with shared facts: contribution is not automatically net profit, unknown fees remain unknown, and explanations must not double-count losses or conceal incomplete coverage.
- Bound claims such as “audit-ready”/“GAAP ledger” to verified capability. This is a necessary correctness label change, not a visual redesign.

**Accounting-scope decision:** existing operational postings are not automatically complete statutory books. If these outputs are intended as the sole books, implement reconciled opening cash/inventory/payable/equity balances, the applicable valuation policy, supported liabilities and period-correction/locking rules before that claim is released. If the intended product remains operational margin analysis, state the boundary accurately and reconcile exported movements to the external books. This decision does not block fixing confirmed calculations. No new filing, banking or enterprise reporting product is assumed.

**Acceptance:** September sale/October return and cash appear in the appropriate event periods; an October receipt on a September order is retained; September is not rewritten by October return status; an RTO cost20 appears20; the damaged-return P&L bridge sums exactly to its reported20; two returned units out of two show100%, not200%; all-channel totals and SQL/job/UI/CSV/AI outputs agree in paise with equivalent scope and evidence.

### Phase 9 — Complete change history, conditional recordkeeping and data correction

**Covers:** A13; conditional statutory architecture gaps from all reports.

**Work**

- Preserve source-linked revisions and material before/after financial values, actor, tenant, timestamp and reason atomically with writes. A literal PREVIOUS/status-only message is not a record of line amount changes. Keep append-only controls and restrict bypass paths.
- Separate operational recycle expiry from applicable financial retention; test backups and a restore. Verify actual migration/role/retention configuration rather than declaring compliance from source files alone.
- For intended statutory use, resolve the entity-specific recordkeeping requirements and missing controls identified in Phase 8. Do not infer a universal company-law obligation from a sample company name.
- Build a dry-run affected-record inventory only for genuine business data: cost snapshots, lost components, duplicate/colliding identities, overwritten event amounts, missing multiline invoices, local-only books and unresolved payment/tax facts. Reconstruct from original evidence where available; report what cannot be recovered.
- Apply reviewed, idempotent corrections with before/after control totals and a recovery route. No destructive reset, silent replacement with current cost, guessed bank dates, or historical tax reclassification from sample metadata.

**Acceptance:** financial edits preserve source/revision history; applied migrations match expectations; backup restore is demonstrated for the target environment; a correction rerun changes nothing; unresolved records remain identifiable; tenant and period control totals reconcile before and after.

### Phase 10 — End-to-end verification and completion evidence

**Work**

- Run focused behavioral regressions for each owning phase, then the full suite and `npm run build` once the integrated change is ready. Resolve the baseline's legitimate failing tests; replace obsolete source-text assertions only with stronger current-behavior checks.
- Exercise provider/CSV/manual invoice → validation → committed record → stock/cash movement → journal → date-filtered report → CSV/AI. Include supplier purchase/partial payment/advance, returns/claims, archive/restore, retries/stale events and failure rollback.
- Use a disposable PostgreSQL/staging environment for real transactions/constraints, owner boundaries, migrations, pagination and refresh/new-browser tests; mocked probes alone cannot close persistence findings.
- Compare identical known-input datasets across domain facts, database projections, journals, dashboard, reports and exports. Check both numerical values and evidence/unknown states, not just balanced debits and credits.
- Reconcile a small set of authentic source documents and statements if real-data readiness is required. If unavailable, record that limit rather than calling sample validation transaction-level certification.
- Update the audit findings register with test evidence, migration state, residual conditions and the exact supported accounting scope.

**Done when:** all confirmed findings below have a passing behavioral check; full build/type checks pass; the full test suite has no unexplained failures; all relevant surfaces reconcile; no unrelated visual/navigation changes were introduced; conditional statutory questions are either resolved with evidence or explicitly excluded from unsupported claims.

## 5. Audit-to-plan coverage register

An item closes only when both its implementation and acceptance evidence exist. Merely listing a phase does not close it.

| Audit item | Repair phases |
| --- | --- |
| A1 browser-only books / refresh reversion | 2, 5, 10 |
| A2 invalid supplier snapshots | 2 |
| A3 imported unknown costs stored as immutable zero | 3, 4, 9 |
| A4 Shopify omissions/unstable line identity | 4 |
| A5 WooCommerce fee/refund loss | 4 |
| A6 currency discarded | 3, 4 |
| A7 Amazon incomplete events / false bank reconciliation | 4, 6 |
| A8 Amazon event identity collisions | 1, 4 |
| A9 obsolete SQL model and queued report | 8 |
| A10 invoice multiline loss / invented posting facts | 4, 6 |
| A11 generic unit versus order total | 4 |
| A12 Flipkart promotion / mixed status mapping | 4, 5 |
| A13 incomplete edit history / lost catalog history | 2, 3, 9 |
| A14 hydration truncation | 2, 10 |
| A15 silent failed writes / non-atomic batches | 1, 2, 6 |
| A16 stale event regression | 4 |
| A17 colliding display ID overwrites another order | 1 |
| C1 cross-period events omitted | 3, 8 |
| C2 status rewrites past revenue/return timing | 3, 5, 8 |
| C3 unsupported salvage gains | 5 |
| C4 payout double adjustment | 6 |
| C5 manual receipt absent from ledger | 6 |
| C6 duplicated/first-only claim attribution | 5, 6 |
| C7 anomaly/aging contradictions | 6, 8 |
| C8 duplicate-SKU false warning | 5 |
| C9 omitted business channels | 8 |
| T1 universal purchase ITC | 3, 7 |
| T2 split GST lost in CSV | 4, 7 |
| T3 unresolved basis still gets definite journal | 3, 7 |
| T4 historical TDS rate interval | 7 |
| T5 restricted/default purchase tax input | 7 |
| T6 commercial return automatically reverses GST | 7 |
| T7 no distinct invoice/tax-point dates | 3, 7, 8 |
| T8 distinct withholding-credit reconciliation absent | 6, 7 |
| T9 applicability confused with rate comparison | 7 |
| U1 P&L bridge / RTO double counting | 8 |
| U2 stock changes / lost RTO customer fee | 5 |
| U3 incompatible return-rate denominators | 8 |
| U4 paise loss, gross/net labels, AI uncertainty, invented UTR | 6, 8 |
| Fee-dispute claim erases sale | 5 |
| Partial actual fee coverage replaces whole forecast | 3, 6 |
| Cancelled status erases bank cash / stale loss anomaly | 5, 6, 8 |
| Cost policy / opening entries / liability scope | 3, 6, 8, 9 |
| Broader GST filing/matching controls not implemented | 7, 8 scope decision, 9; never claim they exist without implementation and evidence |

## 6. Recommended first implementation batch

Execute Phase 0, then Phase 1, then Phase 2. They prevent later correct formulas from consuming lost, duplicated or uncommitted records. The next batches follow Phases 3–10 in order. Do not combine the whole plan into one large rewrite.

For every batch, deliver: the exact issue fixed, necessary code/migration changes, a focused behavioral counterexample that now passes, appropriate integration/build results, and any remaining evidence dependency. Implementation may use parallel reviews for independent provider adapters once the common definitions are fixed, but shared ledger/store changes should have one coordinated owner.

## 7. Research and traceability

This plan translates the existing code audit into implementation work; it does not introduce new tax-rate recommendations. Recheck effective official provisions and provider API versions when implementing the relevant phase.

- [Consolidated findings](./FINANCIAL_RESEARCH_REPORT.md)
- [Calculation findings C1–C9](./CALCULATION_RESEARCH_REVIEW.md)
- [Architecture findings A1–A17](./ARCHITECTURE_RESEARCH_REVIEW.md)
- [Tax findings T1–T9 and official-source links](./TAX_RESEARCH_REVIEW.md)
- [Recorded consumer reproductions](./financial-review-2026-10-19/reproduce-consumer-findings.cjs)
- [Recorded store reproductions](./financial-review-2026-10-19/reproduce-store-findings.cjs)

The completion target is demonstrated correctness for documented supported workflows, with all known defects closed and unknown facts represented honestly. No test count, sample dataset or balanced journal alone establishes universal 100% correctness.
