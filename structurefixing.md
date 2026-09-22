# MarginFlow — Structure Fixing Analysis
> **Prepared by:** Deep Codebase Analysis  
> **Date:** 2026-09-22  
> **Purpose:** Understand the current implementation, map it against the intended business logic described in the ChatGPT conversation, identify gaps and contradictions, and define what a correct re-implementation should look like.  
> **Status:** READ-ONLY ANALYSIS — No code was changed.

---

## Part 1: How the User Actually Uses MarginFlow (User Flow)

Before we talk about what's broken, let's walk through the entire user journey — the exact sequence of actions an e-commerce operator takes when using this app.

---

### Step 1 — Log In

The user lands on the landing page (`/`). They click **"Start For Free"** or **"Login with Google"**, which stores a dummy session object in `localStorage` and redirects to `/dashboard`. There is no real authentication — this is a simulation.

---

### Step 2 — The Dashboard (Home Base)

The user is now inside the main app (`/dashboard`). This is rendered by `DashboardView`. The user sees:

- **KPI Cards** — Gross Sales, Net Sales, Gross Profit, Contribution Profit, Net Operating Profit
- **Settlement Aging** — which orders have pending payouts and for how long
- **Inventory Snapshot** — opening stock, purchased, sold, returned, current
- **Fees Breakdown** — commission, logistics, return fees
- **Claims Summary** — filed, pending, approved, recovered
- **Marketplace Breakdown** — per-platform profitability
- **Top SKU Profitability** — which products are actually making money
- **Charts** — bar charts and pie charts across dates and channels

The user can filter everything by:
- **Platform** (All / Amazon / Flipkart / Meesho / etc.)
- **Date Range** (Today / Last 7 Days / Last 30 Days / This Month / Previous Month / All / Custom)

---

### Step 3 — Add an Order

The user clicks **"Add Order"** (a button accessible from both the Dashboard and the Orders module).

The `OrderModal` opens. The user fills in:

| Field | Notes |
|---|---|
| Marketplace | Amazon, Flipkart, Meesho, etc. |
| Order ID | Internal ID (`ORD-2026-XXXX`) |
| Channel Order ID | Amazon/Flipkart's own order number |
| Order Date | When it was placed |
| SKU / Product | Linked from the Products catalog |
| Quantity | How many units |
| Selling Price | Per-unit price charged to customer |
| Unit COGS | Supplier cost per unit (locked as snapshot at this moment) |
| Est. Commission % | Estimated marketplace fee percentage |
| Actual Settlement Received | Optional — if already known |

When saved, the order is stored in `orders[]` with status `PENDING` or `DELIVERED`.  
Simultaneously, `product.stockQuantity` is decremented by the ordered quantity.

---

### Step 4 — Orders Module

The user navigates to the **Orders** section (`orders-view.tsx`). They see a table of all orders with:

- Order ID, Date, Platform, SKU, Qty, Selling Price, Settlement, Profit, Status
- Synthesized status pills: `DELIVERED`, `CUSTOMER RETURN`, `RTO`, `DAMAGED RETURN`, `CLAIM PENDING`, `CLAIM APPROVED`

The user can:
- **Edit** an order (change details)
- **Mark as Delivered** manually
- **Record a Return** from this order
- **Add a Settlement** for this order
- **Delete** an order

---

### Step 5 — Record a Return

When a physical parcel comes back, the user clicks **"Record Return"**.

The `RecordReturnModal` opens. The user fills in:

| Field | Notes |
|---|---|
| Target Order | Which order is being returned |
| Return Nature | Customer Return / RTO / Lost in Transit |
| Physical Condition | Sellable / Damaged / Unusable |
| Return Qty | How many units came back |
| Freight (RS) | Reverse shipping cost |
| Return Fee (RS) | Marketplace return processing fee (disabled/0 for RTO) |
| Scrap Value (RS) | Any salvage/scrap recovery from damaged item |
| Reason | Text description |

**What happens internally:**

