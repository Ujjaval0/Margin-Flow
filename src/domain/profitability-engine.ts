import { settlementMovement } from "./settlement-evidence";
import { businessDate } from "./report-scope";
import { returnClaimAllocations } from './claim-attribution';
import { marketplaceFeeFacts } from './accounting-policy';
import { recoveredAt } from './claim-recovery';
import { getOrderFinancialFacts, getReturnCostFacts, isDamagedReturn, money, sumMoney, prorateMoney, allocateMoney } from "./order-financials";
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
  isComplete?: boolean;
  issues?: string[];
  shippingRevenue?:number;
  outputTaxExcluded?:number;
  directReturnCosts?:number;
  salvageRecovery?:number;
  returnRateUnits?: number;
  returnRateDenominator?: number;
  customerReturnRate?: number;
  rtoRate?: number;
  customerReturnRateUnits?: number;
  rtoRateUnits?: number;
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
  outstandingSettlementEstimated: number | null;
  unknownFeeOrders: number;
  totalOrders: number;
  totalUnitsSold: number;
  totalReturns: number;
  returnRate: number;

  // Performance Advertising & Attribution
  totalAdSpend: number;
  roas: number; // Return on Ad Spend: Net Sales / Ad Spend
  poas: number; // Profit on Ad Spend: Contribution Profit / Ad Spend

  // Operator Payout & Return Split Metrics
  netPlatformPayout: number; // Evidenced bank payouts; net settlement already includes its adjustments.
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
  salvageRecovery?: number;
  profit: number;
  margin: number;
  returnRate: number;
  returnedUnits?: number;
  orderCount?: number;
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
  grossSales?: number;
  actualSettlementsReceived?: number;
  returnedUnits?: number;
  returnRateDenominator?: number;
  customerReturnRate?: number;
  rtoRate?: number;
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
    const condMap = isDamagedReturn(r) ? damagedReturnUnitsMap : r.condition === "SELLABLE" ? goodReturnUnitsMap : new Map<string, number>();

    if (r.orderId) {
      const uKey = `${r.orderId}:${r.sku}`;
      returnUnitsMap.set(uKey, (returnUnitsMap.get(uKey) || 0) + r.quantity);
      condMap.set(uKey, (condMap.get(uKey) || 0) + r.quantity);
      const list = returnsByOrderMap.get(r.orderId);
      if (list) list.push(r);
      else returnsByOrderMap.set(r.orderId, [r]);
    }
    if (r.channelOrderId && r.channelOrderId !== r.orderId) {
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
  return getOrderFinancialFacts(order, returns, [], []).lines.filter(line => line.sku === itemSku)
    .reduce((sum, line) => sum + line.returnedUnits, 0);
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
  return getOrderFinancialFacts(order, returns, [], []).lines.filter(line => line.sku === itemSku)
    .reduce((sum, line) => sum + line.goodUnits, 0);
}

/**
 * Helper to calculate the refunded revenue for returned units of an order item
 */
export function getRefundedAmountForItem(item: OrderItem, returnedQty: number): number {
  if (item.quantity <= 0 || returnedQty <= 0) return 0;
  const effectiveReturned = Math.min(returnedQty, item.quantity);
  const gross = item.lineSubtotal ?? prorateMoney(item.sellingPrice, item.quantity, 1);
  return prorateMoney(sumMoney([gross, -Math.min(gross, Math.max(0, item.discount))]), effectiveReturned, item.quantity);
}

/**
 * Calculates comprehensive business-level financial metrics
 */
