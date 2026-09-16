import {
  Order,
  ReturnRecord,
  Settlement,
  Claim,
  Expense,
  Marketplace,
} from "./types";

export interface ProfitabilityMetrics {
  grossSales: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;

  marketplaceCharges: number;
  shippingLogisticsCosts: number;
  returnLosses: number;
  rtoLosses: number;
  damageLosses: number;
  claimRecoveries: number;

  contributionProfit: number;
  contributionMargin: number;

  operatingExpenses: number;
  netOperatingProfit: number;
  netOperatingMargin: number;

  actualSettlementsReceived: number;
  outstandingSettlementEstimated: number;
  totalOrders: number;
  totalUnitsSold: number;
  totalReturns: number;
  returnRate: number;

  // Performance Advertising & Attribution
  totalAdSpend: number;
  roas: number; // Return on Ad Spend: Net Sales / Ad Spend
  poas: number; // Profit on Ad Spend: Contribution Profit / Ad Spend
}

export interface OrderProfitability {
  orderId: string;
  marketplace: Marketplace;
  orderDate: string;
  status: string;
  grossSales: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  chargesDeducted: number;
  returnLoss: number;
  claimRecovery: number;
  contributionProfit: number;
  contributionMargin: number;
  settledAmount: number;
  isSettled: boolean;
}

export interface SkuProfitability {
  sku: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  marketplaceCharges: number;
  returnLosses: number;
  claimRecoveries: number;
  profit: number;
  margin: number;
  returnRate: number;
  adSpend?: number;
  poas?: number;
}

export interface MarketplaceProfitability {
  marketplace: Marketplace;
  orderCount: number;
  unitsSold: number;
  revenue: number;
  cogs: number;
  fees: number;
  logistics: number;
  returnLosses: number;
  claimRecoveries: number;
  contributionProfit: number;
  margin: number;
  returnRate: number;
  adSpend: number;
  poas: number;
}

export interface MonthlyProfitability {
  month: string; // e.g. "2026-06", "2026-07"
  monthName: string; // "Jun 2026"
  sales: number;
  cogs: number;
  charges: number;
  returns: number;
  claims: number;
  expenses: number;
  profit: number;
  margin: number;
}

/**
 * Calculates comprehensive business-level financial metrics
 */
