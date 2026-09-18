"use client";

import React from "react";
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
  impactNote: string;
}

export interface CardLogicModalProps {
  data: CardLogicModalData | null;
  onClose: () => void;
}

export function CardLogicModal({ data, onClose }: CardLogicModalProps) {
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="pr-4">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{data.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{data.meaning}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Calculation Formula Section */}
        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
          <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block mb-1">
            Calculation Formula
          </span>
          <div className="text-sm font-semibold text-purple-950 tracking-tight leading-relaxed">
            {data.formula}
          </div>
        </div>

        {/* Dataset Breakdown with Chart Numerical Style */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
            Arithmetic Breakdown
          </span>
          <div className="rounded-2xl border border-slate-200/90 divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
            {data.equationComponents.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-slate-600 font-medium">{item.label}</span>
                <span className={`text-right font-semibold tabular-nums tracking-tight ${item.color || "text-[#1D1D1F]"}`}>
                  {item.value}
                </span>
              </div>
            ))}

            {/* Total Row matching chart & card numerical style */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-900">{data.resultLabel}</span>
              <span className="text-base font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                {data.resultValue}
              </span>
            </div>
          </div>
        </div>

        {/* Business Insight Takeaway */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="leading-snug">{data.impactNote}</span>
        </div>

        {/* Close Action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 hover:bg-black active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
        >
          Close Inspection
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-configured Card Logic Generators
// ---------------------------------------------------------------------------
export function getCardLogicDefinitions(profitability: ProfitabilityMetrics): Record<string, CardLogicModalData> {
  return {
    grossSales: {
      title: "Gross Sales",
      meaning: "Total catalog value of all customer orders placed across selected channels.",
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
      impactNote: "Measures top-line customer demand before any commission, logistics, or return deductions.",
    },

    trueProfit: {
      title: "True Profit",
      meaning: "Realized in-pocket cash remaining after all marketplace deductions and wholesale supplier COGS.",
      formula: "True Profit = Net Platform Payout − Wholesale COGS",
      equationComponents: [
        {
          label: "Net Platform Payout (Gross − Fees − Returns + Claims)",
          value: formatINR(profitability.netPlatformPayout),
          color: "text-blue-600",
        },
        {
          label: "Wholesale Inventory Cost (COGS)",
          value: `−${formatINR(profitability.cogs)}`,
          color: "text-[#D70015]",
        },
      ],
      resultLabel: "True In-Pocket Profit",
      resultValue: formatINR(profitability.trueProfit),
      impactNote: "Actual net cash earned after fulfilling platform deductions and paying wholesale suppliers.",
    },

    netProfit: {
      title: "Net Platform Payout",
      meaning: "Net cash disbursed by marketplaces before paying wholesale suppliers.",
      formula: "Net Payout = Net Sales − Fees & Commissions − Return Deductions + Claims",
      equationComponents: [
        {
          label: "Net Sales (Gross − Discounts)",
          value: formatINR(profitability.netSales),
          color: "text-[#1D1D1F]",
        },
        {
          label: "Marketplace Fees & Commissions",
          value: `−${formatINR(profitability.marketplaceCharges)}`,
          color: "text-[#D70015]",
        },
        {
          label: "Return & RTO Deductions",
          value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`,
          color: "text-amber-600",
        },
        {
          label: "Dispute Reimbursements Credited",
          value: `+${formatINR(profitability.claimRecoveries)}`,
          color: "text-[#288548]",
        },
      ],
      resultLabel: "Net Platform Payout",
      resultValue: formatINR(profitability.netPlatformPayout),
      impactNote: "Expected bank payout deposited into your account from platforms.",
    },

    returnsRto: {
      title: "Returns & RTO Analysis",
      meaning: "Logistics deductions and losses from courier rejections (RTO) and customer returns.",
      formula: "Return Losses = Forward/Reverse Shipping Fees + Damaged Scrap",
      equationComponents: [
        {
          label: "Courier RTO (Undelivered)",
          value: `${profitability.rtoCount} items`,
          color: "text-amber-600",
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
      impactNote: "Differentiates undelivered courier transit failures from delivered customer returns.",
    },

    wholesalerCogs: {
      title: "Wholesaler Cost (COGS)",
      meaning: "Total inventory procurement cost payable to wholesale suppliers for sold items.",
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
      impactNote: "Snapshot procurement liability payable to suppliers for all delivered items.",
    },

    damagedClaims: {
      title: "Damaged Claims Recovery",
      meaning: "Reimbursements credited by platforms for courier transit or damage disputes.",
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
          color: "text-amber-600",
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
      impactNote: "Recovers lost cash directly through dispute claims filed against logistics damage.",
    },

    netRevenue: {
      title: "Net Revenue",
      meaning: "Customer catalog sales after deducting seller promotional discounts.",
      formula: "Net Revenue = Gross Sales − Promotional Discounts",
      equationComponents: [
        { label: "Gross Catalog Sales", value: formatINR(profitability.grossSales) },
        {
          label: "Promotional Discounts",
          value: `−${formatINR(profitability.discounts)}`,
          color: "text-amber-600",
        },
      ],
      resultLabel: "Net Realized Revenue",
      resultValue: formatINR(profitability.netSales),
      impactNote: "True top-line sales volume before channel fees and product COGS.",
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
      impactNote: "Product markup margin before marketplace commission and fulfillment fees.",
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
      impactNote: "Primary unit-economics benchmark of channel sustainability.",
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
      impactNote: "True bottom line after accounting for office, software, and business overheads.",
    },
  };
}