```
CUSTOMER RETURN + SELLABLE condition:
  lossAmount = returnShippingCost + customerReturnFee
  Product restocked (stockQuantity +qty)
  Order status = RETURNED

CUSTOMER RETURN + DAMAGED condition:
  lossAmount = returnShippingCost + customerReturnFee + (COGS - scrapValue)
  Product NOT restocked (written off)
  Auto-claim created with status FILED
  Order status = RETURNED (should be DAMAGED_RETURN — see Issue #1)

RTO:
  customerReturnFee = 0 (forced)
  lossAmount = returnShippingCost (freight only)
  Product restocked (stockQuantity +qty)
  Order status = RTO
```

---

### Step 6 — Returns Module

The user navigates to **Returns** (`returns-view.tsx`). They see all return records with:

- Return ID, Order ID, Marketplace, SKU, Qty, Type, Condition, Fees, Loss, Restock Status

From here they can:
- **View** return details
- **Restock** a return (marks as SELLABLE + RESTOCKED, adds back to inventory)
- **Edit** a return record
- **Delete** a return

---

### Step 7 — Claims Lifecycle

When a return is marked DAMAGED, a **Claim** is auto-generated. The user navigates to **Claims** (`claims-view.tsx`).

They can:
- View all claims (Drafted, Filed, Under Review, Approved, Rejected)
- **Update Claim** — enter the `amountRecovered` and change status to `APPROVED` or `REJECTED`

**What happens internally when claim is approved:**
- `claim.amountRecovered` is set to the actual marketplace payout
- This recovery flows into the `profitability-engine.ts` and reduces the net loss on that order

**Claim Status to Order Visual Status mapping:**

| Claim Status | Order Synthesized Status |
|---|---|
| FILED / UNDER_REVIEW | CLAIM PENDING |
| APPROVED / RECOVERED | CLAIM APPROVED |
| REJECTED / CLOSED | Falls back to DAMAGED RETURN |

---

### Step 8 — Settlements

After the marketplace pays out, the user navigates to **Settlements** and can:
- **Add a Settlement** for an order — logs `grossAmount`, `deductions[]`, `netSettlement`
- See settlement aging (which orders are overdue for payment)

Once a settlement exists for an order, the profitability engine switches from estimated fees to actual audited deductions for that order. This is the "Hybrid Realization Model".

---

### Step 9 — Products and Suppliers

**Products module** (`products-view.tsx`):
- Manage the product catalog (SKU, name, category, brand, cost price, stock qty)
- Update COGS — triggers a cost history entry and audit log

**Suppliers module** (`suppliers-view.tsx`):
- Add/edit supplier contact details
- Record supplier payments — triggers FIFO bill settlement logic

**Purchases module** (`purchases-view.tsx`):
- Log supplier invoices (PurchaseBill)
- Track payment status: PAID / PENDING / PARTIAL

---

### Step 10 — Expenses

Navigate to **Expenses** (`expenses-view.tsx`) to log business overheads:
- Advertising, Salaries, Rent, Software, Packaging, etc.
- Can be attributed to a specific marketplace or SKU (for ROAS/POAS attribution)

---

### Step 11 — Reports

Navigate to **Reports** (`reports-view.tsx`) for:
- Monthly P&L trends
- SKU-level profitability table
- Marketplace profitability breakdown
- Return rate analysis

---

### Step 12 — AI Document Staging

Navigate to **AI Staging** (`ai-staging-view.tsx`) to:
- Upload supplier invoices/settlement PDFs
- The system "extracts" data (mocked OCR engine)
- User reviews, corrects, and approves — creates order/settlement records

---

### Step 13 — Audit Log

The **Audit** module (`audit-view.tsx`) shows every financial change ever made:
- Who changed what, when, old value, new value
- Every `addOrder`, `addReturn`, `updateClaim`, `recordSupplierPayment` writes a `FinancialAuditLog` entry

> **Note:** Currently this module is unreachable in the navigation.

---

