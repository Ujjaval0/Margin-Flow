import {
  Order,
  OrderItem,
  ReturnRecord,
  Settlement,
  Claim,
  Expense,
  Marketplace,
  Product,
  ClaimStatus,
} from "./types";

export interface ProfitabilityMetrics {
  grossSales: number;
  discounts: number;
  refundedSales: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;

  marketplaceCharges: number;
  shippingLogisticsCosts: number;
  customerReturnFees: number;      // NEW: Marketplace return processing fee (customer returns only)
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

  // Operator Payout & Return Split Metrics
  netPlatformPayout: number; // Platform payout after returns and claims, BEFORE paying supplier COGS
  trueProfit: number; // Platform payout after returns and claims, AFTER paying supplier COGS (equals contributionProfit)
  rtoCount: number; // Number of RTO items
  customerReturnCount: number; // Number of customer return items
  pendingClaimsAmount: number; // Claims amount under review / pending
  pendingClaimsCount: number; // Count of pending claims
  damagedUnitsCount: number; // Number of units in damaged or unusable condition

  // Dashboard Card: Total Fees (platform + logistics + return fees + other)
  totalFees: number;
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

export interface IndexedFinancialMaps {
  returnUnitsMap: Map<string, number>;
  /** Condition-aware: only SELLABLE/good returns (COGS should be reversed) */
  goodReturnUnitsMap: Map<string, number>;
  /** Condition-aware: only DAMAGED/UNUSABLE returns (COGS stays intact) */
  damagedReturnUnitsMap: Map<string, number>;
  returnsByOrderMap: Map<string, ReturnRecord[]>;
  settlementsByOrderMap: Map<string, Settlement[]>;
  claimsByOrderMap: Map<string, Claim[]>;
}

export function buildFinancialMaps(
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[]
): IndexedFinancialMaps {
  const returnUnitsMap = new Map<string, number>();
  const goodReturnUnitsMap = new Map<string, number>();
  const damagedReturnUnitsMap = new Map<string, number>();
  const returnsByOrderMap = new Map<string, ReturnRecord[]>();

  const isDamaged = (cond: string) =>
    cond === "DAMAGED" || cond === "UNUSABLE" || cond === "MISSING";

  for (let i = 0; i < returns.length; i++) {
    const r = returns[i];
    const condMap = isDamaged(r.condition) ? damagedReturnUnitsMap : goodReturnUnitsMap;

    if (r.orderId) {
      const uKey = `${r.orderId}:${r.sku}`;
      returnUnitsMap.set(uKey, (returnUnitsMap.get(uKey) || 0) + r.quantity);
      condMap.set(uKey, (condMap.get(uKey) || 0) + r.quantity);
      const list = returnsByOrderMap.get(r.orderId);
      if (list) list.push(r);
      else returnsByOrderMap.set(r.orderId, [r]);
    }
    if (r.channelOrderId) {
      const uKey = `${r.channelOrderId}:${r.sku}`;
      returnUnitsMap.set(uKey, (returnUnitsMap.get(uKey) || 0) + r.quantity);
      condMap.set(uKey, (condMap.get(uKey) || 0) + r.quantity);
      const list = returnsByOrderMap.get(r.channelOrderId);
      if (list) list.push(r);
      else returnsByOrderMap.set(r.channelOrderId, [r]);
    }
  }

  const settlementsByOrderMap = new Map<string, Settlement[]>();
  for (let i = 0; i < settlements.length; i++) {
    const s = settlements[i];
    if (s.orderId) {
      const list = settlementsByOrderMap.get(s.orderId);
      if (list) list.push(s);
      else settlementsByOrderMap.set(s.orderId, [s]);
    }
  }

  const claimsByOrderMap = new Map<string, Claim[]>();
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i];
    if (c.orderId) {
      const list = claimsByOrderMap.get(c.orderId);
      if (list) list.push(c);
      else claimsByOrderMap.set(c.orderId, [c]);
    }
  }

  return {
    returnUnitsMap,
    goodReturnUnitsMap,
    damagedReturnUnitsMap,
    returnsByOrderMap,
    settlementsByOrderMap,
    claimsByOrderMap,
  };
}

/**
 * Helper to get the total returned units for a specific SKU in an order
 */
export function getReturnedUnitsForItem(
  order: Order,
  itemSku: string,
  returns: ReturnRecord[],
  returnUnitsMap?: Map<string, number>
): number {
  if (returnUnitsMap) {
    const k1 = `${order.id}:${itemSku}`;
    const val1 = returnUnitsMap.get(k1);
    if (val1 !== undefined) return val1;
    if (order.channelOrderId) {
      const k2 = `${order.channelOrderId}:${itemSku}`;
      const val2 = returnUnitsMap.get(k2);
      if (val2 !== undefined) return val2;
    }
    return 0;
  }
  return returns
    .filter(
      (r) =>
        (r.orderId === order.id || (order.channelOrderId && r.channelOrderId === order.channelOrderId)) &&
        r.sku === itemSku
    )
    .reduce((sum, r) => sum + r.quantity, 0);
}

