"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ReturnRecord,
  ReturnType,
  ProductCondition,
  Marketplace,
  Claim,
  RestockStatus,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { PlatformFilterDropdown } from "@/components/ui/marketplace-dropdown";
import {
  ReturnBreakdownModal,
  ReturnCardType,
} from "@/components/modals/return-breakdown-modal";
import {
  Plus,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Download,
  Filter,
  Package,
  Clock,
  Truck,
  TrendingDown,
  Layers,
  Sparkles,
  Pencil,
  Trash2,
  Store,
  Tag,
  Check,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

interface ReturnsViewProps {
  selectedMarketplace?: Marketplace | "ALL";
}

type OperationalTab = "ALL" | "CUSTOMER_RETURN" | "RTO" | "OLD_RETURNS";

export function ReturnsView({ selectedMarketplace: propMarketplace }: ReturnsViewProps = {}) {
  const {
    selectedMarketplace: contextMarketplace,
    returns,
    orders,
    products,
    addReturn,
    updateReturn,
    restockReturn,
    deleteReturn,
    addClaim,
  } = usePlatform();

  const selectedMarketplace = propMarketplace ?? contextMarketplace;

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<OperationalTab>("ALL");
  const [localMarketplace, setLocalMarketplace] = useState<Marketplace | "ALL">(
    selectedMarketplace !== "ALL" ? selectedMarketplace : "ALL"
  );

  useEffect(() => {
    if (selectedMarketplace) {
      setLocalMarketplace(selectedMarketplace);
    }
  }, [selectedMarketplace]);
  const [localCondition, setLocalCondition] = useState<ProductCondition | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"SCAN_ORDER" | "DIRECT_SKU">("SCAN_ORDER");
  const [editingReturn, setEditingReturn] = useState<ReturnRecord | null>(null);
  const [activeBreakdownCard, setActiveBreakdownCard] = useState<ReturnCardType | null>(null);

  // Form State for Log Return - Order Mode
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || "");
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  // Form State for Log Return - Direct SKU Mode (Wholesale)
  const [directSku, setDirectSku] = useState(products[0]?.sku || "");
  const [directChannel, setDirectChannel] = useState<Marketplace>("B2B Wholesale");

  // Common Form Fields
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [condition, setCondition] = useState<ProductCondition>("SELLABLE");
  const [quantity, setQuantity] = useState(1);
  const [awbNumber, setAwbNumber] = useState("");
  const [reason, setReason] = useState("Customer reported defective / remorse return");
  const [returnShipping, setReturnShipping] = useState(65);
  const [recoveryValue, setRecoveryValue] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reference date for aging computation (Simulated live platform time: 2026-09-17)
  const CURRENT_SIM_DATE = new Date("2026-09-17");

  // Helper: check if a return is considered "Old & Aging" (> 14 days old, or pending inspection > 7 days, or deadline near)
  const isOldReturn = (r: ReturnRecord): boolean => {
    const returnDate = new Date(r.receivedDate || r.returnDate);
    const diffDays = Math.floor(
      (CURRENT_SIM_DATE.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays >= 14) return true;
    if (r.condition === "UNDER_INSPECTION" && diffDays >= 7) return true;
    if (r.claimDeadline) {
      const deadline = new Date(r.claimDeadline);
      const daysUntilDeadline = Math.floor(
        (deadline.getTime() - CURRENT_SIM_DATE.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDeadline <= 4) return true;
    }
    return false;
  };

  // Helper: Calculate aging in days
  const getAgingDays = (dateStr: string): number => {
    const d = new Date(dateStr);
    return Math.max(
      0,
      Math.floor((CURRENT_SIM_DATE.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

  // Active channel scope (combines global navbar prop + local dropdown)
  const effectiveChannel =
    localMarketplace !== "ALL"
      ? localMarketplace
      : selectedMarketplace !== "ALL"
      ? selectedMarketplace
      : "ALL";

  // Channel-filtered returns
  const channelFilteredReturns = useMemo(() => {
    return returns.filter(
      (r) => effectiveChannel === "ALL" || r.marketplace === effectiveChannel
    );
  }, [returns, effectiveChannel]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: returns.length };
    returns.forEach((r) => {
      counts[r.marketplace] = (counts[r.marketplace] || 0) + 1;
    });
    return counts;
  }, [returns]);

  // Tab counts
  const allCount = channelFilteredReturns.length;
  const customerCount = channelFilteredReturns.filter(
    (r) => r.returnType === "CUSTOMER_RETURN" || r.returnType === "DAMAGED_RETURN"
  ).length;
  const rtoCount = channelFilteredReturns.filter((r) => r.returnType === "RTO").length;
  const oldReturnsCount = channelFilteredReturns.filter(isOldReturn).length;

  // Operational KPI Calculations
  const totalReturnLoss = useMemo(() => {
    return channelFilteredReturns.reduce((sum, r) => sum + r.lossAmount, 0);
  }, [channelFilteredReturns]);

  const totalReturnUnits = useMemo(() => {
    return channelFilteredReturns.reduce((sum, r) => sum + r.quantity, 0);
  }, [channelFilteredReturns]);

  const totalSalvagedRecovery = useMemo(() => {
    return channelFilteredReturns.reduce((sum, r) => sum + r.inventoryRecoveryValue, 0);
  }, [channelFilteredReturns]);

  // RTO Delivery Failure Rate %
  const rtoStats = useMemo(() => {
    const relevantOrders = orders.filter(
      (o) => effectiveChannel === "ALL" || o.marketplace === effectiveChannel
    );
    const rtoUnits = channelFilteredReturns
      .filter((r) => r.returnType === "RTO")
      .reduce((sum, r) => sum + r.quantity, 0);
    const totalOrderedUnits = relevantOrders.reduce(
      (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
      0
    );
    const rate = totalOrderedUnits > 0 ? (rtoUnits / totalOrderedUnits) * 100 : 0;
    return {
      rate: rate.toFixed(1),
      rtoUnits,
      totalOrderedUnits,
    };
  }, [channelFilteredReturns, orders, effectiveChannel]);

  // Claim potential & urgent expiring claims
  const claimStats = useMemo(() => {
    const damagedReturns = channelFilteredReturns.filter(
      (r) =>
        r.condition === "DAMAGED" ||
        r.condition === "UNUSABLE" ||
        r.returnType === "DAMAGED_RETURN"
    );
    const totalDamagedCost = damagedReturns.reduce((sum, r) => sum + r.lossAmount, 0);
    const claimedCount = damagedReturns.filter((r) => !!r.claimId).length;
    const expiringSoon = channelFilteredReturns.filter((r) => {
      if (!r.claimDeadline) return false;
      const days = Math.floor(
        (new Date(r.claimDeadline).getTime() - CURRENT_SIM_DATE.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return days >= 0 && days <= 5;
    }).length;

    return {
      totalDamagedCost,
      claimedCount,
      totalDamagedCount: damagedReturns.length,
      expiringSoon,
    };
  }, [channelFilteredReturns, CURRENT_SIM_DATE]);

  // Tab and Search Filtering
  const displayedReturns = useMemo(() => {
    return channelFilteredReturns.filter((r) => {
      // 1. Tab filter
      if (activeTab === "CUSTOMER_RETURN") {
        if (r.returnType !== "CUSTOMER_RETURN" && r.returnType !== "DAMAGED_RETURN")
          return false;
      } else if (activeTab === "RTO") {
        if (r.returnType !== "RTO") return false;
      } else if (activeTab === "OLD_RETURNS") {
        if (!isOldReturn(r)) return false;
      }

      // 2. Local condition filter
      if (localCondition !== "ALL" && r.condition !== localCondition) {
        return false;
      }

      // 3. Omni-search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = r.id.toLowerCase().includes(q);
        const matchOrder = r.orderId.toLowerCase().includes(q);
        const matchChannelOrder = r.channelOrderId.toLowerCase().includes(q);
        const matchSku = r.sku.toLowerCase().includes(q);
        const matchProduct = (r.productName || "").toLowerCase().includes(q);
        const matchAwb = (r.awbNumber || "").toLowerCase().includes(q);
        const matchReason = r.returnReason.toLowerCase().includes(q);
        if (
          !matchId &&
          !matchOrder &&
          !matchChannelOrder &&
          !matchSku &&
          !matchProduct &&
          !matchAwb &&
          !matchReason
        ) {
          return false;
        }
      }

      return true;
    });
  }, [channelFilteredReturns, activeTab, localCondition, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Return ID",
      "Order ID",
      "Channel Order ID",
      "AWB Number",
      "Channel",
      "Return Date",
      "Received Date",
      "Type",
      "Condition",
      "Restock Status",
      "SKU",
      "Product Name",
      "Units",
      "Freight Fee (INR)",
      "Salvage Recovery (INR)",
      "Net Loss (INR)",
      "Dispute Claim ID",
      "Claim Deadline",
      "Notes",
    ];

    const rows = displayedReturns.map((r) => [
      r.id,
      r.orderId,
      r.channelOrderId,
      r.awbNumber || "",
      r.marketplace,
      r.returnDate,
      r.receivedDate || r.returnDate,
      r.returnType,
      r.condition,
      r.restockStatus || "PENDING_RESTOCK",
      r.sku,
      `"${(r.productName || "").replace(/"/g, '""')}"`,
      r.quantity,
      r.returnShippingCost,
      r.inventoryRecoveryValue,
      r.lossAmount,
      r.claimId || "",
      r.claimDeadline || "",
      `"${(r.notes || r.returnReason).replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `MarginFlow_Returns_Export_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler: Fast Restock Action
  const handleFastRestock = (returnId: string) => {
    restockReturn(returnId);
  };

  // Handler: Quick Condition Change on Row
  const handleQuickConditionChange = (
    ret: ReturnRecord,
    newCondition: ProductCondition
  ) => {
    const product = products.find((p) => p.sku === ret.sku);
    const unitCost = product ? product.currentCostPrice : 350;
    const isLoss = newCondition === "DAMAGED" || newCondition === "UNUSABLE";
    const isRto = ret.returnType === "RTO";
    let calculatedLoss = isRto ? 0 : (ret.returnShippingCost + (ret.customerReturnFee ?? 0));
    if (!isRto && isLoss) {
      calculatedLoss += unitCost * ret.quantity - ret.inventoryRecoveryValue;
    }

    const updated: ReturnRecord = {
      ...ret,
      condition: newCondition,
      customerReturnFee: isRto ? 0 : (ret.customerReturnFee ?? 0),
      returnShippingCost: isRto ? 0 : ret.returnShippingCost,
      restockStatus:
        newCondition === "SELLABLE"
          ? "RESTOCKED"
          : isLoss
          ? "WRITTEN_OFF"
          : "PENDING_RESTOCK",
      lossAmount: calculatedLoss,
    };
    updateReturn(updated);
  };

  // Submit Handler: Log Return
  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const retId = `RET-${Date.now().toString().slice(-4)}`;
    let orderIdToLink = "";
    let channelOrderId = "";
    let finalMarketplace: Marketplace = "Amazon India";
    let skuToSave = "";
    let productNameToSave = "";
    let unitCostBasis = 350;

    if (createMode === "SCAN_ORDER") {
      const order = orders.find((o) => o.id === selectedOrderId);
      if (!order) {
        setValidationError("Target order could not be located.");
        return;
      }
      const item = order.items[selectedItemIndex] || order.items[0];
      if (!item) {
        setValidationError("Order has no line items.");
        return;
      }

      if (quantity > item.quantity) {
        setValidationError(
          `Quantity (${quantity}) exceeds ordered units (${item.quantity}). Over-return rejected.`
        );
        return;
      }

      orderIdToLink = order.id;
      channelOrderId = order.channelOrderId;
      finalMarketplace = order.marketplace;
      skuToSave = item.sku;
      productNameToSave = item.productName;
      unitCostBasis = item.snapshotUnitCost;
    } else {
      // Direct SKU Mode (Wholesale / Consignment)
      const product = products.find((p) => p.sku === directSku);
      if (!product) {
        setValidationError("Please select a valid product SKU.");
        return;
      }
      orderIdToLink = `WHL-INTAKE-${Date.now().toString().slice(-4)}`;
      channelOrderId = `CHALLAN-${Date.now().toString().slice(-4)}`;
      finalMarketplace = directChannel;
      skuToSave = product.sku;
      productNameToSave = product.name;
      unitCostBasis = product.currentCostPrice;
    }

    const calculatedCustomerFee = returnType === "RTO" ? 0 : returnShipping;
    let calculatedLoss = returnType === "RTO" ? 0 : (returnShipping + calculatedCustomerFee);
    if (returnType !== "RTO" && (condition === "DAMAGED" || condition === "UNUSABLE")) {
      calculatedLoss += unitCostBasis * quantity - recoveryValue;
    }

    const newReturn: ReturnRecord = {
      id: retId,
      orderId: orderIdToLink,
      channelOrderId: channelOrderId,
      marketplace: finalMarketplace,
      returnDate: new Date().toISOString().split("T")[0],
      receivedDate: new Date().toISOString().split("T")[0],
      awbNumber: awbNumber.trim() || undefined,
      returnType,
      returnReason: reason,
      sku: skuToSave,
      productName: productNameToSave,
      quantity,
      condition,
      restockStatus: condition === "SELLABLE" ? "RESTOCKED" : "PENDING_RESTOCK",
      returnShippingCost: returnType === "RTO" ? 0 : returnShipping,
      customerReturnFee: calculatedCustomerFee,
      otherReturnCosts: returnType === "RTO" ? 0 : 10,
      inventoryRecoveryValue: recoveryValue,
      lossAmount: calculatedLoss,
    };

    addReturn(newReturn);

    // Auto-create claim if damaged or lost
    if (condition === "DAMAGED" || returnType === "LOST_RETURN") {
      const claimId = `CLM-${Date.now().toString().slice(-4)}`;
      const newClaim: Claim = {
        id: claimId,
        orderId: orderIdToLink,
        returnId: retId,
        marketplace: finalMarketplace,
        claimType: returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
        claimDate: new Date().toISOString().split("T")[0],
        amountClaimed: calculatedLoss,
        amountRecovered: 0,
        status: "FILED",
        notes: `Auto-dispute claim logged for ${retId} (${condition}).`,
      };
      addClaim(newClaim);
    }

    setIsCreateOpen(false);
  };

  // Submit Handler: Edit Return
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReturn) return;

    const product = products.find((p) => p.sku === editingReturn.sku);
    const unitCost = product ? product.currentCostPrice : 350;

    const isRto = editingReturn.returnType === "RTO";
    let calculatedLoss = isRto ? 0 : (editingReturn.returnShippingCost + (editingReturn.customerReturnFee ?? 0));
    if (
      !isRto &&
      (editingReturn.condition === "DAMAGED" ||
      editingReturn.condition === "UNUSABLE")
    ) {
      calculatedLoss +=
        unitCost * editingReturn.quantity - editingReturn.inventoryRecoveryValue;
    }

    updateReturn({
      ...editingReturn,
      returnShippingCost: isRto ? 0 : editingReturn.returnShippingCost,
      customerReturnFee: isRto ? 0 : (editingReturn.customerReturnFee ?? 0),
      lossAmount: calculatedLoss,
    });
    setEditingReturn(null);
  };

  // Table Columns Definition
  const columns: ColumnDef<ReturnRecord>[] = [
    {
      accessorKey: "id",
      header: "Return / Order / AWB",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-amber-700 text-xs tracking-tight tabular-nums">
                {r.id}
              </span>
              {r.awbNumber && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 tabular-nums font-medium">
                  {r.awbNumber}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-blue-600 font-semibold tracking-tight tabular-nums">
                {r.orderId}
              </span>
              {r.channelOrderId && r.channelOrderId !== r.orderId && (
                <span className="text-slate-400 text-[10px] tabular-nums font-normal">
                  ({r.channelOrderId})
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "marketplace",
      header: "Channel & Inflow",
      cell: ({ row }) => {
        const r = row.original;
        const aging = getAgingDays(r.receivedDate || r.returnDate);
        const isOld = isOldReturn(r);

        return (
          <div>
            <span className="text-xs text-slate-800 font-semibold block">
              {r.marketplace}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{formatDate(r.receivedDate || r.returnDate)}</span>
              {isOld && (
                <span className="ml-1 px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                  {aging}d aging
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: "SKU & Product",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="max-w-[240px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-900 font-semibold text-xs tracking-tight tabular-nums">
                {r.sku}
              </span>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/60 tabular-nums">
                Qty: {r.quantity}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {r.productName || "Standard Catalog SKU"}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "returnType",
      header: "Type & Restock",
      cell: ({ row }) => {
        const t = row.original.returnType;
        const restock = row.original.restockStatus || "PENDING_RESTOCK";

        const typeBadge =
          t === "RTO"
            ? "bg-amber-50 text-amber-900 border-amber-200"
            : t === "DAMAGED_RETURN"
            ? "bg-rose-50 text-rose-900 border-rose-200"
            : "bg-blue-50 text-blue-900 border-blue-200";

        const restockBadge =
          restock === "RESTOCKED"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : restock === "WRITTEN_OFF"
            ? "bg-slate-100 text-slate-700 border-slate-200"
            : "bg-amber-50 text-amber-800 border-amber-200";

        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeBadge}`}
            >
              {t.replace(/_/g, " ")}
            </span>
            <div>
              <span
                className={`inline-block px-2 py-0.2 rounded text-[9px] font-bold border ${restockBadge}`}
              >
                {restock.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "condition",
      header: "QC Inspection",
      cell: ({ row }) => {
        const r = row.original;
        const isSellable = r.condition === "SELLABLE";
        const isDamaged = r.condition === "DAMAGED" || r.condition === "UNUSABLE";

        return (
          <div className="flex items-center gap-1.5">
            <select
              value={r.condition}
              onChange={(e) =>
                handleQuickConditionChange(r, e.target.value as ProductCondition)
              }
              className={`text-[11px] font-bold py-1 px-2 rounded-full border cursor-pointer focus:outline-none transition-all ${
                isSellable
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : isDamaged
                  ? "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
                  : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
              }`}
            >
              <option value="SELLABLE">✓ Sellable (Restock)</option>
              <option value="DAMAGED">⚠ Damaged (Scrap)</option>
              <option value="USED">◉ Used / Open Box</option>
              <option value="UNDER_INSPECTION">⏳ Under Inspection</option>
              <option value="UNUSABLE">✕ Unusable Write-off</option>
            </select>
          </div>
        );
      },
    },
    {
      accessorKey: "lossAmount",
      header: "Logistics & Net Loss",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[#D70015] tracking-tight tabular-nums block">
                {formatINR(r.lossAmount)}
              </span>
              {r.inventoryRecoveryValue > 0 && (
                <span className="text-[10px] text-[#288548] font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60 tabular-nums">
                  +{formatINR(r.inventoryRecoveryValue)}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium tabular-nums flex items-center gap-1.5 flex-wrap">
              <span>Freight: {formatINR(r.returnShippingCost)}</span>
              {(r.customerReturnFee ?? 0) > 0 && (
                <span>• Fee: {formatINR(r.customerReturnFee)}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "claimId",
      header: "Dispute / SLA",
      cell: ({ row }) => {
        const r = row.original;
        const claimId = r.claimId;
        const isExpiring =
          r.claimDeadline &&
          Math.floor(
            (new Date(r.claimDeadline).getTime() - CURRENT_SIM_DATE.getTime()) /
              (1000 * 60 * 60 * 24)
          ) <= 4;

        return (
          <div className="space-y-0.5">
            {claimId ? (
              <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-semibold tabular-nums inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                {claimId}
              </span>
            ) : r.condition === "DAMAGED" ? (
              <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Unclaimed Damage
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">No Claim Needed</span>
            )}

            {r.claimDeadline && (
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span>SLA: {formatDate(r.claimDeadline)}</span>
                {isExpiring && (
                  <span className="text-amber-700 font-bold bg-amber-50 px-1 rounded border border-amber-200">
                    ⚡ Urgent
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Quick Actions",
      cell: ({ row }) => {
        const r = row.original;
        const canRestock = r.restockStatus === "PENDING_RESTOCK";

        return (
          <div className="flex items-center gap-1.5">
            {canRestock && (
              <button
                onClick={() => handleFastRestock(r.id)}
                title="Mark restocked & put away into warehouse inventory"
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restock</span>
              </button>
            )}

            {/* 1-Click SAFE-T Dispute Generator */}
            {(r.condition === "DAMAGED" || r.condition === "UNUSABLE" || r.returnType === "DAMAGED_RETURN" || !r.claimId) && (
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("marginflow_open_dispute_modal", {
                      detail: { returnRecord: r },
                    })
                  )
                }
                title="1-Click SAFE-T Dispute Packet Generator"
                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/60 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
              >
                <ShieldAlert className="w-3 h-3 text-purple-700" />
                <span>Draft Claim</span>
              </button>
            )}

            <button
              onClick={() => setEditingReturn({ ...r, customerReturnFee: r.customerReturnFee ?? 0 })}
              title="Edit return record details"
              className="p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => deleteReturn(r.id)}
              title="Delete return entry"
              className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Header Banner & New Transaction Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Returns & Reverse Logistics (RTO)
          </h1>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            High-speed intake, multi-channel quarantine, physical QC grading, restock putaway, and automated dispute claims.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-full shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Log Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveBreakdownCard("totalReturnsLoss")}
          className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Total Returns Loss</span>
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{formatINR(totalReturnLoss)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{totalReturnUnits} units returned</span>
        </div>

        <div
          onClick={() => setActiveBreakdownCard("rtoFailureRate")}
          className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">RTO Failure Rate</span>
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{rtoStats.rate}%</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{rtoStats.rtoUnits} undelivered of {rtoStats.totalOrderedUnits} dispatched</span>
        </div>

        <div
          onClick={() => setActiveBreakdownCard("oldAgingBacklog")}
          className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Old & Aging Backlog</span>
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{oldReturnsCount}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{oldReturnsCount === 1 ? "1 package" : `${oldReturnsCount} packages`} &gt; 14 days</span>
        </div>

        <div
          onClick={() => setActiveBreakdownCard("disputeClaimPotential")}
          className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Dispute Claim Potential</span>
            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{formatINR(claimStats.totalDamagedCost)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{claimStats.claimedCount} of {claimStats.totalDamagedCount} filed</span>
        </div>
      </div>

      {/* Category Navigation Pills (Image 2 Pill Control style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-0.5">
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-slate-200/60 inline-flex items-center gap-0.5 text-xs">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === "ALL"
                ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            All Returns ({allCount})
          </button>
          <button
            onClick={() => setActiveTab("CUSTOMER_RETURN")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === "CUSTOMER_RETURN"
                ? "bg-white text-blue-700 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            Customer Returns ({customerCount})
          </button>
          <button
            onClick={() => setActiveTab("RTO")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === "RTO"
                ? "bg-white text-amber-700 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            RTO Undelivered ({rtoCount})
          </button>
          <button
            onClick={() => setActiveTab("OLD_RETURNS")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "OLD_RETURNS"
                ? "bg-white text-rose-700 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <span>Old & Aging Returns ({oldReturnsCount})</span>
            {oldReturnsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Tactical Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Omni Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ID, AWB, SKU, Order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52 sm:w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Local Channel Filter Dropdown */}
          <PlatformFilterDropdown
            selected={localMarketplace}
            onChange={setLocalMarketplace}
            counts={channelCounts}
          />

          {/* Condition Filter */}
          <select
            value={localCondition}
            onChange={(e) => setLocalCondition(e.target.value as ProductCondition | "ALL")}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer shadow-2xs hover:bg-slate-50"
          >
            <option value="ALL">All QC States</option>
            <option value="SELLABLE">Sellable</option>
            <option value="DAMAGED">Damaged</option>
            <option value="USED">Used / Open</option>
            <option value="UNDER_INSPECTION">Under Inspection</option>
            <option value="UNUSABLE">Unusable</option>
          </select>
        </div>
      </div>

      {/* Main Returns Data Table */}
      <DataTable
        columns={columns}
        data={displayedReturns}
        searchKey="sku"
        searchPlaceholder="Filter listed returns..."
      />

      {/* Modal: Dual-Mode Log Return */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">
                  Log Reverse Logistics Event
                </h2>
                <p className="text-[11px] text-slate-500">
                  Scan package, verify items, and record inspection disposition.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="px-6 pt-3 pb-2 bg-slate-50/30 border-b border-slate-100 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateMode("SCAN_ORDER")}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  createMode === "SCAN_ORDER"
                    ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                1. Scan / Order Lookup
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("DIRECT_SKU")}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  createMode === "DIRECT_SKU"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                2. Direct SKU / Wholesale
              </button>
            </div>

            <form id="create-return-form" onSubmit={handleCreateReturn} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              {validationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Mode 1: Order Lookup */}
              {(() => {
                const targetOrder = orders.find((o) => o.id === selectedOrderId);
                const targetItem = targetOrder?.items[selectedItemIndex];
                return createMode === "SCAN_ORDER" ? (
                  <div className="space-y-3 p-3.5 bg-blue-50/40 rounded-2xl border border-blue-100">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Target Order (AWB or Order ID)
                      </label>
                      <select
                        value={selectedOrderId}
                        onChange={(e) => {
                          setSelectedOrderId(e.target.value);
                          setSelectedItemIndex(0);
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-mono"
                      >
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.id} ({o.marketplace}) - {o.customerName} - {o.items[0]?.sku}
                          </option>
                        ))}
                      </select>
                    </div>

                    {targetOrder && targetOrder.items.length > 1 && (
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                          Select Returned Item in Multi-Item Order
                        </label>
                        <select
                          value={selectedItemIndex}
                          onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                        >
                          {targetOrder.items.map((it, idx) => (
                            <option key={idx} value={idx}>
                              {it.sku} - {it.productName} (Ordered: {it.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {targetItem && (
                      <div className="p-2.5 bg-white rounded-xl border border-blue-100 text-[11px] space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">Item Name:</span>
                          <span className="text-slate-900 font-semibold">{targetItem.productName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Unit Selling Price:</span>
                          <span className="font-bold text-slate-900">
                            {formatINR(targetItem.sellingPrice || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cost Basis (COGS):</span>
                          <span className="font-bold text-amber-700">
                            {formatINR(targetItem.snapshotUnitCost || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Mode 2: Direct SKU / Wholesale */
                  <div className="space-y-3 p-3.5 bg-purple-50/40 rounded-2xl border border-purple-100">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Select Catalog Product / SKU
                      </label>
                      <select
                        value={directSku}
                        onChange={(e) => setDirectSku(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-mono font-semibold"
                      >
                        {products.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} - {p.name} (₹{p.currentCostPrice} cost)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Return Channel / Source
                      </label>
                      <select
                        value={directChannel}
                        onChange={(e) => setDirectChannel(e.target.value as Marketplace)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold"
                      >
                        <option value="B2B Wholesale">B2B Wholesale / Consignment</option>
                        <option value="Amazon India">Amazon India</option>
                        <option value="Flipkart">Flipkart</option>
                        <option value="Meesho">Meesho</option>
                        <option value="Personal Website">Personal Website</option>
                        <option value="Myntra">Myntra</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

              {/* Common Details */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Return Type
                  </label>
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value as ReturnType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold"
                  >
                    <option value="CUSTOMER_RETURN">Customer Return (Opened)</option>
                    <option value="RTO">RTO (Undelivered / Bounced)</option>
                    <option value="DAMAGED_RETURN">Damaged Return</option>
                    <option value="LOST_RETURN">Lost in Transit</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    QC Inspection State
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ProductCondition)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-semibold"
                  >
                    <option value="SELLABLE">Sellable (Restock)</option>
                    <option value="DAMAGED">Damaged (Scrap Write-Off)</option>
                    <option value="USED">Used / Open Box</option>
                    <option value="UNDER_INSPECTION">Under Inspection</option>
                    <option value="UNUSABLE">Unusable Write-off</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Units</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Freight (₹)
                  </label>
                  <input
                    type="number"
                    value={returnShipping}
                    onChange={(e) => setReturnShipping(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Scrap/Salvage (₹)
                  </label>
                  <input
                    type="number"
                    value={recoveryValue}
                    onChange={(e) => setRecoveryValue(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Courier AWB Tracking # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FMPP0049281920 or EKART-99218201"
                  value={awbNumber}
                  onChange={(e) => setAwbNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Inspection Remarks / Defect Note
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  rows={2}
                />
              </div>
            </form>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-slate-500">
                {condition === "DAMAGED" && (
                  <span className="text-purple-700 font-medium">
                    ⚡ Will auto-generate draft claim ticket
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-return-form"
                  className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-xs transition-colors"
                >
                  Commit Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: In-Place Edit Return Record */}
      {editingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">
                  Edit Return Record ({editingReturn.id})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Update quantities, condition grading, or salvage values.
                </p>
              </div>
              <button
                onClick={() => setEditingReturn(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form id="edit-return-form" onSubmit={handleSaveEdit} className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Returned Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingReturn.quantity}
                    onChange={(e) =>
                      setEditingReturn({
                        ...editingReturn,
                        quantity: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Restock Disposition
                  </label>
                  <select
                    value={editingReturn.restockStatus || "PENDING_RESTOCK"}
                    onChange={(e) =>
                      setEditingReturn({
                        ...editingReturn,
                        restockStatus: e.target.value as RestockStatus,
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="PENDING_RESTOCK">Pending Restock</option>
                    <option value="RESTOCKED">Restocked into Bin</option>
                    <option value="WRITTEN_OFF">Written Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Inspection Condition
                </label>
                <select
                  value={editingReturn.condition}
                  onChange={(e) =>
                    setEditingReturn({
                      ...editingReturn,
                      condition: e.target.value as ProductCondition,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="SELLABLE">Sellable</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="USED">Used / Opened</option>
                  <option value="UNDER_INSPECTION">Under Inspection</option>
                  <option value="UNUSABLE">Unusable</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Freight Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={editingReturn.returnShippingCost}
                    onChange={(e) =>
                      setEditingReturn({
                        ...editingReturn,
                        returnShippingCost: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Salvage Value (₹)
                  </label>
                  <input
                    type="number"
                    value={editingReturn.inventoryRecoveryValue}
                    onChange={(e) =>
                      setEditingReturn({
                        ...editingReturn,
                        inventoryRecoveryValue: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Courier AWB Tracking Number
                </label>
                <input
                  type="text"
                  value={editingReturn.awbNumber || ""}
                  onChange={(e) =>
                    setEditingReturn({
                      ...editingReturn,
                      awbNumber: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Reason & Internal Journal Notes
                </label>
                <textarea
                  value={editingReturn.notes || editingReturn.returnReason}
                  onChange={(e) =>
                    setEditingReturn({
                      ...editingReturn,
                      notes: e.target.value,
                      returnReason: e.target.value,
                    })
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  rows={2}
                />
              </div>
            </form>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingReturn(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-return-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-xs transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RETURN CARD BREAKDOWN INSPECTION MODAL ─── */}
      <ReturnBreakdownModal
        cardType={activeBreakdownCard}
        onClose={() => setActiveBreakdownCard(null)}
        returns={returns}
        orders={orders}
        effectiveChannel={effectiveChannel}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setActiveBreakdownCard(null);
        }}
      />
    </div>
  );
}