## Part 2: The Intended Business Logic vs. What Is Actually Implemented

### 2.1 The Business Logic Model (Correct Specification)

From the ChatGPT document, the correct logic is:

```
ORDER STATUS            Settlement   COGS Active   Return Fee   Profit Formula
----------------------  -----------  ------------  -----------  --------------------------------------------------
DELIVERED               Yes          Yes           RS 0         Settlement - COGS
CUSTOMER RETURN GOOD    RS 0         No (0)        Yes          - Return Fee only
CUSTOMER RETURN DAMAGED RS 0         Yes           Yes          Claim Recovery - COGS - Return Fee
RTO                     RS 0         No (0)        RS 0         RS 0 (no financial impact per spec)
CLAIM PENDING           RS 0         Yes           Yes          - COGS - Return Fee (no recovery yet)
CLAIM APPROVED          RS 0         Yes           Yes          Claim Recovery - COGS - Return Fee
```

**The key principle:** COGS is only "consumed" (active) when the product is permanently gone. If it came back in sellable condition (Customer Return Good, or RTO), COGS is reversed — the supplier hasn't been paid for a permanently lost item.

---

### 2.2 What the Current Code Actually Does

#### Order Model (types.ts)

The actual `Order` type does **not** have:
- A direct `settlementAmount` field
- A `settlementPercent` field
- A direct `supplierName` field
- A `totalCOGS` field

It has:
- `marketplaceChargesEstimate` (estimated commission as a % of selling price)
- `shippingFeeCharged` (estimated shipping)
- Items with `snapshotUnitCost` (unit COGS locked at creation time)

The settlement is a **separate record** (`Settlement`) linked by `orderId`. This is a more sophisticated and correct accounting approach.

#### What the OrderModal Actually Does

```
User enters:
  - Selling Price per unit
  - Est. Commission % (defaults to 15%)
  - Actual Received (optional)

System calculates:
  - marketplaceChargesEstimate = sellingPrice x qty x (commission% / 100)

If "Actual Received" is provided:
  - Creates a Settlement record linked to the order
  - netSettlement = actualReceived
```

**Gap:** The modal has a "settlement amount" field but it does not sync bidirectionally with a "settlement percentage". The % to Amount sync described in the chat is not implemented.

---

### 2.3 Return Logic — Gaps and Discrepancies

**What the spec expects:**

- Customer Return + Good: Settlement=0, COGS=0, Fee=real fee, Profit = -Fee
- Customer Return + Damaged: Settlement=0, COGS=active, Fee=real fee, Profit = Claim - COGS - Fee
- RTO: Settlement=0, COGS=0, Fee=0, Profit = 0

**What the code does:**

For Customer Return + SELLABLE:
```
lossAmount = returnShippingCost + customerReturnFee
returnedQty is incremented -> deliveredQty decreases -> deliveredCogs reduces
```
Result: COGS effectively removed. Correct.

For Customer Return + DAMAGED:
```
lossAmount = returnShippingCost + customerReturnFee + (cost - scrapValue)
  cost = snapshotUnitCost x qty
```
But in `calculateBusinessProfitability()`:
```
returnedQty = getReturnedUnitsForItem(...)  // includes damaged returns
deliveredQty = qty - returnedQty            // COGS removed here too
```

So COGS is removed from `deliveredCogs` AND simultaneously re-added inside `lossAmount`. This causes potential double-deduction across profit tiers. The intermediate `grossProfit` metric is understated.

For RTO:
```
customerReturnFee = 0 (forced)
lossAmount = returnShippingCost  // NOT zero — freight is still counted
```
The spec says RTO = RS 0 impact. The code charges reverse freight. Contradiction.

---

## Part 3: Full Architecture Map of the Current Codebase

