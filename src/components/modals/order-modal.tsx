"use client";

import React, { useState, useEffect } from "react";
import { Plus, Pencil, X, Truck } from "lucide-react";
import {
  Order,
  Marketplace,
  ReturnType,
  Settlement,
  Claim,
  Product,
  Supplier,
} from "@/domain/types";
import { formatINR } from "@/lib/utils";
import { FormMarketplaceDropdown } from "@/components/ui/marketplace-dropdown";

export interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialOrder?: Order | null;
  defaultMarketplace?: Marketplace | "ALL";
  products: Product[];
  suppliers: Supplier[];
  onAddOrder?: (order: Order) => void;
  onUpdateOrder?: (order: Order) => void;
  onAddSettlement?: (settlement: Settlement) => void;
  onAddReturn?: (ret: any) => void;
  onAddClaim?: (claim: Claim) => void;
}

export function OrderModal({
  isOpen,
  onClose,
  mode = "create",
  initialOrder = null,
  defaultMarketplace = "ALL",
  products,
  suppliers,
  onAddOrder,
  onUpdateOrder,
  onAddSettlement,
  onAddReturn,
  onAddClaim,
}: OrderModalProps) {
  // Determine starting marketplace
  const startingMarketplace: Marketplace =
    initialOrder?.marketplace ||
    (defaultMarketplace !== "ALL" ? defaultMarketplace : "Amazon India");

  // Form State
  const [marketplace, setMarketplace] = useState<Marketplace>(startingMarketplace);
  const [orderId, setOrderId] = useState("");
  const [channelOrderId, setChannelOrderId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [supplierName, setSupplierName] = useState("");
  const [unitCost, setUnitCost] = useState("350");
  const [sellingPrice, setSellingPrice] = useState("999");
  const [estCommissionPercent, setEstCommissionPercent] = useState("15");
  const [actualReceived, setActualReceived] = useState("");
  const [notes, setNotes] = useState("");

  // Return / RTO Sub-Form (mainly for create mode)
  const [isReturned, setIsReturned] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [returnFee, setReturnFee] = useState("0");
  const [returnReason, setReturnReason] = useState("");
  const [isDamagedClaim, setIsDamagedClaim] = useState(false);
  const [claimAmount, setClaimAmount] = useState("0");
  const [claimStatus, setClaimStatus] = useState<"Draft" | "Filed" | "Approved" | "Rejected">("Draft");
  const [approvedReimbursement, setApprovedReimbursement] = useState("0");

  // Sync state on open or change of initialOrder
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialOrder) {
      setMarketplace(initialOrder.marketplace);
      setOrderId(initialOrder.id);
      setChannelOrderId(initialOrder.channelOrderId || "");
      setOrderDate(initialOrder.orderDate);
      const firstItem = initialOrder.items[0];
      setSku(firstItem?.sku || "");
      setProductName(firstItem?.productName || "");
      setQuantity(String(firstItem?.quantity || 1));
      setUnitCost(String(firstItem?.snapshotUnitCost || 0));
      setSellingPrice(String(firstItem?.sellingPrice || 0));
      const estComm =
        firstItem && firstItem.sellingPrice > 0 && initialOrder.marketplaceChargesEstimate
          ? Math.round(
              (initialOrder.marketplaceChargesEstimate /
                (firstItem.sellingPrice * firstItem.quantity)) *
                100
            )
          : 15;
      setEstCommissionPercent(String(estComm || 15));
      setActualReceived("");
      setNotes(initialOrder.notes || "");
      setIsReturned(initialOrder.status === "RETURNED" || initialOrder.status === "RTO");
    } else {
      // Create mode defaults
      const randomId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      setOrderId(randomId);
      setChannelOrderId(`REF-${randomId.replace("ORD-", "")}`);
      setOrderDate(new Date().toISOString().split("T")[0]);
      const initialProd = products[0];
      setSku(initialProd?.sku || "");
      setProductName(initialProd?.name || "");
      setQuantity("1");
      setUnitCost(String(initialProd?.currentCostPrice || 350));
      setSellingPrice(String(initialProd ? Math.round(initialProd.currentCostPrice * 2.5) : 999));
      setEstCommissionPercent("15");
      setActualReceived("");
      setSupplierName("");
      setNotes("");
      setIsReturned(false);
      setReturnType("CUSTOMER_RETURN");
      setReturnFee("0");
      setReturnReason("");
      setIsDamagedClaim(false);
      setClaimAmount("0");
      setClaimStatus("Draft");
      setApprovedReimbursement("0");
    }
  }, [isOpen, mode, initialOrder]);

  if (!isOpen) return null;

  // Live Calculations
  const parsedQty = Math.max(1, parseFloat(quantity) || 1);
  const parsedUnitCost = Math.max(0, parseFloat(unitCost) || 0);
  const parsedSellingPrice = Math.max(0, parseFloat(sellingPrice) || 0);
  const parsedCommPercent = Math.max(0, parseFloat(estCommissionPercent) || 0);
  const parsedActualReceived = parseFloat(actualReceived) || 0;

  const totalWholesaleCost = parsedQty * parsedUnitCost;
  const grossSales = parsedQty * parsedSellingPrice;
  const commissionDeduction = Math.round(grossSales * (parsedCommPercent / 100));
  const expectedSettlement = Math.max(0, grossSales - commissionDeduction);
  const estimatedTrueProfit = expectedSettlement - totalWholesaleCost;

  const handleSelectSku = (skuValue: string) => {
    setSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setProductName(prod.name);
      setUnitCost(String(prod.currentCostPrice));
      setSellingPrice(String(Math.round(prod.currentCostPrice * 2.5)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "edit" && initialOrder) {
      const updatedOrder: Order = {
        ...initialOrder,
        channelOrderId: channelOrderId.trim() || initialOrder.channelOrderId,
        marketplace,
        orderDate,
        customerName: initialOrder.customerName || "Customer",
        marketplaceChargesEstimate: commissionDeduction,
        notes,
        items: [
          {
            ...(initialOrder.items[0] || { id: `ITEM-${Date.now().toString().slice(-4)}` }),
            sku: sku || "SKU-CUSTOM",
            productName: productName || "Order Item",
            quantity: parsedQty,
            sellingPrice: parsedSellingPrice,
            discount: initialOrder.items[0]?.discount || 0,
            taxAmount: Math.round(parsedSellingPrice * parsedQty * 0.18 * 100) / 100,
            snapshotUnitCost: parsedUnitCost,
          },
          ...initialOrder.items.slice(1),
        ],
      };

      onUpdateOrder?.(updatedOrder);
      onClose();
      return;
    }

    // Create Mode
    const finalOrderId = orderId.trim() || `ORD-${Date.now().toString().slice(-6)}`;
    const finalChannelRef =
      channelOrderId.trim() || `REF-${finalOrderId.replace("ORD-", "")}`;

    const newOrder: Order = {
      id: finalOrderId,
      channelOrderId: finalChannelRef,
      marketplace,
      orderDate,
      status: isReturned ? (returnType === "RTO" ? "RTO" : "RETURNED") : "CONFIRMED",
      customerName: "Direct Buyer",
      customerCity: "Mumbai",
      customerState: "Maharashtra",
      shippingFeeCharged: 0,
      marketplaceChargesEstimate: commissionDeduction,
      notes,
      items: [
        {
          id: `ITEM-${Date.now().toString().slice(-4)}`,
          sku: sku || "CUSTOM-SKU",
          productName: productName || "Custom Order Item",
          quantity: parsedQty,
          sellingPrice: parsedSellingPrice,
          discount: 0,
          taxAmount: Math.round(parsedSellingPrice * parsedQty * 0.18 * 100) / 100,
          snapshotUnitCost: parsedUnitCost,
          returnedQuantity: isReturned ? parsedQty : 0,
        },
      ],
    };

    onAddOrder?.(newOrder);

    // Optional settlement remittance
    if (parsedActualReceived > 0 && onAddSettlement) {
      const createdSettlement: Settlement = {
        id: `SETTLE-${Date.now().toString().slice(-4)}`,
        settlementBatchId: `BATCH-${Date.now().toString().slice(-4)}`,
        marketplace,
        settlementDate: orderDate,
        orderId: newOrder.id,
        grossAmount: grossSales,
        deductions: [
          {
            category: "COMMISSION",
            name: "Marketplace Commission",
            amount: commissionDeduction,
          },
          {
            category: "LOGISTICS",
            name: "Logistics & Forwarding",
            amount: Math.max(0, grossSales - parsedActualReceived - commissionDeduction),
          },
        ],
        tcsTdsTax: Math.round(grossSales * 0.01),
        netSettlement: parsedActualReceived,
        reconciliationStatus: "RECONCILED",
        bankTxRef: `BANK-DEP-${finalOrderId.slice(-4)}`,
      };
      onAddSettlement(createdSettlement);
    }

    // Optional return record & dispute claim
    if (isReturned && onAddReturn) {
      const retId = `RET-${Date.now().toString().slice(-4)}`;
      const parsedFee = parseFloat(returnFee) || 0;
      const parsedClaim = parseFloat(claimAmount) || 0;
      const parsedReimbursement = parseFloat(approvedReimbursement) || 0;

      let claimIdToLink: string | undefined = undefined;

      if (isDamagedClaim && onAddClaim) {
        claimIdToLink = `CLM-${Date.now().toString().slice(-4)}`;
        let mappedClaimStatus: Claim["status"] = "FILED";
        if (claimStatus === "Draft") mappedClaimStatus = "NOT_FILED";
        else if (claimStatus === "Approved") mappedClaimStatus = "APPROVED";
        else if (claimStatus === "Rejected") mappedClaimStatus = "REJECTED";

        const newClaim: Claim = {
          id: claimIdToLink,
          orderId: newOrder.id,
          returnId: retId,
          marketplace,
          claimType: returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
          claimDate: orderDate,
          amountClaimed: parsedClaim > 0 ? parsedClaim : parsedUnitCost * parsedQty,
          amountRecovered: parsedReimbursement,
          status: mappedClaimStatus,
          notes: `Auto-generated claim from Order Creation (${returnType})`,
        };
        onAddClaim(newClaim);
      }

      const newReturnRecord = {
        id: retId,
        orderId: newOrder.id,
        channelOrderId: newOrder.channelOrderId,
        marketplace,
        returnDate: orderDate,
        returnType,
        returnReason: returnReason || "Customer return recorded at ingestion",
        sku: sku || "CUSTOM-SKU",
        quantity: parsedQty,
        condition: isDamagedClaim ? "DAMAGED" : "SELLABLE",
        returnShippingCost: parsedFee,
        otherReturnCosts: 0,
        inventoryRecoveryValue: parsedReimbursement,
        lossAmount: isDamagedClaim
          ? parsedUnitCost * parsedQty + parsedFee - parsedReimbursement
          : parsedFee,
      };

      onAddReturn(newReturnRecord);
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {mode === "edit" ? "Edit Order" : "Add New Order"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === "edit"
                ? `Order ID: ${initialOrder?.id} · Ref: ${channelOrderId || initialOrder?.channelOrderId || "N/A"}`
                : "Enter order details to sync inventory, COGS liabilities, and expected settlements."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* 1. Channel & Order Reference */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Marketplace Channel
              </label>
              <FormMarketplaceDropdown
                selected={marketplace}
                onChange={(mp, estComm) => {
                  setMarketplace(mp);
                  setEstCommissionPercent(String(estComm));
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  {mode === "edit" ? "Channel Reference #" : "Order / Reference #"}
                </label>
                <input
                  type="text"
                  value={mode === "edit" ? channelOrderId : orderId}
                  onChange={(e) =>
                    mode === "edit"
                      ? setChannelOrderId(e.target.value)
                      : setOrderId(e.target.value)
                  }
                  placeholder="e.g. 402-1829301-4492019"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Product & Item Details */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  SKU / Item Code
                </label>
                <input
                  type="text"
                  list="order-modal-catalog-skus"
                  value={sku}
                  onChange={(e) => handleSelectSku(e.target.value)}
                  placeholder="e.g. ELEC-WEM-01"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium tabular-nums transition-all"
                  required
                />
                <datalist id="order-modal-catalog-skus">
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Product Title / Name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Wireless Ergonomic Mouse"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium transition-all"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold tabular-nums text-center transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Wholesale Cost (COGS) Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                Wholesale Cost (COGS)
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Total COGS: <span className="text-[#1D1D1F] font-bold tabular-nums">{formatINR(totalWholesaleCost)}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Wholesale Supplier
                </label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium cursor-pointer transition-all"
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
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Unit Purchase Cost (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={unitCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Platform Pricing & Settlement Card */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                Platform Financials & Settlement
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Unit Selling Price (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Platform Commission (%)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={estCommissionPercent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEstCommissionPercent(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-semibold tabular-nums transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Actual Received Payout (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={actualReceived}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setActualReceived(e.target.value)}
                  placeholder="Optional (settled)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-semibold tabular-nums transition-all"
                />
              </div>
            </div>

            {/* Live Financial Breakdown Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-semibold text-slate-400 block">Gross Sales</span>
                <span className="font-bold text-[#1D1D1F] tabular-nums tracking-tight">
                  {formatINR(grossSales)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-semibold text-slate-400 block">Est. Platform Fee</span>
                <span className="font-bold text-[#D70015] tabular-nums tracking-tight">
                  −{formatINR(commissionDeduction)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-semibold text-slate-400 block">Expected Payout</span>
                <span className="font-bold text-blue-700 tabular-nums tracking-tight">
                  {formatINR(expectedSettlement)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-semibold text-slate-400 block">Est. True Profit</span>
                <span
                  className={`font-bold tabular-nums tracking-tight ${
                    estimatedTrueProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                  }`}
                >
                  {formatINR(estimatedTrueProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Mark as Returned / RTO Order (Only in create mode) */}
          {mode === "create" && (
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-800 space-y-3.5 shadow-2xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isReturned}
                  onChange={(e) => setIsReturned(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 accent-purple-600 cursor-pointer"
                />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Mark as Returned / RTO Order
                </span>
              </label>

              {isReturned && (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Return Type
                      </label>
                      <select
                        value={returnType}
                        onChange={(e) => setReturnType(e.target.value as ReturnType)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer font-medium shadow-2xs"
                      >
                        <option value="CUSTOMER_RETURN">Customer Return (Delivered &amp; Returned)</option>
                        <option value="RTO">RTO (Undelivered / Doorstep Rejection)</option>
                        <option value="DAMAGED_RETURN">Damaged Return</option>
                        <option value="LOST_RETURN">Lost in Transit</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Return Fee / Logistics Deduction (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={returnFee}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setReturnFee(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl tabular-nums text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-semibold shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Return Reason / Notes
                    </label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. wrong size, damaged packaging"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  {/* Damaged Claim Sub-Card */}
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3 shadow-2xs">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isDamagedClaim}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsDamagedClaim(checked);
                          if (checked && (!claimAmount || claimAmount === "0")) {
                            setClaimAmount(String(parsedUnitCost || parsedSellingPrice || 0));
                          }
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 accent-amber-600 cursor-pointer"
                      />
                      <span className="font-bold text-xs uppercase tracking-wider text-amber-900">
                        Returned Product is Damaged / Defective (File SAFE-T Claim)
                      </span>
                    </label>

                    {isDamagedClaim && (
                      <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                        <div>
                          <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            Claim Amount Filed
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={claimAmount}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setClaimAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg tabular-nums text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-semibold shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            Claim Status
                          </label>
                          <select
                            value={claimStatus}
                            onChange={(e) =>
                              setClaimStatus(
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
                            Approved Reimbursement
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={approvedReimbursement}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setApprovedReimbursement(e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg tabular-nums text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-semibold shadow-2xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. General Order Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              General Order Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record packaging conditions, tracking numbers, or transaction notes..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
            />
          </div>

          {/* Sticky Actions Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{parsedQty} unit{parsedQty === 1 ? "" : "s"}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>Gross: <strong className="text-slate-800 tabular-nums">{formatINR(grossSales)}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                {mode === "edit" ? "Update Order" : "Submit Order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
