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
      answer: `Hello! I'm Flow, your store assistant.\nAsk me anything about your sales, profits, returns, or store metrics.`,
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

    const answer = isDown
      ? `Net Operating Profit is down ${changeText}% to ${formatINR(waterfall.netOperatingProfit)} (${waterfall.netMarginPercent.toFixed(1)}% margin).\n\nKey drivers:\nI. Return & Courier Drag: ${formatINR(waterfall.returnAndRtoLoss)}\nII. Top Drag Product: ${worstSku ? `${worstSku.sku} (-${formatINR(Math.abs(worstSku.netProfit))})` : "None"}\nIII. Net Revenue: ${formatINR(waterfall.netRevenue)}`
      : `Net Operating Profit is up ${changeText}% to ${formatINR(waterfall.netOperatingProfit)} (${waterfall.netMarginPercent.toFixed(1)}% margin).\n\nKey drivers:\nI. Net Revenue: ${formatINR(waterfall.netRevenue)}\nII. Top Performer: ${heroSkus[0]?.sku || "Hero Products"} (${waterfall.blendedPoas.toFixed(2)}x POAS)`;

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
      label: "View Orders",
      type: "NAVIGATE",
      payload: { route: "/orders" },
    });

    const answer = targetSku
      ? `Blended POAS is ${waterfall.blendedPoas.toFixed(2)}x on ${formatINR(waterfall.totalAdSpend)} ad spend.\n\nI. Drag Product: ${targetSku.sku}\nII. Ad Spend: ${formatINR(targetSku.adSpend)} (${targetSku.returnRate.toFixed(1)}% return rate)\nIII. Product POAS: ${targetSku.poas.toFixed(2)}x`
      : `Ad spend efficiency is stable on ${formatINR(waterfall.totalAdSpend)} marketing investments.\n\nI. Blended POAS: ${waterfall.blendedPoas.toFixed(2)}x\nII. Blended ROAS: ${waterfall.blendedRoas.toFixed(2)}x\nIII. Status: Active campaigns are generating positive net contribution`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 3. Settlement Aging & Overdue Payouts
  if (q.includes("settlement") || q.includes("payout") || q.includes("bank") || q.includes("aging") || q.includes("overdue") || q.includes("cash")) {
    const overdueAmt = settlementAging.over14DaysOverdueAmount;
    const count = settlementAging.overdueOrderCount;

    const chips: AIActionChip[] = [
      {
        id: "go-settlements",
        label: "Open Settlements",
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
      ? `${formatINR(overdueAmt)} in payouts is delayed past 14 days across ${count} orders.\n\nI. Overdue Payouts: ${formatINR(overdueAmt)}\nII. Pending (8–14 Days): ${formatINR(settlementAging.between8And14DaysAmount)}\nIII. On Schedule (0–7 Days): ${formatINR(settlementAging.within7DaysAmount)}`
      : `Disbursements are on schedule with zero overdue balance.\n\nI. Current Cycle (0–7 Days): ${formatINR(settlementAging.within7DaysAmount)}\nII. Pending Cycle (8–14 Days): ${formatINR(settlementAging.between8And14DaysAmount)}`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 4. Returns, Damaged Stock & Claims
  if (q.includes("return") || q.includes("rto") || q.includes("damage") || q.includes("claim") || q.includes("safe-t") || q.includes("dispute")) {
    const unclaimed = damagedReturnsToClaim;
    const chips: AIActionChip[] = [
      {
        id: "nav-returns",
        label: "View Returns",
        type: "NAVIGATE",
        payload: { route: "/returns" },
      },
    ];

    if (unclaimed.length > 0) {
      chips.unshift({
        id: `draft-claim-${unclaimed[0].returnId}`,
        label: `Claim for ${unclaimed[0].sku}`,
        type: "DRAFT_CLAIM",
        payload: { returnId: unclaimed[0].returnId },
      });
    }

    const answer = unclaimed.length > 0
      ? `Total return losses stand at ${formatINR(waterfall.returnAndRtoLoss)}.\n\nI. Unclaimed Damaged Returns: ${unclaimed.length} units (${formatINR(unclaimed.reduce((s, r) => s + r.lossAmount, 0))})\nII. Action: File SAFE-T or dispute claims before 30-day window expires`
      : `Total return losses stand at ${formatINR(waterfall.returnAndRtoLoss)}.\n\n• All physical damaged returns have active dispute claims filed.`;

    return { answer, chips: chips.slice(0, 2) };
  }

  // 5. Default Executive Overview
  const topHero = heroSkus[0];
  const chips: AIActionChip[] = [
    {
      id: "check-orders",
      label: "Review Orders",
      type: "NAVIGATE",
      payload: { route: "/orders" },
    },
    {
      id: "check-reports",
      label: "View P&L Statement",
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

  const answer = `Store Overview:\n\nI. Net Sales: ${formatINR(waterfall.netRevenue)}\nII. Net Operating Profit: ${formatINR(waterfall.netOperatingProfit)} (${waterfall.netMarginPercent.toFixed(1)}% margin)\nIII. Ad Spend: ${formatINR(waterfall.totalAdSpend)} (${waterfall.blendedPoas.toFixed(2)}x POAS)${topHero ? `\nIV. Top Product: ${topHero.sku} (${formatINR(topHero.netProfit)} profit)` : ""}`;

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

