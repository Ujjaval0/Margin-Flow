import { settlementMovement } from "./settlement-evidence";
import { recoveredAt,claimRecoveryEvents } from "./claim-recovery";
import { marketplaceFeeFacts, getSettlementWithholding } from "./accounting-policy";
import type { Order, ReturnRecord, Settlement, Claim } from "./types";
import { money, toPaise, sumMoney, prorateMoney } from "./money";
export { money, toPaise, sumMoney, prorateMoney } from "./money";


const recognised = new Set(["DELIVERED", "PARTIALLY_RETURNED", "RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "RTO", "CLAIM_PENDING", "CLAIM_APPROVED"]);

/** Allocate cents deterministically so line totals always equal their order total. */
export function allocateMoney(amount: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const integerWeights = weights.map(weight => BigInt(toPaise(Math.max(0, weight))));
  let total = integerWeights.reduce((sum, weight) => sum + weight, BigInt(0));
  if (!total) { integerWeights.fill(BigInt(1)); total = BigInt(weights.length); }
  const cents = BigInt(Math.abs(toPaise(amount)));
  const allocated = integerWeights.map(weight => cents * weight / total);
  const priority = integerWeights.map((weight, index) => ({ index, remainder: cents * weight % total }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  let remaining = cents - allocated.reduce((sum, value) => sum + value, BigInt(0));
  for (let i = 0; remaining > BigInt(0); remaining--, i++) allocated[priority[i].index]++;
  return allocated.map(value => Number(value) * Math.sign(amount) / 100 || 0);
}

/** The form records one fee; reimbursement belongs exclusively to the linked claim. */
export function getManualReturnCosts(unitCost: number, quantity: number, damaged: boolean, fee: number) {
  return { returnShippingCost: 0, customerReturnFee: money(fee), otherReturnCosts: 0, inventoryRecoveryValue: 0,
    lossAmount: damaged ? prorateMoney(unitCost, quantity, 1) : 0 };
}

export const isDamagedReturn = (record: ReturnRecord) =>
  ["DAMAGED", "UNUSABLE", "MISSING", "USED"].includes(record.condition) || ["DAMAGED_RETURN", "LOST_RETURN"].includes(record.returnType);

/** Shared cost policy for order, return and ledger reporting; claims are separate recoveries. */
export function getReturnCostFacts(record: ReturnRecord, productCost: number, settlementHasReturnShipping = false) {
  const isDamaged = isDamagedReturn(record);
  const salvageValue = isDamaged ? money(Math.min(productCost, Math.max(0, record.inventoryRecoveryValue || 0))) : 0;
  const damageLoss = isDamaged ? Math.max(0, sumMoney([productCost, -salvageValue])) : 0;
  const returnShippingCost = settlementHasReturnShipping ? 0 : money(record.returnShippingCost || 0);
  const customerReturnFee = money(record.customerReturnFee || 0);
  const otherReturnCosts = money(record.otherReturnCosts || 0);
  const returnCosts = sumMoney([returnShippingCost, customerReturnFee, otherReturnCosts]);
  return { isDamaged, productCost, salvageValue, damageLoss, returnShippingCost, customerReturnFee, otherReturnCosts,
    returnCosts, baseLoss: sumMoney([damageLoss, returnCosts]) };
}

/** Source facts only: estimates are never cash, and a return affects bounded units. */
export function getOrderFinancialFacts(order: Order, returns: ReturnRecord[], settlements: Settlement[], claims: Claim[], asOf?: string) {
  const matches = (record: { orderId: string; marketplace: string; channelOrderId?: string }) =>
    record.marketplace === order.marketplace && (record.orderId === order.id ||
      (!!order.channelOrderId && (record.orderId === order.channelOrderId || record.channelOrderId === order.channelOrderId)));
  const unique = <T extends { id: string }>(records: T[]) => Array.from(new Map(records.map(record => [record.id, record])).values());
  const linkedReturns = unique(returns.filter(record=>matches(record) && (!asOf || record.returnDate.slice(0,10)<=asOf))).sort((a,b)=>a.returnDate.localeCompare(b.returnDate)||a.id.localeCompare(b.id));
  const linkedSettlements = unique(settlements.filter(record=>matches(record) && (!asOf || record.settlementDate.slice(0,10)<=asOf)));
  const linkedClaims = unique(claims.filter(record=>matches(record)));
  const active = order.status !== "CANCELLED";
  const revenueRecognised = (active && recognised.has(order.status) || !!order.revenueRecognisedDate) && (!asOf || (order.revenueRecognisedDate||order.orderDate).slice(0,10)<=asOf);
  const fullReturn = ["RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "RTO"].includes(order.status);
  const remaining=order.items.map(item=>revenueRecognised?item.quantity:0);
  const attributedUnits:number[][]=linkedReturns.map(record=>{
    let count=Math.max(0,record.quantity);
    return order.items.map((item,index)=>{
      if(item.sku!==record.sku || record.orderItemId && record.orderItemId!==item.id)return 0;
      const quantity=Math.min(count,remaining[index]);count-=quantity;remaining[index]-=quantity;return quantity;
    });
  });
  const lines = order.items.map((item,index) => {
    const quantity=revenueRecognised?item.quantity:0;
    const inferred=0; // Undated status/quantity is unresolved evidence, never a fabricated refund event.
    const returnedUnits=inferred+attributedUnits.reduce((sum,units)=>sum+units[index],0);
    const goodUnits=linkedReturns.reduce((sum,record,r)=>sum+(record.condition==='SELLABLE' && record.restockStatus==='RESTOCKED' && !isDamagedReturn(record) && !!record.receivedDate && (!asOf || record.receivedDate.slice(0,10)<=asOf)?attributedUnits[r][index]:0),0);
    const damagedUnits=linkedReturns.reduce((sum,record,r)=>sum+(isDamagedReturn(record)?attributedUnits[r][index]:0),0)+(order.status==='DAMAGED_RETURN'?inferred:0);
    const rtoUnits=linkedReturns.reduce((sum,record,r)=>sum+(record.returnType==='RTO'?attributedUnits[r][index]:0),0)+(order.status==='RTO'?inferred:0);
    const gross=quantity?(item.lineSubtotal!==undefined?money(item.lineSubtotal):prorateMoney(item.sellingPrice,quantity,1)):0;
    const discount=quantity?money(Math.min(gross,Math.max(0,item.discount||0))):0;
    const refunded=quantity?prorateMoney(sumMoney([gross,-discount]),returnedUnits,quantity):0;
    const totalTax=quantity?money(item.taxAmount||0):0;
    const refundedTax=quantity?prorateMoney(totalTax,returnedUnits,quantity):0;
    const retainedTax=sumMoney([totalTax,-refundedTax]);
    return {sku:item.sku,productName:item.productName,quantity,gross,discount,refunded,
      netSales:sumMoney([gross,-discount,-refunded,order.pricesIncludeTax===true?-retainedTax:0]),
      returnedUnits,goodUnits,damagedUnits,rtoUnits,retainedTax,refundedTax,totalTax,
      unitCost:item.snapshotUnitCost,dispatchedCogs:prorateMoney(item.snapshotUnitCost,quantity,1),
      cogs:prorateMoney(item.snapshotUnitCost,quantity-goodUnits,1),damageLoss:prorateMoney(item.snapshotUnitCost,damagedUnits,1)};
  });
  const sum = (key: "gross" | "discount" | "refunded" | "netSales" | "cogs" | "quantity" | "returnedUnits" | "damagedUnits" | "rtoUnits" | "damageLoss" | "dispatchedCogs" | "retainedTax" | "refundedTax" | "totalTax") => sumMoney(lines.map(line => line[key]));
  const movements=linkedSettlements.map(s=>settlementMovement(s,linkedSettlements));
  const deductions = movements.flatMap(settlement => settlement.deductions || []);
  const feeDeductions = deductions.filter(deduction => deduction.category !== "TAX_TCS" && deduction.category !== "TAX_TDS");
  const feeStatus = feeDeductions.length ? "ACTUAL" : order.feeEstimateStatus === "CONFIGURED" ? "ESTIMATE" : order.feeEstimateStatus === "LEGACY" || (!order.feeEstimateStatus && order.marketplaceChargesEstimate > 0) ? "LEGACY" : "UNKNOWN";
  const actualFees = feeDeductions.map(deduction => ({ deduction, ...marketplaceFeeFacts(order, deduction) }));
  const cashFees = actualFees.length ? sumMoney(actualFees.map(fee => fee.cash))
    : revenueRecognised && (feeStatus === "ESTIMATE" || feeStatus === "LEGACY") ? money(order.marketplaceChargesEstimate || 0) : 0;
  const provisionalFeeInputCredit = actualFees.length ? sumMoney(actualFees.map(fee => fee.provisionalInputCredit))
    : 0;
  const fees = sumMoney([cashFees, -provisionalFeeInputCredit]);
  const actualShippingFees = sumMoney(actualFees.filter(fee => ["LOGISTICS", "RETURN_SHIPPING"].includes(fee.deduction.category)).map(fee => fee.expense));
  const actualCommissionFees = sumMoney(actualFees.filter(fee => !["LOGISTICS", "RETURN_SHIPPING"].includes(fee.deduction.category)).map(fee => fee.expense));
  const shippingFees = sumMoney(actualFees.filter(fee => fee.deduction.category === "LOGISTICS").map(fee => fee.expense));
  const settlementHasReturnShipping = feeDeductions.some(deduction => deduction.category === "RETURN_SHIPPING");
  let returnShippingCovered=Math.max(0,sumMoney(actualFees.filter(fee=>fee.deduction.category==='RETURN_SHIPPING').map(fee=>fee.expense)));
  const returnDetails=linkedReturns.map((record,index)=>{
    const productCost=sumMoney(attributedUnits[index].map((units,i)=>prorateMoney(lines[i].unitCost,units,1)));
    const coveredUnits=attributedUnits[index].reduce((sum,units)=>sum+units,0);
    const coveredShipping=Math.min(returnShippingCovered,record.returnShippingCost||0);
    returnShippingCovered=sumMoney([returnShippingCovered,-coveredShipping]);
    const costFacts=getReturnCostFacts({...record,inventoryRecoveryValue:coveredUnits?record.inventoryRecoveryValue:0,returnShippingCost:sumMoney([record.returnShippingCost||0,-coveredShipping])},productCost,false);
    const restocked=record.condition==='SELLABLE' && record.restockStatus==='RESTOCKED' && !costFacts.isDamaged && !!record.receivedDate && (!asOf || record.receivedDate.slice(0,10)<=asOf);
    return {record,...costFacts,unitsByLine:attributedUnits[index],returnedUnits:coveredUnits,restockedCost:restocked?productCost:0,damagedCost:costFacts.isDamaged?productCost:0,refundedRevenue:0,refundedTax:0};
  });
  lines.forEach((line, lineIndex) => {
    const weights = attributedUnits.map(units => units[lineIndex]);
    if (!weights.some(Boolean)) return; // Status-only returns receive an explicitly dated fallback journal.
    let prefix=0;
    const refunds=weights.map(units=>{const before=prefix;prefix+=units;return sumMoney([
      prorateMoney(sumMoney([line.gross,-line.discount]),prefix,line.quantity),
      -prorateMoney(sumMoney([line.gross,-line.discount]),before,line.quantity),
      order.pricesIncludeTax?-prorateMoney(line.totalTax,prefix,line.quantity):0,
      order.pricesIncludeTax?prorateMoney(line.totalTax,before,line.quantity):0]);});
    prefix=0;
    const taxRefunds=weights.map(units=>{const before=prefix;prefix+=units;return sumMoney([prorateMoney(line.totalTax,prefix,line.quantity),-prorateMoney(line.totalTax,before,line.quantity)]);});
    returnDetails.forEach((detail, index) => {
      detail.refundedRevenue = sumMoney([detail.refundedRevenue, refunds[index]]);
      detail.refundedTax = sumMoney([detail.refundedTax, taxRefunds[index]]);
    });
  });
  const returnCosts = sumMoney(returnDetails.map(detail => detail.returnCosts));
  const salvageRecovery = revenueRecognised ? sumMoney(returnDetails.map(detail => detail.salvageValue)) : 0;
  const claimRecovery = sumMoney(linkedClaims.map(claim => recoveredAt(claim,asOf)));
  const cash = sumMoney(linkedSettlements.filter(settlement => settlement.evidenceType !== "FINANCIAL_EVENT").map(settlement => settlement.netSettlement));
  const statutoryWithholding = sumMoney(movements.map(getSettlementWithholding));
  const netSales = sum("netSales");
  const cogs = sum("cogs");
  const retainedTax = sum("retainedTax");
  const shippingRefund=order.shippingRefundDate && (!asOf || order.shippingRefundDate.slice(0,10)<=asOf)?order.shippingRefundAmount||0:0;
  const shippingCash = revenueRecognised ? Math.max(0, sumMoney([order.shippingFeeCharged || 0, -shippingRefund])) : 0;
  const shippingOnlyTax = order.shippingFeeCharged > 0 ? prorateMoney(order.shippingTaxAmount || 0, toPaise(shippingCash), toPaise(order.shippingFeeCharged)) : 0;
  const shippingTax=sumMoney([shippingOnlyTax,revenueRecognised?order.customerChargesTax||0:0]); const shippingRevenue = sumMoney([shippingCash, -shippingOnlyTax, revenueRecognised?order.customerCharges||0:0]);
  const issues:string[]=[];
  if(order.sourceEvidenceStatus==='UNRESOLVED_PARENT')issues.push('Settlement parent invoice unresolved');
  if(!linkedReturns.length && (fullReturn || order.items.some(item=>item.returnedQuantity>0)))issues.push('Return quantities have no dated return evidence');
  if(claims.some(claim=>matches(claim) && claim.amountRecovered>0 && !claimRecoveryEvents(claim).length))issues.push('Claim recovery date unresolved');
  if(revenueRecognised && order.items.some(item=>item.costEvidence==='UNKNOWN' || !item.snapshotUnitCost && item.costEvidence!=='RECORDED'))issues.push('Historical cost unresolved');
  if(revenueRecognised && !order.revenueRecognisedDate)issues.push('Recognition date unverified');
  if(order.settlementAmount!==undefined && !linkedSettlements.length)issues.push('Legacy receipt has no dated payment evidence');
  if(order.shippingRefundAmount && !order.shippingRefundDate)issues.push('Shipping refund date unresolved');
  if(linkedReturns.some(r=>r.restockStatus==='RESTOCKED' && !r.receivedDate))issues.push('Restock receipt date unresolved');
  const feeCoverageKnown=linkedSettlements.every(s=>!s.deductions.length || s.feeCoverage==='COMPLETE' || s.evidenceType==='FINANCIAL_EVENT' && linkedSettlements.some(bank=>bank.evidenceType!=='FINANCIAL_EVENT' && bank.feeCoverage==='COMPLETE' && bank.financialEventIds?.includes(s.id)));
  if(!feeCoverageKnown)issues.push('Actual fee coverage incomplete');
  const taxBasisKnown = order.taxEvidenceStatus!=="UNKNOWN" && (sum("totalTax") === 0 || order.pricesIncludeTax !== undefined);
  if(!taxBasisKnown)issues.push('Price tax basis unresolved');
  const expectedPayout = !revenueRecognised ? null : !taxBasisKnown || !feeCoverageKnown ? null : feeStatus === "ACTUAL" || feeStatus === "ESTIMATE"
    ? sumMoney([netSales, retainedTax, shippingRevenue, shippingTax, -cashFees, -returnCosts, claimRecovery]) : null;
  return { taxIncludedInGross:order.pricesIncludeTax===true, issues, isComplete:issues.length===0 && taxBasisKnown && feeStatus!=="UNKNOWN", active, revenueRecognised, lines, grossSales: sum("gross"), discounts: sum("discount"), refundedSales: sum("refunded"), netSales, cogs,
    grossProfit: sumMoney([netSales, shippingRevenue, -cogs]), shippingRevenue, shippingTax, salvageRecovery, retainedTax, refundedTax: sum("refundedTax"), totalTax: sum("totalTax"), dispatchedCogs: sum("dispatchedCogs"),
    revenueBeforeReturns: sumMoney([sum("gross"), -sum("discount"), order.pricesIncludeTax ? -sum("totalTax") : 0]),
    refundedRevenue: sumMoney([sum("refunded"), order.pricesIncludeTax ? -sum("refundedTax") : 0]), returnDetails, settlementHasReturnShipping, fees, cashFees, taxBasisKnown, provisionalFeeInputCredit, actualShippingFees, actualCommissionFees, feeStatus, expectedPayout, shippingFees, returnCosts, claimRecovery, cash,
    outstanding: expectedPayout === null ? null : Math.max(0, sumMoney([expectedPayout, -cash, -statutoryWithholding])),
    contributionProfit: sumMoney([netSales, shippingRevenue, -cogs, -fees, -returnCosts, claimRecovery, salvageRecovery]),
    units: sum("quantity"), returnedUnits: sum("returnedUnits"), damagedUnits: sum("damagedUnits"), rtoUnits: sum("rtoUnits"), damagedCost: sum("damageLoss"),
    damageLoss: sumMoney([sum("damageLoss"), -sumMoney(returnDetails.filter(detail => detail.isDamaged).map(detail => Math.min(detail.productCost, detail.salvageValue)))]),
    isSettled: linkedSettlements.some(settlement => settlement.evidenceType !== "FINANCIAL_EVENT"), linkedReturns,
  };
}
