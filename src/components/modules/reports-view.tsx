"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePlatform } from "@/domain/store";
import { formatINR, formatPercent } from "@/lib/utils";
import { calculateOrderProfitability } from "@/domain/profitability-engine";
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
  const {
    orders,
    products,
    returns,
    settlements,
    claims,
    profitability,
    marketplaceBreakdown,
    skuBreakdown,
    selectedMarketplace,
  } = usePlatform();

  // Top-level Navigation: "analytics" (Analytics & Insights) vs "pnl" (P&L Ledger Statement)
  const [activeTab, setActiveTab] = useState<"analytics" | "pnl">("analytics");
  const [selectedChannel, setSelectedChannel] = useState<string>("All Channels");

  // Sync selectedChannel when global marketplace filter changes
  useEffect(() => {
    if (!selectedMarketplace || selectedMarketplace === "ALL") {
      setSelectedChannel("All Channels");
    } else if (selectedMarketplace === "Amazon India") {
      setSelectedChannel("Amazon");
    } else if (selectedMarketplace === "Personal Website") {
      setSelectedChannel("Website");
    } else {
      setSelectedChannel(selectedMarketplace);
    }
  }, [selectedMarketplace]);

  const channelFilteredOrders = useMemo(() => {
    if (selectedChannel === "All Channels") return orders;
    return orders.filter((o) => o.marketplace.toLowerCase().includes(selectedChannel.toLowerCase()));
  }, [orders, selectedChannel]);

  const channelFilteredReturns = useMemo(() => {
    if (selectedChannel === "All Channels") return returns;
    return returns.filter((r) => r.marketplace.toLowerCase().includes(selectedChannel.toLowerCase()));
  }, [returns, selectedChannel]);

  // ─── 1. Top Executive KPI Metrics ───
  const uniqueProductsCount = useMemo(() => {
    const activeOrderSkus = new Set(channelFilteredOrders.flatMap((o) => o.items.map((i) => i.sku)));
    return activeOrderSkus.size || (selectedChannel === "All Channels" ? products.length : 0);
  }, [channelFilteredOrders, products, selectedChannel]);

  const overallReturnMetrics = useMemo(() => {
    const totalOrdersCount = channelFilteredOrders.length;
    const customerReturns = channelFilteredReturns.filter((r) => r.returnType === "CUSTOMER_RETURN").length;
    const rtos = channelFilteredReturns.filter((r) => r.returnType === "RTO").length;

    const returnRate = totalOrdersCount > 0 ? (customerReturns / totalOrdersCount) * 100 : 0;
    const rtoRate = totalOrdersCount > 0 ? (rtos / totalOrdersCount) * 100 : 0;

    return {
      customerReturns,
      rtos,
      returnRate,
      rtoRate,
    };
  }, [channelFilteredOrders, channelFilteredReturns]);

  // ─── 2. Top Products (Ranked by Profit) ───
  const topProducts = useMemo(() => {
    let list = [...skuBreakdown];
    if (selectedChannel !== "All Channels") {
      list = list.filter((item) => {
        const itemOrders = channelFilteredOrders.filter((o) => o.items.some((i) => i.sku === item.sku));
        return itemOrders.length > 0;
      });
    }

    return list
      .sort((a, b) => b.profit - a.profit)
      .map((item, idx) => {
        const itemOrders = orders.filter((o) => o.items.some((i) => i.sku === item.sku));
        const platforms = Array.from(new Set(itemOrders.map((o) => o.marketplace)));
        const itemReturns = returns.filter((r) => r.sku === item.sku);

        return {
          rank: idx + 1,
          sku: item.sku,
          productName: item.productName,
          platforms: platforms.length > 0 ? platforms : ["Amazon India"],
          orders: itemOrders.length || item.unitsSold,
          unitsSold: item.unitsSold,
          revenue: item.revenue,
          profit: item.profit,
          margin: item.margin,
          returnsCount: itemReturns.length,
          returnRate: item.unitsSold > 0 ? (itemReturns.length / item.unitsSold) * 100 : 0,
        };
      });
  }, [skuBreakdown, orders, returns, selectedChannel, channelFilteredOrders]);

  // ─── 3. Platform Profit Comparison Data ───
  const platformProfitData = useMemo(() => {
    return marketplaceBreakdown.map((m) => {
      const mOrders = orders.filter((o) => o.marketplace === m.marketplace);
      return {
        platform: m.marketplace.replace(" India", ""),
        fullName: m.marketplace,
        profit: m.contributionProfit,
        revenue: m.revenue,
        cogs: m.cogs,
        fees: m.fees,
        margin: Number(m.margin.toFixed(1)),
        ordersCount: mOrders.length,
      };
    });
  }, [marketplaceBreakdown, orders]);

  // ─── 4. Return & RTO Rate by Platform Data ───
  const platformReturnRates = useMemo(() => {
    return marketplaceBreakdown.map((m) => {
      const mOrders = orders.filter((o) => o.marketplace === m.marketplace);
      const mReturns = returns.filter((r) => r.marketplace === m.marketplace);
      const customerReturns = mReturns.filter((r) => r.returnType === "CUSTOMER_RETURN").length;
      const rtos = mReturns.filter((r) => r.returnType === "RTO").length;

      const returnRate = mOrders.length > 0 ? (customerReturns / mOrders.length) * 100 : 0;
      const rtoRate = mOrders.length > 0 ? (rtos / mOrders.length) * 100 : 0;

      return {
        platform: m.marketplace.replace(" India", ""),
        fullName: m.marketplace,
        returnRate: Number(returnRate.toFixed(1)),
        rtoRate: Number(rtoRate.toFixed(1)),
        totalOrders: mOrders.length,
        customerReturns,
        rtos,
      };
    });
  }, [marketplaceBreakdown, orders, returns]);

  // ─── 5. Monthly Profit & Revenue Trend Data ───
  const monthlyData = useMemo(() => {
    const monthsMap: Record<
      string,
      { month: string; sortKey: string; revenue: number; profit: number; cogs: number; ordersCount: number }
    > = {};

    orders.forEach((o) => {
      const d = new Date(o.orderDate);
      if (isNaN(d.getTime())) return;
      const monthKey = d.toLocaleString("en-US", { month: "short", year: "numeric" }); // e.g. "Sep 2026"
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!monthsMap[sortKey]) {
        monthsMap[sortKey] = {
          month: monthKey,
          sortKey,
          revenue: 0,
          profit: 0,
          cogs: 0,
          ordersCount: 0,
        };
      }

      const pnl = calculateOrderProfitability(o, returns, settlements, claims);
      monthsMap[sortKey].revenue += pnl.grossSales;
      monthsMap[sortKey].profit += pnl.contributionProfit;
      monthsMap[sortKey].cogs += pnl.cogs;
      monthsMap[sortKey].ordersCount += 1;
    });

    const list = Object.values(monthsMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return list;
  }, [orders, returns, settlements, claims]);

  // ─── 6. Platform Summary Ledger ───
  const platformSummary = useMemo(() => {
    const summary = marketplaceBreakdown.map((m) => {
      const mOrders = orders.filter((o) => o.marketplace === m.marketplace);
      const mReturns = returns.filter((r) => r.marketplace === m.marketplace);
      const mSettlements = settlements.filter((s) => s.marketplace === m.marketplace);

      const grossSales = m.revenue;
      const actualSettled = mSettlements.reduce((sum, s) => sum + s.netSettlement, 0);
      const cogs = m.cogs;
      const returnsCount = mReturns.length;
      const returnRate = mOrders.length > 0 ? (returnsCount / mOrders.length) * 100 : 0;

      return {
        platform: m.marketplace,
        ordersCount: mOrders.length,
        grossSales,
        settlement: actualSettled || m.contributionProfit,
        cogs,
        profit: m.contributionProfit,
        margin: m.margin,
        returnsCount,
        returnRate,
      };
    });

    const totals = summary.reduce(
      (acc, curr) => ({
        ordersCount: acc.ordersCount + curr.ordersCount,
        grossSales: acc.grossSales + curr.grossSales,
        settlement: acc.settlement + curr.settlement,
        cogs: acc.cogs + curr.cogs,
        profit: acc.profit + curr.profit,
        returnsCount: acc.returnsCount + curr.returnsCount,
      }),
      { ordersCount: 0, grossSales: 0, settlement: 0, cogs: 0, profit: 0, returnsCount: 0 }
    );

    const totalMargin = totals.grossSales > 0 ? (totals.profit / totals.grossSales) * 100 : 0;
    const totalReturnRate = totals.ordersCount > 0 ? (totals.returnsCount / totals.ordersCount) * 100 : 0;

    return { summary, totals: { ...totals, margin: totalMargin, returnRate: totalReturnRate } };
  }, [marketplaceBreakdown, orders, returns, settlements]);

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
    return { bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80", dot: "bg-emerald-600" };
  };

  const getPlatformBarColor = (platformName: string) => {
    const name = platformName.toLowerCase();
    if (name.includes("amazon")) return "#F59E0B";
    if (name.includes("flipkart")) return "#2563EB";
    if (name.includes("meesho")) return "#EC4899";
    if (name.includes("blinkit")) return "#EAB308";
    if (name.includes("zepto")) return "#8B5CF6";
    return "#10B981";
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (activeTab === "analytics") {
      const headers = ["Rank", "SKU", "Product", "Orders", "Revenue", "Profit", "Margin", "Returns"];
      const rows = topProducts.map((p) => [
        p.rank,
        `"${p.sku}"`,
        `"${p.productName.replace(/"/g, '""')}"`,
        p.orders,
        p.revenue.toFixed(2),
        p.profit.toFixed(2),
        `${p.margin.toFixed(1)}%`,
        p.returnsCount,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-top-products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else {
      const headers = ["Metric", "Accounting Treatment", "Amount", "% Net Sales"];
      const rows = [
        ["Gross Sales", "Order Selling Price x Units", profitability.grossSales.toFixed(2), "100.0%"],
        ["Discounts", "Coupons & Promotional Deductions", (-profitability.discounts).toFixed(2), formatPercent(profitability.discounts / Math.max(1, profitability.grossSales))],
        ["Net Sales", "Gross Sales - Discounts", profitability.netSales.toFixed(2), "100.0%"],
        ["COGS", "Historical Snapshot Purchasing Cost", (-profitability.cogs).toFixed(2), formatPercent(profitability.cogs / Math.max(1, profitability.netSales))],
        ["Gross Profit", "Net Sales - COGS", profitability.grossProfit.toFixed(2), formatPercent(profitability.grossMargin)],
        ["Marketplace Fees", "Commissions and Fixed Closing Fees", (-profitability.marketplaceCharges).toFixed(2), formatPercent(profitability.marketplaceCharges / Math.max(1, profitability.netSales))],
        ["Return & RTO Losses", "Freight + Damage Write-offs", (-profitability.returnLosses - profitability.rtoLosses).toFixed(2), formatPercent((profitability.returnLosses + profitability.rtoLosses) / Math.max(1, profitability.netSales))],
        ["Dispute Claims", "SAFE-T and Carrier Recoveries", profitability.claimRecoveries.toFixed(2), formatPercent(profitability.claimRecoveries / Math.max(1, profitability.netSales))],
        ["Contribution Profit", "Gross Profit - Fees - Returns + Claims", profitability.contributionProfit.toFixed(2), formatPercent(profitability.contributionMargin)],
        ["Operating Overhead", "Advertising, Software, Fixed Overhead", (-profitability.operatingExpenses).toFixed(2), formatPercent(profitability.operatingExpenses / Math.max(1, profitability.netSales))],
        ["Net Operating Profit", "Contribution Profit - Operating Overhead", profitability.netOperatingProfit.toFixed(2), formatPercent(profitability.netOperatingMargin)],
      ];
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pnl-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* ─── Top Header & Controls Strip ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            {activeTab === "analytics" ? "Analytics & Insights" : "Statement of Profit & Loss (P&L)"}
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            {activeTab === "analytics"
              ? "Deep-dive into platform performance, product profitability, and return trends."
              : "Audit-grade multi-dimensional profitability statements and accounting ledger."}
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
                  Overall Return Rate
                </span>
                <div className="text-2xl font-semibold text-amber-600 tracking-tight tabular-nums">
                  {overallReturnMetrics.returnRate.toFixed(1)}%
                </div>
                <span className="text-[11px] text-[#86868B] block">
                  {overallReturnMetrics.customerReturns} customer returns logged
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
                  {overallReturnMetrics.rtoRate.toFixed(1)}%
                </div>
                <span className="text-[11px] text-[#86868B] block">
                  {overallReturnMetrics.rtos} courier rejections in transit
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
                  Top Products (Ranked by Profit)
                </h3>
              </div>
              <p className="text-xs text-[#86868B] mt-1">
                SKU-level profit analysis across all platforms
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
                      <th className="py-3 px-4 text-right">ORDERS</th>
                      <th className="py-3 px-4 text-right">REVENUE</th>
                      <th className="py-3 px-4 text-right">PROFIT</th>
                      <th className="py-3 px-4 text-right">MARGIN</th>
                      <th className="py-3 px-4 text-right">RETURNS</th>
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
                              {p.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                            {p.returnsCount > 0 ? (
                              <span className="text-[#D70015] font-semibold">
                                {p.returnsCount}{" "}
                                <span className="text-[10px] text-[#86868B] font-normal">({p.returnRate.toFixed(1)}%)</span>
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
                        formatter={(value: any) => [formatINR(Number(value)), "Net Profit"]}
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
                  Percentage of orders returned or RTO&apos;d per platform
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
                        name === "revenue" ? "Gross Revenue" : "Net Profit",
                      ]}
                      labelStyle={{ fontWeight: 600, color: "#1D1D1F" }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: "10px", fontSize: "11px" }}
                      formatter={(value) => (value === "revenue" ? "Gross Revenue" : "Net Profit")}
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
                Consolidated performance metrics per marketplace
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
                      <th className="py-3 px-4 text-right">ORDERS</th>
                      <th className="py-3 px-4 text-right">GROSS SALES</th>
                      <th className="py-3 px-4 text-right">SETTLEMENT</th>
                      <th className="py-3 px-4 text-right">COGS</th>
                      <th className="py-3 px-4 text-right">PROFIT</th>
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
                              {row.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                            {row.returnsCount > 0 ? (
                              <span className="text-[#D70015] font-semibold">
                                {row.returnsCount}{" "}
                                <span className="text-[10px] text-[#86868B] font-normal">({row.returnRate.toFixed(1)}%)</span>
                              </span>
                            ) : (
                              <span className="text-[#86868B] font-normal">0 (0.0%)</span>
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
                        +{formatINR(platformSummary.totals.profit)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-950 tabular-nums">
                          {platformSummary.totals.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium tabular-nums text-[#6E6E73]">
                        {platformSummary.totals.returnsCount}{" "}
                        <span className="text-[10px] text-[#86868B] font-normal">
                          ({platformSummary.totals.returnRate.toFixed(1)}%)
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
                  Statement of Profit &amp; Loss (GAAP Ledger)
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Audit-ready financial waterfall statement with standardized accounting treatment.
                </p>
              </div>
              <span className="text-xs text-[#288548] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold tabular-nums">
                Net Margin: {formatPercent(profitability.netOperatingMargin)}
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
                    <td className="py-3 px-4 text-[#86868B]">Order Selling Price × Units</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.grossSales)}</td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">100.0%</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Discounts &amp; Promotions</td>
                    <td className="py-3 px-4 text-[#86868B]">Channel coupon allowances</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
                      -{formatINR(profitability.discounts)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent(profitability.discounts / Math.max(1, profitability.grossSales))}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className="py-3 px-4">Net Sales</td>
                    <td className="py-3 px-4 text-[#86868B] font-normal">Gross Sales - Discounts</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.netSales)}</td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">100.0%</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Cost of Goods Sold (COGS)</td>
                    <td className="py-3 px-4 text-[#86868B]">Snapshot historical purchasing cost</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      -{formatINR(profitability.cogs)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent(profitability.cogs / Math.max(1, profitability.netSales))}
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
                      -{formatINR(profitability.marketplaceCharges)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent(profitability.marketplaceCharges / Math.max(1, profitability.netSales))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Return, RTO &amp; Damage Losses</td>
                    <td className="py-3 px-4 text-[#86868B]">Reverse logistics shipping + write-offs</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                      -{formatINR(profitability.returnLosses + profitability.rtoLosses)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent((profitability.returnLosses + profitability.rtoLosses) / Math.max(1, profitability.netSales))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-600">Dispute Claim Recoveries</td>
                    <td className="py-3 px-4 text-[#86868B]">SAFE-T and carrier reimbursements</td>
                    <td className="py-3 px-4 text-right text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                      +{formatINR(profitability.claimRecoveries)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent(profitability.claimRecoveries / Math.max(1, profitability.netSales))}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className="py-3 px-4 text-[#1D1D1F]">Contribution Profit</td>
                    <td className="py-3 px-4 text-[#86868B] font-normal">
                      Gross Profit - Fees - Return Losses + Claims
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
                      -{formatINR(profitability.operatingExpenses)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-[#86868B] tracking-tight tabular-nums">
                      {formatPercent(profitability.operatingExpenses / Math.max(1, profitability.netSales))}
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
