> Remediation follow-up (19 October 2026): this document preserves the original audit snapshot. Current implementation, verified fixes, guarded unsupported inputs and live release gates are recorded in [FINANCIAL_REPAIR_PROGRESS.md](./FINANCIAL_REPAIR_PROGRESS.md).

# MarginFlow: independent tax and statutory accounting review

Review date: 19 October 2026 (Asia/Calcutta). Scope: actual current working-tree code, including uncommitted calculation changes. Read-only execution probes used `tests/helpers/load-app.cjs` to transpile and execute application functions, with no database connection. No application or test file was changed for this review. This report does not establish the tenant's registration, product classification, original invoice contents, or deployment/migration state.

## Result

The inspected code cannot support a claim that all calculations or statutory books are 100% correct. There are reproducible data/calculation defects, and the operational accounting projection lacks evidence required to determine several tax treatments. Balanced debit/credit totals alone do not establish tax eligibility, correct classification, or correct accounting period.

## Confirmed defects

### T1 — P1: purchase GST is always classified as eligible ITC

Evidence: `src/domain/ledger-engine.ts:395-418`; `src/domain/types.ts:253-267`; `src/domain/ledger-engine.ts:40-43`.

Every positive `PurchaseBill.taxes` debits account 1040, named GST Input Tax Credit and described as eligible credit. The function has no recipient-registration or purchase-credit-eligibility input. The purchase model lacks eligibility, blocked credit, matching, and credit-claim status. Channel registration controls on order fee calculations do not protect purchase journals.

Executed actual function: a pending purchase of 1 unit at INR 1,000, tax INR 180, total INR 1,180 produces inventory debit 1,000, ITC debit 180, payable credit 1,180 without any registration evidence. That is wrong for a composition or unregistered purchaser and for permanently ineligible tax. If recoverability is unresolved, it also cannot be labelled eligible.

