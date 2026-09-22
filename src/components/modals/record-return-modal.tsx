"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import { Order, ReturnRecord, Claim, ReturnType, ProductCondition } from "@/domain/types";

export interface RecordReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onAddReturn: (ret: ReturnRecord) => void;
  onAddClaim?: (claim: Claim) => void;
}

export function RecordReturnModal({
  isOpen,
  onClose,
  orders,
  onAddReturn,
  onAddClaim,
}: RecordReturnModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [returnOrderId, setReturnOrderId] = useState(orders[0]?.id || "");
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [returnCondition, setReturnCondition] = useState<ProductCondition>("SELLABLE");
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState("Defective item received by customer");
  const [returnShipping, setReturnShipping] = useState(70);
  const [customerReturnFee, setCustomerReturnFee] = useState(50);
  const [returnRecovery, setReturnRecovery] = useState(0);
  const [returnError, setReturnError] = useState<string | null>(null);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
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
    const fee = returnType === "RTO" ? 0 : Number(customerReturnFee);
    const calculatedLoss = returnType === "RTO" ? 0 : fee;

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
      customerReturnFee: fee,
      otherReturnCosts: 0,
      inventoryRecoveryValue: Number(returnRecovery),
      lossAmount: calculatedLoss,
    };

    onAddReturn(newRet);

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
      onAddClaim?.(newClaim);
    }

    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
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
              <p className="text-xs text-slate-500">
                Log reverse logistics shipping, parcel rejection, or damaged items.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Return Qty</label>
              <input
                type="number"
                min="1"
                value={returnQty}
                onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Freight (₹)</label>
              <input
                type="number"
                min="0"
                value={returnShipping}
                onChange={(e) => setReturnShipping(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Return Fee (₹)</label>
              <input
                type="number"
                min="0"
                disabled={returnType === "RTO"}
                value={returnType === "RTO" ? 0 : customerReturnFee}
                onChange={(e) => setCustomerReturnFee(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                title={returnType === "RTO" ? "No customer return fee for RTO orders" : undefined}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Scrap (₹)</label>
              <input
                type="number"
                min="0"
                value={returnRecovery}
                onChange={(e) => setReturnRecovery(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
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
              onClick={onClose}
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
    </div>,
    document.body
  );
}
