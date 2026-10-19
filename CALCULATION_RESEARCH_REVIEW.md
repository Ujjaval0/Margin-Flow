> Remediation follow-up (19 October 2026): this document preserves the original audit snapshot. Current implementation, verified fixes, guarded unsupported inputs and live release gates are recorded in [FINANCIAL_REPAIR_PROGRESS.md](./FINANCIAL_REPAIR_PROGRESS.md).

# Independent calculation and accounting research review

Reviewed 19 October 2026. Read-only application audit; no application files or tests changed. All numeric reproductions below executed the actual TypeScript functions through `tests/helpers/load-app.cjs`, rather than a reimplementation of their formulas. This report is an independent input to the consolidated review, not a statutory certification.

## Conclusion

The calculation architecture cannot currently be described as 100% accurate. Exact paise arithmetic is useful, but does not prevent omission of transactions, selection of the wrong accounting period, duplicate attribution, or the wrong accounting classification. A balanced trial balance does not establish correctness of its underlying postings.

## Confirmed findings

### C1 — P1: Filtering by period loses cross-period returns, settlements, and recoveries

Evidence: `src/domain/profitability-engine.ts:653` independently filters orders by order date and settlements by settlement date; line 286 subsequently derives all business metrics by iterating only the retained orders. `src/domain/store.tsx:443` and line 480 connect this behavior to dashboard metrics.

Actual reproduction: order placed 30 September, one unit returned 10 October, settlement received 15 October. Filter to 1–31 October. The dataset retains the return and settlement but drops the order. `calculateBusinessProfitability` returns net sales 0, COGS 0, contribution 0, cash 0 and payout 0, despite the supplied October settlement of ₹1,000. October cash should include ₹1,000; October return recognition requires its original order/cost evidence. The same defect affects claims on prior-period orders.

Recommendation: Preserve complete order context while independently selecting dated economic events. Specify whether each report is an event-period report or an order-cohort report; cash must remain based on receipt events. Merely retaining all child records with in-period orders does not fix an event-period report.

### C2 — P1: Current order status fabricates historical return and revenue dates

Evidence: `src/domain/order-financials.ts:58` and lines 66–72 infer full returned quantities from current status when no return records are passed. `src/domain/ledger-engine.ts:285` dates recognized revenue at `order.orderDate`; line 371 dates status-only return reversals at that same order date. The `Order` interface in `src/domain/types.ts:124` has no fulfillment/recognition date.

Actual reproduction: September order now `RETURNED`, with an actual full return dated October. September date filtering removes the October return. The core infers a full return from current status and reports September net sales 0 and COGS 0, although the return occurred in October. Separately, an order placed in September and delivered in October gets its fulfillment journal in September because only its placement date is used.