function financialFacts(order: Order, returns: ReturnRecord[], settlements: Settlement[], claims: Claim[], maps?: IndexedFinancialMaps) {
  const candidates = <T,>(map: Map<string, T[]>) => [...(map.get(order.id) || []), ...(order.channelOrderId !== order.id ? map.get(order.channelOrderId) || [] : [])];
  return getOrderFinancialFacts(order, maps ? candidates(maps.returnsByOrderMap) : returns, maps ? candidates(maps.settlementsByOrderMap) : settlements, maps ? candidates(maps.claimsByOrderMap) : claims);
}
export function calculateBusinessProfitability(orders: Order[], returns: ReturnRecord[], settlements: Settlement[], claims: Claim[], expenses: Expense[],asOf?:string): ProfitabilityMetrics {
  const maps = buildFinancialMaps(returns, settlements, claims);
  const facts = orders.map(order => asOf?getOrderFinancialFacts(order,returns,settlements,claims,asOf):financialFacts(order, returns, settlements, claims, maps));
  const sum = (key: "grossSales" | "discounts" | "refundedSales" | "netSales" | "cogs" | "grossProfit" | "fees" | "shippingFees" | "returnCosts" | "claimRecovery" | "cash" | "units" | "returnedUnits" | "rtoUnits" | "damagedUnits" | "damageLoss" | "contributionProfit") => sumMoney(facts.map(fact => fact[key]));
  const unknownPayoutOrders = facts.filter(fact => fact.revenueRecognised && fact.expectedPayout === null).length;
  const grossSales = sum("grossSales"), netSales = sumMoney([sum("netSales"),sumMoney(facts.map(f=>f.shippingRevenue))]), cogs = sum("cogs"), grossProfit = sum("grossProfit");
  const contributionProfit = sum("contributionProfit");
  const datedExpenses = expenses.filter(expense => !asOf || expense.date.slice(0, 10) <= asOf);
  const operatingExpenses = sumMoney(datedExpenses.map(expense => expense.amount));
  const totalAdSpend = sumMoney(datedExpenses.filter(expense => expense.category === "Advertising").map(expense => expense.amount));
  const netOperatingProfit = money(contributionProfit - operatingExpenses);
  const activeOrders = orders.filter(order => order.status !== "CANCELLED" && (!asOf || order.orderDate.slice(0, 10) <= asOf));
  const pendingClaims = Array.from(new Map(claims.filter(claim => (!asOf || claim.claimDate.slice(0, 10) <= asOf) &&
    ["FILED", "UNDER_REVIEW", "NOT_FILED", "APPROVED", "PARTIALLY_RECOVERED"].includes(claim.status) && claim.amountClaimed > recoveredAt(claim, asOf) &&
    orders.some(order => order.marketplace === claim.marketplace && (order.id === claim.orderId || order.channelOrderId === claim.orderId))).map(claim => [claim.id, claim])).values());
  const actualSettlementsReceived = sumMoney(Array.from(new Map(settlements.filter(s=>s.evidenceType!=="FINANCIAL_EVENT" && (!asOf || s.settlementDate.slice(0,10)<=asOf)).map(s=>[s.id,s])).values()).map(s=>s.netSettlement));
  const relevantFacts = facts.filter((fact, index) => fact.revenueRecognised || fact.fees || fact.returnCosts || fact.claimRecovery || fact.cash || fact.issues.length && (!asOf || orders[index].orderDate.slice(0, 10) <= asOf));
  const issues = Array.from(new Set(relevantFacts.flatMap(fact => fact.issues)));
  if (facts.some(fact => fact.revenueRecognised && fact.feeStatus === "UNKNOWN")) issues.push("Marketplace fee basis unresolved");
  if (facts.some(fact => fact.cashFees !== 0 && (fact.feeStatus === 'ESTIMATE' || fact.feeStatus === 'LEGACY'))) issues.push("Marketplace fees include estimates");
  return {
    isComplete:relevantFacts.every(fact=>fact.isComplete) && issues.length === 0,issues,
    shippingRevenue:sumMoney(facts.map(f=>f.shippingRevenue)),outputTaxExcluded:sumMoney(facts.filter(f=>f.taxIncludedInGross).map(f=>f.retainedTax)),directReturnCosts:sumMoney(facts.map(f=>f.returnCosts)),salvageRecovery:sumMoney(facts.map(f=>f.salvageRecovery)),
    grossSales, discounts: sum("discounts"), refundedSales: sum("refundedSales"), netSales, cogs, grossProfit,
    grossMargin: netSales > 0 ? grossProfit / netSales : 0,
    marketplaceCharges: money(sum("fees") - sum("shippingFees")), shippingLogisticsCosts: sum("shippingFees"),
    customerReturnFees: sumMoney(facts.flatMap(fact => fact.returnDetails.map(detail => detail.customerReturnFee))),
    returnLosses: money(sum("returnCosts") + sum("damageLoss")),
    rtoLosses: sumMoney(facts.flatMap(fact => fact.returnDetails.filter(detail => detail.record.returnType === "RTO").map(detail => detail.baseLoss))),
    damageLosses: sum("damageLoss"), claimRecoveries: sum("claimRecovery"), contributionProfit,
    contributionMargin: netSales > 0 ? contributionProfit / netSales : 0, operatingExpenses, netOperatingProfit,
    netOperatingMargin: netSales > 0 ? netOperatingProfit / netSales : 0,
    actualSettlementsReceived, outstandingSettlementEstimated: unknownPayoutOrders ? null : sumMoney(facts.map(fact => fact.outstanding || 0)),
    unknownFeeOrders: facts.filter(fact => fact.revenueRecognised && fact.feeStatus === "UNKNOWN").length,
    totalOrders: activeOrders.length, totalUnitsSold: sum("units"),
    totalReturns: new Set(facts.flatMap(fact => fact.linkedReturns.map(ret => ret.id))).size,
    returnRate: sum("units") > 0 ? sum("returnedUnits") / sum("units") : 0,
    returnRateUnits: sum("returnedUnits"), returnRateDenominator: sum("units"),
    customerReturnRateUnits: sum("returnedUnits") - sum("rtoUnits"), rtoRateUnits: sum("rtoUnits"),
    customerReturnRate: sum("units") > 0 ? (sum("returnedUnits") - sum("rtoUnits")) / sum("units") : 0,
    rtoRate: sum("units") > 0 ? sum("rtoUnits") / sum("units") : 0,
    totalAdSpend, roas: totalAdSpend > 0 ? netSales / totalAdSpend : 0, poas: totalAdSpend > 0 ? contributionProfit / totalAdSpend : 0,
    netPlatformPayout: actualSettlementsReceived,
    rtoCount: sum("rtoUnits"), customerReturnCount: sum("returnedUnits") - sum("rtoUnits"), damagedUnitsCount: sum("damagedUnits"),
    pendingClaimsAmount: sumMoney(pendingClaims.map(claim => Math.max(0, sumMoney([claim.amountClaimed, -recoveredAt(claim, asOf)])))), pendingClaimsCount: pendingClaims.length,
    totalFees: money(sum("fees") + sum("returnCosts")),
  };
}