export function calculateBusinessProfitability(
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  expenses: Expense[]
): ProfitabilityMetrics {
  let grossSales = 0;
  let discounts = 0;
  let cogs = 0;
  let totalUnitsSold = 0;
  let marketplaceCharges = 0;
  let shippingLogisticsCosts = 0;

  // Process valid orders (exclude outright cancelled orders from revenue)
  orders.forEach((order) => {
    if (order.status === "CANCELLED") return;

    order.items.forEach((item) => {
      const itemGross = item.sellingPrice * item.quantity;
      grossSales += itemGross;
      discounts += item.discount;
      cogs += item.snapshotUnitCost * item.quantity;
      totalUnitsSold += item.quantity;
    });

    shippingLogisticsCosts += order.shippingFeeCharged || 0;
    marketplaceCharges += order.marketplaceChargesEstimate || 0;
  });

  const netSales = grossSales - discounts;
  const grossProfit = netSales - cogs;
  const grossMargin = netSales > 0 ? grossProfit / netSales : 0;

  // Process Returns & Losses
  let returnLosses = 0;
  let rtoLosses = 0;
  let damageLosses = 0;
  let totalReturnedUnits = 0;

  returns.forEach((ret) => {
    totalReturnedUnits += ret.quantity;
    const loss = ret.lossAmount + ret.returnShippingCost + ret.otherReturnCosts;

    if (ret.returnType === "RTO") {
      rtoLosses += loss;
    } else {
      returnLosses += loss;
    }

    if (ret.condition === "DAMAGED" || ret.condition === "UNUSABLE") {
      damageLosses += ret.lossAmount;
    }
  });

  // Process Claims Recoveries
  let claimRecoveries = 0;
  claims.forEach((claim) => {
    if (claim.status === "RECOVERED" || claim.status === "PARTIALLY_RECOVERED") {
      claimRecoveries += claim.amountRecovered;
    }
  });

  // Process Settlements Actual vs Deductions
  let actualSettlementsReceived = 0;
  let actualSettlementDeductions = 0;

  settlements.forEach((s) => {
    actualSettlementsReceived += s.netSettlement;
    s.deductions.forEach((d) => {
      actualSettlementDeductions += d.amount;
    });
  });

  // Use actual settlement deductions if available; fallback to estimate
  const finalCharges = actualSettlementDeductions > 0 ? actualSettlementDeductions : marketplaceCharges;

  // Contribution Profit
  const contributionProfit =
    grossProfit -
    finalCharges -
    shippingLogisticsCosts -
    (returnLosses + rtoLosses) +
    claimRecoveries;
  const contributionMargin = netSales > 0 ? contributionProfit / netSales : 0;

  // Operating Expenses & Advertising Attribution
  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAdSpend = expenses
    .filter((e) => e.category === "Advertising")
    .reduce((sum, e) => sum + e.amount, 0);

  // Net Operating Profit
  const netOperatingProfit = contributionProfit - operatingExpenses;
  const netOperatingMargin = netSales > 0 ? netOperatingProfit / netSales : 0;

  // ROAS & POAS
  const roas = totalAdSpend > 0 ? Math.round((netSales / totalAdSpend) * 100) / 100 : 0;
  const poas = totalAdSpend > 0 ? Math.round((contributionProfit / totalAdSpend) * 100) / 100 : 0;

  const totalOrders = orders.filter((o) => o.status !== "CANCELLED").length;
  const returnRate = totalUnitsSold > 0 ? totalReturnedUnits / totalUnitsSold : 0;

  const outstandingSettlementEstimated = Math.max(0, netSales - finalCharges - actualSettlementsReceived);

  return {
    grossSales,
    discounts,
    netSales,
    cogs,
    grossProfit,
    grossMargin,
    marketplaceCharges: finalCharges,
    shippingLogisticsCosts,
    returnLosses,
    rtoLosses,
    damageLosses,
    claimRecoveries,
    contributionProfit,
    contributionMargin,
    operatingExpenses,
    netOperatingProfit,
    netOperatingMargin,
    actualSettlementsReceived,
    outstandingSettlementEstimated,
    totalOrders,
    totalUnitsSold,
    totalReturns: returns.length,
    returnRate,
    totalAdSpend,
    roas,
    poas,
  };
}

/**
 * Calculates Order-Level Profitability
 */
export function calculateOrderProfitability(
  order: Order,
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[]
): OrderProfitability {
  let grossSales = 0;
  let discounts = 0;
  let cogs = 0;

  order.items.forEach((i) => {
    grossSales += i.sellingPrice * i.quantity;
    discounts += i.discount;
    cogs += i.snapshotUnitCost * i.quantity;
  });

  const netSales = grossSales - discounts;
  const grossProfit = netSales - cogs;

  // Check linked settlements
  const linkedSettlements = settlements.filter(
    (s) => s.orderId === order.id || s.orderId === order.channelOrderId
  );

  let chargesDeducted = 0;
  let settledAmount = 0;

  if (linkedSettlements.length > 0) {
    linkedSettlements.forEach((s) => {
      settledAmount += s.netSettlement;
      chargesDeducted += s.deductions.reduce((sum, d) => sum + d.amount, 0);
    });
  } else {
    chargesDeducted = order.marketplaceChargesEstimate;
  }

  // Linked returns
  const linkedReturns = returns.filter((r) => r.orderId === order.id || r.channelOrderId === order.channelOrderId);
  const returnLoss = linkedReturns.reduce(
    (sum, r) => sum + r.lossAmount + r.returnShippingCost + r.otherReturnCosts,
    0
  );

  // Linked claims
  const linkedClaims = claims.filter((c) => c.orderId === order.id);
  const claimRecovery = linkedClaims.reduce((sum, c) => sum + c.amountRecovered, 0);

  const contributionProfit = grossProfit - chargesDeducted - returnLoss + claimRecovery;
  const contributionMargin = netSales > 0 ? contributionProfit / netSales : 0;

  return {
    orderId: order.id,
    marketplace: order.marketplace,
    orderDate: order.orderDate,
    status: order.status,
    grossSales,
    netSales,
    cogs,
    grossProfit,
    chargesDeducted,
    returnLoss,
    claimRecovery,
    contributionProfit,
    contributionMargin,
    settledAmount,
    isSettled: linkedSettlements.length > 0,
  };
}

/**
 * Calculates Marketplace-Level Breakdown
 */