/**
 * Condition-aware helper: gets returned units that are GOOD / SELLABLE (eligible for COGS reversal).
 * For DAMAGED / UNUSABLE returns, COGS is NOT reversed; original COGS remains intact.
 */
export function getGoodReturnedUnitsForItem(
  order: Order,
  itemSku: string,
  returns: ReturnRecord[],
  goodReturnUnitsMap?: Map<string, number>
): number {
  if (goodReturnUnitsMap) {
    const k1 = `${order.id}:${itemSku}`;
    const val1 = goodReturnUnitsMap.get(k1);
    if (val1 !== undefined) return val1;
    if (order.channelOrderId) {
      const k2 = `${order.channelOrderId}:${itemSku}`;
      const val2 = goodReturnUnitsMap.get(k2);
      if (val2 !== undefined) return val2;
    }
  }
  const isDamaged = (cond: string) => cond === "DAMAGED" || cond === "UNUSABLE" || cond === "MISSING";
  const matchedReturns = returns.filter(
    (r) =>
      (r.orderId === order.id || (order.channelOrderId && r.channelOrderId === order.channelOrderId)) &&
      r.sku === itemSku
  );
  if (matchedReturns.length > 0) {
    return matchedReturns
      .filter((r) => !isDamaged(r.condition))
      .reduce((sum, r) => sum + r.quantity, 0);
  }
  return order.items.find((i) => i.sku === itemSku)?.returnedQuantity || 0;
}

/**
 * Helper to calculate the refunded revenue for returned units of an order item
 */
