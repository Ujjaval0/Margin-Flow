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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              {mode === "edit" ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {mode === "edit" ? `Edit Order: ${initialOrder?.id}` : "Add Order"}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === "edit"
                  ? `Channel Ref: ${channelOrderId || initialOrder?.channelOrderId}`
                  : "Direct entry to platform ledgers with real-time margin & reverse logistics tracking."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* 1. SELECT MARKETPLACE PLATFORM */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              SELECT MARKETPLACE PLATFORM
            </label>
            <FormMarketplaceDropdown
              selected={marketplace}
              onChange={(mp, estComm) => {
                setMarketplace(mp);
                setEstCommissionPercent(String(estComm));
              }}
            />
          </div>

          {/* 2. ORDER ID, DATE, SKU */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {mode === "edit" ? "CHANNEL REF #" : "ORDER ID / REF #"}
              </label>
              <input
                type="text"
                value={mode === "edit" ? channelOrderId : orderId}
                onChange={(e) =>
                  mode === "edit"
                    ? setChannelOrderId(e.target.value)
                    : setOrderId(e.target.value)
                }
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
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
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
                list="order-modal-catalog-skus"
                value={sku}
                onChange={(e) => handleSelectSku(e.target.value)}
                placeholder="e.g. SKU-COT-01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
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
          </div>

          {/* 3. PRODUCT TITLE & QUANTITY */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="col-span-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                PRODUCT TITLE / NAME
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
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
                value={quantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantity(e.target.value)}
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
              <span className="uppercase tracking-wider">
                WHOLESALER / SUPPLIER PURCHASE COST (COGS)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  WHOLESALER NAME
                </label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
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
                  value={unitCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                  required
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Total Wholesale COGS:{" "}
              <strong className="text-slate-800 font-bold font-mono">
                {formatINR(totalWholesaleCost)}
              </strong>
            </div>
          </div>

          {/* 5. PLATFORM SETTLEMENT FIGURES */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
            <div className="text-slate-800 font-bold text-xs uppercase tracking-wider">
              PLATFORM SETTLEMENT FIGURES
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  UNIT PRICE (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  COMMISSION (%)
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
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  EXPECTED (₹)
                </label>
                <input
                  type="text"
                  readOnly
                  value={grossSales > 0 ? formatINR(expectedSettlement) : "0"}
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
                  value={actualReceived}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setActualReceived(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* 6. MARK AS RETURNED / RTO ORDER (Only in create mode) */}
          {mode === "create" && (
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-800 space-y-3.5 shadow-2xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isReturned}
                  onChange={(e) => setIsReturned(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 accent-blue-600 cursor-pointer"
                />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  MARK AS RETURNED / RTO ORDER
                </span>
              </label>

              {isReturned && (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        RETURN TYPE
                      </label>
                      <select
                        value={returnType}
                        onChange={(e) => setReturnType(e.target.value as ReturnType)}
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
                        value={returnFee}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setReturnFee(e.target.value)}
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
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. wrong size, damaged packaging"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
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
                        RETURNED PRODUCT IS DAMAGED / DEFECTIVE (FILE CLAIM)
                      </span>
                    </label>

                    {isDamagedClaim && (
                      <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                        <div>
                          <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            CLAIM AMOUNT FILED
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={claimAmount}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setClaimAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-2 bg-white border border-amber-200 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-bold shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                            CLAIM STATUS
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
                            APPROVED REIMBURSEMENT
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={approvedReimbursement}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setApprovedReimbursement(e.target.value)}
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
          )}

          {/* 7. GENERAL ORDER NOTES */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              GENERAL ORDER NOTES
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record packaging conditions, tracking numbers, or transaction notes..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500"
            />
          </div>

          {/* Form Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              {mode === "edit" ? "Update Order" : "Submit Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
