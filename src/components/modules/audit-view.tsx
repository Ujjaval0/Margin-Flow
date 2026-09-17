"use client";

import React from "react";
import { FinancialAuditLog } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

export function AuditView() {
  const { auditLogs } = usePlatform();

  const columns: ColumnDef<FinancialAuditLog>[] = [
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      cell: ({ row }) => {
        const d = new Date(row.original.timestamp);
        return (
          <div className="text-xs">
            <span className="font-medium text-[#1D1D1F] block">
              {d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="text-[11px] text-[#86868B] font-mono">
              {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "entityType",
      header: "Entity Scope",
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/[0.04] text-[#1D1D1F]">
            {row.original.entityType}
          </span>
          <span className="text-[11px] font-mono text-[#6E6E73] block mt-0.5">
            {row.original.entityId}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "fieldName",
      header: "Field",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1D1D1F]">
          {row.original.fieldName}
        </span>
      ),
    },
    {
      id: "diff",
      header: "Transition (Old → New)",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-[#86868B] line-through">
            {row.original.oldValue}
          </span>
          <span className="text-[#86868B]">→</span>
          <span className="font-semibold text-[#1D1D1F]">
            {row.original.newValue}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "modifiedBy",
      header: "Operator",
      cell: ({ row }) => (
        <span className="text-xs text-[#1D1D1F]">
          {row.original.modifiedBy}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Justification",
      cell: ({ row }) => (
        <span className="text-xs text-[#6E6E73] line-clamp-1 max-w-[240px]">
          {row.original.reason || "Manual system update"}
        </span>
      ),
    },
    {
      accessorKey: "sourceDocumentId",
      header: "Source Doc",
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-[#86868B]">
          {row.original.sourceDocumentId || "Manual"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Audit Trail
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Statutory ledger logging: Every modification to settlements, cost prices, and recoveries is permanently timestamped.
          </p>
        </div>
        <div className="text-xs text-[#86868B] font-medium px-3 py-1 rounded-full bg-white border border-black/[0.06]">
          Tamper-Resilient Ledger
        </div>
      </div>

      <DataTable
        columns={columns}
        data={auditLogs}
        searchKey="entityId"
        searchPlaceholder="Filter audit records..."
      />
    </div>
  );
}
