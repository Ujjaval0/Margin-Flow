# MarginFlow Functionality and Calculation Reference

**Source reviewed:** application code in this repository, as of 2026-10-18.  
**Purpose:** an independent-review guide to the product behavior and financial calculations currently implemented in code.  
**Authority:** source code is the evidence of current behavior. This file describes implementation; it does not certify accounting, tax, or marketplace-policy compliance.

## How to use this reference

The formulas below explain what the application computes, the inputs it uses, and important limits. A named metric can be calculated differently in another part of the application (for example, operational profitability versus the general ledger). Those differences are called out instead of implying that all reports are automatically reconciled.

Money in most operational calculations is represented as JavaScript decimal `number` values and rounded to two decimal places. The marketplace fee engine is an exception: it uses integer paise and basis points. Percentages in domain results are generally ratios (e.g. `0.25` means 25%); UI formatting converts them for display.

## Product functionality map

The application provides these main screens and workflows (the visible navigation is defined in `src/components/layout/sidebar.tsx`):

| Area | What the application supports | Main source areas |
| --- | --- | --- |
| Dashboard / Home | Business KPIs, channel and product summaries, trend context, operational alerts | `src/components/modules/dashboard-view.tsx`, `src/domain/profitability-engine.ts`, `src/domain/anomaly-radar.ts` |
| Orders | Create, view, search/filter, import/sync orders; line items, marketplace, discounts, cost snapshots, settlement and fee details | `src/components/modules/orders-view.tsx`, `src/app/api/orders/route.ts`, `src/domain/order-financials.ts` |
| Returns & RTO | Record returns, condition/restock state, logistics and salvage amounts; calculate return impact and link claims | `src/components/modules/returns-view.tsx`, `src/domain/profitability-engine.ts` (`computeReturnFinancials`) |
| Claims & disputes | Track claim status, claimed/recovered values and return/order links | `src/components/modules/claims-view.tsx`, `src/domain/order-financials.ts` |
| Products & SKUs | Maintain product catalog and cost/weight/category data; review SKU profitability and return rates | `src/components/modules/products-view.tsx`, `src/domain/profitability-engine.ts` |
| Settlements | Import/store settlement batches and deductions; compare actual deductions with estimates; monitor estimated outstanding payouts | `src/components/modules/settlements-view.tsx`, `src/domain/marketplace-fees.ts`, `src/domain/order-financials.ts` |
| Suppliers; Purchases & Bills | Maintain vendors and purchase bills, record payments, allocate a payment to oldest outstanding bills first | `src/components/modules/suppliers-view.tsx`, `src/components/modules/purchases-view.tsx`, `src/domain/purchase-accounting.ts` |
| Operating Expenses | Record operating spend and advertising spend; attribute selected advertising costs to SKUs | `src/components/modules/expenses-view.tsx`, `src/domain/profitability-engine.ts` |
| Analytics & P&L | Filtered business, marketplace, SKU and period metrics; trends and performance ratios | `src/components/modules/reports-view.tsx`, `src/domain/profitability-engine.ts` |
| General Ledger | Generate journal entries and trial balance from operational records | `src/components/modules/ledger-view.tsx`, `src/domain/ledger-engine.ts` |
| Store Integrations | Connect/sync supported commerce sources, ingest reports/webhooks, and manage integration connections | `src/app/api/integrations/`, `src/app/api/webhooks/`, `src/components/modules/webhook-simulator.tsx` |
| AI document staging | Extract invoice-like fields from text/document processing, validate arithmetic, stage extracted values for review | `src/domain/idp-pipeline.ts`, `src/domain/ocr-engine.ts`, `src/domain/guardrails.ts`, `src/components/modules/ai-staging-view.tsx` |
| AI financial assistant | Produce deterministic answers/action suggestions from a provided grounded financial context; some routes also provide AI-backed document/dispute assistance | `src/domain/deterministic-analyst.ts`, `src/domain/ai-context.ts`, `src/app/api/ai-*` |
| Recycle Bin | View/restore supported soft-deleted records | `src/components/modules/recycle-bin-view.tsx`, `src/domain/recycle-bin.ts` |
| Audit / diagnostics | Review diagnostic checks for data, arithmetic and document-staging conditions | `src/components/modules/audit-view.tsx`, `src/domain/guardrails.ts` |
| Authentication and profile | Sign up/sign in, session handling, onboarding and user profile updates | `src/app/api/auth/`, `src/components/modals/user-profile-modal.tsx`, `src/lib/security/session.ts` |

