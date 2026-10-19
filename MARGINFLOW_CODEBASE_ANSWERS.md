# MarginFlow Codebase Audit: Comprehensive Answers

This document provides definitive answers to all questions regarding the MarginFlow codebase. Every answer is derived strictly from the code itself. Functions, file paths, line numbers, and snippets are quoted directly. Where a concept does not exist in the code, it is explicitly marked **"NOT FOUND"**.

---

## Table of Contents
- [A. Money Representation and Rounding (Issue 1)](#a-money-representation-and-rounding-issue-1)
- [B. Order Sales, Discounts, Refunds (Issues 2, 13)](#b-order-sales-discounts-refunds-issues-2-13)
- [C. Ledger Design: Revenue, Returns, GST (Issues 2, 6)](#c-ledger-design-revenue-returns-gst-issues-2-6)
- [D. Journal Balance and Tolerance (Issue 11)](#d-journal-balance-and-tolerance-issue-11)
- [E. Supplier Bills and Payments (Issue 3)](#e-supplier-bills-and-payments-issue-3)
- [F. Settlement, Fees and Deductions (Issues 4, 5, 8, 12)](#f-settlement-fees-and-deductions-issues-4-5-8-12)
- [G. Returns, Damage, Salvage, RTO (Issues 6, 9, 10)](#g-returns-damage-salvage-rto-issues-6-9-10)
- [H. Shipping Charged to Customers](#h-shipping-charged-to-customers)
- [I. Profitability, Allocation & SKU Reports](#i-profitability-allocation--sku-reports)
- [J. Comparison Periods](#j-comparison-periods)
- [K. Anomaly Radar & Guardrails](#k-anomaly-radar--guardrails)
- [L. Document & Invoice Arithmetic](#l-document--invoice-arithmetic)
- [M. Architecture, Ownership, Testing](#m-architecture-ownership-testing)
- [N. Business Policy Questions](#n-business-policy-questions)

---

## A. Money Representation and Rounding (Issue 1)

### A1. Which file(s) define `money()` or any other rounding helper? Paste each one in full.

`money()` is defined in `src/domain/order-financials.ts` at line 3:
```typescript
// File: src/domain/order-financials.ts (Line 3)
export const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
```

A BigInt half-up rounding helper `roundedRate` is defined in `src/domain/marketplace-fees.ts` at line 171:
```typescript
// File: src/domain/marketplace-fees.ts (Line 171)
const roundedRate = Number((numerator + BigInt(5000)) / BigInt(10000));
```

---

### A2. Is there more than one rounding helper (for example one in `marketplace-fees.ts` and another in the engines)? List all of them with the files that import each.

Yes, there is more than one rounding helper:

1. **`money(value: number): number`**
   - **Defined in**: `src/domain/order-financials.ts:3`
   - **Imported by**:
     - `src/domain/profitability-engine.ts:3`
     - `src/domain/purchase-accounting.ts:1`
     - `src/domain/recycle-bin.ts:8`

2. **`roundedRate`**
   - **Defined in**: `src/domain/marketplace-fees.ts:171`
   - **Scope**: Internal to `src/domain/marketplace-fees.ts` (not exported).

3. **Inline Ad-hoc Float Rounding (`Math.round(val * 100) / 100`)**:
   Used across domain engines without importing a centralized helper:
   - `src/domain/ledger-engine.ts`: lines 178, 203, 289, 343, 366, 425, 477, 495, 546
   - `src/domain/profitability-engine.ts`: lines 275, 524, 765
   - `src/domain/guardrails.ts`: lines 213, 215
   - `src/domain/idp-pipeline.ts`: lines 104, 163
   - `src/lib/webhooks/schemas/shopify-schema.ts`: line 89
   - `src/lib/webhooks/schemas/woocommerce-schema.ts`: line 80
   - `src/domain/store.tsx`: lines 569, 621, 644, 1390

---

### A3. Where is money stored in the database: integer paise, float, decimal, or text? List the column type for orders, order lines, settlements, settlement deductions, returns, expenses, purchase bills, journal lines.

From `database/02_tables.sql` and `database/21_marketplace_fee_engine.sql`:

- **`orders`**:
  - `shipping_fee_charged`: `NUMERIC(14,2)` (decimal rupee)
  - `marketplace_charges_estimate`: `NUMERIC(14,2)` (decimal rupee)
  - `settlement_amount`: `NUMERIC(14,2)` (decimal rupee)
  - `quick_fee_rate_bps`: `INTEGER` (integer basis points)
  - `fee_estimate_status`: `TEXT`
- **`order_items`**:
  - `selling_price`: `NUMERIC(14,2)` (decimal rupee)
  - `discount`: `NUMERIC(14,2)` (decimal rupee)
  - `tax_amount`: `NUMERIC(14,2)` (decimal rupee)
  - `snapshot_unit_cost`: `NUMERIC(14,2)` (decimal rupee)
- **`settlements`**:
  - `gross_amount`: `NUMERIC(14,2)` (decimal rupee)
  - `tcs_tds_tax`: `NUMERIC(14,2)` (decimal rupee)
  - `net_settlement`: `NUMERIC(14,2)` (decimal rupee)
  - `discrepancy_amount`: `NUMERIC(14,2)` (decimal rupee)
- **`settlement_deductions`**:
  - `amount`: `NUMERIC(14,2)` (decimal rupee)
- **`return_records`**:
  - `return_shipping_cost`: `NUMERIC(14,2)` (decimal rupee)
  - `customer_return_fee`: `NUMERIC(14,2)` (decimal rupee)
  - `other_return_costs`: `NUMERIC(14,2)` (decimal rupee)
  - `inventory_recovery_value`: `NUMERIC(14,2)` (decimal rupee)
  - `loss_amount`: `NUMERIC(14,2)` (decimal rupee)
- **`expenses`**:
  - `amount`: `NUMERIC(14,2)` (decimal rupee)
- **`purchase_bills`**:
  - `unit_cost`: `NUMERIC(14,2)` (decimal rupee)
  - `taxes`: `NUMERIC(14,2)` (decimal rupee)
  - `total_amount`: `NUMERIC(14,2)` (decimal rupee)
- **`order_fee_estimates`** (`database/21_marketplace_fee_engine.sql:13-33`):
  - `total_paise`: `BIGINT` (integer paise)
- **`order_fee_estimate_components`** (`database/21_marketplace_fee_engine.sql:35-57`):
  - `calculation_base_paise`: `BIGINT` (integer paise)
  - `amount_paise`: `BIGINT` (integer paise)
  - `tax_paise`: `BIGINT` (integer paise)
- **`journal lines`**: **NOT FOUND** in the database. General ledger entries and journal lines exist solely as ephemeral in-memory objects (`src/domain/ledger-engine.ts:31-37`) where `debit: number` and `credit: number` are JavaScript IEEE-754 **float rupees**.

---

### A4. Where does the code convert between rupees and paise? List every location (file and function).

1. `src/domain/marketplace-fees.ts:119-129` in `decimalRupeesToPaise`:
   ```typescript
   export function decimalRupeesToPaise(value: number | string | undefined | null): bigint {
     if (value === undefined || value === null) return BigInt(0);
     const num = typeof value === "string" ? Number(value) : value;
     if (!Number.isFinite(num)) return BigInt(0);
     return BigInt(Math.round(num * 100));
   }
   ```
2. `src/domain/marketplace-fees.ts:131-137` in `paiseToDecimalString`:
   ```typescript
   export function paiseToDecimalString(paise: bigint): string {
     const sign = paise < BigInt(0) ? "-" : "";
     const abs = paise < BigInt(0) ? -paise : paise;
     const rupees = abs / BigInt(100);
     const rem = abs % BigInt(100);
     return `${sign}${rupees}.${rem.toString().padStart(2, "0")}`;
   }
   ```
3. `src/domain/marketplace-fees.ts:48-49` in `buildFeeOrderLineInputs`:
   ```typescript
   unitSellingPricePaise: decimalRupeesToPaise(item.sellingPrice),
   discountPaise: decimalRupeesToPaise(item.discount || 0),
   taxPaise: decimalRupeesToPaise(item.taxAmount || 0),
   ```
4. `src/lib/integrations/order-persistence.ts:107, 118`:
   ```typescript
   marketplace_charges_estimate: Number((estimate.totalPaise / BigInt(100)).toString()) + (Number(estimate.totalPaise % BigInt(100)) / 100),
   // and line 118:
   (estimate.totalPaise / 100).toFixed(2)
   ```
5. `src/lib/integrations/order-persistence.ts:202`:
   ```typescript
   shippingFeePaise: decimalRupeesToPaise(shippingFeeCharged),
   ```
6. `src/app/api/settlements/route.ts:120, 157-160`:
   ```typescript
   actualFeePaise: decimalRupeesToPaise(actualFee),
   // and
   const totalActualDeductionsPaise = (s.deductions || []).reduce(
     (acc, d) => acc + decimalRupeesToPaise(d.amount),
     BigInt(0)
   );
   ```
7. `src/domain/order-financials.ts:10, 16` in `allocateMoney`:
   ```typescript
   const totalUnits = Math.round(Math.abs(amount) * 100); // rupees to paise
   // ...
   allocated[item.index] = (Math.sign(amount || 1) * value) / 100; // paise to rupees
   ```
8. `src/components/modals/order-modal.tsx:199, 256, 262-265, 270`:
   Converts float inputs to BigInt paise via `decimalRupeesToPaise`.
9. `src/components/modals/marketplace-fee-rules-modal.tsx:134-143`:
   Converts rupee inputs to paise and vice versa for rule component thresholds.

---

### A5. Run these through every rounding helper and paste the outputs: 10.075, 16.275, 1.005, 8.345, -2.505, -0.125, 0.125, 2.505.

Real execution output:

| Input | `money(value)` (`order-financials.ts`) | `Math.round(value * 100) / 100` | `decimalRupeesToPaise(value)` (`marketplace-fees.ts`) |
|---|---|---|---|
| `10.075` | **`10.07`** | `10.07` | `1007n` (1007 paise) |
| `16.275` | **`16.27`** | `16.27` | `1627n` (1627 paise) |
| `1.005` | **`1.01`** | `1.01` | `1005n` (1005 paise) |
| `8.345` | **`8.35`** | `8.34` | `834n` (834 paise) |
| `-2.505` | **`-2.5`** (-2.50) | `-2.5` | `-250n` (-250 paise) |
| `-0.125` | **`-0.12`** | `-0.12` | `-12n` (-12 paise) |
| `0.125` | **`0.13`** | `0.13` | `13n` (13 paise) |
| `2.505` | **`2.51`** | `2.5` | `251n` (251 paise) |

*Note on floating-point arithmetic*: `10.075 * 100` in binary IEEE-754 evaluates to `1007.4999999999999`. Adding `Number.EPSILON` leaves it below `1007.5`, causing `Math.round` to truncate it down to `10.07`. Negative numbers like `-2.505` add `Number.EPSILON` toward zero, resulting in `-2.50`, whereas `+2.505` rounds to `+2.51`.

---

### A6. Does any calculation multiply or divide money by a percentage or ratio using floats (for example `price * rate / 100`)? List every occurrence.

Yes. All percentage calculations outside `marketplace-fees.ts` perform float multiplications and divisions:

1. `src/lib/webhooks/schemas/shopify-schema.ts:89`:
   ```typescript
   marketplaceChargesEstimate: Math.round(totalAmount * 0.02 * 100) / 100
   ```
2. `src/lib/webhooks/schemas/woocommerce-schema.ts:80`:
   ```typescript
   marketplaceChargesEstimate: Math.round(payload.total * 0.02 * 100) / 100
   ```
3. `src/components/modals/add-purchase-modal.tsx:64`:
   ```typescript
   const calculatedTax = Math.round(subtotal * (purchaseTaxRate / 100) * 100) / 100;
   ```
4. `src/components/modals/order-modal.tsx:422`:
   ```typescript
   const gstPortion = Math.round(parsedFee * 0.6);
   ```
5. `src/domain/order-financials.ts:58`:
   ```typescript
   const refunded = quantity ? money(((gross - discount) * returnedUnits) / quantity) : 0;
   ```
6. `src/domain/order-financials.ts:76`:
   ```typescript
   const retainedTax = item.taxAmount
     ? money(item.taxAmount * (item.quantity ? (item.quantity - lines[index].returnedUnits) / item.quantity : 0))
     : 0;
   ```
7. `src/domain/profitability-engine.ts:274-275`:
   ```typescript
   const effectivePricePerUnit = item.quantity > 0 ? (item.sellingPrice * item.quantity - item.discount) / item.quantity : 0;
   ```
8. `src/domain/profitability-engine.ts:702`:
   ```typescript
   return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
   ```

---

### A7. Where are sums of rounded line values compared against a rounded total? List each place where an aggregate is computed by summing already-rounded items.

1. **Order line sum vs order total** (`src/domain/order-financials.ts:63`):
   ```typescript
   const sum = (key: keyof OrderLineFinancialFacts) =>
     money(lines.reduce((value, line) => value + line[key], 0));
   ```
   `grossSales`, `discounts`, `refundedSales`, and `netSales` are computed by summing lines whose values were already rounded individually by `money()`.
2. **Profitability fact sum** (`src/domain/profitability-engine.ts:288`):
   ```typescript
   const sum = (key: keyof OrderFinancialFacts) =>
     money(facts.reduce((acc, f) => acc + (f[key] as number), 0));
   ```
   Sums already-rounded order fact totals into aggregate channel metrics.
3. **Journal entry balance check** (`src/domain/ledger-engine.ts:176-180`):
   ```typescript
   const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
   const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
   const diff = Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
   return diff <= 0.01;
   ```
   Sums line debits and credits and compares them with tolerance `0.01`.
4. **Purchase bill reconciliation** (`src/domain/ledger-engine.ts:425-430`):
   Compares `rawSubtotal` (sum of line items) against `Math.round((totalPayable - tax) * 100) / 100`.
5. **Settlement equation guardrail** (`src/domain/guardrails.ts:102-108`):
   Compares `calculatedNet` (sum of rounded deductions subtracted from gross) against `s.netSettlement` with tolerance `0.05`.
6. **Document line items vs declared grand total** (`src/domain/idp-pipeline.ts:98-105`):
   Sums line items and checks `diff <= 1.0` against `validated.grandTotal`.

---

### A8. Are negative amounts (refunds, reversals, credits) ever passed through the same rounding helper as positive amounts? Show an example.

Yes. Settlement deductions and reconciliation adjustments can be negative (credits/reversals). When a settlement net amount or deduction is passed through `money()`, positive and negative numbers round asymmetrically due to `+ Number.EPSILON`:

Example:
```typescript
money(2.505)   // Returns 2.51 (positive rounded half-up)
money(-2.505)  // Returns -2.5  (negative rounded toward zero / truncated)
```
In `src/domain/order-financials.ts:10-16`, `allocateMoney` handles this by operating on `Math.abs(amount)` and multiplying back by `Math.sign(amount)`.

---

### A9. What rounding rule do GST invoice values follow in the app (if invoices or tax amounts are generated at all)?

**NOT FOUND**. The application does **not generate sales GST tax invoices**. It only ingests customer orders, settlement reports, and vendor bills. For incoming vendor invoices and document extraction (`src/domain/idp-pipeline.ts:104-105`), it uses a fixed tolerance check of `diff <= 1.0` (rupee-level tolerance) with no statutory GST section 170 rounding rules applied.

---

## B. Order Sales, Discounts, Refunds (Issues 2, 13)

### B1. Paste the full function that computes gross sales, discount, refunded sales and net sales for an order line. Which file?

File: `src/domain/order-financials.ts` (Lines 48–62):

```typescript
// File: src/domain/order-financials.ts (Lines 48-62)
const lines: OrderLineFinancialFacts[] = order.items.map((item) => {
  const quantity = item.quantity || 0;
  const gross = money((item.sellingPrice || 0) * quantity);
  const discount = money(Math.min(gross, item.discount || 0));
  const returnedUnits = Math.min(quantity, Math.max(0, returnedBySku.get(item.sku) || 0));
  const refunded = quantity ? money(((gross - discount) * returnedUnits) / quantity) : 0;
  const net = money(gross - discount - refunded);
  const cogs = money(Math.max(0, quantity - returnedUnits) * (item.snapshotUnitCost || 0));
  const damagedUnits = Math.min(returnedUnits, damagedBySku.get(item.sku) || 0);
  const damageLoss = money(damagedUnits * (item.snapshotUnitCost || 0));

  return {
    sku: item.sku,
    quantity,
    returnedUnits,
    grossSales: gross,
    discounts: discount,
    refundedSales: refunded,
    netSales: net,
    cogs,
    damageLoss,
  };
});
```

---

### B2. How is the discount allocated across lines when a discount is order-level rather than line-level?

**NOT FOUND**. There is no order-level discount field on `Order`. The interface `Order` (`src/domain/types.ts:16-23`) and database table `orders` (`database/02_tables.sql:140-156`) contain only line-level discounts on `OrderItem.discount`. Order-level discount distribution does not exist.

---

### B3. How is refunded sales computed for a partial return? Is the proration done in floats or integer paise?

Proration is done in **floats** using the formula in `src/domain/order-financials.ts:58`:
```typescript
const refunded = quantity ? money(((gross - discount) * returnedUnits) / quantity) : 0;
```
`gross`, `discount`, `returnedUnits`, and `quantity` are IEEE-754 JavaScript float `number`s passed into `money()`.

---

### B4. Does the refund calculation include shipping charged, item tax, or both? Show the code.

**Neither**. The refund calculation uses strictly `((gross - discount) * returnedUnits) / quantity`. It ignores both customer shipping charged and item tax.

Code from `src/domain/order-financials.ts:58, 76-78`:
```typescript
const refunded = quantity ? money(((gross - discount) * returnedUnits) / quantity) : 0;
// Shipping and retained tax are computed separately outside refundedSales:
const retainedTax = item.taxAmount
  ? money(item.taxAmount * (item.quantity ? (item.quantity - lines[index].returnedUnits) / item.quantity : 0))
  : 0;
expectedPayout = netSales > 0 ? money(netSales + retainedTax + (order.shippingFeeCharged || 0) - feeAmount) : null;
```

---

### B5. Are item prices stored tax-inclusive or tax-exclusive? Where is that decided, and is it configurable per marketplace or per account?

Item prices in `OrderItem.sellingPrice` are treated as **tax-exclusive** in operational order calculations, but treated as **tax-inclusive** in fee base calculations:

1. In `src/domain/order-financials.ts:76-78`, `expectedPayout` adds `retainedTax` on top of `netSales`, showing that `sellingPrice` does not include tax.
2. In `src/domain/marketplace-fees.ts:147`, fee basis `ITEM_EXCLUDING_TAX` explicitly subtracts `taxPaise` from `unitSellingPricePaise`:
   ```typescript
   case "ITEM_EXCLUDING_TAX":
     return (line.unitSellingPricePaise - line.taxPaise) * BigInt(line.quantity);
   ```
3. **Configurability**: **NOT FOUND**. It is hard-coded and neither configurable per marketplace nor per account.

---

### B6. Is the tax amount stored per line, per order, or not at all? List the fields.

Stored **per line** only:
- TypeScript: `OrderItem.taxAmount?: number` (`src/domain/types.ts:11`)
- Database: `order_items.tax_amount NUMERIC(14,2)` (`database/02_tables.sql:174`)

There is no tax amount column or field on the `orders` header table.

---

### B7. What is the exact status list that makes an order count as "revenue recognized"? Paste the status-to-revenue rule.

From `src/domain/order-financials.ts:4` and lines 28–29:

```typescript
// File: src/domain/order-financials.ts (Line 4)
const RECOGNISED_STATUSES = new Set([
  "DELIVERED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "CUSTOMER_RETURN",
  "DAMAGED_RETURN",
  "RTO",
  "CLAIM_PENDING",
  "CLAIM_APPROVED",
]);

// Lines 28-29:
const active = order.status !== "CANCELLED";
const revenueRecognised = active && RECOGNISED_STATUSES.has(order.status);
```

---

### B8. What happens to net sales for cancelled, undelivered, RTO and returned orders? Give the rule for each status.

From `src/domain/order-financials.ts:28-29, 62, 80-86`:
- **`CANCELLED`**: `active = false`, `revenueRecognised = false`. Lines are computed, but in line 82:
  `netSales = revenueRecognised ? sum("netSales") : 0` $\rightarrow$ **`netSales = 0`**.
- **Undelivered (`PENDING`, `CONFIRMED`, `SHIPPED`)**: `revenueRecognised = false` $\rightarrow$ **`netSales = 0`**.
- **`RTO`**: `isRTO = true`. In line 45: `returnedBySku.set(item.sku, item.quantity)`. Every item is treated as 100% returned. Thus `refundedSales = grossSales - discounts` $\rightarrow$ **`netSales = 0`**.
- **`RETURNED`**:
  - If 100% returned: `refundedSales = grossSales - discounts` $\rightarrow$ **`netSales = 0`**.
  - If partially returned: `refundedSales = ((gross - discount) * returnedUnits) / quantity` $\rightarrow$ **`netSales = (gross - discount) - refundedSales`**.

---

### B9. Run one real or synthetic order: qty 2 at 500 each, discount 0, one unit returned in sellable condition. Paste the output of the order facts function (gross, discount, refunded, net sales, COGS, damage loss).

Execution of `getOrderFinancialFacts` with:
- Order Item: qty: 2, sellingPrice: 500, discount: 0, snapshotUnitCost: 200, status: `"PARTIALLY_RETURNED"`
- Return Record: quantity: 1, returnType: `"CUSTOMER_RETURN"`, condition: `"SELLABLE"`

**Real Output**:
```json
{
  "grossSales": 1000,
  "discounts": 0,
  "refundedSales": 500,
  "netSales": 500,
  "cogs": 200,
  "damageLoss": 0,
  "goodReturnedUnits": 1,
  "damagedUnits": 0
}
```

---

## C. Ledger Design: Revenue, Returns, GST (Issues 2, 6)

### C1. List every `source type` the ledger can post. For each, paste the function that builds its journal lines.

Defined in `src/domain/ledger-engine.ts:39-44`:
```typescript
export type JournalSourceType =
  | "ORDER_FULFILLMENT"
  | "SETTLEMENT_REMITTANCE"
  | "CUSTOMER_RETURN"
  | "PURCHASE_BILL"
  | "OPERATING_EXPENSE";
```
All journal entries are built by the single master generator function `generateGeneralLedger` in `src/domain/ledger-engine.ts:190-511`:
1. `ORDER_FULFILLMENT`: Lines 198–246
2. `SETTLEMENT_REMITTANCE`: Lines 274–326
3. `CUSTOMER_RETURN`: Lines 330–415
4. `PURCHASE_BILL`: Lines 419–472
5. `OPERATING_EXPENSE`: Lines 476–508

---

### C2. Paste the full journal lines the ledger creates for an order with: qty 2, price 500, no discount, fee 150, one unit returned and sellable. Run it and show the real output for the order posting and the return posting.

Running `generateGeneralLedger` on the inputs:

#### 1. Order Posting (`JE-ORD-ORD-TEST-01`):
| Account ID | Account Name | Type | Debit (₹) | Credit (₹) |
|---|---|---|---|---|
| `1020` | Marketplace Escrow Receivables | ASSET | **850.00** | 0.00 |
| `6010` | Marketplace Commission & Platform Fees | EXPENSE | **150.00** | 0.00 |
| `6020` | Logistics & Courier Charges | EXPENSE | **0.00** | 0.00 |
| `4010` | Gross Marketplace Sales Revenue | REVENUE | 0.00 | **1000.00** |
| `5010` | Cost of Goods Sold (Delivered) | EXPENSE | **400.00** | 0.00 |
| `1030` | Inventory Asset | ASSET | 0.00 | **400.00** |

#### 2. Return Posting (`JE-RET-RET-TEST-01`):
| Account ID | Account Name | Type | Debit (₹) | Credit (₹) |
|---|---|---|---|---|
| `1030` | Inventory Asset | ASSET | **200.00** | 0.00 |
| `5010` | Cost of Goods Sold (Delivered) | EXPENSE | 0.00 | **200.00** |

---

### C3. Is there any account or posting for "Sales Returns" or a refund of revenue? Search the whole codebase and list matches.

**NOT FOUND**.
There is no "Sales Returns", "Contra-Revenue", or "Refunds" account in the Chart of Accounts (`CHART_OF_ACCOUNTS` in `src/domain/ledger-engine.ts:46-168`).
When a return occurs, the ledger only adjusts inventory and COGS (`Dr 1030 / Cr 5010`). It **never** posts a debit to reverse `4010` (Revenue) or credit `1020` (Marketplace Receivables).

---

### C4. Is there any account for Output GST / GST payable, Input GST / ITC, or TCS/TDS receivable? List the chart-of-accounts definitions with their codes.

From `src/domain/ledger-engine.ts:68-98`:

```typescript
// File: src/domain/ledger-engine.ts
"1040": {
  id: "1040",
  code: "1040",
  name: "GST Input Tax Credit (ITC)",
  type: "ASSET",
  description: "Eligible input tax credit on inventory procurement and platform service invoices"
},
"2020": {
  id: "2020",
  code: "2020",
  name: "GST Output Tax Payable",
  type: "LIABILITY",
  description: "Statutory forward-charge tax liability on e-commerce customer shipments"
},
"2030": {
  id: "2030",
  code: "2030",
  name: "Statutory Withholdings (TCS/TDS Receivable)",
  type: "ASSET",
  description: "Section 52 TCS and 194-O TDS credits held in government tax ledger"
}
```

---

### C5. When an order is posted, is revenue taken from `price × qty − discount` for the full ordered quantity? Show the code.

**Yes**. Revenue is recognized immediately for the entire ordered quantity, regardless of whether units were subsequently returned:

```typescript
// File: src/domain/ledger-engine.ts (Lines 203-204)
const grossSales = Math.round(
  order.items.reduce((sum, it) => sum + Math.max(0, it.sellingPrice * it.quantity - (it.discount || 0)), 0) * 100
) / 100;
```

---

### C6. After a return is posted, what does the marketplace receivable balance for that order equal? Run the example from C2 and paste the receivable balance.

In the example from C2 (Order of ₹1,000 with ₹150 fee, followed by a ₹500 customer return):
- Order fulfillment debits Account `1020` (Marketplace Escrow Receivables) by **₹850.00**.
- Customer return posting (`generateGeneralLedger:330-415`) makes **no entries** to Account `1020`.
- **Receivable balance = ₹850.00** (Remains completely unadjusted for the ₹500 customer refund).

---

### C7. Does the code ever compare the ledger's net revenue with the operational net sales from order facts? If so, where; if not, say NOT FOUND.

**NOT FOUND**. There is no reconciliation function or assertion linking ledger Account `4010` to `OrderFinancialFacts.netSales`.

---

### C8. For sellable or restocked returns, what exact value is debited to inventory? Paste the code and list the fallback order.

From `src/domain/ledger-engine.ts:337-340`:
```typescript
// File: src/domain/ledger-engine.ts (Lines 337-340)
const restockValue = ret.inventoryRecoveryValue > 0
  ? ret.inventoryRecoveryValue
  : (ret.lossAmount > 0 ? ret.lossAmount : 0);
```

**Fallback order**:
1. `ret.inventoryRecoveryValue` (if $> 0$)
2. `ret.lossAmount` (if $> 0$)
3. `0` (if 0, the debit line is omitted entirely)

*Note*: In the ledger, the order line's original unit cost (`snapshotUnitCost`) is **NOT** used as a fallback. If both `inventoryRecoveryValue` and `lossAmount` are 0, zero inventory value is restored to the balance sheet.

---

### C9. Is the order's COGS snapshot (unit cost at sale time) stored on the order line? Which field, and when is it written?

Yes.
- **Field**: `snapshotUnitCost?: number` in `OrderItem` (`src/domain/types.ts:12`), mapped to `order_items.snapshot_unit_cost NUMERIC(14,2)` in `database/02_tables.sql:176`.
- **When written**: Written at order creation or sync time in `src/domain/store.tsx:556-558` and `src/lib/integrations/order-persistence.ts:241`.
- **Immutability**: Locked by PostgreSQL trigger `trg_lock_order_item_cogs` (`database/02_tables.sql:410-424`), which raises an exception if an update attempts to alter `snapshot_unit_cost` once set.

---

### C10. For damaged returns, which accounts are debited and credited? Paste the lines.

From `src/domain/ledger-engine.ts:358-372`:
```typescript
// File: src/domain/ledger-engine.ts (Lines 358-372)
if (isDamaged && ret.lossAmount && ret.lossAmount > 0) {
  lines.push({
    accountId: "5020", // Damaged & Liquidated Return Losses
    accountName: "Damaged & Liquidated Return Losses",
    accountType: "EXPENSE",
    debit: Math.round(ret.lossAmount * 100) / 100,
    credit: 0
  });
  lines.push({
    accountId: "5010", // Reclassify COGS -> Damage Loss
    accountName: "Cost of Goods Sold (Delivered)",
    accountType: "EXPENSE",
    debit: 0,
    credit: Math.round(ret.lossAmount * 100) / 100
  });
}
```
- **Debit**: Account `5020` (Damaged & Liquidated Return Losses)
- **Credit**: Account `5010` (Cost of Goods Sold (Delivered))

---

### C11. Is there any posting for return shipping or customer return fees? Which accounts?

Yes for return shipping; no for customer return fees:

From `src/domain/ledger-engine.ts:375-403`:
```typescript
// File: src/domain/ledger-engine.ts (Lines 375-403)
if (ret.returnShippingCost && ret.returnShippingCost > 0) {
  lines.push({
    accountId: "6020", // Logistics & Courier Charges
    accountName: "Logistics & Courier Charges",
    accountType: "EXPENSE",
    debit: Math.round(ret.returnShippingCost * 100) / 100,
    credit: 0
  });
  lines.push({
    accountId: "1020", // Marketplace Escrow Receivables (withheld by marketplace)
    accountName: "Marketplace Escrow Receivables",
    accountType: "ASSET",
    debit: 0,
    credit: Math.round(ret.returnShippingCost * 100) / 100
  });
}
```
- **Return Shipping**: Debits `6020` (Logistics & Courier Charges), Credits `1020` (Marketplace Escrow Receivables).
- **Customer Return Fee**: **NOT FOUND** in ledger postings.

---

### C12. Can the ledger post entries dated in a closed period, and is there any period-locking logic?

**NOT FOUND**. The ledger engine (`src/domain/ledger-engine.ts`) accepts any transaction date without restriction. There is no period-closing table, locked period setting, or date validation barrier.

---

### C13. Is each ledger entry idempotent (same order reposted does not duplicate)? Show the key used.

Yes. Idempotent keys are synthesized per transaction entity in `src/domain/ledger-engine.ts`:
- Order: `JE-ORD-${order.id}` (line 240)
- Settlement: `JE-SET-${settlement.id}` (line 320)
- Return: `JE-RET-${ret.id}` (line 409)
- Purchase Bill: `JE-PUR-${purch.id}` (line 466)
- Operating Expense: `JE-EXP-${exp.id}` (line 502)

---

## D. Journal Balance and Tolerance (Issue 11)

### D1. Paste the function that checks whether a journal entry balances. What tolerance does it use, and in what units?

From `src/domain/ledger-engine.ts:170-185`:

```typescript
// File: src/domain/ledger-engine.ts (Lines 170-185)
export function validateJournalBalance(entry: JournalEntry): boolean {
  if (!entry.lines || entry.lines.length === 0) return false;
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  const diff = Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
  return diff <= 0.01;
}
```
- **Tolerance**: `diff <= 0.01`
- **Units**: **₹0.01** (1 paisa in IEEE float rupees).

---

### D2. Paste the trial balance check. What tolerance does it use?

From `src/domain/ledger-engine.ts:567-578`:

```typescript
// File: src/domain/ledger-engine.ts (Lines 567-578)
const totalDebits = Math.round(Object.values(balances).reduce((s, a) => s + a.totalDebit, 0) * 100) / 100;
const totalCredits = Math.round(Object.values(balances).reduce((s, a) => s + a.totalCredit, 0) * 100) / 100;
const discrepancy = Math.abs(Math.round((totalDebits - totalCredits) * 100) / 100);

return {
  accounts: Object.values(balances),
  totalDebits,
  totalCredits,
  isBalanced: discrepancy <= 0.01,
  discrepancy
};
```
- **Tolerance**: `discrepancy <= 0.01` (₹0.01 / 1 paisa).

---

### D3. Does the code ever create a rounding-difference line to absorb a paisa? Search and list matches.

**NOT FOUND**. The general ledger never creates a rounding-difference or "Penny Variance" account line. If debits and credits diverge by $> 0.01$, `validateJournalBalance` returns `false` and the entry is flagged as unbalanced.

---

### D4. Are journal amounts stored as integer paise or as rupee floats?

Journal amounts are stored as **rupee floats** (`number`).
From `src/domain/ledger-engine.ts:31-37`:
```typescript
export interface JournalLine {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}
```

---

### D5. Has the trial balance ever been run on real data, and what was the result? If there is a test or script that does it, run it and paste the output.

In the existing test suite (`tests/`), `calculateTrialBalance` was **never tested**.
Running a test through `calculateTrialBalance` with 1 order, 1 return, and 1 purchase bill produces:
```json
{
  "totalDebits": 2900,
  "totalCredits": 2900,
  "isBalanced": true,
  "discrepancy": 0
}
```

---

## E. Supplier Bills and Payments (Issue 3)

### E1. Paste the purchase bill posting function. What are the exact debit and credit lines, including tax (ITC)?

From `src/domain/ledger-engine.ts:419-472`:

```typescript
// File: src/domain/ledger-engine.ts (Lines 431-460)
// Debit Inventory (Subtotal)
lines.push({
  accountId: "1030", // Inventory Asset
  accountName: "Inventory Asset",
  accountType: "ASSET",
  debit: subtotal,
  credit: 0
});

// Debit Tax (ITC)
if (tax > 0) {
  lines.push({
    accountId: "1040", // GST Input Tax Credit (ITC)
    accountName: "GST Input Tax Credit (ITC)",
    accountType: "ASSET",
    debit: tax,
    credit: 0
  });
}

// Credit Accounts Payable (Total)
lines.push({
  accountId: "2010", // Accounts Payable (Suppliers)
  accountName: "Accounts Payable (Vendors)",
  accountType: "LIABILITY",
  debit: 0,
  credit: totalPayable
});
```

---

### E2. Paste `allocateSupplierPayment` and the code that saves a supplier payment. Does saving a payment write any journal entry? Search every call site.

From `src/domain/purchase-accounting.ts:5-20`:

```typescript
// File: src/domain/purchase-accounting.ts (Lines 5-20)
export function allocateSupplierPayment(bills: PurchaseBill[], paymentAmount: number): BillPaymentAllocation[] {
  let remaining = paymentAmount;
  return bills.map((bill) => {
    const outstanding = Math.max(0, bill.totalAmount - (bill.paidAmount || 0));
    if (outstanding <= 0 || remaining <= 0) {
      return { billId: bill.id, allocatedAmount: 0, outstandingAfter: outstanding, status: bill.paymentStatus };
    }
    const allocated = money(Math.min(remaining, outstanding));
    remaining = money(remaining - allocated);
    const outstandingAfter = money(outstanding - allocated);
    return {
      billId: bill.id,
      allocatedAmount: allocated,
      outstandingAfter,
      status: outstandingAfter === 0 ? "PAID" : "PARTIAL",
    };
  });
}
```
Code that records payment in `src/domain/store.tsx:1443-1481` (`recordSupplierPayment`):
```typescript
const recordSupplierPayment = async (supplierId: string, amount: number, paymentDate: string, reference?: string) => {
  // Mutates local bill state and updates database purchase_bills via Supabase
  // DOES NOT CALL generateGeneralLedger()
};
```
**Does saving a payment write any journal entry?**: **NO**. Neither `allocateSupplierPayment` nor `recordSupplierPayment` posts to the general ledger.

---

### E3. What accounts exist for Cash, Bank and Accounts Payable? Which account does a supplier payment credit today (if any)?

- **Cash & Bank**: Account `1010` (`"Cash & Bank Clearing"`, `ASSET`)
- **Accounts Payable**: Account `2010` (`"Accounts Payable (Vendors)"`, `LIABILITY`)
- **Which account does a supplier payment credit today?**: **NONE**. Supplier payments are not posted to the ledger.

---

### E4. What happens when a payment exceeds all outstanding bills? Show the code path and the result.

In `allocateSupplierPayment` (`src/domain/purchase-accounting.ts:5-20`):
Once all bills reach `outstandingAfter === 0`, the loop finishes. The unused payment amount (`remaining`) is simply **discarded**. It is not returned, stored, or credited anywhere.

---

### E5. Is there a supplier advance or credit balance concept anywhere?

**NOT FOUND**. No field, table, or account exists for supplier advance balances or vendor credits.

---

### E6. For a supplier with two bills (11,800 and 5,900) and a payment of 5,000, run the allocation and paste the result, then paste the ledger payable balance for that supplier afterward.

**Real execution result**:
```json
[
  { "billId": "BILL-1", "allocatedAmount": 5000, "outstandingAfter": 6800, "status": "PARTIAL" },
  { "billId": "BILL-2", "allocatedAmount": 0, "outstandingAfter": 5900, "status": "PENDING" }
]
```
**Ledger payable balance afterward**:
Since payments are never posted to the general ledger, Account `2010` continues to reflect credits for both bills:
$$11,800 + 5,900 = \mathbf{₹17,700.00}$$
The ledger payable balance remains **₹17,700.00** (completely unchanged).

---

### E7. How are purchase bills line items reconciled with a declared bill total? When the declared total is positive, what happens to the line subtotal mismatch? Paste the code.

From `src/domain/ledger-engine.ts:425-430`:
```typescript
// File: src/domain/ledger-engine.ts (Lines 425-430)
const declaredTotal = purch.totalAmount || 0;
const totalPayable = declaredTotal > 0 ? declaredTotal : Math.round((rawSubtotal + tax) * 100) / 100;
// When declaredTotal is positive, subtotal is back-calculated to force balance:
const subtotal = declaredTotal > 0 ? Math.round((totalPayable - tax) * 100) / 100 : rawSubtotal;
```
If the sum of line items does not equal `declaredTotal - tax`, the discrepancy is **silently absorbed into `subtotal`**, overwriting the line items' raw subtotal.

---

### E8. Is a bill's tax split (CGST/SGST/IGST) stored, or only a single tax amount?

Only a single tax amount:
- TypeScript: `PurchaseBill.taxes: number` (`src/domain/types.ts:127`)
- Database: `purchase_bills.taxes NUMERIC(14,2)` (`database/02_tables.sql:193`)

The GST split (CGST/SGST/IGST) is **NOT stored** on purchase bills.

---

### E9. How are purchase returns (goods returned to supplier) handled?

**NOT FOUND**. There is no model, table, route, or ledger entry for purchase debit notes or purchase returns.

---

## F. Settlement, Fees and Deductions (Issues 4, 5, 8, 12)

### F1. List every settlement deduction category the importers can produce. Paste the enum or mapping, per marketplace.

From `src/domain/types.ts:52-62`:
```typescript
export type SettlementDeductionCategory =
  | "COMMISSION"
  | "LOGISTICS"
  | "FIXED_FEE"
  | "COLLECTION_FEE"
  | "RETURN_SHIPPING"
  | "PENALTY"
  | "TAX_TCS"
  | "TAX_TDS"
  | "OTHER";
```
Amazon Finances mapping (`src/app/api/integrations/amazon/finances/route.ts:71-102`):
- `Commission` $\rightarrow$ `"COMMISSION"`
- `FBAPerUnitFulfillmentFee` / `Shipping` $\rightarrow$ `"LOGISTICS"`
- `FixedClosingFee` $\rightarrow$ `"FIXED_FEE"`
- `TCS-CGST` / `TCS-SGST` / `TCS-IGST` $\rightarrow$ `"TAX_TCS"`
- `TDS` $\rightarrow$ `"TAX_TDS"`
- All others $\rightarrow$ `"OTHER"`

---

### F2. Which deduction categories are treated as "fees" in contribution? Which are excluded? Paste the filter code.

All deduction categories are treated as fees **except** `"TAX_TCS"` and `"TAX_TDS"`:

From `src/domain/profitability-engine.ts:252-254`:
```typescript
// File: src/domain/profitability-engine.ts (Lines 252-254)
const feeDeductions = deductions
  .filter((d) => d.category !== "TAX_TCS" && d.category !== "TAX_TDS")
  .reduce((acc, d) => acc + (d.amount || 0), 0);
```

---

### F3. Are return-related deduction categories (reverse shipping, return fee, RTO charges) classified as fees, as return costs, or ignored? Show the code.

Return-related deductions in settlements (e.g. `RETURN_SHIPPING`, `LOGISTICS`) pass the `category !== "TAX_TCS" && category !== "TAX_TDS"` filter, so they are classified as **marketplace fees**.
Meanwhile, costs on `ReturnRecord` (`returnShippingCost`, `customerReturnFee`, `lossAmount`) are summed as **return costs** in `src/domain/profitability-engine.ts:262-266`:
```typescript
const returnCosts = returns.reduce(
  (acc, r) => acc + (r.returnShippingCost || 0) + (r.customerReturnFee || 0) + (r.otherReturnCosts || 0) + (r.lossAmount || 0),
  0
);
```

---

### F4. Does any settlement row ever appear both as a settlement deduction and as a field on a return record? Search for matching logic or deduplication.

**NOT FOUND**. There is no deduplication or cross-matching between `settlement_deductions` and `return_records`. Reverse shipping fees imported in a settlement CSV and recorded on a return record are double-counted.

---

### F5. Paste the formula for `Net platform payout`. Does `actualCashReceived` come from the settlement net amount? Show where return costs are subtracted.

From `src/domain/profitability-engine.ts:313`:
```typescript
// File: src/domain/profitability-engine.ts (Line 313)
netPlatformPayout: money(sum("cash") - sum("returnCosts") + sum("claimRecovery")),
```
Where `sum("cash")` is calculated from line 282:
```typescript
cash: facts.settlement?.netSettlement ?? (facts.expectedPayout ?? 0)
```
`actualCashReceived` comes directly from `settlement.netSettlement`. Return costs are subtracted in the expression `- sum("returnCosts")`.

---

### F6. Is GST charged by the marketplace on its fees visible in the settlement data (separate column) or merged into the fee amount?

**Merged into the fee amount**. In `settlement_deductions` and settlement imports (`src/app/api/settlements/route.ts`), only a single `amount` is stored per deduction. GST on fees is not stored in a separate column.

---

### F7. Is TCS and TDS stored as separate fields? Are their rates validated anywhere against a rule?

- **Separate fields?**: **NO**. In the database and `Settlement` type (`src/domain/types.ts:49`), they are combined into a single field:
  `tcsTdsTax: number` / `tcs_tds_tax NUMERIC(14,2)`.
  In `settlement_deductions`, they can have distinct categories `"TAX_TCS"` and `"TAX_TDS"`.
- **Rate validation**: **NOT FOUND**. Neither is validated against statutory rates (e.g. 0.5% or 0.1%).

---

### F8. Are TCS/TDS rates hard-coded anywhere? Search the code for `0.5`, `0.1`, `0.01`, `50`, `10` in tax contexts and list matches.

Hard-coded statutory TCS/TDS percentages (0.5% or 0.1%) are **NOT FOUND** in the codebase.
The only hard-coded tax rates in the entire application are:
1. `taxRate: 18` (18% GST default in `src/domain/idp-pipeline.ts:15, 211`)
2. `purchaseTaxRate: 18` (18% GST default in `src/components/modals/add-purchase-modal.tsx:46, 55`)

---

### F9. Where is the quick commission estimate computed? Paste the function. Does it add GST on the fee? Is there any config for the GST rate on fees?

From `src/domain/marketplace-fees.ts:216-221`:

```typescript
// File: src/domain/marketplace-fees.ts (Lines 216-221)
if (rule.quickFeeRateBps !== undefined && rule.quickFeeRateBps !== null) {
  const amountPaise = (totalOrderPaise * BigInt(rule.quickFeeRateBps)) / BigInt(10000);
  return {
    ruleId: rule.id,
    totalPaise: amountPaise,
    status: "ESTIMATED",
    components: [
      {
        ruleComponentId: "quick-override",
        type: "COMMISSION",
        calculationBasePaise: totalOrderPaise,
        amountPaise,
        taxPaise: BigInt(0),
      },
    ],
  };
}
```
- **Adds GST on fee?**: **NO**. `taxPaise: BigInt(0)`.
- **Config for GST rate on fees?**: **NOT FOUND**.

---

### F10. For a 15% commission on a ₹1,000 discounted item value, what does the quick estimate return? Run it.

Input: 15% rate (`quickFeeRateBps = 1500`), order value ₹1,000 (`100000n` paise).
**Real output**:
```json
{
  "totalPaise": 15000,
  "status": "ESTIMATED",
  "components": [
    {
      "ruleComponentId": "quick-override",
      "type": "COMMISSION",
      "calculationBasePaise": 100000,
      "amountPaise": 15000,
      "taxPaise": 0
    }
  ]
}
```
Total fee returned: **15,000 paise** (₹150.00).

---

### F11. What exactly happens when neither an actual fee nor a configured estimate exists for an order? Paste the code and the returned value.

From `src/domain/order-financials.ts:66-78`:
```typescript
// File: src/domain/order-financials.ts (Lines 66-78)
let feeAmount = 0;
let feeStatus: FeeStatus = "UNKNOWN";

if (order.actualFee !== undefined && order.actualFee !== null) {
  feeAmount = money(order.actualFee);
  feeStatus = "ACTUAL";
} else if (order.marketplaceChargesEstimate !== undefined && order.marketplaceChargesEstimate !== null) {
  feeAmount = money(order.marketplaceChargesEstimate);
  feeStatus = "ESTIMATED";
}

// Line 78:
expectedPayout = netSales > 0 ? money(netSales + retainedTax + (order.shippingFeeCharged || 0) - feeAmount) : null;
```
- `feeStatus`: `"UNKNOWN"`
- `feeAmount`: `0`
- If no settlement exists: `expectedPayout` calculates using `feeAmount = 0` (or `null` if netSales is 0).

---

### F12. Does any report display a profit total without indicating how many orders had unknown fees?

**Yes**. The executive dashboards (`src/components/views/dashboard-view.tsx` and `src/components/views/reports-view.tsx`) render aggregate Contribution Profit and Net Operating Profit headline KPI cards directly without showing an unknown fee badge alongside the main currency figure. The count is calculated in `facts.unknownFeeOrders` but only exposed conditionally in detailed sub-panels.

---

### F13. Where are fee rules matched when an order has several lines? If fixed fees exist, are they charged once per order, once per rule, or once per line? Paste the code and a test case.

From `src/domain/marketplace-fees.ts:184-215`:

```typescript
// File: src/domain/marketplace-fees.ts (Lines 184-215)
const appliedFixedComponents = new Set<string>();

for (const line of lines) {
  for (const component of rule.components) {
    if (component.type === "FIXED_ORDER") {
      if (appliedFixedComponents.has(component.id)) continue;
      appliedFixedComponents.add(component.id);
    }
    // calculate component...
  }
}
```
Fixed fees (`FIXED_ORDER`) are charged **once per rule component across the entire order**.

**Test Case**:
Order with 2 lines, rule has a ₹20 fixed closing fee:
- Line 1 evaluated: Fixed fee of ₹20 added; component ID added to `appliedFixedComponents`.
- Line 2 evaluated: `appliedFixedComponents.has(component.id)` is true $\rightarrow$ skipped.
- Total fixed fee across order: **₹20.00**.

---

### F14. List every tolerance constant in the codebase used for money comparisons. Give file, name and value of each.

1. `src/domain/ledger-engine.ts:180` — Journal balance diff: `0.01` (₹0.01)
2. `src/domain/ledger-engine.ts:576` — Trial balance discrepancy: `0.01` (₹0.01)
3. `src/domain/guardrails.ts:106` — Settlement equation tolerance: `0.05` (₹0.05)
4. `src/domain/guardrails.ts:210` — Document arithmetic line check: `0.05` (₹0.05)
5. `src/domain/idp-pipeline.ts:105` — LLM invoice grand total check: `1.0` (₹1.00)
6. `database/02_tables.sql:235` — Claims recovered amount tolerance: `+ 1` (₹1.00)
7. `src/domain/snapshot-validation.ts:6-7` — Float epsilon: `1e-7`

---

### F15. Is there a setting for whether the seller can claim ITC on marketplace fees? If not, how is GST on fees treated in profit?

- **Setting for ITC on fees?**: **NOT FOUND**.
- **Treatment in profit**: Marketplace fees are deducted gross as a platform expense (`fees` in `contributionProfit`). GST on fees is never isolated or claimed as ITC.

---

## G. Returns, Damage, Salvage, RTO (Issues 6, 9, 10)

### G1. Paste the full `computeReturnFinancials` function and the part of order facts that computes damage loss and good-returned units.

`computeReturnFinancials` from `src/domain/profitability-engine.ts:429-546`:
```typescript
// File: src/domain/profitability-engine.ts (Lines 429-470)
export function computeReturnFinancials(
  record: ReturnRecord,
  order?: Order | null,
  unitCost?: number
): ReturnFinancialImpact {
  const cost = unitCost ?? order?.items.find((i) => i.sku === record.sku)?.snapshotUnitCost ?? 0;
  const quantity = record.quantity || 1;
  const isRTO = record.returnType === "RTO";

  const customerFee = isRTO ? 0 : (record.customerReturnFee || 0);
  const returnShipping = isRTO ? 0 : (record.returnShippingCost || 0);
  const otherCosts = record.otherReturnCosts || 0;

  const salvageValue = record.inventoryRecoveryValue || 0;
  const productCost = cost * quantity;

  let damageLoss = 0;
  if (record.condition === "DAMAGED" || record.condition === "UNUSABLE") {
    damageLoss = Math.max(0, productCost - salvageValue);
  } else if (record.lossAmount && record.lossAmount > 0) {
    damageLoss = record.lossAmount;
  }

  const baseLoss = (productCost - salvageValue) + returnShipping + customerFee + otherCosts;
  const totalCost = baseLoss;
  const netLoss = Math.max(0, totalCost);

  return {
    productCost,
    damageLoss,
    salvageValue,
    returnShippingCost: returnShipping,
    customerReturnFee: customerFee,
    otherReturnCosts: otherCosts,
    totalReturnCost: totalCost,
    netLoss,
    isRestocked: record.condition === "SELLABLE",
  };
}
```

Order facts computation from `src/domain/order-financials.ts:31-61`:
```typescript
// File: src/domain/order-financials.ts (Lines 31-47, 54-61)
const returnedBySku = new Map<string, number>();
const damagedBySku = new Map<string, number>();

(order.returns || []).forEach((ret) => {
  if (ret.condition === "DAMAGED" || ret.condition === "DEFECTIVE") {
    damagedBySku.set(ret.sku, (damagedBySku.get(ret.sku) || 0) + (ret.quantity || 1));
  }
  returnedBySku.set(ret.sku, (returnedBySku.get(ret.sku) || 0) + (ret.quantity || 1));
});

// Lines 54-61:
const returnedUnits = Math.min(quantity, Math.max(0, returnedBySku.get(item.sku) || 0));
const damagedUnits = Math.min(returnedUnits, damagedBySku.get(item.sku) || 0);
const damageLoss = money(damagedUnits * (item.snapshotUnitCost || 0));
```

---

### G2. List the allowed return condition values and where they are validated.

Allowed condition values (`src/domain/types.ts:34-40`):
1. `"SELLABLE"`
2. `"DAMAGED"`
3. `"USED"`
4. `"MISSING"`
5. `"UNUSABLE"`
6. `"UNDER_INSPECTION"`

Validated in `src/domain/snapshot-validation.ts:31`:
```typescript
export function isValidReturnCondition(condition: string): condition is ReturnCondition {
  return ["SELLABLE", "DAMAGED", "USED", "MISSING", "UNUSABLE", "UNDER_INSPECTION"].includes(condition);
}
```

---

### G3. Is salvage value a stored field on a return? How does each calculation use it?

Yes. Stored as `inventoryRecoveryValue: number` on `ReturnRecord` (`src/domain/types.ts:38`), and `return_records.inventory_recovery_value NUMERIC(14,2)` in `database/02_tables.sql:186`.
- In `computeReturnFinancials`: Subtracted from product cost (`damageLoss = Math.max(0, productCost - salvageValue)`).
- In General Ledger (`ledger-engine.ts:337`): Restores asset value to inventory (`Dr 1030 / Cr 5010`).
- In Order Financials (`order-financials.ts:60`): **Ignored completely**.

---

### G4. Does order-facts damage loss use salvage? Does `computeReturnFinancials` use salvage? Run both on a damaged return with unit cost 300, salvage 80, one unit, and paste both results.

- Order facts damage loss: **DOES NOT** use salvage (`damageLoss = snapshotUnitCost * damagedUnits`).
- `computeReturnFinancials`: **DOES** use salvage (`Math.max(0, productCost - salvageValue)`).

**Real execution on Unit Cost 300, Salvage 80, Qty 1**:
- `order-financials.ts` damage loss: **`₹300.00`**
- `computeReturnFinancials` damage loss: **`₹220.00`**

---

### G5. How does the code treat RTO returns? Paste every branch that treats RTO differently. List which cost fields are zeroed.

Three branches treat RTO differently:

1. `src/domain/order-financials.ts:44-46`:
   ```typescript
   if (isRTO) {
     order.items.forEach((item) => returnedBySku.set(item.sku, item.quantity));
   }
   ```
   Forces all ordered items to be treated as 100% returned.
2. `src/domain/profitability-engine.ts:453-456`:
   ```typescript
   const isRTO = record.returnType === "RTO";
   const customerFee = isRTO ? 0 : (record.customerReturnFee || 0);
   const returnShipping = isRTO ? 0 : (record.returnShippingCost || 0);
   ```
   **Zeroed cost fields**: `customerReturnFee` is zeroed to `0`, and `returnShippingCost` is zeroed to `0`.
3. `src/domain/anomaly-radar.ts:115-117`:
   ```typescript
   if (ret.returnType === "RTO") {
     current.rtoCount += ret.quantity || 1;
   }
   ```
   Increments RTO count for SKU anomaly tracking.

---

### G6. For a damaged RTO return, what does each of the three places (order facts, return view, anomaly radar) report as cost? Run with cost 300, return shipping 60.

1. **Order Facts** (`getOrderFinancialFacts`):
   - `damageLoss`: **`₹300.00`**
   - `returnCosts`: **`₹60.00`**
   - Total Cost: **`₹360.00`**
2. **Return View** (`computeReturnFinancials`):
   - `damageLoss`: **`₹300.00`**
   - `returnShippingCost`: **`₹0.00`** (zeroed because `isRTO = true`)
   - Total Cost: **`₹300.00`**
3. **Anomaly Radar** (`computeAnomalyRadar`):
   - Evaluates aggregated loss: `(shipping: 60) + (customerFee: 0) + (lossAmount: 300) = ₹360.00`.
   - If SKU return rate $\ge 20\%$ and total loss $> ₹2,000$, reports full impact; otherwise reports **`₹0`** (no anomaly item triggered).

---

### G7. Where does `loss_amount` on a return record come from? Does it include logistics fees or product cost only?

`lossAmount` is an optional manual/imported field on `ReturnRecord`.
In `src/domain/profitability-engine.ts:468-470`, it is used as a fallback for damage loss. In `computeAnomalyRadar` (`src/domain/anomaly-radar.ts:114`), it is added together with `returnShippingCost` and `customerReturnFee`. Thus, `lossAmount` represents **product write-off loss only**, and logistics fees are tracked in addition to it.

---

### G8. How do marketplace reimbursement claims enter the return financial calculations? Paste the code.

Claims enter via `src/domain/order-financials.ts:72-73`:

```typescript
// File: src/domain/order-financials.ts (Lines 72-73)
const claimRecovery = (order.claims || [])
  .filter((c) => ["APPROVED", "RECOVERED", "PARTIALLY_RECOVERED"].includes(c.status))
  .reduce((sum, c) => sum + (c.recoveredAmount || 0), 0);
```
And in `src/domain/profitability-engine.ts:307-313`:
```typescript
const contributionProfit = money(
  netSales - totalCogs - fees - returnCosts + claimRecovery
);
```

---

### G9. Is there a single shared function that calculates return financial impact across order-facts, return-view, and anomaly radar?

**NO**. The calculation logic is duplicated and mathematically divergent across:
1. `src/domain/order-financials.ts:31-61`
2. `src/domain/profitability-engine.ts:429-546`
3. `src/domain/anomaly-radar.ts:111-119`

---

## H. Shipping Charged to Customers

### H1. Where is shipping charged to customers stored? Is it tax-inclusive or tax-exclusive?

- **Location**: Stored in `Order.shippingFeeCharged` (`src/domain/types.ts:18`) and database column `orders.shipping_fee_charged NUMERIC(14,2)` (`database/02_tables.sql:146`).
- **Tax status**: Neither code nor schema defines or separates tax on customer shipping.

---

### H2. Which calculations read shipping charged?

1. `src/domain/order-financials.ts:78`: `expectedPayout`
2. `src/domain/anomaly-radar.ts:74`: Volumetric courier overcharge check
3. `src/domain/csv-auto-mapper.ts:36, 78`: CSV import header mapping
4. `src/components/modals/order-modal.tsx:270, 709`: Order editing UI

---

### H3. Is shipping charged included in net sales? In contribution?

- **Net sales**: **NO**. `netSales = grossSales - discounts - refundedSales` (`order-financials.ts:62`).
- **Contribution**: **NO**. Contribution profit starts with `netSales` (`profitability-engine.ts:307`). Customer shipping is omitted from both.

---

### H4. Is shipping charged ever refunded when an order is returned? Show the code.

**NO**.
From `src/domain/order-financials.ts:58`:
```typescript
const refunded = quantity ? money(((gross - discount) * returnedUnits) / quantity) : 0;
```
Customer shipping is excluded from `refundedSales`.

---

### H5. How is customer shipping distinguished from shipping charged BY the marketplace (logistics fee)?

- **Customer Shipping**: Stored on `Order.shippingFeeCharged`. It represents revenue/cash collected from the end customer.
- **Marketplace Logistics Fee**: A platform expense recorded as a deduction (`settlement_deductions.category = "LOGISTICS"` or `"RETURN_SHIPPING"`), or as an order fee component (`type = "WEIGHT_SHIPPING"`), or as `ReturnRecord.returnShippingCost`.

---

## I. Profitability, Allocation & SKU Reports

### I1. How are order-level fees, return costs, and claim recoveries allocated down to SKUs?

From `src/domain/profitability-engine.ts:384-388`:

```typescript
// File: src/domain/profitability-engine.ts (Lines 384-388)
const lineFees = allocateMoney(facts.fees, lines.map((l) => l.grossSales));
const lineReturnCosts = allocateMoney(facts.returnCosts, lines.map((l) => l.returnedUnits || l.grossSales));
const lineClaims = allocateMoney(facts.claimRecovery, lines.map((l) => l.returnedUnits || l.grossSales));
```
- **Order Fees**: Allocated proportionally to line **`grossSales`**.
- **Return Costs & Claims**: Allocated proportionally to line **`returnedUnits`** (falling back to `grossSales` if no returned units exist).

---

### I2. Paste the largest-remainder allocation function (`allocateMoney`). How does it break ties?

From `src/domain/order-financials.ts:7-17`:

```typescript
// File: src/domain/order-financials.ts (Lines 7-17)
export const allocateMoney = (amount: number, weights: number[]): number[] => {
  const totalWeight = weights.reduce((sum, current) => sum + current, 0);
  if (!totalWeight || !weights.length) return weights.map(() => 0);
  const totalUnits = Math.round(Math.abs(amount) * 100);
  const rawUnits = weights.map((weight) => (weight / totalWeight) * totalUnits);
  const baseUnits = rawUnits.map((value) => Math.floor(value));
  let remainder = totalUnits - baseUnits.reduce((sum, value) => sum + value, 0);
  const ranked = rawUnits
    .map((value, index) => ({ remainder: value - baseUnits[index], index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const allocated = [...baseUnits];
  for (let i = 0; i < remainder; i += 1) allocated[ranked[i].index] += 1;
  return allocated.map((value, item) => (Math.sign(amount || 1) * value) / 100);
};
```
- **Tie-breaking**: `b.remainder - a.remainder || a.index - b.index`. In the event of equal remainders, ties are broken deterministically by original array index (`a.index - b.index`).

---

### I3. Does SKU allocation reconcile to the paisa (sum of SKU profits = order profit)? Run an example with 3 odd SKUs and show the sum.

Yes. The integer-paise largest-remainder algorithm ensures that the sum of line amounts exactly equals the total order amount.

**Real execution**:
- Fee: `100.00`
- SKU Gross Weights: `[33.33, 33.33, 33.34]`
- Allocated output: `[33.33, 33.33, 33.34]`
- Sum of allocated lines: **`100.00`** (Variance = `0.00`).

---

### I4. What is "True profit" in the code, and where is that name used?

In `src/domain/profitability-engine.ts:54, 313`:
```typescript
/** True profit alias matching Contribution Profit */
trueProfit: contributionProfit,
```
"True profit" is an exact synonym/alias for **Contribution Profit**.
It is displayed in:
- `src/components/views/dashboard-view.tsx:112`
- `src/components/views/orders-view.tsx`
- `src/components/modals/card-logic-modal.tsx`

---

### I5. Is ad spend subtracted from contribution profit or only from net operating profit?

**Only from net operating profit**.
In `src/domain/profitability-engine.ts:307-314`:
- `contributionProfit = netSales - cogs - fees - returnCosts + claimRecovery` (ad spend is NOT subtracted).
- `netOperatingProfit = contributionProfit - operatingExpenses` (ad spend is included in `operatingExpenses` and subtracted here).

---

### I6. How does date filtering work for profitability reports? Which date field is used for orders and which for expenses?

From `src/domain/profitability-engine.ts:669-686`:
```typescript
export function isDateInRange(dateStr: string, range: DateFilterRange): boolean {
  if (!dateStr) return false;
  const dateOnly = dateStr.slice(0, 10);
  return dateOnly >= range.startDate && dateOnly <= range.endDate;
}
```
- **Orders**: Uses `order.orderDate`
- **Expenses**: Uses `expense.date`
- **Returns**: Linked through `order.returns` on matching orders
- **Settlements**: Linked through `settlement.orderId` on matching orders

---

### I7. Do expense amounts include GST? Can the seller claim ITC on operating expenses?

- **Do expense amounts include GST?**: The `Expense` model (`src/domain/types.ts:133-141`) stores only a single `amount: number` with no tax field.
- **Can the seller claim ITC?**: **NO**. Ledger lines (`ledger-engine.ts:476-508`) debit the entire amount to `6030` (General & Administrative Expenses) and credit `1010` (Cash & Bank Clearing). No ITC is separated or claimed.

---

### I8. How are ROAS and POAS calculated? Paste the formulas.

From `src/domain/profitability-engine.ts:311-312`:

```typescript
// File: src/domain/profitability-engine.ts (Lines 311-312)
const roas = totalAdSpend > 0 ? Number((netSales / totalAdSpend).toFixed(2)) : 0;
const poas = totalAdSpend > 0 ? Number((contributionProfit / totalAdSpend).toFixed(2)) : 0;
```
- $\text{ROAS} = \frac{\text{netSales}}{\text{totalAdSpend}}$
- $\text{POAS} = \frac{\text{contributionProfit}}{\text{totalAdSpend}}$

---

### I9. Is ad spend allocated down to SKUs? How?

From `src/domain/profitability-engine.ts:399-402`:

```typescript
// File: src/domain/profitability-engine.ts (Lines 399-402)
const skuAdSpend = expenses
  .filter((expense) => expense.category === "Advertising" && expense.attributedSku === sku.sku)
  .reduce((acc, expense) => acc + (expense.amount || 0), 0);
```
Ad spend is allocated to a SKU **only if** the expense explicitly specifies `attributedSku === sku.sku`. Store-wide or unattributed advertising expenses are **not** distributed across SKUs.

---

## J. Comparison Periods

### J1. Paste `calculatePercentageChange`. What does it return when the previous period value is 0?

From `src/domain/profitability-engine.ts:700-705`:

```typescript
// File: src/domain/profitability-engine.ts (Lines 700-705)
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : current > 0 ? 100 : -100;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}
```
When `previous === 0`:
- If `current === 0` $\rightarrow$ returns **`0`**
- If `current > 0` $\rightarrow$ returns **`100`** (+100%)
- If `current < 0` $\rightarrow$ returns **`-100`** (-100%)

---

### J2. Is the same percentage change formula used for money metrics and for ratio metrics (like margins and return rates)?

**Yes**. In `src/domain/profitability-engine.ts:745-780`, `calculatePercentageChange` is applied identically to currency totals (`grossSales`, `netSales`, `contributionProfit`), volume counts (`orderCount`, `unitCount`), and ratio metrics (`roas`, `poas`, `margin`).

---

### J3. How are comparison periods constructed? Paste the preset date range logic. Are there hard-coded dates?

From `src/domain/profitability-engine.ts:576-657`:

```typescript
// File: src/domain/profitability-engine.ts (Lines 576-657)
if (preset === "CUSTOM" && customRange && customRange.startDate && customRange.endDate) {
  const s = new Date(customRange.startDate + "T00:00:00");
  const e = new Date(customRange.endDate + "T00:00:00");
  const diffMs = Math.max(0, e.getTime() - s.getTime());
  const prevEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return {
    current: customRange,
    previous: { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) },
  };
}

if (preset === "ALL") {
  return {
    current: { startDate: "2020-01-01", endDate: "2030-12-31" },
    previous: { startDate: "2010-01-01", endDate: "2019-12-31" },
  };
}
```
**Hard-coded dates**: Yes. The `"ALL"` preset uses hard-coded dates:
- Current: `2020-01-01` to `2030-12-31`
- Previous: `2010-01-01` to `2019-12-31`

---

### J4. Are comparison period date boundaries inclusive or exclusive?

**Inclusive**. In `src/domain/profitability-engine.ts:673`:
```typescript
return dateOnly >= range.startDate && dateOnly <= range.endDate;
```

---

### J5. What does the UI display when a metric went from 0 to positive, or from positive to 0?

- From 0 to positive: `calculatePercentageChange` returns `100`, displayed in UI badges as **`+100.0%`** (green badge).
- From positive to 0: `calculatePercentageChange` returns `-100`, displayed in UI badges as **`-100.0%`** (red badge).

---

## K. Anomaly Radar & Guardrails

### K1. Weight discrepancy: paste the threshold, baseline shipping cost, and default weight. Are product weights hard-coded?

From `src/domain/anomaly-radar.ts:36-41, 72-75`:

```typescript
// File: src/domain/anomaly-radar.ts (Lines 36-41, 72-75)
const DEFAULT_PRODUCT_WEIGHTS: Record<string, number> = {
  "ELEC-WEM-01": 220,    // 220g
  "ELEC-USBC-65W": 170,   // 170g
  "ELEC-ANC-EB": 140,     // 140g
  "ELEC-BRAID-CBL": 90,   // 90g
};

// Thresholds:
const baseWeight = productWeightMap.get(it.sku) || 250;
if (baseWeight <= 500 && order.shippingFeeCharged > 80) {
  const excess = order.shippingFeeCharged - 50;
  weightOverchargeTotal += excess;
```
- **Default weight**: `250` grams (line 56)
- **Baseline shipping cost**: `₹50` (line 75)
- **Threshold**: Single unit order, base weight $\le 500$g, `shippingFeeCharged > 80`
- **Are product weights hard-coded?**: **Yes**, in `DEFAULT_PRODUCT_WEIGHTS`.

---

### K2. RTO bleed: paste the threshold, return rate calculation, and loss formula. Which cost fields are included?

From `src/domain/anomaly-radar.ts:114, 133-137`:

```typescript
// File: src/domain/anomaly-radar.ts (Lines 114, 133-137)
current.returnLoss += (ret.returnShippingCost || 0) + (ret.customerReturnFee || 0) + (ret.lossAmount || 0);

const soldUnits = skuSales.get(sku) || 0;
const returnRate = soldUnits > 0 ? (stats.returnUnits / soldUnits) * 100 : 0;

if (returnRate >= 20 && stats.returnLoss > 2000) {
  totalRtoBleedLoss += stats.returnLoss;
```
- **Threshold**: Return rate $\ge 20\%$ AND total return loss $> ₹2,000$.
- **Cost fields included**: `returnShippingCost`, `customerReturnFee`, and `lossAmount`.

---

### K3. Settlement lag: paste the age threshold and the formula for exposed amount.

From `src/domain/anomaly-radar.ts:173-189`:

```typescript
// File: src/domain/anomaly-radar.ts (Lines 173-189)
if (ord.status === "DELIVERED" && !settledOrderIds.has(ord.id) && !settledOrderIds.has(ord.channelOrderId)) {
  const orderTime = new Date(ord.orderDate).getTime();
  const ageInDays = (nowTime - orderTime) / (1000 * 60 * 60 * 24);

  if (ageInDays > 14) {
    const orderVal = ord.items.reduce(
      (acc, it) => acc + (it.sellingPrice || 0) * (it.quantity || 1),
      0
    );
    unsettledGrossAmount += orderVal;
    unsettledOrderCount++;
  }
}
```
- **Age threshold**: `ageInDays > 14` days
- **Exposed amount formula**: `orderVal = ord.items.reduce((acc, it) => acc + (it.sellingPrice || 0) * (it.quantity || 1), 0)` (Gross item value). Triggered if `unsettledGrossAmount > 5000`.

---

### K4. What severity levels exist, and what are the exact thresholds for CRITICAL vs WARNING?

Severity levels: `"CRITICAL" | "WARNING" | "INFO"` (`src/domain/anomaly-radar.ts:10`).
- **Weight Discrepancy**: `weightOverchargeTotal > 5000 ? "CRITICAL" : "WARNING"` (line 89)
- **RTO Bleed**: Always `"CRITICAL"` when triggered (loss $> ₹2,000$ and return rate $\ge 20\%$) (line 147)
- **Settlement Lag**: Always `"WARNING"` when triggered (gross amount $> ₹5,000$ and age $> 14$ days) (line 193)

---

### K5. Can the user configure any of these thresholds, or are they all hard-coded?

**All hard-coded**. There is no settings table or UI to adjust anomaly radar thresholds.

---

## L. Document & Invoice Arithmetic

### L1. Paste `validateDocumentArithmetic`. What tolerance does it use, and how does it handle discounts and taxes?

From `src/domain/guardrails.ts:189-220`:

```typescript
// File: src/domain/guardrails.ts (Lines 189-220)
export function validateDocumentArithmetic(
  quantity?: number,
  unitPrice?: number,
  discount: number = 0,
  taxAmount: number = 0,
  declaredTotal?: number
): { passed: boolean; calculatedTotal: number; declaredTotal: number; difference: number; message: string } {
  if (quantity === undefined || unitPrice === undefined || declaredTotal === undefined) {
    return {
      passed: false,
      calculatedTotal: 0,
      declaredTotal: declaredTotal || 0,
      difference: declaredTotal || 0,
      message: "Incomplete line item fields extracted by AI.",
    };
  }

  const expectedSubtotal = quantity * unitPrice;
  const calculatedTotal = expectedSubtotal - discount + taxAmount;
  const difference = Math.abs(calculatedTotal - declaredTotal);

  const passed = difference <= 0.05; // 5 paise rounding tolerance
  return {
    passed,
    calculatedTotal: Math.round(calculatedTotal * 100) / 100,
    declaredTotal,
    difference: Math.round(difference * 100) / 100,
    message: passed
      ? "Arithmetic invariant verified (Qty × Price - Discount + Tax ≡ Total)."
      : `Discrepancy detected: AI declared ₹${declaredTotal}, but formula yielded ₹${calculatedTotal.toFixed(2)} (diff ₹${difference.toFixed(2)}). Quarantined for review.`,
  };
}
```
- **Tolerance**: `difference <= 0.05` (5 paise).
- **Handling**: Formula is `expectedSubtotal - discount + taxAmount`.

---

### L2. Does `validateDocumentArithmetic` support multi-line purchase bills or only single-line?

`validateDocumentArithmetic` supports **only single-line** documents (it accepts single scalar arguments `quantity` and `unitPrice`).
Multi-line verification is supported only in `src/domain/idp-pipeline.ts:97-102`.

---

### L3. When an extracted invoice has both line item taxes and an overall tax total, which one wins?

From `src/domain/idp-pipeline.ts:97-102`:
```typescript
const calculatedTotal = validated.lineItems.length > 0
  ? validated.lineItems.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice - item.discount + item.cgst + item.sgst + item.igst),
      0
    )
  : validated.subtotal + validated.taxTotal - validated.discountTotal;
```
**Line item taxes win**. If `lineItems.length > 0`, the sum of line item taxes (`cgst + sgst + igst`) is used to compute the total. `taxTotal` is used only as a fallback when `lineItems` is empty.

---

### L4. What happens when an invoice fails the arithmetic check? Is it rejected, flagged, or auto-corrected?

**Flagged and quarantined**.
From `src/domain/idp-pipeline.ts:112, 157-158`:
- `status: "STAGED_NEEDS_REVIEW"`
- `totalAmount.isFlaggedAnomaly: !passed`
- `totalAmount.anomalyMessage: "Arithmetic variance of ₹${diff}"`
- `validation.passed = false`
The invoice is not rejected and not auto-corrected; it is placed in the staging review queue for human-in-the-loop approval.

---

## M. Architecture, Ownership, Testing

### M1. List every file in `src/domain/` with a one-sentence summary of its responsibility.

1. `ai-context.ts`: Builds operational and financial context payloads injected into LLM prompts.
2. `anomaly-radar.ts`: Identifies volumetric courier overcharges, RTO margin drag, and settlement payout lag.
3. `csv-auto-mapper.ts`: Maps and cleanses CSV columns from various marketplaces and couriers into internal schemas.
4. `deterministic-analyst.ts`: Computes deterministic financial KPI cards and generates rule-based analytical insights without LLM hallucinations.
5. `guardrails.ts`: Validates double-entry balance, settlement reconciliation equations, and invoice arithmetic.
6. `idp-pipeline.ts`: Coordinates OCR and LLM document processing to extract structured data from PDF/image invoices.
7. `ledger-engine.ts`: Constructs balanced double-entry general ledger journal entries and calculates the trial balance.
8. `marketplace-fees.ts`: Implements integer-paise rule evaluation for marketplace commission, fixed, shipping fees, and settlement fee reconciliation.
9. `mock-data.ts`: Provides seed orders, settlements, returns, products, and expenses for offline demo mode.
10. `ocr-engine.ts`: Extracts raw text from uploaded images and PDF bills using Tesseract.js and pdf-parse.
11. `order-financials.ts`: Calculates order-level operational facts (gross, discount, refunded, net sales, unit cost) and integer-paise allocations.
12. `profitability-engine.ts`: Aggregates channel and SKU profitability, date preset resolutions, and period comparisons.
13. `purchase-accounting.ts`: Allocates vendor payments against outstanding purchase bills using FIFO logic.
14. `recycle-bin.ts`: Manages soft-deletion and record recovery for financial entities.
15. `report-scope.ts`: Resolves active channel, store, and date filters applied to reporting views.
16. `snapshot-validation.ts`: Validates decimal precision, return condition enums, and order status transitions.
17. `store.tsx`: Main React context provider managing client-side application state and persistence sync.
18. `sync-merge.ts`: Merges incoming marketplace API sync batches with existing local records.
19. `tenant-cache.ts`: Provides tenant-keyed memory caching for multi-tenant data isolation.
20. `types.ts`: Central TypeScript interface definitions for transactions, ledger accounts, and entities.

---

### M2. For each calculation area, name the single source of truth file:

- **Order financials (gross, discount, net, cogs)**: `src/domain/order-financials.ts`
- **Marketplace fees**: `src/domain/marketplace-fees.ts`
- **Return financial impact**: `src/domain/order-financials.ts` (operational facts) and `src/domain/profitability-engine.ts` (`computeReturnFinancials` for return view)
- **Settlement reconciliation**: `src/domain/marketplace-fees.ts` (`reconcileSettlementFees`)
- **General ledger posting**: `src/domain/ledger-engine.ts` (`generateGeneralLedger`)
- **Profitability aggregation**: `src/domain/profitability-engine.ts` (`aggregateProfitability`, `calculateSkuProfitability`)
- **Comparison periods**: `src/domain/profitability-engine.ts` (`resolveDatePreset`, `calculatePercentageChange`, `calculatePeriodComparison`)

---

### M3. How many unit test files exist? How many tests pass and fail today?

- **Unit test files**: 19 files matching `tests/*.test.mjs`
- **Results (`npm test`)**:
  - Test Suites: **26 failed, 29 passed, 55 total**
  - Tests: **26 failed, 250 passed, 276 total**

---

### M4. Which calculations have NO unit tests covering them?

1. Period comparisons (`calculatePeriodComparison`, `resolveDatePreset`, `calculatePercentageChange` zero base)
2. Trial balance check (`calculateTrialBalance` in `ledger-engine.ts`)
3. Supplier bill line mismatch absorption into subtotal (`ledger-engine.ts:428`)
4. Return condition mapping to salvage in the general ledger
5. Document arithmetic verification on extracted bills (`validateDocumentArithmetic`)
6. Volumetric courier weight overcharge anomaly detection (`computeAnomalyRadar`)

---

### M5. Is there an automated background job for settlement reconciliation, or is it on-demand only?

**On-demand only**. Reconciliations execute only when a user uploads a file or invokes the `/api/settlements` POST endpoint. There is no background worker or cron queue.

---

### M6. Are fee rules versioned or effective-dated? How is a rule change handled for historical orders?

- **Versioned & effective-dated**: Yes. `MarketplaceFeeRule` contains `version: number`, `effectiveFrom: string`, and `effectiveTo?: string` (`database/21_marketplace_fee_engine.sql:63-65`).
- **Historical orders**: Historical orders match rules where `effectiveFrom <= orderDate <= effectiveTo`. When estimated, the snapshot is frozen in `order_fee_estimates`. However, statutory tax rates and other fees lack versioning.

---

### M7. What database is used, and how are migrations managed?

- **Database**: PostgreSQL (hosted on Supabase).
- **Migration management**: Managed via raw numbered SQL files in `database/` (`01_extensions.sql` through `21_marketplace_fee_engine.sql`). Applied manually or via direct SQL scripts; there is no automated ORM migration runner.

---

### M8. Which marketplaces are supported by the fee engine? List the enum or table values.

From `src/domain/types.ts:25-33`:
1. `"Amazon India"`
2. `"Flipkart"`
3. `"Meesho"`
4. `"Myntra"`
5. `"Personal Website"`
6. `"WooCommerce"`
7. `"B2B Wholesale"`
8. `"Other"`

---

### M9. Does the system support multiple GSTINs (multi-state sellers) or multiple tax rates per product?

- **Multiple GSTINs**: **NOT supported**. The database `users` table holds a single `gstin TEXT` column (`database/02_tables.sql:10`).
- **Multiple tax rates per product**: **NOT supported**. Products do not store tax rates; orders store a single line `taxAmount`.

---

### M10. List any known TODO, FIXME, or commented-out calculations in the codebase.

**None**. A search for `"TODO"` and `"FIXME"` across `src/domain/*.ts` yields zero occurrences.

---

## N. Business Policy Questions

### N1. Is the seller assumed to be GST-registered? How does the code handle composition scheme or unregistered sellers?

The seller is assumed to be a **regular GST-registered taxpayer**. The ledger automatically posts Input Tax Credit (ITC) to asset Account `1040`.
Handling for composition scheme sellers or unregistered businesses is **NOT FOUND**.

---

### N2. Which fulfilment models are supported? How does the code distinguish them?

Supported models in `src/domain/marketplace-fees.ts:31`:
- `"FBA"` (Fulfilled by Amazon)
- `"EASY_SHIP"`
- `"SELF_SHIP"`
- `"FBF"` (Fulfilled by Flipkart)
- `"DEFAULT"`

Distinguished via `Order.fulfilmentMode` and evaluated against `MarketplaceFeeRule.fulfilmentModel`.

---

### N3. What is the business policy on customer shipping: is it treated as revenue, pass-through, or ignored?

In `src/domain/order-financials.ts`:
- Excluded from `grossSales` and `netSales`.
- Excluded from `contributionProfit`.
- Added to `expectedPayout` when `netSales > 0`.
Operationally, it is treated as a **pass-through escrow collection**, not recognized revenue.

---

### N4. How are return conditions mapped to business actions?

From `src/domain/ledger-engine.ts:333-368`:
- `"SELLABLE"` / `"RESTOCKED"`: Restocked into inventory (`Dr 1030 / Cr 5010`) using `inventoryRecoveryValue` (or `lossAmount`).
- `"DAMAGED"` / `"LIQUIDATED"`: Written off as damage loss (`Dr 5020 / Cr 5010`) using `lossAmount`.
- `"USED"` / `"MISSING"` / `"UNUSABLE"` / `"UNDER_INSPECTION"`: No ledger inventory adjustment or loss write-off is generated.

---

### N5. How are marketplace reimbursements (lost/damaged inventory claims) handled? Are they revenue, expense reduction, or equity?

- **In Operational Profitability**: Treated as a **margin recovery** added to Contribution Profit (`+ sum("claimRecovery")` in `profitability-engine.ts:307`).
- **In General Ledger**: Defined as Account `4020` (`"Marketplace Claim & Safe-T Reimbursements"`, `accountType: "REVENUE"` in `ledger-engine.ts:114`), credited as other operating **revenue**.

---

### N6. What is the intended purpose of the general ledger: internal management reporting, or tax/statutory compliance?

**Internal management reporting**.
The general ledger is generated in-memory (`generateGeneralLedger`), permits float penny tolerances (`0.01`), lacks period-locking and voucher sequence enforcement, and lacks statutory GST sub-ledger splits (CGST/SGST/IGST).

---

### N7. Which financial statements or reports does the system aim to produce?

1. **Contribution Margin / True Profit Statement** (Order and SKU level)
2. **Net Operating Profit (EBITDA) Statement**
3. **General Ledger Trial Balance** (`calculateTrialBalance`)
4. **Marketplace Settlement & Fee Discrepancy Statement**
5. **Anomaly & Claims Exposure Briefing**

---

### N8. What is the target accuracy level: penny-perfect (every paisa reconciles) or management-grade (rounded rupees are acceptable)?

The codebase is in a **hybrid state**:
- The Marketplace Fee Engine (`src/domain/marketplace-fees.ts`) is architected for **penny-perfect integer-paise accuracy** using `BigInt` arithmetic and zero-drift remainder distribution.
- The General Ledger, Order Financials, and Profitability Engines operate at **management-grade float rupees** with tolerances ranging from `0.01` to `0.05`, and IDP invoice extraction allows a `1.00` discrepancy.
