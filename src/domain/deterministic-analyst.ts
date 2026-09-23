import { GroundedFinancialContext, AIActionChip } from "./ai-context";
import { formatINR, formatPercent } from "@/lib/utils";

export interface AnalystResponse {
  answer: string;
  chips: AIActionChip[];
}

/**
 * Deterministic Financial Reasoning Engine
 * Runs 100% locally with ZERO external API calls, providing sub-second
 * grounded financial analysis and actionable UI chips.
 */
export function analyzeFinancialQuery(
  query: string,
  context: GroundedFinancialContext
): AnalystResponse {
  const q = (query || "").toLowerCase();
  const waterfall = context?.waterfall ?? {
    grossSales: 0,
    discounts: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    marketplaceFees: 0,
    logisticsCost: 0,
    returnAndRtoLoss: 0,
    disputeRecoveries: 0,
    contributionProfit: 0,
    contributionMarginPercent: 0,
    opex: 0,
    netOperatingProfit: 0,
    netMarginPercent: 0,
    totalAdSpend: 0,
    blendedRoas: 0,
    blendedPoas: 0,
    totalOrders: 0,
    unitsSold: 0,
  };
  const trends = context?.trends ?? {
    grossSalesChange: 0,
    netSalesChange: 0,
    contributionProfitChange: 0,
    netOperatingProfitChange: 0,
    adSpendChange: 0,
  };
  const lossMakingSkus = context?.lossMakingSkus ?? [];
  const heroSkus = context?.heroSkus ?? [];
  const settlementAging = context?.settlementAging ?? {
    within7DaysAmount: 0,
    between8And14DaysAmount: 0,
    over14DaysOverdueAmount: 0,
    overdueOrderCount: 0,
  };
  const channelComparison = context?.channelComparison ?? [];
  const damagedReturnsToClaim = context?.damagedReturnsToClaim ?? [];

  // 0. Off-Topic & Explicit Guardrail (No movies, music, songs, entertainment, or explicit content)
  const isOffTopic =
    q.includes("movie") ||
    q.includes("film") ||
    q.includes("cinema") ||
    q.includes("music") ||
    q.includes("song") ||
    q.includes("singer") ||
    q.includes("actor") ||
    q.includes("actress") ||
    q.includes("hollywood") ||
    q.includes("bollywood") ||
    q.includes("taylor swift") ||
    q.includes("netflix") ||
    q.includes("spotify") ||
    q.includes("game") ||
    q.includes("explicit") ||
    q.includes("porn") ||
    q.includes("sex") ||
    q.includes("dating");

  if (isOffTopic) {
    return {
      answer:
        "I'm dedicated exclusively as your store assistant to help you understand and manage your MarginFlow data—such as your sales, profit margins, orders, returns, and inventory. Let me know what you'd like to explore in your numbers!",
      chips: [],
    };
  }

  // 0.1 Warm Conversational Greetings
  if (q === "hi" || q === "hello" || q === "hey" || q.includes("who are you") || q.includes("what can you do")) {
    return {
      answer: `Hello! I'm Flow, your store assistant. I have full real-time access to your store's performance across all active channels. Currently, your store has generated ${formatINR(waterfall.netRevenue)} in net sales with a ${waterfall.netMarginPercent.toFixed(1)}% net operating margin (${formatINR(waterfall.netOperatingProfit)} profit). What would you like to explore today?`,
      chips: [],
    };
  }

  // 1. Profit Drop / Margin Analysis
  if (
    q.includes("profit") ||
    q.includes("margin") ||
    q.includes("down") ||
    q.includes("drop") ||
    q.includes("why") ||
    q.includes("health")
  ) {
    const isDown = trends.netOperatingProfitChange < 0;
    const changeText = Math.abs(trends.netOperatingProfitChange).toFixed(1);
    const worstSku = lossMakingSkus[0];
    const topChannel = [...channelComparison].sort((a, b) => b.netProfit - a.netProfit)[0];

    const chips: AIActionChip[] = [];
    if (worstSku) {
      chips.push({
        id: "inspect-worst-sku",
        label: `Inspect ${worstSku.sku}`,
        type: "INSPECT_SKU",
        payload: { sku: worstSku.sku },
      });
    }
    if (topChannel) {
      chips.push({
        id: "switch-top-channel",
        label: `Filter ${topChannel.channel}`,
        type: "SET_CHANNEL",
        payload: { channel: topChannel.channel },
      });
    }
    if (damagedReturnsToClaim.length > 0) {
      chips.push({
        id: "draft-claim-return",
        label: `⚡ Draft SAFE-T Claim (${damagedReturnsToClaim.length})`,
        type: "DRAFT_CLAIM",
        payload: { returnId: damagedReturnsToClaim[0].returnId },
      });
    } else {
      chips.push({
        id: "view-settlements",
        label: "Check Settlements",
        type: "NAVIGATE",
        payload: { route: "/settlements" },
      });
    }

    const answer = isDown
      ? `Net Operating Profit is down ${changeText}% period-over-period to ${formatINR(waterfall.netOperatingProfit)} (${waterfall.netMarginPercent.toFixed(1)}% margin). The primary drag is ${formatINR(waterfall.returnAndRtoLoss)} in returns & RTO courier freight${worstSku ? `, led by negative contribution on ${worstSku.sku} (-${formatINR(Math.abs(worstSku.netProfit))})` : ""}.`
      : `Net Operating Profit is up ${changeText}% to ${formatINR(waterfall.netOperatingProfit)} with a healthy ${waterfall.netMarginPercent.toFixed(1)}% net margin on ${formatINR(waterfall.netRevenue)} net revenue. Growth is driven by ${heroSkus[0]?.sku || "hero products"} generating strong POAS (${waterfall.blendedPoas.toFixed(2)}x) across channels.`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 2. POAS / Ad Bleed / ROAS Analysis
  if (q.includes("poas") || q.includes("roas") || q.includes("ad") || q.includes("bleed") || q.includes("marketing")) {
    const bleeders = lossMakingSkus.filter((s) => s.adSpend > 0 && s.poas < 1.0);
    const targetSku = bleeders[0] || lossMakingSkus[0];

    const chips: AIActionChip[] = [];
    if (targetSku) {
      chips.push({
        id: "inspect-poas-sku",
        label: `Audit ${targetSku.sku}`,
        type: "INSPECT_SKU",
        payload: { sku: targetSku.sku },
      });
    }
    chips.push({
      id: "view-orders",
      label: "View High-Ad Orders",
      type: "NAVIGATE",
      payload: { route: "/orders" },
    });

    const answer = targetSku
      ? `Blended POAS is ${waterfall.blendedPoas.toFixed(2)}x across ${formatINR(waterfall.totalAdSpend)} total ad spend. Critical ad drag detected on ${targetSku.sku}: spent ${formatINR(targetSku.adSpend)} on ads with high return rate (${targetSku.returnRate.toFixed(1)}%), generating a negative POAS of ${targetSku.poas.toFixed(2)}x.`
      : `Ad spend efficiency is stable with blended POAS at ${waterfall.blendedPoas.toFixed(2)}x and ROAS at ${waterfall.blendedRoas.toFixed(2)}x across ${formatINR(waterfall.totalAdSpend)} in marketing investments. All active campaigns are generating positive net contribution cash.`;

    return { answer, chips };
  }

  // 3. Settlement Aging & Overdue Payouts
  if (q.includes("settlement") || q.includes("payout") || q.includes("bank") || q.includes("aging") || q.includes("overdue") || q.includes("cash")) {
    const overdueAmt = settlementAging.over14DaysOverdueAmount;
    const count = settlementAging.overdueOrderCount;

    const chips: AIActionChip[] = [
      {
        id: "go-settlements",
        label: "Open Settlements Reconciliation",
        type: "NAVIGATE",
        payload: { route: "/settlements" },
      },
    ];

    if (channelComparison.length > 0) {
      chips.push({
        id: "filter-main-channel",
        label: `View ${channelComparison[0].channel} Orders`,
        type: "SET_CHANNEL",
        payload: { channel: channelComparison[0].channel },
      });
    }

    const answer = overdueAmt > 0
      ? `There is ${formatINR(overdueAmt)} in delayed marketplace disbursements aging past 14 days across ${count} un-settled orders. Cross-reference your bank credit UTRs against open settlement batches to confirm whether withholding adjustments or bank clearance holds apply.`
      : `Disbursement cycle is healthy: 100% of pending settlement batches are within the 0–14 day standard cycle (${formatINR(settlementAging.within7DaysAmount)} cycle-safe). Net bank deposit matching is fully balanced.`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 4. Returns, Damaged Stock & Claims
  if (q.includes("return") || q.includes("rto") || q.includes("damage") || q.includes("claim") || q.includes("safe-t") || q.includes("dispute")) {
    const unclaimed = damagedReturnsToClaim;
    const chips: AIActionChip[] = [
      {
        id: "nav-returns",
        label: "View Returns & RTOs",
        type: "NAVIGATE",
        payload: { route: "/returns" },
      },
      {
        id: "nav-claims",
        label: "View Claims Ledger",
        type: "NAVIGATE",
        payload: { route: "/claims" },
      },
    ];

    if (unclaimed.length > 0) {
      chips.unshift({
        id: `draft-claim-${unclaimed[0].returnId}`,
        label: `⚡ Draft SAFE-T for ${unclaimed[0].sku}`,
        type: "DRAFT_CLAIM",
        payload: { returnId: unclaimed[0].returnId },
      });
    }

    const answer = unclaimed.length > 0
      ? `Total returns & RTO loss stands at ${formatINR(waterfall.returnAndRtoLoss)}. You have ${unclaimed.length} unfiled damaged returns totaling ${formatINR(unclaimed.reduce((s, r) => s + r.lossAmount, 0))} in recoverable capital. File Amazon SAFE-T or Flipkart dispute before the 30-day SLA window closes.`
      : `Returns & RTO losses total ${formatINR(waterfall.returnAndRtoLoss)}. All physical damaged returns currently have active dispute claims filed with marketplace partner portals.`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 5. Default Executive Overview
  const topHero = heroSkus[0];
  const chips: AIActionChip[] = [
    {
      id: "check-orders",
      label: "Review Orders Ledger",
      type: "NAVIGATE",
      payload: { route: "/orders" },
    },
    {
      id: "check-reports",
      label: "View Full P&L Statement",
      type: "NAVIGATE",
      payload: { route: "/reports" },
    },
  ];

  if (lossMakingSkus[0]) {
    chips.unshift({
      id: "inspect-loss-sku",
      label: `Audit ${lossMakingSkus[0].sku}`,
      type: "INSPECT_SKU",
      payload: { sku: lossMakingSkus[0].sku },
    });
  }

  const answer = `Across all channels, MarginFlow reports ${formatINR(waterfall.netRevenue)} in net sales and ${formatINR(waterfall.netOperatingProfit)} in net operating cash profit (${waterfall.netMarginPercent.toFixed(1)}% margin). ${topHero ? `Top contributor is ${topHero.sku} generating ${formatINR(topHero.netProfit)} net profit.` : ""} Total ad spend is ${formatINR(waterfall.totalAdSpend)} at ${waterfall.blendedPoas.toFixed(2)}x POAS.`;

  return { answer, chips: chips.slice(0, 2) };
}

/**
 * Parses out Action Chips block from the LLM text output
 */
export function parseResponseAndChips(
  rawText: string,
  context: GroundedFinancialContext
): { answer: string; chips: AIActionChip[] } {
  let answer = rawText.trim();
  let chips: AIActionChip[] = [];

  // Look for ```action_chips ... ``` or ```json ... ``` block
  const chipBlockMatch = rawText.match(/```(?:action_chips|json)?\s*([\s\S]*?)\s*```/);
  if (chipBlockMatch) {
    try {
      const parsed = JSON.parse(chipBlockMatch[1]);
      if (Array.isArray(parsed)) {
        chips = parsed.slice(0, 2);
      }
      // Remove the code block from visible answer
      answer = answer.replace(/```(?:action_chips|json)?\s*[\s\S]*?\s*```/, "").trim();
    } catch {
      // ignore parse errors
    }
  }

  // Ensure answer is in clean plain English without markdown asterisks
  answer = answer.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*/g, "");

  return { answer, chips };
}