/**
 * Calculates Order-Level Profitability adhering strictly to the 20-point specification
 */
export function calculateOrderProfitability(order: Order, returns: ReturnRecord[], settlements: Settlement[], claims: Claim[], indexedMaps?: IndexedFinancialMaps): OrderProfitability {
  const fact = financialFacts(order, returns, settlements, claims, indexedMaps);
  return { orderId: order.id, marketplace: order.marketplace, orderDate: order.orderDate, status: order.status,
    grossSales: fact.grossSales, netSales: sumMoney([fact.netSales, fact.shippingRevenue]), cogs: fact.cogs, grossProfit: fact.grossProfit,
    chargesDeducted: fact.fees, returnLoss: fact.returnCosts, claimRecovery: fact.claimRecovery,
    contributionProfit: fact.contributionProfit, contributionMargin: fact.netSales + fact.shippingRevenue > 0 ? fact.contributionProfit / sumMoney([fact.netSales, fact.shippingRevenue]) : 0,
    settledAmount: fact.cash, isSettled: fact.isSettled,
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
  const defaultMarketplaces: Marketplace[] = [
    "Amazon India",
    "Flipkart",
    "Myntra",
    "Meesho",
    "Personal Website",
    "WooCommerce",
  ];
  const orderMarketplaces = orders
    .map((o) => o.marketplace)
    .filter((mp): mp is Marketplace => Boolean(mp));
  const returnMarketplaces = returns
    .map((r) => r.marketplace)
    .filter((mp): mp is Marketplace => Boolean(mp));
  const marketplaces = Array.from(new Set([...defaultMarketplaces, ...orderMarketplaces, ...returnMarketplaces, ...settlements.map(s => s.marketplace), ...claims.map(c => c.marketplace), ...expenses.flatMap(e => e.marketplace ? [e.marketplace] : [])])) as Marketplace[];

  const maps = buildFinancialMaps(returns, settlements, claims);

  return marketplaces.map((mp) => {
    const totals = calculateBusinessProfitability(
      orders.filter(order => order.marketplace === mp), returns.filter(record => record.marketplace === mp),
      settlements.filter(record => record.marketplace === mp), claims.filter(record => record.marketplace === mp),
      expenses.filter(expense => expense.marketplace === mp)
    );
    return { marketplace: mp, orderCount: totals.totalOrders, unitsSold: totals.totalUnitsSold,
      revenue: totals.netSales, cogs: totals.cogs, fees: totals.marketplaceCharges, logistics: totals.shippingLogisticsCosts,
      returnLosses: totals.returnLosses, claimRecoveries: totals.claimRecoveries, contributionProfit: totals.contributionProfit,
      margin: totals.contributionMargin, returnRate: totals.returnRate, adSpend: totals.totalAdSpend, poas: totals.poas,
      grossSales: totals.grossSales, actualSettlementsReceived: totals.actualSettlementsReceived,
      returnedUnits: totals.customerReturnCount + totals.rtoCount, returnRateDenominator: totals.returnRateDenominator,
      customerReturnRate: totals.customerReturnRate, rtoRate: totals.rtoRate };
  });
}

/**
 * Calculates SKU-Level Profitability
 */
export function calculateSkuProfitability(orders: Order[], returns: ReturnRecord[], settlements: Settlement[], claims: Claim[], expenses: Expense[] = [],asOf?:string): SkuProfitability[] {
  const maps = buildFinancialMaps(returns, settlements, claims);
  const totals = new Map<string, SkuProfitability & { returnedUnits: number; orderCount: number; salvageRecovery: number }>();
  const empty = (sku: string, productName: string) => ({ sku, productName, unitsSold: 0, revenue: 0, cogs: 0,
    marketplaceCharges: 0, returnLosses: 0, claimRecoveries: 0, salvageRecovery: 0, profit: 0, margin: 0, returnRate: 0, returnedUnits: 0, orderCount: 0 });
  for (const order of orders) {
    const fact = asOf?getOrderFinancialFacts(order,returns,settlements,claims,asOf):financialFacts(order, returns, settlements, claims, maps);
    if (!fact.revenueRecognised && !fact.fees && !fact.returnCosts && !fact.claimRecovery) continue;
    // Original discounted line values do not change because of a later return.
    const weights = order.items.map(item => Math.max(0, sumMoney([item.lineSubtotal ?? prorateMoney(item.sellingPrice, item.quantity, 1), -item.discount])));
    const linkedSettlements = Array.from(new Map(settlements.filter(settlement => settlement.marketplace === order.marketplace &&
      [order.id, order.channelOrderId].includes(settlement.orderId) && (!asOf || settlement.settlementDate.slice(0, 10) <= asOf)).map(settlement => [settlement.id, settlement])).values());
    const actualFeeEvents = linkedSettlements.flatMap(settlement => settlementMovement(settlement, linkedSettlements).deductions)
      .filter(deduction => deduction.category !== 'TAX_TCS' && deduction.category !== 'TAX_TDS');
    // Allocate each source event separately: a later fee must not redistribute the
    // earlier event's rounding paise between SKUs.
    const fees = fact.lines.map(() => 0);
    for (const amount of actualFeeEvents.length ? actualFeeEvents.map(event => marketplaceFeeFacts(order, event).expense) : [fact.fees])
      allocateMoney(amount, weights).forEach((share, index) => fees[index] = sumMoney([fees[index], share]));
    const costs = fact.lines.map(() => 0), recoveries = fact.lines.map(() => 0), salvage = fact.lines.map(() => 0);
    const add = (target: number[], amount: number, allocationWeights: number[]) => {
      const shares = allocateMoney(amount, allocationWeights.some(Boolean) ? allocationWeights : weights);
      shares.forEach((share, index) => target[index] = sumMoney([target[index], share]));
    };
    const boundedReturns = fact.returnDetails.map(detail => ({ ...detail.record, quantity: detail.returnedUnits }));
    const claimAllocations = returnClaimAllocations(order, boundedReturns, claims, asOf);
    let allocatedClaimRecovery = 0;
    fact.returnDetails.forEach(detail => {
      add(costs, detail.returnCosts, detail.unitsByLine);
      add(salvage, detail.salvageValue, detail.unitsByLine.map((units, index) => prorateMoney(fact.lines[index].unitCost, units, 1)));
      const recovery = sumMoney((claimAllocations.get(detail.record.id) || []).map(allocation => allocation.recovered));
      add(recoveries, recovery, detail.unitsByLine);
      allocatedClaimRecovery = sumMoney([allocatedClaimRecovery, recovery]);
    });
    // Fee disputes and other order-wide claims may have no physical return.
    add(recoveries, sumMoney([fact.claimRecovery, -allocatedClaimRecovery]), weights);
    const shipping = allocateMoney(fact.shippingRevenue, weights);
    const seenSkus = new Set<string>();
    fact.lines.forEach((line, index) => {
      const current = totals.get(line.sku) || empty(line.sku, line.productName);
      current.unitsSold += line.quantity; current.revenue = sumMoney([current.revenue, line.netSales, shipping[index]]);
      current.cogs = sumMoney([current.cogs, line.cogs]); current.marketplaceCharges = sumMoney([current.marketplaceCharges, fees[index]]);
      current.returnLosses = sumMoney([current.returnLosses, costs[index]]); current.claimRecoveries = sumMoney([current.claimRecoveries, recoveries[index]]);
      current.salvageRecovery = sumMoney([current.salvageRecovery, salvage[index]]);
      current.returnedUnits += line.returnedUnits;
      if (fact.revenueRecognised && !seenSkus.has(line.sku)) current.orderCount++;
      seenSkus.add(line.sku); totals.set(line.sku, current);
    });
  }
  const adExpenses = expenses.filter(expense => expense.category === "Advertising" && expense.attributedSku && (!asOf || expense.date.slice(0, 10) <= asOf));
  adExpenses.forEach(expense => {
    if (!totals.has(expense.attributedSku!)) totals.set(expense.attributedSku!, empty(expense.attributedSku!, expense.attributedSku!));
  });
  return Array.from(totals.values()).map(sku => {
    const profit = sumMoney([sku.revenue, -sku.cogs, -sku.marketplaceCharges, -sku.returnLosses, sku.claimRecoveries, sku.salvageRecovery]);
    const adSpend = sumMoney(adExpenses.filter(expense => expense.attributedSku === sku.sku).map(expense => expense.amount));
    return { ...sku, profit, margin: sku.revenue > 0 ? profit / sku.revenue : 0, returnRate: sku.unitsSold > 0 ? Math.min(1, sku.returnedUnits / sku.unitsSold) : 0,
      adSpend: adSpend || undefined, poas: adSpend > 0 ? profit / adSpend : undefined };
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
  claims: Claim[] = [],
  settlements: Settlement[] = [],
  allReturns: ReturnRecord[] = [r]
): ReturnFinancials {
  // 1. Determine Product Unit Cost from Order snapshot or Catalog
  const order = orders.find(
    (o) => o.marketplace === r.marketplace && (o.id === r.orderId || o.channelOrderId === r.orderId || (r.channelOrderId && o.channelOrderId === r.channelOrderId))
  );
  const orderItem = order?.items.find((i) => i.sku === r.sku && (!r.orderItemId || i.id === r.orderItemId));
  const matchedProduct = products.find((p) => p.sku === r.sku);
  const fallbackUnitCost = orderItem?.snapshotUnitCost ?? matchedProduct?.currentCostPrice ?? 0;
  const orderFacts = order ? getOrderFinancialFacts(order, allReturns, settlements, claims) : null;
  const costFacts = orderFacts?.returnDetails.find(detail => detail.record.id === r.id)
    || getReturnCostFacts(r, prorateMoney(fallbackUnitCost, r.quantity, 1));
  const { productCost, isDamaged, salvageValue, customerReturnFee, returnShippingCost, damageLoss, baseLoss } = costFacts;
  const coveredUnits = orderFacts?.returnDetails.find(detail => detail.record.id === r.id)?.returnedUnits ?? r.quantity;
  const unitCost = coveredUnits > 0 ? money(productCost / coveredUnits) : fallbackUnitCost;

  // 5. Match Linked Claim
  const attributed=returnClaimAllocations(order,orderFacts ? orderFacts.returnDetails.map(detail => ({ ...detail.record, quantity: detail.returnedUnits })) : allReturns,claims).get(r.id)||[];
  const claim=attributed[0]?.claim;

  // 6. Reimbursement & Claim Amount
  const amountClaimed = attributed.length ? sumMoney(attributed.map(a=>a.claimed)) : (isDamaged ? baseLoss : 0);
  const reimbursementAmount = sumMoney(attributed.map(a=>a.recovered));

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
  const netFinancialImpact = money((baseLoss - reimbursementAmount));
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
  anchorDateStr: string = businessDate(),
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
export function calculatePercentageChange(current: number, previous: number, metric: "AMOUNT" | "RATIO" = "AMOUNT"): number {
  if (metric === "RATIO") return money((current - previous) * 100);
  if (previous === 0) return current > 0 ? 100 : (current < 0 ? -100 : 0);
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 10) / 10;
}

export interface SettlementAgingBracket {
  rangeLabel: string; // "0–7 Days", "8–14 Days", "> 14 Days (Overdue)"
  orderCount: number;
  totalEstimatedAmount: number | null;
  unknownAmountOrders: number;
  statusType: "ON_SCHEDULE" | "PENDING" | "OVERDUE";
  orders: {
    orderId: string;
    channelOrderId: string;
    marketplace: Marketplace;
    orderDate: string;
    daysOutstanding: number;
    estimatedPayout: number | null;
  }[];
}

export interface SettlementAgingSummary {
  onSchedule: SettlementAgingBracket; // 0-7 days
  pending: SettlementAgingBracket;    // 8-14 days
  overdue: SettlementAgingBracket;    // >14 days
  totalOutstandingAmount: number | null;
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
  anchorDateStr: string = businessDate(),
  returns: ReturnRecord[] = [],
  claims: Claim[] = []
): SettlementAgingSummary {
  const anchor = new Date(anchorDateStr);
  const unsettled = orders.filter(order => {
    const fact = getOrderFinancialFacts(order, returns, settlements, claims, anchorDateStr);
    const outstanding = fact.outstanding;
    return fact.revenueRecognised && (outstanding === null || outstanding > 0) && Number.isFinite(Date.parse(order.revenueRecognisedDate || order.orderDate)) && (order.revenueRecognisedDate || order.orderDate).slice(0, 10) <= anchorDateStr;
  });

  const onScheduleList: SettlementAgingBracket["orders"] = [];
  const pendingList: SettlementAgingBracket["orders"] = [];
  const overdueList: SettlementAgingBracket["orders"] = [];

  unsettled.forEach((o) => {
    const orderDate = new Date((o.revenueRecognisedDate || o.orderDate).slice(0, 10));
    const diffTime = Math.max(0, anchor.getTime() - orderDate.getTime());
    const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const estimatedPayout = getOrderFinancialFacts(o, returns, settlements, claims, anchorDateStr).outstanding;

    const entry = {
      orderId: o.id,
      channelOrderId: o.channelOrderId,
      marketplace: o.marketplace,
      orderDate: o.orderDate,
      daysOutstanding,
      estimatedPayout,
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
    list.some(item => item.estimatedPayout === null) ? null : sumMoney(list.map(item => item.estimatedPayout!));

  const onSchedule: SettlementAgingBracket = {
    rangeLabel: "0–7 Days (Cycle Safe)",
    orderCount: onScheduleList.length,
    totalEstimatedAmount: sumAmount(onScheduleList),
    unknownAmountOrders: onScheduleList.filter(item => item.estimatedPayout === null).length,
    statusType: "ON_SCHEDULE",
    orders: onScheduleList,
  };

  const pending: SettlementAgingBracket = {
    rangeLabel: "8–14 Days (Pending)",
    orderCount: pendingList.length,
    totalEstimatedAmount: sumAmount(pendingList),
    unknownAmountOrders: pendingList.filter(item => item.estimatedPayout === null).length,
    statusType: "PENDING",
    orders: pendingList,
  };

  const overdue: SettlementAgingBracket = {
    rangeLabel: "> 14 Days (Overdue)",
    orderCount: overdueList.length,
    totalEstimatedAmount: sumAmount(overdueList),
    unknownAmountOrders: overdueList.filter(item => item.estimatedPayout === null).length,
    statusType: "OVERDUE",
    orders: overdueList,
  };

  return {
    onSchedule,
    pending,
    overdue,
    totalOutstandingAmount: [onSchedule, pending, overdue].some(bracket => bracket.totalEstimatedAmount === null) ? null : sumMoney([onSchedule.totalEstimatedAmount!, pending.totalEstimatedAmount!, overdue.totalEstimatedAmount!]),
    totalUnsettledOrders: unsettled.length,
  };
}
