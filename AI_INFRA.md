# AI Architecture & Infrastructure Specification (`AI_INFRA.md`)

> **Live Engineering & Product Specification**  
> **Date:** 2026-09-16  
> **Target System:** Unified E-Commerce Financial Intelligence Platform  
> **Status:** Architecture Reference & Implementation Blueprint  

---

## 1. Executive Summary & Market Landscape

In multi-channel e-commerce (Amazon India, Flipkart, Meesho, D2C/Website), standalone generic chatbots create minimal retention. High-performing e-commerce platforms (such as *Sellerboard*, *Sellerise*, *Helium 10*, *Shopify Sidekick*, and enterprise AI ERPs like *SAP Joule / Microsoft Copilot for Finance*) embed AI directly into financial calculation and operational exception-handling workflows.

### Competitor Landscape & Patterns

| Competitor / System | Primary AI Capability | Value Delivered | Limitation / Risk |
|---|---|---|---|
| **Sellerboard / Sellerise** | Profit analytics & fee reimbursement detection | Uncovers hidden FBA overcharges & lost inventory | Mostly reactive table views; minimal natural language exploration |
| **Helium 10** | SEO, listing copy, and PPC bidding automation | Accelerates product launches and ad keyword management | Focused on growth/marketing rather than true post-fee net margin & cash flow |
| **Shopify Sidekick** | Conversational business copilot | Answers natural language questions regarding store sales, discounts, and customer behavior | Constrained to Shopify-only ecosystem; lacks Indian multi-marketplace nuance (e.g., Meesho RTO, SAFE-T claims) |
| **ClaimLane / AI Dispute Platforms** | Autonomous evidence compilation for chargebacks and shipping claims | Ingests courier scans and order proof to submit carrier claims before deadlines | Requires strict guardrails to prevent submitting incomplete or policy-violating disputes |
| **Enterprise ERP Copilots (SAP Joule, MS Finance)** | Reconciles bank statements against open invoices; flags variance anomalies | Eliminates manual cross-referencing of deduction manifests | High complexity; requires disciplined data models and deterministic data preparation |

---

## 2. The 4 High-Impact AI Implementations for Our Platform

To deliver tangible return on investment (ROI) to sellers, AI is structured into four specialized functional pillars:

```
                                  ┌─────────────────────────────────────────────────────────────┐
                                  │               UNIFIED AI INTELLIGENCE LAYER                 │
                                  └──────────────────────────────┬──────────────────────────────┘
                                                                 │
         ┌───────────────────────────────┬───────────────────────┴───────────────────────┬───────────────────────────────┐
         ▼                               ▼                                               ▼                               ▼
 ┌──────────────────────┐    ┌──────────────────────┐                        ┌──────────────────────┐    ┌──────────────────────┐
 │ 1. CFO Copilot &     │    │ 2. Anomaly & Margin  │                        │ 3. One-Click SAFE-T  │    │ 4. Restock & Working │
 │ Natural Language     │    │ Leakage Radar        │                        │ Claim Generator      │    │ Capital Advisor      │
 │ Insights Assistant   │    │                      │                        │                      │    │                      │
 ├──────────────────────┤    ├──────────────────────┤                        ├──────────────────────┤    ├──────────────────────┤
 │ Natural Q&A on P&L,  │    │ Proactive alerts on  │                        │ Auto-compiles order, │    │ Forecasts stockout   │
 │ ad drag, and margins │    │ hidden deductions &  │                        │ return photo & policy│    │ dates & recommends   │
 │ with instant filters │    │ negative-margin SKUs │                        │ proof into claim text│    │ supplier reorders    │
 └──────────────────────┘    └──────────────────────┘                        └──────────────────────┘    └──────────────────────┘
```

---

### Implementation 1: CFO Conversational Copilot ("Chat With Your P&L")
- **Role:** An interactive drawer or assistant that allows operators to query financial data in natural language without manually downloading spreadsheets or configuring multidimensional filters.
- **Core Capabilities:**
  - Dynamic answers grounded in active date-range and marketplace context.
  - Generates comparative explanations: *"Why did net operating profit drop 6% vs. last week?"* ➔ Breaks down ad spend surge, Flipkart return spike, and specific SKU COGS shifts.
  - Identifies POAS (Profit on Ad Spend) drag: *"Which SKUs have positive ROAS but negative POAS?"*
  - Interactive Action Chips: In-line buttons allowing users to click *"Apply Meesho Filter"*, *"Inspect Elephant Toy SKU"*, or *"Export Breakdown"*.

---

### Implementation 2: Proactive Anomaly & Margin Leakage Radar
- **Role:** Autonomous background monitoring engine that surfaces critical financial risks before they compound into substantial balance sheet losses.
- **Trigger Heuristics:**
  1. **Fee Creep Detection:** Flags marketplace commissions, pick-and-pack charges, or fixed fees that deviate >10% from standard category rate cards.
  2. **Ad Bleed on High-Return SKUs:** Detects campaigns driving high sales volume for products with >25% return/RTO rates (spending advertising capital to generate logistics write-offs).
  3. **Settlement Lag & Overdue Disbursement:** Flags delivered orders aging past 14 days without an associated reconciled settlement batch.
  4. **Cost Discrepancy Alert:** Identifies orders where historical cost snapshots indicate a unit cost compression.

