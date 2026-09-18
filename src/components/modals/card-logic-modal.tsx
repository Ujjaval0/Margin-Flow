"use client";

import React from "react";
import { X, CheckCircle2 } from "lucide-react";
import { ProfitabilityMetrics } from "@/domain/profitability-engine";
import { formatINR, formatPercent } from "@/lib/utils";

export interface CardLogicModalData {
  title: string;
  badge: string;
  category: string;
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
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {data.category}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {data.badge}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{data.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{data.meaning}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formula Box */}
        <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
          <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block mb-1">
            Mathematical Formula
          </span>
          <div className="text-xs font-mono font-semibold text-purple-950 break-words leading-relaxed">
            {data.formula}
          </div>
        </div>

        {/* Live Equation Breakdown */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Current Dataset Arithmetic
          </span>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            {data.equationComponents.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-slate-600">{item.label}</span>
                <span className={`font-mono font-semibold ${item.color || "text-slate-800"}`}>
                  {item.value}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-bold text-xs">
              <span className="text-slate-900">{data.resultLabel}</span>
              <span className="font-mono text-purple-700 text-sm">{data.resultValue}</span>
            </div>
          </div>
        </div>

        {/* Business Impact Note */}
        <div className="flex items-start gap-2 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-[11px] text-emerald-800 leading-relaxed">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{data.impactNote}</span>
        </div>

        {/* Modal Action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition shadow-xs"
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
      badge: "Catalog Demand",
      category: "Top-Line Order Value",
      meaning: "Total list value of all customer orders placed across selected channels.",
      formula: "Gross Sales = Σ (Item Selling Price × Ordered Quantity)",
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
      resultLabel: "Total Gross Catalog Sales",
      resultValue: formatINR(profitability.grossSales),
      impactNote: "Gross sales indicates total catalog demand before fee or return deductions.",
    },

    trueProfit: {
      title: "True Profit",
      badge: "Realized Net Cash",
      category: "In-Pocket Cash Flow",
      meaning: "Realized in-pocket cash after platform fees, returns, and wholesale supplier COGS.",
      formula: "True Profit = Net Platform Payout − Wholesaler Inventory Cost (COGS)",
      equationComponents: [
        {
          label: "Net Platform Payout (Gross − Fees − Returns + Claims)",
          value: formatINR(profitability.netPlatformPayout),
          color: "text-blue-600",
        },
        {
          label: "− Wholesale Product Cost (Snapshot COGS)",
          value: `−${formatINR(profitability.cogs)}`,
          color: "text-rose-600",
        },
      ],
      resultLabel: "True Realized Profit",
      resultValue: formatINR(profitability.trueProfit),
      impactNote: "Represents actual net cash remaining in your pocket after paying suppliers.",
    },

    netProfit: {
      title: "Net Profit (Platform Payout)",
      badge: "Disbursable Payout",
      category: "Marketplace Cash Remittance",
      meaning: "Net cash payout remitted by channels before paying supplier bills.",
      formula: "Net Profit = Net Sales − Marketplace Deductions − Return Losses + Dispute Recoveries",
      equationComponents: [
        {
          label: "Net Sales (Gross − Discounts)",
          value: formatINR(profitability.netSales),
          color: "text-slate-800",
        },
        {
          label: "− Marketplace Fees & Commissions",
          value: `−${formatINR(profitability.marketplaceCharges)}`,
          color: "text-rose-600",
        },
        {
          label: "− Reverse Freight & Return Deductions",
          value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`,
          color: "text-amber-600",
        },
        {
          label: "+ Recovered Dispute Reimbursements",
          value: `+${formatINR(profitability.claimRecoveries)}`,
          color: "text-emerald-600",
        },
      ],
      resultLabel: "Net Platform Payout",
      resultValue: formatINR(profitability.netPlatformPayout),
      impactNote: "Directly matches platform remittance payouts deposited into your bank.",
    },

    returnsRto: {
      title: "Returns & RTO Analysis",
      badge: "Reverse Logistics Friction",
      category: "Fulfillment & Return Losses",
      meaning: "Combined units and logistics losses from undelivered RTO and customer returns.",
      formula: "Total Loss = Forward/Reverse Shipping Fees + Damaged Scrap Value",
      equationComponents: [
        {
          label: "RTO (Courier Return-to-Origin)",
          value: `${profitability.rtoCount} items`,
          color: "text-amber-600",
        },
        {
          label: "Customer Returns (Delivered & Returned)",
          value: `${profitability.customerReturnCount} items`,
          color: "text-rose-600",
        },
        { label: "Overall Return Rate %", value: formatPercent(profitability.returnRate) },
        {
          label: "Total Financial Loss Deducted",
          value: formatINR(profitability.returnLosses + profitability.rtoLosses),
          color: "text-rose-700",
        },
      ],
      resultLabel: "Total Return Units (Return Rate %)",
      resultValue: `${profitability.rtoCount + profitability.customerReturnCount} (${formatPercent(
        profitability.returnRate
      )})`,
      impactNote: "Tracks undelivered courier rejections versus delivered customer returns.",
    },

    wholesalerCogs: {
      title: "Wholesaler Cost (COGS)",
      badge: "Supplier Liability",
      category: "Product Procurement",
      meaning: "Total wholesale purchase cost payable to suppliers for sold units.",
      formula: "COGS = Σ (Sold Quantity × Historical Unit Purchase Cost Snapshot)",
      equationComponents: [
        { label: "Total Units Sold", value: `${profitability.totalUnitsSold} units` },
        {
          label: "Average Unit Snapshot Cost",
          value: formatINR(
            profitability.totalUnitsSold > 0
              ? Math.round(profitability.cogs / profitability.totalUnitsSold)
              : 0
          ),
        },
      ],
      resultLabel: "Total Wholesaler COGS Payable",
      resultValue: formatINR(profitability.cogs),
      impactNote: "Locked-in snapshot purchase costs payable to wholesale inventory vendors.",
    },

    damagedClaims: {
      title: "Damaged Claims Recovery",
      badge: "Dispute Reimbursements",
      category: "Loss Recovery Pipeline",
      meaning: "Dispute reimbursements credited by platforms for transit or damage cases.",
      formula: "Recovered = Σ (Approved Claims); Pending = Σ (Open Claims)",
      equationComponents: [
        {
          label: "Dispute Reimbursements Credited",
          value: formatINR(profitability.claimRecoveries),
          color: "text-emerald-600",
        },
        {
          label: "Pending Claims Under Review",
          value: formatINR(profitability.pendingClaimsAmount),
          color: "text-amber-600",
        },
        {
          label: "Pending Claims Count",
          value: `${profitability.pendingClaimsCount} open tickets`,
        },
        {
          label: "Physical Damaged Inventory Units",
          value: `${profitability.damagedUnitsCount} damaged units`,
        },
      ],
      resultLabel: "Total Reimbursements Credited",
      resultValue: formatINR(profitability.claimRecoveries),
      impactNote: "Recovers lost cash from platform SAFE-T and courier dispute claims.",
    },

    netRevenue: {
      title: "Net Revenue",
      badge: "Realized Sales",
      category: "GAAP Accounting",
      meaning: "Customer catalog sales after deducting seller promotional discounts.",
      formula: "Net Revenue = Gross Sales − Promotional Discounts",
      equationComponents: [
        { label: "Gross Catalog Sales", value: formatINR(profitability.grossSales) },
        {
          label: "− Direct Discounts",
          value: `−${formatINR(profitability.discounts)}`,
          color: "text-amber-600",
        },
      ],
      resultLabel: "Net Realized Sales",
      resultValue: formatINR(profitability.netSales),
      impactNote: "Operating sales volume before deducting platform fees and COGS.",
    },

    grossProfit: {
      title: "Gross Profit",
      badge: "Manufacturing Margin",
      category: "GAAP Accounting",
      meaning: "Net revenue minus wholesale inventory purchase cost (COGS).",
      formula: "Gross Profit = Net Revenue − Snapshot COGS",
      equationComponents: [
        { label: "Net Revenue", value: formatINR(profitability.netSales) },
        {
          label: "− Snapshot COGS",
          value: `−${formatINR(profitability.cogs)}`,
          color: "text-rose-600",
        },
        { label: "Gross Margin %", value: formatPercent(profitability.grossMargin) },
      ],
      resultLabel: "Gross Profit",
      resultValue: formatINR(profitability.grossProfit),
      impactNote: "Core product markup profit before platform logistics and commission fees.",
    },

    contributionProfit: {
      title: "Contribution Profit",
      badge: "Channel Profitability",
      category: "Unit Economics",
      meaning: "Margin after platform commissions, logistics fees, and return losses.",
      formula:
        "Contribution Profit = Gross Profit − Marketplace Charges − Logistics − Return Losses + Claims",
      equationComponents: [
        { label: "Gross Profit", value: formatINR(profitability.grossProfit) },
        {
          label: "− Marketplace Commissions & Fees",
          value: `−${formatINR(profitability.marketplaceCharges)}`,
          color: "text-rose-600",
        },
        {
          label: "− Return & RTO Losses",
          value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`,
          color: "text-amber-600",
        },
        {
          label: "+ Recovered Claims",
          value: `+${formatINR(profitability.claimRecoveries)}`,
          color: "text-emerald-600",
        },
      ],
      resultLabel: "Contribution Profit",
      resultValue: formatINR(profitability.contributionProfit),
      impactNote: "Essential unit-economics test of channel sustainability.",
    },

    netOperatingProfit: {
      title: "Net Operating Profit",
      badge: "Business Net Earnings",
      category: "GAAP Accounting",
      meaning: "Final net earnings after deducting business operating expenses (OPEX).",
      formula: "Net Operating Profit = Contribution Profit − Operating Expenses (OPEX)",
      equationComponents: [
        { label: "Contribution Profit", value: formatINR(profitability.contributionProfit) },
        {
          label: "− Total Operating Expenses (OPEX)",
          value: `−${formatINR(profitability.operatingExpenses)}`,
          color: "text-rose-600",
        },
        { label: "Net Operating Margin %", value: formatPercent(profitability.netOperatingMargin) },
      ],
      resultLabel: "Net Operating Profit",
      resultValue: formatINR(profitability.netOperatingProfit),
      impactNote: "True commercial bottom line after financing business overheads.",
    },
  };
}