```
src/
|-- app/
|   |-- page.tsx              <- Landing page (marketing + login)
|   |-- layout.tsx            <- Root layout wrapping PlatformProvider
|   |-- globals.css           <- Tailwind base styles
|   |-- (dashboard)/          <- Route group
|   |   |-- layout.tsx        <- Dashboard layout (sidebar + navbar)
|   |   `-- [various]/        <- Subpages
|   |-- api/
|   |   `-- upload-bill/      <- File upload endpoint (mocked OCR)
|   `-- login/                <- Login page (bypassed)
|
|-- domain/                   <- ALL BUSINESS LOGIC LIVES HERE
|   |-- types.ts              <- Core data types (Order, Return, Settlement, Claim...)
|   |-- store.tsx             <- Global state (PlatformProvider + all mutations)
|   |-- profitability-engine.ts  <- All financial calculations
|   |-- guardrails.ts         <- 7 invariant validators
|   |-- ledger-engine.ts      <- Ledger view helpers
|   |-- mock-data.ts          <- Seed data (initial orders/returns/products...)
|   |-- ai-context.ts         <- AI prompt engineering
|   |-- anomaly-radar.ts      <- Anomaly detection system
|   |-- csv-auto-mapper.ts    <- CSV import field mapping engine
|   |-- deterministic-analyst.ts  <- Analysis engine
|   |-- idp-pipeline.ts       <- Intelligent document processing pipeline
|   `-- ocr-engine.ts         <- Mock OCR (no real vision model)
|
|-- components/
|   |-- layout/
|   |   |-- sidebar.tsx       <- Left navigation sidebar
|   |   `-- navbar.tsx        <- Top header
|   |-- modals/
|   |   |-- order-modal.tsx           <- Add/Edit Order form (878 lines)
|   |   |-- record-return-modal.tsx   <- Log return/RTO (266 lines)
|   |   |-- dispute-packet-modal.tsx  <- SAFE-T claim packet builder
|   |   |-- add-purchase-modal.tsx    <- Add supplier bill
|   |   |-- supplier-modal.tsx        <- Add/edit supplier
|   |   |-- csv-import-modal.tsx      <- Bulk CSV import (26KB)
|   |   |-- card-logic-modal.tsx      <- Dashboard card formula explainer
|   |   `-- sku-drawer.tsx            <- SKU detail panel
|   |-- modules/                       <- Every page view
|   |   |-- dashboard-view.tsx        <- Main KPI dashboard (88KB — biggest file)
|   |   |-- orders-view.tsx           <- Order management table
|   |   |-- returns-view.tsx          <- Returns management
|   |   |-- claims-view.tsx           <- Claims and recoveries
|   |   |-- settlements-view.tsx      <- Settlement reconciliation
|   |   |-- products-view.tsx         <- Product catalog
|   |   |-- suppliers-view.tsx        <- Supplier management
|   |   |-- purchases-view.tsx        <- Purchase bills
|   |   |-- expenses-view.tsx         <- Operating expenses
|   |   |-- reports-view.tsx          <- Analytics and P&L reports
|   |   |-- ai-staging-view.tsx       <- Document AI extraction/HITL
|   |   |-- audit-view.tsx            <- Audit log (UNREACHABLE in nav)
|   |   |-- ledger-view.tsx           <- Financial ledger view
|   |   `-- webhook-simulator.tsx     <- Webhook testing tool
|   |-- ai/                           <- AI assistant components
|   `-- ui/                           <- Shared UI primitives
|
`-- lib/
    |-- utils.ts                       <- formatINR, formatDate helpers
    |-- marketplace-config.ts          <- Marketplace badge configs
    `-- security/                      <- Auth helpers
```

---

## Part 4: Identified Issues and Inconsistencies

### Issue 1: The `OrderStatus` Type Doesn't Match Business Logic

**Current `OrderStatus` in `types.ts`:**
```ts
type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" 
                  | "CANCELLED" | "RTO" | "RETURNED" | "PARTIALLY_RETURNED"
```

**What the business logic actually needs:**
```
DELIVERED
CUSTOMER_RETURN (good condition)
DAMAGED_RETURN
CLAIM_PENDING
CLAIM_APPROVED
RTO
```