This is a code-oriented feature map, not a promise that every external marketplace connector is fully enabled in a deployed environment. Credentials, permissions, provider APIs and deployment configuration affect integrations.

## Financial data path and shared order facts

Operational inputs arrive through user entry, imports, integrations, webhooks, and document staging. Order-level reporting is primarily based on `getOrderFinancialFacts` in [`src/domain/order-financials.ts`](src/domain/order-financials.ts). It links an order to returns, settlements and claims by marketplace plus internal/channel order identifiers, deduplicates linked records by ID, and derives line and order facts. The profitability engine aggregates these facts. The ledger is generated separately by `src/domain/ledger-engine.ts` and does not simply post the same fact object.

Cancelled orders are excluded from the shared active profitability calculations. Recognized lifecycle states include delivered, returned/partially returned, RTO and selected claim states. Pending, confirmed, shipped and cancelled orders are excluded from the ledger's order-fulfillment posting.

### Order sales, refunds, cost and contribution

For each order item, current shared facts compute:

1. `gross = sellingPrice × quantity`.
2. When revenue is recognized, `discount = clamp(recorded discount, 0, gross)`; otherwise discounts/revenue recognition follow the status rules in the order-facts function.
3. `refunded sales = (gross − discount) × returned units ÷ ordered units` (zero for a zero/nonpositive quantity).
4. `net sales = gross − discount − refunded sales`.
5. Good/SELLABLE returned units reverse their cost; damaged, unusable or missing units do not. `COGS = snapshot unit cost × (ordered units − good returned units)`. The order's historical unit cost snapshot is used.
6. `damage loss = snapshot unit cost × damaged returned units`.
7. `gross profit = net sales − COGS`.
8. `contribution profit = net sales − COGS − marketplace fee deductions − return costs + claim recoveries`.

Return units are sourced from linked return records when present, then from the item's `returnedQuantity`, then (for full-return statuses) from the full-return fallback. Returned quantities are capped at ordered quantity for line-level calculations. Return condition/type mapping is implementation-specific; see `order-financials.ts` for the full status and category lists.

### Actual, estimated and missing marketplace fees

Shared order facts use settlement deduction rows as actual fees when available. The fee total is the sum of recognized actual deduction amounts; TCS/TDS categories are excluded from fee deductions. If there are no actual deductions, a configured/legacy order estimate can be used. If neither is available, fee status is unknown and the fee amount is treated as zero for contribution arithmetic, while the relevant payout estimate is marked unknown. This means a numeric contribution can be incomplete when fee data is missing; check `feeStatus`/unknown-fee metrics before relying on it.

The current `shippingFees` classification in shared order facts uses actual deductions categorized `LOGISTICS`. Other fee categories are not automatically shipping. Order-level return costs sum linked return-record fields (`customerReturnFee`, `returnShippingCost`, and `otherReturnCosts`). Active claim recovery amounts are summed for claims in the recognized recovered/approved statuses according to `order-financials.ts`.

### Settlement cash and estimated payout

Actual cash received is the sum of linked settlement `netSettlement` values, falling back to `order.settlementAmount` and otherwise zero. The estimate is not treated as received cash.

