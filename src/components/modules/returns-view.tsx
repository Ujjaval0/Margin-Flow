"use client";

import React, { useState } from "react";
import {
  ReturnRecord,
  ReturnType,
  ProductCondition,
  Marketplace,
  Claim,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

interface ReturnsViewProps {
  selectedMarketplace: Marketplace | "ALL";
}

export function ReturnsView({ selectedMarketplace }: ReturnsViewProps) {
  const { returns, orders, addReturn, addClaim } = usePlatform();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || "");
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [condition, setCondition] = useState<ProductCondition>("SELLABLE");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("Defective sound in right speaker");
  const [returnShipping, setReturnShipping] = useState(70);
  const [recoveryValue, setRecoveryValue] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const filteredReturns = returns.filter(
    (r) => selectedMarketplace === "ALL" || r.marketplace === selectedMarketplace
  );

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const order = orders.find((o) => o.id === selectedOrderId);
    if (!order) return;

    const item = order.items[0];
    if (!item) return;

    if (quantity > item.quantity) {
      setValidationError(
        `Quantity (${quantity}) exceeds original ordered units (${item.quantity}). Over-return rejected.`
      );
      return;
    }

    const retId = `RET-${Date.now().toString().slice(-4)}`;
    const cost = item.snapshotUnitCost * quantity;

    let calculatedLoss = returnShipping;
    if (condition === "DAMAGED" || condition === "UNUSABLE") {
      calculatedLoss += cost - recoveryValue;
    }

    const newReturn: ReturnRecord = {
      id: retId,
      orderId: order.id,
      channelOrderId: order.channelOrderId,
      marketplace: order.marketplace,
      returnDate: new Date().toISOString().split("T")[0],
      returnType,
      returnReason: reason,
      sku: item.sku,
      quantity,
      condition,
      returnShippingCost: returnShipping,
      otherReturnCosts: 10,
      inventoryRecoveryValue: recoveryValue,
      lossAmount: calculatedLoss,
    };

    addReturn(newReturn);

    if (condition === "DAMAGED" || returnType === "LOST_RETURN") {
      const claimId = `CLM-${Date.now().toString().slice(-4)}`;
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
        notes: `Automated dispute claim triggered for ${retId} (${condition}).`,
      };
      addClaim(newClaim);
    }

    setIsCreateOpen(false);
  };

  const columns: ColumnDef<ReturnRecord>[] = [
    {
      accessorKey: "id",
      header: "Return / Order",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-bold text-amber-700 block text-xs">
            {row.original.id}
          </span>
          <span className="font-mono text-[11px] text-blue-600 font-medium">
            {row.original.orderId}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "marketplace",
      header: "Channel",
      cell: ({ row }) => (
        <span className="text-xs text-slate-800 font-semibold">
          {row.original.marketplace}
        </span>
      ),
    },
    {
      accessorKey: "returnType",
      header: "Type",
      cell: ({ row }) => {
        const t = row.original.returnType;
        const color =
          t === "RTO"
            ? "bg-amber-100 text-amber-900 border border-amber-200"
            : t === "DAMAGED_RETURN"
            ? "bg-rose-100 text-rose-900 border border-rose-200"
            : "bg-slate-100 text-slate-800 border border-slate-200";
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
            {t.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      accessorKey: "condition",
      header: "Inspection State",
      cell: ({ row }) => {
        const c = row.original.condition;
        const isSellable = c === "SELLABLE";
        return (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isSellable
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {isSellable ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>{c}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: "SKU / Units",
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-slate-900 font-semibold text-xs block">{row.original.sku}</span>
          <span className="text-[11px] text-slate-500 font-medium">Units: {row.original.quantity}</span>
        </div>
      ),
    },
    {
      accessorKey: "returnShippingCost",
      header: "Freight Cost",
      cell: ({ row }) => (
        <span className="text-xs text-slate-700 font-mono font-medium">
          {formatINR(row.original.returnShippingCost)}
        </span>
      ),
    },
    {
      accessorKey: "lossAmount",
      header: "Net Loss Write-off",
      cell: ({ row }) => (
        <span className="font-bold text-xs text-rose-600">
          {formatINR(row.original.lossAmount)}
        </span>
      ),
    },
    {
      accessorKey: "claimId",
      header: "Dispute Status",
      cell: ({ row }) => {
        const claimId = row.original.claimId;
        return claimId ? (
          <span className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            {claimId}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">No Claim</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Returns & Reverse Logistics (RTO)
          </h1>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Physical inspection, salvage valuation, partial return tracking, and automated claim escalation.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>Log Return</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredReturns}
        searchKey="sku"
        searchPlaceholder="Search by SKU, return ID, order..."
      />

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">Log Reverse Logistics Event</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateReturn} className="p-6 space-y-4 text-xs">
              {validationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium">
                  {validationError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Order</label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} ({o.marketplace}) - {o.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Return Type</label>
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value as ReturnType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="CUSTOMER_RETURN">Customer Return</option>
                    <option value="RTO">RTO (Undelivered)</option>
                    <option value="DAMAGED_RETURN">Damaged Return</option>
                    <option value="LOST_RETURN">Lost in Transit</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Inspection State</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ProductCondition)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="SELLABLE">Sellable (Restock)</option>
                    <option value="DAMAGED">Damaged (Scrap)</option>
                    <option value="USED">Used / Opened</option>
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
                  <label className="font-semibold text-slate-700 block mb-1">Freight (₹)</label>
                  <input
                    type="number"
                    value={returnShipping}
                    onChange={(e) => setReturnShipping(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Scrap (₹)</label>
                  <input
                    type="number"
                    value={recoveryValue}
                    onChange={(e) => setRecoveryValue(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Inspection Remarks</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-1.5 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-sm"
                >
                  Commit Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
