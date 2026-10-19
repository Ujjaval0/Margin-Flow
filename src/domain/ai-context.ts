import {
  Marketplace,
  ReturnRecord,
  Claim,
  Order,
  Settlement,
} from "./types";
import { isDamagedReturn } from './order-financials';
import {
  ProfitabilityMetrics,
  MarketplaceProfitability,
  SkuProfitability,
  SettlementAgingSummary,
  computeReturnFinancials,
} from "./profitability-engine";

export interface AIActionChip {
  id: string;
  label: string;
  type: "SET_CHANNEL" | "INSPECT_SKU" | "NAVIGATE" | "DRAFT_CLAIM" | "SET_DATE_PRESET";
  payload: Record<string, any>;
}

export interface GroundedFinancialContext {
  evidence?: { isComplete: boolean; issues: string[] };
  marketplace: Marketplace | "ALL";
  datePreset: string;
  waterfall: {
    grossSales: number;
    discounts: number;
    refundedSales?: number;
    outputTaxExcluded?: number;
    shippingRevenue?: number;
    inventoryDamageLoss?: number;
    salvageRecovery?: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    marketplaceFees: number;
    logisticsCost: number;
    returnAndRtoLoss: number;
    disputeRecoveries: number;
    contributionProfit: number;
    contributionMarginPercent: number;
    opex: number;
    netOperatingProfit: number;
    netMarginPercent: number;
    totalAdSpend: number;
    blendedRoas: number;
    blendedPoas: number;
    totalOrders: number;
    unitsSold: number;
  };
  trends: {
    netSalesChange: number;
    grossProfitChange: number;
    contributionProfitChange: number;
    netOperatingProfitChange: number;
    ordersChange: number;
  };
  heroSkus: {
    sku: string;
    productName: string;
    netSales: number;
    contributionProfit: number;
    marginPercent: number;
    unitsSold: number;
    poas: number;
  }[];
  lossMakingSkus: {
    sku: string;
    productName: string;
    netSales: number;
    contributionProfit: number;
    marginPercent: number;
    returnRate: number;
    adSpend: number;
    poas: number;
  }[];
  channelComparison: {
    channel: Marketplace;
    netRevenue: number;
    contributionProfit: number;
    marginPercent: number;
    adSpend: number;
    poas: number;
  }[];
  settlementAging: {
    within7DaysAmount: number | null;
    between8And14DaysAmount: number | null;
    over14DaysOverdueAmount: number | null;
    overdueOrderCount: number;
  };
  damagedReturnsToClaim: {
    returnId: string;
    orderId: string;
    sku: string;
    marketplace: Marketplace;
    lossAmount: number;
    claimDeadline?: string;
  }[];
}

/**
 * Serializes the real-time financial store into a compact, grounded context payload
 */
