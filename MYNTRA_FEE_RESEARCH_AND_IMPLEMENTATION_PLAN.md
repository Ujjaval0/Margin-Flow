# Myntra fees: PDF analysis, web research, and implementation plan

Research date: 25 October 2026. Scope: Myntra only.

## Finding

Automatic fee calculation is feasible, but a single public category table cannot establish every seller's actual Myntra fees. Use a seller's Commercial Terms Agreement (CTA) and applicable Partner Portal rate card as the source of exact rates. Load those terms once and apply them automatically to subsequent orders; custom commission and additional fees can remain optional.

The supplied PDF explicitly describes industry benchmarks and ranges. Its title is not evidence of a published Myntra schedule. Neither its commission midpoints nor the other quoted amounts should silently become contractual charges. No production calculations have been changed by this research.

## 1. What the supplied PDF actually contains

Source: `C:/Users/freak/Downloads/myntra_seller_rate_card_2026_261025_135926.pdf`, two pages. Both pages were extracted and visually inspected. Statements within the PDF were treated as source claims, not instructions.

### Commission, page 1

| PDF category | Stated benchmark range |
| --- | --- |
| Women's apparel, ethnic and western | 18%-25% |
| Men's and kids' apparel | 18%-26% |
| Innerwear and loungewear | 15%-18% |
| Footwear, casual/formal/ethnic | 20%-25% |
| Bags, wallets and handbags | 20%-24% |
| Fashion jewellery and accessories | 20%-22% |
| Beauty, cosmetics and personal care | 15%-22% |
| Home decor and furnishing | 18%-24% |
| Select low-ticket items below Rs 500 | 0%-1%; eligibility is unspecified |
| Rising Stars | 0%; programme approval and applicable terms are needed |

The PDF describes the commission base as the final customer-paid selling price after discount. It does not resolve item GST treatment, marketplace-funded discounts, shipping/customer extras, price-band selection for multiple units, or the exact contracted rate. Do not reinterpret that wording as a verified tax-exclusive base.

### Fixed closing fee, pages 1-2

| PDF value slab | PDF PPMP fixed fee |
| --- | --- |
| Up to Rs 500 | Rs 30 |
| Rs 501-Rs 1,000 | Rs 50 |
| Rs 1,001-Rs 2,000 | Rs 70 |
| Rs 2,001-Rs 5,000 | Rs 100 |

The source describes a per-order fee for successfully delivered items and says it is typically reversed on return. Exact contract verification is still needed. It does not cover amounts above Rs 5,000, fractional amounts between the printed integer slabs, or mixed baskets and partial returns. These gaps cannot be filled by extrapolation or by assuming that all return events reverse every fee.

### Freight, page 2

| PDF weight slab | Local forward | National forward | PDF reverse information |
| --- | --- | --- | --- |
| 250-500 g | Rs 35 | Rs 70 | Forward rate, potentially up to 15% more |
| 500 g-1 kg | Rs 45 | Rs 88 | Refers to a full return journey; no exact separate amount |
| 1-2 kg | Rs 60 | Rs 110 | Refers to non-refundable forward cost on invalid returns |
| Above 2 kg | Rs 85+ | Rs 150+ | Mentions additional 500 g fractions without pricing increments |

The PDF uses the greater of dead weight and volumetric weight, with volume divided by 5,000. Required dimension units need confirmation in the actual contract. There is no zonal table, no below-250 g rule, no definitive boundary convention at 500 g/1 kg/2 kg, and no exact above-2 kg or reverse schedule. Shipping direction, shipment grouping, package measurements, zone and contract are necessary inputs. Product dead weight alone cannot establish freight.

### Other charges and taxes, page 2

| PDF claim | Interpretation for implementation |
| --- | --- |
| Payment collection fee: 1.5%-2% | A range, not a universal exact rate. Confirm applicability, payment mode, base, minimum and tax treatment. |
| GST: 18% on commission, closing and logistics | Keep fee GST separate from the underlying fee and product GST; confirm component treatment from the contract/invoice. GST registration alone must not create an ITC credit. |
| TCS: 1% of net taxable sales | Conflicts with the later government rate reduction described below. Do not copy into the fee engine. |
| Growth enablement: Rs 15,000-Rs 25,000, offset with PLA credits | Account-level event, not a recurring per-order commission. Confirm the seller's exact charge and credit conditions. Promotional credit is not a bank refund. |

