"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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

interface OrdersViewProps {
  selectedMarketplace?: Marketplace | "ALL";
}

// Synthesize the Delivery & Return status matching user's exact specification
type SynthesizedStatusKey =
  | "DELIVERED"
  | "CUSTOMER RETURN"
  | "RTO"
  | "DAMAGED RETURN"
  | "CLAIM PENDING"
  | "CLAIM APPROVED"
  | "OTHER";

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
  // 1. Claims
  const approvedClaim = orderClaims.find(
    (c) => c.status === "APPROVED" || c.status === "RECOVERED" || c.status === "PARTIALLY_RECOVERED"
  );
  if (approvedClaim) {
    return {
      key: "CLAIM APPROVED",
      label: "CLAIM APPROVED",
      pillClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotColor: "bg-emerald-500",
    };
  }

  const pendingClaim = orderClaims.find(
    (c) => c.status === "FILED" || c.status === "UNDER_REVIEW"
  );
  if (pendingClaim) {
    return {
      key: "CLAIM PENDING",
      label: "CLAIM PENDING",
      pillClass: "bg-yellow-50 text-yellow-800 border border-yellow-200",
      dotColor: "bg-yellow-500",
    };
  }

  // 2. Returns
  const damagedReturn = orderReturns.find(
    (r) =>
      r.returnType === "DAMAGED_RETURN" ||
      r.condition === "DAMAGED" ||
      r.condition === "UNUSABLE"
  );
  if (damagedReturn) {
    return {
      key: "DAMAGED RETURN",
      label: "DAMAGED RETURN",
      pillClass: "bg-rose-50 text-rose-700 border border-rose-200",
      dotColor: "bg-rose-500",
    };
  }

  const rtoReturn = orderReturns.find((r) => r.returnType === "RTO");
  if (rtoReturn || order.status === "RTO") {
    return {
      key: "RTO",
      label: "RTO",
      pillClass: "bg-amber-50 text-amber-800 border border-amber-200",
      dotColor: "bg-amber-500",
    };
  }

  const customerReturn = orderReturns.find(
    (r) => r.returnType === "CUSTOMER_RETURN"
  );
  if (
    customerReturn ||
    order.status === "RETURNED" ||
    order.status === "PARTIALLY_RETURNED"
  ) {
    return {
      key: "CUSTOMER RETURN",
      label: "CUSTOMER RETURN",
      pillClass: "bg-orange-50 text-orange-800 border border-orange-200",
      dotColor: "bg-orange-500",
    };
  }

  // 3. Fallback to order status
  if (order.status === "DELIVERED") {
    return {
      key: "DELIVERED",
      label: "DELIVERED",
      pillClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotColor: "bg-emerald-500",
    };
  }

  return {
    key: "OTHER",
    label: order.status.replace(/_/g, " "),
    pillClass: "bg-blue-50 text-blue-700 border border-blue-200",
    dotColor: "bg-blue-500",
  };
}

// ----------------------------------------------------
// Enhanced Custom Status & Claims Dropdown
// ----------------------------------------------------
interface StatusDropdownProps {
  selected: string;
  onChange: (val: string) => void;
  counts: Record<string, number>;
}

