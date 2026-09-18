"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
import {
  Marketplace,
  Order,
  ReturnRecord,
  PurchaseBill,
  Claim,
  ProductCondition,
  ReturnType,
  Settlement,
} from "@/domain/types";
import { NavModule } from "@/components/layout/sidebar";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Search,
  ArrowUpDown,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  RotateCcw,
  Truck,
  Check,
} from "lucide-react";
import { DateRangePreset } from "@/domain/profitability-engine";
import { OrderModal } from "@/components/modals/order-modal";
import { RecordReturnModal } from "@/components/modals/record-return-modal";
import { AddPurchaseModal } from "@/components/modals/add-purchase-modal";
import {
  CardLogicModal,
  CardLogicModalData,
  getCardLogicDefinitions,
} from "@/components/modals/card-logic-modal";
import { SkuDrawer } from "@/components/modals/sku-drawer";

interface DashboardViewProps {
  selectedMarketplace?: Marketplace | "ALL";
  onSelectModule?: (module: NavModule) => void;
}

export function DashboardView({
  selectedMarketplace: propMarketplace,
  onSelectModule,
}: DashboardViewProps = {}) {
  const {
    selectedMarketplace: contextMarketplace,
    profitability,
    profitabilityTrends,
    marketplaceBreakdown,
    skuBreakdown,
    datePreset,
    setDatePreset,
    customDateRange,
    setCustomDateRange,
    orders,
    returns,
    claims,
    products,
    suppliers,
    purchases,
    addOrder,
    addReturn,
    addPurchase,
    addClaim,
    addSettlement,
  } = usePlatform();

  const selectedMarketplace = propMarketplace ?? contextMarketplace;

  // Dual-Mode Financial View State: "OPERATOR" (Cash & Payouts) vs "CFO" (GAAP Hierarchy)
  const [viewMode, setViewMode] = useState<"OPERATOR" | "CFO">("OPERATOR");

  // Card Logic Inspection Modal State
  const [activeLogicModal, setActiveLogicModal] = useState<CardLogicModalData | null>(null);

  // Quick Action Dialog States
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isRecordReturnOpen, setIsRecordReturnOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

  // SKU Table Search, Sort & Slide-Over Drawer State
  const [skuSearch, setSkuSearch] = useState("");
  const [skuSortBy, setSkuSortBy] = useState<"profit" | "revenue" | "unitsSold" | "margin" | "returnRate">("profit");
  const [skuSortOrder, setSkuSortOrder] = useState<"asc" | "desc">("desc");
  const [skuFilter, setSkuFilter] = useState<"ALL" | "PROFITABLE" | "LOSS_MAKING">("ALL");
  const [selectedSkuForDrawer, setSelectedSkuForDrawer] = useState<typeof skuBreakdown[0] | null>(null);

  const scrollToSkuTable = () => {
    const el = document.getElementById("sku-economics-table");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const exportSkuCsv = () => {
    const headers = [
      "SKU",
      "Product Name",
      "Units Sold",
      "Net Revenue (INR)",
      "COGS (INR)",
      "Marketplace Deductions (INR)",
      "Return Losses (INR)",
      "Net Contribution (INR)",
      "Margin %",
      "Ad Spend (INR)",
      "POAS",
      "Return Rate %",
    ];
    const rows = processedSkus.map((s) => [
      `"${s.sku}"`,
      `"${s.productName.replace(/"/g, '""')}"`,
      s.unitsSold,
      s.revenue,
      s.cogs,
      s.marketplaceCharges,
      s.returnLosses,
      s.profit,
      (s.margin * 100).toFixed(1) + "%",
      s.adSpend || 0,
      s.poas !== undefined ? s.poas + "x" : "N/A",
      (s.returnRate * 100).toFixed(1) + "%",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sku_economics_${datePreset.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Channel Identity Palette
  const CHANNEL_PALETTE: Record<string, { fill: string; bg: string; text: string }> = {
    "Amazon India": { fill: "#F59E0B", bg: "bg-amber-500/10", text: "text-amber-700" },
    Flipkart: { fill: "#3B82F6", bg: "bg-blue-500/10", text: "text-blue-700" },
    Meesho: { fill: "#EC4899", bg: "bg-pink-500/10", text: "text-pink-700" },
    "Personal Website": { fill: "#10B981", bg: "bg-emerald-500/10", text: "text-emerald-700" },
  };

  const channelChartData = useMemo(() => {
    return marketplaceBreakdown.map((m) => ({
      name: m.marketplace.replace(" India", "").replace("Personal ", ""),
      Revenue: m.revenue,
      COGS: m.cogs,
      Fees: m.fees + m.logistics,
      Profit: m.contributionProfit,
    }));
  }, [marketplaceBreakdown]);

  const lossMakingSkus = useMemo(() => {
    return skuBreakdown.filter((s) => s.profit < 0);
  }, [skuBreakdown]);

  // Filtered & Sorted SKUs
  const processedSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    return skuBreakdown
      .filter((s) => {
        if (q !== "") {
          const matchesSearch =
            s.sku.toLowerCase().includes(q) ||
            s.productName.toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        if (skuFilter === "PROFITABLE") return s.profit > 0;
        if (skuFilter === "LOSS_MAKING") return s.profit < 0;
        return true;
      })
      .sort((a, b) => {
        const valA = a[skuSortBy];
        const valB = b[skuSortBy];
        return skuSortOrder === "asc" ? valA - valB : valB - valA;
      });
  }, [skuBreakdown, skuSearch, skuFilter, skuSortBy, skuSortOrder]);

  const handleSort = (field: typeof skuSortBy) => {
    if (skuSortBy === field) {
      setSkuSortOrder(skuSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSkuSortBy(field);
      setSkuSortOrder("desc");
    }
  };

  // Custom Date-Range Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(customDateRange?.startDate || "2026-09-01");
  const [customEndDate, setCustomEndDate] = useState(customDateRange?.endDate || "2026-09-07");
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (customDateRange) {
      setCustomStartDate(customDateRange.startDate);
      setCustomEndDate(customDateRange.endDate);
    }
  }, [customDateRange]);

  const latestOrderDate = useMemo(() => {
    if (orders.length === 0) return "2026-09-07";
    return orders.reduce((max, o) => (o.orderDate > max ? o.orderDate : max), orders[0].orderDate);
  }, [orders]);

  const quickShortcuts = useMemo(() => {
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const anchor = new Date(latestOrderDate + "T00:00:00");
    const anchorYear = anchor.getFullYear();
    const anchorMonth = anchor.getMonth();

    const d7 = new Date(anchor);
    d7.setDate(d7.getDate() - 6);

    const d14 = new Date(anchor);
    d14.setDate(d14.getDate() - 13);

    const d30 = new Date(anchor);
    d30.setDate(d30.getDate() - 29);

    const thisMonthStart = new Date(anchorYear, anchorMonth, 1);
    const thisMonthEnd = new Date(anchorYear, anchorMonth + 1, 0);

    const lastMonthStart = new Date(anchorYear, anchorMonth - 1, 1);
    const lastMonthEnd = new Date(anchorYear, anchorMonth, 0);

    return [
      { label: "Today", start: latestOrderDate, end: latestOrderDate },
      { label: "Last 7 Days", start: formatDate(d7), end: latestOrderDate },
      { label: "Last 14 Days", start: formatDate(d14), end: latestOrderDate },
      { label: "Last 30 Days", start: formatDate(d30), end: latestOrderDate },
      { label: "This Month", start: formatDate(thisMonthStart), end: formatDate(thisMonthEnd) },
      { label: "Last Month", start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) },
    ];
  }, [latestOrderDate]);

  const formatDateSimple = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const [calendarViewMonth, setCalendarViewMonth] = useState(() => {
    if (customDateRange?.startDate) {
      const [y, m] = customDateRange.startDate.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) return new Date(y, m - 1, 1);
    }
    return new Date(2026, 8, 1); // September 2026
  });

  useEffect(() => {
    if (isCalendarOpen && customStartDate) {
      const [y, m] = customStartDate.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setCalendarViewMonth(new Date(y, m - 1, 1));
      }
    }
  }, [isCalendarOpen]);

  const handleCalendarDayClick = (dateStr: string) => {
    if (!customStartDate || (customStartDate && customEndDate)) {
      setCustomStartDate(dateStr);
      setCustomEndDate("");
    } else if (customStartDate && !customEndDate) {
      if (dateStr < customStartDate) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(dateStr);
      } else {
        setCustomEndDate(dateStr);
      }
    }
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: ({
      dateStr: string;
      dayNum: number;
      isStart: boolean;
      isEnd: boolean;
      isInRange: boolean;
    } | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isStart = customStartDate === dateStr;
      const isEnd = customEndDate === dateStr;
      const isInRange = Boolean(
        customStartDate &&
        customEndDate &&
        dateStr > customStartDate &&
        dateStr < customEndDate
      );
      days.push({ dateStr, dayNum: d, isStart, isEnd, isInRange });
    }

    return days;
  }, [calendarViewMonth, customStartDate, customEndDate]);

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: "ALL", label: "All Time" },
    { id: "TODAY", label: "Today" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "LAST_30_DAYS", label: "Last 30 Days" },
    { id: "THIS_MONTH", label: "This Month" },
    { id: "PREVIOUS_MONTH", label: "Last Month" },
  ];

  // Logic definitions for each card
  const {
    grossSalesLogic,
    trueProfitLogic,
    netProfitLogic,
    returnsRtoLogic,
    wholesalerCogsLogic,
    damagedClaimsLogic,
    netRevenueLogic,
    grossProfitLogic,
    contributionProfitLogic,
    netOperatingProfitLogic,
  } = useMemo(() => {
    const defs = getCardLogicDefinitions(profitability);
    return {
      grossSalesLogic: defs.grossSales,
      trueProfitLogic: defs.trueProfit,
      netProfitLogic: defs.netProfit,
      returnsRtoLogic: defs.returnsRto,
      wholesalerCogsLogic: defs.wholesalerCogs,
      damagedClaimsLogic: defs.damagedClaims,
      netRevenueLogic: defs.netRevenue,
      grossProfitLogic: defs.grossProfit,
      contributionProfitLogic: defs.contributionProfit,
      netOperatingProfitLogic: defs.netOperatingProfit,
    };
  }, [profitability]);

  return (
    <div className="space-y-6 w-full max-w-[1536px] mx-auto animate-in fade-in duration-300">
      {/* ─── Top Header & Controls Area ─── */}
      <div className="space-y-4 pb-1">
        {/* Row 1: Title & Live Status Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Financial Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time dynamic ecommerce profit &amp; settlement tracker across multi-channel marketplaces.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold whitespace-nowrap shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Calculations synced in real-time
            </span>
          </div>
        </div>

        {/* Row 2: Dedicated Control Toolbar Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
          {/* Left: Mode Switcher & Channel Filter */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Dual-Mode View Switcher (Image 2 Pill Control) */}
            <div className="inline-flex items-center bg-[#F1F3F5] p-1 rounded-full border border-slate-200/50">
              <button
                onClick={() => setViewMode("OPERATOR")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  viewMode === "OPERATOR"
                    ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
                title="Switch to Operator View (Cash-Flow, Wholesaler Liabilities & Platform Payouts)"
              >
                Operator Payout View
              </button>
              <button
                onClick={() => setViewMode("CFO")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  viewMode === "CFO"
                    ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
                title="Switch to CFO View (GAAP Margin Hierarchy & Unit Economics)"
              >
                CFO / Unit Economics
              </button>
            </div>

            {/* Channel Filter Badge */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 text-slate-700 text-xs font-semibold shadow-xs">
              <span className="text-slate-400 font-normal">Channel:</span>
              <span className="text-blue-700">{selectedMarketplace === "ALL" ? "All Channels" : selectedMarketplace}</span>
            </div>
          </div>

          {/* Right: Date-Range Selector & Interactive Custom Calendar Popover */}
          <div ref={calendarRef} className="relative self-start md:self-auto">
            <div className="flex items-center bg-[#F1F3F5] border border-slate-200/50 rounded-full p-1 text-xs max-w-full">
              {/* Interactive Calendar Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  isCalendarOpen || datePreset === "CUSTOM"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
                title="Open Custom Date Picker"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Custom</span>
              </button>

              {/* Active Custom Range Indicator Pill */}
              {datePreset === "CUSTOM" && customDateRange && (
                <div className="flex items-center gap-1.5 ml-1 mr-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-xs font-semibold">
                  <span className="tabular-nums tracking-tight">
                    {formatDateSimple(customDateRange.startDate)} → {formatDateSimple(customDateRange.endDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("ALL");
                      setCustomDateRange(null);
                    }}
                    className="hover:text-purple-950 p-0.5 rounded-full hover:bg-purple-200 transition-colors"
                    title="Clear custom filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Preset Buttons */}
              <div className="flex items-center gap-0.5 ml-1">
                {presets.map((p) => {
                  const isSelected = datePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDatePreset(p.id);
                        setCustomDateRange(null);
                        setIsCalendarOpen(false);
                      }}
                      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                        isSelected
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-slate-600 hover:text-slate-900 font-medium"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Range Popover */}
            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-2 w-[320px] sm:w-[350px] bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Clean Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">Select Date Range</h4>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Range Shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[
                    { label: "7 Days", start: quickShortcuts[1].start, end: quickShortcuts[1].end },
                    { label: "14 Days", start: quickShortcuts[2].start, end: quickShortcuts[2].end },
                    { label: "30 Days", start: quickShortcuts[3].start, end: quickShortcuts[3].end },
                    { label: "This Month", start: quickShortcuts[4].start, end: quickShortcuts[4].end },
                  ].map((sc) => {
                    const isActive = customStartDate === sc.start && customEndDate === sc.end;
                    return (
                      <button
                        key={sc.label}
                        type="button"
                        onClick={() => {
                          setCustomStartDate(sc.start);
                          setCustomEndDate(sc.end);
                          const [y, m] = sc.start.split("-").map(Number);
                          if (!isNaN(y) && !isNaN(m)) {
                            setCalendarViewMonth(new Date(y, m - 1, 1));
                          }
                        }}
                        className={`py-1 text-[11px] font-semibold rounded-xl transition-all text-center cursor-pointer ${
                          isActive
                            ? "bg-purple-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>

                {/* Interactive Month Navigation */}
                <div className="flex items-center justify-between px-1 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarViewMonth(
                        new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth() - 1, 1)
                      );
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-800">
                    {calendarViewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarViewMonth(
                        new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth() + 1, 1)
                      );
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <span key={day} className="text-[10px] font-bold text-slate-400 uppercase">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                  {calendarDays.map((d, idx) => {
                    if (!d) {
                      return <div key={`empty-${idx}`} className="h-7 w-full" />;
                    }
                    const { dateStr, dayNum, isStart, isEnd, isInRange } = d;
                    const isSelectedEndpoint = isStart || isEnd;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleCalendarDayClick(dateStr)}
                        className={`h-7 w-full text-xs flex items-center justify-center transition-all cursor-pointer ${
                          isSelectedEndpoint
                            ? "bg-purple-600 text-white font-bold rounded-lg shadow-xs"
                            : isInRange
                            ? "bg-purple-100 text-purple-900 font-semibold rounded-none first:rounded-l-lg last:rounded-r-lg"
                            : "text-slate-700 hover:bg-slate-100 rounded-lg font-medium"
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Range Display */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs mb-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>From:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {customStartDate ? formatDateSimple(customStartDate) : "Select date"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>To:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {customEndDate
                        ? formatDateSimple(customEndDate)
                        : customStartDate
                        ? formatDateSimple(customStartDate)
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Clean Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("ALL");
                      setCustomDateRange(null);
                      setIsCalendarOpen(false);
                    }}
                    className="px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Reset (All Time)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const s = customStartDate;
                      const e = customEndDate || customStartDate;
                      if (s && e) {
                        const start = s <= e ? s : e;
                        const end = e >= s ? e : s;
                        setCustomDateRange({ startDate: start, endDate: end });
                        setDatePreset("CUSTOM");
                        setIsCalendarOpen(false);
                      }
                    }}
                    disabled={!customStartDate}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply Range
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── DUAL-MODE PRIMARY KPI SECTION ─── */}
      {viewMode === "OPERATOR" ? (
        /* ─── OPTION B: OPERATOR CASH-FLOW VIEW (6-CARD GRID MATCHING SCREENSHOT) ─── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: GROSS SALES */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                GROSS SALES
              </span>
              <button
                onClick={() => setActiveLogicModal(grossSalesLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view Gross Sales calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {formatINR(profitability.grossSales)}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                {profitability.totalOrders} total orders logged
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
              Total sales catalog value of all logged orders
            </div>
          </div>

          {/* Card 2: TRUE PROFIT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                TRUE PROFIT
              </span>
              <button
                onClick={() => setActiveLogicModal(trueProfitLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view True Profit calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {formatINR(profitability.trueProfit)}
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">
                {formatPercent(profitability.grossSales > 0 ? profitability.trueProfit / profitability.grossSales : 0)} margin on sales
              </div>
            </div>
            <div className="text-[11px] text-purple-700 font-medium pt-2.5 border-t border-slate-100">
              Platform payout AFTER returns and claims, AFTER paying supplier COGS
            </div>
          </div>

          {/* Card 3: NET PROFIT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                NET PROFIT
              </span>
              <button
                onClick={() => setActiveLogicModal(netProfitLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-400 hover:text-purple-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view Net Profit calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {formatINR(profitability.netPlatformPayout)}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Exp: {formatINR(profitability.operatingExpenses)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
              Platform payout AFTER returns and claims, BEFORE paying supplier COGS
            </div>
          </div>

          {/* Card 4: RETURNS & RTO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                RETURNS &amp; RTO
              </span>
              <button
                onClick={() => setActiveLogicModal(returnsRtoLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view Returns & RTO calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {profitability.rtoCount + profitability.customerReturnCount}{" "}
                <span className="text-base font-normal text-slate-500">
                  ({formatPercent(profitability.returnRate)})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-1 font-semibold">
                <span className="text-slate-600">RTO: {profitability.rtoCount}</span>
                <span className="text-rose-600">Cust Ret: {profitability.customerReturnCount}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span>Total customer return fee deductions &amp; RTO logs</span>
              <span className="text-rose-600 font-semibold">
                -{formatINR(profitability.returnLosses + profitability.rtoLosses)}
              </span>
            </div>
          </div>

          {/* Card 5: WHOLESALER COST (COGS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                WHOLESALER COST (COGS)
              </span>
              <button
                onClick={() => setActiveLogicModal(wholesalerCogsLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view Wholesaler COGS calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
                {formatINR(profitability.cogs)}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Product inventory cost ({profitability.totalUnitsSold} units sold)
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
              Total purchase cost payable to wholesale suppliers
            </div>
          </div>

          {/* Card 6: DAMAGED CLAIMS RECOVERY */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                DAMAGED CLAIMS RECOVERY
              </span>
              <button
                onClick={() => setActiveLogicModal(damagedClaimsLogic)}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Click to view Damaged Claims calculation logic & formula"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-2xl font-semibold text-amber-600 tracking-tight">
                {formatINR(profitability.claimRecoveries)}
              </div>
              <div className="flex items-center justify-between text-xs mt-1 font-medium text-slate-500">
                <span>Pending: {formatINR(profitability.pendingClaimsAmount)}</span>
                <span className="text-slate-600 font-semibold">{profitability.damagedUnitsCount} damaged</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
              Reimbursements received from platforms for damage disputes
            </div>
          </div>
        </div>
      ) : (
        /* ─── CFO / UNIT ECONOMICS GAAP VIEW (4 TOP CARDS + 7 SECONDARY METRICS) ─── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Net Revenue</span>
                <button
                  onClick={() => setActiveLogicModal(netRevenueLogic)}
                  className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Inspect Net Revenue Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
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
                <button
                  onClick={() => setActiveLogicModal(grossProfitLogic)}
                  className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Inspect Gross Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-2xl font-semibold text-[#288548] tracking-tight">
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
                <button
                  onClick={() => setActiveLogicModal(contributionProfitLogic)}
                  className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Inspect Contribution Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
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
                <button
                  onClick={() => setActiveLogicModal(netOperatingProfitLogic)}
                  className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Inspect Net Operating Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div
                  className={`text-2xl font-semibold tracking-tight ${
                    profitability.netOperatingProfit >= 0 ? "text-[#1D1D1F]" : "text-[#D70015]"
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

          {/* Secondary Operational Metrics & POAS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Volume */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Volume</span>
              </div>
              <div><span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{profitability.totalOrders}</span><span className="text-xs text-slate-400 ml-1">orders</span></div>
              <div className="text-[11px] text-slate-500 tabular-nums">{profitability.totalUnitsSold} <span className="text-slate-400">units sold</span></div>
              <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-[10px] font-semibold text-blue-600">Total volume</span></div>
            </div>

            {/* POAS & Ad Spend */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">POAS / Ads</span>
              </div>
              <div>
                <span className={`text-xl font-semibold tracking-tight tabular-nums ${profitability.poas >= 1.0 ? "text-[#288548]" : "text-amber-600"}`}>
                  {profitability.poas > 0 ? `${profitability.poas}x` : "N/A"}
                </span>
                <span className="text-xs text-slate-400 ml-1">POAS</span>
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                Spend: {formatINR(profitability.totalAdSpend)}
              </div>
              <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${profitability.poas >= 1.0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {profitability.poas >= 1.0 ? "Profitable Scale" : "High Ad Drag"}
                </span>
              </div>
            </div>

            {/* Settlement Received */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Settlement</span>
              </div>
              <div className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums">{formatINR(profitability.actualSettlementsReceived)}</div>
              <div className="text-[11px] text-slate-500">Inflow received</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-emerald-600">Deposited in bank</span></div>
            </div>

            {/* Marketplace Fees */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mkt. Fees</span>
              </div>
              <div className="text-xl font-semibold text-[#D70015] tracking-tight tabular-nums">{formatINR(profitability.marketplaceCharges)}</div>
              <div className="text-[11px] text-slate-500">Total deducted</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-rose-600">Commissions &amp; fixed</span></div>
            </div>

            {/* Returns & RTO */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Returns</span>
              </div>
              <div className="text-xl font-semibold text-amber-600 tracking-tight tabular-nums">{formatINR(profitability.returnLosses + profitability.rtoLosses)}</div>
              <div className="text-[11px] text-slate-500">Return + RTO loss</div>
              <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-[10px] font-semibold text-amber-600">Rate: {formatPercent(profitability.returnRate)}</span></div>
            </div>

            {/* Dispute Recoveries */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Disputes</span>
              </div>
              <div className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.claimRecoveries)}</div>
              <div className="text-[11px] text-slate-500">Recovered so far</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-indigo-600">SAFE-T Credits</span></div>
            </div>

            {/* Damaged Write-offs */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Write-offs</span>
              </div>
              <div className="text-xl font-semibold text-slate-700 tracking-tight tabular-nums">{formatINR(profitability.damageLosses)}</div>
              <div className="text-[11px] text-slate-500">Damaged inventory</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-slate-500">Physical scrap</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK RECORD ACTIONS DOCKED TOOLBAR ─── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900 tracking-tight">Quick Actions</span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500">Instant entries to platform ledger</span>
        </div>

        {/* Pill Segmented Control matching Navbar options */}
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-slate-200/50 inline-flex items-center gap-0.5 text-xs w-full sm:w-auto">
          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-700" />
            <span>Add Order</span>
          </button>
          <button
            onClick={() => setIsRecordReturnOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Record Return</span>
          </button>
          <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:scale-95 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Supplier Payment</span>
          </button>
        </div>
      </div>

      {/* Visual Analytics with Color-Coded Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Economics Bar Chart */}
        <div className="lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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
          <div className="h-72 w-full min-w-0">
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
        <div className="min-w-0 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
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
            <div
              onClick={() => {
                setSkuFilter("LOSS_MAKING");
                setSkuSearch("");
                scrollToSkuTable();
              }}
              className="cursor-pointer hover:underline"
            >
              <span className="font-bold text-amber-950">Loss-Making SKU Advisory: </span>
              <span className="text-amber-900">
                {lossMakingSkus.length} product SKU operates at a negative contribution margin after reverse logistics shipping &amp; damage write-offs. (Click to filter table)
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {lossMakingSkus.map((s) => (
                <button
                  key={s.sku}
                  onClick={() => {
                    setSkuSearch(s.sku);
                    setSkuFilter("ALL");
                    scrollToSkuTable();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 font-mono text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  title="Click to view this SKU in table"
                >
                  <span>{s.sku}:</span>
                  <span className="text-rose-600">{formatINR(s.profit)}</span>
                  <ChevronRight className="w-3 h-3 text-amber-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Interactive SKU Economics Deep-Dive Table ─── */}
      <div id="sku-economics-table" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
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
              Net revenue, COGS, marketplace charges, return losses, and true contribution margin per SKU. Click any row to inspect unit breakdown.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search Input */}
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 focus:outline-none focus:border-slate-400 transition"
              />
            </div>

            {/* Filter Pills (Image 2 Pill Control) */}
            <div className="flex items-center p-1 bg-[#F1F3F5] rounded-full border border-slate-200/50 gap-0.5">
              <button
                onClick={() => setSkuFilter("ALL")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all ${
                  skuFilter === "ALL"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSkuFilter("PROFITABLE")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all ${
                  skuFilter === "PROFITABLE"
                    ? "bg-white text-emerald-700 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                Profitable
              </button>
              <button
                onClick={() => setSkuFilter("LOSS_MAKING")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all ${
                  skuFilter === "LOSS_MAKING"
                    ? "bg-white text-rose-700 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                Loss-Making
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={exportSkuCsv}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-xs transition"
              title="Download SKU unit economics as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
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
                    <tr
                      key={s.sku}
                      onClick={() => setSelectedSkuForDrawer(s)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      title="Click to inspect unit economics"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="font-mono font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors">
                            {s.sku}
                          </div>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 font-semibold flex items-center transition-opacity">
                            Inspect <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{s.productName}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                        {s.unitsSold} <span className="text-[10px] text-slate-400 font-normal">units</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                        {formatINR(s.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
                        {formatINR(s.cogs)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
                        -{formatINR(s.marketplaceCharges)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-amber-600 tracking-tight tabular-nums">
                        {s.returnLosses > 0 ? `-${formatINR(s.returnLosses)}` : "₹0"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold tracking-tight tabular-nums ${isLoss ? "text-[#D70015]" : "text-[#288548]"}`}>
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
          <span>Click any row to open the SKU unit economics drilldown. Click column headers to sort.</span>
          <span className="font-medium text-slate-600">
            Total Analyzed Contribution Profit:{" "}
            <span
              className={`font-bold tabular-nums font-mono ${
                profitability.contributionProfit >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {formatINR(profitability.contributionProfit)}
            </span>
          </span>
        </div>
      </div>

      <SkuDrawer
        skuData={selectedSkuForDrawer}
        onClose={() => setSelectedSkuForDrawer(null)}
      />

      {/* ─── CARD LOGIC INSPECTION MODAL ─── */}
      <CardLogicModal
        data={activeLogicModal}
        onClose={() => setActiveLogicModal(null)}
      />

      {/* ─── QUICK ACTION: ADD ORDER MODAL ─── */}
      <OrderModal
        mode="create"
        isOpen={isAddOrderOpen}
        onClose={() => setIsAddOrderOpen(false)}
        products={products}
        suppliers={suppliers}
        onAddOrder={addOrder}
        onAddSettlement={addSettlement}
        onAddReturn={addReturn}
        onAddClaim={addClaim}
      />

      {/* ─── QUICK ACTION: RECORD RETURN MODAL ─── */}
      <RecordReturnModal
        isOpen={isRecordReturnOpen}
        onClose={() => setIsRecordReturnOpen(false)}
        orders={orders}
        onAddReturn={(ret) => addReturn(ret)}
      />

      {/* ─── QUICK ACTION: ADD SUPPLIER PAYMENT MODAL ─── */}
      <AddPurchaseModal
        isOpen={isAddPurchaseOpen}
        onClose={() => setIsAddPurchaseOpen(false)}
        suppliers={suppliers}
        products={products}
        onAddPurchase={(purchase) => addPurchase(purchase)}
      />
    </div>
  );
}