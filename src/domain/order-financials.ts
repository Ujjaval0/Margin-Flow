import { Order, ReturnRecord, Settlement, Claim } from "./types";

export const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const recognised = new Set(["DELIVERED", "PARTIALLY_RETURNED", "RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "RTO", "CLAIM_PENDING", "CLAIM_APPROVED"]);

/** Allocate cents deterministically so line totals always equal their order total. */
export function allocateMoney(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (!weights.length) return [];
  const cents = Math.round(Math.abs(amount) * 100);
  const raw = weights.map(weight => cents * (total ? Math.max(0, weight) / total : 1 / weights.length));
  const allocated = raw.map(Math.floor);
  const priority = raw.map((value, index) => ({ index, remainder: value - allocated[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let remaining = cents - allocated.reduce((sum, value) => sum + value, 0), i = 0; remaining > 0; remaining--, i++) allocated[priority[i % priority.length].index]++;
  return allocated.map(value => Math.sign(amount) * value / 100);
}

/** Source facts only: estimates are never cash, and a return affects bounded units. */
export function getOrderFinancialFacts(order: Order, returns: ReturnRecord[], settlements: Settlement[], claims: Claim[]) {
  const matches = (record: { orderId: string; marketplace: string; channelOrderId?: string }) =>
    record.marketplace === order.marketplace && (record.orderId === order.id ||
      (!!order.channelOrderId && (record.orderId === order.channelOrderId || record.channelOrderId === order.channelOrderId)));
  const unique = <T extends { id: string }>(records: T[]) => Array.from(new Map(records.map(record => [record.id, record])).values());
  const linkedReturns = unique(returns.filter(matches));
  const linkedSettlements = unique(settlements.filter(matches));
  const linkedClaims = unique(claims.filter(matches));
  const active = order.status !== "CANCELLED";
  const revenueRecognised = active && recognised.has(order.status);
  const fullReturn = ["RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "RTO", "CLAIM_PENDING", "CLAIM_APPROVED"].includes(order.status);
  const budgets = new Map<string, { returned: number; good: number; damaged: number; rto: number }>();
  for (const item of order.items) {
    if (budgets.has(item.sku)) continue;
    const records = linkedReturns.filter(record => record.sku === item.sku);
    const damaged = (record: ReturnRecord) => ["DAMAGED", "UNUSABLE", "MISSING", "USED"].includes(record.condition) || record.returnType === "DAMAGED_RETURN" || record.returnType === "LOST_RETURN";
    const sum = (list: ReturnRecord[]) => list.reduce((value, record) => value + Math.max(0, record.quantity), 0);
    const sourceQuantity = order.items.filter(line => line.sku === item.sku).reduce((value, line) => value + Math.max(0, line.returnedQuantity || 0), 0);
    const quantity = order.items.filter(line => line.sku === item.sku).reduce((value, line) => value + line.quantity, 0);
    const returned = records.length ? sum(records) : sourceQuantity || (fullReturn && !linkedReturns.length ? quantity : 0);
    const statusDamaged = ["DAMAGED_RETURN", "CLAIM_PENDING", "CLAIM_APPROVED"].includes(order.status);
    budgets.set(item.sku, {
      returned,
      good: records.length ? sum(records.filter(record => record.condition === "SELLABLE" && !damaged(record))) : statusDamaged ? 0 : returned,
      damaged: records.length ? sum(records.filter(damaged)) : statusDamaged ? returned : 0,
      rto: records.length ? sum(records.filter(record => record.returnType === "RTO")) : order.status === "RTO" ? returned : 0,
    });
  }
  const lines = order.items.map(item => {
    const budget = budgets.get(item.sku)!;
    const quantity = revenueRecognised ? item.quantity : 0;
    const returnedUnits = Math.min(quantity, budget.returned);
    const goodUnits = Math.min(returnedUnits, budget.good);
    const damagedUnits = Math.min(returnedUnits - goodUnits, budget.damaged);
    const rtoUnits = Math.min(returnedUnits, budget.rto);
    budget.returned -= returnedUnits; budget.good -= goodUnits; budget.damaged -= damagedUnits; budget.rto -= rtoUnits;
    const gross = money(item.sellingPrice * quantity);
    const discount = revenueRecognised ? Math.min(gross, Math.max(0, item.discount || 0)) : 0;
    const refunded = quantity ? money((gross - discount) * returnedUnits / quantity) : 0;
    return { sku: item.sku, productName: item.productName, quantity, gross, discount, refunded,
      netSales: money(gross - discount - refunded), returnedUnits, damagedUnits, rtoUnits,
      cogs: money(item.snapshotUnitCost * (quantity - goodUnits)), damageLoss: money(item.snapshotUnitCost * damagedUnits) };
  });
  const sum = (key: "gross" | "discount" | "refunded" | "netSales" | "cogs" | "quantity" | "returnedUnits" | "damagedUnits" | "rtoUnits" | "damageLoss") => money(lines.reduce((value, line) => value + line[key], 0));
  const deductions = linkedSettlements.flatMap(settlement => settlement.deductions || []);
  const feeDeductions = deductions.filter(deduction => deduction.category !== "TAX_TCS" && deduction.category !== "TAX_TDS");
  const fees = revenueRecognised ? money(feeDeductions.length ? feeDeductions.reduce((value, deduction) => value + deduction.amount, 0) : order.marketplaceChargesEstimate || 0) : 0;
  const shippingFees = revenueRecognised ? money(feeDeductions.filter(deduction => deduction.category === "LOGISTICS").reduce((value, deduction) => value + deduction.amount, 0)) : 0;
  const returnCosts = active ? money(linkedReturns.reduce((value, record) => value + (record.customerReturnFee || 0) + (record.returnShippingCost || 0) + (record.otherReturnCosts || 0), 0)) : 0;
  const claimRecovery = active ? money(linkedClaims.filter(claim => ["APPROVED", "RECOVERED", "PARTIALLY_RECOVERED"].includes(claim.status)).reduce((value, claim) => value + claim.amountRecovered, 0)) : 0;
  const cash = active ? money(linkedSettlements.length ? linkedSettlements.reduce((value, settlement) => value + settlement.netSettlement, 0) : order.settlementAmount ?? 0) : 0;
  const netSales = sum("netSales");
  const cogs = sum("cogs");
  const retainedTax = revenueRecognised ? order.items.reduce((value, item, index) => value + (item.taxAmount || 0) * (item.quantity ? (item.quantity - lines[index].returnedUnits) / item.quantity : 0), 0) : 0;
  const expectedPayout = revenueRecognised ? money(netSales + retainedTax + (netSales > 0 ? order.shippingFeeCharged || 0 : 0) - fees) : 0;
  return { active, revenueRecognised, lines, grossSales: sum("gross"), discounts: sum("discount"), refundedSales: sum("refunded"), netSales, cogs,
    grossProfit: money(netSales - cogs), fees, shippingFees, returnCosts, claimRecovery, cash,
    outstanding: Math.max(0, money(expectedPayout - cash)),
    contributionProfit: money(netSales - cogs - fees - returnCosts + claimRecovery),
    units: sum("quantity"), returnedUnits: sum("returnedUnits"), damagedUnits: sum("damagedUnits"), rtoUnits: sum("rtoUnits"), damageLoss: sum("damageLoss"),
    isSettled: active && (linkedSettlements.length > 0 || order.settlementAmount !== undefined), linkedReturns,
  };
}
