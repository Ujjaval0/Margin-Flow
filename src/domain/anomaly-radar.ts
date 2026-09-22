import { Order, ReturnRecord, Settlement, Product, Claim } from "@/domain/types";
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
  totalAnomaliesCount: number;
  hasCriticalAlerts: boolean;
  items: AnomalyReportItem[];
}

// Known product baseline weights in grams
const DEFAULT_PRODUCT_WEIGHTS: Record<string, number> = {
  "ELEC-WEM-01": 220,    // 220g (sub-500g bracket)
  "ELEC-USBC-65W": 170,   // 170g (sub-500g bracket)
  "ELEC-ANC-EB": 140,     // 140g (sub-500g bracket)
  "ELEC-BRAID-CBL": 90,   // 90g (sub-500g bracket)
};

// Expected baseline standard commission rates
const STANDARD_COMMISSION_BENCHMARKS: Record<string, number> = {
  "Amazon India": 0.13, // 13% for consumer electronics
  Flipkart: 0.13,       // 13% for consumer electronics
  Meesho: 0.02,         // 2% platform fee
  "Personal Website": 0.02, // Payment gateway only
  Myntra: 0.20,
};

export function computeAnomalyRadar(params: {
  orders: Order[];
  returns: ReturnRecord[];
  settlements: Settlement[];
  products: Product[];
  claims: Claim[];
}): AnomalyRadarBriefing {
  const { orders, returns, settlements, products } = params;
  const items: AnomalyReportItem[] = [];

  // Product weight lookup
  const productWeightMap = new Map<string, number>();
  products.forEach((p) => {
    productWeightMap.set(p.sku, DEFAULT_PRODUCT_WEIGHTS[p.sku] || 250);
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
    const totalQty = order.items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    if (totalQty === 1 && order.items.length === 1) {
      const it = order.items[0];
      const baseWeight = productWeightMap.get(it.sku) || 250;
      // Sub-500g item: baseline expected carrier fee is ~₹50
      if (baseWeight <= 500 && order.shippingFeeCharged > 80) {
        const excess = order.shippingFeeCharged - 50;
        weightOverchargeTotal += excess;
        weightOverchargeOrderCount++;
        if (weightDiscrepancyOrderIds.length < 3) {
          weightDiscrepancyOrderIds.push(order.channelOrderId || order.id);
        }
      }
    }
  });

  if (weightOverchargeOrderCount > 0) {
    items.push({
      id: "ANOMALY-WEIGHT-01",
      category: "WEIGHT_DISCREPANCY",
      severity: weightOverchargeTotal > 5000 ? "CRITICAL" : "WARNING",
      title: "Courier Volumetric Weight Overcharge",
      metricHighlight: `₹${Math.round(weightOverchargeTotal).toLocaleString("en-IN")} excess freight`,
      impactAmount: Math.round(weightOverchargeTotal),
      orderCount: weightOverchargeOrderCount,
      affectedEntities: weightDiscrepancyOrderIds,
      description: `${weightOverchargeOrderCount} shipments billed above 500g rate slab despite catalog weight under 250g.`,
      actionLabel: "Dispute Weight Overcharges",
      actionModule: "claims",
      actionHint: "Pre-fill volumetric claim dispute packet",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. MARKETPLACE COMMISSION FEE CREEP (>10% deviation)
  // ─────────────────────────────────────────────────────────────
  let feeCreepTotal = 0;
  let feeCreepOrderCount = 0;
  const feeCreepChannels = new Set<string>();

  orders.forEach((order) => {
    const totalItemValue = order.items.reduce(
      (acc, it) => acc + (it.sellingPrice || 0) * (it.quantity || 1) - (it.discount || 0),
      0
    );
    if (totalItemValue <= 0) return;

    const benchmarkRate = STANDARD_COMMISSION_BENCHMARKS[order.marketplace] ?? 0.12;
    const effectiveFeeRate = order.marketplaceChargesEstimate / totalItemValue;

    // Relative deviation > 15% above benchmark (e.g. charged 16.5% vs 13%)
    if (effectiveFeeRate > benchmarkRate * 1.15) {
      const expectedFee = totalItemValue * benchmarkRate;
      const slippage = order.marketplaceChargesEstimate - expectedFee;
      if (slippage > 20) {
        feeCreepTotal += slippage;
        feeCreepOrderCount++;
        feeCreepChannels.add(order.marketplace);
      }
    }
  });

  if (feeCreepOrderCount > 0) {
    items.push({
      id: "ANOMALY-FEE-02",
      category: "FEE_CREEP",
      severity: feeCreepTotal > 6000 ? "CRITICAL" : "WARNING",
      title: "Marketplace Commission Fee Creep",
      metricHighlight: `₹${Math.round(feeCreepTotal).toLocaleString("en-IN")} fee slippage`,
      impactAmount: Math.round(feeCreepTotal),
      orderCount: feeCreepOrderCount,
      affectedEntities: Array.from(feeCreepChannels),
      description: `Commission charges exceed standard rate cards by >15% on ${feeCreepOrderCount} orders (${Array.from(feeCreepChannels).join(", ")}).`,
      actionLabel: "Inspect Fee Breakdown",
      actionModule: "settlements",
      actionHint: "Compare order deductions with marketplace rate cards",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. RTO SPIKES & AD BLEED ON HIGH-RETURN SKUS
  // ─────────────────────────────────────────────────────────────
  // Group returns by SKU and calculate total return logistics cost
  const skuReturnStats = new Map<
    string,
    { returnUnits: number; returnLoss: number; rtoCount: number }
  >();

  returns.forEach((ret) => {
    const current = skuReturnStats.get(ret.sku) || { returnUnits: 0, returnLoss: 0, rtoCount: 0 };
    current.returnUnits += ret.quantity || 1;
    current.returnLoss += (ret.returnShippingCost || 0) + (ret.customerReturnFee || 0) + (ret.lossAmount || 0);
    if (ret.returnType === "RTO") {
      current.rtoCount += ret.quantity || 1;
    }
    skuReturnStats.set(ret.sku, current);
  });

  // Calculate sold units per SKU
  const skuSales = new Map<string, number>();
  orders.forEach((ord) => {
    ord.items.forEach((it) => {
      skuSales.set(it.sku, (skuSales.get(it.sku) || 0) + (it.quantity || 1));
    });
  });

  let totalRtoBleedLoss = 0;
  const highReturnSkus: string[] = [];

  skuReturnStats.forEach((stats, sku) => {
    const soldUnits = skuSales.get(sku) || 0;
    const returnRate = soldUnits > 0 ? (stats.returnUnits / soldUnits) * 100 : 0;

    // If return rate > 20% and loss > ₹2000
    if (returnRate >= 20 && stats.returnLoss > 2000) {
      totalRtoBleedLoss += stats.returnLoss;
      highReturnSkus.push(`${sku} (${Math.round(returnRate)}%)`);
    }
  });

  if (totalRtoBleedLoss > 0) {
    items.push({
      id: "ANOMALY-RTO-03",
      category: "RTO_BLEED",
      severity: "CRITICAL",
      title: "Reverse Logistics Bleed on High-RTO SKUs",
      metricHighlight: `₹${Math.round(totalRtoBleedLoss).toLocaleString("en-IN")} return drag`,
      impactAmount: Math.round(totalRtoBleedLoss),
      orderCount: returns.length,
      affectedEntities: highReturnSkus.slice(0, 3),
      description: `High return & RTO rates (>20%) eroding gross margins on: ${highReturnSkus.slice(0, 2).join(", ")}.`,
      actionLabel: "Analyze High-Return SKUs",
      actionModule: "returns",
      actionHint: "Identify root causes and optimize delivery SLAs",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SETTLEMENT AGING LAG (>14 DAYS UNSETTLED DELIVERIES)
  // ─────────────────────────────────────────────────────────────
  const settledOrderIds = new Set<string>();
  settlements.forEach((s) => {
    if (s.orderId) settledOrderIds.add(s.orderId.trim());
  });

  let unsettledGrossAmount = 0;
  let unsettledOrderCount = 0;
  const nowTime = new Date("2026-09-22T00:00:00Z").getTime();

  orders.forEach((ord) => {
    if (ord.status === "DELIVERED" && !settledOrderIds.has(ord.id) && !settledOrderIds.has(ord.channelOrderId)) {
      const orderTime = new Date(ord.orderDate).getTime();
      const ageInDays = (nowTime - orderTime) / (1000 * 60 * 60 * 24);

      // Past standard 14-day marketplace payout cycle
      if (ageInDays > 14) {
        const orderVal = ord.items.reduce(
          (acc, it) => acc + (it.sellingPrice || 0) * (it.quantity || 1),
          0
        );
        unsettledGrossAmount += orderVal;
        unsettledOrderCount++;
      }
    }
  });

  if (unsettledOrderCount > 0 && unsettledGrossAmount > 5000) {
    items.push({
      id: "ANOMALY-SETTLE-04",
      category: "SETTLEMENT_LAG",
      severity: "WARNING",
      title: "Overdue Marketplace Settlement Aging",
      metricHighlight: `₹${Math.round(unsettledGrossAmount).toLocaleString("en-IN")} pending payout`,
      impactAmount: Math.round(unsettledGrossAmount),
      orderCount: unsettledOrderCount,
      affectedEntities: [`${unsettledOrderCount} delivered orders`],
      description: `${unsettledOrderCount} delivered orders are older than 14 days with no matching bank settlement credit.`,
      actionLabel: "Review Settlement Aging",
      actionModule: "settlements",
      actionHint: "Check marketplace disbursement schedules",
    });
  }

  const totalExposureAmount = items.reduce((acc, it) => acc + it.impactAmount, 0);
  const hasCriticalAlerts = items.some((it) => it.severity === "CRITICAL");

  return {
    generatedAt: new Date().toISOString(),
    totalExposureAmount,
    totalAnomaliesCount: items.length,
    hasCriticalAlerts,
    items,
  };
}