The synthesized statuses shown in the Orders table (`getSynthesizedStatus()` in `orders-view.tsx`) are **computed on the fly** from `order.status + linked returns + linked claims`. They are not stored on the order.

**Problem:** Filtering orders by "Claim Pending" is unreliable. The chat's description of "Order becomes CLAIM_PENDING" is visually true but structurally false — the underlying `order.status` is still just `"RETURNED"`.

---

### Issue 2: COGS Double-Deduction for Damaged Returns

**In the profitability engine (`calculateBusinessProfitability`):**
```ts
// Step 1: COGS is removed for ALL returns (including damaged)
const returnedQty = getReturnedUnitsForItem(...)  // includes damaged
const deliveredQty = Math.max(0, item.quantity - returnedQty);
deliveredCogs += item.snapshotUnitCost * deliveredQty;  // COGS reduced

// Step 2: COGS is re-added back inside lossAmount for damaged returns
// (In record-return-modal.tsx)
if (returnCondition === "DAMAGED") {
  calculatedLoss += cost - returnRecovery;  // cost = snapshotUnitCost * qty
}
```

This creates an accounting loop:
- COGS is removed from `deliveredCogs` (reducing `grossProfit`)
- COGS is simultaneously re-added through `lossAmount` (reducing `contributionProfit` further)

Net effect: COGS is subtracted twice from different profit tiers. Intermediate metrics like `grossProfit` are understated.

Note: `goodReturnUnitsMap` already exists in `buildFinancialMaps()` but `calculateBusinessProfitability()` uses `returnUnitsMap` (all returns) instead. Only `calculateSkuProfitability()` uses `goodReturnUnitsMap`. This inconsistency is the root of the issue.

---

### Issue 3: RTO Loss Amount is Not RS 0

**The spec says:** RTO = RS 0 financial impact  
**The code does:**
```ts
// In record-return-modal.tsx
let calculatedLoss = returnShipping + fee;
// For RTO: fee = 0, but returnShipping is still included
// So lossAmount = returnShippingCost (e.g., RS 70)
```

RTO creates a small loss (the reverse freight). The business spec treats RTO as RS 0 but the code charges freight. This is a spec vs. implementation contradiction that needs a policy decision.

---

### Issue 4: Settlement Amount vs. Percentage Not Bidirectionally Synced

The chat describes:
- Enter Settlement Amount → auto-compute Settlement %
- Enter Settlement % → auto-compute Settlement Amount
- Both fields stay in sync in real time

In the actual `OrderModal`, the field `actualReceived` creates a `Settlement` record, but there is no bidirectional synchronization with a settlement percentage. The user enters a commission % estimate separately, and they do not cross-reference.

---

### Issue 5: The Simplified Order Model vs. the Complex Schema

The chat describes a simple order with fields like:
`Order ID | Date | Platform | SKU | Product | Quantity | Selling Price | Settlement Amount | Settlement % | Supplier | Unit COGS | Total COGS | Status`

The actual implementation uses a multi-item order structure:
```
Order -> OrderItem[] (multiple items per order)
      -> Settlement[] (separate records, linked by orderId)
      -> ReturnRecord[] (separate records, linked by orderId)
      -> Claim[] (separate records, linked by orderId)
```

This is architecturally correct for complex orders but doesn't map 1:1 to the simplified model the operator is thinking about.

---

### Issue 6: Order Status vs. Claims/Returns Status Disconnect

When `addReturn()` is called in `store.tsx`:
```ts
const newStatus = enrichedRecord.returnType === "RTO"
  ? "RTO"
  : totalReturned >= totalOrdered ? "RETURNED" : "PARTIALLY_RETURNED";
```

It never sets the order to `DAMAGED_RETURN`, `CLAIM_PENDING`, or `CLAIM_APPROVED`. And `updateClaim()` doesn't update the order status either.

This means filtering orders by damaged/claim status is impossible at the data layer — it can only be done in the UI via `getSynthesizedStatus()`.