When fee status is known (actual or configured estimate), estimated payout is computed from net sales, retained item tax, shipping charged where revenue remains positive, and fees (see the implementation for exact signs). Outstanding estimated payout is `max(0, estimated payout − actual cash)`. If revenue is recognized but fee status is unknown, expected payout is `null`; the aggregate outstanding estimate is also `null` if any such order is present. This is an operational estimate, not a marketplace remittance statement.

## Marketplace fee rules and quick commission

The main rule engine is [`src/domain/marketplace-fees.ts`](src/domain/marketplace-fees.ts). It is materially more precise than the general operational financial functions:

- Money is parsed into integer paise; malformed values, more than two decimal places, negative amounts where prohibited, unsafe integer totals, and discounts exceeding the line gross are rejected.
- Rates are stored/calculated in basis points (`100 bps = 1%`, `10,000 bps = 100%`). Percentage amounts use integer arithmetic and half-up rounding: `floor((basePaise × rateBps + 5,000) ÷ 10,000)`.
- Effective start/end dates are inclusive. Rules may scope to marketplace and optionally SKU, category, fulfilment mode and price band. Price bands are lower-inclusive/upper-exclusive. The matching rule with the most specific populated scope wins; tied top-specificity matches are rejected as ambiguous.
- Percentage fee component bases can be item value before discount, after discount, or excluding item tax. Fixed-per-order components are charged once per rule/component over the order; per-unit components multiply the configured amount by quantity. Configured component tax uses the component amount and its tax rate.
- If no rule matches and no quick rate is selected, the estimate is `NOT_CONFIGURED` (not silently zero).
- A selected quick commission rate replaces configured components of type `COMMISSION`; other configured components remain. Quick commission is applied per line to discounted item value excluding item tax. The quick estimate adds no separate tax. Its rate is user-selected/configured, not a claim about a marketplace's actual tariff.
- Quick-rate choices can be saved per account and marketplace through the quick-rates API; the order's selected rate is an order-specific input. Treat a saved choice as a convenience default, not verified marketplace pricing.
- Estimates remain estimates. Actual settlement deductions are retained separately and can be compared by normalized component names and total variance.

`reconcileSettlementNet` uses integer paise: `gross − deductions − tax − net settlement = residual`. Component reconciliation is only a component match when normalized component-name sets match; otherwise the comparison is a total-level variance/unmatched result. See `marketplace-fees.ts` for exact result names and edge cases.

## Business, marketplace, SKU, and period metrics

[`src/domain/profitability-engine.ts`](src/domain/profitability-engine.ts) aggregates shared order facts. Aggregates are rounded with the shared `money()` helper, which rounds decimal INR numbers to two decimal places using `Math.round((value + Number.EPSILON) × 100) / 100`.

| Metric | Implemented calculation |
| --- | --- |
| Gross sales | Sum of recognized item gross amounts before discount/refund. |
| Discounts | Sum of recognized discounts. |
| Refunded sales | Sum of allocated refunds for returned units. |
| Net sales / revenue | Gross sales − discounts − refunded sales. |
| Gross profit | Net sales − COGS. |
| Gross margin | Gross profit ÷ net sales; zero when net sales is not positive. Returned as a ratio. |
| Marketplace charges | Total fee deductions − shipping-fee amount. |
| Contribution profit | Shared order contribution amounts summed. |
| Contribution margin | Contribution profit ÷ net sales; zero when net sales is not positive. |
| Net operating profit | Contribution profit − all recorded expenses. |
| Net operating margin | Net operating profit ÷ net sales; zero when net sales is not positive. |
| Advertising spend | Expenses whose category is exactly `Advertising`. |
| ROAS | Net sales ÷ advertising spend; zero if spend is zero. |
| POAS | Contribution profit ÷ advertising spend; zero if spend is zero. |
| Return rate | Returned units ÷ sold units; zero if no units. This is a ratio, not a percentage value. |
| Total fees | Marketplace fees plus order-linked return costs. |
| Net platform payout | Actual cash received − order return costs + claim recoveries. |
| True profit | Set to contribution profit in the current implementation. |

