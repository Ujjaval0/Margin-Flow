"use client";

import React, { useState } from "react";
import { Claim, ClaimStatus, Marketplace } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate, formatPercent } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { X, ArrowDownRight } from "lucide-react";

interface ClaimsViewProps {
  selectedMarketplace: Marketplace | "ALL";
}

export function ClaimsView({ selectedMarketplace }: ClaimsViewProps) {
  const { claims, addClaim, updateClaim } = usePlatform();

  const [isRecordRecoveryOpen, setIsRecordRecoveryOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState<number>(0);
  const [resolutionStatus, setResolutionStatus] = useState<ClaimStatus>("RECOVERED");

  const filteredClaims = claims.filter(
    (c) => selectedMarketplace === "ALL" || c.marketplace === selectedMarketplace
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

  const columns: ColumnDef<Claim>[] = [
    {
      accessorKey: "id",
      header: "Claim / Order Ref",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-[#1D1D1F] block text-xs">
            {row.original.id}
          </span>
          <span className="font-mono text-[11px] text-[#86868B]">
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
        <span className="text-xs text-[#86868B]">
          {formatDate(row.original.claimDate)}
        </span>
      ),
    },
    {
      accessorKey: "amountClaimed",
      header: "Claimed Amount",
      cell: ({ row }) => (
        <span className="font-mono text-[#1D1D1F] text-xs">
          {formatINR(row.original.amountClaimed)}
        </span>
      ),
    },
    {
      accessorKey: "amountRecovered",
      header: "Recovered Cash",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#288548] text-xs">
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
          <button
            onClick={() => handleOpenRecovery(claim)}
            className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition"
          >
            Record Credit
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Claims & Dispute Recoveries
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Marketplace claims lifecycle: Amazon SAFE-T, lost transit cases, and reimbursement matching.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-xs text-[#86868B] font-medium">Disputed Amount</span>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{formatINR(totalClaimed)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">{filteredClaims.length} disputes filed</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-xs text-[#86868B] font-medium">Recovered Reimbursements</span>
          <div className="text-2xl font-semibold text-[#288548] mt-1 tracking-tight">{formatINR(totalRecovered)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Credited to bank</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-xs text-[#86868B] font-medium">Outstanding Balance</span>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{formatINR(outstandingAmount)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Pending approval</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <span className="text-xs text-[#86868B] font-medium">Recovery Rate</span>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 tracking-tight">{formatPercent(recoveryRate)}</div>
          <span className="text-[11px] text-[#86868B] mt-1 block">Resolution efficiency</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredClaims}
        searchKey="id"
        searchPlaceholder="Search claims by ID, order..."
      />

      {/* Record Recovery Modal */}
      {isRecordRecoveryOpen && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-black/[0.06] w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Record Recovery Credit: {selectedClaim.id}
              </h2>
              <button
                onClick={() => setIsRecordRecoveryOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitRecovery} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-[#FAFAFC] rounded-2xl border border-black/[0.04] space-y-1.5">
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Claimed:</span>
                  <span className="font-medium text-[#1D1D1F]">{formatINR(selectedClaim.amountClaimed)}</span>
                </div>
                <div className="flex justify-between text-[#6E6E73]">
                  <span>Already Recovered:</span>
                  <span className="font-semibold text-[#288548]">{formatINR(selectedClaim.amountRecovered)}</span>
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
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs font-mono font-medium focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Status</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as ClaimStatus)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                >
                  <option value="RECOVERED">Recovered (100% Resolved)</option>
                  <option value="PARTIALLY_RECOVERED">Partially Recovered</option>
                  <option value="REJECTED">Rejected by Marketplace</option>
                  <option value="CLOSED">Closed Without Recovery</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecordRecoveryOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[#6E6E73] hover:bg-black/[0.03] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                >
                  Commit Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