export function calculateMarketplaceProfitability(
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  expenses: Expense[] = []
): MarketplaceProfitability[] {
  const marketplaces: Marketplace[] = [
    "Amazon India",
    "Flipkart",
    "Meesho",
    "Personal Website",
  ];

  return marketplaces.map((mp) => {
    const mpOrders = orders.filter((o) => o.marketplace === mp && o.status !== "CANCELLED");
    const mpReturns = returns.filter((r) => r.marketplace === mp);
    const mpClaims = claims.filter((c) => c.marketplace === mp);
    const mpSettlements = settlements.filter((s) => s.marketplace === mp);
    const mpAdSpend = expenses
      .filter((e) => e.category === "Advertising" && e.marketplace === mp)
      .reduce((sum, e) => sum + e.amount, 0);

    let unitsSold = 0;
    let revenue = 0;
    let cogs = 0;
    let fees = 0;
    let logistics = 0;

    mpOrders.forEach((o) => {
      o.items.forEach((i) => {
        unitsSold += i.quantity;
        revenue += i.sellingPrice * i.quantity - i.discount;
        cogs += i.snapshotUnitCost * i.quantity;
      });
      logistics += o.shippingFeeCharged || 0;
      fees += o.marketplaceChargesEstimate || 0;
    });

    if (mpSettlements.length > 0) {
      fees = mpSettlements.reduce((sum, s) => {
        return (
          sum +
          s.deductions
            .filter((d) => d.category !== "LOGISTICS")
            .reduce((dSum, d) => dSum + d.amount, 0)
        );
      }, 0);
    }

    const returnLosses = mpReturns.reduce(
      (sum, r) => sum + r.lossAmount + r.returnShippingCost + r.otherReturnCosts,
      0
    );

    const claimRecoveries = mpClaims.reduce((sum, c) => sum + c.amountRecovered, 0);

    const contributionProfit = revenue - cogs - fees - logistics - returnLosses + claimRecoveries;
    const margin = revenue > 0 ? contributionProfit / revenue : 0;
    const returnedUnits = mpReturns.reduce((sum, r) => sum + r.quantity, 0);
    const returnRate = unitsSold > 0 ? returnedUnits / unitsSold : 0;
    const poas = mpAdSpend > 0 ? Math.round((contributionProfit / mpAdSpend) * 100) / 100 : 0;

    return {
      marketplace: mp,
      orderCount: mpOrders.length,
      unitsSold,
      revenue,
      cogs,
      fees,
      logistics,
      returnLosses,
      claimRecoveries,
      contributionProfit,
      margin,
      returnRate,
      adSpend: mpAdSpend,
      poas,
    };
  });
}

/**
 * Calculates SKU-Level Profitability
 */
export function calculateSkuProfitability(
  orders: Order[],
  returns: ReturnRecord[],
  claims: Claim[],
  expenses: Expense[] = []
): SkuProfitability[] {
  const skuMap = new Map<
    string,
    {
      sku: string;
      productName: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      marketplaceCharges: number;
      returnedUnits: number;
      returnLosses: number;
      claimRecoveries: number;
      adSpend: number;
    }
  >();

  orders.forEach((order) => {
    if (order.status === "CANCELLED") return;

    order.items.forEach((item) => {
      const existing = skuMap.get(item.sku) || {
        sku: item.sku,
        productName: item.productName,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        marketplaceCharges: 0,
        returnedUnits: 0,
        returnLosses: 0,
        claimRecoveries: 0,
        adSpend: 0,
      };

      existing.unitsSold += item.quantity;
      existing.revenue += item.sellingPrice * item.quantity - item.discount;
      existing.cogs += item.snapshotUnitCost * item.quantity;
      // Estimate proportional charges
      existing.marketplaceCharges += (order.marketplaceChargesEstimate || 0) / Math.max(1, order.items.length);

      skuMap.set(item.sku, existing);
    });
  });

  returns.forEach((ret) => {
    const existing = skuMap.get(ret.sku);
    if (existing) {
      existing.returnedUnits += ret.quantity;
      existing.returnLosses += ret.lossAmount + ret.returnShippingCost + ret.otherReturnCosts;
    }
  });

  // Attribute advertising expenses per SKU
  expenses
    .filter((e) => e.category === "Advertising" && e.attributedSku)
    .forEach((e) => {
      const existing = skuMap.get(e.attributedSku!);
      if (existing) {
        existing.adSpend += e.amount;
      }
    });

  return Array.from(skuMap.values()).map((s) => {
    const profit = s.revenue - s.cogs - s.marketplaceCharges - s.returnLosses + s.claimRecoveries;
    const margin = s.revenue > 0 ? profit / s.revenue : 0;
    const returnRate = s.unitsSold > 0 ? s.returnedUnits / s.unitsSold : 0;
    const poas = s.adSpend > 0 ? Math.round((profit / s.adSpend) * 100) / 100 : undefined;

    return {
      sku: s.sku,
      productName: s.productName,
      unitsSold: s.unitsSold,
      revenue: s.revenue,
      cogs: s.cogs,
      marketplaceCharges: s.marketplaceCharges,
      returnLosses: s.returnLosses,
      claimRecoveries: s.claimRecoveries,
      profit,
      margin,
      returnRate,
      adSpend: s.adSpend > 0 ? s.adSpend : undefined,
      poas,
    };
  });
}