Marketplace profitability groups order-derived values by marketplace. It currently includes a default set of six commerce channels even when there are no orders, and filters out `Other` and `B2B Wholesale`. UI components can apply additional visibility rules. SKU profitability allocates order-level fees across item lines weighted by line gross value. Return costs and claim recoveries are allocated by returned units when any exist, otherwise by gross value. It then computes SKU profit as `revenue − COGS − allocated marketplace charges − allocated return losses + allocated claim recoveries`. SKU ad spend uses `Advertising` expenses whose `attributedSku` exactly matches the SKU; SKU POAS is profit ÷ that spend.

Monthly/trend reports use date-scoped data and the same business profitability engine. Percentage change is `((current − previous) ÷ abs(previous)) × 100`, rounded to one decimal; if previous is zero, the implementation returns 100 for positive current, −100 for negative current, and 0 for zero current.

Date presets include all, today, last 7/30 days, this/previous month and custom ranges. Custom comparison uses an immediately preceding period of equal elapsed-day length. All-time is currently bounded to 2020-01-01 through 2030-12-31 with the comparison period 2010-01-01 through 2019-12-31. Date filtering uses date-only string boundaries. Claim records use recovery date for recovered/partially recovered statuses when present; otherwise claim date.

Settlement aging uses each recognized order's estimated outstanding payout, skips orders without an estimate, and buckets age into 0–7, 8–14, and over 14 days. Age is whole days from the order date to the anchor date. It does not currently apply different contractual payout SLAs per marketplace.

## Returns, RTO, damage and claims

`computeReturnFinancials` in `profitability-engine.ts` derives a return-level view:

- Unit cost comes from the matching order's snapshot cost, then current product cost, then zero. Product cost is unit cost × returned quantity.
- Damage includes DAMAGED, UNUSABLE, MISSING conditions or `DAMAGED_RETURN` type.
- Salvage is `inventoryRecoveryValue` or zero. Damage loss is `max(0, product cost − salvage)` for damaged returns.
- For RTO, this function sets customer-return fee and return shipping cost to zero. For non-RTO, it uses the recorded values.
- Base loss is damage loss plus logistics fees for damaged goods; for undamaged non-RTO returns it is logistics fees; RTO base loss is zero. If base loss is zero and explicit `lossAmount` is positive for non-RTO, that amount is used as fallback.
- A linked claim is selected by claim ID, return ID or matching order ID. Reimbursement is recorded `amountRecovered` or zero. `net financial impact = base loss − reimbursement`; negative impact is reported as net profit, while `netLoss = max(0, impact)`.

Claim lists, pending amounts and recovery totals use statuses/amount fields in their respective domain code. A claim's amount claimed is a requested amount; it is not a recovery until recorded in the recovery field/status.

## Supplier payments, purchases and inventory accounting

`allocateSupplierPayment` accepts only a finite positive payment. It selects that supplier's non-paid bills, sorts by invoice date then bill ID, and applies payment oldest-first up to each bill's remaining balance: `remaining balance = max(0, total amount − paid amount)`; applied payment is `min(payment remaining, remaining balance)`. Paid amount/status is updated to PAID, PARTIAL, or PENDING. A pre-existing PARTIAL bill without a recorded paid amount is rejected for reconciliation.

Purchase and bill forms store the underlying quantities, costs, tax and payment fields. The ledger's bill posting is separate and is described below; do not infer that a paid-bill allocation itself creates a matching cash journal posting.

## General ledger and trial balance

[`src/domain/ledger-engine.ts`](src/domain/ledger-engine.ts) independently generates double-entry entries for eligible order fulfillment, settlement remittance, returns, purchase bills and operating expenses. It rounds amounts to two decimals with JavaScript number arithmetic.

