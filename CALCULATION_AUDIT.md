# Calculation corrections — 19 October 2026

This audit follows the supplied “MarginFlow: Calculations to Correct” document. The referenced patch was absent, so fixes were implemented against the current checkout. UI layout and styling were preserved; calculation labels and unknown amounts were corrected where necessary.

## Implemented

| Document item | Result |
| --- | --- |
| A1, A7, B12 | Shared decimal-text, half-away-from-zero conversion to integer paise; exact journal/trial balance validation; financial inline rounding replaced. Nonfinancial percentage, time and animation rounding retained. |
| A2–A4 | Ledger revenue refunds, snapshot-cost stock restoration, damage reclassification and all return fee components derive from order facts; individual return dates are retained. |
| A5 | A recorded settlement reverse-shipping deduction replaces return-record reverse shipping. |
| A6, B14 | Paid invoices reduce payables and cash. New supplier payment records retain date, reference, allocations and excess advances. Legacy paid amounts use invoice dates explicitly. |
| A8 | SKU fees use post-discount line weights with deterministic paise allocation. |
| B1 | Both order-form paths record one fee, zero invented shipping and zero reimbursement-as-salvage; damage loss is derived from snapshot cost. |
| B2 | Customer shipping excluding recorded tax contributes to profit; only explicit shipping refunds reduce it. |
| B3 | Inclusive/exclusive calculations and fee bases use source evidence or a dated tenant/channel policy. Ambiguous taxable prices withhold payout forecasts and tax-exclusive fee estimates and generate a diagnostic warning. |
| B4 | Shared return policy handles salvage, RTO fees, USED and LOST_RETURN consistently. Return views receive settlements and the complete return set. |
| B5–B6 | Quick commission includes configurable GST (default 18%). Cash deductions and profit expenses are separate. Fee GST enters provisional account 1040 only for an explicitly configured regular taxpayer and evidenced/configured fee tax treatment. |
| B7 | Shopify/WooCommerce no longer invent 2% gateway fees or fixed shipping. Configured fee rules remain the source of forecasts. WooCommerce discounts apply once. |
| B8 | Weight alerts compare actual LOGISTICS deductions against dated configured slabs and recorded product weights; missing evidence suppresses the alert. |
| B9 | Unpaid recognized orders with unknown payouts remain in aging as counts with null amounts; UI and analyst responses show “Unknown”. |
| B10 | Ratio comparisons support percentage-point changes; monetary comparisons retain percentage change. Existing trend consumers compare monetary/count metrics. |
| B11 | Removed the misleading trueProfit financial alias; existing card reads Contribution Profit. |
| B13 | Separate TCS/TDS persistence, effective-dated default rates and tenant overrides, with warning-only checks when evidenced taxable bases are supplied. No base is fabricated from net payout. |
| B15 | Purchase modal test uses its current NumericInput component. |

Exact source line subtotals are retained for imports, avoiding lost paise when a line total cannot divide evenly into a two-decimal unit price. Recorded claim recoveries are also posted separately from salvage, and receivables account for statutory withholding and return charges.

## Deployment and configuration

Apply `production-supabase/migrations/20261019000100_calculation_evidence.sql` through the project's normal migration process before deploying this code. It adds accounting policies, dated withholding overrides, product weight, exact line subtotals and separate settlement tax fields. No production migration was run as part of this code change.

`channel_accounting_policies` is scoped by the internal `user_accounts.id`, marketplace and effective dates. Its fields are `prices_include_tax`, `gst_registration_type`, `marketplace_fees_include_gst`, `marketplace_fee_gst_rate_bps` and `logistics_rate_slabs`. Unset registration never enables fee input credit. Policies are stored in immutable order estimate input snapshots. Re-saving/syncing an order creates a new snapshot; it does not overwrite previous snapshots.

Each logistics slab has `marketplace`, `maxWeightGrams`, `amount`, `effectiveFrom`, and optionally `effectiveTo`. Match the applicable carrier service/zone when configuring these values. No sample freight amount or product weight is installed.

Withholding imports may supply `tcsTax`, `tdsTax`, `tcsTaxableValue` and `tdsGrossAmount`. These bases must correspond to the collection period and applicable tax point; net supplies already include the appropriate returns, while the TDS gross base is before commission. A merged historical tax total is preserved until both components are evidenced. Tenant rate overrides live in `statutory_withholding_rates`; no override uses the dated statutory defaults in the domain module. These checks are warnings, not filing calculations or eligibility determinations.

Supplier payment records follow the existing tenant browser-ledger persistence for supplier/purchase CRUD and are included in snapshot exports/imports. They are not a newly deployed supplier-payment database API. Excess cash is retained in account 1050 and is not silently applied to later invoices. Legacy partial invoices without a known paid amount still require reconciliation.

## Evidence and unresolved business facts

Public documentation cannot identify this tenant's GST registration type or establish whether old CSV/manual prices included GST. No registration classification or historical price basis was guessed. Existing historical profit remains provisional where that evidence is absent. Old returns may already contain the reimbursement/salvage confusion or invented fees; these cannot be safely rewritten without the original documents.

- [Amazon Orders API migration guide](https://developer-docs.amazon/sp-api/lang-us/docs/orders-api-migration-guide): the older item-price representation could be tax-inclusive or tax-exclusive. This rules out a universal assumption based only on marketplace name.
- [Shopify Order documentation](https://shopify.dev/docs/api/admin-rest/latest/resources/order): provides the `taxes_included` flag and shipping/tax fields. That flag is preserved by the mapper.
- [WooCommerce REST API documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/): separates line subtotals, discounted totals and taxes. The mapper retains the exact subtotal and treats its amount as tax-exclusive.
- [Amazon seller fees](https://sell.amazon.in/fees-and-pricing): displayed fees exclude GST; Amazon states that 18% GST applies. The quick-fee tax rate remains configurable rather than replacing all marketplace rules.
- [CBIC Section 16](https://taxinformation.cbic.gov.in/content-page/explore-act/1000285/1000001): ITC has statutory conditions, including communicated supplier invoice details. Fee credits remain provisional pending invoice/GSTR-2B verification.
- [Government review of GST changes](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48): aggregate GST TCS reduced from 1% to 0.5% effective 10 July 2024.
- [Income Tax Department Section 194-O](https://www.incometaxindia.gov.in/w/section-194-o-5): 0.1% rate from 1 October 2024 and participant-specific exceptions. The warning cannot establish an exception or PAN-related rate from order data alone.

Item GST amounts continue to come from source invoices or explicit form inputs. This change does not infer HSN classifications or install apparel/footwear price-band rates from a generic product-category name. The CA review requested in Part C remains necessary for filing treatment, registration, actual invoices and historical corrections.

## Verification

`tests/calc-fixes.test.mjs` adds behavioral regressions and checks ledger/report contribution parity across 32 combinations of quantity, tax basis and return condition. The targeted suite passes 91 tests. The final full run contains 299 tests: 276 pass and 23 fail. Existing fee, reconciliation, workflow and purchase-modal tests cover the affected integration paths. TypeScript checking and the production build pass. The baseline had 26 failures; three reported stale-test/aging failures are corrected, leaving 23 pre-existing failures and no new failures. The full repository suite is compared with a baseline; unrelated pre-existing authentication, database-source and stale persistence-mock failures are not treated as passing checks.