---

### Issue 7: Persistence is localStorage Only

The entire database is stored in `localStorage` under `MARGINFLOW_PERSISTENT_LEDGER_V2`. This means:
- Data is lost if the user clears browser storage
- No multi-device sync
- No server-side backup
- Maximum localStorage size (~5MB) limits scale

---

### Issue 8: Audit Trail is Incomplete

`updateClaim()` writes an audit log. But:
- `addClaim()` does NOT write an audit log
- `addSettlement()` does NOT write an audit log
- `addExpense()` does NOT write an audit log
- `addPurchase()` does NOT write an audit log

Major financial events are missing from the audit trail.

---

### Issue 9: `getSynthesizedStatus()` is Only in orders-view.tsx

This function applies a priority chain to determine what the user sees. But it is defined locally in `orders-view.tsx` and is NOT shared with Dashboard, Reports, or Returns views. Each view interprets statuses differently, causing cross-module inconsistency.

---

### Issue 10: `DAMAGED_RETURN` as ReturnType is Dead Code

**Current `ReturnType`:**
```ts
type ReturnType = "CUSTOMER_RETURN" | "RTO" | "DAMAGED_RETURN" | "LOST_RETURN" | "OTHER"
```

The chat's model treats "damaged" as a **condition** of the returned item (`ProductCondition`), not a return type. The `RecordReturnModal` only sets return types to `CUSTOMER_RETURN`, `RTO`, or `LOST_RETURN` — never `DAMAGED_RETURN`. So `DAMAGED_RETURN` as a `ReturnType` is never set and is effectively dead code.

---

## Part 5: The Correct Logic — What a Fixed Implementation Should Do

### 5.1 Correct COGS Treatment

COGS should be tracked using condition-aware return units:

```ts
// WRONG (current): Uses all returnedQty (including damaged)
const returnedQty = getReturnedUnitsForItem(order, item.sku, returns, returnUnitsMap);
const deliveredQty = Math.max(0, item.quantity - returnedQty);

// CORRECT (fix): Only use GOOD returns to reduce COGS
// Damaged returns: COGS stays active (item is destroyed, cost is real)
const goodReturnedQty = getGoodReturnedUnitsForItem(order, item.sku, returns, goodReturnUnitsMap);
const deliveredQty = Math.max(0, item.quantity - goodReturnedQty);
deliveredCogs += item.snapshotUnitCost * deliveredQty;
```

The `goodReturnUnitsMap` already exists in `buildFinancialMaps()`. It just isn't being used in `calculateBusinessProfitability()` or `calculateOrderProfitability()`.

---

### 5.2 Correct lossAmount Calculation for Damaged Returns

If the engine is keeping COGS active for damaged returns (via the fix above), then `lossAmount` should NOT include COGS:

```ts
// CURRENT (causes double-deduction):
if (returnCondition === "DAMAGED") {
  calculatedLoss += cost - returnRecovery;  // COGS added here
}

// CORRECT (if engine handles COGS separately):
// lossAmount = returnShippingCost + customerReturnFee only
// inventoryRecoveryValue (scrap) is a separate field recovered from the claim
calculatedLoss = returnShippingCost + customerReturnFee;
```

---

### 5.3 Correct Order Status Architecture

Extend `OrderStatus` in `types.ts`:
```ts
type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RTO"
  | "RETURNED"           // Customer returned + SELLABLE condition
  | "DAMAGED_RETURN"     // Customer returned + DAMAGED/UNUSABLE
  | "CLAIM_PENDING"      // Damaged + claim FILED/UNDER_REVIEW
  | "CLAIM_APPROVED"     // Damaged + claim APPROVED/RECOVERED
  | "PARTIALLY_RETURNED";
```

