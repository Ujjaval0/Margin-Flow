# Product Requirements Document (PRD): MarginFlow

| Metadata | Details |
| :--- | :--- |
| **Product** | MarginFlow — E-Commerce Financial Intelligence |
| **Owner** | Product Management |
| **Audience** | Leadership, Business Stakeholders, Engineering |
| **Status** | Approved for Development |

---

## 1. Problem Statement
Brands selling across Amazon, Flipkart, Meesho, and their own websites are misled by top-line sales figures. While marketplace dashboards show high revenue, hidden deductions—such as platform commissions, weight penalties, return shipping fees, damaged inventory, and ad costs—quietly wipe out profits. 

Currently, finance and operations teams spend over 15 hours a week downloading and stitching together messy spreadsheets. By the time they realize a product is losing money, thousands of rupees in capital have already been burned.

---

## 2. Objective & Value Proposition
Build a single financial dashboard that automatically reconciles multi-channel orders, fees, and returns to show **true net cash in hand** per product, order, and channel. 

**Business Value:**
* Recover 3% to 5% in lost margin from marketplace overcharges and missed claims.
* Cut weekly manual spreadsheet work from 15+ hours to under 2 hours.
* Instantly stop ad spend on products that are losing money after all fees.

---

## 3. Target Users
* **Brand Founders & Business Heads:** Need a single, accurate view of daily net cash profit across all channels.
* **E-Commerce & Marketing Managers:** Need to know which products actually generate profit so they can set pricing and allocate ad budgets wisely.
* **Finance & Operations Teams:** Need to verify marketplace payouts, detect fee discrepancies, and track dispute claims before deadlines expire.

---

## 4. Key Features & Scope

### 4.1 Unified Multi-Channel Profit Dashboard
* Centralize sales and financial performance across Amazon India, Flipkart, Meesho, and Shopify in one place.
* Real-time view of Net Sales, Product Cost, Platform Cuts, Return Losses, and Actual Net Profit.
* Channel-by-channel comparison to see which platform delivers the highest profit margin.

### 4.2 Order & SKU Unit Economics
* Display exact net profit for every individual order and SKU.
* Lock the product cost at the time an order is placed so future inventory price changes do not distort past records.
* Flag loss-making products with an automatic warning so operators can adjust pricing or pause sales.

### 4.3 Automated Settlement & Fee Reconciliation
* Upload or sync marketplace payout reports with one click.
* Automatically compare actual bank deposits against invoiced sales.
* Flag mismatched deductions, overcharged commission rates, and excess shipping fees for quick review.

### 4.4 Returns & Reverse Logistics Tracker
* Automatically categorize returns into unopened packages (RTO) vs. customer returns.
* Track write-offs for damaged or unsellable products, accounting for any scrap or salvage recovery.
* Prevent double-counting of product costs on damaged inventory.

### 4.5 Dispute & Claims Manager
* Identify customer-damaged or lost-in-transit items eligible for marketplace reimbursement (e.g., Amazon SAFE-T claims).
* Track claims from filing to recovery.
* Alert the team before marketplace dispute deadlines expire (typically 7–14 days).

### 4.6 Marketing & Ad Spend Reality Check (POAS)
* Attribute daily ad spend directly to channels and products.
* Track Profit on Ad Spend (POAS) alongside top-line ad return to identify "false winners"—products that look great on ad dashboards but lose money after product costs and platform fees.

---

## 5. What We Are NOT Doing (Out of Scope)
* **Not a tax filing tool:** Does not replace Tally, Zoho Books, or QuickBooks for statutory accounting and filing.
* **No payment processing:** Does not disburse payouts or initiate bank transfers.
* **No inventory warehouse management:** Tracks product costs and return dispositions, but does not manage physical warehouse barcodes or bins.

---

## 6. Success Metrics (KPIs)
* **Time Saved:** Reduce weekly financial reconciliation time by 85%.
* **Margin Recovery:** Flag at least 3% of monthly revenue in recoverable fee discrepancies and unfiled dispute claims.
* **Decision Speed:** Identify unprofitable SKUs within 24 hours instead of waiting 15–30 days for month-end reports.

---

## 7. Rollout Milestones

* **Phase 1 (Core Profit Engine):** Unified dashboard, order-level net profit, and product cost locking.
* **Phase 2 (Reconciliation & Returns):** Bulk marketplace payout reconciler, discrepancy flagging, and return loss tracking.
* **Phase 3 (Claims & Marketing):** Dispute claim deadline alerts and ad-spend profit attribution.