export type DateRangePreset = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "PREVIOUS_MONTH";

export interface DateFilterRange {
  startDate: string; // ISO format "YYYY-MM-DD"
  endDate: string;
}

export interface MetricTrend {
  value: number;
  percentageChange: number; // e.g. +14.2 or -5.1
}

/**
 * Resolves a date preset to exact YYYY-MM-DD boundaries
 * Uses anchor date 2026-09-15 (mock data timeline)
 */
export function resolveDatePreset(preset: DateRangePreset, anchorDateStr: string = "2026-09-15"): { current: DateFilterRange; previous: DateFilterRange } {
  const anchor = new Date(anchorDateStr);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  if (preset === "ALL") {
    return {
      current: { startDate: "2020-01-01", endDate: "2030-12-31" },
      previous: { startDate: "2010-01-01", endDate: "2019-12-31" },
    };
  }

  if (preset === "TODAY") {
    const prev = new Date(anchor);
    prev.setDate(prev.getDate() - 1);
    return {
      current: { startDate: formatDate(anchor), endDate: formatDate(anchor) },
      previous: { startDate: formatDate(prev), endDate: formatDate(prev) },
    };
  }

  if (preset === "LAST_7_DAYS") {
    const startCurr = new Date(anchor);
    startCurr.setDate(startCurr.getDate() - 6);
    const endPrev = new Date(startCurr);
    endPrev.setDate(endPrev.getDate() - 1);
    const startPrev = new Date(endPrev);
    startPrev.setDate(startPrev.getDate() - 6);

    return {
      current: { startDate: formatDate(startCurr), endDate: formatDate(anchor) },
      previous: { startDate: formatDate(startPrev), endDate: formatDate(endPrev) },
    };
  }

  if (preset === "LAST_30_DAYS") {
    const startCurr = new Date(anchor);
    startCurr.setDate(startCurr.getDate() - 29);
    const endPrev = new Date(startCurr);
    endPrev.setDate(endPrev.getDate() - 1);
    const startPrev = new Date(endPrev);
    startPrev.setDate(startPrev.getDate() - 29);

    return {
      current: { startDate: formatDate(startCurr), endDate: formatDate(anchor) },
      previous: { startDate: formatDate(startPrev), endDate: formatDate(endPrev) },
    };
  }

  if (preset === "PREVIOUS_MONTH") {
    return {
      current: { startDate: "2026-08-01", endDate: "2026-08-31" },
      previous: { startDate: "2026-07-01", endDate: "2026-07-31" },
    };
  }

  // THIS_MONTH (September 2026)
  return {
    current: { startDate: "2026-09-01", endDate: "2026-09-30" },
    previous: { startDate: "2026-08-01", endDate: "2026-08-31" },
  };
}

/**
 * Filter orders, returns, settlements, claims and expenses by a date range
 */
export function filterDatasetByDateRange(
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  expenses: Expense[],
  range: DateFilterRange
) {
  const isBetween = (dStr: string) => dStr >= range.startDate && dStr <= range.endDate;

  const filteredOrders = orders.filter((o) => isBetween(o.orderDate));
  const filteredReturns = returns.filter((r) => isBetween(r.returnDate));
  const filteredSettlements = settlements.filter((s) => isBetween(s.settlementDate));
  const filteredClaims = claims.filter((c) => isBetween(c.claimDate));
  const filteredExpenses = expenses.filter((e) => isBetween(e.date));

  return {
    orders: filteredOrders,
    returns: filteredReturns,
    settlements: filteredSettlements,
    claims: filteredClaims,
    expenses: filteredExpenses,
  };
}