- Order fulfillment: gross sales is sum of `max(0, sellingPrice × quantity − discount)`. COGS is snapshot unit cost × full quantity. Receivable is gross sales less linked recorded settlement deductions classified as fees/logistics. It posts marketplace receivable, fee/logistics expenses and sales revenue; inventory and COGS legs are added if COGS is positive.
- Settlement remittance: bank debit is net settlement; TCS/TDS is a separate debit asset when positive; marketplace receivable is credited by net cash + TCS/TDS.
- Return: sellable/restocked goods may debit inventory and credit COGS using inventory recovery value, else loss amount. Damaged/non-restocked return may debit damage loss and credit COGS using loss amount. Return shipping may debit logistics expense and credit marketplace receivable.
- Purchase: raw subtotal is quantity × unit cost; tax is a separate input-tax-credit debit; if declared total is positive, inventory subtotal is declared total − tax and payable is declared total. Otherwise payable is raw subtotal + tax.
- Expense: operating expense debit and cash credit for the expense amount.
- Each entry's balance check compares rounded debit and credit totals; the entry is considered balanced when the rounded difference is no more than ₹0.01. Trial balance sums postings by account, computes net balance according to each account's normal debit/credit balance, and checks aggregate debit/credit difference using the same tolerance.

**Important ledger/report differences to review:** the ledger's order COGS uses full ordered quantity, while profitability facts reverse COGS for good returned units and preserve it for damaged units. Ledger revenue/fees are reconstructed independently from order and settlement rows; the order facts use fee status and configured estimates for operational profitability, whereas the ledger comments that estimates are not journal evidence. Return calculations and ledger postings use different fields and special cases. A balanced journal entry only proves arithmetic balance of its postings; it does not prove classifications, source completeness, statutory treatment, or reconciliation to a marketplace statement.

## Document extraction and arithmetic checks

`executeIDPPipeline` attempts structured Gemini extraction when a key is available; if that fails or no key is provided, it falls back to deterministic OCR/text parsing. Both paths stage data for human review. Extracted fields are not automatically equivalent to verified accounting records.

There are two arithmetic checks in the current code:

1. `validateDocumentArithmetic` checks `quantity × unit price − discount + tax amount` against the declared total, with an absolute tolerance of ₹0.05. Missing quantity, price or declared total fails validation.
2. The LLM IDP path sums each line's `quantity × unitPrice − discount + CGST + SGST + IGST` (or uses subtotal + tax total − discount total if no lines) and compares with grand total at ₹1.00 tolerance. The fallback uses the OCR stage's validation result.

These are not identical tolerances or data paths. Also, the LLM path uses line-level taxes while carrying `taxTotal` separately, so an invoice with inconsistent tax/line totals needs manual review. The guardrail quarantine is a staging control, not an audit opinion.

## Guardrails and anomaly heuristics

`runSystemGuardrailDiagnostics` currently checks: missing/zero order cost snapshots when a matching product exists; duplicate marketplace + channel-order IDs; cumulative returned quantity exceeding ordered quantity; settlement equation mismatch; recovered claim value exceeding claimed value; possible tax contamination of expenses/settlement fields; and failed staged-document arithmetic. Settlement arithmetic is `gross − deductions − TCS/TDS = net`, flagged when absolute difference exceeds ₹0.05. These are data checks and thresholds, not proof that all data is correct.

`computeAnomalyRadar` currently implements three heuristics (the `FEE_CREEP` enum exists but has no emitted implementation):

- **Weight discrepancy:** a single-line, single-unit shipment with product weight ≤500g and shipping charge >₹80 is flagged; impact is charge − ₹50. It uses four hard-coded SKU weights and defaults other products to 250g. Severity becomes critical above ₹5,000 aggregate exposure.
- **RTO/return bleed:** per-SKU return rate is returned quantity ÷ sold quantity; a SKU is selected when rate ≥20% and recorded return shipping + customer-return fee + loss amount exceeds ₹2,000. Selected amounts are summed and marked critical.
- **Settlement lag:** delivered orders without a settlement ID match and older than 14 days contribute gross item value (price × quantity, before discount). An alert is emitted only when there is at least one order and gross amount exceeds ₹5,000.