---

### Implementation 3: One-Click SAFE-T & Dispute Claim Packet Generator
- **Role:** Intelligent claims compilation engine that eliminates 15+ minutes of manual claim drafting per damaged or lost return.
- **Workflow:**
  1. User selects a return tagged as `DAMAGED_RETURN`, `LOST_RETURN`, or an illegitimate `CUSTOMER_RETURN`.
  2. The AI reads the order metadata (Marketplace Channel, Order ID, Tracking Number, Delivered Date, Return Received Date, Invoice Unit Cost).
  3. The engine cross-checks the marketplace filing window (e.g., within 30 days for Amazon India SAFE-T; 7 days for Flipkart dispute).
  4. Generates a structured dispute packet including:
     - Policy-compliant claim rationale.
     - Quantified financial loss itemization (Product Unit Cost + Forward/Reverse Shipping Loss − Salvage Value).
     - Required photo/document evidence checklist.
  5. Operator reviews and copies or submits the packet directly to the marketplace partner portal.

---

### Implementation 4: Predictive Restock & Working Capital Advisor
- **Role:** Supply chain and working capital optimization assistant.
- **Core Capabilities:**
  - Computes run-rate velocity per SKU across all channels simultaneously.
  - Predicts **Days of Inventory Remaining (DOIR)** factoring in supplier lead times.
  - Generates optimized supplier Purchase Order (PO) recommendations that maximize contribution margin without trapping excess cash in slow-moving inventory.

---

## 3. Safe AI Infrastructure & Execution Guardrails

In financial software, hallucinated arithmetic or accidental ledger writes destroy user trust. The AI layer is architected under strict **non-destructive, deterministic boundaries**:

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                            USER INTERACTION                             │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │ Natural Language / Action Trigger
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │               DETERMINISTIC DATA PREPARATION (TypeScript)               │
 │ • All sums, margins, POAS, and settlement aging computed deterministically │
 │ • Raw mathematical aggregates compiled into structured JSON context      │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │ Pre-Calculated Grounded Context
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                   LLM INFERENCE & REASONING LAYER                       │
 │ • Generates natural language summaries, insights, and claim narratives  │
 │ • Zero direct math calculation — LLM explains verified system metrics   │
 └────────────────────────────────────┬────────────────────────────────────┘
                                      │ Structured Proposals & Action Intents
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │              HUMAN-IN-THE-LOOP (HITL) EXECUTION GATEWAY                 │
 │ • Read-Only default: Copilot can change filters, navigate, and suggest  │
 │ • Ledger mutation requires explicit user confirmation (Review Modal)   │
 │ • Zero silent database writes                                           │
 └─────────────────────────────────────────────────────────────────────────┘
```

### Core Invariants of the AI Layer:
1. **Zero Hallucinated Math:** The LLM is never tasked with summing raw orders or calculating division ratios. All numbers provided in AI responses are sourced directly from the deterministic outputs of `src/domain/profitability-engine.ts`.
2. **Read-Only Context Injection:** The AI context is built as a sanitized read-only projection containing current active filters, metric snapshots, SKU anomalies, and settlement aging summaries.
3. **Partition 7 HITL Compatibility:** For document ingestion (supplier bills, invoices), AI extractions are quarantined in `STAGED_NEEDS_REVIEW` until validated against arithmetic invariants (`Qty × UnitPrice − Discount + Tax ≡ TotalAmount`).
4. **Actionable UI Integration:** AI insights return structured action objects that bind to platform UI handlers (e.g., `SET_CHANNEL_FILTER`, `OPEN_SKU_DRAWER`, `GENERATE_CLAIM_DRAFT`).

---

## 4. Technical Implementation Roadmap

```mermaid
flowchart LR
    Phase1["Phase 1: CFO Copilot & Q&A"] --> Phase2["Phase 2: Anomaly & Margin Radar"]
    Phase2 --> Phase3["Phase 3: SAFE-T Claim Drafter"]
    Phase3 --> Phase4["Phase 4: Predictive Restock"]
```

### Phase 1: Interactive CFO Copilot
- Create `src/components/ai/cfo-copilot.tsx` slide-over panel.
- Implement domain context serializer (`src/domain/ai-context.ts`) that bundles current profitability metrics, top performing SKUs, loss-making items, and settlement aging.
- Equip with quick-prompt chips (*"Margin Overview"*, *"POAS Audit"*, *"Return Rate Spikes"*).

### Phase 2: AI Margin Leak & Anomaly Radar
- Create automated detection functions in `src/domain/anomaly-engine.ts`.
- Render an executive AI briefing card at the top of the dashboard.

### Phase 3: Autonomous SAFE-T Dispute Generator
- Add a "Draft SAFE-T Claim" action to the Returns & Claims modules.
- Pre-fill formal dispute documentation with verified tracking and cost snapshot evidence.

### Phase 4: Demand & Inventory Forecasting
- Extend product catalog with lead-time parameters and stockout probability scoring.