Recommendation: Store recognition/fulfillment and return event dates supported by source evidence. Do not infer a prior-period return date from present status. Assess transfer of risks/rewards or control under the accounting framework applicable to the business. [ICAI AS 9, paragraphs 6.1 and 11](https://indasaccess.icai.org/Volume-III/AS/asb.html?a=110) links sale recognition to the transfer of goods/risks and rewards, rather than mere order placement. [MCA Ind AS 115, paragraphs 31–38](https://www.mca.gov.in/Ministry/pdf/IndAS115_2020_10112020.pdf) uses transfer of control for entities applying Ind AS.

### C3 — P1: Salvage can create inventory and profit above original cost

Evidence: `src/domain/order-financials.ts:36` accepts unrestricted positive `inventoryRecoveryValue`, line 143 adds its full value to salvage recovery, and line 161 adds it to contribution. `src/domain/ledger-engine.ts:361` debits inventory and credits revenue account 4040 for the entire value. Snapshot validation also imposes no salvage-to-cost ceiling.

Actual reproduction: a single fully returned damaged item has original cost ₹100 and salvage value ₹500. Core output is salvage recovery ₹500, damage loss 0, contribution profit **+₹400**. The return journal debits inventory **₹500** and credits salvage revenue ₹500. All journals can remain balanced.

Expected: If ₹500 is estimated inventory salvage/NRV, the inventory carrying amount cannot exceed the ₹100 cost for this ordinary merchandise item; there is no ₹400 unrealized inventory gain. If ₹500 is actual disposal proceeds, the receipt needs a cash/receivable sale event and inventory derecognition, rather than an inventory debit. These meanings need separate evidence.

Recommendation: Separate estimated NRV, carrying value, actual disposal proceeds, and marketplace claim receipts. Enforce the relevant cost ceiling and record actual disposals separately. [ICAI AS 2, paragraphs 5, 7, 16 and 20–25](https://indasaccess.icai.org/Volume-III/AS/asb.html?a=105) requires lower-of-cost/NRV, excludes recoverable purchase taxes from cost, and prescribes appropriate cost assignment for interchangeable goods. [MCA Ind AS 2, paragraphs 9 and 34](https://www.mca.gov.in/Ministry/pdf/IndAS2_2020_10112020.pdf) provides the corresponding inventory measurement and expense principles for Ind AS entities. The present uncapped inventory debit violates the measurement principle independently of framework selection.

### C4 — P1: Net Platform Payout re-adjusts recorded bank cash

Evidence: `src/domain/profitability-engine.ts:312` calculates `cash - returnCosts + claimRecovery`. `getOrderFinancialFacts` cash is already the sum of actual `netSettlement` amounts (`src/domain/order-financials.ts:145`).

Actual valid reproduction: two units sold at ₹500 each, one sellable unit returned, customer return fee ₹10, and recorded settlement ₹490 (₹500 retained sale less the ₹10 fee). `actualSettlementsReceived` is ₹490 but `netPlatformPayout` is **₹480**. The fee was deducted twice in the payout card. Similarly, a claim reimbursement included in the net settlement can be added again.

Recommendation: Actual bank payout must reconcile to bank receipts. Account separately for costs/reimbursements paid outside the settlement and link their actual cash events. Do not assume that all return fees and claims are external to recorded net settlement.

### C5 — P1: Manual settlement amounts count as cash in profitability but vanish from the ledger

Evidence: `src/domain/order-financials.ts:145` falls back to `order.settlementAmount` when no settlement rows exist. `src/domain/ledger-engine.ts:298` journals only settlement rows.

Actual reproduction: delivered order with ₹1,000 sales and `settlementAmount: 1000`, no settlement records. Core cash is ₹1,000 and aging treats it as settled. General ledger has **no 1010 bank entry** and retains **₹1,000 of 1020 receivable**. The journal remains balanced.

Recommendation: Require a dated settlement/payment record for the manual amount, or consistently mark undated legacy cash evidence unresolved. Do not let the same dataset simultaneously say cash was received and the entire amount is still receivable.

### C6 — P1: Return-level claim attribution reuses a single reimbursement on multiple returns

Evidence: `src/domain/profitability-engine.ts:450–454` uses `claims.find` with OR conditions. A claim whose `returnId` explicitly identifies one return can still match another return solely through the common order ID; marketplace is not checked in this match.

Actual reproduction: two damaged return records `r` and `r2` on the same order. One recovered claim for ₹100 has `returnId: 'r'`. `computeReturnFinancials` gives reimbursement **₹100 to r and ₹100 to r2**. Business/order totals deduplicate the claim and recognize only ₹100, so return-level financial cards and aggregated return financials can contradict business totals.

Recommendation: Give explicit return identity precedence; match marketplace and owner scope; allocate an order-wide recovery only once across eligible return records. Multiple claims on a return also need aggregation rather than selecting only the first.

### C7 — P2: Settlement anomaly radar contradicts settlement aging

Evidence: `src/domain/anomaly-radar.ts:159–169` treats any settlement as complete and excludes the order. Lines 175–179 calculate unsettled exposure from gross price times quantity, ignoring discount, tax treatment, fees, partial payments and refunds. Line 166 includes a hard-coded 22 September 2026 date floor.

Actual reproductions: a ₹1,000 net order with only ₹10 received has ₹990 overdue in `calculateSettlementAging`, but the radar reports no settlement-lag alert. A ₹10,000 gross-price order with ₹9,000 discount and no fees/settlement has ₹1,000 receivable, but the radar reports **₹10,000** pending payout. The test order is dated 1 September 2026, well over 14 days old on review date.

Recommendation: Derive overdue exposure and payment completeness from shared bounded financial facts. Remove invented dates. Configured marketplace contractual terms are required before a generic 14-day threshold can be described as a breach.

### C8 — P2: Duplicate-SKU return guardrail falsely reports valid returns as critical

Evidence: `src/domain/guardrails.ts:72–86` groups returned quantities by order and SKU, then compares the entire SKU return quantity against each individual order line quantity.

Actual reproduction: two distinct order lines each contain one unit of the same SKU; a valid return contains two units. Diagnostic output: **CRITICAL**, `count: 2`, claiming both lines exceed ordered quantities. Total ordered quantity is two and total returned quantity is two.

Recommendation: Compare SKU-group totals with SKU-group totals, or require actual order-line attribution throughout. Marketplace must also be included in matching when channel order identities can repeat across channels.

### C9 — P2: Marketplace breakdown omits valid business channels

Evidence: `src/domain/profitability-engine.ts:352–357` explicitly removes `B2B Wholesale` and `Other` from the marketplace list, even though both are accepted Marketplace enum values and business profitability includes their orders.

Actual reproduction: one `B2B Wholesale` order with ₹1,000 net sales produces business revenue ₹1,000; marketplace breakdown has no row containing that revenue. Sum of breakdown revenues is therefore not equal to business revenue.

Recommendation: Include every active business channel in a financial reconciliation, or explicitly disclose that the chart covers a limited subset and provide a reconciled total.

## Additional architecture limitations requiring reconciliation

- **Partial actual fee evidence replaces the whole estimate.** `src/domain/order-financials.ts:99–104`: a configured ₹150 full-order estimate is replaced with ₹20 and labeled ACTUAL as soon as a settlement contains one ₹20 logistics deduction. Reproduction returned fees ₹20. This is correct only if the settlement is known to provide complete fee coverage; there is no fee-category completeness/evidence marker. Do not describe remaining unobserved commission as confirmed zero.
- **Purchase tax eligibility is not represented.** `src/domain/ledger-engine.ts:395–417` always posts positive purchase tax to ITC account1040, with no purchaser registration or credit-eligibility condition. This needs the tax reviewer's statutory analysis; the lower-of-cost/NRV source above also distinguishes recoverable and nonrecoverable purchase taxes.
- **Claims and cash can disagree after cancellation.** Core sets cash to zero for cancelled orders, but ledger still posts the supplied settlement as cash received. A valid refund/reversal event is necessary to determine actual bank cash; current order status alone cannot erase receipts.
- **Return loss anomaly uses stale raw values.** `src/domain/anomaly-radar.ts:110` adds raw `lossAmount`, shipping, and customer fees rather than shared cost facts. It misses `otherReturnCosts`, settlement shipping precedence, salvage treatment, and claim recoveries; all order statuses enter the sold-unit denominator. This can contradict the corrected financial engine.
- **Cost snapshots alone do not demonstrate a compliant cost method.** A preserved historical number is useful only if it came from an evidenced FIFO, weighted-average, appropriate specific-identification, or valid approximation policy. Purchase intake, opening stock, cost history and stock movements need a complete reconciliation before inventory/COGS can be certified.
- **A balanced trial balance is an arithmetic check.** The current chart has no equity accounts or opening-entry interface in `generateGeneralLedger`. Full financial statements, complete opening inventory/cash/payables/equity and credit-card liabilities cannot be inferred from the generated operational postings alone.

## What appears sound within this review's scope

The monetary helper rounds symmetric decimal halves through integer paise, allocation conserves order-level totals, actual TCS/TDS is isolated from platform operating fees, and the core bounds returned quantities and distinguishes sellable from damaged COGS. These are meaningful improvements. They do not resolve the confirmed event-scope, attribution, measurement, and ledger inconsistencies above.

## Verification method and limits

Executed independent probes using actual exports from `src/domain/order-financials.ts`, `profitability-engine.ts`, `ledger-engine.ts`, `guardrails.ts` and `anomaly-radar.ts` with the existing module loader. Inputs were small synthetic fixtures representing documented real-world states; no production database was opened and no user transactions were altered. Probes are not live bank/invoice reconciliation, and no conclusion about the user's actual GST registration, statutory framework, production migration state, or complete transaction population can be inferred from local code. Official sources were opened on 19 October 2026. No third-party accounting articles support the findings.

The application contains paths beyond these assigned core domains. The consolidated review should combine ingestion/persistence, tax-policy, UI workflow and production-data findings before prioritizing changes. No implementation fixes were made in this review.
