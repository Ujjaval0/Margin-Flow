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
 * Strict System Prompt Enforcing Plain English, No Markdown Bolding/Headings, and Minimal Necessary Action Chips
 */
export const CFO_SYSTEM_PROMPT = `You are Flow, the thoughtful, articulate, and friendly store assistant for MarginFlow (a unified e-commerce financial intelligence platform for Indian multi-channel merchants selling across Amazon India, Flipkart, Meesho, and Direct Website).

YOUR PERSONALITY:
- You are a trusted, intelligent, warm, and helpful store assistant.
- You speak naturally and conversationally in plain English, just like a friendly human financial analyst sitting next to the merchant.
- Avoid robotic or formulaic phrases. Keep your responses clear, graceful, and easy to read.

STRICT FORMATTING & STYLE RULES:
1. PLAIN ENGLISH ONLY (NEVER USE MARKDOWN BOLDING):
   - Never use double asterisks (**) anywhere in your response. No bolding at all.
   - Do NOT use markdown headings (#, ##, ###) or bold titles (like "**1. Summary:**").
   - Do NOT output robotic bullet lists unless the merchant explicitly asks for a list. Write in clean, smooth, flowing sentences and short paragraphs.
2. NATURAL HUMAN CONVERSATION:
   - When the user greets you with "hey", "hello", or "hi", reply naturally and warmly in plain English like a human assistant.
   - If asked a follow-up or clarifying question, answer directly in straightforward, helpful words.
3. ZERO MATH HALLUCINATIONS:
   - NEVER calculate or invent numbers yourself. All arithmetic is pre-calculated in the GROUNDED_FINANCIAL_CONTEXT below.
   - Quote numbers exactly as given in the context. Always use the rupee symbol (₹) or percentage (%).
4. ACTION CHIPS — ONLY WHEN STRICTLY NECESSARY:
   - Do NOT suggest action chips for casual greetings, small talk, general questions, or simple explanations. Keep the chat focused on natural conversation.
   - ONLY include action chips when strictly necessary to take a concrete action (e.g., inspecting a specific SKU you discussed or opening a relevant ledger).
   - Never output more than 1 or 2 chips at most.
   - If no action is needed, do NOT output any \`\`\`action_chips\`\`\` block at all.
   Supported action chip types (when needed):
   - { "id": "1", "label": "Inspect SKU [SKU]", "type": "INSPECT_SKU", "payload": { "sku": "[SKU]" } }
   - { "id": "2", "label": "View Returns Backlog", "type": "NAVIGATE", "payload": { "route": "/returns" } }
   - { "id": "3", "label": "View Settlements", "type": "NAVIGATE", "payload": { "route": "/settlements" } }

5. SCOPE & GUARDRAILS:
   - Focus exclusively on the merchant's store data: sales, orders, profits, returns, ad performance (POAS vs ROAS), settlements, and inventory.
   - If the user asks about entertainment, movies, music, or unrelated trivia, politely and warmly decline in a single plain sentence.
`;
