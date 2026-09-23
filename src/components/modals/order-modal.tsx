"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
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
  const [sellingPrice, setSellingPrice] = useState("1000");
  const [commissionPercent, setCommissionPercent] = useState("20");
  const [settlementAmount, setSettlementAmount] = useState("800");
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
      const sPrice = firstItem?.sellingPrice || 0;
      const sQty = firstItem?.quantity || 1;
      setSellingPrice(String(sPrice));
      const gSales = sPrice * sQty;

      let initSettlement = initialOrder.settlementAmount || 0;
      let initCommPercent = initialOrder.commissionPercent ?? (initialOrder.settlementPercent ? Math.max(0, 100 - initialOrder.settlementPercent) : 20);
      if (!initSettlement && initialOrder.marketplaceChargesEstimate) {
        initSettlement = Math.max(0, gSales - initialOrder.marketplaceChargesEstimate);
      }
      if (!initSettlement && gSales > 0) {
        initSettlement = Math.round(gSales * 0.8);
      }
      if (gSales > 0 && !initialOrder.commissionPercent && !initialOrder.settlementPercent) {
        initCommPercent = Math.max(0, Math.round(((gSales - initSettlement) / gSales) * 100 * 10) / 10);
      }
      setSettlementAmount(String(initSettlement));
      setCommissionPercent(String(initCommPercent));
      setSupplierName(initialOrder.supplierName || "");
      setNotes(initialOrder.notes || "");
      setIsReturned(initialOrder.status === "RETURNED" || initialOrder.status === "RTO" || initialOrder.status === "CUSTOMER_RETURN" || initialOrder.status === "DAMAGED_RETURN");
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
      setUnitCost(String(initialProd?.currentCostPrice || 400));
      const defSellingPrice = initialProd ? Math.round(initialProd.currentCostPrice * 2.5) : 1000;
      setSellingPrice(String(defSellingPrice));
      setCommissionPercent("20");
      setSettlementAmount(String(Math.round(defSellingPrice * 0.8)));
      const initialSup = suppliers.find((s) => s.id === initialProd?.supplierId || s.name === initialProd?.supplierId);
      setSupplierName(initialSup ? initialSup.name : (suppliers[0]?.name || ""));
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

  // Synchronization Handlers (Commission % <-> Settlement Amount)
  const handleSellingPriceChange = (val: string) => {
    setSellingPrice(val);
    const pPrice = Math.max(0, parseFloat(val) || 0);
    const pQty = Math.max(1, parseFloat(quantity) || 1);
    const gSales = pPrice * pQty;
    const cPct = parseFloat(commissionPercent) || 0;
    setSettlementAmount(String(Math.round(gSales * (1 - cPct / 100))));
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const pPrice = Math.max(0, parseFloat(sellingPrice) || 0);
    const pQty = Math.max(1, parseFloat(val) || 1);
    const gSales = pPrice * pQty;
    const cPct = parseFloat(commissionPercent) || 0;
    setSettlementAmount(String(Math.round(gSales * (1 - cPct / 100))));
  };

  const handleCommissionPercentChange = (val: string) => {
    setCommissionPercent(val);
    const pPrice = Math.max(0, parseFloat(sellingPrice) || 0);
    const pQty = Math.max(1, parseFloat(quantity) || 1);
    const gSales = pPrice * pQty;
    const cPct = parseFloat(val) || 0;
    if (gSales > 0) {
      setSettlementAmount(String(Math.round(gSales * (1 - cPct / 100))));
    }
  };

  const handleSettlementAmountChange = (val: string) => {
    setSettlementAmount(val);
    const pPrice = Math.max(0, parseFloat(sellingPrice) || 0);
    const pQty = Math.max(1, parseFloat(quantity) || 1);
    const gSales = pPrice * pQty;
    const sAmt = parseFloat(val) || 0;
    if (gSales > 0) {
      const cPct = Math.max(0, Math.round(((gSales - sAmt) / gSales) * 100 * 10) / 10);
      setCommissionPercent(String(cPct));
    }
  };

  // Live Calculations
  const parsedQty = Math.max(1, parseFloat(quantity) || 1);
  const parsedUnitCost = Math.max(0, parseFloat(unitCost) || 0);
  const parsedSellingPrice = Math.max(0, parseFloat(sellingPrice) || 0);
  const grossSales = parsedQty * parsedSellingPrice;
  const parsedCommissionPercent = parseFloat(commissionPercent) || 0;
  const parsedSettlementPercent = Math.max(0, 100 - parsedCommissionPercent);
  const parsedSettlementAmount = parseFloat(settlementAmount) || Math.round(grossSales * (1 - parsedCommissionPercent / 100));
  const totalWholesaleCost = parsedQty * parsedUnitCost;
  const commissionDeduction = Math.max(0, grossSales - parsedSettlementAmount);
  const expectedSettlement = parsedSettlementAmount;
  const estimatedTrueProfit = expectedSettlement - totalWholesaleCost;

  const handleSelectSku = (skuValue: string) => {
    setSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setProductName(prod.name);
      setUnitCost(String(prod.currentCostPrice));
      const sPrice = Math.round(prod.currentCostPrice * 2.5);
      setSellingPrice(String(sPrice));
      const pQty = Math.max(1, parseFloat(quantity) || 1);
      const gSales = sPrice * pQty;
      const cPct = parseFloat(commissionPercent) || 20;
      setSettlementAmount(String(Math.round(gSales * (1 - cPct / 100))));
      if (prod.supplierId) {
        const sup = suppliers.find((s) => s.id === prod.supplierId || s.name === prod.supplierId);
        if (sup) {
          setSupplierName(sup.name);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "edit" && initialOrder) {
      const isNowReturned = isReturned;
      const updatedStatus: Order["status"] = isNowReturned
        ? returnType === "RTO"
          ? "RTO"
          : isDamagedClaim
          ? "CLAIM_PENDING"
          : "CUSTOMER_RETURN"
        : initialOrder.status === "RETURNED" || initialOrder.status === "RTO" || initialOrder.status === "CUSTOMER_RETURN" || initialOrder.status === "DAMAGED_RETURN"
        ? "DELIVERED"
        : initialOrder.status;

      const updatedOrder: Order = {
        ...initialOrder,
        channelOrderId: channelOrderId.trim() || initialOrder.channelOrderId,
        marketplace,
        orderDate,
        status: updatedStatus,
        customerName: initialOrder.customerName || "Customer",
        marketplaceChargesEstimate: commissionDeduction,
        settlementAmount: parsedSettlementAmount,
        settlementPercent: parsedSettlementPercent,
        commissionPercent: parsedCommissionPercent,
        supplierName: supplierName || undefined,
        supplierId: suppliers.find((s) => s.name === supplierName)?.id || initialOrder.supplierId,
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
            returnedQuantity: isNowReturned ? parsedQty : 0,
          },
          ...initialOrder.items.slice(1),
        ],
      };

      onUpdateOrder?.(updatedOrder);

      // If return is enabled in edit mode, log/update the return and optional claim
      if (isNowReturned && onAddReturn) {
        const retId = `RET-${Date.now().toString().slice(-4)}`;
        const parsedFee = parseFloat(returnFee) || 0;
        const parsedClaim = parseFloat(claimAmount) || 0;
        const parsedReimbursement = parseFloat(approvedReimbursement) || 0;

        if (isDamagedClaim && onAddClaim) {
          const claimId = `CLM-${Date.now().toString().slice(-4)}`;
          let mappedClaimStatus: Claim["status"] = "FILED";
          if (claimStatus === "Draft") mappedClaimStatus = "NOT_FILED";
          else if (claimStatus === "Approved") mappedClaimStatus = "APPROVED";
          else if (claimStatus === "Rejected") mappedClaimStatus = "REJECTED";

          const newClaim: Claim = {
            id: claimId,
            orderId: updatedOrder.id,
            returnId: retId,
            marketplace,
            claimType: returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
            claimDate: orderDate,
            amountClaimed: parsedClaim > 0 ? parsedClaim : parsedUnitCost * parsedQty,
            amountRecovered: parsedReimbursement,
            status: mappedClaimStatus,
            notes: `Claim from Order Edit (${returnType})`,
          };
          onAddClaim(newClaim);
        }

        const newReturnRecord = {
          id: retId,
          orderId: updatedOrder.id,
          channelOrderId: updatedOrder.channelOrderId,
          marketplace,
          returnDate: orderDate,
          returnType,
          returnReason: returnReason || "Return recorded via Order Edit",
          sku: sku || "CUSTOM-SKU",
          quantity: parsedQty,
          condition: isDamagedClaim ? ("DAMAGED" as const) : ("SELLABLE" as const),
          returnShippingCost: returnType === "RTO" ? 0 : Math.round(parsedFee * 0.6),
          customerReturnFee: returnType === "RTO" ? 0 : parsedFee,
          otherReturnCosts: 0,
          inventoryRecoveryValue: parsedReimbursement,
          lossAmount: returnType === "RTO" ? 0 : isDamagedClaim ? parsedFee : parsedFee,
        };

        onAddReturn(newReturnRecord);
      }

      // Optional settlement payout in edit mode
      if (parsedSettlementAmount > 0 && onAddSettlement && (!isNowReturned || returnType !== "RTO")) {
        const createdSettlement: Settlement = {
          id: `SETTLE-${Date.now().toString().slice(-4)}`,
          settlementBatchId: `BATCH-${Date.now().toString().slice(-4)}`,
          marketplace,
          settlementDate: orderDate,
          orderId: updatedOrder.id,
          grossAmount: grossSales,
          deductions: [
            {
              category: "COMMISSION",
              name: "Marketplace Commission",
              amount: commissionDeduction,
            },
          ],
          tcsTdsTax: 0,
          netSettlement: parsedSettlementAmount,
          reconciliationStatus: "RECONCILED",
          bankTxRef: `BANK-DEP-${updatedOrder.id.slice(-4)}`,
        };
        onAddSettlement(createdSettlement);
      }

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
      status: isReturned
        ? (returnType === "RTO" ? "RTO" : isDamagedClaim ? "CLAIM_PENDING" : "CUSTOMER_RETURN")
        : "DELIVERED",
      customerName: "Direct Buyer",
      customerCity: "Mumbai",
      customerState: "Maharashtra",
      shippingFeeCharged: 0,
      marketplaceChargesEstimate: commissionDeduction,
      settlementAmount: parsedSettlementAmount,
      settlementPercent: parsedSettlementPercent,
      commissionPercent: parsedCommissionPercent,
      supplierName: supplierName || undefined,
      supplierId: suppliers.find((s) => s.name === supplierName)?.id,
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
    if (parsedSettlementAmount > 0 && onAddSettlement && (!isReturned || returnType !== "RTO")) {
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
        ],
        tcsTdsTax: 0,
        netSettlement: parsedSettlementAmount,
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
        customerReturnFee: (returnType === 'RTO') ? 0 : parsedFee,
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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              {mode === "edit" ? "Edit order" : "Add new order"}
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              {mode === "edit"
                ? `Order ID: ${initialOrder?.id} · Ref: ${channelOrderId || initialOrder?.channelOrderId || "N/A"}`
                : "Enter order details to sync inventory, COGS liabilities, and expected settlements."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order dialog"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer shrink-0"
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
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                Marketplace channel
              </label>
              <FormMarketplaceDropdown
                selected={marketplace}
                onChange={(mp, estComm) => {
                  setMarketplace(mp);
                  const comm = estComm > 0 ? estComm : 20;
                  setCommissionPercent(String(comm));
                  const pPrice = Math.max(0, parseFloat(sellingPrice) || 0);
                  const pQty = Math.max(1, parseFloat(quantity) || 1);
                  setSettlementAmount(String(Math.round(pPrice * pQty * (1 - comm / 100))));
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  {mode === "edit" ? "Channel reference #" : "Order / reference #"}
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
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Transaction date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Product & Item Details */}
          <div className="space-y-3 pt-2 border-t border-black/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  SKU / item code
                </label>
                <input
                  type="text"
                  list="order-modal-catalog-skus"
                  value={sku}
                  onChange={(e) => handleSelectSku(e.target.value)}
                  placeholder="e.g. ELEC-WEM-01"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
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
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Product title / name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Wireless Ergonomic Mouse"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium transition-all"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums text-center transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Wholesale Cost (COGS) Card */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Wholesale cost (COGS)
              </span>
              <span className="text-xs font-medium text-[#86868B]">
                Total COGS: <span className="text-[#1D1D1F] font-semibold tabular-nums">{formatINR(totalWholesaleCost)}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Wholesale supplier
                </label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium cursor-pointer transition-all"
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
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Unit purchase cost (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={unitCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Platform Pricing & Settlement Card */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Platform financials &amp; settlement
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Unit selling price (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleSellingPriceChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={commissionPercent}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleCommissionPercentChange(e.target.value)}
                  placeholder="20"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Settlement amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={settlementAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleSettlementAmountChange(e.target.value)}
                  placeholder="750"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                />
              </div>
            </div>

            {/* Live Financial Breakdown Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/[0.06] text-xs">
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Gross sales</span>
                <span className="font-semibold text-[#1D1D1F] tabular-nums tracking-tight">
                  {formatINR(grossSales)}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Est. platform fee</span>
                <span className="font-semibold text-[#D70015] tabular-nums tracking-tight">
                  −{formatINR(commissionDeduction)}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Expected payout</span>
                <span className="font-semibold text-[#0071E3] tabular-nums tracking-tight">
                  {formatINR(expectedSettlement)}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Est. true profit</span>
                <span
                  className={`font-semibold tabular-nums tracking-tight ${
                    estimatedTrueProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                  }`}
                >
                  {formatINR(estimatedTrueProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Mark as Returned / RTO Order */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm border border-black/[0.06] space-y-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReturned}
                onChange={(e) => setIsReturned(e.target.checked)}
                className="w-4 h-4 rounded text-[#1D1D1F] focus:ring-black border-black/20 accent-[#1D1D1F] cursor-pointer"
              />
              <span className="font-semibold text-xs text-[#1D1D1F]">
                Mark as returned / RTO order
              </span>
            </label>

            {isReturned && (
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Return type
                    </label>
                    <select
                      value={returnType}
                      onChange={(e) => setReturnType(e.target.value as ReturnType)}
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black cursor-pointer font-medium"
                    >
                      <option value="CUSTOMER_RETURN">Customer Return (Delivered &amp; Returned)</option>
                      <option value="RTO">RTO (Undelivered / Doorstep Rejection)</option>
                      <option value="DAMAGED_RETURN">Damaged Return</option>
                      <option value="LOST_RETURN">Lost in Transit</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Return fee / logistics deduction (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={returnFee}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setReturnFee(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Return reason / notes
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. wrong size, damaged packaging"
                    className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Damaged Claim Sub-Card */}
                <div className="p-3.5 rounded-xl border border-[#B25E00]/20 bg-[#B25E00]/5 space-y-3">
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
                      className="w-4 h-4 rounded text-[#B25E00] focus:ring-[#B25E00] border-[#B25E00]/40 accent-[#B25E00] cursor-pointer"
                    />
                    <span className="font-semibold text-xs text-[#B25E00]">
                      Returned product is damaged / defective (file SAFE-T claim)
                    </span>
                  </label>

                  {isDamagedClaim && (
                    <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Claim amount filed
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={claimAmount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setClaimAmount(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Claim status
                        </label>
                        <select
                          value={claimStatus}
                          onChange={(e) =>
                            setClaimStatus(
                              e.target.value as "Draft" | "Filed" | "Approved" | "Rejected"
                            )
                          }
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold cursor-pointer shadow-2xs"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Filed">Filed</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Approved reimbursement
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={approvedReimbursement}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setApprovedReimbursement(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold shadow-2xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. General Order Notes */}
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              General order notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record packaging conditions, tracking numbers, or transaction notes..."
              className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {/* Sticky Actions Footer */}
          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between gap-3">
            <div className="text-xs text-[#86868B]">
              <span className="font-semibold text-[#1D1D1F]">{parsedQty} unit{parsedQty === 1 ? "" : "s"}</span>
              <span className="mx-1.5 text-black/20">·</span>
              <span>Gross: <strong className="text-[#1D1D1F] tabular-nums font-semibold">{formatINR(grossSales)}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-xs font-medium shadow-apple-sm btn-press transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition cursor-pointer"
              >
                {mode === "edit" ? "Update order" : "Submit order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
