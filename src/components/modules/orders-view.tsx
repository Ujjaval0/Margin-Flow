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
} from "lucide-react";
import { calculateOrderProfitability } from "@/domain/profitability-engine";

interface OrdersViewProps {
  selectedMarketplace: Marketplace | "ALL";
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

function getPlatformBadge(marketplace: Marketplace): { label: string; pillClass: string; dotClass: string } {
  switch (marketplace) {
    case "Amazon India":
      return { label: "AMAZON", pillClass: "bg-amber-50 text-amber-800 border border-amber-200/80", dotClass: "bg-amber-500" };
    case "Flipkart":
      return { label: "FLIPKART", pillClass: "bg-blue-50 text-blue-800 border border-blue-200/80", dotClass: "bg-blue-500" };
    case "Meesho":
      return { label: "MEESHO", pillClass: "bg-pink-50 text-pink-800 border border-pink-200/80", dotClass: "bg-pink-500" };
    case "Myntra":
      return { label: "MYNTRA", pillClass: "bg-purple-50 text-purple-800 border border-purple-200/80", dotClass: "bg-purple-500" };
    case "WooCommerce":
    case "Personal Website":
      return { label: "WOOCOMMERCE", pillClass: "bg-indigo-50 text-indigo-800 border border-indigo-200/80", dotClass: "bg-indigo-500" };
    default:
      return { label: "OTHER", pillClass: "bg-slate-100 text-slate-700 border border-slate-200", dotClass: "bg-slate-500" };
  }
}

// ----------------------------------------------------
// Enhanced Custom Platform Dropdown with Icons & Counts
// ----------------------------------------------------
interface PlatformDropdownProps {
  selected: string;
  onChange: (val: string) => void;
  counts: Record<string, number>;
}

const PLATFORM_OPTIONS = [
  { id: "All Platforms", label: "All Platforms", icon: Layers, tag: "ALL", color: "text-slate-700 bg-slate-100" },
  { id: "AMAZON", label: "AMAZON", icon: ShoppingBag, tag: "AMZ", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { id: "FLIPKART", label: "FLIPKART", icon: ShoppingCart, tag: "FK", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { id: "MYNTRA", label: "MYNTRA", icon: Sparkles, tag: "MYN", color: "text-purple-700 bg-purple-50 border-purple-200" },
  { id: "MEESHO", label: "MEESHO", icon: Tag, tag: "MSH", color: "text-pink-700 bg-pink-50 border-pink-200" },
  { id: "WOOCOMMERCE", label: "WOOCOMMERCE", icon: Globe, tag: "WC", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  { id: "OTHER", label: "OTHER", icon: Store, tag: "OTH", color: "text-slate-700 bg-slate-100 border-slate-200" },
];

function EnhancedPlatformDropdown({ selected, onChange, counts }: PlatformDropdownProps) {
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

  const activeOption = PLATFORM_OPTIONS.find((o) => o.id === selected) || PLATFORM_OPTIONS[0];
  const ActiveIcon = activeOption.icon;
  const isFiltered = selected !== "All Platforms";

  return (
    <div ref={containerRef} className="relative min-w-[190px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-4 py-2 bg-white rounded-full text-xs font-medium border transition shadow-xs ${
          isOpen
            ? "border-purple-600 ring-2 ring-purple-600/15"
            : isFiltered
            ? "border-purple-300 bg-purple-50/20 text-purple-900"
            : "border-slate-200 hover:border-slate-300 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold border ${activeOption.color}`}
          >
            <ActiveIcon className="w-3 h-3" />
          </span>
          <span className="font-semibold truncate">{activeOption.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium">
            {counts[selected] || 0}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-purple-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Animated Popup Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl shadow-slate-300/30 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Filter By Platform</span>
            <span>Orders</span>
          </div>

          <div className="space-y-0.5">
            {PLATFORM_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.id;
              const count = counts[option.id] || 0;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group ${
                    isSelected
                      ? "bg-purple-50 text-purple-900 font-bold"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${option.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span>{option.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-purple-200/80 text-purple-800 font-bold"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-600" />}
                  </div>
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
        className={`w-full flex items-center justify-between gap-2.5 px-4 py-2 bg-white rounded-full text-xs font-medium border transition shadow-xs ${
          isOpen
            ? "border-purple-600 ring-2 ring-purple-600/15"
            : isFiltered
            ? "border-purple-400 bg-purple-50/20 text-purple-900 ring-1 ring-purple-500/20"
            : "border-purple-200/90 hover:border-purple-300 text-slate-800"
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
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-purple-100/70 text-purple-800 font-medium">
            {counts[selected] || 0}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-purple-500 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-purple-700" : ""
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
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group ${
                        isSelected
                          ? "bg-purple-50 text-purple-900 font-bold"
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
                              ? "bg-purple-200/80 text-purple-800 font-bold"
                              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                          }`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-600" />}
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
// Custom Marketplace Selector Dropdown for Add Order Modal
// ----------------------------------------------------
interface FormMarketplaceOption {
  id: Marketplace;
  label: string;
  sublabel: string;
  estComm: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const FORM_MARKETPLACE_OPTIONS: FormMarketplaceOption[] = [
  {
    id: "Amazon India",
    label: "Amazon India",
    sublabel: "15% est. fee",
    estComm: 15,
    icon: ShoppingBag,
    color: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  {
    id: "Flipkart",
    label: "Flipkart",
    sublabel: "15% est. fee",
    estComm: 15,
    icon: ShoppingCart,
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
  {
    id: "Myntra",
    label: "Myntra",
    sublabel: "20% est. fee",
    estComm: 20,
    icon: Store,
    color: "bg-pink-500/10 text-pink-700 border-pink-500/20",
  },
  {
    id: "Meesho",
    label: "Meesho",
    sublabel: "0% commission",
    estComm: 0,
    icon: Tag,
    color: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  },
  {
    id: "Personal Website",
    label: "Direct Store / Personal Website",
    sublabel: "2% gateway fee",
    estComm: 2,
    icon: Globe,
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  {
    id: "Other",
    label: "Other Channel / Offline Wholesale",
    sublabel: "Custom / 0% fee",
    estComm: 0,
    icon: Layers,
    color: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  },
];

function FormMarketplaceDropdown({
  selected,
  onChange,
}: {
  selected: Marketplace;
  onChange: (mp: Marketplace, estComm: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeOption =
    FORM_MARKETPLACE_OPTIONS.find((o) => o.id === selected) || FORM_MARKETPLACE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
          isOpen
            ? "border-purple-600 ring-2 ring-purple-500/15 bg-white"
            : "border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${activeOption.color}`}
          >
            <ActiveIcon className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{activeOption.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-medium">
              {activeOption.sublabel}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-purple-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-300/30 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Select Channel / Marketplace</span>
            <span>Est. Platform Fee</span>
          </div>
          <div className="space-y-0.5">
            {FORM_MARKETPLACE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id, option.estComm);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors group ${
                    isSelected
                      ? "bg-purple-50 text-purple-900 font-bold"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${option.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold text-slate-800 group-hover:text-slate-900">
                      {option.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-purple-200/80 text-purple-800 font-semibold"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      {option.sublabel}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                  </div>
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
export function OrdersView({ selectedMarketplace: globalMarketplace }: OrdersViewProps) {
  const {
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

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All Platforms");
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
  const [editMarketplace, setEditMarketplace] = useState<Marketplace>("Amazon India");
  const [editChannelOrderId, setEditChannelOrderId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editCommissionPercent, setEditCommissionPercent] = useState("15");
  const [editActualReceived, setEditActualReceived] = useState("");
  const [editStatus, setEditStatus] = useState<OrderStatus>("CONFIRMED");
  const [editNotes, setEditNotes] = useState("");

  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setEditMarketplace(order.marketplace);
    setEditChannelOrderId(order.channelOrderId || order.id);
    setEditDate(order.orderDate);
    const item = order.items[0];
    setEditSku(item?.sku || "");
    setEditProductName(item?.productName || "");
    setEditQuantity(String(item?.quantity || 1));
    setEditUnitCost(String(item?.snapshotUnitCost || 0));
    setEditSellingPrice(String(item?.sellingPrice || 0));

    const gross = (item?.sellingPrice || 0) * (item?.quantity || 1);
    const estComm =
      order.marketplaceChargesEstimate && gross > 0
        ? String(Math.round((order.marketplaceChargesEstimate / gross) * 100))
        : "15";
    setEditCommissionPercent(estComm);

    const settlement = settlements.find((s) => s.orderId === order.id);
    setEditActualReceived(settlement ? String(settlement.netSettlement) : "");
    setEditStatus(order.status);
    setEditNotes(order.notes || "");
  };

  const handleSelectEditSku = (skuValue: string) => {
    setEditSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setEditProductName(prod.name);
      setEditUnitCost(String(prod.currentCostPrice));
      setEditSellingPrice(String(Math.round(prod.currentCostPrice * 2.5)));
    }
  };

  const parsedEditQty = parseFloat(editQuantity) || 0;
  const parsedEditUnitCost = parseFloat(editUnitCost) || 0;
  const parsedEditSellingPrice = parseFloat(editSellingPrice) || 0;
  const parsedEditCommPercent = parseFloat(editCommissionPercent) || 0;
  const parsedEditActualReceived = parseFloat(editActualReceived) || 0;

  const editTotalWholesaleCost = parsedEditQty * parsedEditUnitCost;
  const editGrossSales = parsedEditQty * parsedEditSellingPrice;
  const editCommissionDeduction = Math.round(editGrossSales * (parsedEditCommPercent / 100));
  const editExpectedSettlement = Math.max(0, editGrossSales - editCommissionDeduction);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const qty = parsedEditQty || 1;
    const unitPrice = parsedEditSellingPrice;
    const unitCost = parsedEditUnitCost;

    const updatedItems = [
      {
        ...(editingOrder.items[0] || {
          id: `ITEM-${Date.now()}`,
          discount: 0,
          returnedQuantity: 0,
        }),
        sku: editSku.trim() || "SKU-ITEM",
        productName: editProductName.trim() || "Product Item",
        quantity: qty,
        sellingPrice: unitPrice,
        taxAmount: Math.round(unitPrice * qty * 0.18 * 100) / 100,
        snapshotUnitCost: unitCost,
        returnedQuantity: editStatus === "RTO" || editStatus === "RETURNED" ? qty : 0,
      },
      ...editingOrder.items.slice(1),
    ];

    const updatedOrder: Order = {
      ...editingOrder,
      marketplace: editMarketplace,
      channelOrderId: editChannelOrderId.trim() || editingOrder.channelOrderId,
      orderDate: editDate || editingOrder.orderDate,
      status: editStatus,
      notes: editNotes,
      marketplaceChargesEstimate: editCommissionDeduction,
      items: updatedItems,
    };

    updateOrder(updatedOrder);

    if (parsedEditActualReceived > 0) {
      const createdSettlement: Settlement = {
        id: `SET-${editingOrder.id}`,
        settlementBatchId: `BATCH-${Date.now().toString().slice(-4)}`,
        marketplace: editMarketplace,
        settlementDate: editDate || new Date().toISOString().split("T")[0],
        orderId: editingOrder.id,
        grossAmount: editGrossSales,
        deductions: [
          { category: "COMMISSION", name: "Marketplace Commission", amount: editCommissionDeduction },
          {
            category: "LOGISTICS",
            name: "Logistics & Forwarding",
            amount: Math.max(0, editGrossSales - parsedEditActualReceived - editCommissionDeduction),
          },
        ],
        tcsTdsTax: Math.round(editGrossSales * 0.01),
        netSettlement: parsedEditActualReceived,
        reconciliationStatus: "RECONCILED",
        bankTxRef: `BANK-DEP-${editingOrder.id.slice(-4)}`,
      };
      addSettlement(createdSettlement);
    }

    setEditingOrder(null);
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

  // ----------------------------------------------------
  // Simple, Frictionless Manual Order Form State
  // ----------------------------------------------------
  const [formMarketplace, setFormMarketplace] = useState<Marketplace>("Amazon India");
  const [formOrderId, setFormOrderId] = useState(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formSku, setFormSku] = useState("");
  const [formProductName, setFormProductName] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");

  // Wholesaler / Supplier Cost (COGS)
  const [formSupplierName, setFormSupplierName] = useState("");
  const [formUnitWholesaleCost, setFormUnitWholesaleCost] = useState("");

  // Platform Settlement Figures
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formEstCommissionPercent, setFormEstCommissionPercent] = useState("15");
  const [formActualReceived, setFormActualReceived] = useState("");

  // Return / RTO Flag & Detailed Fields
  const [formIsReturned, setFormIsReturned] = useState(false);
  const [formReturnType, setFormReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [formReturnFee, setFormReturnFee] = useState("0");
  const [formReturnReason, setFormReturnReason] = useState("");
  const [formIsDamagedClaim, setFormIsDamagedClaim] = useState(false);
  const [formClaimAmount, setFormClaimAmount] = useState("0");
  const [formClaimStatus, setFormClaimStatus] = useState<"Draft" | "Filed" | "Approved" | "Rejected">("Draft");
  const [formApprovedReimbursement, setFormApprovedReimbursement] = useState("0");

  // General Notes
  const [formNotes, setFormNotes] = useState("");

  // Helper when user selects a platform
  const handleSelectFormMarketplace = (mp: Marketplace, defaultCommission: number) => {
    setFormMarketplace(mp);
    setFormEstCommissionPercent(String(defaultCommission));
  };

  // Helper when user selects a catalog SKU
  const handleSelectFormSku = (skuValue: string) => {
    setFormSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setFormProductName(prod.name);
      setFormUnitWholesaleCost(String(prod.currentCostPrice));
      setFormSellingPrice(String(Math.round(prod.currentCostPrice * 2.5)));
    }
  };

  // Live Calculations (frictionless & safe against empty strings)
  const parsedQty = parseFloat(formQuantity) || 0;
  const parsedUnitCost = parseFloat(formUnitWholesaleCost) || 0;
  const parsedSellingPrice = parseFloat(formSellingPrice) || 0;
  const parsedCommPercent = parseFloat(formEstCommissionPercent) || 0;
  const parsedActualReceived = parseFloat(formActualReceived) || 0;

  const formTotalWholesaleCost = parsedQty * parsedUnitCost;
  const formGrossSales = parsedQty * parsedSellingPrice;
  const formCommissionDeduction = Math.round(formGrossSales * (parsedCommPercent / 100));
  const formExpectedSettlement = Math.max(0, formGrossSales - formCommissionDeduction);

  // Calculate live counts for each platform and status option
  const { platformCounts, statusCounts } = useMemo(() => {
    const pCounts: Record<string, number> = {
      "All Platforms": orders.length,
      AMAZON: 0,
      FLIPKART: 0,
      MYNTRA: 0,
      MEESHO: 0,
      WOOCOMMERCE: 0,
      OTHER: 0,
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
      if (order.marketplace === "Amazon India") pCounts.AMAZON++;
      else if (order.marketplace === "Flipkart") pCounts.FLIPKART++;
      else if (order.marketplace === "Myntra") pCounts.MYNTRA++;
      else if (order.marketplace === "Meesho") pCounts.MEESHO++;
      else if (order.marketplace === "WooCommerce" || order.marketplace === "Personal Website") pCounts.WOOCOMMERCE++;
      else pCounts.OTHER++;

      // Status counting
      const orderReturns = returns.filter((r) => r.orderId === order.id);
      const orderClaims = claims.filter((c) => c.orderId === order.id);
      const synth = getSynthesizedStatus(order, orderReturns, orderClaims);
      if (sCounts[synth.key] !== undefined) {
        sCounts[synth.key]++;
      }
    });

    return { platformCounts: pCounts, statusCounts: sCounts };
  }, [orders, returns, claims]);

  // Filtered orders pipeline
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Global header filter constraint
      if (globalMarketplace !== "ALL" && order.marketplace !== globalMarketplace) {
        return false;
      }

      // 1. Platform Dropdown Filter
      if (platformFilter !== "All Platforms") {
        if (platformFilter === "AMAZON" && order.marketplace !== "Amazon India") return false;
        if (platformFilter === "FLIPKART" && order.marketplace !== "Flipkart") return false;
        if (platformFilter === "MYNTRA" && order.marketplace !== "Myntra") return false;
        if (platformFilter === "MEESHO" && order.marketplace !== "Meesho") return false;
        if (platformFilter === "WOOCOMMERCE" && order.marketplace !== "WooCommerce" && order.marketplace !== "Personal Website") return false;
        if (platformFilter === "OTHER" && order.marketplace !== "Other") return false;
      }

      // 2. Status & Claims Dropdown Filter
      const orderReturns = returns.filter((r) => r.orderId === order.id);
      const orderClaims = claims.filter((c) => c.orderId === order.id);
      const synthesized = getSynthesizedStatus(order, orderReturns, orderClaims);

      if (statusFilter !== "All Statuses") {
        if (synthesized.key !== statusFilter) return false;
      }

      // 3. Search Bar Filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q) || order.channelOrderId.toLowerCase().includes(q);
        const matchesCustomer = order.customerName.toLowerCase().includes(q);
        const matchesItem = order.items.some(
          (i) => i.sku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)
        );
        if (!matchesId && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, returns, claims, globalMarketplace, platformFilter, statusFilter, searchQuery]);

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
      const orderReturns = returns.filter((r) => r.orderId === o.id);
      const orderClaims = claims.filter((c) => c.orderId === o.id);
      const synthStatus = getSynthesizedStatus(o, orderReturns, orderClaims);
      const item = o.items[0];
      const grossSale = o.items.reduce((sum, i) => sum + (i.sellingPrice * i.quantity - i.discount), 0);
      const cogs = o.items.reduce((sum, i) => sum + (i.snapshotUnitCost * i.quantity), 0);
      const platformBadge = getPlatformBadge(o.marketplace);

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

  // Comprehensive Order Creation Handler
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const orderId = formOrderId.trim() || `ORD-${Date.now().toString().slice(-6)}`;
    const snapshotCost = parsedUnitCost;
    const unitPrice = parsedSellingPrice;
    const qty = parsedQty || 1;

    // 1. Create the Order
    const createdOrder: Order = {
      id: orderId,
      channelOrderId: `REF-${orderId.replace("ORD-", "")}`,
      marketplace: formMarketplace,
      orderDate: formDate,
      status: formIsReturned ? "RTO" : "CONFIRMED",
      customerName: "Direct Buyer",
      customerCity: "Mumbai",
      customerState: "Maharashtra",
      shippingFeeCharged: 0,
      marketplaceChargesEstimate: formCommissionDeduction,
      notes: formNotes,
      items: [
        {
          id: `ITEM-${Date.now().toString().slice(-4)}`,
          sku: formSku || "CUSTOM-SKU",
          productName: formProductName || "Custom Order Item",
          quantity: qty,
          sellingPrice: unitPrice,
          discount: 0,
          taxAmount: Math.round(unitPrice * qty * 0.18 * 100) / 100,
          snapshotUnitCost: snapshotCost,
          returnedQuantity: formIsReturned ? qty : 0,
        },
      ],
    };

    addOrder(createdOrder);

    // 2. If Actual Received is populated, create a reconciled Settlement record
    if (parsedActualReceived > 0) {
      const createdSettlement: Settlement = {
        id: `SETTLE-${Date.now().toString().slice(-4)}`,
        settlementBatchId: `BATCH-${Date.now().toString().slice(-4)}`,
        marketplace: formMarketplace,
        settlementDate: formDate,
        orderId: createdOrder.id,
        grossAmount: formGrossSales,
        deductions: [
          { category: "COMMISSION", name: "Marketplace Commission", amount: formCommissionDeduction },
          {
            category: "LOGISTICS",
            name: "Logistics & Forwarding",
            amount: Math.max(0, formGrossSales - parsedActualReceived - formCommissionDeduction),
          },
        ],
        tcsTdsTax: Math.round(formGrossSales * 0.01),
        netSettlement: parsedActualReceived,
        reconciliationStatus: "RECONCILED",
        bankTxRef: `BANK-DEP-${orderId.slice(-4)}`,
      };
      addSettlement(createdSettlement);
    }

    // 3. If marked as Returned / RTO, create linked return record and claim
    if (formIsReturned) {
      const retId = `RET-${Date.now().toString().slice(-4)}`;
      const parsedFee = parseFloat(formReturnFee) || 0;
      const parsedClaim = parseFloat(formClaimAmount) || 0;
      const parsedReimbursement = parseFloat(formApprovedReimbursement) || 0;

      let claimIdToLink: string | undefined = undefined;

      if (formIsDamagedClaim) {
        claimIdToLink = `CLM-${Date.now().toString().slice(-4)}`;
        let mappedClaimStatus: Claim["status"] = "FILED";
        if (formClaimStatus === "Draft") mappedClaimStatus = "NOT_FILED";
        else if (formClaimStatus === "Approved") mappedClaimStatus = "APPROVED";
        else if (formClaimStatus === "Rejected") mappedClaimStatus = "REJECTED";

        const newClaim: Claim = {
          id: claimIdToLink,
          orderId: createdOrder.id,
          returnId: retId,
          marketplace: formMarketplace,
          claimType: formReturnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
          claimDate: formDate,
          amountClaimed: parsedClaim > 0 ? parsedClaim : snapshotCost * qty,
          amountRecovered: parsedReimbursement,
          status: mappedClaimStatus,
          recoveryDate: formClaimStatus === "Approved" ? formDate : undefined,
          notes: formReturnReason || "Damaged/Defective claim logged at order creation",
        };
        addClaim(newClaim);
        createdOrder.claimIds = [claimIdToLink];
      }

      const isDamaged = formIsDamagedClaim || formReturnType === "DAMAGED_RETURN";
      const calculatedLoss = parsedFee + (isDamaged ? Math.max(0, snapshotCost * qty - parsedReimbursement) : 0);

      const createdReturn: ReturnRecord = {
        id: retId,
        orderId: createdOrder.id,
        channelOrderId: createdOrder.channelOrderId,
        marketplace: formMarketplace,
        returnDate: formDate,
        receivedDate: formDate,
        returnType: formReturnType,
        returnReason: formReturnReason || (formReturnType === "RTO" ? "RTO Undelivered" : "Customer Return"),
        sku: formSku || "CUSTOM-SKU",
        productName: formProductName,
        quantity: qty,
        condition: isDamaged ? "DAMAGED" : "SELLABLE",
        restockStatus: isDamaged ? "WRITTEN_OFF" : "PENDING_RESTOCK",
        returnShippingCost: parsedFee,
        otherReturnCosts: 0,
        inventoryRecoveryValue: isDamaged ? parsedReimbursement : snapshotCost * qty,
        lossAmount: calculatedLoss,
        claimId: claimIdToLink,
        notes: formReturnReason || formNotes || "Marked as Returned/RTO order",
      };
      addReturn(createdReturn);
      createdOrder.returnIds = [retId];
      createdOrder.status = formReturnType === "RTO" ? "RTO" : "RETURNED";
    }

    // Reset and close
    setIsCreateOpen(false);
    setFormOrderId(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormSku("");
    setFormProductName("");
    setFormQuantity("1");
    setFormUnitWholesaleCost("");
    setFormSellingPrice("");
    setFormActualReceived("");
    setFormIsReturned(false);
    setFormReturnType("CUSTOMER_RETURN");
    setFormReturnFee("0");
    setFormReturnReason("");
    setFormIsDamagedClaim(false);
    setFormClaimAmount("0");
    setFormClaimStatus("Draft");
    setFormApprovedReimbursement("0");
    setFormNotes("");
  };

  // Sample CSV Import Handlers
  const handleSampleCsvImport = (channel: Marketplace) => {
    const batchId = Date.now().toString().slice(-3);
    const importedOrder: Order = {
      id: `ORD-CSV-${batchId}`,
      channelOrderId: `${channel.slice(0, 2).toUpperCase()}-CSV-${batchId}99`,
      marketplace: channel,
      orderDate: new Date().toISOString().split("T")[0],
      status: "CONFIRMED",
      customerName: `CSV Buyer (${channel})`,
      customerCity: "Pune",
      customerState: "Maharashtra",
      shippingFeeCharged: 40,
      marketplaceChargesEstimate: 180,
      items: [
        {
          id: `ITEM-CSV-${batchId}`,
          sku: products[1]?.sku || "ELEC-USBC-65W",
          productName: products[1]?.name || "65W GaN Fast Charger",
          quantity: 1,
          sellingPrice: 1299,
          discount: 50,
          taxAmount: 190.5,
          snapshotUnitCost: products[1]?.currentCostPrice || 420,
          returnedQuantity: 0,
        },
      ],
    };
    addOrder(importedOrder);
    setIsCsvImportOpen(false);
  };

  const isAnyFilterActive = platformFilter !== "All Platforms" || statusFilter !== "All Statuses" || searchQuery !== "";

  return (
    <div className="space-y-5 w-full max-w-[1600px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Orders Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold">
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white transition shadow-sm shadow-purple-600/20"
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
              className="w-full pl-9 pr-8 py-2 bg-slate-50/70 border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 transition shadow-xs"
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
          <EnhancedPlatformDropdown
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

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-bold text-purple-950">
              {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-[11px] text-purple-700 hover:text-purple-950 underline font-semibold ml-1"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Status Update Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-purple-200 px-3.5 py-1.5 rounded-full shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Change Status:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value as OrderStatus);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="" disabled>Choose Status...</option>
                <option value="CONFIRMED">Mark Confirmed</option>
                <option value="SHIPPED">Mark Shipped</option>
                <option value="DELIVERED">Mark Delivered</option>
                <option value="RTO">Mark RTO</option>
                <option value="RETURNED">Mark Returned</option>
                <option value="CANCELLED">Mark Cancelled</option>
              </select>
            </div>

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs"
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
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 accent-purple-600 cursor-pointer"
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
                            setPlatformFilter("All Platforms");
                            setStatusFilter("All Statuses");
                          }}
                          className="text-xs px-3.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-semibold mt-2 transition"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const pnl = calculateOrderProfitability(order, returns, settlements, claims);
                  const orderReturns = returns.filter((r) => r.orderId === order.id);
                  const orderClaims = claims.filter((c) => c.orderId === order.id);
                  const synthStatus = getSynthesizedStatus(order, orderReturns, orderClaims);
                  const platformBadge = getPlatformBadge(order.marketplace);
                  const primaryItem = order.items[0];
                  const extraItemsCount = order.items.length - 1;

                  const grossSale = order.items.reduce(
                    (sum, i) => sum + i.sellingPrice * i.quantity - i.discount,
                    0
                  );
                  const cogsBasis = order.items.reduce(
                    (sum, i) => sum + i.snapshotUnitCost * i.quantity,
                    0
                  );

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors duration-150 text-slate-800 group ${
                        selectedOrderIds.includes(order.id)
                          ? "bg-purple-50/50 hover:bg-purple-50/80"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={() => handleToggleSelectOrder(order.id)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 accent-purple-600 cursor-pointer"
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
                          <span className="font-semibold text-slate-900 block text-xs tracking-tight group-hover:text-purple-700 transition-colors tabular-nums">
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
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition shadow-xs"
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

        {/* Footer info bar */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            Showing <span className="font-bold text-slate-800">{filteredOrders.length}</span> of{" "}
            <span className="font-bold text-slate-800">{orders.length}</span> total transactions
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Delivered / Settled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> RTO / Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Damaged / Losses
            </span>
          </div>
        </div>
      </div>

      {/* Order Profitability Detail Modal / Drawer (Light Fintech) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[11px] font-mono text-purple-600 font-semibold block">
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

      {/* --------------------------------------------------------------------------------- */}
      {/* SIMPLIFIED MANUAL ORDER CREATION MODAL Matching User Images with Zero Friction    */}
      {/* --------------------------------------------------------------------------------- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Add Order
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* 1. SELECT MARKETPLACE PLATFORM */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  SELECT MARKETPLACE PLATFORM
                </label>
                <FormMarketplaceDropdown
                  selected={formMarketplace}
                  onChange={(mp, estComm) => handleSelectFormMarketplace(mp, estComm)}
                />
              </div>

              {/* 2. ORDER ID, DATE, SKU */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    ORDER ID / REFERENCE #
                  </label>
                  <input
                    type="text"
                    value={formOrderId}
                    onChange={(e) => setFormOrderId(e.target.value)}
                    placeholder="e.g. ORD-476140"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    TRANSACTION DATE
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    SKU / ITEM CODE
                  </label>
                  <input
                    type="text"
                    list="catalog-skus-simplified"
                    value={formSku}
                    onChange={(e) => handleSelectFormSku(e.target.value)}
                    placeholder="e.g. SKU-COT-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                  <datalist id="catalog-skus-simplified">
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 3. PRODUCT TITLE & QUANTITY */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PRODUCT TITLE / NAME
                  </label>
                  <input
                    type="text"
                    value={formProductName}
                    onChange={(e) => setFormProductName(e.target.value)}
                    placeholder="e.g. Embroidered Cotton Kurti"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    QUANTITY
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-bold"
                    required
                  />
                </div>
              </div>

              {/* 4. WHOLESALER / SUPPLIER PURCHASE COST (COGS) */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span className="uppercase tracking-wider">WHOLESALER / SUPPLIER PURCHASE COST (COGS)</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      WHOLESALER NAME
                    </label>
                    <select
                      value={formSupplierName}
                      onChange={(e) => setFormSupplierName(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                      <option value="Direct Supplier">Direct Supplier / Spot Purchase</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      UNIT WHOLESALER COST (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formUnitWholesaleCost}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormUnitWholesaleCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  Total Wholesale COGS: <strong className="text-slate-800 font-bold font-mono">{formatINR(formTotalWholesaleCost)}</strong>
                </div>
              </div>

              {/* 5. PLATFORM SETTLEMENT FIGURES */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-purple-700 font-bold text-xs uppercase tracking-wider">
                    PLATFORM SETTLEMENT FIGURES
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    EST. COMMISSION: <strong className="text-purple-700 font-mono">{parsedCommPercent}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      SELLING PRICE (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formSellingPrice}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormSellingPrice(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      EST. COMMISSION (%)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={formEstCommissionPercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormEstCommissionPercent(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      EXPECTED SETTLEMENT (₹)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formGrossSales > 0 ? formatINR(formExpectedSettlement) : "0"}
                      className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      ACTUAL RECEIVED (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formActualReceived}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setFormActualReceived(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 6. MARK AS RETURNED / RTO ORDER */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-800 space-y-3.5 shadow-2xs">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsReturned}
                    onChange={(e) => setFormIsReturned(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    MARK AS RETURNED / RTO ORDER
                  </span>
                </label>

                {formIsReturned && (
                  <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          RETURN TYPE
                        </label>
                        <select
                          value={formReturnType}
                          onChange={(e) => setFormReturnType(e.target.value as ReturnType)}
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer font-medium shadow-2xs"
                        >
                          <option value="CUSTOMER_RETURN">Customer Return (Delivered &amp; Returned)</option>
                          <option value="RTO">RTO (Undelivered / Doorstep Rejection)</option>
                          <option value="DAMAGED_RETURN">Damaged Return</option>
                          <option value="LOST_RETURN">Lost in Transit</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          RETURN FEE / LOGISTICS DEDUCTION (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formReturnFee}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setFormReturnFee(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        RETURN REASON / NOTES
                      </label>
                      <input
                        type="text"
                        value={formReturnReason}
                        onChange={(e) => setFormReturnReason(e.target.value)}
                        placeholder="e.g. wrong size, damaged packaging"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                      />
                    </div>

                    {/* Sub-card: Damaged / Defective Claim */}
                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3 shadow-2xs">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formIsDamagedClaim}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormIsDamagedClaim(checked);
                            if (checked && (!formClaimAmount || formClaimAmount === "0")) {
                              setFormClaimAmount(String(parsedUnitCost || parsedSellingPrice || 0));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 accent-amber-600 cursor-pointer"
                        />
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
                          RETURNED PRODUCT IS DAMAGED / DEFECTIVE (FILE CLAIM)
                        </span>
                      </label>

                      {formIsDamagedClaim && (
                        <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                              CLAIM AMOUNT FILED
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={formClaimAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setFormClaimAmount(e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-bold shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                              CLAIM STATUS
                            </label>
                            <select
                              value={formClaimStatus}
                              onChange={(e) =>
                                setFormClaimStatus(
                                  e.target.value as "Draft" | "Filed" | "Approved" | "Rejected"
                                )
                              }
                              className="w-full px-2.5 py-2 bg-white border border-purple-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-purple-500 font-semibold cursor-pointer shadow-2xs"
                            >
                              <option value="Draft">Draft</option>
                              <option value="Filed">Filed</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                              APPROVED REIMBURSEMENT
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={formApprovedReimbursement}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setFormApprovedReimbursement(e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-bold shadow-2xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. GENERAL ORDER NOTES */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  GENERAL ORDER NOTES
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Record packaging conditions, tracking numbers..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500"
                />
              </div>

              {/* Form Footer Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --------------------------------------------------------------------------------- */}
      {/* EDIT ORDER MODAL (Full Light Fintech, Zero Sticky Zeros, Complete Field Access) */}
      {/* --------------------------------------------------------------------------------- */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Edit Order: {editingOrder.id}
                  </h2>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Channel Ref: {editChannelOrderId || editingOrder.channelOrderId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* 1. SELECT MARKETPLACE PLATFORM */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  SELECT MARKETPLACE PLATFORM
                </label>
                <FormMarketplaceDropdown
                  selected={editMarketplace}
                  onChange={(mp, estComm) => {
                    setEditMarketplace(mp);
                    setEditCommissionPercent(String(estComm));
                  }}
                />
              </div>

              {/* 2. ORDER ID, DATE, SKU */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    CHANNEL REFERENCE #
                  </label>
                  <input
                    type="text"
                    value={editChannelOrderId}
                    onChange={(e) => setEditChannelOrderId(e.target.value)}
                    placeholder="e.g. REF-476140"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    TRANSACTION DATE
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    SKU / ITEM CODE
                  </label>
                  <input
                    type="text"
                    list="catalog-skus-edit"
                    value={editSku}
                    onChange={(e) => handleSelectEditSku(e.target.value)}
                    placeholder="e.g. SKU-COT-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                  <datalist id="catalog-skus-edit">
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 3. PRODUCT TITLE & QUANTITY */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PRODUCT TITLE / NAME
                  </label>
                  <input
                    type="text"
                    value={editProductName}
                    onChange={(e) => setEditProductName(e.target.value)}
                    placeholder="Product title"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    QUANTITY
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-bold"
                    required
                  />
                </div>
              </div>

              {/* 4. WHOLESALER / SUPPLIER PURCHASE COST (COGS) */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span className="uppercase tracking-wider">WHOLESALER / SUPPLIER PURCHASE COST (COGS)</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      WHOLESALER NAME
                    </label>
                    <select
                      value={editSupplierName}
                      onChange={(e) => setEditSupplierName(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                      <option value="Direct Supplier">Direct Supplier / Spot Purchase</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      UNIT WHOLESALER COST (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editUnitCost}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditUnitCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  Total Wholesale COGS: <strong className="text-slate-800 font-bold font-mono">{formatINR(editTotalWholesaleCost)}</strong>
                </div>
              </div>

              {/* 5. PLATFORM SETTLEMENT FIGURES */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-purple-700 font-bold text-xs uppercase tracking-wider">
                    PLATFORM SETTLEMENT FIGURES
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    EST. COMMISSION: <strong className="text-purple-700 font-mono">{parsedEditCommPercent}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      SELLING PRICE (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editSellingPrice}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditSellingPrice(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      EST. COMMISSION (%)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={editCommissionPercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditCommissionPercent(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      EXPECTED SETTLEMENT (₹)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={editGrossSales > 0 ? formatINR(editExpectedSettlement) : "0"}
                      className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 font-bold cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                      ACTUAL RECEIVED (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editActualReceived}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditActualReceived(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 6. ORDER STATUS */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  ORDER FULFILLMENT / RETURN STATUS
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="CONFIRMED">CONFIRMED (Order placed & confirmed)</option>
                  <option value="SHIPPED">SHIPPED (In transit)</option>
                  <option value="DELIVERED">DELIVERED (Successfully received by customer)</option>
                  <option value="RTO">RTO (Returned to origin by courier)</option>
                  <option value="RETURNED">RETURNED (Customer return)</option>
                  <option value="PARTIALLY_RETURNED">PARTIALLY RETURNED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* 7. GENERAL ORDER NOTES */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  GENERAL ORDER NOTES
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record packaging conditions, tracking numbers, reasons for edit..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500"
                />
              </div>

              {/* Form Footer Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Order Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {isCsvImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Channel CSV Ingestion</h2>
              <button
                onClick={() => setIsCsvImportOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <p className="text-slate-600 mb-2">
                Select a channel template to simulate automatic column normalization & ingestion:
              </p>
              {[
                { name: "Amazon India", label: "Amazon Order Report (.csv)", desc: "Normalizes ASINs and Easy Ship rates", color: "hover:border-amber-300 hover:bg-amber-50/50" },
                { name: "Flipkart", label: "Flipkart Sales Report (.xlsx)", desc: "Normalizes FSNs and Ekart logistics fees", color: "hover:border-blue-300 hover:bg-blue-50/50" },
                { name: "Meesho", label: "Meesho Orders Export (.csv)", desc: "Normalizes sub-orders & 0% fee promo", color: "hover:border-pink-300 hover:bg-pink-50/50" },
                { name: "Myntra", label: "Myntra Omni-channel Orders (.csv)", desc: "Normalizes brand share and logistics tiers", color: "hover:border-purple-300 hover:bg-purple-50/50" },
                { name: "WooCommerce", label: "WooCommerce / Shopify Store (.csv)", desc: "Direct format with Razorpay collection", color: "hover:border-indigo-300 hover:bg-indigo-50/50" },
              ].map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleSampleCsvImport(c.name as Marketplace)}
                  className={`w-full p-3.5 text-left rounded-2xl bg-slate-50/70 border border-slate-200 transition flex items-center justify-between group ${c.color}`}
                >
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{c.label}</span>
                    <span className="text-[11px] text-slate-500">{c.desc}</span>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 group-hover:translate-x-1 transition-transform">
                    Import →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