export function getRefundedAmountForItem(item: OrderItem, returnedQty: number): number {
  if (item.quantity <= 0 || returnedQty <= 0) return 0;
  const effectiveReturned = Math.min(returnedQty, item.quantity);
  const unitNetSellingPrice = (item.sellingPrice * item.quantity - item.discount) / item.quantity;
  return Math.round(effectiveReturned * unitNetSellingPrice * 100) / 100;
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
  const maps = buildFinancialMaps(returns, settlements, claims);

  let grossSales = 0;
  let totalOrders = 0;
  let totalUnitsSold = 0;
  let settlementReceived = 0;
  let activeCogs = 0;
  let rtoCount = 0;
  let customerReturnCount = 0;
  let damagedUnitsCount = 0;

  // Process all valid non-cancelled orders
  orders.forEach((order) => {
    if (order.status === "CANCELLED") return;

    totalOrders += 1;
    let orderGross = 0;
    let orderCogs = 0;
    let orderUnits = 0;

    order.items.forEach((item) => {
      const itemGross = item.sellingPrice * item.quantity;
      orderGross += itemGross;
      orderCogs += item.snapshotUnitCost * item.quantity;
      orderUnits += item.quantity;
    });

    grossSales += orderGross;
    totalUnitsSold += orderUnits;

    // Check linked returns and claims
    const orderReturns = [
      ...(maps.returnsByOrderMap.get(order.id) || []),
      ...(order.channelOrderId ? maps.returnsByOrderMap.get(order.channelOrderId) || [] : []),
    ];
    const orderClaims = maps.claimsByOrderMap.get(order.id) || [];

    const isRto =
      order.status === "RTO" ||
      orderReturns.some((r) => r.returnType === "RTO");

    const isDamaged =
      order.status === "DAMAGED_RETURN" ||
      order.status === "CLAIM_PENDING" ||
      order.status === "CLAIM_APPROVED" ||
      orderReturns.some(
        (r) => r.returnType === "DAMAGED_RETURN" || r.condition === "DAMAGED" || r.condition === "UNUSABLE"
      );

    const isCustomerReturn =
      order.status === "CUSTOMER_RETURN" ||
      order.status === "RETURNED" ||
      orderReturns.some((r) => r.returnType === "CUSTOMER_RETURN");

    if (isRto && !isDamaged) {
      rtoCount += orderUnits;
      // COGS is inactive (0), Settlement is 0 (Points 6 & 15)
    } else if (isDamaged || order.status === "CLAIM_PENDING" || order.status === "CLAIM_APPROVED") {
      if (isRto) {
        rtoCount += orderUnits;
      } else {
        customerReturnCount += orderUnits;
      }
      damagedUnitsCount += orderUnits;
      // COGS is active (Points 5, 10 & 12)
      activeCogs += orderCogs;
      // Settlement is 0 (Point 15)
    } else if (isCustomerReturn) {
      customerReturnCount += orderUnits;
      // COGS is inactive (0), Settlement is 0 (Points 4 & 15)
    } else {
      // DELIVERED Order (Point 3 & 15):
      // COGS is active!
      activeCogs += orderCogs;

      // Settlement is counted ONLY for DELIVERED orders (Point 15)
      const rawSettlements = [
        ...(maps.settlementsByOrderMap.get(order.id) || []),
        ...(order.channelOrderId && order.channelOrderId !== order.id
          ? maps.settlementsByOrderMap.get(order.channelOrderId) || []
          : []),
      ];
      const sSeen = new Set<string>();
      const linkedSettlements: Settlement[] = [];
      for (const s of rawSettlements) {
        if (!sSeen.has(s.id)) {
          sSeen.add(s.id);
          linkedSettlements.push(s);
        }
      }

      if (linkedSettlements.length > 0) {
        settlementReceived += linkedSettlements.reduce((sum, s) => sum + s.netSettlement, 0);
      } else if (order.settlementAmount !== undefined && order.settlementAmount !== null) {
        settlementReceived += order.settlementAmount;
      } else if (order.settlementPercent !== undefined && order.settlementPercent !== null) {
        settlementReceived += Math.round(orderGross * (order.settlementPercent / 100) * 100) / 100;
      } else if (order.marketplaceChargesEstimate) {
        settlementReceived += Math.max(0, orderGross - order.marketplaceChargesEstimate);
      } else {
        settlementReceived += Math.round(orderGross * 0.75 * 100) / 100;
      }
    }
  });

  // Build lookup of active order IDs to prevent orphaned return fees or disconnected claim recoveries
  const activeOrderIds = new Set<string>();
  orders.forEach((o) => {
    if (o.status !== "CANCELLED") {
      activeOrderIds.add(o.id);
      if (o.channelOrderId) activeOrderIds.add(o.channelOrderId);
    }
  });

  // Return fees (Customer returns only; RTO fee is 0 per Points 6 & 9)
  // Scoped strictly to active orders in the current dataset
  let customerReturnFees = 0;
  if (totalOrders > 0) {
    returns.forEach((ret) => {
      if (ret.returnType !== "RTO") {
        const isLinkedToActiveOrder =
          (ret.orderId && activeOrderIds.has(ret.orderId)) ||
          (ret.channelOrderId && activeOrderIds.has(ret.channelOrderId));
        if (isLinkedToActiveOrder) {
          customerReturnFees += ret.customerReturnFee || 0;
        }
      }
    });
  }

  // Claims recoveries (Approved claims only per Points 10 & 11)
  // Scoped strictly to active orders in the current dataset
  let claimRecoveries = 0;
  let pendingClaimsAmount = 0;
  let pendingClaimsCount = 0;
  if (totalOrders > 0) {
    claims.forEach((claim) => {
      const isLinkedToActiveOrder = claim.orderId && activeOrderIds.has(claim.orderId);
      if (isLinkedToActiveOrder) {
        if (claim.status === "APPROVED" || claim.status === "RECOVERED" || claim.status === "PARTIALLY_RECOVERED") {
          claimRecoveries += claim.amountRecovered;
        } else if (claim.status === "FILED" || claim.status === "UNDER_REVIEW" || claim.status === "NOT_FILED") {
          pendingClaimsAmount += claim.amountClaimed;
          pendingClaimsCount += 1;
        }
      }
    });
  }

  // Point 17: Platform Profit & Net Profit
  // All Platform Profit = Settlement Received − Return Fees + Claim Recovery
  const allPlatformProfit = Math.round((settlementReceived - customerReturnFees + claimRecoveries) * 100) / 100;

  // Net Profit = All Platform Profit − Active COGS
  const netProfit = Math.round((allPlatformProfit - activeCogs) * 100) / 100;

  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAdSpend = expenses
    .filter((e) => e.category === "Advertising")
    .reduce((sum, e) => sum + e.amount, 0);

  const netOperatingProfit = Math.round((netProfit - operatingExpenses) * 100) / 100;
  const netOperatingMargin = grossSales > 0 ? netOperatingProfit / grossSales : 0;
  const contributionMargin = grossSales > 0 ? netProfit / grossSales : 0;
  const returnRate = totalUnitsSold > 0 ? (customerReturnCount + rtoCount) / totalUnitsSold : 0;

  const roas = totalAdSpend > 0 ? Math.round((grossSales / totalAdSpend) * 100) / 100 : 0;
  const poas = totalAdSpend > 0 ? Math.round((netProfit / totalAdSpend) * 100) / 100 : 0;

  const totalFees = Math.round(customerReturnFees * 100) / 100;

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    discounts: 0,
    refundedSales: 0,
    netSales: Math.round(grossSales * 100) / 100,
    cogs: Math.round(activeCogs * 100) / 100,
    grossProfit: Math.round((grossSales - activeCogs) * 100) / 100,
    grossMargin: grossSales > 0 ? (grossSales - activeCogs) / grossSales : 0,
    marketplaceCharges: Math.max(0, Math.round((grossSales - settlementReceived) * 100) / 100),
    shippingLogisticsCosts: 0,
    customerReturnFees: Math.round(customerReturnFees * 100) / 100,
    returnLosses: customerReturnFees,
    rtoLosses: 0,
    damageLosses: 0,
    claimRecoveries: Math.round(claimRecoveries * 100) / 100,
    contributionProfit: netProfit,
    contributionMargin: Math.round(contributionMargin * 1000) / 1000,
    operatingExpenses,
    netOperatingProfit,
    netOperatingMargin: Math.round(netOperatingMargin * 1000) / 1000,
    actualSettlementsReceived: Math.round(settlementReceived * 100) / 100,
    outstandingSettlementEstimated: 0,
    totalOrders,
    totalUnitsSold,
    totalReturns: returns.length,
    returnRate: Math.round(returnRate * 1000) / 1000,
    totalAdSpend,
    roas,
    poas,
    netPlatformPayout: allPlatformProfit,
    trueProfit: netProfit,
    rtoCount,
    customerReturnCount,
    pendingClaimsAmount: Math.round(pendingClaimsAmount * 100) / 100,
    pendingClaimsCount,
    damagedUnitsCount,
    totalFees,
  };
}