The PDF's return-rate and marketing comments describe business context. They do not authorize an additional percentage deduction, automatic penalty, or expected-return expense on every order.

## 2. Findings from public sources

### Commercial terms and selling models

Myntra's public partner site describes seller-packed and Myntra-fulfilled options. It says there is no registration/onboarding charge or refundable deposit, while distinguishing a growth enablement charge recovered from operating payouts with equivalent PLA credits. It points sellers to their CTA for details. The page does not establish the PDF's Rs 15,000/Rs 25,000 amounts. [Myntra partner site](https://partners.myntrainfo.com/)

Jio Commerce/Fynd's own onboarding documentation says Myntra sends the seller an agreement containing commercial details and negotiated terms. It also describes marketplace-provided credentials and SKU mapping. This supports using seller-specific agreements rather than a universal benchmark percentage. [Jio Commerce onboarding documentation](https://platform.jiocommerce.io/help/docs/openapi/new-seller-onboarding/myntra/)

### Zero commission is a programme, not a category-wide assumption

Myntra publicly offers a zero-commission construct through Rising Stars 2.0 for digital-first, made-in-India D2C brands. Public programme material is not proof that an individual seller or every sub-Rs-500 item qualifies. It does not establish a universal duration or waive every other service charge. Store evidenced eligibility, scope and effective dates before applying the concession. [Myntra programme](https://partners.myntrainfo.com/ethniczerocommission)

### How reconciliation software handles the process

Unicommerce's own UniReco documentation supports Myntra PPMP and SJIT. Its workflow uses dated channel rate cards, product/category mapping, commission and overrides, collection, freight and fixed fees. Freight can depend on direction and local/zonal/national zone. It distinguishes expected fees from actual marketplace deductions and allows bulk rate-card input. This is evidence of the software workflow, not verification of this PDF's prices. [UniReco documentation](https://support.unicommerce.com/index.php/knowledge-base/unireco/)

### Incentives are separate, conditional credits

Myntra's seller incentive document describes opt-in offers at Brand-Article-Gender (BAG) level, eligibility guardrails, and later rebate credits reflected in event reports. Returns and cancellations affect settlement calculations. Its examples should not be used as today's general rate card. Recognize a rebate from its applicable terms and credited evidence, rather than assuming it when an order is created. [Myntra seller incentive document](https://myntrascmuistatic.myntassets.com/selleruniversityassets/documents/Seller-Incentive-and-Rebate-2.pdf)

### The PDF's TCS figure is outdated

The Ministry of Finance records a reduction from 1% aggregate GST TCS to 0.5%, effective 10 July 2024: 0.25% CGST plus 0.25% SGST/UTGST, or 0.5% IGST. Preserve dated statutory rules and evidenced taxable bases. TCS reduces cash received but must not be classified as commission expense. [Government explanation](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48)

The PDF also omits e-commerce income-tax withholding. The Income Tax Department's section 194-O material records the 0.1% rate from 1 October 2024 and conditional exemptions. Apply the relevant transaction-date law, applicability and evidence; do not deduct it universally or include it in marketplace fee GST. [Income Tax Department](https://www.incometaxindia.gov.in/w/section-194-o-7)

### What the research did not establish

No authoritative public universal rate table was found that verifies the PDF's category ranges, fixed closing slabs, collection percentage, freight amounts, return reversal policy or below-Rs-500 eligibility. No documented public endpoint was found that supplies every seller's negotiated commercial rates. This is a limit of the available public evidence, not a claim that approved private integrations cannot provide them.

Third-party calculators and blogs give conflicting numbers. A public copy of someone else's agreement would also fail to establish this merchant's terms. Neither is a suitable automatic production default.

## 3. Fit with the current MarginFlow architecture

These observations come from the existing working tree, including pre-existing Amazon fee changes. They are not newly implemented Myntra functionality.

| Existing location | Current capability and implication |
| --- | --- |
| `src/domain/order-fees.ts` | Shared boundary for browser preview and authenticated persistence. Myntra currently uses the generic calculator; there is no built-in Myntra schedule. A Myntra-only branch belongs here. |
| `src/domain/marketplace-fees.ts` | Integer-paise calculations; dated marketplace/SKU/category/fulfilment/price rules; percentage/fixed-order/per-unit components; explicit tax treatment; commission override. Reuse these primitives. |
| `src/app/api/marketplace-fee-rules/route.ts` | Tenant-owned versioned custom rules already exist. A merchant-specific imported Myntra rate card can feed this model where its semantics match. There is currently no CTA/rate-card importer. |
| `src/components/modals/order-modal.tsx` | Existing fee-rule management and optional quick commission. Preserve these controls; a normal Myntra order should derive its fees without entering a commission each time. |
| `src/lib/integrations/order-persistence.ts` | Recalculates fees on the server, loads owned product categories, and writes fee/input/component audit snapshots. Add source and version evidence for Myntra. Existing cached automatic fee snapshots are Amazon-specific. |
| `src/domain/types.ts` | Product dead weight exists. Dedicated Myntra BAG mapping, programme eligibility, shipping zone and package dimensions are not currently modeled. |
| `src/domain/accounting-policy.ts` | Already separates statutory withholding and evidence-based fee GST credits, with dated TCS/TDS rates. Preserve this separation. |
| `src/domain/order-financials.ts` | Actual settlement fees take precedence over estimates. Coverage limitations must remain visible when required charges cannot be established. |
| `src/app/api/integrations/myntra/sync/route.ts` | Direct Myntra sync deliberately returns unavailable pending approved partner access. It directs merchants to official report uploads. Do not imply automatic contract retrieval is already available. |

Two composition details need care. The generic calculator selects one matching rule per line: adding a separate custom rule can replace the selected schedule instead of supplementing one component. Its quick commission currently uses an item-tax-exclusive base. A Myntra adapter must preserve the merchant's actual base and explicitly merge component overrides, rather than inheriting those semantics accidentally.

## 4. Recommended implementation contract

This is an implementation recommendation derived from the evidence and code review, not a claim about a universal Myntra policy.

1. **One-time source loading:** obtain the merchant's current CTA/rate card and amendments, category/BAG/SKU mapping, and representative forward/return settlement reports and fee invoices. Import exact terms with review of extracted fields. Manual rate entry remains an optional fallback, not an order-by-order requirement.
2. **Myntra-only scope:** isolate the adapter and source data behind `marketplace === 'Myntra'`; also scope commercial terms to the tenant, seller account and applicable brand/model. Other marketplace behavior stays unchanged.
3. **Versioned terms:** retain source reference, effective interval, fee base, applicability, price bands, scope, tax treatment, rounding, shipping direction and programme conditions. A document labelled 2026 does not establish an effective date of 1 January 2026.
4. **Automatic selection:** map each line to its confirmed commercial category/BAG and fulfilment model, choose the applicable dated terms, and calculate with integer paise. Do not fuzzy-match ambiguous categories or guess missing freight inputs.
5. **Explicit override precedence:** per-order commission override replaces commission only; a custom component replaces the corresponding automatic component only when identified as an override. Additional custom charges are additive. An explicit zero is valid. Never double-charge commission, closing or freight.
6. **Lifecycle rules:** distinguish forward delivery, cancellation, RTO, exchange and full/partial customer return. Apply reversal and retained-fee rules only where the contract and event evidence establish them. Never apply a generic 15% return penalty or reverse all fees from status alone.
7. **Separate accounting:** marketplace fees and their GST, tax withholding, one-time growth charges, ad credits and later rebates remain separate facts. Do not distribute the growth charge over orders or recognize promotional credit as recovered cash automatically.
8. **Honest coverage:** if exact contract terms or required inputs are absent, return a reason and any known components with an unknown total/partial coverage. Benchmark ranges may support a separately labelled planning estimate, but should not be silently posted as exact expenses or payouts.
9. **Stable snapshots and reconciliation:** store selected terms, inputs, component sources, calculation version and overrides. Replayed imports should not reprice historical orders under a newer contract. Compare actual deductions against the estimate, then report variances without posting both as expenses.

Verification should cover seller isolation, all documented band boundaries, multiple lines/units, discounts and GST bases, each relevant fulfilment model, fixed-fee allocation, freight weight/zone, return events, zero-rate eligibility, custom replacement/addition, repeated imports, historical snapshots and settlement reconciliation. Run the existing test suite and `npm run build` when implementation changes are made.

## 5. Decision supported by the research

Use exact seller terms imported once, followed by automatic order calculation and optional custom overrides. Do not choose the midpoint of the PDF ranges as the production default. The remaining input is merchant-specific commercial evidence, not more generic web percentages. Public research alone cannot determine that merchant's actual commission or freight rate.
