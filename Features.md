# Platform Features & Architecture Specification

> **Live Reference Document**  
> **Last Updated:** 2026-09-16  
> **Maintainer:** Engineering & Product Team  
> **Related Architecture & Workflow:** [`workflow.md`](file:///c:/Users/freak/Desktop/Unified%20platform/workflow.md)  
> **Rule:** Whenever a new feature, module, or core invariant is introduced or modified, document it in this file with the date, description, and status.

---

## 1. Project Background & Objective

The **Unified E-Commerce Financial Intelligence Platform** is designed for multi-channel e-commerce sellers (operating across Amazon India, Flipkart, Meesho, and Direct-to-Consumer/Personal Website).

### Core Problem Solved
Traditional seller dashboards show top-line sales figures that mislead operators into false perceptions of profitability. Hidden marketplace commission deductions, reverse logistics shipping fees, return damages, untracked SAFE-T claims, and shifting inventory cost bases erode real net margins.

### Solution Provided
A transaction-level profit engine structured around **7 segregated domain partitions** that calculates true unit economics from gross customer payment down to net operating profit, protected by deterministic invariant checks and Human-in-the-Loop (HITL) AI document verification.

---

## 2. Feature Inventory (Current Implementation)

### 2.1 Multi-Tier Profitability Engine (`src/domain/profitability-engine.ts`)
- **Real-Time Financial Hierarchy:**
  - **Gross Sales** − Discounts = **Net Revenue**
  - Net Revenue − COGS (Historical Snapshot) = **Gross Profit & Gross Margin %**
  - Gross Profit − Marketplace Commissions − Logistics − (Return & RTO Losses) + Dispute Recoveries = **Contribution Profit & Contribution Margin %**
  - Contribution Profit − Operating Expenses (OPEX) = **Net Operating Profit & Net Margin %**
- **Tax Liability Isolation:** TCS, TDS, and GST are separated into balance sheet liabilities and barred from OPEX dilution.
- **Granular Scopes:** Real-time computation at Global Business level, Channel/Marketplace level, and individual SKU level.
- **POAS (Profit on Ad Spend) Engine:** Attributes ad spend per marketplace and SKU; calculates `POAS = Contribution Profit / Total Ad Spend` and `ROAS = Net Revenue / Total Ad Spend` to identify when ad scale is genuinely generating net cash vs. eroding margins.

### 2.2 Financial & Operational Dashboard (`src/components/modules/dashboard-view.tsx`)
- **Primary KPI Cards:** Net Revenue, Gross Profit, Contribution Profit, and Net Operating Profit with dynamic margin tags.
- **Operational Metrics Row:** Clean, icon-based indicators without clutter:
  - Active order volume & units sold
  - Settlement inflow deposited in bank
  - Total marketplace deductions & fixed fees
  - Return & RTO loss with live return rate %
  - SAFE-T credit dispute recoveries
  - Physical damage write-offs
  - **POAS / Ad Spend Metric:** Blended POAS multiplier, total ad spend, and health tag (`Profitable Scale` vs. `High Ad Drag`).
- **Channel Economics Comparison:** Interactive multi-metric bar chart comparing Revenue, COGS, Deductions, and Net Profit across Amazon, Flipkart, Meesho, and Website, now with channel-level POAS badges.
- **Revenue Distribution Donut:** Share of total revenue by sales channel.
- **Loss-Making SKU Advisory:** Dynamic automated warning alert highlighting products whose contribution margin is negative after returns and write-offs.
- **Quick Record Actions Docked Toolbar:** Direct-entry shortcuts for `+ Add Order`, `Record Return`, and `Add Supplier Payment`. The `Add Order` modal provides complete light-mode parity with the Orders view, including channel fee estimations, COGS calculation, and integrated `MARK AS RETURNED / RTO ORDER` and `RETURNED PRODUCT IS DAMAGED / DEFECTIVE (FILE CLAIM)` intake flows.
- **SKU Economics Deep-Dive Table:** Searchable, sortable unit economics breakdown table featuring Net Revenue, Net Profit, Contribution Margin %, Return Rate, Ad Spend, and SKU-level POAS multiplier.

### 2.3 Channel & Marketplace Filtering (`src/components/layout/navbar.tsx`)
- Instant switching between **All Channels**, **Amazon India**, **Flipkart**, **Meesho**, and **Personal Website**.
- Recalculates all KPIs, charts, orders, returns, settlements, and dispute ledgers in real time.
- Global search input for orders, SKUs, returns, and dispute claims.

### 2.4 Order Lifecycle Management (`src/components/modules/orders-view.tsx`)
- **Restructured Dark Fintech Ledger:** Follows exact user-specified layout and column sequence:
  1. `PLATFORM & DATE`: Color-coded platform badge (`AMAZON`, `FLIPKART`, `MYNTRA`, `MEESHO`, `WOOCOMMERCE`, `OTHER`) + date.
  2. `ORDER ID & SKU`: Monospace identifier + primary SKU and multi-item indicator (`+N`).
  3. `PRODUCT NAME`: Product title, customer name, and quantity badge (`Qty: X`).
  4. `GROSS SALE`: Transaction gross sales value in INR (`₹`).
  5. `COGS`: Locked historical unit cost basis.
  6. `SETTLEMENT`: Real-time status (`Settled` in emerald / `Pending` in amber).
  7. `DELIVERY & RETURN`: Synthesized status pill (`DELIVERED`, `CUSTOMER RETURN`, `RTO`, `DAMAGED RETURN`, `CLAIM PENDING`, `CLAIM APPROVED`).
  8. `NET PROFIT`: Contribution profit with margin percentage (`+₹` / `-₹`).
  9. `ACTIONS`: `View P&L` drawer opening full unit economics breakdown and status transition controls.
- **Dedicated Filter Bar & Controls:**
  - `Search order ref, SKU, or name...` multi-field search.
  - **Platform Dropdown:** `All Platforms`, `AMAZON`, `FLIPKART`, `MYNTRA`, `MEESHO`, `WOOCOMMERCE`, `OTHER`.
  - **Status & Claims Dropdown:** `All Statuses`, `DELIVERED`, `CUSTOMER RETURN`, `RTO`, `DAMAGED RETURN`, `CLAIM PENDING`, `CLAIM APPROVED`.
  - **Action Buttons:** `Import CSV` (bulk multi-channel ingestion), `Export CSV` (filtered 14-column CSV download), and `+ Add Order` (purple transaction creation modal).
  - **Empty State:** `No orders matching active filters found.` with reset filter shortcut.

### 2.5 Returns & Reverse Logistics (`src/components/modules/returns-view.tsx`)
- **3+1 Operational Categorization:** `All Returns`, `Customer Returns` (opened/defective with mandatory QC), `RTO Undelivered` (sealed packages for rapid 1-click restock), and `Old & Aging Returns` (>14 days uninspected or approaching claim SLA).
- **Operational KPI Summary Cards:**
  - Total Returns Loss with gross return units and salvaged recovery value.
  - Live RTO Failure Rate % vs total dispatched units with COD health threshold tags.
  - Old & Aging Backlog count with urgency alerts.
  - Dispute Claim Potential tracking unfiled damaged losses and expiring claim deadlines.
- **Advanced Local Filter Bar:** Real-time omni-search (AWB, Order ID, Return ID, SKU, Product Name), local Channel filter dropdown (including `B2B Wholesale`), QC Condition dropdown, and CSV export.
- **Dual-Mode Log Return Modal:**
  - *Mode 1 (Scan / Order Lookup):* Fast AWB / Order ID lookup with multi-item line picker, return quantity stepper (enforcing Invariant P3 `returned <= ordered`), and auto-freight estimation.
  - *Mode 2 (Direct SKU / Wholesale Manual Entry):* Direct SKU autocomplete from master catalog, channel selection, bulk carton unit stepper, and automatic purchase cost retrieval.
  - Automatic draft dispute claim generation for damaged or lost returns.
- **Row-Level Inline Editing & Quick Actions:** 1-click `[↺ Restock]` button to put away sellable items, interactive inspection condition switcher right on the table row, and in-place edit modal for quantities, freight, salvage recovery, and journal notes.

### 2.6 Claims & Dispute Tracking (`src/components/modules/claims-view.tsx`)
- Tracking of SAFE-T claims, lost-in-transit cases, wrong return items, and marketplace fee overcharges.
- Full dispute lifecycle: `FILED` ➔ `UNDER_REVIEW` ➔ `APPROVED` / `PARTIALLY_RECOVERED` ➔ `RECOVERED` / `REJECTED`.
- Links recoveries directly back to Contribution Profit calculations.

### 2.7 Product Catalog & Historical Cost Basis (`src/components/modules/products-view.tsx`)
- Master SKU management with channel aliases (maps Amazon ASINs, Flipkart FSINs, and Meesho product codes to one master SKU).
- **Time-Windowed Cost Basis:** Maintains complete historical purchase cost timelines with date ranges and adjustment audit notes.

### 2.8 Marketplace Settlement Reconciliation (`src/components/modules/settlements-view.tsx`)
- Settlement batch reconciliation verifying `Gross − Deductions − TCS/TDS ≡ Net Bank Deposit`.
- Categorized deduction audit: Marketplace commissions, logistics fees, pick-pack fees, payment gateway charges, and reverse shipping.
- Reconciliation status flags: `RECONCILED`, `MISMATCH_FLAGGED`, `PENDING_RECON`.
- **Settlement Aging & Cash Flow Pipeline:**
  - Automated aging classification for pending payouts: `0–7 Days (Cycle Safe)`, `8–14 Days (Approaching Threshold)`, and `> 14 Days (Delayed / Overdue)`.
  - Interactive drill-down cards displaying outstanding balances, order counts, and expandable overdue order tables highlighting un-settled transactions.

### 2.9 Supplier Purchases & Inventory Inflow (`src/components/modules/suppliers-view.tsx`)
- Supplier profile directory with contact info and GSTIN tracking.
- Purchase bill ingestion tracking unit purchase cost, tax amount, bill payment status, and source documents.

### 2.10 Operating Expense Ledger (`src/components/modules/expenses-view.tsx`)
- Centralized OPEX tracking across Advertising, Salaries, Software, Warehouse Rent, Packaging, Office, and Logistics.
- Strict isolation from marketplace order fees and direct COGS for accurate Net Operating Margin.

### 2.11 AI Document Staging Sandbox & Bill OCR Extraction (`src/components/modules/ai-staging-view.tsx`, `src/domain/ocr-engine.ts`, `src/app/api/upload-bill/route.ts`)
- **Bill & Invoice File Upload:** Drag-and-drop or file selector supporting PDF, PNG, JPG, and TXT files. Uploaded documents are saved directly to the dedicated directory (`public/uploads/bills/`).
- **OCR & Intelligent Document Processing (IDP):** Fast entity extraction parsing Vendor / Marketplace, Invoice Number, Order Date, SKU, Product Name, Quantity, Unit Price, Tax/GST, and Grand Total.
- **Human-in-the-Loop (HITL) Staging:** Ingested documents enter an isolated quarantine state (`STAGED_NEEDS_REVIEW`). Zero direct writes to production ledgers without operator review.
- **Arithmetic Invariant Validation (P7):** Real-time verification that `Qty × UnitPrice − Discount + Tax ≡ TotalAmount` (±₹0.05 tolerance). Flagged math errors are highlighted in red for manual correction.
- **Sample Document Quick-Load:** One-click preloads for Amazon and Flipkart tax invoices to facilitate instant testing and demonstration without external files.
- **Production Ledger Commitment:** Operators can edit extracted values directly or approve documents to automatically update product purchase costs and record immutable financial audit entries.
- **Field Provenance Tracking:** Tracks whether values are `AI_EXTRACTED`, `MANUALLY_ENTERED`, or `MANUALLY_MODIFIED`.

### 2.12 Comprehensive Analytics & P&L Statements (`src/components/modules/reports-view.tsx`)
- Complete financial statement breakdown covering Net Sales, Cost of Goods Sold, Marketplace Deductions, Reverse Logistics, Gross Profit, and Net Operating Margin.
- Printable/exportable view for accountants and tax auditors.

### 2.13 Immutable Financial Audit Ledger (`src/components/modules/audit-view.tsx`)
- Chronological append-only event log capturing every financial change (order updates, claim recoveries, cost adjustments, staged document approvals).
- Tracks `entityType`, `entityId`, `fieldName`, `oldValue`, `newValue`, `modifiedBy`, and timestamps.

---

## 3. Developer & QA Guardrails Architecture (`GUARDRAILS.md`)

All operational and financial invariants are enforced in the domain layer (`src/domain/guardrails.ts`) and fully documented in `GUARDRAILS.md`. Diagnostic checks remain isolated in code and documentation:

1. **P1 — Cost Snapshot Integrity:** Verifies `snapshotUnitCost > 0` on every order line item.
2. **P2 — Ingestion Idempotency:** Prevents duplicate `marketplace:channelOrderId` key ingestion.
3. **P3 — Return Quantity Ceiling:** Guarantees `Sum(Returned) <= Sum(Ordered)` per order item.
4. **P4 — Settlement Balance:** Enforces `Gross − Deductions − Tax ≡ Net Settlement`.
5. **P5 — Claim Recovery Ceiling:** Ensures `amountRecovered <= amountClaimed`.
6. **P6 — Tax Liability Isolation:** Guarantees TCS, TDS, and GST do not dilute OPEX.
7. **P7 — AI Extraction Guard:** Quarantines documents failing schema or arithmetic invariants.

---

## 4. UI / UX Design System

- **Clean & Modern Fintech Aesthetic:** Built with Next.js App Router, Tailwind CSS, and Lucide React following Apple and Linear minimalist design principles.
- **Subtle Visual Hierarchy:** Uniform neutral borders (`border-slate-200`) with intentional contextual icon indicators, eliminating cluttered multi-colored top borders.
- **Tabular Monospace Numerics:** Global `tabular-nums` and `-moz-font-feature-settings: "tnum"` applied to all monetary, order volume, and percentage cells to ensure clean vertical alignment during visual scanning.
- **Interactive Drilldowns & Cross-Card Triggers:**
  - Secondary metric cards (Volume, POAS, Returns, Write-offs) trigger automatic sorting and smooth scrolling into the SKU unit economics ledger.
  - Loss-making SKU advisory chips dynamically filter the table to pinpoint margin-diluting products in one click.
- **SKU Unit Economics Slide-Over Drawer:** Click-to-inspect side panel providing granular single-unit step-down waterfalls (ASP ➔ COGS ➔ Marketplace Commissions ➔ Reverse Freight ➔ Net Contribution) without leaving the dashboard view.
- **One-Click Data Portability:** Instant CSV export utility for SKU profitability records.
- **Responsive Layout:** Fixed navigation sidebar with collapsed view on smaller viewports and mobile-friendly metrics grids.

---

## 5. Changelog & Feature Timeline

| Date | Module / Feature | Description | Status |
|---|---|---|---|
| **2026-09-15** | UI/UX Metric Cards | Removed heavy colored top-borders (`border-t-4`) from secondary metric cards; redesigned with neutral borders and clean contextual icons. | ✅ Completed |
| **2026-09-15** | Guardrails Documentation | Created `GUARDRAILS.md` developer reference detailing 7 partition contract checks & 3-layer AI defense architecture. | ✅ Completed |
| **2026-09-15** | Guardrails Frontend Removal | Completely removed the embedded guardrail diagnostics panel, sidebar button, navbar pill, and modal from the user-facing frontend. | ✅ Completed |
| **2026-09-15** | Features Documentation | Established `Features.md` as the permanent living record of all platform capabilities and future roadmap updates. | ✅ Completed |
| **2026-09-16** | Date-Range Filtering & Trends | Dynamic time-window selector (`All Time`, `Today`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`) with period-over-period percentage comparison trends on all top KPI cards. | ✅ Completed |
| **2026-09-16** | SKU Economics Deep-Dive Table | Interactive product-level economics table on the dashboard with live search, column-level sorting (Revenue, Profit, Margin, Returns), and quick filter pills (`All`, `Profitable`, `Loss-Making`). | ✅ Completed |
| **2026-09-16** | POAS (Profit on Ad Spend) & Channel Attribution | Implemented granular ad spend tracking across channels and SKUs; computed `POAS = Contribution Profit / Ad Spend` alongside ROAS to expose real ad-driven cash generation on Dashboard KPI cards, channel lists, and SKU table. | ✅ Completed |
| **2026-09-16** | Settlement Aging Brackets | Forensic cash flow aging module categorizing un-settled and pending disbursements into `0–7 Days (Cycle Safe)`, `8–14 Days (Approaching Threshold)`, and `> 14 Days (Delayed / Overdue)` with interactive drill-down cards and order inspection. | ✅ Completed |
| **2026-09-16** | UI/UX Design System & Drawer | Implemented `tabular-nums` financial alignment, click-to-drilldown operational cards, loss-advisory filtering, SKU inspection slide-over drawer with unit waterfall, and one-click CSV export. | ✅ Completed |
| **2026-09-16** | Navigation & Brand Refinement | Removed navbar search bar, introduced collapsible workspace sidebar toggle with `Ctrl+B` shortcut, and rebranded platform to **MarginFlow**. | ✅ Completed |
| **2026-09-17** | Bill Upload & OCR Ingestion | End-to-end bill upload modal, directory file persistence (`public/uploads/bills/`), multimodal OCR parsing, arithmetic validation, and HITL staging. | ✅ Completed |
| **2026-09-17** | Dual-Mode Financial View & Quick Actions | Implemented **Operator Payout View** (6-card layout: Gross Sales, True Profit, Net Payout, Returns & RTO split, Wholesaler COGS, Damaged Claims) alongside **CFO / GAAP View**, with interactive **Card Logic & Formula Tooltips `(i)`**, direct **Card Drilldowns `↗`**, and **Quick Record Actions** docked bar (`+ Add Order`, `↺ Record Return`, `🚚 Add Supplier Payment`). | ✅ Completed |
| **2026-09-17** | Reverse Logistics & Returns Overhaul | Implemented **3+1 Categorization** (`All Returns`, `Customer Returns`, `RTO Undelivered`, `Old & Aging Returns`), 4 operational KPI summary cards, advanced local filter bar with channel & QC dropdowns, **Dual-Mode Log Return modal** (Scan/Order lookup + Direct SKU Wholesale intake), **1-click Restock putaway**, and in-place row editing. | ✅ Completed |
| **2026-09-17** | Add Order Return & Claims Workflow | Upgraded the **Add Order modal** with an interactive dark-themed **Mark as Returned / RTO Order** module: dynamic return type, freight deduction, return reason, and nested **Damaged / Defective Claim** section (Claim Amount, Claim Status dropdown with Draft/Filed/Approved/Rejected, and Approved Reimbursement) with automated return and claim record creation. | ✅ Completed |

---

## 6. Template for Future Features

When building and documenting upcoming features in this document, follow this format:

```markdown
### [Feature Name]
- **Date Added:** YYYY-MM-DD
- **Target Partition / Module:** (e.g., Orders, Settlements, AI Staging, etc.)
- **Purpose & User Value:** Brief statement of what the feature does and why it exists.
- **Core Components & Files:** Key source paths involved.
- **Invariants / Business Logic:** Special calculations, guardrails, or rules enforced.
```