/**
 * Calculates Order-Level Profitability adhering strictly to the 20-point specification
 */
export function calculateOrderProfitability(
  order: Order,
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  indexedMaps?: IndexedFinancialMaps
): OrderProfitability {
  let grossSales = 0;
  let totalOrderCogs = 0;

  order.items.forEach((i) => {
    grossSales += i.sellingPrice * i.quantity;
    totalOrderCogs += i.snapshotUnitCost * i.quantity;
  });

  // Check linked settlements with O(1) indexed map lookup if available
  const rawLinkedSettlements = indexedMaps
    ? [
        ...(indexedMaps.settlementsByOrderMap.get(order.id) || []),
        ...(order.channelOrderId && order.channelOrderId !== order.id
          ? indexedMaps.settlementsByOrderMap.get(order.channelOrderId) || []
          : []),
      ]
    : settlements.filter(
        (s) => s.orderId === order.id || (order.channelOrderId && s.orderId === order.channelOrderId)
      );

  // Deduplicate by settlement id
  const settlementSeen = new Set<string>();
  const linkedSettlements: Settlement[] = [];
  for (const s of rawLinkedSettlements) {
    if (!settlementSeen.has(s.id)) {
      settlementSeen.add(s.id);
      linkedSettlements.push(s);
    }
  }

  // Settlement amount
  let settledAmount = 0;
  if (linkedSettlements.length > 0) {
    settledAmount = linkedSettlements.reduce((sum, s) => sum + s.netSettlement, 0);
  } else if (order.settlementAmount !== undefined && order.settlementAmount !== null) {
    settledAmount = order.settlementAmount;
  } else if (order.settlementPercent !== undefined && order.settlementPercent !== null) {
    settledAmount = Math.round(grossSales * (order.settlementPercent / 100) * 100) / 100;
  } else if (order.marketplaceChargesEstimate) {
    settledAmount = Math.max(0, grossSales - order.marketplaceChargesEstimate);
  } else {
    settledAmount = Math.round(grossSales * 0.75 * 100) / 100;
  }

  // Linked returns with O(1) indexed lookup if available
  const linkedReturns = indexedMaps
    ? indexedMaps.returnsByOrderMap.get(order.id) ||
      (order.channelOrderId ? indexedMaps.returnsByOrderMap.get(order.channelOrderId) : undefined) ||
      []
    : returns.filter(
        (r) => r.orderId === order.id || (order.channelOrderId && r.channelOrderId === order.channelOrderId)
      );

  // Linked claims with O(1) indexed lookup if available
  const linkedClaims = indexedMaps
    ? indexedMaps.claimsByOrderMap.get(order.id) || []
    : claims.filter((c) => c.orderId === order.id);

  // Claim recovery (Approved amount only per Points 10 & 11)
  const approvedClaims = linkedClaims.filter(
    (c) => c.status === "APPROVED" || c.status === "RECOVERED" || c.status === "PARTIALLY_RECOVERED"
  );
  const claimRecovery = approvedClaims.reduce((sum, c) => sum + c.amountRecovered, 0);

  // Determine return characteristics
  const isRto =
    order.status === "RTO" ||
    linkedReturns.some((r) => r.returnType === "RTO");

  const isDamaged =
    order.status === "DAMAGED_RETURN" ||
    order.status === "CLAIM_PENDING" ||
    order.status === "CLAIM_APPROVED" ||
    linkedReturns.some(
      (r) => r.returnType === "DAMAGED_RETURN" || r.condition === "DAMAGED" || r.condition === "UNUSABLE"
    );

  const isCustomerReturn =
    order.status === "CUSTOMER_RETURN" ||
    order.status === "RETURNED" ||
    linkedReturns.some((r) => r.returnType === "CUSTOMER_RETURN");

  // Return fee (for RTO, fee is always 0 per Points 6 & 9)
  let returnFee = 0;
  if (!isRto && (isCustomerReturn || isDamaged)) {
    returnFee = linkedReturns.reduce((sum, r) => sum + (r.returnType === "RTO" ? 0 : (r.customerReturnFee || 0)), 0);
  }

  // Calculate profit and effective metrics per Point 7 matrix:
  let effectiveSettlement = 0;
  let activeCogs = 0;
  let contributionProfit = 0;
  let chargesDeducted = 0;

  if (isDamaged || order.status === "CLAIM_PENDING" || order.status === "CLAIM_APPROVED") {
    // Point 5 & 10: Damaged Return / Claim (Customer Return or RTO):
    // Settlement = 0, COGS = Active, Return Fee = Yes (0 if RTO), Claim = approved amount
    // Profit = Claim Recovery − COGS − Return Fee
    effectiveSettlement = 0;
    activeCogs = totalOrderCogs;
    contributionProfit = Math.round((claimRecovery - activeCogs - returnFee) * 100) / 100;
    chargesDeducted = grossSales;
  } else if (isRto) {
    // Point 6: Undamaged RTO -> Settlement = 0, COGS = 0, Return Fee = 0, Profit = 0
    effectiveSettlement = 0;
    activeCogs = 0;
    returnFee = 0;
    contributionProfit = 0;
    chargesDeducted = grossSales;
  } else if (isCustomerReturn) {
    // Point 4: Customer Return + Good:
    // Settlement = 0, COGS = 0, Return Fee = Yes
    // Profit = − Return Fee
    effectiveSettlement = 0;
    activeCogs = 0;
    contributionProfit = Math.round(-returnFee * 100) / 100;
    chargesDeducted = grossSales;
  } else {
    // Point 3: Delivered Order:
    // Effective Settlement = Settlement Amount, Effective COGS = Active COGS, Return Fee = 0
    // Profit = Settlement − COGS
    effectiveSettlement = settledAmount;
    activeCogs = totalOrderCogs;
    returnFee = 0;
    contributionProfit = Math.round((effectiveSettlement - activeCogs) * 100) / 100;
    chargesDeducted = Math.max(0, grossSales - effectiveSettlement);
  }

  const netSales = (isRto || isCustomerReturn || isDamaged) ? 0 : grossSales;
  const contributionMargin = grossSales > 0 ? contributionProfit / grossSales : 0;

  return {
    orderId: order.id,
    marketplace: order.marketplace,
    orderDate: order.orderDate,
    status: order.status,
    grossSales,
    netSales,
    cogs: activeCogs,
    grossProfit: effectiveSettlement - activeCogs,
    chargesDeducted,
    returnLoss: returnFee,
    claimRecovery,
    contributionProfit,
    contributionMargin: Math.round(contributionMargin * 1000) / 1000,
    settledAmount: effectiveSettlement,
    isSettled: linkedSettlements.length > 0 || (effectiveSettlement > 0 && !!order.settlementAmount),
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
    "Myntra",
    "Meesho",
    "Personal Website",
  ];

  const maps = buildFinancialMaps(returns, settlements, claims);

  return marketplaces.map((mp) => {
    const mpOrders = orders.filter((o) => o.marketplace === mp && o.status !== "CANCELLED");
    const mpReturns = returns.filter((r) => r.marketplace === mp);
    const mpAdSpend = expenses
      .filter((e) => e.category === "Advertising" && e.marketplace === mp)
      .reduce((sum, e) => sum + e.amount, 0);

    let unitsSold = 0;
    let grossRevenue = 0;
    let totalCogs = 0;
    let totalProfit = 0;
    let totalClaimRecoveries = 0;
    let totalReturnFees = 0;

    mpOrders.forEach((o) => {
      const pnl = calculateOrderProfitability(o, returns, settlements, claims, maps);
      grossRevenue += pnl.grossSales;
      totalCogs += pnl.cogs;
      totalProfit += pnl.contributionProfit;
      totalClaimRecoveries += pnl.claimRecovery;
      totalReturnFees += pnl.returnLoss;
      o.items.forEach((i) => {
        unitsSold += i.quantity;
      });
    });

    const margin = grossRevenue > 0 ? totalProfit / grossRevenue : 0;
    const returnedUnits = mpReturns.reduce((sum, r) => sum + r.quantity, 0);
    const returnRate = unitsSold > 0 ? returnedUnits / unitsSold : 0;
    const poas = mpAdSpend > 0 ? Math.round((totalProfit / mpAdSpend) * 100) / 100 : 0;

    return {
      marketplace: mp,
      orderCount: mpOrders.length,
      unitsSold,
      revenue: Math.round(grossRevenue * 100) / 100,
      cogs: Math.round(totalCogs * 100) / 100,
      fees: Math.round(totalReturnFees * 100) / 100,
      logistics: 0,
      returnLosses: Math.round(totalReturnFees * 100) / 100,
      claimRecoveries: Math.round(totalClaimRecoveries * 100) / 100,
      contributionProfit: Math.round(totalProfit * 100) / 100,
      margin: Math.round(margin * 1000) / 1000,
      returnRate: Math.round(returnRate * 1000) / 1000,
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
  const returnUnitsMap = new Map<string, number>();
  const goodReturnUnitsMap = new Map<string, number>();
  const isDamaged = (cond: string) => cond === "DAMAGED" || cond === "UNUSABLE" || cond === "MISSING";
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i];
    if (r.orderId) {
      const uKey = `${r.orderId}:${r.sku}`;
      returnUnitsMap.set(uKey, (returnUnitsMap.get(uKey) || 0) + r.quantity);
      if (!isDamaged(r.condition)) {
        goodReturnUnitsMap.set(uKey, (goodReturnUnitsMap.get(uKey) || 0) + r.quantity);
      }
    }
    if (r.channelOrderId) {
      const uKey = `${r.channelOrderId}:${r.sku}`;
      returnUnitsMap.set(uKey, (returnUnitsMap.get(uKey) || 0) + r.quantity);
      if (!isDamaged(r.condition)) {
        goodReturnUnitsMap.set(uKey, (goodReturnUnitsMap.get(uKey) || 0) + r.quantity);
      }
    }
  }

  const ordersById = new Map<string, Order>();
  for (let i = 0; i < orders.length; i++) {
    ordersById.set(orders[i].id, orders[i]);
  }

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

    const orderGross = order.items.reduce((sum, it) => sum + it.sellingPrice * it.quantity, 0);

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

      const returnedQty = getReturnedUnitsForItem(order, item.sku, returns, returnUnitsMap) || item.returnedQuantity || 0;
      const goodReturnedQty = getGoodReturnedUnitsForItem(order, item.sku, returns, goodReturnUnitsMap);
      const deliveredQty = Math.max(0, item.quantity - goodReturnedQty);
      const refundedAmount = getRefundedAmountForItem(item, returnedQty);
      const itemNetRevenue = Math.max(0, item.sellingPrice * item.quantity - item.discount - refundedAmount);

      existing.unitsSold += item.quantity;
      existing.revenue += itemNetRevenue;
      existing.cogs += item.snapshotUnitCost * deliveredQty;

      // Pro-rata allocation based on item revenue contribution to the order
      const itemGross = item.sellingPrice * item.quantity;
      const revenueRatio = orderGross > 0 ? itemGross / orderGross : 1 / Math.max(1, order.items.length);
      existing.marketplaceCharges += (order.marketplaceChargesEstimate || 0) * revenueRatio;

      skuMap.set(item.sku, existing);
    });
  });

  returns.forEach((ret) => {
    const existing = skuMap.get(ret.sku);
    if (existing) {
      existing.returnedUnits += ret.quantity;
      existing.returnLosses += ret.returnType === "RTO" ? 0 : (ret.customerReturnFee || 0);
    }
  });

  claims.forEach((claim) => {
    if (claim.amountRecovered > 0) {
      const matchedOrder = ordersById.get(claim.orderId);
      if (matchedOrder && matchedOrder.items.length > 0) {
        const itemShare = claim.amountRecovered / matchedOrder.items.length;
        matchedOrder.items.forEach((i) => {
          const existing = skuMap.get(i.sku);
          if (existing) {
            existing.claimRecoveries += itemShare;
          }
        });
      }
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
    const profit = Math.round((s.revenue - s.cogs - s.marketplaceCharges - s.returnLosses + s.claimRecoveries) * 100) / 100;
    const margin = s.revenue > 0 ? profit / s.revenue : 0;
    const returnRate = s.unitsSold > 0 ? s.returnedUnits / s.unitsSold : 0;
    const poas = s.adSpend > 0 ? Math.round((profit / s.adSpend) * 100) / 100 : undefined;

    return {
      sku: s.sku,
      productName: s.productName,
      unitsSold: s.unitsSold,
      revenue: Math.round(s.revenue * 100) / 100,
      cogs: Math.round(s.cogs * 100) / 100,
      marketplaceCharges: Math.round(s.marketplaceCharges * 100) / 100,
      returnLosses: Math.round(s.returnLosses * 100) / 100,
      claimRecoveries: Math.round(s.claimRecoveries * 100) / 100,
      profit,
      margin: Math.round(margin * 1000) / 1000,
      returnRate: Math.round(returnRate * 1000) / 1000,
      adSpend: s.adSpend > 0 ? Math.round(s.adSpend * 100) / 100 : undefined,
      poas,
    };
  });
}

