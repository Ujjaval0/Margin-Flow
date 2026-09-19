import {
  Order,
  OrderItem,
  ReturnRecord,
  Settlement,
  Claim,
  Expense,
  Marketplace,
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
  let grossSales = 0;
  let discounts = 0;
  let refundedSales = 0;
  let deliveredCogs = 0;
  let totalUnitsSold = 0;

  const maps = buildFinancialMaps(returns, settlements, claims);

  // Process valid orders (exclude outright cancelled orders from revenue)
  orders.forEach((order) => {
    if (order.status === "CANCELLED") return;

    order.items.forEach((item) => {
      const itemGross = item.sellingPrice * item.quantity;
      grossSales += itemGross;
      discounts += item.discount;
      totalUnitsSold += item.quantity;

      const returnedQty = getReturnedUnitsForItem(order, item.sku, returns, maps.returnUnitsMap) || item.returnedQuantity || 0;
      const deliveredQty = Math.max(0, item.quantity - returnedQty);
      deliveredCogs += item.snapshotUnitCost * deliveredQty;
      refundedSales += getRefundedAmountForItem(item, returnedQty);
    });
  });

  const netSales = Math.max(0, Math.round((grossSales - discounts - refundedSales) * 100) / 100);
  const grossProfit = Math.round((netSales - deliveredCogs) * 100) / 100;
  const grossMargin = netSales > 0 ? grossProfit / netSales : 0;

  // Process Returns & Losses (Net write-offs and reverse logistics)
  let returnLosses = 0;
  let rtoLosses = 0;
  let damageLosses = 0;
  let totalReturnedUnits = 0;
  let rtoCount = 0;
  let customerReturnCount = 0;
  let damagedUnitsCount = 0;

  let customerReturnFees = 0;

  returns.forEach((ret) => {
    totalReturnedUnits += ret.quantity;
    const loss = ret.lossAmount; // Exact net loss, no double counting of shipping

    if (ret.returnType === "RTO") {
      rtoLosses += loss;
      rtoCount += ret.quantity;
    } else {
      returnLosses += loss;
      customerReturnCount += ret.quantity;
    }

    if (ret.customerReturnFee) {
      customerReturnFees += ret.customerReturnFee;
    }

    if (ret.condition === "DAMAGED" || ret.condition === "UNUSABLE") {
      damageLosses += Math.max(0, ret.lossAmount - ret.returnShippingCost - ret.otherReturnCosts);
      damagedUnitsCount += ret.quantity;
    }
  });

  // Process Claims Recoveries
  let claimRecoveries = 0;
  let pendingClaimsAmount = 0;
  let pendingClaimsCount = 0;
  claims.forEach((claim) => {
    if (claim.status === "RECOVERED" || claim.status === "PARTIALLY_RECOVERED") {
      claimRecoveries += claim.amountRecovered;
    } else if (claim.status === "FILED" || claim.status === "UNDER_REVIEW") {
      pendingClaimsAmount += claim.amountClaimed;
      pendingClaimsCount += 1;
    }
  });

  // Process Settlements (Order-by-order hybrid reconciliation)
  const settlementsByOrderId = new Map<string, Settlement[]>();
  settlements.forEach((s) => {
    if (s.orderId) {
      const list = settlementsByOrderId.get(s.orderId) || [];
      list.push(s);
      settlementsByOrderId.set(s.orderId, list);
    }
  });

  let marketplaceCharges = 0;
  let shippingLogisticsCosts = 0;
  let actualSettlementsReceived = 0;

  orders.forEach((order) => {
    if (order.status === "CANCELLED") return;

    const linkedSettlements = [
      ...(settlementsByOrderId.get(order.id) || []),
      ...(order.channelOrderId ? settlementsByOrderId.get(order.channelOrderId) || [] : []),
    ];

    if (linkedSettlements.length > 0) {
      // Settled order: use actual settlement fee deductions
      linkedSettlements.forEach((s) => {
        s.deductions.forEach((d) => {
          if (d.category === "LOGISTICS") {
            shippingLogisticsCosts += d.amount;
          } else if (d.category !== "RETURN_SHIPPING") {
            marketplaceCharges += d.amount;
          }
        });
      });
    } else {
      // Unsettled order: retain estimates
      marketplaceCharges += order.marketplaceChargesEstimate || 0;
      shippingLogisticsCosts += order.shippingFeeCharged || 0;
    }
  });

  settlements.forEach((s) => {
    actualSettlementsReceived += s.netSettlement;
  });

  // Contribution Profit
  const contributionProfit = Math.round(
    (grossProfit -
      marketplaceCharges -
      shippingLogisticsCosts -
      (returnLosses + rtoLosses) +
      claimRecoveries) * 100
  ) / 100;
  const contributionMargin = netSales > 0 ? contributionProfit / netSales : 0;

  // Operating Expenses & Advertising Attribution
  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAdSpend = expenses
    .filter((e) => e.category === "Advertising")
    .reduce((sum, e) => sum + e.amount, 0);

  // Net Operating Profit
  const netOperatingProfit = Math.round((contributionProfit - operatingExpenses) * 100) / 100;
  const netOperatingMargin = netSales > 0 ? netOperatingProfit / netSales : 0;

  // ROAS & POAS
  const roas = totalAdSpend > 0 ? Math.round((netSales / totalAdSpend) * 100) / 100 : 0;
  const poas = totalAdSpend > 0 ? Math.round((contributionProfit / totalAdSpend) * 100) / 100 : 0;

  const totalOrders = orders.filter((o) => o.status !== "CANCELLED").length;
  const returnRate = totalUnitsSold > 0 ? totalReturnedUnits / totalUnitsSold : 0;

  const outstandingSettlementEstimated = Math.max(
    0,
    Math.round((netSales - marketplaceCharges - shippingLogisticsCosts - actualSettlementsReceived) * 100) / 100
  );

  const totalFees = Math.round(
    (marketplaceCharges + shippingLogisticsCosts + customerReturnFees) * 100
  ) / 100;

  return {
    grossSales,
    discounts,
    refundedSales,
    netSales,
    cogs: deliveredCogs,
    grossProfit,
    grossMargin,
    marketplaceCharges,
    shippingLogisticsCosts,
    customerReturnFees,
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
    netPlatformPayout: contributionProfit + deliveredCogs,
    trueProfit: contributionProfit,
    rtoCount,
    customerReturnCount,
    pendingClaimsAmount,
    pendingClaimsCount,
    damagedUnitsCount,
    totalFees,
  };
}

