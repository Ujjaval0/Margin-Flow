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
  Download,
  X,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Info,
  ExternalLink,
  Plus,
  Truck,
  Landmark,
  CheckCircle2,
  IndianRupee,
  Activity,
  Check,
  Building2,
  ShoppingBag,
  Store,
  Tag,
  Globe,
} from "lucide-react";
import { DateRangePreset } from "@/domain/profitability-engine";

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
    id: "B2B Wholesale",
    label: "B2B Wholesale",
    sublabel: "0% commission",
    estComm: 0,
    icon: Building2,
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
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
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
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

export interface CardLogicModalData {
  title: string;
  badge: string;
  category: string;
  meaning: string;
  formula: string;
  equationComponents: { label: string; value: string; color?: string }[];
  resultLabel: string;
  resultValue: string;
  impactNote: string;
}

interface DashboardViewProps {
  selectedMarketplace: Marketplace | "ALL";
  onSelectModule?: (module: NavModule) => void;
}

export function DashboardView({ selectedMarketplace, onSelectModule }: DashboardViewProps) {
  const {
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

  // Dual-Mode Financial View State: "OPERATOR" (Cash & Payouts) vs "CFO" (GAAP Hierarchy)
  const [viewMode, setViewMode] = useState<"OPERATOR" | "CFO">("OPERATOR");

  // Card Logic Inspection Modal State
  const [activeLogicModal, setActiveLogicModal] = useState<CardLogicModalData | null>(null);

  // Quick Action Dialog States
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isRecordReturnOpen, setIsRecordReturnOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

  // Quick Add Order Form State (Parity with Orders View)
  const [orderFormMarketplace, setOrderFormMarketplace] = useState<Marketplace>(
    selectedMarketplace !== "ALL" ? selectedMarketplace : "Amazon India"
  );
  const [orderFormId, setOrderFormId] = useState(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
  const [orderFormDate, setOrderFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderFormSku, setOrderFormSku] = useState(products[0]?.sku || "");
  const [orderFormProductName, setOrderFormProductName] = useState(products[0]?.name || "");
  const [orderFormQuantity, setOrderFormQuantity] = useState("1");
  const [orderFormSupplierName, setOrderFormSupplierName] = useState("");
  const [orderFormUnitCost, setOrderFormUnitCost] = useState(String(products[0]?.currentCostPrice || 350));
  const [orderFormSellingPrice, setOrderFormSellingPrice] = useState(
    String(products[0] ? Math.round(products[0].currentCostPrice * 2.5) : 999)
  );
  const [orderFormEstCommissionPercent, setOrderFormEstCommissionPercent] = useState("15");
  const [orderFormActualReceived, setOrderFormActualReceived] = useState("");

  // Return / RTO Flag & Detailed Fields
  const [orderFormIsReturned, setOrderFormIsReturned] = useState(false);
  const [orderFormReturnType, setOrderFormReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [orderFormReturnFee, setOrderFormReturnFee] = useState("0");
  const [orderFormReturnReason, setOrderFormReturnReason] = useState("");
  const [orderFormIsDamagedClaim, setOrderFormIsDamagedClaim] = useState(false);
  const [orderFormClaimAmount, setOrderFormClaimAmount] = useState("0");
  const [orderFormClaimStatus, setOrderFormClaimStatus] = useState<"Draft" | "Filed" | "Approved" | "Rejected">("Draft");
  const [orderFormApprovedReimbursement, setOrderFormApprovedReimbursement] = useState("0");
  const [orderFormNotes, setOrderFormNotes] = useState("");

  // Quick Record Return Form State
  const [returnOrderId, setReturnOrderId] = useState(orders[0]?.id || "");
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [returnCondition, setReturnCondition] = useState<ProductCondition>("SELLABLE");
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState("Defective item received by customer");
  const [returnShipping, setReturnShipping] = useState(70);
  const [returnRecovery, setReturnRecovery] = useState(0);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Quick Add Supplier Payment / Purchase Form State
  const [purchaseSupplierId, setPurchaseSupplierId] = useState(suppliers[0]?.id || "");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("INV-2026-901");
  const [purchaseSku, setPurchaseSku] = useState(products[0]?.sku || "");
  const [purchaseQty, setPurchaseQty] = useState(100);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(products[0]?.currentCostPrice || 350);
  const [purchaseTaxRate, setPurchaseTaxRate] = useState(18);

  // Helper when user selects a platform
  const handleSelectOrderMarketplace = (mp: Marketplace, defaultCommission: number) => {
    setOrderFormMarketplace(mp);
    setOrderFormEstCommissionPercent(String(defaultCommission));
  };

  // Helper when user selects a catalog SKU
  const handleSelectOrderSku = (skuValue: string) => {
    setOrderFormSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setOrderFormProductName(prod.name);
      setOrderFormUnitCost(String(prod.currentCostPrice));
      setOrderFormSellingPrice(String(Math.round(prod.currentCostPrice * 2.5)));
    }
  };

  // Live Calculations (frictionless & safe against empty strings)
  const parsedOrderQty = parseFloat(orderFormQuantity) || 0;
  const parsedOrderUnitCost = parseFloat(orderFormUnitCost) || 0;
  const parsedOrderSellingPrice = parseFloat(orderFormSellingPrice) || 0;
  const parsedOrderCommPercent = parseFloat(orderFormEstCommissionPercent) || 0;
  const parsedOrderActualReceived = parseFloat(orderFormActualReceived) || 0;

  const orderFormTotalCost = parsedOrderQty * parsedOrderUnitCost;
  const orderFormGrossSales = parsedOrderQty * parsedOrderSellingPrice;
  const orderFormCommissionDeduction = Math.round(orderFormGrossSales * (parsedOrderCommPercent / 100));
  const orderFormExpectedSettlement = Math.max(0, orderFormGrossSales - orderFormCommissionDeduction);

  // Quick Action Submissions
  const handleQuickAddOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const orderId = orderFormId.trim() || `ORD-${Date.now().toString().slice(-6)}`;
    const snapshotCost = parsedOrderUnitCost;
    const unitPrice = parsedOrderSellingPrice;
    const qty = parsedOrderQty || 1;

    // 1. Create the Order
    const createdOrder: Order = {
      id: orderId,
      channelOrderId: `REF-${orderId.replace("ORD-", "")}`,
      marketplace: orderFormMarketplace,
      orderDate: orderFormDate,
      status: orderFormIsReturned ? (orderFormReturnType === "RTO" ? "RTO" : "RETURNED") : "CONFIRMED",
      customerName: "Direct Buyer",
      customerCity: "Mumbai",
      customerState: "Maharashtra",
      shippingFeeCharged: 0,
      marketplaceChargesEstimate: orderFormCommissionDeduction,
      notes: orderFormNotes,
      items: [
        {
          id: `ITEM-${Date.now().toString().slice(-4)}`,
          sku: orderFormSku || "CUSTOM-SKU",
          productName: orderFormProductName || "Custom Order Item",
          quantity: qty,
          sellingPrice: unitPrice,
          discount: 0,
          taxAmount: Math.round(unitPrice * qty * 0.18 * 100) / 100,
          snapshotUnitCost: snapshotCost,
          returnedQuantity: orderFormIsReturned ? qty : 0,
        },
      ],
    };

    addOrder(createdOrder);

    // 2. If Actual Received is populated, create a reconciled Settlement record
    if (parsedOrderActualReceived > 0) {
      const createdSettlement: Settlement = {
        id: `SETTLE-${Date.now().toString().slice(-4)}`,
        settlementBatchId: `BATCH-${Date.now().toString().slice(-4)}`,
        marketplace: orderFormMarketplace,
        settlementDate: orderFormDate,
        orderId: createdOrder.id,
        grossAmount: orderFormGrossSales,
        deductions: [
          { category: "COMMISSION", name: "Marketplace Commission", amount: orderFormCommissionDeduction },
          {
            category: "LOGISTICS",
            name: "Logistics & Forwarding",
            amount: Math.max(0, orderFormGrossSales - parsedOrderActualReceived - orderFormCommissionDeduction),
          },
        ],
        tcsTdsTax: Math.round(orderFormGrossSales * 0.01),
        netSettlement: parsedOrderActualReceived,
        reconciliationStatus: "RECONCILED",
        bankTxRef: `BANK-DEP-${orderId.slice(-4)}`,
      };
      addSettlement(createdSettlement);
    }

    // 3. If marked as Returned / RTO, create linked return record and claim
    if (orderFormIsReturned) {
      const retId = `RET-${Date.now().toString().slice(-4)}`;
      const parsedFee = parseFloat(orderFormReturnFee) || 0;
      const parsedClaim = parseFloat(orderFormClaimAmount) || 0;
      const parsedReimbursement = parseFloat(orderFormApprovedReimbursement) || 0;

      let claimIdToLink: string | undefined = undefined;

      if (orderFormIsDamagedClaim) {
        claimIdToLink = `CLM-${Date.now().toString().slice(-4)}`;
        let mappedClaimStatus: Claim["status"] = "FILED";
        if (orderFormClaimStatus === "Draft") mappedClaimStatus = "NOT_FILED";
        else if (orderFormClaimStatus === "Approved") mappedClaimStatus = "APPROVED";
        else if (orderFormClaimStatus === "Rejected") mappedClaimStatus = "REJECTED";

        const newClaim: Claim = {
          id: claimIdToLink,
          orderId: createdOrder.id,
          returnId: retId,
          marketplace: orderFormMarketplace,
          claimType: orderFormReturnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
          claimDate: orderFormDate,
          amountClaimed: parsedClaim > 0 ? parsedClaim : snapshotCost * qty,
          amountRecovered: parsedReimbursement,
          status: mappedClaimStatus,
          recoveryDate: orderFormClaimStatus === "Approved" ? orderFormDate : undefined,
          notes: orderFormReturnReason || "Damaged/Defective claim logged at order creation",
        };
        addClaim(newClaim);
        createdOrder.claimIds = [claimIdToLink];
      }

      const isDamaged = orderFormIsDamagedClaim || orderFormReturnType === "DAMAGED_RETURN";
      const calculatedLoss = parsedFee + (isDamaged ? Math.max(0, snapshotCost * qty - parsedReimbursement) : 0);

      const createdReturn: ReturnRecord = {
        id: retId,
        orderId: createdOrder.id,
        channelOrderId: createdOrder.channelOrderId,
        marketplace: orderFormMarketplace,
        returnDate: orderFormDate,
        receivedDate: orderFormDate,
        returnType: orderFormReturnType,
        returnReason: orderFormReturnReason || (orderFormReturnType === "RTO" ? "RTO Undelivered" : "Customer Return"),
        sku: orderFormSku || "CUSTOM-SKU",
        productName: orderFormProductName,
        quantity: qty,
        condition: isDamaged ? "DAMAGED" : "SELLABLE",
        restockStatus: isDamaged ? "WRITTEN_OFF" : "PENDING_RESTOCK",
        returnShippingCost: parsedFee,
        otherReturnCosts: 0,
        inventoryRecoveryValue: isDamaged ? parsedReimbursement : snapshotCost * qty,
        lossAmount: calculatedLoss,
        claimId: claimIdToLink,
        notes: orderFormReturnReason || orderFormNotes || "Marked as Returned/RTO order",
      };
      addReturn(createdReturn);
      createdOrder.returnIds = [retId];
    }

    // Reset and close
    setIsAddOrderOpen(false);
    setOrderFormId(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
    setOrderFormSku(products[0]?.sku || "");
    setOrderFormProductName(products[0]?.name || "");
    setOrderFormQuantity("1");
    setOrderFormUnitCost(String(products[0]?.currentCostPrice || 350));
    setOrderFormSellingPrice(String(products[0] ? Math.round(products[0].currentCostPrice * 2.5) : 999));
    setOrderFormActualReceived("");
    setOrderFormIsReturned(false);
    setOrderFormReturnType("CUSTOMER_RETURN");
    setOrderFormReturnFee("0");
    setOrderFormReturnReason("");
    setOrderFormIsDamagedClaim(false);
    setOrderFormClaimAmount("0");
    setOrderFormClaimStatus("Draft");
    setOrderFormApprovedReimbursement("0");
    setOrderFormNotes("");
  };

  const handleQuickRecordReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError(null);

    const order = orders.find((o) => o.id === returnOrderId);
    if (!order) return;
    const item = order.items[0];
    if (!item) return;

    if (returnQty > item.quantity) {
      setReturnError(`Quantity (${returnQty}) exceeds ordered count (${item.quantity}).`);
      return;
    }

    const retId = `RET-${Date.now().toString().slice(-5)}`;
    const cost = item.snapshotUnitCost * returnQty;
    let calculatedLoss = returnShipping;
    if (returnCondition === "DAMAGED" || returnCondition === "UNUSABLE") {
      calculatedLoss += cost - returnRecovery;
    }

    const newRet: ReturnRecord = {
      id: retId,
      orderId: order.id,
      channelOrderId: order.channelOrderId,
      marketplace: order.marketplace,
      returnDate: new Date().toISOString().split("T")[0],
      returnType,
      returnReason,
      sku: item.sku,
      quantity: Number(returnQty),
      condition: returnCondition,
      returnShippingCost: Number(returnShipping),
      otherReturnCosts: 0,
      inventoryRecoveryValue: Number(returnRecovery),
      lossAmount: calculatedLoss,
    };

    addReturn(newRet);

    if (returnCondition === "DAMAGED" || returnType === "LOST_RETURN") {
      const claimId = `CLM-${Date.now().toString().slice(-5)}`;
      const newClaim: Claim = {
        id: claimId,
        orderId: order.id,
        returnId: retId,
        marketplace: order.marketplace,
        claimType: returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
        claimDate: new Date().toISOString().split("T")[0],
        amountClaimed: calculatedLoss,
        amountRecovered: 0,
        status: "FILED",
        notes: `Auto-generated dispute claim from Quick Return (${returnCondition}).`,
      };
      addClaim(newClaim);
    }

    setIsRecordReturnOpen(false);
  };

  const handleQuickAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === purchaseSupplierId);
    const subtotal = purchaseQty * purchaseUnitCost;
    const taxes = Math.round(subtotal * (purchaseTaxRate / 100));
    const totalAmount = subtotal + taxes;

    const newBill: PurchaseBill = {
      id: `PUR-${Date.now().toString().slice(-5)}`,
      supplierId: purchaseSupplierId,
      supplierName: sup?.name || "Wholesale Supplier",
      invoiceNumber: purchaseInvoiceNo || `INV-${Date.now().toString().slice(-4)}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      sku: purchaseSku,
      quantity: Number(purchaseQty),
      unitCost: Number(purchaseUnitCost),
      taxes,
      totalAmount,
      paymentStatus: "PAID",
    };

    addPurchase(newBill);
    setIsAddPurchaseOpen(false);
  };

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

  const channelChartData = marketplaceBreakdown.map((m) => ({
    name: m.marketplace.replace(" India", "").replace("Personal ", ""),
    Revenue: m.revenue,
    COGS: m.cogs,
    Fees: m.fees + m.logistics,
    Profit: m.contributionProfit,
  }));

  const lossMakingSkus = skuBreakdown.filter((s) => s.profit < 0);

  // Filtered & Sorted SKUs
  const processedSkus = skuBreakdown
    .filter((s) => {
      const matchesSearch =
        s.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
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

  const previewOrdersCount = useMemo(() => {
    if (!customStartDate || !customEndDate) return 0;
    return orders.filter((o) => o.orderDate >= customStartDate && o.orderDate <= customEndDate).length;
  }, [orders, customStartDate, customEndDate]);

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: "ALL", label: "All Time" },
    { id: "TODAY", label: "Today" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "LAST_30_DAYS", label: "Last 30 Days" },
    { id: "THIS_MONTH", label: "This Month" },
    { id: "PREVIOUS_MONTH", label: "Last Month" },
  ];

  // Logic definitions for each card
  const grossSalesLogic: CardLogicModalData = {
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
        value: formatINR(profitability.totalOrders > 0 ? Math.round(profitability.grossSales / profitability.totalOrders) : 0),
      },
    ],
    resultLabel: "Total Gross Catalog Sales",
    resultValue: formatINR(profitability.grossSales),
    impactNote: "Gross sales indicates total catalog demand before fee or return deductions.",
  };

  const trueProfitLogic: CardLogicModalData = {
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
  };

  const netProfitLogic: CardLogicModalData = {
    title: "Net Profit (Platform Payout)",
    badge: "Disbursable Payout",
    category: "Marketplace Cash Remittance",
    meaning: "Net cash payout remitted by channels before paying supplier bills.",
    formula: "Net Profit = Net Sales − Marketplace Deductions − Return Losses + Dispute Recoveries",
    equationComponents: [
      { label: "Net Sales (Gross − Discounts)", value: formatINR(profitability.netSales), color: "text-slate-800" },
      { label: "− Marketplace Fees & Commissions", value: `−${formatINR(profitability.marketplaceCharges)}`, color: "text-rose-600" },
      { label: "− Reverse Freight & Return Deductions", value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`, color: "text-amber-600" },
      { label: "+ Recovered Dispute Reimbursements", value: `+${formatINR(profitability.claimRecoveries)}`, color: "text-emerald-600" },
    ],
    resultLabel: "Net Platform Payout",
    resultValue: formatINR(profitability.netPlatformPayout),
    impactNote: "Directly matches platform remittance payouts deposited into your bank.",
  };

  const returnsRtoLogic: CardLogicModalData = {
    title: "Returns & RTO Analysis",
    badge: "Reverse Logistics Friction",
    category: "Fulfillment & Return Losses",
    meaning: "Combined units and logistics losses from undelivered RTO and customer returns.",
    formula: "Total Loss = Forward/Reverse Shipping Fees + Damaged Scrap Value",
    equationComponents: [
      { label: "RTO (Courier Return-to-Origin)", value: `${profitability.rtoCount} items`, color: "text-amber-600" },
      { label: "Customer Returns (Delivered & Returned)", value: `${profitability.customerReturnCount} items`, color: "text-rose-600" },
      { label: "Overall Return Rate %", value: formatPercent(profitability.returnRate) },
      { label: "Total Financial Loss Deducted", value: formatINR(profitability.returnLosses + profitability.rtoLosses), color: "text-rose-700" },
    ],
    resultLabel: "Total Return Units (Return Rate %)",
    resultValue: `${profitability.rtoCount + profitability.customerReturnCount} (${formatPercent(profitability.returnRate)})`,
    impactNote: "Tracks undelivered courier rejections versus delivered customer returns.",
  };

  const wholesalerCogsLogic: CardLogicModalData = {
    title: "Wholesaler Cost (COGS)",
    badge: "Supplier Liability",
    category: "Product Procurement",
    meaning: "Total wholesale purchase cost payable to suppliers for sold units.",
    formula: "COGS = Σ (Sold Quantity × Historical Unit Purchase Cost Snapshot)",
    equationComponents: [
      { label: "Total Units Sold", value: `${profitability.totalUnitsSold} units` },
      {
        label: "Average Unit Snapshot Cost",
        value: formatINR(profitability.totalUnitsSold > 0 ? Math.round(profitability.cogs / profitability.totalUnitsSold) : 0),
      },
    ],
    resultLabel: "Total Wholesaler COGS Payable",
    resultValue: formatINR(profitability.cogs),
    impactNote: "Locked-in snapshot purchase costs payable to wholesale inventory vendors.",
  };

  const damagedClaimsLogic: CardLogicModalData = {
    title: "Damaged Claims Recovery",
    badge: "Dispute Reimbursements",
    category: "Loss Recovery Pipeline",
    meaning: "Dispute reimbursements credited by platforms for transit or damage cases.",
    formula: "Recovered = Σ (Approved Claims); Pending = Σ (Open Claims)",
    equationComponents: [
      { label: "Dispute Reimbursements Credited", value: formatINR(profitability.claimRecoveries), color: "text-emerald-600" },
      { label: "Pending Claims Under Review", value: formatINR(profitability.pendingClaimsAmount), color: "text-amber-600" },
      { label: "Pending Claims Count", value: `${profitability.pendingClaimsCount} open tickets` },
      { label: "Physical Damaged Inventory Units", value: `${profitability.damagedUnitsCount} damaged units` },
    ],
    resultLabel: "Total Reimbursements Credited",
    resultValue: formatINR(profitability.claimRecoveries),
    impactNote: "Recovers lost cash from platform SAFE-T and courier dispute claims.",
  };

  // CFO GAAP Logic
  const netRevenueLogic: CardLogicModalData = {
    title: "Net Revenue",
    badge: "Realized Sales",
    category: "GAAP Accounting",
    meaning: "Customer catalog sales after deducting seller promotional discounts.",
    formula: "Net Revenue = Gross Sales − Promotional Discounts",
    equationComponents: [
      { label: "Gross Catalog Sales", value: formatINR(profitability.grossSales) },
      { label: "− Direct Discounts", value: `−${formatINR(profitability.discounts)}`, color: "text-amber-600" },
    ],
    resultLabel: "Net Realized Sales",
    resultValue: formatINR(profitability.netSales),
    impactNote: "Operating sales volume before deducting platform fees and COGS.",
  };

  const grossProfitLogic: CardLogicModalData = {
    title: "Gross Profit",
    badge: "Manufacturing Margin",
    category: "GAAP Accounting",
    meaning: "Net revenue minus wholesale inventory purchase cost (COGS).",
    formula: "Gross Profit = Net Revenue − Snapshot COGS",
    equationComponents: [
      { label: "Net Revenue", value: formatINR(profitability.netSales) },
      { label: "− Snapshot COGS", value: `−${formatINR(profitability.cogs)}`, color: "text-rose-600" },
      { label: "Gross Margin %", value: formatPercent(profitability.grossMargin) },
    ],
    resultLabel: "Gross Profit",
    resultValue: formatINR(profitability.grossProfit),
    impactNote: "Core product markup profit before platform logistics and commission fees.",
  };

  const contributionProfitLogic: CardLogicModalData = {
    title: "Contribution Profit",
    badge: "Channel Profitability",
    category: "Unit Economics",
    meaning: "Margin after platform commissions, logistics fees, and return losses.",
    formula: "Contribution Profit = Gross Profit − Marketplace Charges − Logistics − Return Losses + Claims",
    equationComponents: [
      { label: "Gross Profit", value: formatINR(profitability.grossProfit) },
      { label: "− Marketplace Commissions & Fees", value: `−${formatINR(profitability.marketplaceCharges)}`, color: "text-rose-600" },
      { label: "− Return & RTO Losses", value: `−${formatINR(profitability.returnLosses + profitability.rtoLosses)}`, color: "text-amber-600" },
      { label: "+ Recovered Claims", value: `+${formatINR(profitability.claimRecoveries)}`, color: "text-emerald-600" },
    ],
    resultLabel: "Contribution Profit",
    resultValue: formatINR(profitability.contributionProfit),
    impactNote: "Essential unit-economics test of channel sustainability.",
  };

  const netOperatingProfitLogic: CardLogicModalData = {
    title: "Net Operating Profit",
    badge: "Business Net Earnings",
    category: "GAAP Accounting",
    meaning: "Final net earnings after deducting business operating expenses (OPEX).",
    formula: "Net Operating Profit = Contribution Profit − Operating Expenses (OPEX)",
    equationComponents: [
      { label: "Contribution Profit", value: formatINR(profitability.contributionProfit) },
      { label: "− Total Operating Expenses (OPEX)", value: `−${formatINR(profitability.operatingExpenses)}`, color: "text-rose-600" },
      { label: "Net Operating Margin %", value: formatPercent(profitability.netOperatingMargin) },
    ],
    resultLabel: "Net Operating Profit",
    resultValue: formatINR(profitability.netOperatingProfit),
    impactNote: "True commercial bottom line after financing business overheads.",
  };

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
                  <span className="font-mono">{customDateRange.startDate} → {customDateRange.endDate}</span>
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
              <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[410px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Custom Date Range</h4>
                      <p className="text-[10px] text-slate-500">Filter all financial metrics by custom dates</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Presets Shortcuts */}
                <div className="mb-3.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Quick Shortcuts
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {quickShortcuts.map((sc) => (
                      <button
                        key={sc.label}
                        type="button"
                        onClick={() => {
                          setCustomStartDate(sc.start);
                          setCustomEndDate(sc.end);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                          customStartDate === sc.start && customEndDate === sc.end
                            ? "bg-purple-100 text-purple-800 font-bold border border-purple-200"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Inputs Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
                    />
                  </div>
                </div>

                {/* Live Match Preview */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs mb-3.5">
                  <span className="text-slate-500 font-medium text-[11px]">Orders in selected range:</span>
                  <span className="font-bold text-purple-700 font-mono text-xs">
                    {previewOrdersCount} order{previewOrdersCount === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("ALL");
                      setCustomDateRange(null);
                      setIsCalendarOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Reset (All Time)
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          const s = customStartDate <= customEndDate ? customStartDate : customEndDate;
                          const e = customEndDate >= customStartDate ? customEndDate : customStartDate;
                          setCustomDateRange({ startDate: s, endDate: e });
                          setDatePreset("CUSTOM");
                          setIsCalendarOpen(false);
                        }
                      }}
                      disabled={!customStartDate || !customEndDate}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-sm transition-all flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply Filter
                    </button>
                  </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                GROSS SALES
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(grossSalesLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                  title="Click to view Gross Sales calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("orders")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Orders Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                TRUE PROFIT
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(trueProfitLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                  title="Click to view True Profit calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("settlements")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Settlements Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                NET PROFIT
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(netProfitLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-400 hover:text-purple-600 flex items-center justify-center transition-colors"
                  title="Click to view Net Profit calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("settlements")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Settlements Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                RETURNS &amp; RTO
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(returnsRtoLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                  title="Click to view Returns & RTO calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("returns")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Returns Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                WHOLESALER COST (COGS)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(wholesalerCogsLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                  title="Click to view Wholesaler COGS calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("suppliers")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Suppliers Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Landmark className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative hover:border-slate-300 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                DAMAGED CLAIMS RECOVERY
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveLogicModal(damagedClaimsLogic)}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors"
                  title="Click to view Damaged Claims calculation logic & formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectModule?.("claims")}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-colors"
                  title="Open Claims Ledger"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" strokeWidth={2.2} />
                </div>
              </div>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveLogicModal(netRevenueLogic)}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="Inspect Net Revenue Formula"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectModule?.("orders")}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="View Orders"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center ml-1">
                    <DollarSign className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                </div>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveLogicModal(grossProfitLogic)}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="Inspect Gross Profit Formula"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectModule?.("reports")}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="View P&L Report"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center ml-1">
                    <TrendingUp className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                </div>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveLogicModal(contributionProfitLogic)}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="Inspect Contribution Profit Formula"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectModule?.("settlements")}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="View Settlements"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center ml-1">
                    <Layers className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                </div>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveLogicModal(netOperatingProfitLogic)}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="Inspect Net Operating Profit Formula"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectModule?.("expenses")}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    title="View OPEX"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ml-1 ${
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
            <div
              onClick={() => {
                handleSort("unitsSold");
                scrollToSkuTable();
              }}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
              title="Click to view & sort SKUs by volume"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Volume</span>
                <ShoppingCart className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" strokeWidth={2} />
              </div>
              <div><span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{profitability.totalOrders}</span><span className="text-xs text-slate-400 ml-1">orders</span></div>
              <div className="text-[11px] text-slate-500 tabular-nums">{profitability.totalUnitsSold} <span className="text-slate-400">units sold</span></div>
              <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-[10px] font-semibold text-blue-600 group-hover:underline">Sort by Volume ➔</span></div>
            </div>

            {/* POAS & Ad Spend */}
            <div
              onClick={() => scrollToSkuTable()}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
              title="Click to inspect SKU POAS breakdown"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">POAS / Ads</span>
                <Target className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors" strokeWidth={2} />
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
                <span className={`text-[10px] font-semibold group-hover:underline ${profitability.poas >= 1.0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {profitability.poas >= 1.0 ? "Profitable Scale ➔" : "High Ad Drag ➔"}
                </span>
              </div>
            </div>

            {/* Settlement Received */}
            <div
              onClick={() => onSelectModule?.("settlements")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-emerald-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Settlement</span>
                <Banknote className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
              </div>
              <div className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums">{formatINR(profitability.actualSettlementsReceived)}</div>
              <div className="text-[11px] text-slate-500">Inflow received</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-emerald-600">Deposited in bank</span></div>
            </div>

            {/* Marketplace Fees */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mkt. Fees</span>
                <BadgePercent className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
              </div>
              <div className="text-xl font-semibold text-[#D70015] tracking-tight tabular-nums">{formatINR(profitability.marketplaceCharges)}</div>
              <div className="text-[11px] text-slate-500">Total deducted</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-rose-600">Commissions &amp; fixed</span></div>
            </div>

            {/* Returns & RTO */}
            <div
              onClick={() => {
                handleSort("returnRate");
                scrollToSkuTable();
              }}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
              title="Click to sort SKUs by return rate"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Returns</span>
                <RotateCcw className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 transition-colors" strokeWidth={2} />
              </div>
              <div className="text-xl font-semibold text-amber-600 tracking-tight tabular-nums">{formatINR(profitability.returnLosses + profitability.rtoLosses)}</div>
              <div className="text-[11px] text-slate-500">Return + RTO loss</div>
              <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-[10px] font-semibold text-amber-600 group-hover:underline">Rate: {formatPercent(profitability.returnRate)} ➔</span></div>
            </div>

            {/* Dispute Recoveries */}
            <div
              onClick={() => onSelectModule?.("claims")}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Disputes</span>
                <ShieldCheck className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
              </div>
              <div className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(profitability.claimRecoveries)}</div>
              <div className="text-[11px] text-slate-500">Recovered so far</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-indigo-600">SAFE-T Credits</span></div>
            </div>

            {/* Damaged Write-offs */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Write-offs</span>
                <Package className="w-3.5 h-3.5 text-slate-300" strokeWidth={2} />
              </div>
              <div className="text-xl font-semibold text-slate-700 tracking-tight tabular-nums">{formatINR(profitability.damageLosses)}</div>
              <div className="text-[11px] text-slate-500">Damaged inventory</div>
              <div className="mt-auto pt-2 border-t border-slate-100"><span className="text-[10px] font-semibold text-slate-500">Physical scrap</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── OPTION A: QUICK RECORD ACTIONS DOCKED TOOLBAR ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs" />
          <div>
            <span className="text-xs font-bold text-slate-900 tracking-tight">Quick Record Actions:</span>
            <span className="text-[11px] text-slate-400 ml-2 hidden md:inline">Instant direct entries to platform ledgers</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Order</span>
          </button>
          <button
            onClick={() => setIsRecordReturnOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Record Return</span>
          </button>
          <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
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

      {/* ─── STEP 3: SKU Economics Slide-Over Drawer Modal ─── */}
      {selectedSkuForDrawer && (
        <div
          className="fixed inset-0 z-50 drawer-backdrop flex justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedSkuForDrawer(null)}
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
                      selectedSkuForDrawer.profit >= 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {selectedSkuForDrawer.profit >= 0 ? "Profitable" : "Loss-Making"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1 font-mono">
                  {selectedSkuForDrawer.sku}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedSkuForDrawer.productName}
                </p>
              </div>
              <button
                onClick={() => setSelectedSkuForDrawer(null)}
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
                  {formatINR(selectedSkuForDrawer.revenue)}
                </div>
                <span className="text-[10px] text-slate-500">{selectedSkuForDrawer.unitsSold} units sold</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-[11px] text-slate-400 font-medium">Contribution Margin</span>
                <div
                  className={`text-base font-semibold mt-0.5 tracking-tight tabular-nums ${
                    selectedSkuForDrawer.profit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                  }`}
                >
                  {formatPercent(selectedSkuForDrawer.margin)}
                </div>
                <span className="text-[10px] text-slate-500">
                  {formatINR(selectedSkuForDrawer.profit)} net
                </span>
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
                    {formatINR(Math.round(selectedSkuForDrawer.revenue / (selectedSkuForDrawer.unitsSold || 1)))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>− Unit Product Cost (COGS)</span>
                  <span className="font-mono text-slate-800">
                    -{formatINR(Math.round(selectedSkuForDrawer.cogs / (selectedSkuForDrawer.unitsSold || 1)))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>− Marketplace Fees &amp; Logistics</span>
                  <span className="font-mono text-rose-600">
                    -{formatINR(Math.round(selectedSkuForDrawer.marketplaceCharges / (selectedSkuForDrawer.unitsSold || 1)))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>− Reverse Logistics &amp; Return Drag</span>
                  <span className="font-mono text-amber-600">
                    {selectedSkuForDrawer.returnLosses > 0
                      ? `-${formatINR(Math.round(selectedSkuForDrawer.returnLosses / (selectedSkuForDrawer.unitsSold || 1)))}`
                      : "₹0"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-bold">
                  <span className="text-slate-900">Net Unit Contribution Profit</span>
                  <span
                    className={`font-mono ${
                      selectedSkuForDrawer.profit >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {formatINR(Math.round(selectedSkuForDrawer.profit / (selectedSkuForDrawer.unitsSold || 1)))}
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
                    Ad Spend: {selectedSkuForDrawer.adSpend ? formatINR(selectedSkuForDrawer.adSpend) : "₹0"}
                  </div>
                </div>
                <div>
                  {selectedSkuForDrawer.poas !== undefined ? (
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        selectedSkuForDrawer.poas >= 1.0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedSkuForDrawer.poas}x POAS
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
                    Total Return Losses: {formatINR(selectedSkuForDrawer.returnLosses)}
                  </div>
                </div>
                <div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedSkuForDrawer.returnRate > 0.2
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {formatPercent(selectedSkuForDrawer.returnRate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `SKU: ${selectedSkuForDrawer.sku}\nRevenue: ${formatINR(selectedSkuForDrawer.revenue)}\nProfit: ${formatINR(selectedSkuForDrawer.profit)}\nMargin: ${formatPercent(selectedSkuForDrawer.margin)}`
                  );
                }}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                Copy SKU Summary
              </button>
              <button
                onClick={() => setSelectedSkuForDrawer(null)}
                className="py-2 px-5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CARD LOGIC INSPECTION MODAL ─── */}
      {activeLogicModal && (
        <div
          className="fixed inset-0 z-50 bg-black/25 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveLogicModal(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-5 flex flex-col gap-3.5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                    {activeLogicModal.category}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {activeLogicModal.badge}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  {activeLogicModal.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                  {activeLogicModal.meaning}
                </p>
              </div>
              <button
                onClick={() => setActiveLogicModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Formula Strip */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Formula &amp; Logic
              </span>
              <div className="text-xs font-semibold text-purple-700">
                {activeLogicModal.formula}
              </div>
            </div>

            {/* Live Data Breakdown Components */}
            <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Live Calculation Breakdown
              </span>
              <div className="space-y-1.5 text-xs">
                {activeLogicModal.equationComponents.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-0.5 border-b border-slate-200/40 last:border-0">
                    <span className="text-slate-600">{item.label}</span>
                    <span className={`font-semibold tracking-tight ${item.color || "text-[#1D1D1F]"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 font-semibold">
                  <span className="text-slate-900">{activeLogicModal.resultLabel}</span>
                  <span className="text-sm font-semibold tracking-tight text-[#288548]">
                    {activeLogicModal.resultValue}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setActiveLogicModal(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK ACTION: ADD ORDER MODAL (Full Light Fintech, Return & Claim Parity) ─── */}
      {isAddOrderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsAddOrderOpen(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Add Order
                  </h2>
                  <p className="text-xs text-slate-500">
                    Direct entry to platform ledgers with real-time gross margin &amp; reverse logistics tracking.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOrderOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleQuickAddOrder} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* 1. SELECT MARKETPLACE PLATFORM */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  SELECT MARKETPLACE PLATFORM
                </label>
                <FormMarketplaceDropdown
                  selected={orderFormMarketplace}
                  onChange={(mp, estComm) => handleSelectOrderMarketplace(mp, estComm)}
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
                    value={orderFormId}
                    onChange={(e) => setOrderFormId(e.target.value)}
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
                    value={orderFormDate}
                    onChange={(e) => setOrderFormDate(e.target.value)}
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
                    list="dashboard-catalog-skus"
                    value={orderFormSku}
                    onChange={(e) => handleSelectOrderSku(e.target.value)}
                    placeholder="e.g. SKU-COT-01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                  <datalist id="dashboard-catalog-skus">
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
                    value={orderFormProductName}
                    onChange={(e) => setOrderFormProductName(e.target.value)}
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
                    value={orderFormQuantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setOrderFormQuantity(e.target.value)}
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
                      value={orderFormSupplierName}
                      onChange={(e) => setOrderFormSupplierName(e.target.value)}
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
                      value={orderFormUnitCost}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setOrderFormUnitCost(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  Total Wholesale COGS: <strong className="text-slate-800 font-bold font-mono">{formatINR(orderFormTotalCost)}</strong>
                </div>
              </div>

              {/* 5. PLATFORM SETTLEMENT FIGURES */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-purple-700 font-bold text-xs uppercase tracking-wider">
                    PLATFORM SETTLEMENT FIGURES
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    EST. COMMISSION: <strong className="text-purple-700 font-mono">{parsedOrderCommPercent}%</strong>
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
                      value={orderFormSellingPrice}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setOrderFormSellingPrice(e.target.value)}
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
                      value={orderFormEstCommissionPercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setOrderFormEstCommissionPercent(e.target.value)}
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
                      value={orderFormGrossSales > 0 ? formatINR(orderFormExpectedSettlement) : "0"}
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
                      value={orderFormActualReceived}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setOrderFormActualReceived(e.target.value)}
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
                    checked={orderFormIsReturned}
                    onChange={(e) => setOrderFormIsReturned(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    MARK AS RETURNED / RTO ORDER
                  </span>
                </label>

                {orderFormIsReturned && (
                  <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          RETURN TYPE
                        </label>
                        <select
                          value={orderFormReturnType}
                          onChange={(e) => setOrderFormReturnType(e.target.value as ReturnType)}
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
                          value={orderFormReturnFee}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setOrderFormReturnFee(e.target.value)}
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
                        value={orderFormReturnReason}
                        onChange={(e) => setOrderFormReturnReason(e.target.value)}
                        placeholder="e.g. wrong size, damaged packaging"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                      />
                    </div>

                    {/* Sub-card: Damaged / Defective Claim */}
                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3 shadow-2xs">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={orderFormIsDamagedClaim}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setOrderFormIsDamagedClaim(checked);
                            if (checked && (!orderFormClaimAmount || orderFormClaimAmount === "0")) {
                              setOrderFormClaimAmount(String(parsedOrderUnitCost || parsedOrderSellingPrice || 0));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 accent-amber-600 cursor-pointer"
                        />
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
                          RETURNED PRODUCT IS DAMAGED / DEFECTIVE (FILE CLAIM)
                        </span>
                      </label>

                      {orderFormIsDamagedClaim && (
                        <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                              CLAIM AMOUNT FILED
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={orderFormClaimAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setOrderFormClaimAmount(e.target.value)}
                              placeholder="0"
                              className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-bold shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                              CLAIM STATUS
                            </label>
                            <select
                              value={orderFormClaimStatus}
                              onChange={(e) =>
                                setOrderFormClaimStatus(
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
                              value={orderFormApprovedReimbursement}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setOrderFormApprovedReimbursement(e.target.value)}
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
                  value={orderFormNotes}
                  onChange={(e) => setOrderFormNotes(e.target.value)}
                  placeholder="Record packaging conditions, tracking numbers, or transaction notes..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500"
                />
              </div>

              {/* Form Footer Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  Submit Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK ACTION: RECORD RETURN MODAL ─── */}
      {isRecordReturnOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsRecordReturnOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Return / RTO</h3>
                  <p className="text-xs text-slate-500">Log reverse logistics shipping, parcel rejection, or damaged items.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordReturnOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {returnError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {returnError}
              </div>
            )}

            <form onSubmit={handleQuickRecordReturn} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Order</label>
                <select
                  value={returnOrderId}
                  onChange={(e) => setReturnOrderId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} ({o.marketplace}) — {o.items[0]?.sku} ({o.items[0]?.quantity} pcs) - {o.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Return Nature</label>
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value as ReturnType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CUSTOMER_RETURN">Customer Return (Delivered &amp; Returned)</option>
                    <option value="RTO">RTO (Courier Reject / Undelivered)</option>
                    <option value="LOST_RETURN">Lost in Transit by Courier</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Physical Condition</label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as ProductCondition)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  >
                    <option value="SELLABLE">Sellable (Undamaged / Restockable)</option>
                    <option value="DAMAGED">Damaged (Requires SAFE-T Dispute)</option>
                    <option value="UNUSABLE">Unusable / Scrap</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Return Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={returnQty}
                    onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reverse Freight (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={returnShipping}
                    onChange={(e) => setReturnShipping(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Scrap Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={returnRecovery}
                    onChange={(e) => setReturnRecovery(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Customer rejected at doorstep / wrong item sent"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              {returnCondition === "DAMAGED" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                  <span className="font-bold block">Automatic Claim Guard:</span>
                  Marking as damaged will automatically file a dispute claim entry in the Claims Ledger to recover loss.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordReturnOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition shadow-xs"
                >
                  Log Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK ACTION: ADD SUPPLIER PAYMENT MODAL ─── */}
      {isAddPurchaseOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsAddPurchaseOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Supplier Purchase / Payment</h3>
                  <p className="text-xs text-slate-500">Record wholesale inventory purchases and COGS liability.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPurchaseOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddPurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Wholesale Supplier</label>
                  <select
                    value={purchaseSupplierId}
                    onChange={(e) => setPurchaseSupplierId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.contactPerson})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Invoice / Bill Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9921"
                    value={purchaseInvoiceNo}
                    onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Purchased Product SKU</label>
                <select
                  value={purchaseSku}
                  onChange={(e) => {
                    setPurchaseSku(e.target.value);
                    const prod = products.find((p) => p.sku === e.target.value);
                    if (prod) setPurchaseUnitCost(prod.currentCostPrice);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {p.name} (Current Cost: ₹{p.currentCostPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseUnitCost}
                    onChange={(e) => setPurchaseUnitCost(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">GST Tax Rate (%)</label>
                  <select
                    value={purchaseTaxRate}
                    onChange={(e) => setPurchaseTaxRate(parseInt(e.target.value) || 18)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              {/* Purchase Calculation Summary */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-emerald-900 font-bold block">Total Billed to Supplier:</span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Subtotal: {formatINR(purchaseQty * purchaseUnitCost)} + GST ({purchaseTaxRate}%): {formatINR(Math.round(purchaseQty * purchaseUnitCost * (purchaseTaxRate / 100)))}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-900 font-mono">
                  {formatINR(purchaseQty * purchaseUnitCost + Math.round(purchaseQty * purchaseUnitCost * (purchaseTaxRate / 100)))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPurchaseOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs"
                >
                  Record Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}