export interface ReturnFinancials {
  unitCost: number;
  productCost: number;
  isDamaged: boolean;
  salvageValue: number;
  returnShippingCost: number;
  customerReturnFee: number;
  damageLoss: number;
  baseLoss: number;
  claim?: Claim;
  claimStatus: ClaimStatus | "UNCLAIMED" | "NO_CLAIM";
  claimStatusLabel: string;
  amountClaimed: number;
  reimbursementAmount: number;
  netLoss: number;
  isNetProfit: boolean;
  netFinancialImpact: number;
}

/**
 * Computes deterministic real-time financial impact for any return event,
 * linking damaged product cost basis, courier logistics fees, and claim reimbursements.
 * Stays synchronized across Draft, Dispute, and Reimbursed claim transitions.
 */
export function computeReturnFinancials(
  r: ReturnRecord,
  orders: Order[] = [],
  products: Product[] = [],
  claims: Claim[] = []
): ReturnFinancials {
  // 1. Determine Product Unit Cost from Order snapshot or Catalog
  const order = orders.find(
    (o) => o.id === r.orderId || (r.channelOrderId && o.channelOrderId === r.channelOrderId)
  );
  const orderItem = order?.items.find((i) => i.sku === r.sku);
  const matchedProduct = products.find((p) => p.sku === r.sku);
  const unitCost = orderItem?.snapshotUnitCost ?? matchedProduct?.currentCostPrice ?? 350;
  const productCost = unitCost * r.quantity;

  // 2. Identify Damage State
  const isDamaged =
    r.condition === "DAMAGED" ||
    r.condition === "UNUSABLE" ||
    r.condition === "MISSING" ||
    r.returnType === "DAMAGED_RETURN";

  // 3. Logistics Fees & Salvage
  const salvageValue = r.inventoryRecoveryValue || 0;
  const isRto = r.returnType === "RTO";
  const customerReturnFee = isRto ? 0 : (r.customerReturnFee ?? 0);
  const returnShippingCost = isRto ? 0 : (r.returnShippingCost || 0);
  const logisticsFees = returnShippingCost + customerReturnFee;

  // 4. Base Loss (Gross Loss before Claim Reimbursement)
  const damageLoss = isDamaged ? Math.max(0, productCost - salvageValue) : 0;
  let baseLoss = 0;
  if (isDamaged) {
    baseLoss = damageLoss + logisticsFees;
  } else {
    baseLoss = isRto ? 0 : logisticsFees;
  }

  // Fallback to r.lossAmount if baseLoss is 0 and non-RTO recorded an explicit loss
  if (baseLoss === 0 && r.lossAmount > 0 && !isRto) {
    baseLoss = r.lossAmount;
  }

  // 5. Match Linked Claim
  const claim = claims.find(
    (c) =>
      (r.claimId && c.id === r.claimId) ||
      c.returnId === r.id ||
      (c.orderId && (c.orderId === r.orderId || (r.channelOrderId && c.orderId === r.channelOrderId)))
  );

  // 6. Reimbursement & Claim Amount
  const amountClaimed = claim ? claim.amountClaimed : (isDamaged ? baseLoss : 0);
  const reimbursementAmount = claim ? (claim.amountRecovered || 0) : 0;

  // 7. Claim Status Label
  let claimStatus: ClaimStatus | "UNCLAIMED" | "NO_CLAIM" = "NO_CLAIM";
  let claimStatusLabel = "No Claim Needed";

  if (claim) {
    claimStatus = claim.status;
    switch (claim.status) {
      case "NOT_FILED":
        claimStatusLabel = "Draft Claim";
        break;
      case "FILED":
        claimStatusLabel = "Dispute Filed";
        break;
      case "UNDER_REVIEW":
        claimStatusLabel = "Dispute in Review";
        break;
      case "APPROVED":
        claimStatusLabel = reimbursementAmount > 0 ? "Approved & Reimbursed" : "Approved";
        break;
      case "PARTIALLY_RECOVERED":
        claimStatusLabel = "Partially Reimbursed";
        break;
      case "RECOVERED":
        claimStatusLabel = "Reimbursed";
        break;
      case "REJECTED":
        claimStatusLabel = "Dispute Rejected";
        break;
      case "CLOSED":
        claimStatusLabel = "Closed";
        break;
      default:
        claimStatusLabel = String(claim.status).replace(/_/g, " ");
    }
  } else if (isDamaged) {
    claimStatus = "UNCLAIMED";
    claimStatusLabel = "Unclaimed (Draft Eligible)";
  }

  // 8. Real-time Net Financial Impact (Net Loss or Net Profit)
  const netFinancialImpact = Math.round((baseLoss - reimbursementAmount) * 100) / 100;
  const isNetProfit = netFinancialImpact < 0;
  const netLoss = Math.max(0, netFinancialImpact);

  return {
    unitCost,
    productCost,
    isDamaged,
    salvageValue,
    returnShippingCost,
    customerReturnFee,
    damageLoss,
    baseLoss,
    claim,
    claimStatus,
    claimStatusLabel,
    amountClaimed,
    reimbursementAmount,
    netLoss,
    isNetProfit,
    netFinancialImpact,
  };
}

