import { money, sumMoney, getOrderFinancialFacts, allocateMoney } from "./order-financials";
import { Order, ReturnRecord, Settlement, Product, Claim } from "@/domain/types";
import { businessDate } from "./report-scope";
import { calculateSettlementAging } from "./profitability-engine";
import { returnClaimAllocations } from "./claim-attribution";
import { marketplaceFeeFacts } from "./accounting-policy";
import { NavModule } from "@/components/layout/sidebar";

export type AnomalyCategory =
  | "WEIGHT_DISCREPANCY"
  | "FEE_CREEP"
  | "RTO_BLEED"
  | "SETTLEMENT_LAG";

export type AnomalySeverity = "CRITICAL" | "WARNING" | "INFO";

export interface AnomalyReportItem {
  id: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  metricHighlight: string;
  impactAmount: number;
  orderCount: number;
  affectedEntities: string[];
  description: string;
  actionLabel: string;
  actionModule: NavModule;
  actionHint?: string;
}

export interface AnomalyRadarBriefing {
  generatedAt: string;
  totalExposureAmount: number;
  unknownExposureOrders?: number;
  totalAnomaliesCount: number;
  hasCriticalAlerts: boolean;
  items: AnomalyReportItem[];
}

export function computeAnomalyRadar(params: {
  orders: Order[];
  returns: ReturnRecord[];
  settlements: Settlement[];
  products: Product[];
  claims: Claim[];
  asOf?: string;
  logisticsRateSlabs?: { marketplace: string; maxWeightGrams: number; amount: number; effectiveFrom: string; effectiveTo?: string }[];
}): AnomalyRadarBriefing {
  const { orders, returns, settlements, products } = params;
  const items: AnomalyReportItem[] = [];
  const anchorDate = params.asOf || businessDate();

  // Product weight lookup
  const productWeightMap = new Map<string, number>();
  products.forEach((p) => {
    if (p.weightGrams !== undefined && p.weightGrams > 0) productWeightMap.set(p.sku, p.weightGrams);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. COURIER VOLUMETRIC WEIGHT OVERCHARGES
  // ─────────────────────────────────────────────────────────────
  // Standard courier fee in India for sub-500g e-commerce parcels is ~₹45 - ₹65.
  // When shipping fee billed is > ₹85 for a single sub-500g unit, it's flagged as weight volumetric bump.
  let weightOverchargeTotal = 0;
  let weightOverchargeOrderCount = 0;
  const weightDiscrepancyOrderIds: string[] = [];

  orders.forEach((order) => {
    if (order.orderDate.slice(0, 10) > anchorDate || !order.items.length || order.items.some(item => !productWeightMap.has(item.sku))) return;
    const totalWeight = order.items.reduce((sum, item) => sum + productWeightMap.get(item.sku)! * item.quantity, 0);
    const slab = (params.logisticsRateSlabs || order.logisticsRateSlabs || []).filter(rate => rate.marketplace === order.marketplace && rate.maxWeightGrams >= totalWeight &&
      rate.effectiveFrom <= order.orderDate && (!rate.effectiveTo || rate.effectiveTo >= order.orderDate))
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || a.maxWeightGrams - b.maxWeightGrams)[0];
    if (!slab) return;
    const receipts = Array.from(new Map(settlements.filter(record => record.settlementDate.slice(0, 10) <= anchorDate && record.marketplace === order.marketplace &&
      [order.id, order.channelOrderId].includes(record.orderId)).map(record => [record.id, record])).values());
    const freight = receipts.flatMap(record => record.deductions).filter(deduction => deduction.category === "LOGISTICS");
    if (!freight.length) return;
    const excess = sumMoney([sumMoney(freight.map(deduction => deduction.amount)), -slab.amount]);
    if (excess > 0) {
      weightOverchargeTotal = sumMoney([weightOverchargeTotal, excess]);
      weightOverchargeOrderCount++;
      if (weightDiscrepancyOrderIds.length < 3) weightDiscrepancyOrderIds.push(order.channelOrderId || order.id);
    }
  });

  if (weightOverchargeOrderCount > 0) {
    items.push({
      id: "ANOMALY-WEIGHT-01",
      category: "WEIGHT_DISCREPANCY",
      severity: weightOverchargeTotal > 5000 ? "CRITICAL" : "WARNING",
      title: "Courier Volumetric Weight Overcharge",
      metricHighlight: `₹${Math.round(weightOverchargeTotal).toLocaleString("en-IN")} excess freight`,
      impactAmount: money(weightOverchargeTotal),
      orderCount: weightOverchargeOrderCount,
      affectedEntities: weightDiscrepancyOrderIds,
      description: `${weightOverchargeOrderCount} shipments billed above their configured catalog weight slab.`,
      actionLabel: "Dispute Weight Overcharges",
      actionModule: "claims",
      actionHint: "Pre-fill volumetric claim dispute packet",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RTO SPIKES & AD BLEED ON HIGH-RETURN SKUS
  // ─────────────────────────────────────────────────────────────
  // Return exposure uses the same bounded units, cost snapshots and recoveries as P&L.
  const skuReturnStats = new Map<string, { returnUnits: number; returnLoss: number; soldUnits: number; orderIds: Set<string> }>();
  const facts = orders.map(order => ({ order, facts: getOrderFinancialFacts(order, returns, settlements, params.claims, anchorDate) }));
  for (const { order, facts: financials } of facts) {
    financials.lines.forEach(line => {
      const current = skuReturnStats.get(line.sku) || { returnUnits: 0, returnLoss: 0, soldUnits: 0, orderIds: new Set<string>() };
      current.soldUnits += line.quantity;
      skuReturnStats.set(line.sku, current);
    });
    const allocations = returnClaimAllocations(order, financials.returnDetails.map(detail => ({ ...detail.record, quantity: detail.returnedUnits })), params.claims, anchorDate);
    financials.returnDetails.forEach(detail => {
      const recovered = sumMoney((allocations.get(detail.record.id) || []).map(allocation => allocation.recovered));
      const drag = sumMoney([detail.baseLoss, -recovered]);
      const shares = allocateMoney(drag, detail.unitsByLine);
      financials.lines.forEach((line, index) => {
        if (!detail.unitsByLine[index]) return;
        const current = skuReturnStats.get(line.sku)!;
        current.returnUnits += detail.unitsByLine[index];
        current.returnLoss = sumMoney([current.returnLoss, shares[index]]);
        current.orderIds.add(order.id);
      });
    });
    // Recorded reverse-shipping deductions replace the duplicate return-form
    // amount in facts; they still belong in the diagnostic return exposure.
    const linkedReceipts = Array.from(new Map(settlements.filter(settlement => settlement.marketplace === order.marketplace &&
      [order.id, order.channelOrderId].includes(settlement.orderId) && settlement.settlementDate.slice(0, 10) <= anchorDate)
      .map(settlement => [settlement.id, settlement])).values());
    linkedReceipts.forEach(receipt => {
      const weights = financials.lines.map((_, index) => financials.returnDetails
        .filter(detail => detail.record.returnDate.slice(0, 10) <= receipt.settlementDate.slice(0, 10))
        .reduce((sum, detail) => sum + detail.unitsByLine[index], 0));
      if (!weights.some(Boolean)) return;
      receipt.deductions.filter(deduction => deduction.category === 'RETURN_SHIPPING').forEach(deduction => {
        allocateMoney(marketplaceFeeFacts(order, deduction).expense, weights).forEach((share, index) => {
          const current = skuReturnStats.get(financials.lines[index].sku)!;
          current.returnLoss = sumMoney([current.returnLoss, share]);
        });
      });
    });
  }
  let totalRtoBleedLoss = 0;
  const highReturnSkus: string[] = [], affectedReturnOrders = new Set<string>();
  skuReturnStats.forEach((stats, sku) => {
    const returnRate = stats.soldUnits > 0 ? Math.min(1, stats.returnUnits / stats.soldUnits) * 100 : 0;
    if (returnRate >= 20 && stats.returnLoss > 2000) {
      totalRtoBleedLoss = sumMoney([totalRtoBleedLoss, stats.returnLoss]);
      highReturnSkus.push(sku + " (" + Math.round(returnRate) + "%)");
      stats.orderIds.forEach(id => affectedReturnOrders.add(id));
    }
  });
  if (totalRtoBleedLoss > 0) items.push({
    id: "ANOMALY-RTO-03", category: "RTO_BLEED", severity: "CRITICAL",
    title: "Reverse Logistics Bleed on High-Return SKUs",
    metricHighlight: "₹" + Math.round(totalRtoBleedLoss).toLocaleString("en-IN") + " return drag",
    impactAmount: totalRtoBleedLoss, orderCount: affectedReturnOrders.size, affectedEntities: highReturnSkus.slice(0, 3),
    description: "Bounded returns exceed 20% of shipped units with recorded costs after salvage and linked recoveries.",
    actionLabel: "Analyze High-Return SKUs", actionModule: "returns",
    actionHint: "Review recorded return causes and costs",
  });

  // The same closing receivable calculation powers aging and the radar.
  const aging = calculateSettlementAging(orders, settlements, anchorDate, returns, params.claims);
  const overdue = aging.overdue;
  const knownOverdue = sumMoney(overdue.orders.filter(order => order.estimatedPayout !== null).map(order => order.estimatedPayout!));
  if (overdue.orderCount > 0 && (knownOverdue > 5000 || overdue.unknownAmountOrders > 0)) items.push({
    id: "ANOMALY-SETTLE-04", category: "SETTLEMENT_LAG", severity: "WARNING",
    title: "Marketplace Receivables Older Than 14 Days",
    metricHighlight: overdue.unknownAmountOrders ? overdue.unknownAmountOrders + " orders with unknown payout" : "₹" + Math.round(knownOverdue).toLocaleString("en-IN") + " pending payout",
    impactAmount: knownOverdue, orderCount: overdue.orderCount,
    affectedEntities: overdue.orders.slice(0, 3).map(order => order.channelOrderId || order.orderId),
    description: overdue.unknownAmountOrders
      ? "Incomplete financial evidence prevents valuing every aged receivable; the known exposure is only a lower bound."
      : "Recorded receivables remain after partial receipts and withholdings; verify each marketplace's agreed payout terms.",
    actionLabel: "Review Settlement Aging", actionModule: "settlements",
    actionHint: "Check recorded disbursements and contractual schedules",
  });

  const totalExposureAmount = sumMoney(items.map(item => item.impactAmount));
  const hasCriticalAlerts = items.some((it) => it.severity === "CRITICAL");

  return {
    generatedAt: new Date().toISOString(),
    totalExposureAmount,
    unknownExposureOrders: overdue.unknownAmountOrders,
    totalAnomaliesCount: items.length,
    hasCriticalAlerts,
    items,
  };
}
