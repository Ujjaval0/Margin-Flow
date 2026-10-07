"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Order,
  OrderStatus,
  Marketplace,
  ReturnRecord,
  ReturnType,
  ProductCondition,
  Claim,
  Settlement,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate, formatPercent } from "@/lib/utils";
import {
  Search,
  Upload,
  Download,
  Plus,
  X,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ChevronDown,
  Check,
  Layers,
  Store,
  RotateCcw,
  Truck,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Globe,
  Filter,
  Sparkles,
  FileScan,
  TrendingUp,
  Calendar,
  Hash,
  Package,
  FileText,
  IndianRupee,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  calculateOrderProfitability,
  buildFinancialMaps,
  OrderProfitability,
} from "@/domain/profitability-engine";
import { OrderModal } from "@/components/modals/order-modal";
import { PlatformFilterDropdown } from "@/components/ui/marketplace-dropdown";
import { getMarketplaceBadge } from "@/lib/marketplace-config";
import { CsvImportModal } from "@/components/modals/csv-import-modal";
import { InvoiceAutoParseModal } from "@/components/modals/invoice-auto-parse-modal";

interface OrdersViewProps {
  selectedMarketplace?: Marketplace | "ALL";
}

// Synthesize the Delivery & Return status matching user's exact specification
type SynthesizedStatusKey =
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "RTO"
  | "RETURNED"
  | "CANCELLED";

function getSynthesizedStatus(
  order: Order,
  orderReturns: ReturnRecord[],
  orderClaims: Claim[]
): {
  key: SynthesizedStatusKey;
  label: string;
  pillClass: string;
  dotColor: string;
} {
  // 1. Cancelled
  if (order.status === "CANCELLED") {
    return {
      key: "CANCELLED",
      label: "Cancelled",
      pillClass: "bg-rose-500/10 text-rose-800 border border-rose-500/20",
      dotColor: "bg-rose-500",
    };
  }

  // 2. RTO (Undelivered Courier Return)
  const rtoReturn = orderReturns.find((r) => r.returnType === "RTO");
  if (order.status === "RTO" || rtoReturn) {
    return {
      key: "RTO",
      label: "RTO",
      pillClass: "bg-amber-500/10 text-amber-800 border border-amber-500/20",
      dotColor: "bg-amber-500",
    };
  }

  // 3. Customer & Damaged Returns
  const isReturn =
    order.status === "RETURNED" ||
    order.status === "CUSTOMER_RETURN" ||
    order.status === "DAMAGED_RETURN" ||
    order.status === "PARTIALLY_RETURNED" ||
    orderReturns.length > 0;

  if (isReturn) {
    const approvedClaim = orderClaims.find(
      (c) => c.status === "APPROVED" || c.status === "RECOVERED" || c.status === "PARTIALLY_RECOVERED"
    );
    if (approvedClaim) {
      return {
        key: "RETURNED",
        label: "Claim Approved",
        pillClass: "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20",
        dotColor: "bg-emerald-500",
      };
    }

    const pendingClaim = orderClaims.find(
      (c) => c.status === "FILED" || c.status === "UNDER_REVIEW" || c.status === "NOT_FILED"
    );
    if (pendingClaim) {
      return {
        key: "RETURNED",
        label: "Claim Pending",
        pillClass: "bg-amber-500/10 text-amber-800 border border-amber-500/20",
        dotColor: "bg-amber-500",
      };
    }

    return {
      key: "RETURNED",
      label: "Returned",
      pillClass: "bg-orange-500/10 text-orange-800 border border-orange-500/20",
      dotColor: "bg-orange-500",
    };
  }

  // 4. Shipped
  if (order.status === "SHIPPED") {
    return {
      key: "SHIPPED",
      label: "Shipped",
      pillClass: "bg-indigo-500/10 text-indigo-800 border border-indigo-500/20",
      dotColor: "bg-indigo-500",
    };
  }

  // 5. Confirmed
  if (order.status === "CONFIRMED" || order.status === "PENDING") {
    return {
      key: "CONFIRMED",
      label: "Confirmed",
      pillClass: "bg-blue-500/10 text-blue-800 border border-blue-500/20",
      dotColor: "bg-blue-500",
    };
  }

  // 6. Delivered
  return {
    key: "DELIVERED",
    label: "Delivered",
    pillClass: "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20",
    dotColor: "bg-emerald-500",
  };
}

