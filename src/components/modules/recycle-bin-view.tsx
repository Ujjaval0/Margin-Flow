"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { usePlatform } from "@/domain/store";
import { Trash2, RotateCcw, AlertTriangle, Package, ShoppingCart, ReceiptText, RotateCcwSquare, Clock } from "lucide-react";

type RecycleBinTab = "orders" | "returns" | "claims" | "expenses" | "products";

interface DeletedRecord {
  id: string;
  displayId: string;
  type: RecycleBinTab;
  label: string;
  sublabel: string;
  deletedAt: string;
  daysRemaining: number;
}

const TAB_CONFIG: { id: RecycleBinTab; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { id: "orders",   label: "Orders",   icon: ShoppingCart,     color: "text-indigo-600", bg: "bg-indigo-500/10" },
  { id: "returns",  label: "Returns",  icon: RotateCcwSquare,  color: "text-amber-600",  bg: "bg-amber-500/10"  },
  { id: "claims",   label: "Claims",   icon: AlertTriangle,    color: "text-rose-600",   bg: "bg-rose-500/10"   },
  { id: "expenses", label: "Expenses", icon: ReceiptText,      color: "text-violet-600", bg: "bg-violet-500/10" },
  { id: "products", label: "Products", icon: Package,          color: "text-teal-600",   bg: "bg-teal-500/10"   },
];

const RECOVERY_DAYS = 7;

export function RecycleBinView() {
  const { restoreArchivedRecord, currentUser } = usePlatform();
  const [activeTab, setActiveTab] = useState<RecycleBinTab>("orders");
  const [restoring, setRestoring] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const loadRecords = useCallback(async () => {
    const response = await fetch("/api/recycle-bin", { credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.success !== true) throw new Error("Recycle bin temporarily unavailable.");
    return result.records as DeletedRecord[];
  }, []);
  useEffect(() => {
    let active = true;
    setRecords([]);
    loadRecords().then(rows => { if (active) setRecords(rows); }).catch(error => { if (active) setToastMessage(error.message); });
    return () => { active = false; };
  }, [loadRecords, currentUser.id]);
  const deletedRecords = useMemo(() => records.filter(record => record.type === activeTab), [records, activeTab]);
  const tabCounts = useMemo(() => Object.fromEntries(TAB_CONFIG.map(tab => [tab.id, records.filter(record => record.type === tab.id).length])) as Record<RecycleBinTab, number>, [records]);
  const totalDeleted = records.length;
  const handleRestore = async (record: DeletedRecord) => {
    if (restoring.has(record.id)) return;
    setRestoring(previous => new Set([...previous, record.id]));
    try {
      await restoreArchivedRecord(record.id);
      setRecords(previous => previous.filter(row => row.id !== record.id));
      setToastMessage(record.displayId + " restored successfully");
    } catch (error) { setToastMessage(error instanceof Error ? error.message : "Recovery failed. Please retry."); }
    finally { setRestoring(previous => { const next = new Set(previous); next.delete(record.id); return next; }); }
  };

  const urgencyColor = (days: number) => {
    if (days <= 2) return "text-[#D70015]";
    if (days <= 4) return "text-[#B25E00]";
    return "text-[#86868B]";
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] border border-black/[0.06] flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-[#1D1D1F]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
              Recycle Bin
            </h1>
            <p className="text-xs sm:text-sm text-[#86868B] mt-1">
              Restorable Archival Ledger &amp; Soft-Deleted Records
            </p>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Toast */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-apple-sm animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            {toastMessage}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs ml-3 font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-3 flex items-start gap-3">
        <Clock className="w-4 h-4 text-[#B25E00] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#B25E00]">7-day recovery window</p>
          <p className="text-[11px] text-[#86868B] mt-0.5">
            Records can be restored for 7 days. Related records are recovered together; newer edits must be reconciled before recovery.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-[#F1F3F5] p-1 rounded-2xl border border-black/[0.05] inline-flex items-center gap-0.5 text-xs flex-wrap">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
                isActive
                  ? "bg-white text-[#1D1D1F] shadow-apple-sm font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isActive ? tab.bg : "bg-transparent"}`}>
                <Icon className={`w-3 h-3 ${isActive ? tab.color : "text-[#86868B]"}`} strokeWidth={1.8} />
              </div>
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive ? "bg-black/[0.05] text-[#1D1D1F]" : "bg-black/[0.04] text-[#6E6E73]"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-apple-sm overflow-hidden">
        {deletedRecords.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5 text-[#86868B]" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-[#1D1D1F]">No deleted {activeTab}</p>
            <p className="text-xs text-[#86868B] mt-1">
              {TAB_CONFIG.find((t) => t.id === activeTab)?.label} you delete will appear here for 7 days.
            </p>
          </div>
        ) : (
          <>
            {/* Column Headers */}
            <div className="px-4 py-2.5 border-b border-black/[0.05] grid grid-cols-[1fr_1fr_auto_auto] gap-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wide">
              <span>Record</span>
              <span>Details</span>
              <span>Deleted</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-black/[0.04]">
              {deletedRecords.map((record) => (
                <div
                  key={record.id}
                  className="px-4 py-3 grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center hover:bg-[#FBFBFD] transition-colors"
                >
                  {/* Record ID */}
                  <div>
                    <p className="text-xs font-semibold text-[#1D1D1F]">{record.displayId}</p>
                    <p className="text-[11px] text-[#86868B] capitalize mt-0.5">{record.type.slice(0, -1)}</p>
                  </div>

                  {/* Details */}
                  <div>
                    <p className="text-[11px] text-[#1D1D1F] font-medium truncate">{record.label}</p>
                    <p className="text-[11px] text-[#86868B] truncate">{record.sublabel}</p>
                  </div>

                  {/* Time remaining */}
                  <div className="text-right">
                    <p className="text-[11px] text-[#86868B]">
                      {new Date(record.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    <p className={`text-[11px] font-semibold ${urgencyColor(record.daysRemaining)}`}>
                      {record.daysRemaining === 0
                        ? "Recovery expires today"
                        : `${record.daysRemaining}d left`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(record)}
                      disabled={restoring.has(record.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[11px] font-medium text-[#1D1D1F] transition active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Restore this record"
                    >
                      <RotateCcw className={`w-3 h-3 ${restoring.has(record.id) ? "animate-spin" : ""}`} />
                      {restoring.has(record.id) ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Empty state for entirely empty bin */}
      {totalDeleted === 0 && (
        <div className="text-center py-8">
          <p className="text-[11px] text-[#86868B]">
            When you delete an order, return, claim, expense, or product — it will appear here first.
            You have 7 days to restore it.
          </p>
        </div>
      )}
    </div>
  );
}
