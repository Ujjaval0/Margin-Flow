"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Settlement,
  Marketplace,
  DeductionCategory,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X, Clock, AlertCircle, CheckCircle2, ChevronRight, Banknote } from "lucide-react";
import { FormMarketplaceDropdown } from "@/components/ui/marketplace-dropdown";

interface SettlementsViewProps {
  selectedMarketplace?: Marketplace | "ALL";
}

export function SettlementsView({ selectedMarketplace: propMarketplace }: SettlementsViewProps = {}) {
  const { selectedMarketplace: contextMarketplace, settlements, orders, addSettlement, settlementAging } = usePlatform();
  const selectedMarketplace = propMarketplace ?? contextMarketplace;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [selectedAgingTab, setSelectedAgingTab] = useState<"ALL" | "0-7" | "8-14" | "14+">("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSettlement) setSelectedSettlement(null);
        else if (isCreateOpen) setIsCreateOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSettlement, isCreateOpen]);

  // New settlement state
  const [settlementBatchId, setSettlementBatchId] = useState("AZ-SEP-BATCH-02");
  const [marketplace, setMarketplace] = useState<Marketplace>("Amazon India");
  const [orderId, setOrderId] = useState(orders[0]?.id || "");
  const [grossAmount, setGrossAmount] = useState<number>(1000);
  const [commission, setCommission] = useState<number>(120);
  const [logistics, setLogistics] = useState<number>(65);
  const [fixedFee, setFixedFee] = useState<number>(25);
  const [returnFee, setReturnFee] = useState<number>(0);
  const [tcsTds, setTcsTds] = useState<number>(11);
  const [declaredNetPayout, setDeclaredNetPayout] = useState<number>(779);

  const filteredSettlements = settlements.filter(
    (s) => selectedMarketplace === "ALL" || s.marketplace === selectedMarketplace
  );

  const handleCreateSettlement = (e: React.FormEvent) => {
    e.preventDefault();

    const deductions = [
      { category: "COMMISSION" as DeductionCategory, name: "Marketplace Commission", amount: Number(commission) },
      { category: "LOGISTICS" as DeductionCategory, name: "Logistics Delivery Fee", amount: Number(logistics) },
      { category: "FIXED_FEE" as DeductionCategory, name: "Closing / Fixed Fee", amount: Number(fixedFee) },
    ];
    if (returnFee > 0) {
      deductions.push({
        category: "RETURN_SHIPPING" as DeductionCategory,
        name: "Reverse Return Fee",
        amount: Number(returnFee),
      });
    }

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const calculatedNet = grossAmount - totalDeductions - tcsTds;
    const isMatched = Math.abs(calculatedNet - declaredNetPayout) <= 0.05;

    const newSettlement: Settlement = {
      id: `SET-${Date.now().toString().slice(-4)}`,
      settlementBatchId,
      marketplace,
      settlementDate: new Date().toISOString().split("T")[0],
      orderId,
      grossAmount: Number(grossAmount),
      deductions,
      tcsTdsTax: Number(tcsTds),
      netSettlement: Number(declaredNetPayout),
      reconciliationStatus: isMatched ? "RECONCILED" : "MISMATCH_FLAGGED",
      discrepancyAmount: isMatched ? 0 : Math.round(Math.abs(calculatedNet - declaredNetPayout) * 100) / 100,
      bankTxRef: `CMS-HDFC-${Date.now().toString().slice(-6)}`,
    };

    addSettlement(newSettlement);
    setIsCreateOpen(false);
  };

  const columns: ColumnDef<Settlement>[] = [
    {
      accessorKey: "id",
      header: "Settlement / Batch",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-[#1D1D1F] block text-xs tracking-tight">
            {row.original.id}
          </span>
          <span className="text-[11px] text-[#86868B] tabular-nums">
            {row.original.settlementBatchId}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "marketplace",
      header: "Channel",
      cell: ({ row }) => (
        <span className="text-xs text-[#6E6E73] font-medium">
          {row.original.marketplace}
        </span>
      ),
    },
    {
      accessorKey: "orderId",
      header: "Linked Order",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
          {row.original.orderId}
        </span>
      ),
    },
    {
      accessorKey: "grossAmount",
      header: "Gross Payout",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
          {formatINR(row.original.grossAmount)}
        </span>
      ),
    },
    {
      id: "deductionsTotal",
      header: "Total Deductions",
      cell: ({ row }) => {
        const total = row.original.deductions.reduce((sum, d) => sum + d.amount, 0);
        return (
          <span className="text-sm font-semibold text-[#D70015] tracking-tight tabular-nums">
            -{formatINR(total)}
          </span>
        );
      },
    },
    {
      accessorKey: "tcsTdsTax",
      header: "TCS / TDS Withheld",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
          {formatINR(row.original.tcsTdsTax)}
        </span>
      ),
    },
    {
      accessorKey: "netSettlement",
      header: "Bank Deposit",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
          {formatINR(row.original.netSettlement)}
        </span>
      ),
    },
    {
      accessorKey: "reconciliationStatus",
      header: "Reconciliation",
      cell: ({ row }) => {
        const isReconciled = row.original.reconciliationStatus === "RECONCILED";
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isReconciled ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-[#1D1D1F] font-medium">
              {isReconciled ? "Balanced" : "Flagged"}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Detail",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <button
            onClick={() => setSelectedSettlement(s)}
            className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition"
          >
            Breakdown
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Marketplace Settlements
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold shadow-apple-sm transition active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>Record Settlement</span>
        </button>
      </div>

      {/* ─── Cash Flow Forensics: Settlement Aging Brackets ─── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
              Settlement Aging &amp; Cash Flow Pipeline
            </h2>
            <p className="text-[11px] text-[#86868B] mt-0.5">
              {settlementAging.totalUnsettledOrders} orders pending payout • Total Outstanding: {formatINR(settlementAging.totalOutstandingAmount)}
            </p>
          </div>
          <div className="bg-black/[0.04] p-1 rounded-full border border-black/[0.06] inline-flex items-center gap-1 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedAgingTab("ALL")}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                selectedAgingTab === "ALL"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setSelectedAgingTab("0-7")}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                selectedAgingTab === "0-7"
                  ? "bg-white text-emerald-800 font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              0–7 Days ({settlementAging.onSchedule.orderCount})
            </button>
            <button
              onClick={() => setSelectedAgingTab("8-14")}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                selectedAgingTab === "8-14"
                  ? "bg-white text-amber-800 font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              8–14 Days ({settlementAging.pending.orderCount})
            </button>
            <button
              onClick={() => setSelectedAgingTab("14+")}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                selectedAgingTab === "14+"
                  ? "bg-white text-rose-800 font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              &gt;14 Days Overdue ({settlementAging.overdue.orderCount})
            </button>
          </div>
        </div>

        {/* 3 Aging Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 0-7 Days: On Schedule */}
          <div
            onClick={() => setSelectedAgingTab(selectedAgingTab === "0-7" ? "ALL" : "0-7")}
            className={`apple-card p-5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
              selectedAgingTab === "0-7"
                ? "border-emerald-600/30 shadow-apple-md ring-1 ring-emerald-500/20"
                : "border-black/[0.06] shadow-apple-md hover:border-black/[0.12]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#86868B]">
                0–7 Days • Cycle Safe
              </span>
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-800 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block">
                {formatINR(settlementAging.onSchedule.totalEstimatedAmount)}
              </span>
              <span className="text-xs text-[#86868B] mt-0.5 block">
                {settlementAging.onSchedule.orderCount} orders on standard payout cycle
              </span>
            </div>
            <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[10px]">
              <span className="text-emerald-800 font-medium">Normal Processing</span>
              <ChevronRight className="w-3 h-3 text-[#86868B]" />
            </div>
          </div>

          {/* 8-14 Days: Pending */}
          <div
            onClick={() => setSelectedAgingTab(selectedAgingTab === "8-14" ? "ALL" : "8-14")}
            className={`apple-card p-5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
              selectedAgingTab === "8-14"
                ? "border-amber-600/30 shadow-apple-md ring-1 ring-amber-500/20"
                : "border-black/[0.06] shadow-apple-md hover:border-black/[0.12]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#86868B]">
                8–14 Days • Approaching Threshold
              </span>
              <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-800 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block">
                {formatINR(settlementAging.pending.totalEstimatedAmount)}
              </span>
              <span className="text-xs text-[#86868B] mt-0.5 block">
                {settlementAging.pending.orderCount} orders due in upcoming disbursement
              </span>
            </div>
            <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[10px]">
              <span className="text-amber-800 font-medium">Pending Next Settlement</span>
              <ChevronRight className="w-3 h-3 text-[#86868B]" />
            </div>
          </div>

          {/* >14 Days: Overdue */}
          <div
            onClick={() => setSelectedAgingTab(selectedAgingTab === "14+" ? "ALL" : "14+")}
            className={`apple-card p-5 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
              selectedAgingTab === "14+"
                ? "border-rose-600/30 shadow-apple-md ring-1 ring-rose-500/20"
                : "border-black/[0.06] shadow-apple-md hover:border-black/[0.12]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#86868B]">
                &gt; 14 Days • Delayed / Overdue
              </span>
              <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-800 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-2">
              <span className="text-xl font-semibold text-[#D70015] tracking-tight tabular-nums block">
                {formatINR(settlementAging.overdue.totalEstimatedAmount)}
              </span>
              <span className="text-xs text-[#86868B] mt-0.5 block">
                {settlementAging.overdue.orderCount} orders past normal payment window
              </span>
            </div>
            <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[10px]">
              <span className="text-rose-800 font-medium">Audit Required</span>
              <ChevronRight className="w-3 h-3 text-[#86868B]" />
            </div>
          </div>
        </div>

        {/* Selected Aging Tab Expanded Drawer */}
        {selectedAgingTab !== "ALL" && (
          <div className="apple-card p-4 rounded-2xl border border-black/[0.06] shadow-apple-md space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-black/[0.04]">
              <span className="font-semibold text-[#1D1D1F]">
                Orders in {selectedAgingTab === "0-7" ? "0–7 Days Bracket" : selectedAgingTab === "8-14" ? "8–14 Days Bracket" : "Overdue (>14 Days) Bracket"}
              </span>
              <button
                onClick={() => setSelectedAgingTab("ALL")}
                className="text-[#86868B] hover:text-[#1D1D1F] text-[11px] cursor-pointer"
              >
                Close breakdown ✕
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
              {(selectedAgingTab === "0-7"
                ? settlementAging.onSchedule.orders
                : selectedAgingTab === "8-14"
                ? settlementAging.pending.orders
                : settlementAging.overdue.orders
              ).map((ord) => (
                <div
                  key={ord.orderId}
                  className="p-2.5 rounded-xl bg-white border border-black/[0.04] flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-[#1D1D1F] tracking-tight tabular-nums block text-[11px]">
                      {ord.orderId} • {ord.channelOrderId}
                    </span>
                    <span className="text-[10px] text-[#86868B]">
                      {ord.marketplace} • Dispatched {ord.orderDate} ({ord.daysOutstanding} days ago)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums block">
                      {formatINR(ord.estimatedPayout)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        ord.daysOutstanding > 14
                          ? "text-rose-600"
                          : ord.daysOutstanding > 7
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {ord.daysOutstanding > 14 ? "Overdue" : "In Cycle"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredSettlements}
        searchKey="settlementBatchId"
        searchPlaceholder="Search settlement batch, ID, order..."
      />

      {/* Settlement Breakdown Drawer */}
      {mounted && selectedSettlement && createPortal(
        <div
          onClick={() => setSelectedSettlement(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-lg max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-[#FAFAFC]">
              <div>
                <span className="text-[11px] text-[#86868B] tabular-nums block">
                  {selectedSettlement.marketplace} • Batch: {selectedSettlement.settlementBatchId}
                </span>
                <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  Deduction Taxonomy: {selectedSettlement.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="p-4 bg-[#FAFAFC] rounded-2xl border border-black/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[#86868B] block">Net Bank Deposit</span>
                  <span className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums mt-0.5 block">
                    {formatINR(selectedSettlement.netSettlement)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#86868B] block">Gross Invoiced</span>
                  <span className="text-sm font-medium text-[#1D1D1F] tabular-nums mt-0.5 block">
                    {formatINR(selectedSettlement.grossAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight block px-1">
                  Itemized Marketplace Deductions
                </span>
                <div className="border border-black/[0.05] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
                  {selectedSettlement.deductions.map((d, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-[#1D1D1F]">{d.name}</span>
                        <span className="text-[10px] text-[#86868B] ml-2 font-medium">({d.category})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[#D70015] tabular-nums">
                          −{formatINR(d.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedSettlement(null)}
                className="px-6 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium transition-colors shadow-apple-sm btn-press cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Record Settlement Modal */}
      {mounted && isCreateOpen && createPortal(
        <div
          onClick={() => setIsCreateOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4.5 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-[#FAFAFC]">
              <div>
                <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Record Marketplace Deposit</h2>
                <p className="text-[11px] text-[#86868B]">Record incoming payout remittance and fee deductions.</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form id="record-settlement-form" onSubmit={handleCreateSettlement} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Batch ID</label>
                  <input
                    type="text"
                    value={settlementBatchId}
                    onChange={(e) => setSettlementBatchId(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Channel</label>
                  <FormMarketplaceDropdown
                    selected={marketplace}
                    onChange={(val) => setMarketplace(val)}
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Order</label>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} ({o.marketplace})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Gross Payout (₹)</label>
                  <input
                    type="number"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Commission (₹)</label>
                  <input
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Logistics (₹)</label>
                  <input
                    type="number"
                    value={logistics}
                    onChange={(e) => setLogistics(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Fixed Fee (₹)</label>
                  <input
                    type="number"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Tax (₹)</label>
                  <input
                    type="number"
                    value={tcsTds}
                    onChange={(e) => setTcsTds(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Net Bank Deposit Received (₹)
                </label>
                <input
                  type="number"
                  value={declaredNetPayout}
                  onChange={(e) => setDeclaredNetPayout(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-settlement-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm transition-colors btn-press cursor-pointer"
              >
                Record Settlement
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