export type DateRangePreset = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "PREVIOUS_MONTH" | "CUSTOM";

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
 * Uses anchor date (latest order/active business date)
 */
export function resolveDatePreset(
  preset: DateRangePreset,
  anchorDateStr: string = "2026-09-07",
  customRange?: DateFilterRange | null
): { current: DateFilterRange; previous: DateFilterRange } {
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (preset === "CUSTOM" && customRange && customRange.startDate && customRange.endDate) {
    const s = new Date(customRange.startDate + "T00:00:00");
    const e = new Date(customRange.endDate + "T00:00:00");
    const diffMs = Math.max(0, e.getTime() - s.getTime());
    const prevEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(prevEnd.getTime() - diffMs);
    return {
      current: customRange,
      previous: { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) },
    };
  }

  if (preset === "ALL") {
    return {
      current: { startDate: "2020-01-01", endDate: "2030-12-31" },
      previous: { startDate: "2010-01-01", endDate: "2019-12-31" },
    };
  }

  const anchor = new Date(anchorDateStr + "T00:00:00");

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

  const anchorYear = anchor.getFullYear();
  const anchorMonth = anchor.getMonth(); // 0-indexed

  if (preset === "PREVIOUS_MONTH") {
    const prevMonthStart = new Date(anchorYear, anchorMonth - 1, 1);
    const prevMonthEnd = new Date(anchorYear, anchorMonth, 0);
    const pprevMonthStart = new Date(anchorYear, anchorMonth - 2, 1);
    const pprevMonthEnd = new Date(anchorYear, anchorMonth - 1, 0);
    return {
      current: { startDate: formatDate(prevMonthStart), endDate: formatDate(prevMonthEnd) },
      previous: { startDate: formatDate(pprevMonthStart), endDate: formatDate(pprevMonthEnd) },
    };
  }

  // THIS_MONTH
  const thisMonthStart = new Date(anchorYear, anchorMonth, 1);
  const thisMonthEnd = new Date(anchorYear, anchorMonth + 1, 0);
  const prevMonthStart = new Date(anchorYear, anchorMonth - 1, 1);
  const prevMonthEnd = new Date(anchorYear, anchorMonth, 0);
  return {
    current: { startDate: formatDate(thisMonthStart), endDate: formatDate(thisMonthEnd) },
    previous: { startDate: formatDate(prevMonthStart), endDate: formatDate(prevMonthEnd) },
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
  const isBetween = (dStr: string | undefined | null) => {
    if (!dStr) return false;
    const dateOnly = dStr.slice(0, 10);
    return dateOnly >= range.startDate && dateOnly <= range.endDate;
  };

  const filteredOrders = orders.filter((o) => isBetween(o.orderDate));
  const filteredReturns = returns.filter((r) => isBetween(r.returnDate));
  const filteredSettlements = settlements.filter((s) => isBetween(s.settlementDate));
  const filteredClaims = claims.filter((c) => {
    const dateToCheck =
      (c.status === "RECOVERED" || c.status === "PARTIALLY_RECOVERED") && c.recoveryDate
        ? c.recoveryDate
        : c.claimDate;
    return isBetween(dateToCheck);
  });
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
  const settledOrderIds = new Set<string>();
  settlements.forEach((s) => {
    if (s.orderId) settledOrderIds.add(s.orderId);
  });

  const unsettled = orders.filter(
    (o) =>
      o.status !== "CANCELLED" &&
      !settledOrderIds.has(o.id) &&
      (!o.channelOrderId || !settledOrderIds.has(o.channelOrderId))
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