const STATUS_GROUPS = [
  {
    category: "GENERAL",
    items: [
      { id: "All Statuses", label: "All Statuses", icon: Filter, color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
    ],
  },
  {
    category: "LIFECYCLE & RETURNS",
    items: [
      { id: "DELIVERED", label: "DELIVERED", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
      { id: "CUSTOMER RETURN", label: "CUSTOMER RETURN", icon: RotateCcw, color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
      { id: "RTO", label: "RTO", icon: Truck, color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
      { id: "DAMAGED RETURN", label: "DAMAGED RETURN", icon: AlertTriangle, color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
    ],
  },
  {
    category: "DISPUTES & CLAIMS",
    items: [
      { id: "CLAIM PENDING", label: "CLAIM PENDING", icon: ShieldAlert, color: "bg-yellow-50 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
      { id: "CLAIM APPROVED", label: "CLAIM APPROVED", icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    ],
  },
];

function EnhancedStatusDropdown({ selected, onChange, counts }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allItems = STATUS_GROUPS.flatMap((g) => g.items);
  const activeItem = allItems.find((i) => i.id === selected) || allItems[0];
  const ActiveIcon = activeItem.icon;
  const isFiltered = selected !== "All Statuses";

  return (
    <div ref={containerRef} className="relative min-w-[210px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-4 py-2 bg-white rounded-full text-xs font-medium border transition shadow-xs cursor-pointer ${
          isOpen
            ? "border-slate-900 ring-2 ring-slate-900/10 text-slate-900"
            : isFiltered
            ? "border-slate-900 bg-slate-50 text-slate-950 font-semibold ring-1 ring-slate-900/10"
            : "border-slate-200 hover:border-slate-300 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border text-[10px] ${activeItem.color}`}
          >
            <ActiveIcon className="w-3 h-3" />
          </span>
          <span className="font-semibold truncate">{activeItem.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md font-medium ${
              isFiltered ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {counts[selected] || 0}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-slate-900" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Animated Popup Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl shadow-slate-300/30 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {STATUS_GROUPS.map((group, gIdx) => (
            <div key={group.category} className={gIdx > 0 ? "mt-2 pt-2 border-t border-slate-100" : ""}>
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{group.category}</span>
                <span>Count</span>
              </div>

              <div className="space-y-0.5 mt-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selected === item.id;
                  const count = counts[item.id] || 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                        isSelected
                          ? "bg-slate-100 text-slate-950 font-bold"
                          : "hover:bg-slate-50 text-slate-700 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${item.color}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span>{item.label}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-slate-900 text-white font-bold"
                              : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                          }`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  { id: "CONFIRMED", label: "Mark Confirmed", icon: CheckCircle2, badgeClass: "text-blue-700 bg-blue-50 border-blue-200" },
  { id: "SHIPPED", label: "Mark Shipped", icon: Truck, badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  { id: "DELIVERED", label: "Mark Delivered", icon: Package, badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { id: "RTO", label: "Mark RTO", icon: RotateCcw, badgeClass: "text-amber-700 bg-amber-50 border-amber-200" },
  { id: "RETURNED", label: "Mark Returned", icon: RotateCcw, badgeClass: "text-orange-700 bg-orange-50 border-orange-200" },
  { id: "CANCELLED", label: "Mark Cancelled", icon: X, badgeClass: "text-rose-700 bg-rose-50 border-rose-200" },
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
        className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200/90 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
      >
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Status:</span>
        <span className="text-slate-800">Choose Status...</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-slate-900" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors text-left group cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border ${opt.badgeClass}`}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <span className="font-semibold text-slate-800 group-hover:text-slate-950">
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
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  // ----------------------------------------------------
  // Selection and Bulk Actions State
  // ----------------------------------------------------
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

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
      Other: 0,
    };

    const sCounts: Record<string, number> = {
      "All Statuses": orders.length,
      DELIVERED: 0,
      "CUSTOMER RETURN": 0,
      RTO: 0,
      "DAMAGED RETURN": 0,
      "CLAIM PENDING": 0,
      "CLAIM APPROVED": 0,
    };

    orders.forEach((order) => {
      // Platform counting
      if (order.marketplace === "Amazon India") pCounts["Amazon India"]++;
      else if (order.marketplace === "Flipkart") pCounts.Flipkart++;
      else if (order.marketplace === "Myntra") pCounts.Myntra++;
      else if (order.marketplace === "Meesho") pCounts.Meesho++;
      else if (order.marketplace === "WooCommerce" || order.marketplace === "Personal Website") pCounts.WooCommerce++;
      else pCounts.Other++;

      // Status counting with O(1) indexed lookup
      const orderReturns = returnsMap.get(order.id) || (order.channelOrderId ? returnsMap.get(order.channelOrderId) : undefined) || [];
      const orderClaims = claimsMap.get(order.id) || [];
      const synth = getSynthesizedStatus(order, orderReturns, orderClaims);
      if (sCounts[synth.key] !== undefined) {
        sCounts[synth.key]++;
      }
    });

    return { platformCounts: pCounts, statusCounts: sCounts };
  }, [orders, returnsMap, claimsMap]);

  // Filtered orders pipeline
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      // Global header filter constraint
      if (globalMarketplace !== "ALL" && order.marketplace !== globalMarketplace) {
        return false;
      }

      // 1. Platform Dropdown Filter
      if (platformFilter !== "ALL") {
        if (platformFilter === "WooCommerce") {
          if (order.marketplace !== "WooCommerce" && order.marketplace !== "Personal Website") return false;
        } else {
          if (order.marketplace !== platformFilter) return false;
        }
      }

      // 2. Status & Claims Dropdown Filter with O(1) indexed lookup
      if (statusFilter !== "All Statuses") {
        const orderReturns = returnsMap.get(order.id) || (order.channelOrderId ? returnsMap.get(order.channelOrderId) : undefined) || [];
        const orderClaims = claimsMap.get(order.id) || [];
        const synthesized = getSynthesizedStatus(order, orderReturns, orderClaims);
        if (synthesized.key !== statusFilter) return false;
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
  }, [orders, returnsMap, claimsMap, globalMarketplace, platformFilter, statusFilter, searchQuery]);

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

  const isAnyFilterActive = platformFilter !== "ALL" || statusFilter !== "All Statuses" || searchQuery !== "";

  return (
    <div className="space-y-5 w-full max-w-[1600px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Orders Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold tabular-nums">
              {orders.length} total orders
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Operational order intake, channel synchronization, returns tracking, and snapshot profitability.
          </p>
        </div>

        {/* Top Actions: Import CSV, Export CSV, + Add Order */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition shadow-xs"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Add Order</span>
          </button>
        </div>
      </div>

      {/* Enhanced Control & Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search order ref, SKU, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/70 border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 transition shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Enhanced Custom Platform Dropdown */}
          <PlatformFilterDropdown
            selected={platformFilter}
            onChange={setPlatformFilter}
            counts={platformCounts}
          />

          {/* Enhanced Custom Status & Claims Dropdown */}
          <EnhancedStatusDropdown
            selected={statusFilter}
            onChange={setStatusFilter}
            counts={statusCounts}
          />
        </div>
      </div>

      {/* Floating / Sticky Bulk Actions Bar (Minimal White) */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-bold text-slate-900">
              {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-[11px] text-slate-500 hover:text-slate-900 underline font-medium ml-1 transition-colors"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200/90 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedOrderIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders Table Container matching exact 9 headers in clean light theme */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            {/* Headers in exact required order */}
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    title={isAllFilteredSelected ? "Deselect all orders" : "Select all orders"}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 accent-slate-900 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 font-semibold">PLATFORM & DATE</th>
                <th className="py-3.5 px-4 font-semibold">ORDER ID & SKU</th>
                <th className="py-3.5 px-4 font-semibold">PRODUCT NAME</th>
                <th className="py-3.5 px-4 font-semibold">GROSS SALE</th>
                <th className="py-3.5 px-4 font-semibold">COGS</th>
                <th className="py-3.5 px-4 font-semibold">SETTLEMENT</th>
                <th className="py-3.5 px-4 font-semibold">NET PROFIT</th>
                <th className="py-3.5 px-4 font-semibold text-center">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Filter className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No orders matching active filters found.</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Try changing your platform or status selection, or clearing your search keywords.
                      </p>
                      {isAnyFilterActive && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setPlatformFilter("ALL");
                            setStatusFilter("All Statuses");
                          }}
                          className="text-xs px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 font-semibold mt-2 transition"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
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
                      key={order.id}
                      className={`transition-colors duration-150 text-slate-800 group ${
                        selectedOrderIds.includes(order.id)
                          ? "bg-slate-100/90 hover:bg-slate-100 font-medium"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => handleToggleSelectOrder(order.id)}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 accent-slate-900 cursor-pointer"
                        />
                      </td>

                      {/* 1. PLATFORM & DATE */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${platformBadge.pillClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${platformBadge.dotClass}`}></span>
                            <span>{platformBadge.label}</span>
                          </span>
                          <div className="text-[11px] text-slate-500 font-medium tabular-nums">
                            {formatDate(order.orderDate)}
                          </div>
                        </div>
                      </td>

                      {/* 2. ORDER ID & SKU */}
                      <td className="py-3.5 px-4 align-middle">
                        <div>
                          <span className="font-semibold text-slate-900 block text-xs tracking-tight group-hover:text-slate-950 transition-colors tabular-nums">
                            {order.id}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[150px] tabular-nums font-medium">
                            {primaryItem ? primaryItem.sku : "NO-SKU"}
                            {extraItemsCount > 0 && ` (+${extraItemsCount})`}
                          </span>
                        </div>
                      </td>

                      {/* 3. PRODUCT NAME */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="max-w-[220px]">
                          <div
                            className="font-semibold text-slate-800 truncate text-xs"
                            title={primaryItem?.productName || "No Item"}
                          >
                            {primaryItem ? primaryItem.productName : "No item recorded"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200/60 tabular-nums">
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
                        <div className="text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
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
                            <span className="text-[10px] text-emerald-700 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 inline-block mt-0.5">
                              Settled
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{formatINR(grossSale - order.marketplaceChargesEstimate)}</span>
                            </div>
                            <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60 inline-block mt-0.5">
                              Pending
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. NET PROFIT */}
                      <td className="py-3.5 px-4 align-middle">
                        <div
                          className={`text-sm font-semibold tracking-tight tabular-nums ${
                            pnl.contributionProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                          }`}
                        >
                          {pnl.contributionProfit >= 0 ? "+" : ""}
                          {formatINR(pnl.contributionProfit)}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border tabular-nums inline-block ${
                              pnl.contributionProfit >= 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                                : "bg-rose-50 text-rose-700 border-rose-200/60"
                            }`}
                          >
                            {formatPercent(pnl.contributionMargin)}
                          </span>
                        </div>
                      </td>

                      {/* 10. ACTIONS */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="View Profitability Breakdown"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 transition shadow-xs"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(order)}
                            title="Edit Order Data"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 transition shadow-xs"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            title="Delete Order"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition shadow-xs"
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
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-4">
            <div>
              Showing{" "}
              <span className="font-bold text-slate-800">
                {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * pageSize, filteredOrders.length)}
              </span>{" "}
              of <span className="font-bold text-slate-800">{filteredOrders.length}</span> filtered orders
              {filteredOrders.length !== orders.length && (
                <span className="text-slate-400 ml-1 font-normal">({orders.length} total)</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-[11px] text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg text-xs font-semibold py-0.5 px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-[11px] mr-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Settled
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
              </span>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 transition"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-0.5 text-xs font-medium text-slate-700">
                Page <span className="font-bold text-slate-900">{currentPage}</span> of{" "}
                <span className="font-bold text-slate-900">{totalPages}</span>
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 transition"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Profitability Detail Modal / Drawer (Light Fintech) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[11px] font-mono text-slate-500 font-semibold block">
                  {selectedOrder.marketplace} • {selectedOrder.channelOrderId}
                </span>
                <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                  Order Profitability Breakdown: {selectedOrder.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
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
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-bold text-slate-900 text-sm">Order Unit Economics</span>
                      <span
                        className={`font-bold px-3 py-1 rounded-full text-xs border ${
                          pnl.contributionProfit >= 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        Net Profit: {formatINR(pnl.contributionProfit)} ({formatPercent(pnl.contributionMargin)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">Gross Revenue</span>
                        <span className="font-semibold text-[#1D1D1F] mt-0.5 block text-sm tracking-tight tabular-nums">
                          {formatINR(pnl.grossSales)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">Snapshot COGS</span>
                        <span className="font-semibold text-slate-600 mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.cogs)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">Marketplace Deductions</span>
                        <span className="font-semibold text-[#D70015] mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.chargesDeducted)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">Return / RTO Losses</span>
                        <span className="font-semibold text-[#D70015] mt-0.5 block text-sm tracking-tight tabular-nums">
                          -{formatINR(pnl.returnLoss)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">SPF / Dispute Recoveries</span>
                        <span className="font-semibold text-[#288548] mt-0.5 block text-sm tracking-tight tabular-nums">
                          +{formatINR(pnl.claimRecovery)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[11px]">Bank Settlement</span>
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
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Line Items (Locked Cost Basis)
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {selectedOrder.items.map((i) => (
                    <div key={i.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 block">{i.productName}</span>
                        <span className="text-slate-500 text-[11px] tabular-nums font-medium">
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
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          selectedOrder.status === st
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        {st.replace(/_/g, " ")}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Order?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Order ID: <strong className="font-mono text-slate-800">{orderToDelete.id}</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete order <strong className="font-mono text-slate-900">{orderToDelete.id}</strong> ({orderToDelete.marketplace}) from the ledger? This will permanently remove its associated line items, return history, and settlements.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* BULK DELETE CONFIRMATION MODAL                                                    */}
      {/* --------------------------------------------------------------------------------- */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete {selectedOrderIds.length} Orders?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bulk ledger operation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-slate-900 font-bold">{selectedOrderIds.length}</strong> selected orders? This action cannot be undone and will purge all linked transaction records.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20"
              >
                Delete All Selected ({selectedOrderIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Real CSV Order Ingestion Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        products={products}
        onImportOrders={handleBatchImportOrders}
      />
    </div>
  );
}