/**
 * Calculates Order-Level Profitability
 */
export function calculateOrderProfitability(
  order: Order,
  returns: ReturnRecord[],
  settlements: Settlement[],
  claims: Claim[],
  indexedMaps?: IndexedFinancialMaps
): OrderProfitability {
  let grossSales = 0;
  let discounts = 0;
  let refundedSales = 0;
  let deliveredCogs = 0;

  order.items.forEach((i) => {
    const itemGross = i.sellingPrice * i.quantity;
    grossSales += itemGross;
    discounts += i.discount;

    const returnedQty = getReturnedUnitsForItem(order, i.sku, returns, indexedMaps?.returnUnitsMap) || i.returnedQuantity || 0;
    const deliveredQty = Math.max(0, i.quantity - returnedQty);
    deliveredCogs += i.snapshotUnitCost * deliveredQty;
    refundedSales += getRefundedAmountForItem(i, returnedQty);
  });

  const netSales = Math.max(0, Math.round((grossSales - discounts - refundedSales) * 100) / 100);
  const grossProfit = Math.round((netSales - deliveredCogs) * 100) / 100;

  // Check linked settlements with O(1) indexed map lookup if available
  const linkedSettlements = indexedMaps
    ? [
        ...(indexedMaps.settlementsByOrderMap.get(order.id) || []),
        ...(order.channelOrderId ? indexedMaps.settlementsByOrderMap.get(order.channelOrderId) || [] : []),
      ]
    : settlements.filter(
        (s) => s.orderId === order.id || (order.channelOrderId && s.orderId === order.channelOrderId)
      );

  let chargesDeducted = 0;
  let settledAmount = 0;

  if (linkedSettlements.length > 0) {
    linkedSettlements.forEach((s) => {
      settledAmount += s.netSettlement;
      chargesDeducted += s.deductions
        .filter((d) => d.category !== "RETURN_SHIPPING")
        .reduce((sum, d) => sum + d.amount, 0);
    });
  } else {
    chargesDeducted = (order.marketplaceChargesEstimate || 0) + (order.shippingFeeCharged || 0);
  }

  // Linked returns with O(1) indexed lookup if available
  const linkedReturns = indexedMaps
    ? indexedMaps.returnsByOrderMap.get(order.id) ||
      (order.channelOrderId ? indexedMaps.returnsByOrderMap.get(order.channelOrderId) : undefined) ||
      []
    : returns.filter(
        (r) => r.orderId === order.id || (order.channelOrderId && r.channelOrderId === order.channelOrderId)
      );
  const returnLoss = linkedReturns.reduce((sum, r) => sum + r.lossAmount, 0);

  // Linked claims with O(1) indexed lookup if available
  const linkedClaims = indexedMaps
    ? indexedMaps.claimsByOrderMap.get(order.id) || []
    : claims.filter((c) => c.orderId === order.id);
  const claimRecovery = linkedClaims.reduce((sum, c) => sum + c.amountRecovered, 0);

  const contributionProfit = Math.round((grossProfit - chargesDeducted - returnLoss + claimRecovery) * 100) / 100;
  const contributionMargin = netSales > 0 ? contributionProfit / netSales : 0;

  return {
    orderId: order.id,
    marketplace: order.marketplace,
    orderDate: order.orderDate,
    status: order.status,
    grossSales,
    netSales,
    cogs: deliveredCogs,
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
    "Myntra",
    "Meesho",
  ];

  const maps = buildFinancialMaps(returns, settlements, claims);
  const settlementsByOrderId = maps.settlementsByOrderMap;

  return marketplaces.map((mp) => {
    const mpOrders = orders.filter((o) => o.marketplace === mp && o.status !== "CANCELLED");
    const mpReturns = returns.filter((r) => r.marketplace === mp);
    const mpClaims = claims.filter((c) => c.marketplace === mp);
    const mpAdSpend = expenses
      .filter((e) => e.category === "Advertising" && e.marketplace === mp)
      .reduce((sum, e) => sum + e.amount, 0);

    let unitsSold = 0;
    let grossRevenue = 0;
    let discounts = 0;
    let refundedSales = 0;
    let deliveredCogs = 0;
    let fees = 0;
    let logistics = 0;

    mpOrders.forEach((o) => {
      o.items.forEach((i) => {
        unitsSold += i.quantity;
        grossRevenue += i.sellingPrice * i.quantity;
        discounts += i.discount;

        const returnedQty = getReturnedUnitsForItem(o, i.sku, mpReturns, maps.returnUnitsMap) || i.returnedQuantity || 0;
        const deliveredQty = Math.max(0, i.quantity - returnedQty);
        deliveredCogs += i.snapshotUnitCost * deliveredQty;
        refundedSales += getRefundedAmountForItem(i, returnedQty);
      });

      const linked = [
        ...(settlementsByOrderId.get(o.id) || []),
        ...(o.channelOrderId ? settlementsByOrderId.get(o.channelOrderId) || [] : []),
      ];

      if (linked.length > 0) {
        linked.forEach((s) => {
          s.deductions.forEach((d) => {
            if (d.category === "LOGISTICS") {
              logistics += d.amount;
            } else if (d.category !== "RETURN_SHIPPING") {
              fees += d.amount;
            }
          });
        });
      } else {
        fees += o.marketplaceChargesEstimate || 0;
        logistics += o.shippingFeeCharged || 0;
      }
    });

    const netRevenue = Math.max(0, Math.round((grossRevenue - discounts - refundedSales) * 100) / 100);
    const returnLosses = mpReturns.reduce((sum, r) => sum + r.lossAmount, 0);
    const claimRecoveries = mpClaims.reduce((sum, c) => sum + c.amountRecovered, 0);

    const contributionProfit = Math.round(
      (netRevenue - deliveredCogs - fees - logistics - returnLosses + claimRecoveries) * 100
    ) / 100;
    const margin = netRevenue > 0 ? contributionProfit / netRevenue : 0;
    const returnedUnits = mpReturns.reduce((sum, r) => sum + r.quantity, 0);
    const returnRate = unitsSold > 0 ? returnedUnits / unitsSold : 0;
    const poas = mpAdSpend > 0 ? Math.round((contributionProfit / mpAdSpend) * 100) / 100 : 0;

    return {
      marketplace: mp,
      orderCount: mpOrders.length,
      unitsSold,
      revenue: netRevenue,
      cogs: deliveredCogs,
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
      existing.returnLosses += ret.lossAmount; // Exact net loss, no double counting
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