import {
  calculateBusinessProfitability, calculateMarketplaceProfitability, calculateSkuProfitability,
  type ProfitabilityMetrics, type DateFilterRange, type MarketplaceProfitability, type SkuProfitability,
} from './profitability-engine';
import type { LedgerData } from './snapshot-validation';
import { sumMoney } from './money';
import { claimRecoveryEvents } from './claim-recovery';

export type FinancialDataset = Pick<LedgerData, 'orders' | 'returns' | 'settlements' | 'claims' | 'expenses' | 'financialIssues'>;

function retainEvidence(totals: ProfitabilityMetrics, data: FinancialDataset): ProfitabilityMetrics {
  if (!data.financialIssues?.length) return totals;
  return { ...totals, isComplete: false, issues: Array.from(new Set([...(totals.issues || []), ...data.financialIssues])) };
}

function dayBefore(date: string): string {
  const previous = new Date(date + 'T00:00:00Z');
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/** Complete parent context is retained; dated flows differ, closing balances do not. */
export function calculatePeriodProfitability(data: FinancialDataset, range?: DateFilterRange): ProfitabilityMetrics {
  if (!range) return retainEvidence(calculateBusinessProfitability(data.orders, data.returns, data.settlements, data.claims, data.expenses), data);
  const cumulative = (date: string) => calculateBusinessProfitability(data.orders, data.returns, data.settlements, data.claims, data.expenses, date);
  const end = cumulative(range.endDate), prior = cumulative(dayBefore(range.startDate)), result = { ...end };
  const flows = ['grossSales', 'discounts', 'refundedSales', 'netSales', 'cogs', 'grossProfit', 'marketplaceCharges',
    'shippingLogisticsCosts', 'customerReturnFees', 'returnLosses', 'rtoLosses', 'damageLosses', 'claimRecoveries',
    'contributionProfit', 'operatingExpenses', 'netOperatingProfit', 'actualSettlementsReceived', 'totalOrders',
    'totalUnitsSold', 'totalReturns', 'totalAdSpend', 'rtoCount', 'customerReturnCount', 'damagedUnitsCount',
    'totalFees', 'shippingRevenue', 'outputTaxExcluded', 'directReturnCosts', 'salvageRecovery'] as const;
  for (const key of flows) result[key] = sumMoney([end[key] || 0, -(prior[key] || 0)]);
  result.isComplete = end.isComplete !== false && prior.isComplete !== false;
  result.issues = Array.from(new Set([...(end.issues || []), ...(prior.issues || [])]));
  result.netPlatformPayout = result.actualSettlementsReceived;
  result.grossMargin = result.netSales > 0 ? result.grossProfit / result.netSales : 0;
  result.contributionMargin = result.netSales > 0 ? result.contributionProfit / result.netSales : 0;
  result.netOperatingMargin = result.netSales > 0 ? result.netOperatingProfit / result.netSales : 0;
  result.roas = result.totalAdSpend > 0 ? result.netSales / result.totalAdSpend : 0;
  result.poas = result.totalAdSpend > 0 ? result.contributionProfit / result.totalAdSpend : 0;
  // Return events can concern older shipments. A rate uses the same shipment
  // cohort in numerator and denominator, measured through the period end.
  const cohort = data.orders.filter(order => {
    const date = (order.revenueRecognisedDate || order.orderDate).slice(0, 10);
    return date >= range.startDate && date <= range.endDate;
  });
  const rates = calculateBusinessProfitability(cohort, data.returns, data.settlements, data.claims, [], range.endDate);
  result.returnRate = rates.returnRate;
  result.returnRateUnits = rates.returnRateUnits;
  result.returnRateDenominator = rates.returnRateDenominator;
  result.customerReturnRate = rates.customerReturnRate;
  result.rtoRate = rates.rtoRate;
  result.customerReturnRateUnits = rates.customerReturnRateUnits;
  result.rtoRateUnits = rates.rtoRateUnits;
  return retainEvidence(result, data);
}

export function periodMarketplace(data: FinancialDataset, range?: DateFilterRange): MarketplaceProfitability[] {
  if (!range) return calculateMarketplaceProfitability(data.orders, data.returns, data.settlements, data.claims, data.expenses);
  const marketplaces = Array.from(new Set([...data.orders.map(o => o.marketplace), ...data.returns.map(r => r.marketplace),
    ...data.settlements.map(s => s.marketplace), ...data.claims.map(c => c.marketplace), ...data.expenses.flatMap(e => e.marketplace ? [e.marketplace] : [])]));
  return marketplaces.map(marketplace => {
    const totals = calculatePeriodProfitability({ orders: data.orders.filter(o => o.marketplace === marketplace),
      returns: data.returns.filter(r => r.marketplace === marketplace), settlements: data.settlements.filter(s => s.marketplace === marketplace),
      claims: data.claims.filter(c => c.marketplace === marketplace), expenses: data.expenses.filter(e => e.marketplace === marketplace) }, range);
    return { marketplace, orderCount: totals.totalOrders, unitsSold: totals.totalUnitsSold, revenue: totals.netSales,
      grossSales: totals.grossSales, cogs: totals.cogs, fees: totals.marketplaceCharges, logistics: totals.shippingLogisticsCosts,
      returnLosses: totals.returnLosses, claimRecoveries: totals.claimRecoveries, contributionProfit: totals.contributionProfit,
      margin: totals.contributionMargin, returnRate: totals.returnRate, adSpend: totals.totalAdSpend, poas: totals.poas,
      actualSettlementsReceived: totals.actualSettlementsReceived, returnedUnits: totals.customerReturnCount + totals.rtoCount,
      returnRateDenominator: totals.returnRateDenominator, customerReturnRate: totals.customerReturnRate, rtoRate: totals.rtoRate };
  });
}

export function periodSku(data: FinancialDataset, range?: DateFilterRange): SkuProfitability[] {
  if (!range) return calculateSkuProfitability(data.orders, data.returns, data.settlements, data.claims, data.expenses);
  const cumulative = (date: string) => calculateSkuProfitability(data.orders, data.returns, data.settlements, data.claims, data.expenses, date);
  const before = new Map(cumulative(dayBefore(range.startDate)).map(row => [row.sku, row]));
  const cohort = data.orders.filter(order => {
    const date = (order.revenueRecognisedDate || order.orderDate).slice(0, 10);
    return date >= range.startDate && date <= range.endDate;
  });
  const cohortRates = new Map(calculateSkuProfitability(cohort, data.returns, data.settlements, data.claims, [], range.endDate).map(row => [row.sku, row.returnRate]));
  return cumulative(range.endDate).map(row => {
    const prior = before.get(row.sku), result = { ...row };
    for (const key of ['unitsSold', 'revenue', 'cogs', 'marketplaceCharges', 'returnLosses', 'claimRecoveries', 'salvageRecovery', 'profit', 'adSpend', 'returnedUnits', 'orderCount'] as const)
      result[key] = sumMoney([row[key] || 0, -(prior?.[key] || 0)]);
    result.margin = result.revenue > 0 ? result.profit / result.revenue : 0;
    result.returnRate = cohortRates.get(row.sku) || 0;
    result.poas = result.adSpend && result.adSpend > 0 ? result.profit / result.adSpend : undefined;
    return result;
  });
}

/** Monthly flows use event dates, including returns and receipts for older orders. */
export function monthlyFinancialTrend(data: FinancialDataset, range?: DateFilterRange) {
  const dates = [...data.orders.flatMap(o => [o.revenueRecognisedDate || o.orderDate, o.shippingRefundDate]), ...data.returns.flatMap(r => [r.returnDate, r.receivedDate]),
    ...data.settlements.map(s => s.settlementDate), ...data.claims.flatMap(claim => claimRecoveryEvents(claim).map(event => event.date)), ...data.expenses.map(e => e.date)]
    .filter((date): date is string => !!date && (!range || date.slice(0, 10) >= range.startDate && date.slice(0, 10) <= range.endDate));
  return Array.from(new Set(dates.map(date => date.slice(0, 7)))).sort().map(month => {
    const first = month + '-01', last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const totals = calculatePeriodProfitability(data, { startDate: range && range.startDate > first ? range.startDate : first,
      endDate: range && range.endDate < last ? range.endDate : last });
    return { month: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(first + 'T00:00:00Z')),
      sortKey: month, revenue: totals.netSales, profit: totals.netOperatingProfit, cogs: totals.cogs, ordersCount: totals.totalOrders };
  });
}