These thresholds and baselines are heuristics embedded in code; they are not live carrier tariffs, current marketplace service-level agreements, or user-specific rules. The settlement-lag heuristic's gross value is not the same as estimated payout or actual outstanding cash.

## Calculation and data-quality caveats for an expert review

1. **Two monetary models:** most domain/report calculations use binary floating-point JavaScript numbers rounded at two decimal places; marketplace fees use integer paise. A model review should verify paths that cross between them and decide whether all authoritative financial calculations should use integer paise/decimal arithmetic.
2. **Operational P&L is not the ledger:** the explicit differences above mean dashboard/report profit and generated journals may not reconcile. This needs an accounting-policy decision and reconciliation work before treating either as statutory books.
3. **Tax semantics need review:** item tax, component tax, TCS/TDS and GST are handled in distinct paths. This reference describes code behavior only; confirm each classification, recoverability, tax basis and posting with a qualified India tax/accounting professional.
4. **Missing fee evidence:** unknown fee orders can still contribute to a numeric profit using zero fees. Use unknown-fee counts and payout nullability; do not mistake this for confirmed zero charge.
5. **Returns and RTO differ by view:** shared order facts sum recorded return costs, while `computeReturnFinancials` zeroes RTO shipping/customer fees and the anomaly radar uses recorded amounts directly. Align these paths before relying on return-loss totals as a single canonical number.
6. **Heuristic alerts are not exact calculations:** product weights, shipping baseline, alert thresholds and 14-day settlement threshold are fixed heuristic values in `anomaly-radar.ts`.
7. **AI extraction is provisional:** confidence/provenance metadata and arithmetic guards support review, but extraction can be wrong, and IDP uses differing tolerances between paths. Keep human approval and source-document comparison in the process.
8. **Precision and rounding:** legacy rounding uses `Math.round` and floating point; fee percentages use integer half-up arithmetic. Allocation of order-level money to SKU lines uses integer cents, proportional weights, floor plus largest remainders, and stable line-order tie-breaking so allocations sum to the input amount.
9. **Formula source of truth:** when this file or another Markdown document differs from code, inspect the linked function. Historical `logic.md`, `Features.md`, audit reports and plans may describe previous behavior or intended architecture rather than current runtime behavior.

## Primary implementation references

- [`src/domain/order-financials.ts`](src/domain/order-financials.ts) — shared order/line facts, fees, returns, tax retention, payout and allocation.
- [`src/domain/marketplace-fees.ts`](src/domain/marketplace-fees.ts) — rule matching, quick commission, paise math and reconciliation.
- [`src/domain/profitability-engine.ts`](src/domain/profitability-engine.ts) — business/channel/SKU metrics, returns, date periods and settlement aging.
- [`src/domain/ledger-engine.ts`](src/domain/ledger-engine.ts) — chart of accounts, journal construction and trial balance.
- [`src/domain/purchase-accounting.ts`](src/domain/purchase-accounting.ts) — oldest-first supplier payment allocation.
- [`src/domain/guardrails.ts`](src/domain/guardrails.ts) — document arithmetic and dataset diagnostics.
- [`src/domain/idp-pipeline.ts`](src/domain/idp-pipeline.ts), [`src/domain/ocr-engine.ts`](src/domain/ocr-engine.ts) — extraction and staging.
- [`src/domain/anomaly-radar.ts`](src/domain/anomaly-radar.ts) — operational anomaly heuristics.
- [`src/domain/deterministic-analyst.ts`](src/domain/deterministic-analyst.ts), [`src/domain/ai-context.ts`](src/domain/ai-context.ts) — deterministic, context-grounded financial answers.
- [`src/components/layout/sidebar.tsx`](src/components/layout/sidebar.tsx), [`src/components/modules/`](src/components/modules/) — visible module inventory.

