"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  Package,
  AlertTriangle,
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
    currentUser,
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
    settlements,
    suppliers,
    purchases,
    inventoryMetrics,
    feesBreakdown,
    claimsSummary,
    settlementSummary,
    addOrder,
    addReturn,
    addPurchase,
    addClaim,
    addSettlement,
  } = usePlatform();

  const selectedMarketplace = propMarketplace ?? contextMarketplace;

  // Dynamic time and date for live greeting
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(currentTime).toUpperCase();
  const userName = currentUser?.name?.split(" ")[0] || "Ujjaval";

  // Dual-Mode Financial View State: "OPERATOR" (Cash & Payouts) vs "CFO" (GAAP Hierarchy)
  const [viewMode, setViewMode] = useState<"OPERATOR" | "CFO">("OPERATOR");

  // Mounted state to guarantee Recharts renders properly on client without zero-dimension collapse
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Card Logic Inspection Modal State with Real-Time Dynamic Re-evaluation
  const [activeLogicKey, setActiveLogicKey] = useState<string | null>(null);
  const cardLogicDefinitions = useMemo(() => getCardLogicDefinitions(profitability), [profitability]);
  const activeLogicModal = activeLogicKey ? cardLogicDefinitions[activeLogicKey] : null;
  const setActiveLogicModal = useCallback((data: CardLogicModalData | null) => {
    if (!data) {
      setActiveLogicKey(null);
      return;
    }
    const foundKey = Object.keys(cardLogicDefinitions).find(
      (k) => cardLogicDefinitions[k].title === data.title
    );
    setActiveLogicKey(foundKey || null);
  }, [cardLogicDefinitions]);

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

  // Tonal Green Monochrome Palette (matching user reference specification)
  const TONAL_GREEN_SCALE = [
    "#0B4D1F", // Dominant / Forest Green
    "#1F8A3A", // Rich Emerald
    "#34C759", // Vibrant Apple Green
    "#7FDC95", // Soft Sage
    "#C9EED2", // Pale Mint
  ];

  const sortedMarketplaceBreakdown = [...marketplaceBreakdown]
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .map((item, index) => ({
      ...item,
      color: TONAL_GREEN_SCALE[index % TONAL_GREEN_SCALE.length],
    }));

  const activeChannels = sortedMarketplaceBreakdown.filter((m) => (m.revenue || 0) > 0);
  const channelPieData =
    activeChannels.length > 0
      ? activeChannels
      : [{ marketplace: "No Revenue", revenue: 1, color: "#E5E5EA" }];

  const totalChannelRevenue = marketplaceBreakdown.reduce((sum, m) => sum + (m.revenue || 0), 0);

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

  // SKU Table Pagination (Max 10 records per chapter/page)
  const [skuPage, setSkuPage] = useState(1);
  const SKU_PAGE_SIZE = 10;

  useEffect(() => {
    setSkuPage(1);
  }, [skuSearch, skuFilter]);

  const totalSkuPages = Math.max(1, Math.ceil(processedSkus.length / SKU_PAGE_SIZE));
  const paginatedSkus = useMemo(() => {
    const start = (skuPage - 1) * SKU_PAGE_SIZE;
    return processedSkus.slice(start, start + SKU_PAGE_SIZE);
  }, [processedSkus, skuPage, SKU_PAGE_SIZE]);

  const handleSort = (field: typeof skuSortBy) => {
    if (skuSortBy === field) {
      setSkuSortOrder(skuSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSkuSortBy(field);
      setSkuSortOrder("desc");
    }
  };

  // Helper to get local YYYY-MM-DD string
  const getTodayLocalDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Custom Date-Range Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(customDateRange?.startDate || "");
  const [customEndDate, setCustomEndDate] = useState(customDateRange?.endDate || "");
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const latestDataDate = useMemo(() => {
    if (orders && orders.length > 0) {
      return orders.reduce((max, o) => (o.orderDate > max ? o.orderDate : max), orders[0].orderDate);
    }
    return getTodayLocalDateStr();
  }, [orders]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    const [y, m] = latestDataDate.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m)) return new Date(y, m - 1, 1);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Default selection to existing custom range or latest data date when opening
  useEffect(() => {
    if (isCalendarOpen) {
      if (customDateRange?.startDate) {
        setCustomStartDate(customDateRange.startDate);
        setCustomEndDate(customDateRange.endDate || customDateRange.startDate);
        const [y, m] = customDateRange.startDate.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          setCalendarViewMonth(new Date(y, m - 1, 1));
        }
      } else {
        const [y, m] = latestDataDate.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          setCalendarViewMonth(new Date(y, m - 1, 1));
        }
        setCustomStartDate(latestDataDate);
        setCustomEndDate(latestDataDate);
      }
      setHoveredDate(null);
    }
  }, [isCalendarOpen, customDateRange, latestDataDate]);

  const selectToday = () => {
    setCustomStartDate(latestDataDate);
    setCustomEndDate(latestDataDate);
    const [y, m] = latestDataDate.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m)) {
      setCalendarViewMonth(new Date(y, m - 1, 1));
    }
    setHoveredDate(null);
  };

  const handleCalendarDayClick = (dateStr: string) => {
    if (!customStartDate || (customStartDate && customEndDate)) {
      setCustomStartDate(dateStr);
      setCustomEndDate("");
      setHoveredDate(null);
    } else {
      if (dateStr < customStartDate) {
        setCustomEndDate(customStartDate);
        setCustomStartDate(dateStr);
      } else {
        setCustomEndDate(dateStr);
      }
      setHoveredDate(null);
    }
  };

  const selectedDaysCount = useMemo(() => {
    if (!customStartDate) return 0;
    const end = customEndDate || customStartDate;
    const startObj = new Date(customStartDate + "T00:00:00");
    const endObj = new Date(end + "T00:00:00");
    const minTime = Math.min(startObj.getTime(), endObj.getTime());
    const maxTime = Math.max(startObj.getTime(), endObj.getTime());
    const diffMs = maxTime - minTime;
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }, [customStartDate, customEndDate]);

  const calendarDays = useMemo(() => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: ({
      dateStr: string;
      dayNum: number;
      dayOfWeek: number;
      isStart: boolean;
      isEnd: boolean;
      isSingleDay: boolean;
      isInRange: boolean;
      isInHover: boolean;
      isToday: boolean;
      isLastDay: boolean;
    } | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    const todayStr = getTodayLocalDateStr();

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      const isStart = customStartDate === dateStr;
      const isEnd = customEndDate === dateStr;
      const isSingleDay = Boolean(
        customStartDate && customEndDate && customStartDate === customEndDate && isStart
      );

      const minDate =
        customStartDate && customEndDate
          ? customStartDate < customEndDate
            ? customStartDate
            : customEndDate
          : customStartDate;
      const maxDate =
        customStartDate && customEndDate
          ? customStartDate > customEndDate
            ? customStartDate
            : customEndDate
          : "";

      const isInRange = Boolean(minDate && maxDate && dateStr > minDate && dateStr < maxDate);

      let isInHover = false;
      if (customStartDate && !customEndDate && hoveredDate && hoveredDate !== customStartDate) {
        const minH = customStartDate < hoveredDate ? customStartDate : hoveredDate;
        const maxH = customStartDate > hoveredDate ? customStartDate : hoveredDate;
        isInHover = dateStr > minH && dateStr <= maxH;
      }

      const isToday = dateStr === todayStr;

      days.push({
        dateStr,
        dayNum: d,
        dayOfWeek,
        isStart,
        isEnd,
        isSingleDay,
        isInRange,
        isInHover,
        isToday,
        isLastDay: d === totalDays,
      });
    }

    return days;
  }, [calendarViewMonth, customStartDate, customEndDate, hoveredDate]);

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: "ALL", label: "All Time" },
    { id: "TODAY", label: "Today" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "LAST_30_DAYS", label: "Last 30 Days" },
  ];

  // Logic definitions for each card
  const {
    grossSales: grossSalesLogic,
    trueProfit: trueProfitLogic,
    netProfit: netProfitLogic,
    returnsRto: returnsRtoLogic,
    wholesalerCogs: wholesalerCogsLogic,
    damagedClaims: damagedClaimsLogic,
    netRevenue: netRevenueLogic,
    grossProfit: grossProfitLogic,
    contributionProfit: contributionProfitLogic,
    netOperatingProfit: netOperatingProfitLogic,
  } = cardLogicDefinitions;

  return (
    <div className="space-y-6 w-full max-w-[1536px] mx-auto animate-in fade-in duration-300">
      {/* ─── Top Header & Controls Area ─── */}
      <div className="space-y-4 pb-1">
        {/* Row 1: Greetings & Live Status Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p suppressHydrationWarning className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
              {formattedDate}
            </p>
            <h1 suppressHydrationWarning className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] mt-1">
              {greeting}, {userName}
            </h1>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs font-semibold whitespace-nowrap shadow-apple-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Calculations synced in real-time
            </span>
          </div>
        </div>

        {/* Row 2: Dedicated Control Toolbar Strip */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-black/[0.05]">
          {/* Left: Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Dual-Mode View Switcher */}
            <div className="inline-flex items-center bg-[#F1F3F5] p-1 rounded-full border border-black/[0.05]">
              <button
                onClick={() => setViewMode("OPERATOR")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.98] ${
                  viewMode === "OPERATOR"
                    ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
                title="Switch to Operator View (Cash-Flow, Wholesaler Liabilities & Platform Payouts)"
              >
                Operator Payout View
              </button>
              <button
                onClick={() => setViewMode("CFO")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.98] ${
                  viewMode === "CFO"
                    ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
                title="Switch to CFO View (GAAP Margin Hierarchy & Unit Economics)"
              >
                CFO / Unit Economics
              </button>
            </div>
          </div>

          {/* Right: Date-Range Selector & Interactive Custom Calendar Popover */}
          <div ref={calendarRef} className={`relative self-start md:self-auto max-w-full ${isCalendarOpen ? "z-40" : "z-10"}`}>
            <div className="flex items-center bg-[#F1F3F5] border border-black/[0.05] rounded-full p-1 text-xs max-w-full overflow-x-auto no-scrollbar">
              {/* Interactive Calendar Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer active:scale-[0.98] ${
                  isCalendarOpen || datePreset === "CUSTOM"
                    ? "bg-[#1D1D1F] text-white shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04]"
                }`}
                title="Open Custom Date Picker"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Custom</span>
              </button>

              {/* Active Custom Range Indicator Pill */}
              {datePreset === "CUSTOM" && customDateRange && (
                <div className="flex items-center gap-1.5 ml-1 mr-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold shrink-0">
                  <span className="tabular-nums tracking-tight">
                    {formatDateSimple(customDateRange.startDate)} → {formatDateSimple(customDateRange.endDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("ALL");
                      setCustomDateRange(null);
                    }}
                    className="hover:text-blue-950 p-0.5 rounded-full hover:bg-blue-100 transition-colors"
                    title="Clear custom filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Preset Buttons */}
              <div className="flex items-center gap-0.5 ml-1 shrink-0">
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
                      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all active:scale-[0.98] ${
                        isSelected
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                          : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
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
              <div className="absolute right-0 top-full mt-2 w-[310px] sm:w-[335px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl border border-black/[0.08] shadow-apple-lg p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Clean Header with Today quick button */}
                <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.04] mb-3">
                  <h4 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Select Date Range</h4>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectToday}
                      className="px-2.5 py-1 text-xs font-semibold text-[#1D1D1F] bg-black/[0.05] hover:bg-black/[0.08] active:scale-95 rounded-full transition cursor-pointer"
                      title="Select Today's Date"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer"
                      title="Close"
                      aria-label="Close date picker"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Interactive Month Navigation */}
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarViewMonth(
                        new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth() - 1, 1)
                      );
                    }}
                    className="w-7 h-7 rounded-full hover:bg-black/[0.04] flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition cursor-pointer"
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    {calendarViewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarViewMonth(
                        new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth() + 1, 1)
                      );
                    }}
                    className="w-7 h-7 rounded-full hover:bg-black/[0.04] flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] transition cursor-pointer"
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <span key={day} className="text-[10px] font-semibold text-[#86868B]">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div
                  className="grid grid-cols-7 gap-y-1 text-center mb-3"
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {calendarDays.map((d, idx) => {
                    if (!d) {
                      return <div key={`empty-${idx}`} className="h-8 w-full" />;
                    }
                    const {
                      dateStr,
                      dayNum,
                      dayOfWeek,
                      isStart,
                      isEnd,
                      isSingleDay,
                      isInRange,
                      isInHover,
                      isToday,
                      isLastDay,
                    } = d;

                    let cellClass = "text-[#1D1D1F] hover:bg-black/[0.04] rounded-xl font-medium";

                    if (isSingleDay) {
                      cellClass = "bg-[#1D1D1F] text-white font-semibold rounded-xl shadow-apple-sm";
                    } else if (isStart) {
                      const roundR = dayOfWeek === 6 ? "rounded-r-xl" : "rounded-r-none";
                      cellClass = `bg-[#1D1D1F] text-white font-semibold rounded-l-xl ${roundR} shadow-apple-sm`;
                    } else if (isEnd) {
                      const roundL = dayOfWeek === 0 ? "rounded-l-xl" : "rounded-l-none";
                      cellClass = `bg-[#1D1D1F] text-white font-semibold rounded-r-xl ${roundL} shadow-apple-sm`;
                    } else if (isInRange) {
                      const roundL = dayOfWeek === 0 || dayNum === 1 ? "rounded-l-lg" : "rounded-l-none";
                      const roundR = dayOfWeek === 6 || isLastDay ? "rounded-r-lg" : "rounded-r-none";
                      cellClass = `bg-black/[0.06] text-[#1D1D1F] font-medium ${roundL} ${roundR}`;
                    } else if (isInHover) {
                      if (hoveredDate === dateStr) {
                        cellClass = "bg-[#1D1D1F] text-white font-semibold rounded-r-xl rounded-l-none";
                      } else {
                        cellClass = "bg-black/[0.06] text-[#1D1D1F] font-medium rounded-none";
                      }
                    } else if (isToday) {
                      cellClass = "text-[#1D1D1F] font-semibold ring-1.5 ring-black/20 bg-black/[0.04] rounded-xl";
                    }

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => handleCalendarDayClick(dateStr)}
                        onMouseEnter={() => {
                          if (customStartDate && !customEndDate) {
                            setHoveredDate(dateStr);
                          }
                        }}
                        className={`h-8 w-full text-xs flex items-center justify-center transition-colors cursor-pointer relative ${cellClass}`}
                      >
                        <span>{dayNum}</span>
                        {isToday && !isStart && !isEnd && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] absolute bottom-0.5 left-1/2 -translate-x-1/2" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Direct Date Input Fields & Range Display */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <label className="text-[10px] font-semibold text-[#86868B] block mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomStartDate(val);
                        if (val) {
                          const [y, m] = val.split("-").map(Number);
                          if (!isNaN(y) && !isNaN(m)) setCalendarViewMonth(new Date(y, m - 1, 1));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-[#F5F5F7] border border-black/[0.08] rounded-xl text-xs font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[#86868B] block mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#F5F5F7] border border-black/[0.08] rounded-xl text-xs font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
                    />
                  </div>
                </div>

                {/* Clean Actions Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-black/[0.04]">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("ALL");
                      setCustomDateRange(null);
                      setCustomStartDate("");
                      setCustomEndDate("");
                      setIsCalendarOpen(false);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customStartDate) return;
                      const start = customStartDate;
                      const end = customEndDate || customStartDate;
                      const finalStart = start <= end ? start : end;
                      const finalEnd = start <= end ? end : start;
                      setCustomDateRange({ startDate: finalStart, endDate: finalEnd });
                      setDatePreset("CUSTOM");
                      setIsCalendarOpen(false);
                    }}
                    disabled={!customStartDate}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition shadow-apple-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
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
          {/* Card 1: Gross Sales */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                Gross Sales
              </span>
              <button
                onClick={() => setActiveLogicModal(grossSalesLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View Gross Sales calculation logic"
                aria-label="View Gross Sales calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                {formatINR(profitability.grossSales)}
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-medium">
                {profitability.totalOrders} total orders logged
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
              Total sales catalog value of all logged orders
            </div>
          </div>

          {/* Card 2: True Profit */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                True Profit
              </span>
              <button
                onClick={() => setActiveLogicModal(trueProfitLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View True Profit calculation logic"
                aria-label="View True Profit calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#288548] tracking-[-0.02em] tabular-nums">
                {formatINR(profitability.trueProfit)}
              </div>
              <div className="text-xs text-[#288548] font-semibold mt-1">
                {formatPercent(profitability.grossSales > 0 ? profitability.trueProfit / profitability.grossSales : 0)} margin on sales
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
              Platform payout after returns, claims, and wholesale COGS
            </div>
          </div>

          {/* Card 3: Net Profit */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                Net Platform Payout
              </span>
              <button
                onClick={() => setActiveLogicModal(netProfitLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View Net Profit calculation logic"
                aria-label="View Net Profit calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                {formatINR(profitability.netPlatformPayout)}
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-medium">
                Operating Expenses: {formatINR(profitability.operatingExpenses)}
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
              Platform payout after returns and claims, before paying COGS
            </div>
          </div>

          {/* Card 4: Returns & RTO */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                Returns &amp; RTO
              </span>
              <button
                onClick={() => setActiveLogicModal(returnsRtoLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View Returns & RTO calculation logic"
                aria-label="View Returns & RTO calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                {profitability.rtoCount + profitability.customerReturnCount}{" "}
                <span className="text-base font-normal text-[#86868B]">
                  ({formatPercent(profitability.returnRate)})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-1 font-semibold">
                <span className="text-[#6E6E73]">RTO: {profitability.rtoCount}</span>
                <span className="text-[#D70015]">Customer Return: {profitability.customerReturnCount}</span>
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04] flex items-center justify-between">
              <span>Return fees &amp; losses</span>
              <span className="text-[#D70015] font-semibold tabular-nums">
                -{formatINR(profitability.returnLosses + profitability.rtoLosses)}
              </span>
            </div>
          </div>

          {/* Card 5: Wholesaler Cost (COGS) */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                Wholesaler Cost (COGS)
              </span>
              <button
                onClick={() => setActiveLogicModal(wholesalerCogsLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View Wholesaler COGS calculation logic"
                aria-label="View Wholesaler COGS calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                {formatINR(profitability.cogs)}
              </div>
              <div className="text-xs text-[#86868B] mt-1 font-medium">
                Product inventory cost ({profitability.totalUnitsSold} units sold)
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
              Total purchase cost payable to wholesale suppliers
            </div>
          </div>

          {/* Card 6: Damaged Claims Recovery */}
          <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#86868B]">
                Damaged Claims Recovery
              </span>
              <button
                onClick={() => setActiveLogicModal(damagedClaimsLogic)}
                className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="View Damaged Claims calculation logic"
                aria-label="View Damaged Claims calculation logic"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="my-3">
              <div className="text-3xl font-semibold text-[#B25E00] tracking-[-0.02em] tabular-nums">
                {formatINR(profitability.claimRecoveries)}
              </div>
              <div className="flex items-center justify-between text-xs mt-1 font-medium text-[#86868B]">
                <span className="tabular-nums">Pending: {formatINR(profitability.pendingClaimsAmount)}</span>
                <span className="text-[#1D1D1F] font-semibold">{profitability.damagedUnitsCount} damaged</span>
              </div>
            </div>
            <div className="text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
              Reimbursements received from platforms for damage disputes
            </div>
          </div>
        </div>
      ) : (
        /* ─── CFO / UNIT ECONOMICS GAAP VIEW (4 TOP CARDS + 7 SECONDARY METRICS) ─── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Revenue */}
            <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#86868B]">Net Revenue</span>
                <button
                  onClick={() => setActiveLogicModal(netRevenueLogic)}
                  className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="Inspect Net Revenue Formula"
                  aria-label="Inspect Net Revenue Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                  {formatINR(profitability.netSales)}
                </div>
                {datePreset !== "ALL" && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span
                      className={`inline-flex items-center font-semibold ${
                        profitabilityTrends.netSalesChange >= 0 ? "text-[#288548]" : "text-[#D70015]"
                      }`}
                    >
                      {profitabilityTrends.netSalesChange >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(profitabilityTrends.netSalesChange)}%
                    </span>
                    <span className="text-[#86868B] font-normal">vs. prior period</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
                <span>Gross: {formatINR(profitability.grossSales)}</span>
                <span className="text-[#B25E00] font-medium">-{formatINR(profitability.discounts)} discounts</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#86868B]">Gross Profit</span>
                <button
                  onClick={() => setActiveLogicModal(grossProfitLogic)}
                  className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="Inspect Gross Profit Formula"
                  aria-label="Inspect Gross Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-3xl font-semibold text-[#288548] tracking-[-0.02em] tabular-nums">
                  {formatINR(profitability.grossProfit)}
                </div>
                {datePreset !== "ALL" && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span
                      className={`inline-flex items-center font-semibold ${
                        profitabilityTrends.grossProfitChange >= 0 ? "text-[#288548]" : "text-[#D70015]"
                      }`}
                    >
                      {profitabilityTrends.grossProfitChange >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(profitabilityTrends.grossProfitChange)}%
                    </span>
                    <span className="text-[#86868B] font-normal">vs. prior period</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
                <span>COGS: {formatINR(profitability.cogs)}</span>
                <span className="font-semibold text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {formatPercent(profitability.grossMargin)} Margin
                </span>
              </div>
            </div>

            {/* Contribution Profit */}
            <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#86868B]">Contribution Profit</span>
                <button
                  onClick={() => setActiveLogicModal(contributionProfitLogic)}
                  className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="Inspect Contribution Profit Formula"
                  aria-label="Inspect Contribution Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div className="text-3xl font-semibold text-[#1D1D1F] tracking-[-0.02em] tabular-nums">
                  {formatINR(profitability.contributionProfit)}
                </div>
                {datePreset !== "ALL" && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span
                      className={`inline-flex items-center font-semibold ${
                        profitabilityTrends.contributionProfitChange >= 0 ? "text-[#288548]" : "text-[#D70015]"
                      }`}
                    >
                      {profitabilityTrends.contributionProfitChange >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(profitabilityTrends.contributionProfitChange)}%
                    </span>
                    <span className="text-[#86868B] font-normal">vs. prior period</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
                <span>Post Fees &amp; Returns</span>
                <span className="font-semibold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-full border border-[#0071E3]/20">
                  {formatPercent(profitability.contributionMargin)} Margin
                </span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between relative">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#86868B]">Net Operating Profit</span>
                <button
                  onClick={() => setActiveLogicModal(netOperatingProfitLogic)}
                  className="w-7 h-7 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                  title="Inspect Net Operating Profit Formula"
                  aria-label="Inspect Net Operating Profit Formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="my-2">
                <div
                  className={`text-3xl font-semibold tracking-[-0.02em] tabular-nums ${
                    profitability.netOperatingProfit >= 0 ? "text-[#1D1D1F]" : "text-[#D70015]"
                  }`}
                >
                  {formatINR(profitability.netOperatingProfit)}
                </div>
                {datePreset !== "ALL" && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span
                      className={`inline-flex items-center font-semibold ${
                        profitabilityTrends.netOperatingProfitChange >= 0 ? "text-[#288548]" : "text-[#D70015]"
                      }`}
                    >
                      {profitabilityTrends.netOperatingProfitChange >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {Math.abs(profitabilityTrends.netOperatingProfitChange)}%
                    </span>
                    <span className="text-[#86868B] font-normal">vs. prior period</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[#86868B] pt-3 border-t border-black/[0.04]">
                <span>OPEX: {formatINR(profitability.operatingExpenses)}</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded-full ${
                    profitability.netOperatingProfit >= 0
                      ? "text-emerald-800 bg-emerald-500/10 border border-emerald-500/20"
                      : "text-rose-800 bg-rose-500/10 border border-rose-500/20"
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
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Volume</span>
              </div>
              <div><span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{profitability.totalOrders}</span><span className="text-xs text-[#86868B] ml-1">orders</span></div>
              <div className="text-[11px] text-[#6E6E73] tabular-nums">{profitability.totalUnitsSold} <span className="text-[#86868B]">units sold</span></div>
              <div className="mt-auto pt-2 border-t border-black/[0.04] flex items-center justify-between"><span className="text-[10px] font-semibold text-[#0071E3]">Total volume</span></div>
            </div>

            {/* POAS & Ad Spend */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">POAS &amp; Ads</span>
              </div>
              <div>
                <span className={`text-xl font-semibold tracking-tight tabular-nums ${profitability.poas >= 1.0 ? "text-[#288548]" : "text-[#B25E00]"}`}>
                  {profitability.poas > 0 ? `${profitability.poas}x` : "N/A"}
                </span>
                <span className="text-xs text-[#86868B] ml-1">POAS</span>
              </div>
              <div className="text-[11px] text-[#6E6E73] tabular-nums">
                Spend: {formatINR(profitability.totalAdSpend)}
              </div>
              <div className="mt-auto pt-2 border-t border-black/[0.04] flex items-center justify-between">
                <span className={`text-[10px] font-semibold ${profitability.poas >= 1.0 ? "text-emerald-800" : "text-amber-800"}`}>
                  {profitability.poas >= 1.0 ? "Profitable Scale" : "High Ad Drag"}
                </span>
              </div>
            </div>

            {/* Settlement Received */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Settlement</span>
              </div>
              <div className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums">{formatINR(profitability.actualSettlementsReceived)}</div>
              <div className="text-[11px] text-[#6E6E73]">Inflow received</div>
              <div className="mt-auto pt-2 border-t border-black/[0.04]"><span className="text-[10px] font-semibold text-emerald-800">Deposited in bank</span></div>
            </div>

            {/* Marketplace Fees */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Mkt. Fees</span>
              </div>
              <div className="text-xl font-semibold text-[#D70015] tracking-tight tabular-nums">{formatINR(profitability.marketplaceCharges)}</div>
              <div className="text-[11px] text-[#6E6E73]">Total deducted</div>
              <div className="mt-auto pt-2 border-t border-black/[0.04]"><span className="text-[10px] font-semibold text-rose-800">Commissions &amp; fixed</span></div>
            </div>

            {/* Returns & RTO */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Returns</span>
              </div>
              <div className="text-xl font-semibold text-[#B25E00] tracking-tight tabular-nums">{formatINR(profitability.returnLosses + profitability.rtoLosses)}</div>
              <div className="text-[11px] text-[#6E6E73]">Return + RTO loss</div>
              <div className="mt-auto pt-2 border-t border-black/[0.04] flex items-center justify-between"><span className="text-[10px] font-semibold text-amber-800">Rate: {formatPercent(profitability.returnRate)}</span></div>
            </div>

            {/* Dispute Recoveries */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Disputes</span>
              </div>
              <div className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.claimRecoveries)}</div>
              <div className="text-[11px] text-[#6E6E73]">Recovered so far</div>
              <div className="mt-auto pt-2 border-t border-black/[0.04]"><span className="text-[10px] font-semibold text-[#0071E3]">SAFE-T Credits</span></div>
            </div>

            {/* Damaged Write-offs */}
            <div className="bg-white p-4 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#86868B]">Write-offs</span>
              </div>
              <div className="text-xl font-semibold text-[#6E6E73] tracking-tight tabular-nums">{formatINR(profitability.damageLosses)}</div>
              <div className="text-[11px] text-[#6E6E73]">Damaged inventory</div>
              <div className="mt-auto pt-2 border-t border-black/[0.04]"><span className="text-[10px] font-semibold text-[#86868B]">Physical scrap</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK RECORD ACTIONS DOCKED TOOLBAR ─── */}
      <div className="bg-white p-3.5 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">Quick Actions</span>
          <span className="text-black/20">·</span>
          <span className="text-xs text-[#86868B]">Instant entries to platform ledger</span>
        </div>

        {/* Pill Segmented Control matching Navbar options */}
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-black/[0.05] inline-flex items-center gap-0.5 text-xs w-full sm:w-auto">
          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-white text-[#1D1D1F] shadow-apple-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#1D1D1F]" />
            <span>Add Order</span>
          </button>
          <button
            onClick={() => setIsRecordReturnOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Record Return</span>
          </button>
          <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white active:scale-95 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Add Supplier Payment</span>
          </button>
        </div>
      </div>

      {/* Visual Analytics with Color-Coded Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Economics Bar Chart */}
        <div className="lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Channel Economics
              </h2>
            </div>
            <div className="flex items-center gap-3.5 text-xs">
              <span className="flex items-center gap-1.5 text-[#6E6E73] font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-2xs border border-black/5"
                  style={{ backgroundColor: "#0071E3" }}
                />
                <span>Revenue</span>
              </span>
              <span className="flex items-center gap-1.5 text-[#6E6E73] font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-2xs border border-black/5"
                  style={{ backgroundColor: "#8E8E93" }}
                />
                <span>COGS</span>
              </span>
              <span className="flex items-center gap-1.5 text-[#6E6E73] font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-2xs border border-black/5"
                  style={{ backgroundColor: "#FF9F0A" }}
                />
                <span>Fees</span>
              </span>
              <span className="flex items-center gap-1.5 text-[#6E6E73] font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 inline-block shadow-2xs border border-black/5"
                  style={{ backgroundColor: "#34C759" }}
                />
                <span>Profit</span>
              </span>
            </div>
          </div>
          <div className="h-72 w-full min-w-0 relative">
            {!isMounted ? (
              <div className="h-72 w-full flex items-center justify-center text-xs text-[#86868B] bg-[#F5F5F7] rounded-xl">
                Loading analytics chart...
              </div>
            ) : channelChartData.length === 0 ? (
              <div className="h-72 w-full flex items-center justify-center text-xs text-[#86868B] bg-[#F5F5F7] rounded-xl">
                No channel data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280}>
                <BarChart
                  data={channelChartData}
                  barGap={4}
                  barCategoryGap="24%"
                  margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="name"
                    stroke="#86868B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                  />
                  <YAxis
                    stroke="#86868B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatINR(Number(value)), name]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "14px",
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 4px 12px -2px rgba(0,0,0,0.06)",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                  />
                  <Bar dataKey="Revenue" fill="#0071E3" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="COGS" fill="#8E8E93" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="Fees" fill="#FF9F0A" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="Profit" fill="#34C759" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue Share Donut Chart with Tonal Green Palette */}
        <div className="min-w-0 bg-white p-6 rounded-2xl border border-black/[0.06] shadow-apple-md flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Revenue Distribution by Channel
            </h2>
          </div>
          <div className="h-52 w-full my-2 relative flex items-center justify-center">
            {!isMounted ? (
              <div className="h-52 w-full flex items-center justify-center text-xs text-[#86868B] bg-[#F5F5F7] rounded-xl">
                Loading distribution...
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={208} minWidth={0} minHeight={208}>
                  <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Pie
                      data={channelPieData}
                      dataKey="revenue"
                      nameKey="marketplace"
                      cx="50%"
                      cy="50%"
                      startAngle={90}
                      endAngle={-270}
                      innerRadius={56}
                      outerRadius={78}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {channelPieData.map((entry) => (
                        <Cell
                          key={`cell-${entry.marketplace}`}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => {
                        const numVal = Number(value);
                        const share = totalChannelRevenue > 0 ? (numVal / totalChannelRevenue) * 100 : 0;
                        return [`${formatINR(numVal)} (${share.toFixed(1)}%)`, "Revenue"];
                      }}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "14px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        boxShadow: "0 4px 12px -2px rgba(0,0,0,0.06)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Metric - Prominent amount on top, uppercase sub-label below */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-lg sm:text-xl font-bold text-[#1D1D1F] tracking-tight tabular-nums">
                    {formatINR(totalChannelRevenue)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#86868B] mt-0.5">
                    Revenue
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="space-y-2 pt-3 border-t border-black/[0.04] text-xs">
            {sortedMarketplaceBreakdown.map((m) => {
              const share = totalChannelRevenue > 0 ? (m.revenue / totalChannelRevenue) * 100 : 0;
              return (
                <div key={m.marketplace} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-apple-sm border border-black/5"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="text-[#1D1D1F] font-medium truncate">{m.marketplace}</span>
                    <span className="text-[#86868B] text-[11px] font-medium tabular-nums shrink-0">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <span className="font-semibold text-[#1D1D1F] tabular-nums shrink-0 ml-2">
                    {formatINR(m.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loss-making SKU Alert Banner */}
      {lossMakingSkus.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.06] shadow-apple-md flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition-all">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#D70015]/[0.08] border border-[#D70015]/15 text-[#D70015] flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#1D1D1F] text-xs sm:text-[13px] tracking-tight">
                  Margin Erosion Advisory
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D70015]/[0.08] border border-[#D70015]/15 text-[10px] font-semibold text-[#D70015] tracking-wide">
                  {lossMakingSkus.length === 1 ? "1 SKU at Risk" : `${lossMakingSkus.length} SKUs at Risk`}
                </span>
              </div>
              <p className="text-[#86868B] text-xs leading-relaxed">
                {lossMakingSkus.length === 1
                  ? "1 product SKU is currently operating at a net loss"
                  : `${lossMakingSkus.length} product SKUs are currently operating at a net loss`}{" "}
                after factoring in reverse logistics freight and return damage write-offs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0 pl-12 md:pl-0">
            {lossMakingSkus.map((s) => (
              <button
                key={s.sku}
                onClick={() => {
                  setSkuSearch(s.sku);
                  setSkuFilter("ALL");
                  scrollToSkuTable();
                }}
                className="group px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border border-black/[0.08] text-[#1D1D1F] shadow-apple-sm transition-all flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                title={`Inspect unit economics for ${s.sku}`}
              >
                <span className="font-mono text-xs font-semibold text-[#1D1D1F]">{s.sku}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#D70015]/[0.08] text-[#D70015] text-[11px] font-semibold tabular-nums border border-[#D70015]/15">
                  {formatINR(s.profit)}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#86868B] group-hover:text-[#1D1D1F] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}

            <button
              onClick={() => {
                setSkuFilter("LOSS_MAKING");
                setSkuSearch("");
                scrollToSkuTable();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white font-medium text-xs shadow-apple-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Filter table to all loss-making products"
            >
              <span>Filter Table</span>
              <ArrowDownRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Interactive SKU Economics Deep-Dive Table ─── */}
      <div id="sku-economics-table" className="bg-white rounded-2xl border border-black/[0.06] shadow-apple-md overflow-hidden scroll-mt-20">
        {/* Table Header & Filtering Controls */}
        <div className="p-4 sm:p-5 border-b border-black/[0.04] flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          {/* Left: Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                SKU Economics
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] text-[#6E6E73] font-semibold border border-black/[0.06] tabular-nums">
                {processedSkus.length} SKUs
              </span>
            </div>
          </div>

          {/* Right: Unified Controls Strip (Search + Filter Pills + Export) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-start xl:self-center">
            {/* Search Input */}
            <div className="relative w-full sm:w-48 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-black/[0.08] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 rounded-full text-xs text-[#1D1D1F] placeholder:text-[#86868B] shadow-apple-sm transition-all outline-none"
              />
              {skuSearch && (
                <button
                  type="button"
                  onClick={() => setSkuSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] p-0.5 cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Pills (Clean Apple-Style Segmented Control, no dots) */}
            <div className="inline-flex items-center p-1 bg-[#F1F3F5] rounded-full border border-black/[0.05] gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setSkuFilter("ALL")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all active:scale-[0.98] ${
                  skuFilter === "ALL"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSkuFilter("PROFITABLE")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all active:scale-[0.98] ${
                  skuFilter === "PROFITABLE"
                    ? "bg-white text-[#288548] font-semibold shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                Profitable
              </button>
              <button
                type="button"
                onClick={() => setSkuFilter("LOSS_MAKING")}
                className={`px-3.5 py-1 rounded-full text-xs transition-all active:scale-[0.98] ${
                  skuFilter === "LOSS_MAKING"
                    ? "bg-white text-[#D70015] font-semibold shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                Loss-Making
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportSkuCsv}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-black/[0.08] hover:bg-black/[0.02] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold shadow-apple-sm transition-all shrink-0 cursor-pointer"
              title="Download SKU unit economics as CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Scrollable Fixed Table (width-locked so columns never shrink or shift) */}
        <div className="overflow-x-auto min-h-[340px]">
          <table className="table-fixed w-full min-w-[1140px] text-left text-xs tabular-nums">
            <colgroup>
              <col style={{ width: "260px" }} />
              <col style={{ width: "95px" }} />
              <col style={{ width: "115px" }} />
              <col style={{ width: "105px" }} />
              <col style={{ width: "115px" }} />
              <col style={{ width: "115px" }} />
              <col style={{ width: "125px" }} />
              <col style={{ width: "95px" }} />
              <col style={{ width: "95px" }} />
              <col style={{ width: "85px" }} />
              <col style={{ width: "95px" }} />
            </colgroup>
            <thead className="bg-[#FBFBFD] border-b border-black/[0.06] text-[#6E6E73] font-semibold">
              <tr>
                <th className="px-4 py-3">SKU &amp; Product Name</th>
                <th
                  onClick={() => handleSort("unitsSold")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#1D1D1F] select-none transition-colors"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    Units Sold <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("revenue")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#1D1D1F] select-none transition-colors"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    Net Revenue <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Mkt. Deductions</th>
                <th className="px-4 py-3 text-right">Return Losses</th>
                <th
                  onClick={() => handleSort("profit")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#1D1D1F] select-none transition-colors"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    Net Contribution <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("margin")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#1D1D1F] select-none transition-colors"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    Margin % <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Ad Spend</th>
                <th className="px-4 py-3 text-right">POAS</th>
                <th
                  onClick={() => handleSort("returnRate")}
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#1D1D1F] select-none transition-colors"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    Return Rate <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {paginatedSkus.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-[#86868B] text-xs">
                    No SKUs matched your search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedSkus.map((s) => {
                  const isLoss = s.profit < 0;
                  return (
                    <tr
                      key={s.sku}
                      onClick={() => setSelectedSkuForDrawer(s)}
                      className="hover:bg-black/[0.02] transition-colors cursor-pointer group"
                      title="Click to inspect unit economics"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono font-semibold text-xs text-[#1D1D1F] bg-black/[0.04] group-hover:bg-[#0071E3]/10 group-hover:text-[#0071E3] px-2 py-0.5 rounded-md border border-black/[0.06] transition-colors inline-block tracking-tight truncate shrink-0 max-w-[170px]">
                            {s.sku}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[#0071E3] font-semibold flex items-center transition-opacity shrink-0">
                            Inspect <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                        <div className="text-[11px] text-[#86868B] mt-1 truncate" title={s.productName}>
                          {s.productName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#1D1D1F] tabular-nums align-middle">
                        {s.unitsSold} <span className="text-[10px] text-[#86868B] font-normal">units</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums align-middle">
                        {formatINR(s.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-[#6E6E73] tracking-tight tabular-nums align-middle">
                        {formatINR(s.cogs)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-[#D70015] tracking-tight tabular-nums align-middle">
                        -{formatINR(s.marketplaceCharges)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-[#B25E00] tracking-tight tabular-nums align-middle">
                        {s.returnLosses > 0 ? `-${formatINR(s.returnLosses)}` : "₹0"}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span className={`text-sm font-semibold tracking-tight tabular-nums ${isLoss ? "text-[#D70015]" : "text-[#288548]"}`}>
                          {formatINR(s.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isLoss
                              ? "bg-rose-500/10 text-rose-800 border-rose-500/20"
                              : s.margin > 0.2
                              ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-800 border-amber-500/20"
                          }`}
                        >
                          {formatPercent(s.margin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#6E6E73] font-medium align-middle">
                        {s.adSpend ? formatINR(s.adSpend) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        {s.poas !== undefined ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              s.poas >= 1.0
                                ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-800 border border-amber-500/20"
                            }`}
                          >
                            {s.poas}x
                          </span>
                        ) : (
                          <span className="text-[#86868B]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            s.returnRate > 0.2 ? "text-[#B25E00]" : "text-[#6E6E73]"
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

        {/* Table Summary & 10-Record Chapter Pagination Footer */}
        <div className="px-5 py-3.5 border-t border-black/[0.06] bg-[#FBFBFD] flex flex-col md:flex-row items-center justify-between text-xs text-[#86868B] gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#86868B]">
              {processedSkus.length === 0 ? (
                "0 SKUs found"
              ) : (
                <>
                  Showing <span className="font-semibold text-[#1D1D1F] tabular-nums">{(skuPage - 1) * SKU_PAGE_SIZE + 1}</span>–<span className="font-semibold text-[#1D1D1F] tabular-nums">{Math.min(skuPage * SKU_PAGE_SIZE, processedSkus.length)}</span> of <span className="font-semibold text-[#1D1D1F] tabular-nums">{processedSkus.length}</span> SKUs
                </>
              )}
            </span>
          </div>

          {/* Chapter / Pagination Controls */}
          {totalSkuPages > 1 && (
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-black/[0.08] shadow-apple-sm">
              <button
                type="button"
                disabled={skuPage === 1}
                onClick={() => setSkuPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-[#1D1D1F] hover:bg-black/[0.04] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Previous 10 SKUs"
                aria-label="Previous 10 SKUs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalSkuPages }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setSkuPage(pageNum)}
                      className={`w-7 h-7 rounded-full text-xs font-semibold transition cursor-pointer flex items-center justify-center active:scale-95 ${
                        skuPage === pageNum
                          ? "bg-[#1D1D1F] text-white shadow-apple-sm"
                          : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04]"
                      }`}
                      aria-label={`Go to page ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={skuPage === totalSkuPages}
                onClick={() => setSkuPage((p) => Math.min(totalSkuPages, p + 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-[#1D1D1F] hover:bg-black/[0.04] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Next 10 SKUs"
                aria-label="Next 10 SKUs"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Total Contribution Pill */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#86868B]">Total Analyzed Profit:</span>
            <span
              className={`font-semibold tabular-nums font-mono text-xs px-3 py-1 rounded-full border shadow-apple-sm ${
                profitability.contributionProfit >= 0
                  ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-800 border-rose-500/20"
              }`}
            >
              {formatINR(profitability.contributionProfit)}
            </span>
          </div>
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