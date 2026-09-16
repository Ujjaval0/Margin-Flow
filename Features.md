# Platform Features & Architecture Specification

> **Live Reference Document**  
> **Last Updated:** 2026-09-15  
> **Maintainer:** Engineering & Product Team  
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
- **SKU Economics Deep-Dive Table:** Searchable, sortable unit economics breakdown table featuring Net Revenue, Net Profit, Contribution Margin %, Return Rate, Ad Spend, and SKU-level POAS multiplier.

### 2.3 Channel & Marketplace Filtering (`src/components/layout/navbar.tsx`)
- Instant switching between **All Channels**, **Amazon India**, **Flipkart**, **Meesho**, and **Personal Website**.
- Recalculates all KPIs, charts, orders, returns, settlements, and dispute ledgers in real time.
- Global search input for orders, SKUs, returns, and dispute claims.

### 2.4 Order Lifecycle Management (`src/components/modules/orders-view.tsx`)
- Unified multi-channel order ingestion supporting states: `CONFIRMED`, `SHIPPED`, `DELIVERED`, `RTO`, `RETURNED`, `PARTIALLY_RETURNED`, `CANCELLED`.
- **Locked Unit Cost Basis:** Every order line item preserves `snapshotUnitCost` at order creation time to prevent COGS distortion when suppliers change prices.
- Fast transaction entry modal (`New Transaction`) to record manual or off-platform sales.

### 2.5 Returns & Reverse Logistics (`src/components/modules/returns-view.tsx`)
- Categorization by return nature: `CUSTOMER_RETURN`, `RTO` (Return to Origin), `DAMAGED_RETURN`, and `LOST_RETURN`.
- Inventory condition tagging: `SELLABLE`, `DAMAGED`, `USED`, `MISSING`, `UNUSABLE`, `UNDER_INSPECTION`.
- Net financial loss calculation factoring return shipping fee, scrap salvage value, and claim link.

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

### 2.11 AI Document Staging Sandbox (`src/components/modules/ai-staging-view.tsx`)
- **Human-in-the-Loop (HITL) Staging:** Raw documents (supplier bills, invoices, settlement reports) are ingested into an isolated quarantine state (`STAGED_NEEDS_REVIEW`).
- **Zero Direct Ledger Writes:** AI extractions cannot post directly to financial ledgers without human review.
- **Arithmetic Invariant Validation:** Automated check verifying `Qty × UnitPrice − Discount + Tax ≡ TotalAmount` (±₹0.05 tolerance). Flagged math errors are highlighted for operator intervention.
- Field-level provenance tracking: `AI_EXTRACTED`, `MANUALLY_ENTERED`, or `MANUALLY_MODIFIED`.

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

- **Clean & Modern Aesthetic:** Built with Next.js App Router, Tailwind CSS, and Lucide React.
- **Subtle Visual Hierarchy:** Uniform neutral borders (`border-slate-200`) with intentional contextual icon indicators, eliminating cluttered multi-colored top borders.
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
