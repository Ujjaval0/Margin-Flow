"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePlatform } from "@/domain/store";
import { formatINR, formatPercent } from "@/lib/utils";
import { scopeReport } from "@/domain/report-scope";
import { downloadCsv } from "@/lib/csv";
import { calculatePeriodProfitability, periodMarketplace, periodSku, monthlyFinancialTrend } from "@/domain/financial-period";
import {
  Package,
  AlertTriangle,
  RotateCcw,
  BarChart3,
  TrendingUp,
  FileText,
  Boxes,
  Store,
  Layers,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Percent,
  CircleDollarSign,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
} from "recharts";

export function ReportsView() {
  const { reportDataset, selectedMarketplace } = usePlatform();

  // All projections and exports share the same channel and global date scope.
  const [activeTab, setActiveTab] = useState<"analytics" | "pnl">("analytics");
  const [selectedChannel, setSelectedChannel] = useState<string>("All Channels");
  useEffect(() => {
    setSelectedChannel(selectedMarketplace === "ALL" ? "All Channels" : selectedMarketplace === "Amazon India" ? "Amazon" : selectedMarketplace === "Personal Website" ? "Website" : selectedMarketplace);
  }, [selectedMarketplace]);
  const financialData = useMemo(() => {
    const context = reportDataset.financialContext || reportDataset;
    return { ...scopeReport(context, selectedChannel), financialIssues: 'financialIssues' in context && Array.isArray(context.financialIssues) ? context.financialIssues as string[] : [] };
  }, [reportDataset, selectedChannel]);
  const { orders } = financialData;
  const reportRange = reportDataset.reportRange;
  const profitability = useMemo(() => calculatePeriodProfitability(financialData, reportRange), [financialData, reportRange]);
  const marketplaceBreakdown = useMemo(() => periodMarketplace(financialData, reportRange), [financialData, reportRange]);
  const skuBreakdown = useMemo(() => periodSku(financialData, reportRange), [financialData, reportRange]);

  const shareOfNetSales = (amount: number) => profitability.netSales > 0 ? formatPercent(amount / profitability.netSales) : "—";

  // Counts are dated events; rates compare returned units with their shipment cohort.
  const uniqueProductsCount = useMemo(() => skuBreakdown.filter(row => row.unitsSold || row.revenue || row.profit || row.returnedUnits).length, [skuBreakdown]);
  const overallReturnMetrics = useMemo(() => ({
    customerReturns: profitability.customerReturnCount,
    rtos: profitability.rtoCount,
    returnRate: (profitability.customerReturnRate || 0) * 100,
    rtoRate: (profitability.rtoRate || 0) * 100,
    denominator: profitability.returnRateDenominator || 0,
  }), [profitability]);

  const topProducts = useMemo(() => [...skuBreakdown].sort((a, b) => b.profit - a.profit).map((item, index) => ({
    rank: index + 1, sku: item.sku, productName: item.productName,
    platforms: Array.from(new Set(orders.filter(order => order.items.some(line => line.sku === item.sku)).map(order => order.marketplace))),
    orders: orders.filter(order => order.status !== 'CANCELLED' && (!reportRange || order.orderDate.slice(0, 10) >= reportRange.startDate && order.orderDate.slice(0, 10) <= reportRange.endDate) && order.items.some(line => line.sku === item.sku)).length,
    unitsSold: item.unitsSold, revenue: item.revenue, profit: item.profit,
    margin: item.margin, returnsCount: item.returnedUnits || 0, returnRate: item.returnRate * 100,
  })), [skuBreakdown, orders, reportRange]);

  const platformProfitData = useMemo(() => marketplaceBreakdown.map(row => ({
    platform: row.marketplace.replace(" India", ""), fullName: row.marketplace, profit: row.contributionProfit,
    revenue: row.revenue, cogs: row.cogs, fees: row.fees, margin: Number((row.margin * 100).toFixed(1)), ordersCount: row.orderCount,
  })), [marketplaceBreakdown]);

  const platformReturnRates = useMemo(() => marketplaceBreakdown.map(row => ({
    platform: row.marketplace.replace(" India", ""), fullName: row.marketplace,
    returnRate: row.returnRateDenominator ? Number(((row.customerReturnRate || 0) * 100).toFixed(1)) : null,
    rtoRate: row.returnRateDenominator ? Number(((row.rtoRate || 0) * 100).toFixed(1)) : null,
    totalOrders: row.orderCount,
  })), [marketplaceBreakdown]);

  const monthlyData = useMemo(() => monthlyFinancialTrend(financialData, reportRange), [financialData, reportRange]);

  const platformSummary = useMemo(() => {
    const summary = marketplaceBreakdown.map(row => ({
      platform: row.marketplace, ordersCount: row.orderCount, grossSales: row.revenue,
      settlement: row.actualSettlementsReceived || 0, cogs: row.cogs, profit: row.contributionProfit,
      margin: row.margin, returnsCount: row.returnedUnits || 0, returnRate: row.returnRate * 100, rateDenominator: row.returnRateDenominator || 0,
    }));
    const totals = {
      ordersCount: profitability.totalOrders, grossSales: profitability.netSales,
      settlement: profitability.actualSettlementsReceived, cogs: profitability.cogs,
      profit: profitability.contributionProfit, returnsCount: profitability.customerReturnCount + profitability.rtoCount,
      margin: profitability.contributionMargin * 100, returnRate: profitability.returnRate * 100,
    };
    return { summary, totals };
  }, [marketplaceBreakdown, profitability]);

  // Brand color mapping
  const getPlatformBadge = (platformName: string) => {
    const name = platformName.toLowerCase();
    if (name.includes("amazon")) {
      return { bg: "bg-amber-50 text-amber-800 border-amber-200/80", dot: "bg-amber-500" };
    }
    if (name.includes("flipkart")) {
      return { bg: "bg-blue-50 text-blue-800 border-blue-200/80", dot: "bg-blue-600" };
    }
    if (name.includes("meesho")) {
      return { bg: "bg-pink-50 text-pink-800 border-pink-200/80", dot: "bg-pink-500" };
    }
    if (name.includes("blinkit")) {
      return { bg: "bg-yellow-50 text-yellow-800 border-yellow-200/80", dot: "bg-yellow-500" };
    }
    if (name.includes("zepto")) {
      return { bg: "bg-purple-50 text-purple-800 border-purple-200/80", dot: "bg-purple-600" };
    }
    if (name.includes("woocommerce")) {
      return { bg: "bg-purple-50 text-purple-800 border-purple-200/80", dot: "bg-[#7F54B3]" };
    }
    return { bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80", dot: "bg-emerald-600" };
  };

  const getPlatformBarColor = (platformName: string) => {
    const name = platformName.toLowerCase();
    if (name.includes("amazon")) return "#F59E0B";
    if (name.includes("flipkart")) return "#2563EB";
    if (name.includes("meesho")) return "#EC4899";
    if (name.includes("blinkit")) return "#EAB308";
    if (name.includes("zepto")) return "#8B5CF6";
    if (name.includes("woocommerce")) return "#7F54B3";
    return "#10B981";
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (activeTab === "analytics") {
      const headers = ["Rank", "SKU", "Product", "Active Orders Placed", "Net Revenue", "Contribution Profit", "Contribution Margin", "Returned Units"];
      const rows = topProducts.map((p) => [
        p.rank,
        p.sku,
        p.productName,
        p.orders,
        p.revenue.toFixed(2),
        p.profit.toFixed(2),
        `${(p.margin * 100).toFixed(1)}%`,
        p.returnsCount,
      ]);
      downloadCsv([headers, ...rows], "analytics-top-products-" + new Date().toISOString().slice(0, 10) + ".csv");
    } else {
      const headers = ["Metric", "Accounting Treatment", "Amount", "% Net Sales"];
      const rows = [
        ["Gross Sales", "Recorded line totals before discounts", profitability.grossSales.toFixed(2), formatPercent(profitability.netSales > 0 ? profitability.grossSales / profitability.netSales : 0)],
        ["Discounts", "Coupons & Promotional Deductions", (-profitability.discounts).toFixed(2), shareOfNetSales(profitability.discounts)],
        ["Sales Refunds", "Bounded returned units at original discounted price", (-profitability.refundedSales).toFixed(2), formatPercent(profitability.netSales > 0 ? profitability.refundedSales / profitability.netSales : 0)],
        ["Included Output GST", "Retained GST included in gross selling prices", (-(profitability.outputTaxExcluded || 0)).toFixed(2), formatPercent(profitability.netSales > 0 ? (profitability.outputTaxExcluded || 0) / profitability.netSales : 0)],
        ["Shipping & Customer Charges", "Recognized charges excluding GST and dated refunds", (profitability.shippingRevenue || 0).toFixed(2), formatPercent(profitability.netSales > 0 ? (profitability.shippingRevenue || 0) / profitability.netSales : 0)],
        ["Net Sales", "Gross - discounts - refunds - included GST + shipping and charges", profitability.netSales.toFixed(2), profitability.netSales > 0 ? "100.0%" : "—"],
        ["COGS", "Historical Snapshot Purchasing Cost", (-profitability.cogs).toFixed(2), shareOfNetSales(profitability.cogs)],
        ["Gross Profit", "Net Sales - COGS", profitability.grossProfit.toFixed(2), formatPercent(profitability.grossMargin)],
        ["Marketplace Fees", "Platform and logistics expenses", (-(profitability.marketplaceCharges+profitability.shippingLogisticsCosts)).toFixed(2), shareOfNetSales((profitability.marketplaceCharges+profitability.shippingLogisticsCosts))],
        ["Direct Return Costs", "Return fees and logistics; inventory cost already in COGS", (-(profitability.directReturnCosts||0)).toFixed(2), shareOfNetSales(((profitability.directReturnCosts||0)))],
        ["Dispute Claims", "Dated marketplace reimbursement evidence", profitability.claimRecoveries.toFixed(2), shareOfNetSales(profitability.claimRecoveries)],
        ["Recovered Inventory Cost", "Salvage carrying value capped at original cost", (profitability.salvageRecovery || 0).toFixed(2), shareOfNetSales((profitability.salvageRecovery || 0))],
        ["Contribution Profit", "Gross Profit - Fees - Direct Returns + Claims + Recovered Inventory", profitability.contributionProfit.toFixed(2), formatPercent(profitability.contributionMargin)],
        ["Operating Overhead", "Advertising, Software, Fixed Overhead", (-profitability.operatingExpenses).toFixed(2), shareOfNetSales(profitability.operatingExpenses)],
        ["Net Operating Profit", "Contribution Profit - Operating Overhead", profitability.netOperatingProfit.toFixed(2), formatPercent(profitability.netOperatingMargin)],
      ];
      downloadCsv([headers, ...rows], "pnl-statement-" + new Date().toISOString().slice(0, 10) + ".csv");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* ─── Top Header & Controls Strip ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Analytics &amp; Financial Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#86868B] mt-1">
            Contribution Margin P&amp;L, SKU Breakdown &amp; Growth Trends
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Tab Switcher */}
          <div className="bg-black/[0.04] p-1 rounded-full border border-black/[0.06] inline-flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              Analytics &amp; Insights
            </button>
            <button
              onClick={() => setActiveTab("pnl")}
              className={`px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                activeTab === "pnl"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              P&amp;L Ledger
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-black/[0.08] hover:bg-black/[0.04] text-[#1D1D1F] text-xs font-semibold shadow-apple-sm transition btn-press cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ANALYTICS & INSIGHTS (Full Reference Suite)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* 1. Top 3 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Unique Products */}
            <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-[#86868B] font-medium block">
                  Unique Products
                </span>
                <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                  {uniqueProductsCount}
                </div>
                <span className="text-[11px] text-[#86868B] block">
                  Active catalog SKUs transacted
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-black/[0.04] border border-black/[0.04] text-[#1D1D1F] flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5 text-[#0071E3]" />
              </div>
            </div>

            {/* Card 2: Overall Return Rate */}
            <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-[#86868B] font-medium block">
                  Customer Return Rate
                </span>
                <div className="text-2xl font-semibold text-amber-600 tracking-tight tabular-nums">
                  {overallReturnMetrics.denominator ? overallReturnMetrics.returnRate.toFixed(1) + "%" : "—"}
                </div>
                <span className="text-[11px] text-[#86868B] block">
                  {overallReturnMetrics.customerReturns} units returned; rate uses shipment cohort
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Overall RTO Rate */}
            <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-[#86868B] font-medium block">
                  Overall RTO Delivery Failure
                </span>
                <div className="text-2xl font-semibold text-rose-600 tracking-tight tabular-nums">
                  {overallReturnMetrics.denominator ? overallReturnMetrics.rtoRate.toFixed(1) + "%" : "—"}
                </div>
                <span className="text-[11px] text-[#86868B] block">
                  {overallReturnMetrics.rtos} RTO units; rate uses shipment cohort
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2. Top Products (Ranked by Profit) Table */}
          <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-black/[0.04] text-[#0071E3] flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Top Products (Contribution Profit)
                </h3>
              </div>
              <p className="text-xs text-[#86868B] mt-1">
                SKU contribution before shared operating overhead
              </p>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-[#86868B] text-xs">
                No products data available. Add orders to see analytics.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFC] text-[#86868B] uppercase text-[10px] font-semibold tracking-wider border-y border-black/[0.04]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">PRODUCT</th>
                      <th className="py-3 px-4">PLATFORM</th>
                      <th className="py-3 px-4 text-right">ORDERS PLACED</th>
                      <th className="py-3 px-4 text-right">REVENUE</th>
                      <th className="py-3 px-4 text-right">CONTRIBUTION</th>
                      <th className="py-3 px-4 text-right">MARGIN</th>
                      <th className="py-3 px-4 text-right">RETURNED UNITS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                    {topProducts.map((p) => {
                      const isProfitPositive = p.profit >= 0;
                      return (
                        <tr key={p.sku} className="hover:bg-black/[0.02] transition-colors">
                          <td className="py-3 px-3 text-center font-medium text-[#86868B]">
                            {p.rank}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#1D1D1F] whitespace-nowrap">
                            {p.sku}
                          </td>
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="truncate font-medium text-[#1D1D1F]" title={p.productName}>
                              {p.productName}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.platforms.map((pl) => {
                                const b = getPlatformBadge(pl);
                                return (
                                  <span
                                    key={pl}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${b.bg}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                                    <span>{pl.replace(" India", "")}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                            {p.orders} <span className="text-[#86868B] text-[10px] font-normal">({p.unitsSold} units)</span>
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                            {formatINR(p.revenue)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right text-sm font-semibold tracking-tight tabular-nums ${
                              isProfitPositive ? "text-[#288548]" : "text-[#D70015]"
                            }`}
                          >
                            {isProfitPositive ? "+" : ""}
                            {formatINR(p.profit)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                                isProfitPositive
                                  ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-800 border border-rose-500/20"
                              }`}
                            >
                              {(p.margin * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                            {p.returnsCount > 0 ? (
                              <span className="text-[#D70015] font-semibold">
                                {p.returnsCount}{" "}
                                <span className="text-[10px] text-[#86868B] font-normal">({p.unitsSold ? p.returnRate.toFixed(1) + "%" : "—"})</span>
                              </span>
                            ) : (
                              <span className="text-[#86868B] font-normal">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Two Side-by-Side Visual Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Chart: Platform Profit Comparison */}
            <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-5 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Platform Profit Comparison
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Net profit by marketplace
                </p>
              </div>

              {platformProfitData.length === 0 ? (
                <div className="py-20 text-center text-[#86868B] text-xs my-auto">
                  No platform data
                </div>
              ) : (
                <div className="h-64 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformProfitData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis
                        dataKey="platform"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#86868B" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#86868B" }}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          backdropFilter: "blur(12px)",
                          borderRadius: "16px",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.03)",
                          fontSize: "12px",
                        }}
                        formatter={(value: any) => [formatINR(Number(value)), "Contribution Profit"]}
                        labelStyle={{ fontWeight: 600, color: "#1D1D1F" }}
                      />
                      <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                        {platformProfitData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getPlatformBarColor(entry.platform)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Right Chart: Return & RTO Rate by Platform */}
            <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-5 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Return &amp; RTO Rate by Platform
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Returned units / recognized shipment-cohort units, through period end
                </p>
              </div>

              {platformReturnRates.length === 0 ? (
                <div className="py-20 text-center text-[#86868B] text-xs my-auto">
                  No return data
                </div>
              ) : (
                <div className="h-64 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformReturnRates} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis
                        dataKey="platform"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#86868B" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#86868B" }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          backdropFilter: "blur(12px)",
                          borderRadius: "16px",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.03)",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any) => [
                          `${Number(value).toFixed(1)}%`,
                          name === "returnRate" ? "Customer Returns" : "Courier RTO",
                        ]}
                        labelStyle={{ fontWeight: 600, color: "#1D1D1F" }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
                        formatter={(value) => (value === "returnRate" ? "Customer Returns %" : "Courier RTO %")}
                      />
                      <Bar dataKey="returnRate" fill="#E05263" name="returnRate" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rtoRate" fill="#B25E00" name="rtoRate" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* 4. Monthly Profit & Revenue Trend (Full-Width Chart) */}
          <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Monthly Profit &amp; Revenue Trend
              </h3>
              <p className="text-xs text-[#86868B] mt-0.5">
                Month-over-month breakdown of financial performance
              </p>
            </div>

            {monthlyData.length === 0 ? (
              <div className="py-20 text-center text-[#86868B] text-xs">
                No monthly data available
              </div>
            ) : (
              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071E3" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="#0071E3" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#288548" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#288548" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#86868B" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#86868B" }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(12px)",
                        borderRadius: "16px",
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.03)",
                        fontSize: "12px",
                      }}
                      formatter={(value: any, name: any) => [
                        formatINR(Number(value)),
                        name === "revenue" ? "Net Revenue" : "Net Operating Profit",
                      ]}
                      labelStyle={{ fontWeight: 600, color: "#1D1D1F" }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
                      formatter={(value) => (value === "revenue" ? "Net Revenue" : "Net Operating Profit")}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0071E3"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                      name="revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#288548"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorProf)"
                      name="profit"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 5. Platform Summary Table (Full-Width) */}
          <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Platform Summary
              </h3>
              <p className="text-xs text-[#86868B] mt-0.5">
                Active placed-order counts; return rates use the same shipment cohort
              </p>
            </div>

            {platformSummary.summary.length === 0 ? (
              <div className="py-12 text-center text-[#86868B] text-xs">
                No platform summary data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFC] text-[#86868B] uppercase text-[10px] font-semibold tracking-wider border-y border-black/[0.04]">
                    <tr>
                      <th className="py-3 px-4">PLATFORM</th>
                      <th className="py-3 px-4 text-right">ORDERS PLACED</th>
                      <th className="py-3 px-4 text-right">NET REVENUE</th>
                      <th className="py-3 px-4 text-right">SETTLEMENT</th>
                      <th className="py-3 px-4 text-right">COGS</th>
                      <th className="py-3 px-4 text-right">CONTRIBUTION</th>
                      <th className="py-3 px-4 text-right">MARGIN</th>
                      <th className="py-3 px-4 text-right">RETURNS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                    {platformSummary.summary.map((row) => {
                      const badge = getPlatformBadge(row.platform);
                      const isProfitable = row.profit >= 0;
                      return (
                        <tr key={row.platform} className="hover:bg-black/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${badge.bg}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                              <span>{row.platform}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                            {row.ordersCount}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                            {formatINR(row.grossSales)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                            {formatINR(row.settlement)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-[#6E6E73] tracking-tight tabular-nums">
                            {formatINR(row.cogs)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right text-sm font-semibold tracking-tight tabular-nums ${
                              isProfitable ? "text-[#288548]" : "text-[#D70015]"
                            }`}
                          >
                            {isProfitable ? "+" : ""}
                            {formatINR(row.profit)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                                isProfitable
                                  ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-800 border border-rose-500/20"
                              }`}
                            >
                              {(row.margin * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                            {row.returnsCount > 0 ? (
                              <span className="text-[#D70015] font-semibold">
                                {row.returnsCount}{" "}
                                <span className="text-[10px] text-[#86868B] font-normal">({row.rateDenominator ? row.returnRate.toFixed(1) + "%" : "—"})</span>
                              </span>
                            ) : (
                              <span className="text-[#86868B] font-normal">0 ({row.rateDenominator ? "0.0%" : "—"})</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Summary Totals Footer Row */}
                  <tfoot className="bg-[#FAFAFC] font-semibold text-[#1D1D1F] border-t border-black/[0.06] text-xs">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[#1D1D1F]">Consolidated Total</td>
                      <td className="py-3 px-4 text-right text-xs font-semibold tracking-tight tabular-nums">{platformSummary.totals.ordersCount}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(platformSummary.totals.grossSales)}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                        {formatINR(platformSummary.totals.settlement)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-[#6E6E73] tracking-tight tabular-nums">
                        {formatINR(platformSummary.totals.cogs)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                        {formatINR(platformSummary.totals.profit)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-950 tabular-nums">
                          {platformSummary.totals.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                        {platformSummary.totals.returnsCount}{" "}
                        <span className="text-[10px] text-[#86868B] font-normal">
                          ({profitability.returnRateDenominator ? platformSummary.totals.returnRate.toFixed(1) + "%" : "—"})
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: STATEMENT OF PROFIT & LOSS (PRESERVED LEDGER)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "pnl" && (
        <div className="space-y-4">
          <div className="apple-card p-6 rounded-3xl border border-black/[0.06] shadow-apple-md space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-black/[0.05] pb-4">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Statement of Profit &amp; Loss
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  {profitability.isComplete === false ? "Provisional: " + (profitability.issues?.join("; ") || "financial evidence is incomplete") : "Operational statement based on recorded financial evidence."}
                </p>
              </div>
              <span className="text-xs text-[#288548] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold tabular-nums">
                Operating Margin: {formatPercent(profitability.netOperatingMargin)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFC] text-[#86868B] font-semibold uppercase text-[10px] tracking-wider border-y border-black/[0.04]">
                  <tr>
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Accounting Treatment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">% Net Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1D1D1F]">
                  <tr>
                    <td className="py-3 px-4 font-semibold">Gross Sales</td>
                    <td className="py-3 px-4 text-[#86868B]">Recorded line totals before discounts</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.grossSales)}</td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">{formatPercent(profitability.netSales > 0 ? profitability.grossSales / profitability.netSales : 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Discounts &amp; Promotions</td>
                    <td className="py-3 px-4 text-[#86868B]">Channel coupon allowances</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
                      {formatINR(-profitability.discounts)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales(profitability.discounts)}
                    </td>
                  </tr>
                  {[
                    ["Sales Refunds", "Bounded returned units at original discounted price", -profitability.refundedSales],
                    ["Included Output GST", "Retained GST included in gross selling prices", -(profitability.outputTaxExcluded || 0)],
                    ["Shipping & Customer Charges", "Recognized charges excluding GST and dated refunds", profitability.shippingRevenue || 0],
                  ].map(([label, treatment, amount]) => (
                    <tr key={String(label)}>
                      <td className="py-3 px-4 text-slate-600">{label}</td>
                      <td className="py-3 px-4 text-[#86868B]">{treatment}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-slate-600 tracking-tight tabular-nums">{formatINR(Number(amount))}</td>
                      <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">{profitability.netSales > 0 ? formatPercent(Number(amount) / profitability.netSales) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className="py-3 px-4">Net Sales</td>
                    <td className="py-3 px-4 text-[#86868B] font-normal">Gross - Discounts - Refunds - Included GST + Shipping &amp; Charges</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.netSales)}</td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">{profitability.netSales > 0 ? "100.0%" : "—"}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Cost of Goods Sold (COGS)</td>
                    <td className="py-3 px-4 text-[#86868B]">Snapshot historical purchasing cost</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      {formatINR(-profitability.cogs)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales(profitability.cogs)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/40 font-semibold">
                    <td className="py-3 px-4 text-[#288548]">Gross Profit</td>
                    <td className="py-3 px-4 text-[#86868B] font-normal">Net Sales - COGS</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                      {formatINR(profitability.grossProfit)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#288548] tracking-tight tabular-nums">
                      {formatPercent(profitability.grossMargin)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Marketplace Fees &amp; Deductions</td>
                    <td className="py-3 px-4 text-[#86868B]">Commissions and fixed closing fees</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      {formatINR(-(profitability.marketplaceCharges+profitability.shippingLogisticsCosts))}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales((profitability.marketplaceCharges+profitability.shippingLogisticsCosts))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Direct Return Costs</td>
                    <td className="py-3 px-4 text-[#86868B]">Return fees and logistics; inventory cost already in COGS</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      {formatINR(-(profitability.directReturnCosts||0))}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales(((profitability.directReturnCosts||0)))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Dispute Claim Recoveries</td>
                    <td className="py-3 px-4 text-[#86868B]">Dated marketplace reimbursement evidence</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                      {formatINR(profitability.claimRecoveries)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales(profitability.claimRecoveries)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Recovered Inventory Cost</td>
                    <td className="py-3 px-4 text-[#86868B]">Salvage carrying value capped at original cost</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">{formatINR(profitability.salvageRecovery || 0)}</td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">{profitability.netSales > 0 ? formatPercent((profitability.salvageRecovery || 0) / profitability.netSales) : "—"}</td>
                  </tr>
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className="py-3 px-4 text-[#1D1D1F]">Contribution Profit</td>
                    <td className="py-3 px-4 text-[#86868B] font-normal">
                      Gross Profit - Fees - Direct Returns + Claims + Recovered Inventory
                    </td>
                    <td className={`py-3 px-4 text-right text-sm font-semibold tracking-tight tabular-nums ${profitability.contributionProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"}`}>
                      {formatINR(profitability.contributionProfit)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-slate-700 tracking-tight tabular-nums">
                      {formatPercent(profitability.contributionMargin)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Operating Overhead (OPEX)</td>
                    <td className="py-3 px-4 text-[#86868B]">Advertising, rent, software, team</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      {formatINR(-profitability.operatingExpenses)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {shareOfNetSales(profitability.operatingExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-slate-100/90 border-t-2 border-b border-slate-300 font-bold text-xs text-[#1D1D1F]">
                    <td className="py-3.5 px-4 rounded-l-xl font-bold text-slate-900">Net Operating Profit</td>
                    <td className="py-3.5 px-4 text-slate-500 font-normal">
                      Contribution Profit - Operating Overhead
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right text-sm font-bold tracking-tight tabular-nums ${
                        profitability.netOperatingProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                      }`}
                    >
                      {formatINR(profitability.netOperatingProfit)}
                    </td>
                    <td className="py-3.5 px-4 text-right rounded-r-xl text-xs font-bold text-slate-900 tracking-tight tabular-nums">
                      {formatPercent(profitability.netOperatingMargin)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
