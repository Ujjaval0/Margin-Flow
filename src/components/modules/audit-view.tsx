"use client";

import React, { useRef, useState } from "react";
import { FinancialAuditLog } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Download, UploadCloud, RotateCcw, CheckCircle2, Database, ShieldCheck } from "lucide-react";

export function AuditView() {
  const {
    auditLogs,
    isHydrated,
    resetLedgerToDefaults,
    exportLedgerSnapshot,
    importLedgerSnapshot,
  } = usePlatform();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = () => {
    const jsonStr = exportLedgerSnapshot();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marginflow_ledger_snapshot_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Ledger snapshot exported successfully.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importLedgerSnapshot(content);
      if (success) {
        setStatusMessage("Ledger snapshot restored successfully!");
      } else {
        setStatusMessage("Error: Invalid ledger snapshot format.");
      }
      setTimeout(() => setStatusMessage(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset the ledger to default seed data? All custom modifications will be cleared.")) {
      resetLedgerToDefaults();
      setStatusMessage("Ledger has been reset to system defaults.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

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
      {/* Hidden file input for ledger restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-black/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
              Audit Trail & Persistent Ledger
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-3 h-3 text-emerald-600" />
              {isHydrated ? "Ledger Persisted" : "Hydrating..."}
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Tamper-resilient accounting ledger: mutations are recorded in immutable audit logs and synced to persistent storage.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-black/[0.08] hover:bg-black/[0.02] text-[#1D1D1F] transition-colors shadow-xs"
            title="Export full ledger state as JSON backup"
          >
            <Download className="w-3.5 h-3.5 text-[#86868B]" />
            Export Backup
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-black/[0.08] hover:bg-black/[0.02] text-[#1D1D1F] transition-colors shadow-xs"
            title="Import ledger state from JSON backup file"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#86868B]" />
            Restore Backup
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50/70 border border-red-200 hover:bg-red-100/70 text-red-700 transition-colors"
            title="Reset ledger to initial factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
            Reset Defaults
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-blue-50 text-blue-800 border border-blue-200 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={auditLogs}
        searchKey="entityId"
        searchPlaceholder="Filter audit records by entity or field..."
      />
    </div>
  );
}