/**
 * Calculates percentage trend (+14.2% or -5.1%) between current and prior period
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 10) / 10;
}

export interface SettlementAgingBracket {
  rangeLabel: string; // "0–7 Days", "8–14 Days", "> 14 Days (Overdue)"
  orderCount: number;
  totalEstimatedAmount: number;
  statusType: "ON_SCHEDULE" | "PENDING" | "OVERDUE";
  orders: {
    orderId: string;
    channelOrderId: string;
    marketplace: Marketplace;
    orderDate: string;
    daysOutstanding: number;
    estimatedPayout: number;
  }[];
}

export interface SettlementAgingSummary {
  onSchedule: SettlementAgingBracket; // 0-7 days
  pending: SettlementAgingBracket;    // 8-14 days
  overdue: SettlementAgingBracket;    // >14 days
  totalOutstandingAmount: number;
  totalUnsettledOrders: number;
}

/**
 * Calculates Settlement Aging Brackets:
 * - 0–7 Days: Normal marketplace payment cycle (On Schedule)
 * - 8–14 Days: Approaching settlement threshold (Pending)
 * - > 14 Days: Delayed / Overdue cash (Overdue - Flagged for audit)
 */
export function calculateSettlementAging(
  orders: Order[],
  settlements: Settlement[],
  anchorDateStr: string = "2026-09-15"
): SettlementAgingSummary {
  const anchor = new Date(anchorDateStr);
  const settledOrderIds = new Set(settlements.map((s) => s.orderId));

  const unsettled = orders.filter(
    (o) => o.status !== "CANCELLED" && !settledOrderIds.has(o.id)
  );

  const onScheduleList: SettlementAgingBracket["orders"] = [];
  const pendingList: SettlementAgingBracket["orders"] = [];
  const overdueList: SettlementAgingBracket["orders"] = [];

  unsettled.forEach((o) => {
    const orderDate = new Date(o.orderDate);
    const diffTime = Math.max(0, anchor.getTime() - orderDate.getTime());
    const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const grossRevenue = o.items.reduce((sum, i) => sum + i.sellingPrice * i.quantity - i.discount, 0);
    const estFees = o.marketplaceChargesEstimate || (grossRevenue * 0.15);
    const estimatedPayout = Math.max(0, grossRevenue - estFees);

    const entry = {
      orderId: o.id,
      channelOrderId: o.channelOrderId,
      marketplace: o.marketplace,
      orderDate: o.orderDate,
      daysOutstanding,
      estimatedPayout: Math.round(estimatedPayout * 100) / 100,
    };

    if (daysOutstanding <= 7) {
      onScheduleList.push(entry);
    } else if (daysOutstanding <= 14) {
      pendingList.push(entry);
    } else {
      overdueList.push(entry);
    }
  });

  const sumAmount = (list: SettlementAgingBracket["orders"]) =>
    Math.round(list.reduce((sum, item) => sum + item.estimatedPayout, 0) * 100) / 100;

  const onSchedule: SettlementAgingBracket = {
    rangeLabel: "0–7 Days (Cycle Safe)",
    orderCount: onScheduleList.length,
    totalEstimatedAmount: sumAmount(onScheduleList),
    statusType: "ON_SCHEDULE",
    orders: onScheduleList,
  };

  const pending: SettlementAgingBracket = {
    rangeLabel: "8–14 Days (Pending)",
    orderCount: pendingList.length,
    totalEstimatedAmount: sumAmount(pendingList),
    statusType: "PENDING",
    orders: pendingList,
  };

  const overdue: SettlementAgingBracket = {
    rangeLabel: "> 14 Days (Overdue)",
    orderCount: overdueList.length,
    totalEstimatedAmount: sumAmount(overdueList),
    statusType: "OVERDUE",
    orders: overdueList,
  };

  return {
    onSchedule,
    pending,
    overdue,
    totalOutstandingAmount: onSchedule.totalEstimatedAmount + pending.totalEstimatedAmount + overdue.totalEstimatedAmount,
    totalUnsettledOrders: unsettled.length,
  };
}