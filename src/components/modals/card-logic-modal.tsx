"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2 } from "lucide-react";
import { ProfitabilityMetrics } from "@/domain/profitability-engine";
import { formatINR, formatPercent } from "@/lib/utils";

export interface CardLogicModalData {
  title: string;
  badge?: string;
  category?: string;
  meaning: string;
  formula: string;
  equationComponents: {
    label: string;
    value: string;
    color?: string;
  }[];
  resultLabel: string;
  resultValue: string;
  impactNote?: string;
}

export interface CardLogicModalProps {
  data: CardLogicModalData | null;
  onClose: () => void;
}

export function CardLogicModal({ data, onClose }: CardLogicModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      setMounted(false);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!data || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="apple-card w-full max-w-lg rounded-3xl shadow-apple-lg border border-black/[0.08] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-black/[0.06]">
          <div className="pr-4">
            <h3 className="text-lg font-bold text-[#1D1D1F] tracking-tight">{data.title}</h3>
            <p className="text-xs text-[#86868B] mt-0.5 leading-relaxed font-medium">{data.meaning}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close formula inspection"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Calculation Formula Section */}
        <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
          <span className="text-[11px] font-medium text-[#86868B] block mb-1">
            Calculation formula
          </span>
          <div className="text-sm font-semibold text-[#1D1D1F] tracking-tight leading-relaxed">
            {data.formula}
          </div>
        </div>

        {/* Dataset Breakdown with Chart Numerical Style */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-[#86868B] block px-1">
            Arithmetic breakdown
          </span>
          <div className="rounded-2xl border border-black/[0.06] divide-y divide-black/[0.04] bg-white overflow-hidden shadow-apple-sm">
            {data.equationComponents.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-[#F5F5F7]/50 transition-colors"
              >
                <span className="text-[#6E6E73] font-medium">{item.label}</span>
                <span className={`text-right font-semibold tabular-nums tracking-tight ${item.color || "text-[#1D1D1F]"}`}>
                  {item.value}
                </span>
              </div>
            ))}

            {/* Total Row matching chart & card numerical style */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#F5F5F7]/90 border-t border-black/[0.06]">
              <span className="text-xs font-bold text-[#1D1D1F]">{data.resultLabel}</span>
              <span className="text-base font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                {data.resultValue}
              </span>
            </div>
          </div>
        </div>

        {/* Business Insight Takeaway (optional) */}
        {data.impactNote && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#288548]/10 border border-[#288548]/20 rounded-xl text-xs text-[#288548] font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#288548] shrink-0" />
            <span className="leading-snug text-[#1D1D1F]">{data.impactNote}</span>
          </div>
        )}

        {/* Close Action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-xl transition shadow-apple-sm btn-press cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Pre-configured Card Logic Generators
// ---------------------------------------------------------------------------
export function getCardLogicDefinitions(profitability: ProfitabilityMetrics): Record<string, CardLogicModalData> {
  return {
    grossSales: {
      title: "Gross Sales",
      meaning: "Total value of all placed customer orders.",
      formula: "Gross Sales = Item Selling Price × Ordered Quantity",
      equationComponents: [
        { label: "Active Orders Logged", value: `${profitability.totalOrders} orders` },
        { label: "Total Units Sold", value: `${profitability.totalUnitsSold} units` },
        {
          label: "Average Order Value (AOV)",
          value: formatINR(
            profitability.totalOrders > 0
              ? Math.round(profitability.grossSales / profitability.totalOrders)
              : 0
          ),
        },
      ],
      resultLabel: "Total Gross Sales",
      resultValue: formatINR(profitability.grossSales),
    },

    trueProfit: {
      title: "True Profit",
      meaning: "Net profit remaining after platform deductions and wholesale supplier COGS.",
      formula: "True Profit = Platform Profit − Supplier COGS",
      equationComponents: [
        {
          label: "All Platform Profit (Settlement − Return Fees + Claims)",
          value: formatINR(profitability.netPlatformPayout),
          color: "text-[#1D1D1F]",
        },
        {
          label: "Active Supplier Inventory Cost (COGS)",
          value: `−${formatINR(profitability.cogs)}`,
          color: "text-[#D70015]",
        },
        {
          label: "Realized Margin on Sales",
          value: formatPercent(profitability.grossSales > 0 ? profitability.trueProfit / profitability.grossSales : 0),
          color: "text-[#288548]",
        },
      ],
      resultLabel: "True In-Pocket Profit",
      resultValue: formatINR(profitability.trueProfit),
    },

    netProfit: {
      title: "Net Profit / Platform Payout",
      meaning: "Net payout from marketplaces before wholesale supplier costs.",
      formula: "Platform Profit = Settlement Received − Return Fees + Claim Recovery",
      equationComponents: [
        {
          label: "Settlement Received (Delivered Orders Only)",
          value: formatINR(profitability.actualSettlementsReceived),
          color: "text-[#1D1D1F]",
        },
        {
          label: "Customer Return Fees (Reverse Logistics)",
          value: `−${formatINR(profitability.customerReturnFees)}`,
          color: "text-[#D70015]",
        },
        {
          label: "Claim Recoveries (Approved Dispute Payouts)",
          value: `+${formatINR(profitability.claimRecoveries)}`,
          color: "text-[#288548]",
        },
      ],
      resultLabel: "All Platform Profit",
      resultValue: formatINR(profitability.netPlatformPayout),
    },

    returnsRto: {
      title: "Returns & RTO Analysis",
      meaning: "Logistics deductions and losses from courier rejections and customer returns.",
      formula: "Return Losses = Forward/Reverse Shipping Fees + Damaged Scrap",
      equationComponents: [
        {
          label: "Courier RTO (Undelivered)",
          value: `${profitability.rtoCount} items`,
          color: "text-[#B25E00]",
        },
        {
          label: "Customer Returns (Delivered & Returned)",
          value: `${profitability.customerReturnCount} items`,
          color: "text-[#D70015]",
        },
        { label: "Overall Return Rate", value: formatPercent(profitability.returnRate) },
        {
          label: "Total Financial Return Losses",
          value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`,
          color: "text-[#D70015]",
        },
      ],
      resultLabel: "Total Return Units",
      resultValue: `${profitability.rtoCount + profitability.customerReturnCount} items (${formatPercent(
        profitability.returnRate
      )})`,
    },

    wholesalerCogs: {
      title: "Wholesaler Cost (COGS)",
      meaning: "Total inventory purchase cost payable to wholesale suppliers.",
      formula: "Wholesaler COGS = Total Units Sold × Unit Purchase Cost",
      equationComponents: [
        { label: "Total Units Sold", value: `${profitability.totalUnitsSold} units` },
        {
          label: "Average Cost Per Unit",
          value: formatINR(
            profitability.totalUnitsSold > 0
              ? Math.round(profitability.cogs / profitability.totalUnitsSold)
              : 0
          ),
        },
      ],
      resultLabel: "Total Wholesaler Cost",
      resultValue: formatINR(profitability.cogs),
    },

    damagedClaims: {
      title: "Damaged Claims Recovery",
      meaning: "Reimbursements credited by platforms for transit or damage disputes.",
      formula: "Claims Recovery = Approved SAFE-T & Transit Dispute Credits",
      equationComponents: [
        {
          label: "Reimbursements Credited",
          value: formatINR(profitability.claimRecoveries),
          color: "text-[#288548]",
        },
        {
          label: "Pending Claims Under Review",
          value: formatINR(profitability.pendingClaimsAmount),
          color: "text-[#B25E00]",
        },
        {
          label: "Open Dispute Tickets",
          value: `${profitability.pendingClaimsCount} tickets`,
        },
        {
          label: "Physical Damaged Units",
          value: `${profitability.damagedUnitsCount} units`,
        },
      ],
      resultLabel: "Total Reimbursements Credited",
      resultValue: formatINR(profitability.claimRecoveries),
    },

    netRevenue: {
      title: "Net Revenue",
      meaning: "Customer sales value after deducting seller promotional discounts.",
      formula: "Net Revenue = Gross Sales − Promotional Discounts",
      equationComponents: [
        { label: "Gross Catalog Sales", value: formatINR(profitability.grossSales) },
        {
          label: "Promotional Discounts",
          value: `−${formatINR(profitability.discounts)}`,
          color: "text-[#B25E00]",
        },
      ],
      resultLabel: "Net Realized Revenue",
      resultValue: formatINR(profitability.netSales),
    },

    grossProfit: {
      title: "Gross Profit",
      meaning: "Net revenue minus wholesale inventory purchase cost.",
      formula: "Gross Profit = Net Revenue − Wholesale COGS",
      equationComponents: [
        { label: "Net Revenue", value: formatINR(profitability.netSales) },
        {
          label: "Wholesale COGS",
          value: `−${formatINR(profitability.cogs)}`,
          color: "text-[#D70015]",
        },
        { label: "Gross Margin %", value: formatPercent(profitability.grossMargin) },
      ],
      resultLabel: "Gross Profit",
      resultValue: formatINR(profitability.grossProfit),
    },

    contributionProfit: {
      title: "Contribution Profit",
      meaning: "Channel operating profit after commissions, logistics fees, and return losses.",
      formula: "Contribution Profit = Gross Profit − Fees − Return Losses + Claims",
      equationComponents: [
        { label: "Gross Profit", value: formatINR(profitability.grossProfit) },
        {
          label: "Marketplace Commissions & Fees",
          value: `−${formatINR(profitability.marketplaceCharges)}`,
          color: "text-[#D70015]",
        },
        {
          label: "Return & RTO Losses",
          value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`,
          color: "text-[#D70015]",
        },
        {
          label: "Dispute Recoveries Credited",
          value: `+${formatINR(profitability.claimRecoveries)}`,
          color: "text-[#288548]",
        },
      ],
      resultLabel: "Contribution Profit",
      resultValue: formatINR(profitability.contributionProfit),
    },

    netOperatingProfit: {
      title: "Net Operating Profit",
      meaning: "Final business net earnings after deducting operating expenses (OPEX).",
      formula: "Net Operating Profit = Contribution Profit − Operating Expenses (OPEX)",
      equationComponents: [
        { label: "Contribution Profit", value: formatINR(profitability.contributionProfit) },
        {
          label: "Total Operating Expenses (OPEX)",
          value: `−${formatINR(profitability.operatingExpenses)}`,
          color: "text-[#D70015]",
        },
        { label: "Net Operating Margin %", value: formatPercent(profitability.netOperatingMargin) },
      ],
      resultLabel: "Net Operating Profit",
      resultValue: formatINR(profitability.netOperatingProfit),
    },
  };
}
