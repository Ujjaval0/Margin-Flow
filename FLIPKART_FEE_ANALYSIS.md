# Flipkart rate-card PDF analysis

Reviewed: 25 October 2026. Scope: analysis only; no application calculations changed.

Source: `C:/Users/freak/Downloads/flipkart_seller_rate_card_261025_135526.pdf`, two pages. Both pages were extracted and visually inspected. The document's app-integration notes are source claims to evaluate, not instructions to execute.

## Overall assessment

The PDF describes the main fee components and two commission exemptions. It is a reference summary, not a complete exact rate card. It does not identify an issuing authority, rate-card version, contractual applicability or effective dates. Most nonzero commission and other fees are ranges. Some claims conflict with other parts of the document or with Flipkart's public examples.

Two headline policies have first-party support:

- Flipkart announced zero commission for eligible sellers' products priced below Rs 1,000 on 14 November 2025. [Official announcement](https://stories.flipkart.com/announcement/flipkart-launches-zero-commission-model-for-products-below-rs-1-000-strengthens-seller-success-with-unmatched-supply-chain-reliability-and-technology)
- Flipkart announced expansion of zero commission to all fashion products at every price point on 8 July 2026. This supports the fashion exemption but does not enumerate every underlying vertical code. [Official fashion announcement](https://stories.flipkart.com/announcement/flipkart-expands-zero-commission-across-fashion-empowering-sellers-and-accelerating-the-growth-of-india-s-fashion-ecosystem)

Announcement dates and a reference year do not establish all historical contract intervals. Historical orders require the schedule applicable to their date.

## 1. Commission described on page 1

The PDF states that prices below Rs 1,000 receive 0% commission across categories, and fashion receives 0% at any price. For other products above Rs 1,000, it gives:

| Category grouping in the PDF | Stated commission |
| --- | --- |
| Mobiles and smartphones | 2%-5% |
| Laptops, computers and peripherals | 4%-6% |
| Large and kitchen appliances | 5%-8% |
| Electronics and smart accessories | 5%-12% |
| Beauty, grooming and personal care | 5%-12% |
| Grocery and gourmet staples | 3%-10% |
| Books, office logistics and stationery | 8%-12% |
| Automotive parts and sports gear | 7%-14% |
| Home decor, kitchen utilities and furniture | 8%-15% |
| Apparel, footwear and travel bags | Flat 0% at any price |
| Fashion jewellery and premium accessories | 15%-25%, except below Rs 1,000 |

The final row conflicts with the opening claim that all fashion is commission-free. A product must use its actual Flipkart vertical and applicable policy; the app must not charge 15%-25% merely because this row says so, or assume that every item loosely called an accessory belongs to Fashion.

The document also leaves exactly Rs 1,000 unresolved: it uses both “below” and “above.” It does not define whether eligibility uses listing price, discounted per-item price or another value, how multiple units affect thresholds, or whether the commission calculation base includes item GST or buyer extras. Exact rates within each range cannot be selected from this PDF.

## 2. Fixed and collection fees on page 1

| Fee | PDF amount | What is missing |
| --- | --- | --- |
| Fixed closing fee | Rs 15-Rs 50 per order | Complete price slabs, tier-specific amounts, fulfilment differences, charge scope and lifecycle rules |
| Prepaid collection | 1.8%-2% of order value | Exact rate, base, minimum/fixed charges, effective dates and payment-method applicability |
| COD collection | 2.5%-3% of order value | Same details; the range is not an exact rate |

The PDF names Bronze, Silver, Gold and Platinum and says higher tiers reduce fees. It provides no usable tier matrix. A tier label alone is insufficient to determine an amount.

## 3. Freight on page 2

| PDF weight band | Local | Zonal | National |
| --- | --- | --- | --- |
| 0-500 g | Rs 29, waived in selected tiers | Rs 44, waived in selected tiers | Rs 65 |
| 500 g-1 kg | Rs 28-Rs 40 | Rs 40-Rs 60 | Rs 85 |
| 1-2 kg | Rs 48-Rs 55 | Rs 63-Rs 80 | Rs 110 |
| 2-5 kg | Rs 65-Rs 75 | Rs 98-Rs 100 | Rs 140 |

The source refers to physical/volumetric weight and delivery zone but omits:

- The volumetric divisor and dimension units.
- The exact local/zonal amount and eligibility for waivers.
- Whether the printed amounts are full-shipment charges or incremental charges.
- Rounding and treatment of exact boundary weights at 500 g, 1 kg and 2 kg.
- Rates above 5 kg, package grouping and multiple-package orders.
- Separate forward, RTO, customer return and exchange charges.
- Fulfilment-specific charges and whether displayed rates already include GST.

The local 500 g-1 kg range starts below the lighter slab's Rs 29. This could reflect different commercial conditions, but those conditions are not provided. It should not be converted into a monotonic schedule or corrected by assumption.

## 4. Cross-check against Flipkart's public fee examples

Flipkart's indexed public fee page contains standard examples that differ from this PDF: collection is shown as Rs 12.50 up to Rs 750 and 2% above that for both payment modes; fixed fees distinguish FBF/NFBF and include Rs 14 and Rs 55; first-500 g freight is shown as Rs 47/Rs 54/Rs 68. Its heavier freight rows include increments. The page explicitly directs sellers to their accounts for accurate current rates. These examples demonstrate conflicts; they are not a replacement current merchant rate card. [Flipkart fees page](https://seller.flipkart.com/fees-and-commission)

The page is dynamic and its search-indexed examples may lag revisions. Do not replace the PDF's uncertain values with different public examples and label the result exact.

## 5. Calculation formula and accounting gaps

The PDF proposes:

```
Marketplace fees = commission + fixed fee + collection fee + shipping
Fee GST = marketplace fees x 18%
Seller payout = customer selling price - marketplace fees - fee GST
```

This is a simplified fee deduction illustration, not a complete settlement or profit calculation. An implementation must establish each component's tax treatment and avoid adding GST twice when a recorded fee already includes it. The document's phrase “Governance Tax” should be interpreted as its label for fee GST, not a separate additional tax.

The formula omits statutory withholding, refunds, return costs, penalties, reimbursements, promotional adjustments and other account-specific services. Product GST is separate from GST on marketplace services. Fees do not establish COGS or profit, and registration alone does not establish input-tax-credit eligibility. MarginFlow's existing tax and settlement evidence rules should continue handling those facts.

## 6. Meaning for manually entered Flipkart orders

Some commission cases can be automated from verified zero-commission policy and confirmed eligibility/category mapping. Zero commission is an explicit zero, not a missing rate. It does not establish that total marketplace fees are zero.

For other commission cases and the remaining charges, automatic exact calculation requires the applicable seller rate-card data. The manual order supplies the calculation inputs; it should not require the user to type a fee rate each time. Required inputs depend on the contract, including:

- Order date, product/listing and mapped Flipkart vertical.
- Selling price, quantity, discounts and explicit price/tax basis.
- Seller tier and fulfilment model applicable at the transaction date.
- Prepaid/COD details where the collection schedule distinguishes them.
- Packed weight/dimensions, origin/destination or verified shipping zone.
- Lifecycle event, where calculating a return, RTO or cancellation charge.

Store exact dated terms once, resolve them per order, calculate in integer paise, and retain selected rules in the order estimate snapshot. Keep optional custom commission and fees, with explicit replacement versus addition to avoid duplicates. Missing required terms should remain unconfirmed rather than using a midpoint or zero.

## Conclusion

This PDF is useful for identifying the components and conditional logic. The official announcements support the main zero-commission policies, but the PDF does not provide a complete exact fee schedule. In particular, the fashion-jewellery row, Rs 1,000 threshold, collection rates, fixed-fee matrix and shipping schedule need resolution before they can drive accurate production calculations. No app changes are part of this analysis.