Then `addReturn()` and `updateClaim()` in `store.tsx` should set the real order status:
```ts
// In addReturn():
const newStatus = enrichedRecord.returnType === "RTO"
  ? "RTO"
  : isDamaged
  ? "DAMAGED_RETURN"   // or "CLAIM_PENDING" if claim auto-created
  : totalReturned >= totalOrdered ? "RETURNED" : "PARTIALLY_RETURNED";

// In updateClaim():
if (status === "APPROVED" || status === "RECOVERED") {
  updateOrderStatus(linkedOrderId, "CLAIM_APPROVED");
} else if (status === "REJECTED") {
  updateOrderStatus(linkedOrderId, "DAMAGED_RETURN");
}
```

---

### 5.4 Correct Settlement Sync (Amount and Percentage)

In `OrderModal`, the settlement fields should be bidirectionally synced:

```
Settlement Amount (RS) <-> Settlement Percentage (%)
- Entering amount: % = amount / (sellingPrice * qty) * 100
- Entering %: amount = sellingPrice * qty * (% / 100)
- Both fields stay in sync in real time
```

---

### 5.5 The Profit Formula (Correct Version)

```
Per Order:

  Gross Sales = sellingPrice * quantity

  Active COGS = snapshotUnitCost * (quantity - goodReturnedQty)
    -- Good returns reduce COGS
    -- Damaged returns do NOT reduce COGS

  Gross Profit = Net Sales - Active COGS

  Marketplace Charges = settlement.deductions (actual) OR estimate (if unsettled)
  Return Fee = customerReturnFee (ReturnRecord, CUSTOMER_RETURN only, not RTO)
  Return Shipping = returnShippingCost (ReturnRecord)
  Claim Recovery = claim.amountRecovered (if APPROVED/RECOVERED)
  Scrap Recovery = inventoryRecoveryValue (if damaged item has scrap value)

  Contribution Profit = 
    Gross Profit
    - Marketplace Charges
    - Return Fee
    - Return Shipping
    + Claim Recovery
    + Scrap Recovery

Business Level:

  Net Operating Profit = Sum(Contribution Profit per order) - Total OPEX
```

---

### 5.6 RTO Financial Impact (Policy Decision Needed)

Two valid approaches:

**Option A — Spec-accurate:**  
RTO = RS 0 impact. Assume marketplace covers reverse freight. No loss recorded.

**Option B — Realistic:**  
RTO = returnShippingCost loss. Seller pays reverse freight.

Current code uses Option B. The stated spec expects Option A. This should be a configurable setting per marketplace since different platforms have different RTO fee policies (Amazon India often covers it; Meesho/Shiprocket COD may not).

---

## Part 6: Navigation and Architecture Problems

### 6.1 No Real URL Routing

The app uses a single URL (`/dashboard`) with a React state variable `activeModule` to switch views. Browser back button exits the app, deep links are impossible, and bookmarking doesn't work.

**Correct fix:** Use Next.js file-based routing:
- `/dashboard` → Dashboard
- `/dashboard/orders` → Orders
- `/dashboard/returns` → Returns
- `/dashboard/claims` → Claims
- `/dashboard/settlements` → Settlements
- etc.

### 6.2 Bundle Size (No Code Splitting)

All 11+ view components are imported at the top of `page.tsx` and rendered conditionally. The entire app JavaScript is downloaded on first load.

**Fix:** Use Next.js `dynamic()` imports for each view module.

### 6.3 The `dashboard-view.tsx` Monster File

At 88,906 bytes and 1,849 lines, this file mixes KPI card rendering, chart rendering, order add flow, return add flow, settlement add flow, and date filter management.

**Fix:** Break into focused sub-components: `<KpiCards />`, `<MarketplaceBreakdown />`, `<SettlementAging />`, `<InventorySnapshot />`, etc.

### 6.4 The Unreachable Audit View

`audit-view.tsx` exists but is not accessible from the sidebar navigation. All financial change tracking is invisible to the user.

---

## Part 7: Summary — What Needs to Be Rebuilt vs. What Is Correct

### Things That Are Architecturally Correct (Keep)

