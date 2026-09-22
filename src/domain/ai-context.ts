import {
  Marketplace,
  ReturnRecord,
  Claim,
  Order,
} from "./types";
import {
  ProfitabilityMetrics,
  MarketplaceProfitability,
  SkuProfitability,
  SettlementAgingSummary,
} from "./profitability-engine";

export interface AIActionChip {
  id: string;
  label: string;
  type: "SET_CHANNEL" | "INSPECT_SKU" | "NAVIGATE" | "DRAFT_CLAIM" | "SET_DATE_PRESET";
  payload: Record<string, any>;
}

export interface GroundedFinancialContext {
  marketplace: Marketplace | "ALL";
  datePreset: string;
  waterfall: {
    grossSales: number;
    discounts: number;
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
    netProfit: number;
    marginPercent: number;
    unitsSold: number;
    poas: number;
  }[];
  lossMakingSkus: {
    sku: string;
    productName: string;
    netSales: number;
    netProfit: number;
    marginPercent: number;
    returnRate: number;
    adSpend: number;
    poas: number;
  }[];
  channelComparison: {
    channel: Marketplace;
    grossRevenue: number;
    netProfit: number;
    marginPercent: number;
    adSpend: number;
    poas: number;
  }[];
  settlementAging: {
    within7DaysAmount: number;
    between8And14DaysAmount: number;
    over14DaysOverdueAmount: number;
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

  // Top 3 hero SKUs by net profit
  const sortedByProfit = [...skuBreakdown].sort((a, b) => b.profit - a.profit);
  const heroSkus = sortedByProfit.slice(0, 3).map((s) => ({
    sku: s.sku,
    productName: s.productName,
    netSales: s.revenue,
    netProfit: s.profit,
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
      netProfit: s.profit,
      marginPercent: s.margin,
      returnRate: s.returnRate,
      adSpend: s.adSpend || 0,
      poas: s.poas || 0,
    }));

  // Channels
  const channelComparison = marketplaceBreakdown.map((m) => ({
    channel: m.marketplace,
    grossRevenue: m.revenue,
    netProfit: m.contributionProfit,
    marginPercent: m.margin,
    adSpend: m.adSpend,
    poas: m.poas,
  }));

  // Damaged or unclaimed returns needing SAFE-T claim
  const damagedReturnsToClaim = returns
    .filter((r) => (r.condition === "DAMAGED" || r.returnType === "DAMAGED_RETURN") && !r.claimId)
    .slice(0, 5)
    .map((r) => ({
      returnId: r.id,
      orderId: r.orderId,
      sku: r.sku,
      marketplace: r.marketplace,
      lossAmount: r.lossAmount,
      claimDeadline: r.claimDeadline,
    }));

  return {
    marketplace: selectedMarketplace,
    datePreset,
    waterfall: {
      grossSales: profitability.grossSales,
      discounts: profitability.discounts,
      netRevenue: profitability.netSales,
      cogs: profitability.cogs,
      grossProfit: profitability.grossProfit,
      grossMarginPercent: profitability.grossMargin,
      marketplaceFees: profitability.marketplaceCharges,
      logisticsCost: profitability.shippingLogisticsCosts,
      returnAndRtoLoss: profitability.returnLosses + profitability.rtoLosses,
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
 * Strict System Prompt Enforcing Claude-Like Helpful Persona, Data-Only Scope & Non-Negotiable Guardrails
 */
export const CFO_SYSTEM_PROMPT = `You are Flow, the thoughtful, articulate, and helpful store assistant for MarginFlow (a unified e-commerce financial intelligence platform for Indian multi-channel merchants selling across Amazon India, Flipkart, Meesho, and Direct Website).

Your personality is inspired by Claude: warm, poised, courteous, intellectually disciplined, and deeply helpful. You communicate with clarity, respect, and calm confidence.

CORE SCOPE & DATA BOUNDARIES:
- You exist exclusively to assist the merchant with their store and business data: sales revenue, orders, product unit economics, profit margins (Gross, Contribution, Net), customer returns, RTO losses, SAFE-T claims, marketplace settlement reconciliations, inventory levels, advertising efficiency (POAS vs ROAS), and wholesale supplier costs.
- Always talk warmly, nicely, and professionally, keeping every discussion grounded in the store data provided in GROUNDED_FINANCIAL_CONTEXT.

STRICT GUARDRAILS:
1. STRICTLY NO MOVIES, MUSIC, OR ENTERTAINMENT:
   - Do NOT engage in discussions about movies, actors, music, songs, lyrics, celebrity gossip, gaming, or general trivia.
   - If the user asks about movies, music, entertainment, or unrelated topics, decline warmly, gracefully, and politely, redirecting to their business data. Example:
     "I'm dedicated exclusively as your store assistant to help you understand and manage your MarginFlow data—such as your sales, profit margins, orders, returns, and inventory. Let me know what you'd like to explore in your numbers!"
2. STRICTLY NO EXPLICIT OR HARMFUL CONTENT:
   - Do NOT answer or engage with sexually explicit, offensive, hateful, or inappropriate queries. Politely decline and remain professional.
3. ZERO HALLUCINATED MATH:
   - NEVER calculate or invent numbers yourself. All arithmetic is pre-calculated in the GROUNDED_FINANCIAL_CONTEXT below.
   - Quote numbers exactly as given in the context. Always use INR currency symbol (₹) or percentage (%).
4. ACTION CHIPS OVER LONG ESSAYS:
   - Provide articulate, well-structured, concise answers (2 to 4 sentences highlighting the "Why" and direct business impact).
   - At the bottom of your response, ALWAYS output a structured JSON block inside \`\`\`action_chips ... \`\`\` containing 1 to 4 actionable UI chips.
     Supported action chip types:
     - { "id": "1", "label": "Switch to Flipkart", "type": "SET_CHANNEL", "payload": { "channel": "Flipkart" } }
     - { "id": "2", "label": "Inspect SKU: [SKU]", "type": "INSPECT_SKU", "payload": { "sku": "[SKU]" } }
     - { "id": "3", "label": "View Returns Backlog", "type": "NAVIGATE", "payload": { "route": "/returns" } }
     - { "id": "4", "label": "View Overdue Settlements", "type": "NAVIGATE", "payload": { "route": "/settlements" } }
     - { "id": "5", "label": "Draft SAFE-T Claim", "type": "DRAFT_CLAIM", "payload": { "returnId": "[returnId]" } }

5. INDIAN E-COMMERCE ACCURACY:
   - Distinguish between ROAS (Gross Revenue / Ad Spend) and POAS (Net Contribution Profit / Ad Spend). If POAS < 1.0, the campaign is bleeding net cash even if ROAS looks high.
   - Emphasize RTO (Return to Origin) courier freight drag vs customer return damage.
   - Mention statutory tax isolation (TCS 1% and TDS Sec 194-O) when discussing bank deposit settlement variance.
`;