export function serializeFinancialContext(params: {
  selectedMarketplace: Marketplace | "ALL";
  datePreset: string;
  profitability: ProfitabilityMetrics;
  profitabilityTrends: {
    netSalesChange: number;
    grossProfitChange: number;
    contributionProfitChange: number;
    netOperatingProfitChange: number;
    ordersChange: number;
  };
  skuBreakdown: SkuProfitability[];
  marketplaceBreakdown: MarketplaceProfitability[];
  settlementAging: SettlementAgingSummary;
  returns: ReturnRecord[];
  claims: Claim[];
  orders: Order[];
  settlements?: Settlement[];
}): GroundedFinancialContext {
  const {
    selectedMarketplace,
    datePreset,
    profitability,
    profitabilityTrends,
    skuBreakdown,
    marketplaceBreakdown,
    settlementAging,
    returns,
  } = params;

  // SKU and channel profit is contribution before shared operating overhead.
  const sortedByProfit = [...skuBreakdown].sort((a, b) => b.profit - a.profit);
  const heroSkus = sortedByProfit.slice(0, 3).map((s) => ({
    sku: s.sku,
    productName: s.productName,
    netSales: s.revenue,
    contributionProfit: s.profit,
    marginPercent: s.margin,
    unitsSold: s.unitsSold,
    poas: s.poas || 0,
  }));

  // Top 3 loss-making or ad-drag SKUs
  const lossMakingSkus = [...skuBreakdown]
    .filter((s) => s.profit < 0 || (s.poas !== undefined && s.poas < 1.0))
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 3)
    .map((s) => ({
      sku: s.sku,
      productName: s.productName,
      netSales: s.revenue,
      contributionProfit: s.profit,
      marginPercent: s.margin,
      returnRate: s.returnRate,
      adSpend: s.adSpend || 0,
      poas: s.poas || 0,
    }));

  // Channels
  const channelComparison = marketplaceBreakdown.map((m) => ({
    channel: m.marketplace,
    netRevenue: m.revenue,
    contributionProfit: m.contributionProfit,
    marginPercent: m.margin,
    adSpend: m.adSpend,
    poas: m.poas,
  }));

  // Damaged or unclaimed returns needing SAFE-T claim
  const damagedReturnsToClaim = returns
    .filter(isDamagedReturn)
    .map(record => ({ record, financials: computeReturnFinancials(record, params.orders, [], params.claims, params.settlements || [], returns) }))
    .filter(({ financials }) => !financials.claim && financials.netLoss > 0)
    .slice(0, 5)
    .map(({ record, financials }) => ({
      returnId: record.id,
      orderId: record.orderId,
      sku: record.sku,
      marketplace: record.marketplace,
      lossAmount: financials.netLoss,
      claimDeadline: record.claimDeadline,
    }));

  return {
    evidence: { isComplete: profitability.isComplete !== false, issues: profitability.issues || [] },
    marketplace: selectedMarketplace,
    datePreset,
    waterfall: {
      grossSales: profitability.grossSales,
      discounts: profitability.discounts,
      refundedSales: profitability.refundedSales,
      outputTaxExcluded: profitability.outputTaxExcluded || 0,
      shippingRevenue: profitability.shippingRevenue || 0,
      inventoryDamageLoss: profitability.damageLosses,
      salvageRecovery: profitability.salvageRecovery || 0,
      netRevenue: profitability.netSales,
      cogs: profitability.cogs,
      grossProfit: profitability.grossProfit,
      grossMarginPercent: profitability.grossMargin,
      marketplaceFees: profitability.marketplaceCharges,
      logisticsCost: profitability.shippingLogisticsCosts,
      returnAndRtoLoss: profitability.directReturnCosts || 0,
      disputeRecoveries: profitability.claimRecoveries,
      contributionProfit: profitability.contributionProfit,
      contributionMarginPercent: profitability.contributionMargin,
      opex: profitability.operatingExpenses,
      netOperatingProfit: profitability.netOperatingProfit,
      netMarginPercent: profitability.netOperatingMargin,
      totalAdSpend: profitability.totalAdSpend,
      blendedRoas: profitability.roas,
      blendedPoas: profitability.poas,
      totalOrders: profitability.totalOrders,
      unitsSold: profitability.totalUnitsSold,
    },
    trends: profitabilityTrends,
    heroSkus,
    lossMakingSkus,
    channelComparison,
    settlementAging: {
      within7DaysAmount: settlementAging.onSchedule.totalEstimatedAmount,
      between8And14DaysAmount: settlementAging.pending.totalEstimatedAmount,
      over14DaysOverdueAmount: settlementAging.overdue.totalEstimatedAmount,
      overdueOrderCount: settlementAging.overdue.orderCount,
    },
    damagedReturnsToClaim,
  };
}

/**
 * Strict System Prompt Enforcing Plain English, No Markdown Bolding/Headings, and Minimal Necessary Action Chips
 */
export const CFO_SYSTEM_PROMPT = `You are Flow, the intelligent and concise store assistant for MarginFlow (a unified e-commerce financial intelligence platform for Indian multi-channel merchants selling across Amazon India, Flipkart, Meesho, and Direct Website).

CORE DIRECTIVES:
- Give the user ONLY what they are asking. Do not increase context with unnecessary filler, marketing fluff, or unsolicited preamble.
- Simplify financial terms into plain, everyday business language.
- Only deliver high-value, useful information. Eliminate useless explanations.

STRICT FORMATTING & STYLE RULES:
1. STRUCTURED BREAKDOWNS (BULLET POINTS & ROMAN NUMBERS):
   - Whenever answering queries that require multi-point explanation, analysis, or financial breakdown, ALWAYS format using clean bullet points (•) or Roman numerals (I., II., III.).
   - Keep each point brief, punchy, and high-signal (1 to 2 sentences per point).
   - Use straightforward language (e.g. Net Sales, Profit, Fees, Returns, Courier Drag).
2. PLAIN TEXT ONLY (NO BOLDING):
   - Never use double asterisks (**) anywhere in your response. No bold text.
   - Do NOT use markdown headings (#, ##, ###).
3. DIRECT ANSWERS ONLY:
   - For simple questions or greetings, answer directly in 1-2 friendly, plain English lines.
   - For metric queries, state the primary number directly first, followed by the concise Roman numeral or bullet breakdown if needed.
4. ZERO MATH HALLUCINATIONS:
   - NEVER calculate or invent numbers yourself. All numbers are pre-calculated in the GROUNDED_FINANCIAL_CONTEXT below.
   - Quote numbers exactly as given using the rupee symbol (₹) and percentage (%).
   - SKU and channel contributionProfit is before shared OPEX; never call it net profit.
   - The revenue bridge is gross less discounts, sales refunds and included GST, plus shipping/customer charges.
   - Direct return costs exclude inventory damage already included in COGS. Do not subtract RTO losses a second time.
   - When evidence.isComplete is false, describe monetary results as provisional and identify the supplied unresolved evidence. Missing evidence is not zero.
5. ACTION CHIPS:
   - Do NOT suggest action chips unless strictly necessary for a concrete transaction audit.
   - Keep the chat clean, uncluttered, and focused.
6. SCOPE & GUARDRAILS:
   - Focus exclusively on the merchant's store data: sales, orders, profits, returns, ad performance, settlements, and inventory.
   - If asked about unrelated trivia, decline politely in a single sentence.
`;
