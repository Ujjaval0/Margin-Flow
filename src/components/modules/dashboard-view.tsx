"use client";

import React, { useState } from "react";
import { usePlatform } from "@/domain/store";
import { formatINR, formatPercent } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Marketplace } from "@/domain/types";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  DollarSign,
  RotateCcw,
  ShieldCheck,
  Package,
  Layers,
  ShoppingCart,
  Banknote,
  BadgePercent,
  Calendar,
  Search,
  ArrowUpDown,
  Filter,
  Target,
  Megaphone,
} from "lucide-react";
import { DateRangePreset } from "@/domain/profitability-engine";

interface DashboardViewProps {
  selectedMarketplace: Marketplace | "ALL";
}

export function DashboardView({ selectedMarketplace }: DashboardViewProps) {
  const {
    profitability,
    profitabilityTrends,
    marketplaceBreakdown,
    skuBreakdown,
    datePreset,
    setDatePreset,
  } = usePlatform();

  // SKU Table Search & Sort State
  const [skuSearch, setSkuSearch] = useState("");
  const [skuSortBy, setSkuSortBy] = useState<"profit" | "revenue" | "unitsSold" | "margin" | "returnRate">("profit");
  const [skuSortOrder, setSkuSortOrder] = useState<"asc" | "desc">("desc");
  const [skuFilter, setSkuFilter] = useState<"ALL" | "PROFITABLE" | "LOSS_MAKING">("ALL");

  // Vibrant yet refined Apple Channel Identity Palette
  const CHANNEL_PALETTE: Record<string, { fill: string; bg: string; text: string }> = {
    "Amazon India": { fill: "#F59E0B", bg: "bg-amber-500/10", text: "text-amber-700" },
    Flipkart: { fill: "#3B82F6", bg: "bg-blue-500/10", text: "text-blue-700" },
    Meesho: { fill: "#EC4899", bg: "bg-pink-500/10", text: "text-pink-700" },
    "Personal Website": { fill: "#10B981", bg: "bg-emerald-500/10", text: "text-emerald-700" },
  };

  const channelChartData = marketplaceBreakdown.map((m) => ({
    name: m.marketplace.replace(" India", "").replace("Personal ", ""),
    Revenue: m.revenue,
    COGS: m.cogs,
    Fees: m.fees + m.logistics,
    Profit: m.contributionProfit,
  }));

  const lossMakingSkus = skuBreakdown.filter((s) => s.profit < 0);

  // Filtered & Sorted SKUs for Deep-Dive Table
  const processedSkus = skuBreakdown
    .filter((s) => {
      const matchesSearch = s.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
        s.productName.toLowerCase().includes(skuSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (skuFilter === "PROFITABLE") return s.profit > 0;
      if (skuFilter === "LOSS_MAKING") return s.profit < 0;
      return true;
    })
    .sort((a, b) => {
      const valA = a[skuSortBy];
      const valB = b[skuSortBy];
      return skuSortOrder === "asc" ? valA - valB : valB - valA;
    });

  const handleSort = (field: typeof skuSortBy) => {
    if (skuSortBy === field) {
      setSkuSortOrder(skuSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSkuSortBy(field);
      setSkuSortOrder("desc");
    }
  };

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: "ALL", label: "All Time" },
    { id: "TODAY", label: "Today" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "LAST_30_DAYS", label: "Last 30 Days" },
    { id: "THIS_MONTH", label: "This Month" },
    { id: "PREVIOUS_MONTH", label: "Last Month" },
  ];
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header with Date-Range Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Financial &amp; Operational Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time transaction-level profit engine across marketplaces and sales channels.
          </p>
        </div>

        {/* Dynamic Date-Range Selector & Channel Badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 font-semibold shadow-xs">
            {selectedMarketplace === "ALL" ? "All Channels" : selectedMarketplace}
          </span>

          <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <div className="flex items-center gap-1">
              {presets.map((p) => {
                const isSelected = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setDatePreset(p.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards with Dynamic Trend Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Net Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {formatINR(profitability.netSales)}
            </div>
            {datePreset !== "ALL" && (
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                <span
                  className={`inline-flex items-center font-bold ${
                    profitabilityTrends.netSalesChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {profitabilityTrends.netSalesChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(profitabilityTrends.netSalesChange)}%
                </span>
                <span className="text-slate-400 font-normal">vs. prior period</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
            <span>Gross: {formatINR(profitability.grossSales)}</span>
            <span className="text-amber-600 font-medium">-{formatINR(profitability.discounts)} disc</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Gross Profit</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold tracking-tight text-emerald-700">
              {formatINR(profitability.grossProfit)}
            </div>
            {datePreset !== "ALL" && (
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                <span
                  className={`inline-flex items-center font-bold ${
                    profitabilityTrends.grossProfitChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {profitabilityTrends.grossProfitChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(profitabilityTrends.grossProfitChange)}%
                </span>
                <span className="text-slate-400 font-normal">vs. prior period</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
            <span>COGS: {formatINR(profitability.cogs)}</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {formatPercent(profitability.grossMargin)} Margin
            </span>
          </div>
        </div>

        {/* Contribution Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Contribution Profit</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold tracking-tight text-indigo-700">
              {formatINR(profitability.contributionProfit)}
            </div>
            {datePreset !== "ALL" && (
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                <span
                  className={`inline-flex items-center font-bold ${
                    profitabilityTrends.contributionProfitChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {profitabilityTrends.contributionProfitChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(profitabilityTrends.contributionProfitChange)}%
                </span>
                <span className="text-slate-400 font-normal">vs. prior period</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
            <span>Post Fees &amp; Returns</span>
            <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              {formatPercent(profitability.contributionMargin)} Margin
            </span>
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Net Operating Profit</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                profitability.netOperatingProfit >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {profitability.netOperatingProfit >= 0 ? (
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.2} />
              ) : (
                <ArrowDownRight className="w-4 h-4" strokeWidth={2.2} />
              )}
            </div>
          </div>
          <div className="my-2">
            <div
              className={`text-2xl font-bold tracking-tight ${
                profitability.netOperatingProfit >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              {formatINR(profitability.netOperatingProfit)}
            </div>
            {datePreset !== "ALL" && (
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                <span
                  className={`inline-flex items-center font-bold ${
                    profitabilityTrends.netOperatingProfitChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {profitabilityTrends.netOperatingProfitChange >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(profitabilityTrends.netOperatingProfitChange)}%
                </span>
                <span className="text-slate-400 font-normal">vs. prior period</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
            <span>OPEX: {formatINR(profitability.operatingExpenses)}</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full ${
                profitability.netOperatingProfit >= 0
                  ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                  : "text-rose-700 bg-rose-50 border border-rose-200"
              }`}
            >
              {formatPercent(profitability.netOperatingMargin)} Margin
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Operational Metrics & POAS Performance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Volume */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Volume</span>
            <ShoppingCart className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div><span className="text-xl font-bold text-slate-900">{profitability.totalOrders}</span><span className="text-xs text-slate-400 ml-1">orders</span></div>
          <div className="text-[11px] text-slate-500">{profitability.totalUnitsSold} <span className="text-slate-400">units sold</span></div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-blue-600">Active Orders</span></div>
        </div>

        {/* POAS & Ad Spend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">POAS / Ads</span>
            <Target className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div>
            <span className={`text-xl font-bold ${profitability.poas >= 1.0 ? "text-emerald-700" : "text-amber-600"}`}>
              {profitability.poas > 0 ? `${profitability.poas}x` : "N/A"}
            </span>
            <span className="text-xs text-slate-400 ml-1">POAS</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Spend: {formatINR(profitability.totalAdSpend)}
          </div>
          <div className="mt-auto pt-2 border-t border-slate-100">
            <span className={`text-[10px] font-semibold ${profitability.poas >= 1.0 ? "text-emerald-600" : "text-amber-600"}`}>
              {profitability.poas >= 1.0 ? "Profitable Scale" : "High Ad Drag"}
            </span>
          </div>
        </div>

        {/* Settlement Received */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Settlement</span>
            <Banknote className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div className="text-xl font-bold text-emerald-700">{formatINR(profitability.actualSettlementsReceived)}</div>
          <div className="text-[11px] text-slate-500">Inflow received</div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-emerald-600">Deposited in bank</span></div>
        </div>

        {/* Marketplace Fees */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mkt. Fees</span>
            <BadgePercent className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div className="text-xl font-bold text-rose-600">{formatINR(profitability.marketplaceCharges)}</div>
          <div className="text-[11px] text-slate-500">Total deducted</div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-rose-600">Commissions &amp; fixed</span></div>
        </div>

        {/* Returns & RTO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Returns</span>
            <RotateCcw className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div className="text-xl font-bold text-amber-600">{formatINR(profitability.returnLosses + profitability.rtoLosses)}</div>
          <div className="text-[11px] text-slate-500">Return + RTO loss</div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-amber-600">Rate: {formatPercent(profitability.returnRate)}</span></div>
        </div>

        {/* Dispute Recoveries */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Disputes</span>
            <ShieldCheck className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div className="text-xl font-bold text-indigo-600">{formatINR(profitability.claimRecoveries)}</div>
          <div className="text-[11px] text-slate-500">Recovered so far</div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-indigo-600">SAFE-T Credits</span></div>
        </div>

        {/* Damaged Write-offs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Write-offs</span>
            <Package className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
          </div>
          <div className="text-xl font-bold text-slate-700">{formatINR(profitability.damageLosses)}</div>
          <div className="text-[11px] text-slate-500">Damaged inventory</div>
          <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-slate-500">Physical scrap</span></div>
        </div>
      </div>

      {/* Visual Analytics with Color-Coded Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Economics Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Channel Economics Comparison
              </h2>
              <p className="text-xs text-[#6E6E73] mt-0.5">
                Visualizing Gross Revenue vs COGS vs Marketplace Deductions vs Final Profit.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> COGS
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Fees
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Profit
              </span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelChartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  formatter={(value: any) => [formatINR(Number(value)), ""]}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                />
                <Bar dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="COGS" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Fees" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Share Donut Chart with Brand Channel Colors */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Revenue Distribution by Channel
            </h2>
            <p className="text-xs text-[#6E6E73] mt-0.5">Sales share percentage across channels</p>
          </div>
          <div className="h-52 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={marketplaceBreakdown}
                  dataKey="revenue"
                  nameKey="marketplace"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  {marketplaceBreakdown.map((entry) => (
                    <Cell
                      key={`cell-${entry.marketplace}`}
                      fill={CHANNEL_PALETTE[entry.marketplace]?.fill || "#64748B"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatINR(Number(value))}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            {marketplaceBreakdown.map((m) => {
              const pal = CHANNEL_PALETTE[m.marketplace];
              return (
                <div key={m.marketplace} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{ backgroundColor: pal?.fill || "#64748B" }}
                    />
                    <span className="text-slate-700 font-medium">{m.marketplace}</span>
                    {m.adSpend > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        m.poas >= 1.0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {m.poas}x POAS
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-slate-900">{formatINR(m.revenue)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loss-making SKU Alert Banner */}
      {lossMakingSkus.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-sm flex items-start gap-3 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0 animate-pulse" />
          <div className="flex-1">
            <span className="font-bold text-amber-950">Loss-Making SKU Advisory: </span>
            <span className="text-amber-900">
              {lossMakingSkus.length} product SKU operates at a negative contribution margin after reverse logistics shipping &amp; damage write-offs:
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {lossMakingSkus.map((s) => (
                <span
                  key={s.sku}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-950 font-mono text-[11px] font-bold shadow-xs"
                >
                  {s.sku} ({s.productName}): <span className="text-rose-600">{formatINR(s.profit)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Interactive SKU Economics Deep-Dive Table ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header & Filtering Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Product SKU Profitability &amp; Unit Economics
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {processedSkus.length} SKUs
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Net revenue, COGS, marketplace charges, return losses, and true contribution margin per SKU.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search Input */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 focus:outline-none focus:border-slate-400 transition"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-full">
              <button
                onClick={() => setSkuFilter("ALL")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                  skuFilter === "ALL" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSkuFilter("PROFITABLE")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                  skuFilter === "PROFITABLE" ? "bg-emerald-500 text-white shadow-xs font-semibold" : "text-slate-500"
                }`}
              >
                Profitable
              </button>
              <button
                onClick={() => setSkuFilter("LOSS_MAKING")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                  skuFilter === "LOSS_MAKING" ? "bg-rose-500 text-white shadow-xs font-semibold" : "text-slate-500"
                }`}
              >
                Loss-Making
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">SKU &amp; Product Name</th>
                <th
                  onClick={() => handleSort("unitsSold")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    Units Sold <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("revenue")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    Net Revenue <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Mkt. Deductions</th>
                <th className="px-4 py-3 text-right">Return Losses</th>
                <th
                  onClick={() => handleSort("profit")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    Net Contribution <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("margin")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    Margin % <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Ad Spend</th>
                <th className="px-4 py-3 text-right">POAS</th>
                <th
                  onClick={() => handleSort("returnRate")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    Return Rate <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedSkus.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No SKUs matched your search or filter criteria.
                  </td>
                </tr>
              ) : (
                processedSkus.map((s) => {
                  const isLoss = s.profit < 0;
                  return (
                    <tr key={s.sku} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 text-xs">{s.sku}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{s.productName}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {s.unitsSold} <span className="text-[10px] text-slate-400">units</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatINR(s.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatINR(s.cogs)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 font-medium">
                        -{formatINR(s.marketplaceCharges)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600 font-medium">
                        {s.returnLosses > 0 ? `-${formatINR(s.returnLosses)}` : "₹0"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={isLoss ? "text-rose-600" : "text-emerald-600"}>
                          {formatINR(s.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLoss
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : s.margin > 0.2
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {formatPercent(s.margin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-medium">
                        {s.adSpend ? formatINR(s.adSpend) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.poas !== undefined ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.poas >= 1.0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {s.poas}x
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            s.returnRate > 0.2 ? "text-amber-700" : "text-slate-600"
                          }`}
                        >
                          {formatPercent(s.returnRate)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Click any column header to toggle ascending/descending order.</span>
          <span className="font-medium text-slate-600">
            Total Analyzed Contribution Profit:{" "}
            <span
              className={`font-bold ${
                profitability.contributionProfit >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {formatINR(profitability.contributionProfit)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}