// ----------------------------------------------------
// Status Pill Filter Options (Matching Reference Design)
// ----------------------------------------------------
const STATUS_PILL_OPTIONS = [
  { id: "ALL", label: "ALL" },
  { id: "CONFIRMED", label: "CONFIRMED" },
  { id: "SHIPPED", label: "SHIPPED" },
  { id: "DELIVERED", label: "DELIVERED" },
  { id: "RTO", label: "RTO" },
  { id: "RETURNED", label: "RETURNED" },
  { id: "CANCELLED", label: "CANCELLED" },
] as const;


// ----------------------------------------------------
// Custom Bulk Status Dropdown (Apple/Linear UI)
// ----------------------------------------------------
interface BulkStatusDropdownProps {
  onSelect: (status: OrderStatus) => void;
}

const BULK_STATUS_OPTIONS: {
  id: OrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
}[] = [
  { id: "CONFIRMED", label: "Mark Confirmed", icon: CheckCircle2, badgeClass: "text-[#0071E3] bg-[#0071E3]/10 border-[#0071E3]/20" },
  { id: "SHIPPED", label: "Mark Shipped", icon: Truck, badgeClass: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20" },
  { id: "DELIVERED", label: "Mark Delivered", icon: Package, badgeClass: "text-emerald-800 bg-emerald-500/10 border-emerald-500/20" },
  { id: "RTO", label: "Mark RTO", icon: RotateCcw, badgeClass: "text-amber-800 bg-amber-500/10 border-amber-500/20" },
  { id: "RETURNED", label: "Mark Returned", icon: RotateCcw, badgeClass: "text-orange-800 bg-orange-500/10 border-orange-500/20" },
  { id: "CANCELLED", label: "Mark Cancelled", icon: X, badgeClass: "text-rose-800 bg-rose-500/10 border-rose-500/20" },
];

function BulkStatusDropdown({ onSelect }: BulkStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white hover:bg-black/[0.02] border border-black/[0.08] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#1D1D1F] shadow-apple-sm transition-all cursor-pointer active:scale-[0.98]"
      >
        <span className="text-[10px] font-semibold text-[#86868B]">Status:</span>
        <span className="text-[#1D1D1F]">Choose Status...</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#86868B] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#1D1D1F]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white/95 backdrop-blur-xl text-[#1D1D1F] rounded-2xl border border-black/[0.08] shadow-apple-lg p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-[#86868B] border-b border-black/[0.04] mb-1">
            Update Status
          </div>
          <div className="space-y-0.5">
            {BULK_STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-[#1D1D1F] hover:bg-black/[0.03] transition-colors text-left group cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border ${opt.badgeClass}`}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <span className="font-semibold text-[#1D1D1F]">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



// ----------------------------------------------------
// Main OrdersView Component
// ----------------------------------------------------
export function OrdersView({ selectedMarketplace: propMarketplace }: OrdersViewProps = {}) {
  const {
    selectedMarketplace: contextMarketplace,
    orders,
    products,
    returns,
    settlements,
    claims,
    suppliers,
    addOrder,
    updateOrder,
    deleteOrder,
    deleteOrders,
    addReturn,
    addClaim,
    addSettlement,
    updateOrderStatus,
    bulkUpdateOrderStatus,
  } = usePlatform();

  const globalMarketplace = propMarketplace ?? contextMarketplace;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Marketplace | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // ----------------------------------------------------
  // Selection and Bulk Actions State
  // ----------------------------------------------------
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (orderToDelete) setOrderToDelete(null);
        else if (isBulkDeleteConfirmOpen) setIsBulkDeleteConfirmOpen(false);
        else if (selectedOrder) setSelectedOrder(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orderToDelete, isBulkDeleteConfirmOpen, selectedOrder]);

  // ----------------------------------------------------
  // Edit Order Modal State
  // ----------------------------------------------------
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
  };

  // Single Delete Handler
  const handleConfirmDeleteSingle = () => {
    if (orderToDelete) {
      deleteOrder(orderToDelete.id);
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderToDelete.id));
      setOrderToDelete(null);
    }
  };

  // Bulk Delete Handler
  const handleConfirmBulkDelete = () => {
    if (selectedOrderIds.length > 0) {
      deleteOrders(selectedOrderIds);
      setSelectedOrderIds([]);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  // Bulk Status Change Handler
  const handleBulkStatusChange = (newStatus: OrderStatus) => {
    if (selectedOrderIds.length > 0) {
      bulkUpdateOrderStatus(selectedOrderIds, newStatus);
      setSelectedOrderIds([]);
    }
  };



  // Fast indexed lookups for returns and claims to eliminate O(N * M) nested scanning
  const financialMaps = useMemo(() => {
    return buildFinancialMaps(returns, settlements, claims);
  }, [returns, settlements, claims]);

  const returnsMap = financialMaps.returnsByOrderMap;
  const claimsMap = financialMaps.claimsByOrderMap;

  // Precompute order profitability map using O(1) indexed lookups
  const orderPnlMap = useMemo(() => {
    const map = new Map<string, OrderProfitability>();
    for (let i = 0; i < orders.length; i++) {
      map.set(
        orders[i].id,
        calculateOrderProfitability(orders[i], returns, settlements, claims, financialMaps)
      );
    }
    return map;
  }, [orders, returns, settlements, claims, financialMaps]);

  // Calculate live counts for each platform and status option
  const { platformCounts, statusCounts } = useMemo(() => {
    const pCounts: Record<string, number> = {
      ALL: orders.length,
      "Amazon India": 0,
      Flipkart: 0,
      Myntra: 0,
      Meesho: 0,
      WooCommerce: 0,
      "Personal Website": 0,
      "B2B Wholesale": 0,
      Other: 0,
    };

    const sCounts: Record<string, number> = {
      ALL: 0,
      CONFIRMED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      RTO: 0,
      RETURNED: 0,
      CANCELLED: 0,
    };

    orders.forEach((order) => {
      // Platform counting
      if (pCounts[order.marketplace] !== undefined) {
        pCounts[order.marketplace]++;
      } else {
        pCounts.Other = (pCounts.Other || 0) + 1;
      }

      // Filter status counts if platformFilter or globalMarketplace is active
      if (platformFilter !== "ALL" && order.marketplace !== platformFilter) {
        return;
      }
      if (globalMarketplace !== "ALL" && order.marketplace !== globalMarketplace) {
        return;
      }

      sCounts.ALL++;

      // Status counting with O(1) indexed lookup
      const orderReturns = returnsMap.get(order.id) || (order.channelOrderId ? returnsMap.get(order.channelOrderId) : undefined) || [];
      const orderClaims = claimsMap.get(order.id) || [];
      const synth = getSynthesizedStatus(order, orderReturns, orderClaims);
      if (sCounts[synth.key] !== undefined) {
        sCounts[synth.key]++;
      }
    });

    return { platformCounts: pCounts, statusCounts: sCounts };
  }, [orders, returnsMap, claimsMap, globalMarketplace, platformFilter]);

  // Filtered orders pipeline
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      // Global header filter constraint
      if (globalMarketplace !== "ALL" && order.marketplace !== globalMarketplace) {
        return false;
      }

      // 1. Platform Dropdown Filter
      if (platformFilter !== "ALL" && order.marketplace !== platformFilter) {
        return false;
      }

      // 2. Status Filter with O(1) indexed lookup
      if (statusFilter !== "ALL") {
        if (statusFilter === "SETTLED") {
          const pnl = orderPnlMap.get(order.id);
          if (!pnl?.isSettled) return false;
        } else if (statusFilter === "PENDING") {
          const pnl = orderPnlMap.get(order.id);
          if (pnl?.isSettled) return false;
        } else {
          const orderReturns = returnsMap.get(order.id) || (order.channelOrderId ? returnsMap.get(order.channelOrderId) : undefined) || [];
          const orderClaims = claimsMap.get(order.id) || [];
          const synthesized = getSynthesizedStatus(order, orderReturns, orderClaims);
          if (synthesized.key !== statusFilter) return false;
        }
      }

      // 3. Search Bar Filter
      if (q !== "") {
        const matchesId = order.id.toLowerCase().includes(q) || order.channelOrderId.toLowerCase().includes(q);
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesItem = order.items.some(
          (i) => i.sku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)
        );
        if (!matchesId && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, returnsMap, claimsMap, orderPnlMap, globalMarketplace, platformFilter, statusFilter, searchQuery]);

  // Sync local platformFilter when globalMarketplace changes
  useEffect(() => {
    if (globalMarketplace) {
      setPlatformFilter(globalMarketplace);
    }
  }, [globalMarketplace]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [globalMarketplace, platformFilter, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Selection helpers relative to current filtered view
  const isAllFilteredSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  const isSomeFilteredSelected =
    filteredOrders.some((o) => selectedOrderIds.includes(o.id)) && !isAllFilteredSelected;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredOrders.map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedOrderIds, ...filteredOrders.map((o) => o.id)]);
      setSelectedOrderIds(Array.from(newIds));
    }
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = [
      "PLATFORM",
      "DATE",
      "ORDER ID",
      "CHANNEL REF",
      "SKU",
      "PRODUCT NAME",
      "QTY",
      "GROSS SALE (INR)",
      "COGS (INR)",
      "SETTLEMENT STATUS",
      "SETTLEMENT AMOUNT (INR)",
      "DELIVERY & RETURN STATUS",
      "NET PROFIT (INR)",
      "MARGIN (%)",
    ];

    const rows = filteredOrders.map((o) => {
      const pnl = calculateOrderProfitability(o, returns, settlements, claims);
      const orderReturns = returns.filter(
        (r) => r.orderId === o.id || (o.channelOrderId && r.channelOrderId === o.channelOrderId)
      );
      const orderClaims = claims.filter((c) => c.orderId === o.id);
      const synthStatus = getSynthesizedStatus(o, orderReturns, orderClaims);
      const item = o.items[0];
      const grossSale = pnl.grossSales;
      const cogs = pnl.cogs;
      const platformBadge = getMarketplaceBadge(o.marketplace);

      return [
        `"${platformBadge.label}"`,
        `"${o.orderDate}"`,
        `"${o.id}"`,
        `"${o.channelOrderId}"`,
        `"${item?.sku || ""}"`,
        `"${(item?.productName || "").replace(/"/g, '""')}"`,
        item?.quantity || 1,
        grossSale.toFixed(2),
        cogs.toFixed(2),
        `"${pnl.isSettled ? "Settled" : "Pending"}"`,
        pnl.settledAmount.toFixed(2),
        `"${synthStatus.label}"`,
        pnl.contributionProfit.toFixed(2),
        pnl.contributionMargin.toFixed(2),
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  // Batch CSV Ingestion Handler
  const handleBatchImportOrders = (importedOrders: Order[]) => {
    importedOrders.forEach((o) => addOrder(o));
  };

  const isAnyFilterActive = platformFilter !== "ALL" || statusFilter !== "ALL" || searchQuery !== "";

  return (
    <div className="space-y-5 w-full max-w-[1600px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Manage your orders
          </h1>
          <p className="text-xs sm:text-sm text-[#86868B] mt-1">
            Effortlessly track and manage every order with real-time status updates and detailed insights.
          </p>
        </div>

        {/* Top Actions: Auto-parse Invoice, Import CSV, Export CSV, + Add Order */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-black/[0.02] border border-black/[0.08] text-xs font-semibold text-[#1D1D1F] transition shadow-apple-sm active:scale-[0.98] cursor-pointer"
            title="Auto-parse orders from customer or marketplace invoices (PDF, CSV, TXT)"
          >
            <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
              <FileScan className="w-3.5 h-3.5 text-[#0071E3]" />
            </div>
            <span>Auto-parse Invoice</span>
          </button>

          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-black/[0.02] border border-black/[0.08] text-xs font-semibold text-[#1D1D1F] transition shadow-apple-sm active:scale-[0.98] cursor-pointer"
            title="Import Orders from CSV or Excel (.csv, .xlsx, .xls)"
          >
            <Upload className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-black/[0.02] border border-black/[0.08] text-xs font-semibold text-[#1D1D1F] transition shadow-apple-sm active:scale-[0.98] cursor-pointer"
            title="Export Orders Ledger to CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#86868B]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-xs font-semibold text-white transition shadow-apple-sm active:scale-[0.98] cursor-pointer"
            title="Record New Order"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Add Order</span>
          </button>
        </div>
      </div>

      {/* Pill Segmented Control (Apple style matching Image 2) */}
      <div className="flex items-center overflow-x-auto no-scrollbar py-0.5">
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-black/[0.05] inline-flex items-center gap-0.5 text-xs shrink-0 max-w-full">
          {STATUS_PILL_OPTIONS.map((opt) => {
            const isSelected = statusFilter === opt.id;
            const count = statusCounts[opt.id] ?? 0;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(isSelected && opt.id !== "ALL" ? "ALL" : opt.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs whitespace-nowrap cursor-pointer select-none font-semibold ${
                  isSelected
                    ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <span className="tracking-tight uppercase">{opt.label}</span>
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                    isSelected
                      ? "bg-black/[0.06] text-[#1D1D1F]"
                      : "bg-black/[0.03] text-[#86868B]"
                  }`}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Bar: Search and Platform Filter */}
      <div className="bg-white rounded-2xl p-3 border border-black/[0.06] shadow-apple-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search order ref, SKU, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#F5F5F7] border border-black/[0.08] rounded-full text-xs text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition shadow-apple-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] text-xs w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/[0.06]"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Enhanced Custom Platform Dropdown */}
          <PlatformFilterDropdown
            selected={platformFilter}
            onChange={(val) => {
              setPlatformFilter(val);
              setCurrentPage(1);
            }}
            counts={platformCounts}
          />
        </div>
      </div>

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-2xl p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-apple-md">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#1D1D1F] text-white font-semibold text-xs flex items-center justify-center shadow-apple-sm tabular-nums">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-[11px] text-[#86868B] hover:text-[#1D1D1F] underline font-medium ml-1 transition-colors cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Custom Bulk Status Update Dropdown */}
            <BulkStatusDropdown onSelect={handleBulkStatusChange} />

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D70015]/[0.08] hover:bg-[#D70015]/[0.15] text-[#D70015] border border-[#D70015]/20 text-xs font-semibold transition-all shadow-apple-sm cursor-pointer active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedOrderIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders Table Container */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-apple-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-[#FBFBFD] border-b border-black/[0.06] text-[11px] font-semibold text-[#6E6E73]">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    title={isAllFilteredSelected ? "Deselect all orders" : "Select all orders"}
                    aria-label={isAllFilteredSelected ? "Deselect all orders" : "Select all orders"}
                    className="w-4 h-4 rounded text-[#0071E3] focus:ring-[#0071E3] border-black/[0.15] accent-[#0071E3] cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 font-semibold">Platform &amp; Date</th>
                <th className="py-3.5 px-4 font-semibold">Order ID &amp; SKU</th>
                <th className="py-3.5 px-4 font-semibold">Product Name</th>
                <th className="py-3.5 px-4 font-semibold">Gross Sale</th>
                <th className="py-3.5 px-4 font-semibold">COGS</th>
                <th className="py-3.5 px-4 font-semibold">Settlement</th>
                <th className="py-3.5 px-4 font-semibold">Net Profit</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/[0.04] text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[#86868B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-black/[0.03] flex items-center justify-center text-[#86868B]">
                        <Filter className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-[#1D1D1F]">No matching orders found</p>
                      <p className="text-xs text-[#86868B] max-w-sm">
                        Try changing your platform or status filter, or clearing your search keywords.
                      </p>
                      {isAnyFilterActive && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setPlatformFilter("ALL");
                            setStatusFilter("ALL");
                          }}
                          className="text-xs px-3.5 py-1.5 rounded-full bg-white text-[#1D1D1F] border border-black/[0.08] hover:bg-black/[0.02] font-semibold mt-2 transition shadow-apple-sm cursor-pointer active:scale-95"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, orderIdx) => {
                  const pnl =
                    orderPnlMap.get(order.id) ||
                    calculateOrderProfitability(order, returns, settlements, claims, financialMaps);
                  const orderReturns =
                    returnsMap.get(order.id) ||
                    (order.channelOrderId ? returnsMap.get(order.channelOrderId) : undefined) ||
                    [];
                  const orderClaims = claimsMap.get(order.id) || [];
                  const synthStatus = getSynthesizedStatus(order, orderReturns, orderClaims);
                  const platformBadge = getMarketplaceBadge(order.marketplace);
                  const primaryItem = order.items[0];
                  const extraItemsCount = order.items.length - 1;

                  const grossSale = pnl.grossSales;
                  const cogsBasis = pnl.cogs;

                  return (
                    <tr
                      key={`${order.id}-${orderIdx}`}
                      className={`transition-colors duration-150 group ${
                        selectedOrderIds.includes(order.id)
                          ? "bg-black/[0.03] font-medium"
                          : "hover:bg-black/[0.02]"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => handleToggleSelectOrder(order.id)}
                          aria-label={`Select order ${order.id}`}
                          className="w-4 h-4 rounded text-[#0071E3] focus:ring-[#0071E3] border-black/[0.15] accent-[#0071E3] cursor-pointer"
                        />
                      </td>

                      {/* 1. PLATFORM & DATE */}
                      <td className="py-3.5 px-4 align-middle">
                        <div>
                          <span className="font-semibold text-[#1D1D1F] text-xs block tracking-tight">
                            {platformBadge.label}
                          </span>
                          <span className="text-[11px] text-[#86868B] font-normal tabular-nums block mt-0.5">
                            {formatDate(order.orderDate)}
                          </span>
                        </div>
                      </td>

                      {/* 2. ORDER ID & SKU */}
                      <td className="py-3.5 px-4 align-middle">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#1D1D1F] block text-xs tracking-tight tabular-nums">
                              {order.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${synthStatus.pillClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${synthStatus.dotColor}`}></span>
                              <span>{synthStatus.label}</span>
                            </span>
                          </div>
                          <span className="text-[11px] text-[#86868B] block truncate max-w-[150px] tabular-nums font-mono mt-0.5">
                            {primaryItem ? primaryItem.sku : "NO-SKU"}
                            {extraItemsCount > 0 && ` (+${extraItemsCount})`}
                          </span>
                        </div>
                      </td>

                      {/* 3. PRODUCT NAME */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="max-w-[220px]">
                          <div
                            className="font-semibold text-[#1D1D1F] truncate text-xs"
                            title={primaryItem?.productName || "No Item"}
                          >
                            {primaryItem ? primaryItem.productName : "No item recorded"}
                          </div>
                          <div className="text-[11px] text-[#86868B] mt-0.5 flex items-center gap-1.5">
                            <span className="bg-black/[0.04] text-[#6E6E73] px-2 py-0.5 rounded-md text-[10px] font-semibold border border-black/[0.06] tabular-nums">
                              Qty: {primaryItem?.quantity || 1}
                            </span>
                            <span className="truncate">{order.customerName}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. GROSS SALE */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                          {formatINR(grossSale)}
                        </div>
                      </td>

                      {/* 5. COGS */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="text-sm font-medium text-[#6E6E73] tracking-tight tabular-nums">
                          {formatINR(cogsBasis)}
                        </div>
                      </td>

                      {/* 6. SETTLEMENT */}
                      <td className="py-3.5 px-4 align-middle">
                        {pnl.isSettled ? (
                          <div>
                            <div className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{formatINR(pnl.settledAmount)}</span>
                            </div>
                            <span className="text-[10px] text-emerald-800 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mt-0.5">
                              Settled
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{formatINR(grossSale - order.marketplaceChargesEstimate)}</span>
                            </div>
                            <span className="text-[10px] text-amber-800 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 inline-block mt-0.5">
                              Pending
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. NET PROFIT */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="text-sm font-semibold tracking-tight tabular-nums text-[#1D1D1F]">
                          {pnl.contributionProfit >= 0 ? "+" : ""}
                          {formatINR(pnl.contributionProfit)}
                        </div>
                      </td>

                      {/* 8. ACTIONS */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="View Profitability Breakdown"
                            aria-label={`View profitability for order ${order.id}`}
                            className="p-1.5 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] border border-black/[0.06] transition shadow-apple-sm active:scale-95 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(order)}
                            title="Edit Order Data"
                            aria-label={`Edit order ${order.id}`}
                            className="p-1.5 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#6E6E73] hover:text-[#0071E3] border border-black/[0.06] transition shadow-apple-sm active:scale-95 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            title="Delete Order"
                            aria-label={`Delete order ${order.id}`}
                            className="p-1.5 rounded-lg bg-black/[0.03] hover:bg-rose-500/10 text-[#6E6E73] hover:text-[#D70015] border border-black/[0.06] transition shadow-apple-sm active:scale-95 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#FBFBFD] border-t border-black/[0.06] flex flex-col md:flex-row items-center justify-between text-xs text-[#86868B] gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs text-[#64748B]">
              {filteredOrders.length === orders.length ? (
                <span>
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{orders.length}</strong> total rows
                </span>
              ) : (
                <span>
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{filteredOrders.length}</strong> of{" "}
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{orders.length}</strong> total rows
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
                Rows per page
              </span>
              <div className="relative inline-flex items-center">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                  className="appearance-none bg-white border border-black/[0.1] hover:border-black/[0.2] text-xs font-semibold text-[#1D1D1F] pl-3 pr-7 py-1 rounded-lg shadow-apple-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2 pointer-events-none stroke-[2]" />
              </div>
            </div>

            {/* Page X of Y */}
            <div className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
              Page <span className="font-semibold tabular-nums">{currentPage}</span> of{" "}
              <span className="font-semibold tabular-nums">{totalPages}</span>
            </div>

            {/* Four navigation buttons: First, Previous, Next, Last */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                aria-label="First page"
                title="First page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                title="Previous page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                title="Next page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                aria-label="Last page"
                title="Last page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Profitability Detail Modal */}
      {mounted && selectedOrder && createPortal(
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-black/[0.04] flex items-center justify-between bg-[#FBFBFD]">
              <div>
                <span className="text-[11px] font-mono text-[#86868B] font-semibold block">
                  {selectedOrder.marketplace} • {selectedOrder.channelOrderId}
                </span>
                <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  Order Profitability Breakdown: {selectedOrder.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
                aria-label="Close profitability breakdown modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* P&L Metric Cards */}
              {(() => {
                const pnl = calculateOrderProfitability(
                  selectedOrder,
                  returns,
                  settlements,
                  claims
                );
                return (
                  <div className="p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] space-y-3.5 text-xs shadow-apple-sm">
                    <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
                      <span className="font-semibold text-[#1D1D1F] text-sm">Order Unit Economics</span>
                      <span
                        className={`font-semibold px-3 py-1 rounded-full text-xs border tabular-nums ${
                          pnl.contributionProfit >= 0
                            ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-800 border-rose-500/20"
                        }`}
                      >
                        Net Profit: {formatINR(pnl.contributionProfit)} ({formatPercent(pnl.contributionMargin)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Gross Revenue</span>
                        <span className="font-semibold text-[#1D1D1F] mt-0.5 block text-sm tracking-tight tabular-nums">
                          {formatINR(pnl.grossSales)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Snapshot COGS</span>
                        <span className="font-medium text-[#6E6E73] mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.cogs)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Marketplace Deductions</span>
                        <span className="font-medium text-[#D70015] mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.chargesDeducted)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Return / RTO Losses</span>
                        <span className="font-medium text-[#D70015] mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.returnLoss)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Dispute Recoveries</span>
                        <span className="font-semibold text-[#288548] mt-0.5 block text-sm tracking-tight tabular-nums">
                          +{formatINR(pnl.claimRecovery)}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-black/[0.06] shadow-apple-sm">
                        <span className="text-[#86868B] block text-[11px]">Bank Settlement</span>
                        <span className="font-semibold text-[#288548] mt-0.5 block text-sm tracking-tight tabular-nums">
                          {pnl.isSettled ? formatINR(pnl.settledAmount) : "Pending In Settlement"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Line Items */}
              <div>
                <h3 className="text-xs font-semibold text-[#86868B] mb-2">
                  Line Items (Locked Cost Basis)
                </h3>
                <div className="divide-y divide-black/[0.04] border border-black/[0.06] rounded-2xl overflow-hidden bg-white shadow-apple-sm">
                  {selectedOrder.items.map((i) => (
                    <div key={i.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#1D1D1F] block">{i.productName}</span>
                        <span className="text-[#86868B] text-[11px] tabular-nums font-medium font-mono mt-0.5">
                          {i.sku} • Qty {i.quantity} (Returned: {i.returnedQuantity})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#1D1D1F] block text-sm tracking-tight tabular-nums">
                          {formatINR(i.sellingPrice * i.quantity)}
                        </span>
                        <span className="text-[11px] text-[#288548] font-semibold tabular-nums">
                          Cost locked @ {formatINR(i.snapshotUnitCost)}/u
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transition Status */}
              <div>
                <h3 className="text-xs font-semibold text-[#86868B] mb-2">
                  Update Order Lifecycle Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(["CONFIRMED", "SHIPPED", "DELIVERED", "RTO", "RETURNED", "CANCELLED"] as OrderStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          updateOrderStatus(selectedOrder.id, st);
                          setSelectedOrder((prev) => (prev ? { ...prev, status: st } : null));
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 cursor-pointer ${
                          selectedOrder.status === st
                            ? "bg-[#1D1D1F] text-white shadow-apple-sm"
                            : "bg-black/[0.04] text-[#6E6E73] hover:bg-black/[0.08] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {st.replace(/_/g, " ")}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.04] bg-[#FBFBFD] flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-semibold shadow-apple-sm transition cursor-pointer active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modular Order Creation Modal */}
      <OrderModal
        mode="create"
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        products={products}
        suppliers={suppliers}
        onAddOrder={addOrder}
        onAddSettlement={addSettlement}
        onAddReturn={addReturn}
        onAddClaim={addClaim}
      />


      {/* Modular Order Edit Modal */}
      <OrderModal
        mode="edit"
        isOpen={!!editingOrder}
        initialOrder={editingOrder}
        onClose={() => setEditingOrder(null)}
        products={products}
        suppliers={suppliers}
        onUpdateOrder={updateOrder}
        onAddSettlement={addSettlement}
        onAddReturn={addReturn}
        onAddClaim={addClaim}
      />



      {/* --------------------------------------------------------------------------------- */}
      {/* SINGLE ORDER DELETE CONFIRMATION MODAL                                            */}
      {/* --------------------------------------------------------------------------------- */}
      {mounted && orderToDelete && createPortal(
        <div
          onClick={() => setOrderToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D70015]/[0.08] border border-[#D70015]/15 text-[#D70015] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F]">Delete Order?</h3>
                  <p className="text-xs text-[#86868B] mt-0.5">Order ID: <strong className="font-mono text-[#1D1D1F]">{orderToDelete.id}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                aria-label="Close dialog"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Are you sure you want to permanently delete order <strong className="font-mono text-[#1D1D1F]">{orderToDelete.id}</strong> ({orderToDelete.marketplace}) from the ledger? This will permanently remove its associated line items, return history, and settlements.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.04]">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] rounded-full text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-2 bg-[#D70015] hover:bg-[#B20010] text-white rounded-full text-xs font-semibold transition shadow-apple-sm cursor-pointer active:scale-95"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* BULK DELETE CONFIRMATION MODAL                                                    */}
      {/* --------------------------------------------------------------------------------- */}
      {mounted && isBulkDeleteConfirmOpen && createPortal(
        <div
          onClick={() => setIsBulkDeleteConfirmOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D70015]/[0.08] border border-[#D70015]/15 text-[#D70015] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F]">Delete {selectedOrderIds.length} Orders?</h3>
                  <p className="text-xs text-[#86868B] mt-0.5">Bulk ledger operation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                aria-label="Close dialog"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-[#1D1D1F] font-semibold">{selectedOrderIds.length}</strong> selected orders? This action cannot be undone and will purge all linked transaction records.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.04]">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] rounded-full text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 bg-[#D70015] hover:bg-[#B20010] text-white rounded-full text-xs font-semibold transition shadow-apple-sm cursor-pointer active:scale-95"
              >
                Delete All Selected ({selectedOrderIds.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Real CSV Order Ingestion Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        products={products}
        onImportOrders={handleBatchImportOrders}
      />

      {/* Invoice Auto-Parse Modal (Bulk & Single) */}
      <InvoiceAutoParseModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        products={products}
        suppliers={suppliers}
        onImportOrders={handleBatchImportOrders}
      />
    </div>
  );
}