1. **Domain/Store separation** — `types.ts`, `store.tsx`, `profitability-engine.ts` is a clean architecture
2. **Immutable cost snapshots** — `snapshotUnitCost` is correctly locked at order creation time
3. **Hybrid settlement realization** — switching from estimated fees to actual deductions once settled
4. **Financial Audit Log** — good mechanism, just needs more coverage
5. **Claim auto-creation** on damaged returns
6. **Inventory engine** in `addOrder()`, `addReturn()`, `restockReturn()` — correctly adjusts `stockQuantity`
7. **`buildFinancialMaps()`** — the indexed map system for O(1) profit lookups is well-designed
8. **FIFO supplier payment** logic in `recordSupplierPayment()`
9. **Settlement aging brackets** — 0–7 / 8–14 / >14 days
10. **`goodReturnUnitsMap`** already built in `buildFinancialMaps()` — just not being used in the right places

### Things That Are Broken or Misaligned (Fix)

1. **COGS double-deduction** — `calculateBusinessProfitability()` and `calculateOrderProfitability()` use `returnUnitsMap` instead of `goodReturnUnitsMap`
2. **`lossAmount` for damaged returns** includes COGS + engine also handles COGS separately — double-deduction
3. **`OrderStatus` type** missing `DAMAGED_RETURN`, `CLAIM_PENDING`, `CLAIM_APPROVED`
4. **Order status is never set to these values** in `addReturn()` or `updateClaim()`
5. **`getSynthesizedStatus()`** is scattered across views instead of being centralized
6. **Settlement % and Amount not synced** in OrderModal
7. **RTO lossAmount = returnShippingCost** contradicts the RS 0 spec
8. **Audit log missing** for `addClaim`, `addSettlement`, `addExpense`, `addPurchase`
9. **Audit view unreachable** in navigation
10. **No URL-based routing** — `activeModule` state only
11. **No code splitting** — all views bundled together
12. **`DAMAGED_RETURN` as ReturnType** — dead code never actually used

---

## Part 8: File-by-File Change Map for a Correct Re-Implementation

| File | Change Required | Priority |
|---|---|---|
| `domain/types.ts` | Extend `OrderStatus` with `DAMAGED_RETURN`, `CLAIM_PENDING`, `CLAIM_APPROVED`; remove dead `DAMAGED_RETURN` from `ReturnType` | Critical |
| `domain/profitability-engine.ts` — `calculateBusinessProfitability()` | Use `goodReturnUnitsMap` instead of `returnUnitsMap` for deliveredCogs | Critical |
| `domain/profitability-engine.ts` — `calculateOrderProfitability()` | Same COGS fix for per-order calculation | Critical |
| `domain/store.tsx` — `addReturn()` | Set `order.status = DAMAGED_RETURN` for damaged returns; `CLAIM_PENDING` when claim auto-created | Critical |
| `domain/store.tsx` — `updateClaim()` | Update linked `order.status` to `CLAIM_APPROVED` or back to `DAMAGED_RETURN` on rejection | Critical |
| `components/modals/record-return-modal.tsx` | Remove COGS from `lossAmount` for damaged returns; let engine handle COGS via goodReturnUnitsMap | Critical |
| `components/modals/order-modal.tsx` | Add bidirectional settlement amount and percentage sync | High |
| `components/modules/orders-view.tsx` — `getSynthesizedStatus()` | Replace with direct `order.status` read after status types are fixed | High |
| `domain/store.tsx` — `addClaim`, `addSettlement`, `addExpense`, `addPurchase` | Add `FinancialAuditLog` writes | High |
| Navigation / routing | Migrate from `activeModule` state to Next.js URL routes | Medium |
| `components/modules/dashboard-view.tsx` | Break into sub-components to reduce file size | Medium |
| Sidebar navigation | Make `audit-view.tsx` reachable | Medium |
| App bundle | Add `dynamic()` code splitting for all module views | Low |

---

*This document is a pure analysis artifact. No source files were modified in producing this document.*
