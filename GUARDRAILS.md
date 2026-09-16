# System Guardrails — Developer Reference

> **Audience:** Developers & QA Engineers  
> **Purpose:** Ensure all 7 domain partition invariants are passing correctly in production and staging.  
> **Auto-checked:** Yes — runs on every state mutation via `runSystemGuardrailDiagnostics()` in `src/domain/guardrails.ts`

---

## Overview

The platform enforces **7 deterministic invariant checks** across all financial domain partitions. These checks prevent data hallucination, arithmetic drift, duplicate ingestion, and illegal state transitions.

All checks run inside `useMemo` in `src/domain/store.tsx` and recompute whenever any of the tracked state slices change.

---

## Guardrail Checks

### P1 — Catalog & Cost Basis: Cost Snapshot Integrity

| Property | Value |
|---|---|
| **Partition** | P1: Catalog & Cost Basis |
| **Invariant** | Every order line item must have a locked, immutable historical unit cost (`snapshotUnitCost > 0`) |
| **Violation Trigger** | Any `order.items[n].snapshotUnitCost <= 0` |
| **Severity** | `CRITICAL` |
| **Source** | `src/domain/guardrails.ts` — L26–43 |

**Why:** Historical COGS must be computed using the cost price at order time, not the current live price.

**Fix:** Ensure every order line item receives `snapshotUnitCost` from `Product.currentCostPrice` at order creation time.

---

### P2 — Order Lifecycle: Channel Ingestion Idempotency

| Property | Value |
|---|---|
| **Partition** | P2: Order Lifecycle |
| **Invariant** | No duplicate `marketplace:channelOrderId` key pairs should exist |
| **Violation Trigger** | Same `(marketplace, channelOrderId)` pair appears more than once |
| **Severity** | `WARNING` |
| **Source** | `src/domain/guardrails.ts` — L46–65 |

**Why:** Duplicate orders inflate revenue and COGS, causing false profitability readings.

**Fix:** Apply upsert logic on `channelOrderId` per marketplace during ingestion.

---

### P3 — Reverse Logistics: Return Quantity Ceiling Invariant

| Property | Value |
|---|---|
| **Partition** | P3: Reverse Logistics |
| **Invariant** | `Sum(ReturnRecord.quantity) <= Sum(OrderItem.quantity)` for any given order+SKU pair |
| **Violation Trigger** | `returnRecord.quantity > lineItem.quantity` |
| **Severity** | `CRITICAL` |
| **Source** | `src/domain/guardrails.ts` — L67–89 |

**Why:** Returning more units than were sold is a financial impossibility and distorts return rate metrics.

**Fix:** Validate return quantity against original order quantity before persisting any `ReturnRecord`.

---

### P4 — Settlements & Deductions: Mathematical Settlement Balance

| Property | Value |
|---|---|
| **Partition** | P4: Settlements & Deductions |
| **Invariant** | `Gross - Sum(Deductions) - TCS/TDS Tax ≡ Net Settlement` (tolerance: ±₹0.05) |
| **Violation Trigger** | `|calculatedNet - settlement.netSettlement| > 0.05` |
| **Severity** | `WARNING` |
| **Source** | `src/domain/guardrails.ts` — L91–110 |

**Why:** Marketplace settlement files sometimes have rounding errors or hidden deductions that propagate to the P&L.

**Fix:** Review the raw settlement file for additional deduction line items not captured in `settlement.deductions[]`.

---

### P5 — Claims & Disputes: Claim Recovery Ceiling

| Property | Value |
|---|---|
| **Partition** | P5: Claims & Disputes |
| **Invariant** | `amountRecovered <= amountClaimed` for every Claim |
| **Violation Trigger** | `claim.amountRecovered > claim.amountClaimed` |
| **Severity** | `WARNING` |
| **Source** | `src/domain/guardrails.ts` — L112–128 |

**Why:** Recovering more than was claimed signals a data entry error or duplicate credit.

**Fix:** Add UI-level validation in the Claims form to cap `amountRecovered` at `amountClaimed`.

---

### P6 — Profitability Ledger: Tax Liability Isolation

| Property | Value |
|---|---|
| **Partition** | P6: Profitability Ledger |
| **Invariant** | TCS, TDS, and GST must not dilute OPEX calculations |
| **Violation Trigger** | Static check (always HEALTHY in current implementation) |
| **Severity** | `HEALTHY` (design constraint) |
| **Source** | `src/domain/guardrails.ts` — L130–137 |

**Why:** Mixing tax lines into operating expenses creates incorrect net margin and tax liability reporting.

---

### P7 — AI Document Extractor: AI Hallucination & Arithmetic Guard

| Property | Value |
|---|---|
| **Partition** | P7: AI Document Extractor |
| **Invariant** | `Qty × UnitPrice - Discount + Tax ≡ TotalAmount` (tolerance: ±₹0.05) |
| **Violation Trigger** | `arithmeticValidation.passed === false` on any `AIStagedDocument` |
| **Severity** | `WARNING` |
| **Source** | `src/domain/guardrails.ts` — L139–151, `validateDocumentArithmetic()` L159 |

**Why:** AI extraction models can hallucinate numeric values. Without checks, incorrect totals could commit to the ledger.

**Fix:** Documents remain in `STAGED_NEEDS_REVIEW` until a human reviewer approves them in the AI Staging Sandbox.

---

## AI Defense Architecture (3 Layers)

### Layer 1 — Typed Schema Binding
All AI-extracted output is bound to a strict TypeScript schema. Free-form prose responses are rejected. All monetary values must be numeric; dates must follow ISO-8601.

### Layer 2 — Arithmetic Invariant Check
Every document goes through `validateDocumentArithmetic()`:

```
Qty × UnitPrice − Discount + TaxAmount ≡ TotalAmount  (±₹0.05)
```

Any document failing this check is automatically quarantined (`arithmeticValidation.passed = false`).

### Layer 3 — HITL Sandbox Isolation
**No AI extraction can directly write to financial tables.** An operator must review and approve each document in the AI Staging Sandbox before `approveStagedDocument()` commits it to the ledger.

---

## Running Guardrail Checks Manually

```typescript
import { runSystemGuardrailDiagnostics } from "@/domain/guardrails";

const results = runSystemGuardrailDiagnostics(
  products, orders, returns, settlements, claims, aiDocuments
);

results.forEach(r => {
  console.log(`[${r.status}] ${r.partition} — ${r.name}: ${r.details}`);
});
```

---

## Status Reference

| Status | Meaning |
|---|---|
| `HEALTHY` | Invariant satisfied — no violations detected |
| `WARNING` | Non-blocking anomalies detected — investigate |
| `CRITICAL` | Hard invariant violated — financial data integrity at risk |

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/domain/guardrails.ts` | All 7 guardrail check implementations + arithmetic validator |
| `src/domain/store.tsx` | `guardrailStatus` computed via `useMemo`, refreshed on every mutation |
| `src/domain/types.ts` | `GuardrailCheckResult` type definition |
| `src/components/modules/dashboard-view.tsx` | Live guardrails status panel rendered on the dashboard |
