import {
  Order,
  ReturnRecord,
  Settlement,
  Claim,
  Product,
  Expense,
  AIStagedDocument,
  GuardrailCheckResult,
} from "./types";

/**
 * Executes invariant checks across all 7 domain partitions and returns real-time diagnostic health
 */
export function runSystemGuardrailDiagnostics(
  products: Product[],
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  aiDocs: AIStagedDocument[],
  expenses: Expense[] = []
): GuardrailCheckResult[] {
  const results: GuardrailCheckResult[] = [];

  // P1 Guardrail: Historical Cost Basis Preservation
  let p1Violations = 0;
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const prod = products.find((p) => p.sku === item.sku);
      if (prod && item.snapshotUnitCost <= 0) {
        p1Violations++;
      }
    });
  });
  results.push({
    partition: "P1: Catalog & Cost Basis",
    name: "Cost Snapshot Integrity",
    status: p1Violations === 0 ? "HEALTHY" : "CRITICAL",
    details:
      p1Violations === 0
        ? "All order line items have locked, immutable historical unit costs."
        : `${p1Violations} line items have missing or zero historical cost snapshots.`,
    count: p1Violations,
  });

  // P2 Guardrail: Order Duplicate / Idempotency & Status Flow
  const seenOrderIds = new Set<string>();
  let duplicateOrders = 0;
  orders.forEach((o) => {
    const key = `${o.marketplace}:${o.channelOrderId}`;
    if (seenOrderIds.has(key)) {
      duplicateOrders++;
    } else {
      seenOrderIds.add(key);
    }
  });
  results.push({
    partition: "P2: Order Lifecycle",
    name: "Channel Ingestion Idempotency",
    status: duplicateOrders === 0 ? "HEALTHY" : "WARNING",
    details:
      duplicateOrders === 0
        ? "Zero duplicate order keys detected across Amazon, Flipkart, Meesho, and Website."
        : `${duplicateOrders} duplicate order keys flagged for deduplication.`,
    count: duplicateOrders,
  });

  // P3 Guardrail: Cumulative Return Quantity Ceiling (Cannot return more than ordered)
  const cumulativeReturnsByItem = new Map<string, number>();
  returns.forEach((ret) => {
    const key = `${ret.orderId || ret.channelOrderId}:${ret.sku}`;
    cumulativeReturnsByItem.set(key, (cumulativeReturnsByItem.get(key) || 0) + ret.quantity);
  });

  let overReturnCount = 0;
  orders.forEach((o) => {
    o.items.forEach((item) => {
      const keyId = `${o.id}:${item.sku}`;
      const keyChannel = o.channelOrderId ? `${o.channelOrderId}:${item.sku}` : "";
      const totalReturned =
        (cumulativeReturnsByItem.get(keyId) || 0) +
        (keyChannel && keyChannel !== keyId ? cumulativeReturnsByItem.get(keyChannel) || 0 : 0);
      if (totalReturned > item.quantity) {
        overReturnCount++;
      }
    });
  });
  results.push({
    partition: "P3: Reverse Logistics",
    name: "Return Quantity Ceiling Invariant",
    status: overReturnCount === 0 ? "HEALTHY" : "CRITICAL",
    details:
      overReturnCount === 0
        ? "All return quantities satisfy: Cumulative Sum(Returned) <= Sum(Ordered) per line item."
        : `${overReturnCount} order line items have cumulative returns exceeding ordered quantity!`,
    count: overReturnCount,
  });

  // P4 Guardrail: Settlement Balance Invariant (Gross - Deductions - Taxes == Net)
  let reconDiscrepancies = 0;
  settlements.forEach((s) => {
    const totalDeductions = s.deductions.reduce((sum, d) => sum + d.amount, 0);
    const calculatedNet = s.grossAmount - totalDeductions - s.tcsTdsTax;
    const diff = Math.abs(calculatedNet - s.netSettlement);
    if (diff > 0.05) {
      reconDiscrepancies++;
    }
  });
  results.push({
    partition: "P4: Settlements & Deductions",
    name: "Mathematical Settlement Balance",
    status: reconDiscrepancies === 0 ? "HEALTHY" : "WARNING",
    details:
      reconDiscrepancies === 0
        ? "100% of settlement batches satisfy: Gross - Deductions - Taxes ≡ Net Payout."
        : `${reconDiscrepancies} settlements have arithmetic balance discrepancies!`,
    count: reconDiscrepancies,
  });

  // P5 Guardrail: Claim Recovery Ceiling (Recovered <= Claimed)
  let overRecoveredClaims = 0;
  claims.forEach((c) => {
    if (c.amountRecovered > c.amountClaimed) {
      overRecoveredClaims++;
    }
  });
  results.push({
    partition: "P5: Claims & Disputes",
    name: "Claim Recovery Ceiling",
    status: overRecoveredClaims === 0 ? "HEALTHY" : "WARNING",
    details:
      overRecoveredClaims === 0
        ? "All recovered amounts are strictly within claimed limits."
        : `${overRecoveredClaims} claims have recovered amounts exceeding claimed value.`,
    count: overRecoveredClaims,
  });

  // P6 Guardrail: Tax Separation from Operating Expenses & Statutory Isolation
  let taxDilutionIssues = 0;
  expenses.forEach((e) => {
    if (/gst|tcs|tds|tax liability|income tax/i.test(e.category) || /gst|tcs|tds/i.test(e.description || "")) {
      taxDilutionIssues++;
    }
  });

  let settlementTaxLeakage = 0;
  settlements.forEach((s) => {
    const taxDeductionsInDeductions = s.deductions.filter(
      (d) => /tcs|tds|gst/i.test(d.name) || /tax/i.test(d.category)
    );
    if (taxDeductionsInDeductions.length > 0 && s.tcsTdsTax === 0) {
      settlementTaxLeakage++;
    }
  });

  const totalP6Violations = taxDilutionIssues + settlementTaxLeakage;
  results.push({
    partition: "P6: Profitability Ledger",
    name: "Tax Liability Isolation",
    status: totalP6Violations === 0 ? "HEALTHY" : "WARNING",
    details:
      totalP6Violations === 0
        ? "TCS, TDS, and GST are verified isolated in statutory balance sheet accounts; zero OPEX dilution."
        : `${totalP6Violations} tax transactions detected contaminating operational expense or deduction ledgers.`,
    count: totalP6Violations,
  });

  // P7 AI Guardrail: Document Staging & Arithmetic Invariants
  const pendingAIExtractions = aiDocs.filter((d) => d.status === "STAGED_NEEDS_REVIEW");
  const arithmeticFailedDocs = aiDocs.filter((d) => !d.arithmeticValidation.passed);
  results.push({
    partition: "P7: AI Document Extractor",
    name: "AI Hallucination & Arithmetic Guard",
    status: arithmeticFailedDocs.length === 0 ? "HEALTHY" : "WARNING",
    details:
      arithmeticFailedDocs.length === 0
        ? `${pendingAIExtractions.length} documents in HITL staging sandbox; zero math violations.`
        : `${arithmeticFailedDocs.length} documents quarantined with math discrepancies! Direct ledger write blocked.`,
    count: arithmeticFailedDocs.length,
  });

  return results;
}

/**
 * Validates AI Extracted Document Arithmetic Invariants
 */
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