Legal basis: composition taxpayers cannot take ITC under [CGST section 10(4)](https://taxinformation.cbic.gov.in/content-page/explore-act/1000279/1000001). Regular registration alone is insufficient: [CGST section 16](https://taxinformation.cbic.gov.in/content-page/explore-act/1000285/1000001) imposes invoice, receipt, supplier-reporting/payment and return conditions; [section 17](https://taxinformation.cbic.gov.in/content-page/explore-act/1000286/1000001) restricts and blocks credits. [ICAI AS 2, paragraph 7](https://indasaccess.icai.org/Volume-III/AS/asb.html?a=105) includes nonrecoverable purchase taxes in inventory cost, subject to the applicable accounting framework.

Recommendation: evidence recoverable versus nonrecoverable purchase GST; capitalize nonrecoverable inventory tax and separately track pending/eligible/reversed credit. Do not infer this from marketplace or seller name. Confidence: high; affected tenant population unknown.

### T2 — P1: split GST columns are silently discarded during CSV import

Evidence: `src/domain/csv-auto-mapper.ts:35`, `:369-402`, `:495`, `:545`.

`CGST`, `SGST`, `IGST`, and total tax are competing aliases for one field. The first exact match wins; remaining components are not summed or checked. Executed CSV with headers `Order ID,Order Date,SKU,Quantity,Price,Status,CGST,SGST,IGST` and one delivered line containing price 1180, CGST 90, SGST 90, IGST 0. Actual result: `taxAmount=90`, no error and no tax warning. A first IGST column containing zero could hide both positive intrastate components.

For that invoice total tax is INR 180; the import loses INR 90. When used with a verified inclusive basis, revenue becomes INR 1,090 instead of INR 1,000 and output GST is understated by INR 90. This is a data-loss defect independent of the applicable percentage.

Recommendation: preserve separate components, prefer an explicit verified total only after reconciliation, and flag contradictory total/component columns. Confidence: high, executable reproduction.

### T3 — P1: unknown inclusive/exclusive basis still creates definite tax journals

Evidence: `src/domain/order-financials.ts:89-91`, `:153-158`; `src/domain/ledger-engine.ts:214-221`, `:256`; `src/domain/guardrails.ts:186-188`.

The payout estimator correctly returns null for an unresolved basis, and a warning exists. However the ledger does not enforce that unresolved status. Actual probe: delivered quantity 1, selling price 1180, tax 180, no `pricesIncludeTax` => `taxBasisKnown=false`, `expectedPayout=null`, revenue credit 1180, output tax credit 180, receivable debit 1360. If the original invoice was inclusive, correct revenue is 1000 and receivable 1180. The function therefore chooses one treatment despite declaring the evidence insufficient.

Recommendation: preserve unresolved accounting classification instead of posting a final statutory projection; resolve the invoice/channel basis before recognizing those numeric postings. Confidence: high; whether each historical price is inclusive remains unverified.

### T4 — P2: historical TDS rate table misses the COVID-period reduction

Evidence: `src/domain/accounting-policy.ts:24-28`, `:35-43`.

The table uses 1% from 1 October 2020 through 9 July 2024. [Income-tax Act 1961 section 197B](https://www.incometaxindia.gov.in/w/section-197b-7) reduced applicable rates, including section 194-O, to three-fourths during 14 May 2020–31 March 2021. Section 194-O started on 1 October 2020, so the applicable ordinary rate was 0.75% for its initial period, reverting to 1% from 1 April 2021.

Actual probe for 1 December 2020, base INR 10,000 and recorded TDS INR 75 returns a warning expecting INR 100. This is a false statutory warning, not a cash posting defect: the validator does not calculate or remit actual tax.

Recommendation: add the missing dated interval and keep applicability separate from rate lookup. Confidence: high; relevant only to supported historical data.

### T5 — P2: manual purchase rate choices cannot represent all current rates

Evidence: `src/components/modals/add-purchase-modal.tsx:49`, `:67`, `:205-209`.

The dropdown accepts only 0%, 5%, 12%, 18%, and 28%, defaults to 18%, and calculates the bill from the selection. It cannot enter a genuine 40% GST purchase. For a 1,000 taxable base at 40%, the correct 400 tax/1,400 total cannot be represented through this form.

The [Ministry of Finance's 56th GST Council FAQ](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163560&lang=2&reg=48), published 3 September 2025, identifies revised rates effective 22 September 2025 and specific 40% categories. More recently the [GST Council April 2026 newsletter, page 2](https://gstcouncil.gov.in/sites/default/files/2026-05/newsletter_april_issue.pdf) describes Notification 01/2026-CT(R), dated 30 April 2026, including 40% beverage entries. This establishes a capability gap; it does not establish that this tenant sells those products. Historical 12%/28% inputs should not simply be removed.

Recommendation: capture evidenced invoice tax/rate and effective-date/classification context without imposing a universal product rate. Confidence: high on input limitation; tenant impact conditional on actual invoices.

## Tax-compliance architecture gaps (conditional; distinct from arithmetic defects)

### T6 — P1 if exported as statutory liability: every return reverses output GST

Evidence: `src/domain/order-financials.ts:86-88`, `:135-139`; `src/domain/ledger-engine.ts:358`, `:371-379`; return/order types do not carry tax-credit-note admissibility or declaration evidence.

Actual execution for an April 2023 sale returned October 2026 reduces account 2020 GST Output Tax Payable by 180, solely from returned quantity. [CGST section 34](https://taxinformation.cbic.gov.in/content-page/explore-act/1000304/1000001) requires the relevant tax credit note and its timely declaration, with statutory restrictions. The ordinary reporting cutoff for a FY 2023-24 sale is 30 November 2024 or the relevant annual return date, whichever is earlier. The official consolidated provision also distinguishes conditions concerning the recipient's reversed credit and tax incidence; it marks some 2026 amendments as not yet notified, so those must not be treated as operative merely because enacted.

Revenue reversal/customer reimbursement may still be commercially correct after that cutoff. The missing decision is whether the supplier can reduce statutory output GST. If inadmissible, the tax component must be borne/accounted for separately rather than reducing payable GST. Recommendation: separate commercial refund from evidenced admissible GST adjustment, with invoice/credit-note period and eligibility controls. Confidence: high on code behavior; legal treatment conditional on actual invoice and declaration facts.

### T7 — P1 for statutory-period reporting: order status is used as the GST timing trigger

Evidence: `src/domain/order-financials.ts:7`, `:56`, `:86`; `src/domain/ledger-engine.ts:211`, `:285`.

SHIPPED/CONFIRMED orders produce no sales or output-GST journal. Later postings use `orderDate`, not a separately evidenced invoice/time-of-supply date. A normal taxable-goods invoice issued on 30 September followed by delivery on 3 October can require September GST even if revenue is recognized on delivery. The model cannot distinguish those dates.

[CGST section 12](https://taxinformation.cbic.gov.in/content-page/explore-act/1000281/1000001) and the [GST Council time-of-supply FAQ](https://www.gstcouncil.gov.in/sites/default/files/2024-02/final-gst-fq-31218.pdf) explain invoice timing and Notification 66/2017's relaxation for advances on goods. Recommendation: retain separate invoice/tax-point and commercial-revenue dates. Do not infer an advance-GST obligation for all normal goods. Confidence: high that dates are absent; actual period misstatements depend on invoice dates.

### T8 — P2: TCS/TDS totals are isolated from expense but not separately reconcilable in the ledger

Evidence: `src/domain/ledger-engine.ts:63-68`, `:297-318`; `src/domain/accounting-policy.ts:47-50`; `src/domain/types.ts:204-209`.

The app correctly avoids treating source withholdings as operating expense, and preserves separate source fields when supplied. It still posts both to one 2030 control, without distinct GST-cash-ledger and income-tax-credit realization/reconciliation state. [CGST section 52(7)](https://taxinformation.cbic.gov.in/content-page/explore-act/1000325/1000001) places ECO TCS in the supplier's electronic cash ledger. It is not GST input-tax credit and cannot substitute for income-tax TDS. A combined management asset can be a summary; it is insufficient evidence that either statutory balance was actually credited, available, or utilized. Recommendation: preserve separate subledgers and reconcile each against its respective official statement before settlement/utilization. Confidence: high on model limitations; no claim that a control account alone is unlawful.

### T9 — P2: withholding validation is a rate comparison, not an applicability engine

Evidence: `src/domain/accounting-policy.ts:31-43`; `src/domain/guardrails.ts:189-194`.

The validator takes settlement date and two bases. It has no participant legal form, PAN/Aadhaar furnished status, annual threshold, credit/payment event, or exemption data. Current ordinary TDS 0.1% is correct under [Income-tax Act 2025 section 393(1), Table 8(v)](https://www.incometaxindia.gov.in/w/section-393-5); [section 393(4), Table 11](https://www.incometaxindia.gov.in/w/section-393-6) provides the individual/HUF INR 5 lakh exemption with PAN/Aadhaar conditions. A lawful zero TDS on a 10,000 base produces a warning expecting 10. Using settlement date can choose the wrong historic rate when withholding was triggered earlier.

The [Income Tax Department transition FAQ](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tax-payments-faq?mobile-app=1) says the earlier credit/payment event determines old/new Act applicability from 1 April 2026. References to 194-O in account descriptions and connector labels are legacy descriptions, not evidence that the implemented current percentage is wrong. Recommendation: continue labelling warnings advisory, record event/applicability evidence and legal-reference version. Confidence: high.

## Further capabilities required before claiming comprehensive GST compliance

The inspected model does not implement a complete CGST/SGST/IGST/cess tax subledger, HSN/SAC and place-of-supply decision system, separate GST registrations/branches, GSTR-2B/IMS matching and claim/reversal states, 180-day nonpayment ITC reversal, blocked/destroyed-stock credit reversal, or statutory credit-note filing/reconciliation workflow. Supplier GSTIN presence is not equivalent to these controls. OCR extraction fields alone do not establish eligibility. These are compliance boundaries rather than proof that every present margin calculation is wrong.

Positive controls observed: integer paise/BigInt arithmetic, dated and configurable ordinary withholding rates, source-tax recording instead of universally guessing product GST, separate explicit tax-inclusive basis, explicit fee GST provenance, and withholding isolation from fee expense. [Notification 15/2024-CT](https://www.gstcouncil.gov.in/sites/default/files/2024-09/central-tax-15-2024-11072024.pdf) and the [GST Council July 2024 newsletter](https://gstcouncil.gov.in/sites/default/files/2024-08/july_newsletter.pdf) support the current combined 0.5% GST TCS ordinary rate used from 10 July 2024. These strengths do not cure T1–T9.

## Coverage and confidence

Read: accounting policy, order financial facts, marketplace fee estimation, relevant ledger/guardrail sections, CSV mapper, accounting snapshot persistence and order readback, purchase/settlement/return types and snapshot validation, purchase entry form, Shopify tax mapping, and calculation-evidence migration. Executed six focused cases against actual functions: purchase ITC, split GST import, missing price basis journals, 2020 TDS rate, current exempt-participant advisory warning, and late-return tax adjustment. No live database, actual seller tax returns, source invoices, migration application, or official filing was accessed. No external code was copied into the application. Sources used for legal conclusions are official government publications or ICAI; product-specific classification and all entity-specific statutory applicability remain unresolved.
