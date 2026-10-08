"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Claim, ClaimStatus, Marketplace } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate, formatPercent } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { X, ArrowDownRight, ShieldAlert, Trash2, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import type { ClaimCardType } from "@/components/modals/claim-breakdown-modal";

const ClaimBreakdownModal = dynamic(
  () => import("@/components/modals/claim-breakdown-modal").then((mod) => mod.ClaimBreakdownModal),
  { ssr: false }
);

interface ClaimsViewProps {
  selectedMarketplace?: Marketplace | "ALL";
}

export function ClaimsView({ selectedMarketplace: propMarketplace }: ClaimsViewProps = {}) {
  const { selectedMarketplace: contextMarketplace, claims, returns, addClaim, updateClaim, editClaim, deleteClaim, deleteClaims } = usePlatform();
  const selectedMarketplace = propMarketplace ?? contextMarketplace;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [isRecordRecoveryOpen, setIsRecordRecoveryOpen] = useState(false);
  const [activeBreakdownCard, setActiveBreakdownCard] = useState<ClaimCardType | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState<number>(0);
  const [resolutionStatus, setResolutionStatus] = useState<ClaimStatus>("RECOVERED");

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRecordRecoveryOpen) setIsRecordRecoveryOpen(false);
        if (isEditOpen) setIsEditOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordRecoveryOpen, isEditOpen]);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [editFields, setEditFields] = useState<{
    claimType: Claim["claimType"];
    claimDate: string;
    amountClaimed: number;
    amountRecovered: number;
    status: ClaimStatus;
    marketplace: Marketplace;
    notes: string;
  }>({
    claimType: "LOST_IN_TRANSIT",
    claimDate: "",
    amountClaimed: 0,
    amountRecovered: 0,
    status: "FILED",
    marketplace: "Amazon India",
    notes: "",
  });

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredClaims = claims.filter(
    (c) => selectedMarketplace === "ALL" || c.marketplace === selectedMarketplace
  );

  const [claimStatusFilter, setClaimStatusFilter] = useState<string>("ALL");
  const claimStatusOptions = [
    { id: "ALL", label: "All Claims" },
    { id: "FILED", label: "Filed" },
    { id: "IN_REVIEW", label: "In Review" },
    { id: "RECOVERED", label: "Recovered" },
    { id: "REJECTED", label: "Rejected" },
  ];

  const displayedClaims = filteredClaims.filter(
    (c) => claimStatusFilter === "ALL" || c.status === claimStatusFilter
  );

  const totalClaimed = filteredClaims.reduce((sum, c) => sum + c.amountClaimed, 0);
  const totalRecovered = filteredClaims.reduce((sum, c) => sum + c.amountRecovered, 0);
  const outstandingAmount = Math.max(0, totalClaimed - totalRecovered);
  const recoveryRate = totalClaimed > 0 ? totalRecovered / totalClaimed : 0;

  const handleOpenRecovery = (claim: Claim) => {
    setSelectedClaim(claim);
    setRecoveryAmount(claim.amountClaimed - claim.amountRecovered);
    setResolutionStatus("RECOVERED");
    setIsRecordRecoveryOpen(true);
  };

  const handleSubmitRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;

    updateClaim(selectedClaim.id, Number(recoveryAmount), resolutionStatus);
    setIsRecordRecoveryOpen(false);
    setSelectedClaim(null);
  };

  const handleOpenEdit = (claim: Claim) => {
    setEditingClaim(claim);
    setEditFields({
      claimType: claim.claimType,
      claimDate: claim.claimDate,
      amountClaimed: claim.amountClaimed,
      amountRecovered: claim.amountRecovered,
      status: claim.status,
      marketplace: claim.marketplace,
      notes: claim.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClaim) return;
    editClaim(editingClaim.id, {
      claimType: editFields.claimType,
      claimDate: editFields.claimDate,
      amountClaimed: Number(editFields.amountClaimed),
      amountRecovered: Number(editFields.amountRecovered),
      status: editFields.status,
      marketplace: editFields.marketplace,
      notes: editFields.notes || undefined,
    });
    setIsEditOpen(false);
    setEditingClaim(null);
  };

  // Selection helpers
  const allDisplayedIds = displayedClaims.map((c) => c.id);
  const allSelected = allDisplayedIds.length > 0 && allDisplayedIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allDisplayedIds));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (window.confirm(`Delete ${ids.length} selected claim${ids.length > 1 ? "s" : ""}?`)) {
      deleteClaims(ids);
      setSelectedIds(new Set());
    }
  };

  const marketplaceOptions: Marketplace[] = [
    "Amazon India",
    "Flipkart",
    "Meesho",
    "Personal Website",
    "Myntra",
    "WooCommerce",
    "B2B Wholesale",
    "Other",
  ];

  const claimTypeOptions: { value: Claim["claimType"]; label: string }[] = [
    { value: "LOST_IN_TRANSIT", label: "Lost in Transit" },
    { value: "DAMAGED_INVOICE", label: "Damaged Invoice" },
    { value: "WRONG_RETURN_ITEM", label: "Wrong Return Item" },
    { value: "FEE_DISPUTE", label: "Fee Dispute" },
  ];

  const statusOptions: { value: ClaimStatus; label: string }[] = [
    { value: "NOT_FILED", label: "Not Filed" },
    { value: "FILED", label: "Filed" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "PARTIALLY_RECOVERED", label: "Partially Recovered" },
    { value: "RECOVERED", label: "Recovered" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CLOSED", label: "Closed" },
  ];

  const columns: ColumnDef<Claim>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleSelectAll}
          className="w-3.5 h-3.5 accent-[#1D1D1F] cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleSelectRow(row.original.id)}
          className="w-3.5 h-3.5 accent-[#1D1D1F] cursor-pointer"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "id",
      header: "Claim / Order Ref",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-[#1D1D1F] block text-xs tracking-tight">
            {row.original.id}
          </span>
          <span className="text-[11px] text-[#86868B] tabular-nums">
            {row.original.orderId}
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
      accessorKey: "claimType",
      header: "Dispute Nature",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-[#1D1D1F]">
          {row.original.claimType.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "claimDate",
      header: "Filed Date",
      cell: ({ row }) => (
        <span className="text-xs text-[#86868B] tabular-nums font-medium">
          {formatDate(row.original.claimDate)}
        </span>
      ),
    },
    {
      accessorKey: "amountClaimed",
      header: "Claimed Amount",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
          {formatINR(row.original.amountClaimed)}
        </span>
      ),
    },
    {
      accessorKey: "amountRecovered",
      header: "Recovered Cash",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
          {formatINR(row.original.amountRecovered)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const colorMap: Record<ClaimStatus, string> = {
          NOT_FILED: "bg-black/[0.04] text-[#6E6E73]",
          FILED: "bg-blue-500/10 text-blue-900",
          UNDER_REVIEW: "bg-amber-500/10 text-amber-900",
          APPROVED: "bg-emerald-500/10 text-emerald-900",
          PARTIALLY_RECOVERED: "bg-amber-500/15 text-amber-950",
          RECOVERED: "bg-emerald-500/15 text-emerald-950",
          REJECTED: "bg-rose-500/10 text-rose-900",
          CLOSED: "bg-black/[0.05] text-[#6E6E73]",
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${colorMap[status]}`}>
            {status.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const claim = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenRecovery(claim)}
              className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition cursor-pointer btn-press"
            >
              Record Credit
            </button>
            <button
              onClick={() => handleOpenEdit(claim)}
              className="p-1.5 rounded-full text-[#86868B] hover:text-[#0071E3] hover:bg-black/[0.04] transition cursor-pointer"
              title="Edit Claim"
              aria-label={`Edit claim ${claim.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete claim ${claim.id} for order ${claim.orderId}?`)) {
                  deleteClaim(claim.id);
                }
              }}
              className="p-1.5 rounded-full text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Delete Claim"
              aria-label={`Delete claim ${claim.id}`}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Claims & Dispute Recoveries
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Marketplace claims lifecycle: Amazon SAFE-T, lost transit cases, and reimbursement matching.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const unclaimed = returns.find(
              (r) => !r.claimId && (r.condition === "DAMAGED" || r.returnType === "DAMAGED_RETURN")
            ) || returns[0];
            if (unclaimed) {
              window.dispatchEvent(
                new CustomEvent("marginflow_open_dispute_modal", {
                  detail: { returnRecord: unclaimed },
                })
              );
            }
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-black/[0.02] border border-black/[0.08] text-xs font-semibold text-[#1D1D1F] transition shadow-apple-sm active:scale-[0.98] cursor-pointer shrink-0"
          title="Draft SAFE-T or marketplace dispute claim packet"
        >
          <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-[#0071E3]" />
          </div>
          <span>Draft Dispute Claim</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveBreakdownCard("disputedAmount")}
          className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Disputed Amount</span>
            <span className="text-[10px] text-[#0071E3] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight tabular-nums">{formatINR(totalClaimed)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{filteredClaims.length} disputes filed</span>
        </div>
        <div
          onClick={() => setActiveBreakdownCard("recoveredReimbursements")}
          className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Recovered Reimbursements</span>
            <span className="text-[10px] text-[#0071E3] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#288548] mt-1 tracking-tight tabular-nums">{formatINR(totalRecovered)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Credited to bank</span>
        </div>
        <div
          onClick={() => setActiveBreakdownCard("outstandingBalance")}
          className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Outstanding Balance</span>
            <span className="text-[10px] text-[#0071E3] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight tabular-nums">{formatINR(outstandingAmount)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Pending approval</span>
        </div>
        <div
          onClick={() => setActiveBreakdownCard("recoveryRate")}
          className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md cursor-pointer group active:scale-[0.99] relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Recovery Rate</span>
            <span className="text-[10px] text-[#0071E3] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Breakdown &rarr;
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight tabular-nums">{formatPercent(recoveryRate)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Resolution efficiency</span>
        </div>
      </div>

      {/* Claims Status Filter Capsule */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-0.5">
        <div className="bg-black/[0.04] p-1 rounded-full border border-black/[0.06] inline-flex items-center gap-1 text-xs">
          {claimStatusOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setClaimStatusFilter(opt.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                claimStatusFilter === opt.id
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
              }`}
            >
              {opt.label}
              {opt.id !== "ALL" && (
                <span className="ml-1 text-[11px] opacity-70">
                  ({filteredClaims.filter((c) => c.status === opt.id).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk delete toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl shadow-apple-sm">
          <span className="text-xs font-medium text-rose-900">
            {selectedIds.size} claim{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-apple-sm btn-press"
          >
            <Trash2 className="w-3 h-3" />
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-[11px] text-rose-700 hover:text-rose-900 font-medium transition cursor-pointer"
          >
            Clear selection
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={displayedClaims}
        searchKey="id"
        searchPlaceholder="Search claims by ID, order..."
      />

      {/* Record Recovery Modal */}
      {mounted && isRecordRecoveryOpen && selectedClaim && createPortal(
        <div
          onClick={() => setIsRecordRecoveryOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4.5 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-[#FAFAFC]">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Record Recovery Credit: {selectedClaim.id}
              </h2>
              <button
                onClick={() => setIsRecordRecoveryOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form id="record-recovery-form" onSubmit={handleSubmitRecovery} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="p-4 bg-[#FAFAFC] rounded-2xl border border-black/[0.04] space-y-2">
                <div className="flex justify-between text-[#6E6E73] items-center">
                  <span>Claimed:</span>
                  <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">{formatINR(selectedClaim.amountClaimed)}</span>
                </div>
                <div className="flex justify-between text-[#6E6E73] items-center">
                  <span>Already Recovered:</span>
                  <span className="text-sm font-semibold text-[#288548] tracking-tight tabular-nums">{formatINR(selectedClaim.amountRecovered)}</span>
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Reimbursed Credit Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedClaim.amountClaimed}
                  value={recoveryAmount}
                  onChange={(e) => setRecoveryAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as ClaimStatus)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  <option value="RECOVERED">Recovered (100% Resolved)</option>
                  <option value="PARTIALLY_RECOVERED">Partially Recovered</option>
                  <option value="REJECTED">Rejected by Marketplace</option>
                  <option value="CLOSED">Closed Without Recovery</option>
                </select>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsRecordRecoveryOpen(false)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-recovery-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm transition-colors btn-press cursor-pointer"
              >
                Commit Credit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Claim Modal */}
      {mounted && isEditOpen && editingClaim && createPortal(
        <div
          onClick={() => setIsEditOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4.5 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-[#FAFAFC]">
              <h2 className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Edit Claim: {editingClaim.id}
              </h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form id="edit-claim-form" onSubmit={handleSubmitEdit} className="p-6 space-y-3 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Channel</label>
                  <select
                    value={editFields.marketplace}
                    onChange={(e) => setEditFields((f) => ({ ...f, marketplace: e.target.value as Marketplace }))}
                    className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  >
                    {marketplaceOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Filed Date</label>
                  <input
                    type="date"
                    value={editFields.claimDate}
                    onChange={(e) => setEditFields((f) => ({ ...f, claimDate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-[#1D1D1F]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Dispute Nature</label>
                <select
                  value={editFields.claimType}
                  onChange={(e) => setEditFields((f) => ({ ...f, claimType: e.target.value as Claim["claimType"] }))}
                  className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  {claimTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Claimed Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editFields.amountClaimed}
                    onChange={(e) => setEditFields((f) => ({ ...f, amountClaimed: Number(e.target.value) }))}
                    className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Recovered Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editFields.amountRecovered}
                    onChange={(e) => setEditFields((f) => ({ ...f, amountRecovered: Number(e.target.value) }))}
                    className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Status</label>
                <select
                  value={editFields.status}
                  onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value as ClaimStatus }))}
                  className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Notes</label>
                <textarea
                  value={editFields.notes}
                  onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 resize-none"
                  placeholder="Optional notes..."
                />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-1.5 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-claim-form"
                className="px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm transition-colors btn-press cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Card Breakdown Modal */}
      {activeBreakdownCard && (
        <ClaimBreakdownModal
          cardType={activeBreakdownCard}
          onClose={() => setActiveBreakdownCard(null)}
          claims={filteredClaims}
          onSelectFilter={(status) => {
            setClaimStatusFilter(status);
            setActiveBreakdownCard(null);
          }}
        />
      )}
    </div>
  );
}
