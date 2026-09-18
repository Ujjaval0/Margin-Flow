"use client";

import React from "react";
import { X } from "lucide-react";
import { formatINR, formatPercent } from "@/lib/utils";

export interface SkuEconomicsItem {
  sku: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  marketplaceCharges: number;
  returnLosses: number;
  profit: number;
  margin: number;
  adSpend?: number;
  poas?: number;
  returnRate: number;
}

export interface SkuDrawerProps {
  skuData: SkuEconomicsItem | null;
  onClose: () => void;
}

export function SkuDrawer({ skuData, onClose }: SkuDrawerProps) {
  if (!skuData) return null;

  const realizedUnitPrice = Math.round(skuData.revenue / (skuData.unitsSold || 1));
  const unitCogs = Math.round(skuData.cogs / (skuData.unitsSold || 1));
  const unitMarketplace = Math.round(skuData.marketplaceCharges / (skuData.unitsSold || 1));
  const unitReturnLoss = Math.round(skuData.returnLosses / (skuData.unitsSold || 1));
  const unitProfit = Math.round(skuData.profit / (skuData.unitsSold || 1));

  return (
    <div
      className="fixed inset-0 z-50 drawer-backdrop flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Unit Economics Inspection
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  skuData.profit >= 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {skuData.profit >= 0 ? "Profitable" : "Loss-Making"}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">{skuData.sku}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{skuData.productName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <span className="text-[11px] text-slate-400 font-medium">Net Revenue</span>
            <div className="text-base font-semibold text-[#1D1D1F] mt-0.5 tracking-tight tabular-nums">
              {formatINR(skuData.revenue)}
            </div>
            <span className="text-[10px] text-slate-500">{skuData.unitsSold} units sold</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <span className="text-[11px] text-slate-400 font-medium">Contribution Margin</span>
            <div
              className={`text-base font-semibold mt-0.5 tracking-tight tabular-nums ${
                skuData.profit >= 0 ? "text-[#288548]" : "text-[#D70015]"
              }`}
            >
              {formatPercent(skuData.margin)}
            </div>
            <span className="text-[10px] text-slate-500">{formatINR(skuData.profit)} net</span>
          </div>
        </div>

        {/* Per-Unit Economics Step-Down Waterfall */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
            Unit Economics Breakdown (Per 1 Item)
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-slate-600">Average Realized Unit Price</span>
              <span className="font-semibold text-slate-900 font-mono">
                {formatINR(realizedUnitPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>− Unit Product Cost (COGS)</span>
              <span className="font-mono text-slate-800">-{formatINR(unitCogs)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>− Marketplace Fees &amp; Logistics</span>
              <span className="font-mono text-rose-600">-{formatINR(unitMarketplace)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>− Reverse Logistics &amp; Return Drag</span>
              <span className="font-mono text-amber-600">
                {skuData.returnLosses > 0 ? `-${formatINR(unitReturnLoss)}` : "₹0"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-bold">
              <span className="text-slate-900">Net Unit Contribution Profit</span>
              <span
                className={`font-mono ${
                  skuData.profit >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {formatINR(unitProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="space-y-3 mb-6">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">POAS / Advertising Drag</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Ad Spend: {skuData.adSpend ? formatINR(skuData.adSpend) : "₹0"}
              </div>
            </div>
            <div>
              {skuData.poas !== undefined ? (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    skuData.poas >= 1.0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {skuData.poas}x POAS
                </span>
              ) : (
                <span className="text-xs text-slate-400">No Direct Ads</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">Return &amp; RTO Rate</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Total Return Losses: {formatINR(skuData.returnLosses)}
              </div>
            </div>
            <div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  skuData.returnRate > 0.2
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {formatPercent(skuData.returnRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `SKU: ${skuData.sku}\nRevenue: ${formatINR(skuData.revenue)}\nProfit: ${formatINR(
                  skuData.profit
                )}\nMargin: ${formatPercent(skuData.margin)}`
              );
            }}
            className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
          >
            Copy SKU Summary
          </button>
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
