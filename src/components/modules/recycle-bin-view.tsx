"use client";

import React, { useState, useMemo } from "react";
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

export function RecycleBinView() {
  const { orders, returns, claims, expenses, products } = usePlatform();
  const [activeTab, setActiveTab] = useState<RecycleBinTab>("orders");
  const [restoring, setRestoring] = useState<Set<string>>(new Set());

  const [demoDeleted, setDemoDeleted] = useState<Record<RecycleBinTab, DeletedRecord[]>>({
    orders: [
      {
        id: "ORD-DEL-101",
        displayId: "ORD-1014",
        type: "orders",
        label: "Amazon India · 402-8821948-2819201",
        sublabel: "CONFIRMED · 1x Wireless Mouse (₹949)",
        deletedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        daysRemaining: 28,
      },
      {
        id: "ORD-DEL-102",
        displayId: "ORD-0988",
        type: "orders",
        label: "Flipkart · OD49201948291029",
        sublabel: "DELIVERED · 2x 100W Cable (₹578)",
        deletedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        daysRemaining: 25,
      },
    ],
    returns: [
      {
        id: "RET-DEL-201",
        displayId: "RET-201",
        type: "returns",
        label: "Amazon India · ELEC-ANC-EB",
        sublabel: "DAMAGED_RETURN · Damaged in transit (₹825 loss)",
        deletedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        daysRemaining: 26,
      },
    ],
    claims: [
      {
        id: "CLM-DEL-301",
        displayId: "CLM-299",
        type: "claims",
        label: "Flipkart · FEE_DISPUTE",
        sublabel: "UNDER_REVIEW · ₹495 claimed",
        deletedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        daysRemaining: 23,
      },
    ],
    expenses: [
      {
        id: "EXP-DEL-401",
        displayId: "EXP-041",
        type: "expenses",
        label: "Packaging & Boxes · BoxCraft Logistics",
        sublabel: "₹3,200 · BANK_TRANSFER",
        deletedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
        daysRemaining: 18,
      },
    ],
    products: [
      {
        id: "PROD-DEL-501",
        displayId: "PROD-09",
        type: "products",
        label: "USB-A to Lightning Cable 1m (Legacy)",
        sublabel: "ELEC-LTG-01 · Discontinued",
        deletedAt: new Date(Date.now() - 16 * 86400000).toISOString(),
        daysRemaining: 14,
      },
    ],
  });

  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());

  const deletedRecords = useMemo((): DeletedRecord[] => {
    const today = Date.now();
    const RECOVERY_DAYS = 30;

    const toRecord = (
      id: string,
      displayId: string,
      type: RecycleBinTab,
      label: string,
      sublabel: string,
      deletedAt: string
    ): DeletedRecord => {
      const deletedMs = new Date(deletedAt).getTime();
      const daysElapsed = Math.floor((today - deletedMs) / 86400000);
      const daysRemaining = Math.max(0, RECOVERY_DAYS - daysElapsed);
      return { id, displayId, type, label, sublabel, deletedAt, daysRemaining };
    };

    let storeRecords: DeletedRecord[] = [];
    switch (activeTab) {
      case "orders":
        storeRecords = (orders as any[])
          .filter((o) => o.deletedAt)
          .map((o) =>
            toRecord(o.id, o.displayId ?? o.id, "orders",
              `${o.marketplace} · ${o.channelOrderId}`,
              o.status,
              o.deletedAt)
          );
        break;
      case "returns":
        storeRecords = (returns as any[])
          .filter((r) => r.deletedAt)
          .map((r) =>
            toRecord(r.id, r.displayId ?? r.id, "returns",
              `${r.marketplace} · ${r.sku}`,
              r.returnType,
              r.deletedAt)
          );
        break;
      case "claims":
        storeRecords = (claims as any[])
          .filter((c) => c.deletedAt)
          .map((c) =>
            toRecord(c.id, c.displayId ?? c.id, "claims",
              `${c.marketplace} · ${c.claimType}`,
              c.status,
              c.deletedAt)
          );
        break;
      case "expenses":
        storeRecords = (expenses as any[])
          .filter((e) => e.deletedAt)
          .map((e) =>
            toRecord(e.id, e.displayId ?? e.id, "expenses",
              `${e.category} · ${e.vendor}`,
              `₹${e.amount.toLocaleString("en-IN")}`,
              e.deletedAt)
          );
        break;
      case "products":
        storeRecords = (products as any[])
          .filter((p) => p.deletedAt)
          .map((p) =>
            toRecord(p.id, p.displayId ?? p.id, "products",
              `${p.name}`,
              p.sku,
              p.deletedAt)
          );
        break;
      default:
        storeRecords = [];
    }

    const demoForTab = (demoDeleted[activeTab] || []).filter((d) => !restoredIds.has(d.id));
    return [...storeRecords, ...demoForTab];
  }, [activeTab, orders, returns, claims, expenses, products, demoDeleted, restoredIds]);

  const tabCounts = useMemo(() => {
    return {
      orders:
        (orders as any[]).filter((o) => o.deletedAt).length +
        (demoDeleted.orders || []).filter((d) => !restoredIds.has(d.id)).length,
      returns:
        (returns as any[]).filter((r) => r.deletedAt).length +
        (demoDeleted.returns || []).filter((d) => !restoredIds.has(d.id)).length,
      claims:
        (claims as any[]).filter((c) => c.deletedAt).length +
        (demoDeleted.claims || []).filter((d) => !restoredIds.has(d.id)).length,
      expenses:
        (expenses as any[]).filter((e) => e.deletedAt).length +
        (demoDeleted.expenses || []).filter((d) => !restoredIds.has(d.id)).length,
      products:
        (products as any[]).filter((p) => p.deletedAt).length +
        (demoDeleted.products || []).filter((d) => !restoredIds.has(d.id)).length,
    };
  }, [orders, returns, claims, expenses, products, demoDeleted, restoredIds]);

  const totalDeleted = Object.values(tabCounts).reduce((a, b) => a + b, 0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRestore = (record: DeletedRecord) => {
    setRestoring((prev) => new Set([...prev, record.id]));
    setTimeout(() => {
      setRestoring((prev) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      setRestoredIds((prev) => new Set([...prev, record.id]));
      setToastMessage(`${record.displayId} (${record.label}) restored successfully`);
      setTimeout(() => setToastMessage(null), 3500);
    }, 600);
  };

  const urgencyColor = (days: number) => {
    if (days <= 3) return "text-[#D70015]";
    if (days <= 10) return "text-[#B25E00]";
    return "text-[#86868B]";
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-black/[0.04] border border-black/[0.06] flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-[#1D1D1F]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Recycle Bin</h1>
            <p className="text-[11px] text-[#86868B] mt-0.5">
              {totalDeleted === 0
                ? "No deleted records. All clear."
                : `${totalDeleted} deleted record${totalDeleted > 1 ? "s" : ""} · Permanent deletion after 30 days`}
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
          <p className="text-xs font-semibold text-[#B25E00]">30-day recovery window</p>
          <p className="text-[11px] text-[#86868B] mt-0.5">
            Deleted records are kept here for 30 days before being permanently purged. Restore any record with one click. Records showing 0 days will be purged tonight.
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
              {TAB_CONFIG.find((t) => t.id === activeTab)?.label} you delete will appear here for 30 days before permanent removal.
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
                        ? "Purges tonight"
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
            You have 30 days to restore it before it is permanently removed.
          </p>
        </div>
      )}
    </div>
  );
}
