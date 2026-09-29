"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Bell, X, ArrowRight, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { usePlatform } from "@/domain/store";
import Link from "next/link";

export interface AppNotification {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
  entityId?: string;
}

/** Derives live notifications purely from store data with full safety fallbacks. */
function useLiveNotifications(): AppNotification[] {
  const platform = usePlatform();

  const returns = platform?.returns || [];
  const orders = platform?.orders || [];
  const settlements = platform?.settlements || [];
  const products = platform?.products || [];
  const purchases = platform?.purchases || [];
  const aiDocuments = platform?.aiDocuments || [];

  return useMemo(() => {
    const notes: AppNotification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. CLAIM DEADLINE APPROACHING (≤ 3 days) ──────────────────────────
    returns.forEach((ret) => {
      if (!ret.claimDeadline) return;
      const deadline = new Date(ret.claimDeadline);
      deadline.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((deadline.getTime() - today.getTime()) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 3) {
        const amtStr = ret.lossAmount > 0 ? ` — ₹${ret.lossAmount.toLocaleString("en-IN")} at risk` : "";
        const returnLabel = (ret as any).displayId || ret.id;
        notes.push({
          id: `claim-deadline-${ret.id}`,
          type: "CLAIM_DEADLINE_APPROACHING",
          severity: daysLeft <= 1 ? "CRITICAL" : "WARNING",
          title: daysLeft === 0 ? "Claim deadline expires TODAY" : `Claim deadline in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
          body: `${returnLabel} (${ret.marketplace})${amtStr}. File your dispute before the window closes.`,
          actionUrl: "/claims",
          actionLabel: "Go to Claims",
          entityId: ret.id,
        });
      }
    });

    // ── 2. CLAIM DEADLINE OVERDUE ─────────────────────────────────────────
    returns.forEach((ret) => {
      if (!ret.claimDeadline) return;
      const deadline = new Date(ret.claimDeadline);
      deadline.setHours(0, 0, 0, 0);
      const daysOver = Math.round((today.getTime() - deadline.getTime()) / 86400000);
      if (daysOver > 0 && !ret.claimId) {
        const returnLabel = (ret as any).displayId || ret.id;
        notes.push({
          id: `claim-overdue-${ret.id}`,
          type: "CLAIM_DEADLINE_OVERDUE",
          severity: "CRITICAL",
          title: "Claim window expired — recovery lost",
          body: `${returnLabel} claim deadline passed ${daysOver} day${daysOver > 1 ? "s" : ""} ago with no claim filed. Loss: ₹${ret.lossAmount.toLocaleString("en-IN")}.`,
          actionUrl: "/returns",
          actionLabel: "View Returns",
          entityId: ret.id,
        });
      }
    });

    // ── 3. SETTLEMENT OVERDUE (delivered > 14 days, no settlement) ────────
    const settledOrderIds = new Set(settlements.map((s) => s.orderId));
    const overdueOrders = orders.filter((o) => {
      if (o.status !== "DELIVERED") return false;
      if (settledOrderIds.has(o.id)) return false;
      const orderDate = new Date(o.orderDate);
      const daysOld = Math.round((today.getTime() - orderDate.getTime()) / 86400000);
      return daysOld > 14;
    });
    if (overdueOrders.length > 0) {
      const total = overdueOrders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((s, i) => s + (i.sellingPrice || 0) * (i.quantity || 1), 0);
      }, 0);
      notes.push({
        id: "settlement-overdue",
        type: "SETTLEMENT_OVERDUE",
        severity: "WARNING",
        title: `${overdueOrders.length} settlement${overdueOrders.length > 1 ? "s" : ""} overdue`,
        body: `₹${total.toLocaleString("en-IN")} pending beyond 14 days with no matching payout recorded.`,
        actionUrl: "/settlements",
        actionLabel: "Review Settlements",
      });
    }

    // ── 4. LOW INVENTORY (stock < 10 units) ───────────────────────────────
    const lowStock = products.filter((p) => p.active && (p.stockQuantity ?? 0) < 10);
    lowStock.forEach((p) => {
      const stock = p.stockQuantity ?? 0;
      notes.push({
        id: `low-stock-${p.sku}`,
        type: "LOW_INVENTORY",
        severity: stock === 0 ? "CRITICAL" : "WARNING",
        title: stock === 0 ? "Out of stock" : `Low stock — ${stock} unit${stock !== 1 ? "s" : ""} left`,
        body: `${p.name} (${p.sku}) is running low. Reorder soon to avoid stockouts.`,
        actionUrl: "/products",
        actionLabel: "View Products",
        entityId: p.sku,
      });
    });

    // ── 5. RETURNS AWAITING INSPECTION (PENDING_RESTOCK > 3 days) ─────────
    returns.forEach((ret) => {
      if (ret.restockStatus !== "PENDING_RESTOCK") return;
      const retDate = new Date(ret.returnDate);
      const daysAgo = Math.round((today.getTime() - retDate.getTime()) / 86400000);
      if (daysAgo >= 3) {
        const returnLabel = (ret as any).displayId || ret.id;
        notes.push({
          id: `restock-pending-${ret.id}`,
          type: "RETURN_NEEDS_INSPECTION",
          severity: "INFO",
          title: "Return awaiting inspection",
          body: `${returnLabel} (${ret.sku}) has been in PENDING_RESTOCK for ${daysAgo} day${daysAgo > 1 ? "s" : ""}. Mark as restocked or written off.`,
          actionUrl: "/returns",
          actionLabel: "View Returns",
          entityId: ret.id,
        });
      }
    });

    // ── 6. AI DOCUMENTS PENDING REVIEW (> 0 staged docs) ─────────────────
    const pendingDocs = aiDocuments.filter((d) => d.status === "STAGED_NEEDS_REVIEW");
    if (pendingDocs.length > 0) {
      notes.push({
        id: "ai-docs-pending",
        type: "AI_DOCUMENT_PENDING",
        severity: "INFO",
        title: `${pendingDocs.length} document${pendingDocs.length > 1 ? "s" : ""} need review`,
        body: `${pendingDocs.length} uploaded document${pendingDocs.length > 1 ? "s" : ""} ${pendingDocs.length > 1 ? "are" : "is"} waiting for your approval in the AI Staging Sandbox.`,
        actionUrl: "/documents",
        actionLabel: "Open AI Staging",
      });
    }

    // ── 7. SUPPLIER PAYMENT OVERDUE ───────────────────────────────────────
    purchases.forEach((bill) => {
      if (bill.paymentStatus !== "PENDING") return;
      const invoiceDate = new Date(bill.invoiceDate);
      const daysOld = Math.round((today.getTime() - invoiceDate.getTime()) / 86400000);
      if (daysOld > 30) {
        const billLabel = (bill as any).displayId || bill.invoiceNumber || bill.id;
        notes.push({
          id: `supplier-overdue-${bill.id}`,
          type: "SUPPLIER_PAYMENT_DUE",
          severity: "WARNING",
          title: "Supplier payment overdue",
          body: `${billLabel} (${bill.supplierName}) — invoice dated ${bill.invoiceDate} is unpaid. ₹${bill.totalAmount.toLocaleString("en-IN")} outstanding.`,
          actionUrl: "/suppliers",
          actionLabel: "View Suppliers",
          entityId: bill.id,
        });
      }
    });

    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    notes.sort((a, b) => order[a.severity] - order[b.severity]);

    return notes;
  }, [returns, orders, settlements, products, purchases, aiDocuments]);
}

export function NotificationBell() {
  const notifications = useLiveNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | "CRITICAL" | "WARNING">("ALL");

  const visible = useMemo(() => {
    return notifications.filter((n) => {
      if (dismissedIds.has(n.id)) return false;
      if (filterSeverity === "CRITICAL") return n.severity === "CRITICAL";
      if (filterSeverity === "WARNING") return n.severity === "WARNING";
      return true;
    });
  }, [notifications, dismissedIds, filterSeverity]);

  const allVisibleCount = useMemo(() => {
    return notifications.filter((n) => !dismissedIds.has(n.id)).length;
  }, [notifications, dismissedIds]);

  const criticalCount = useMemo(() => {
    return notifications.filter((n) => !dismissedIds.has(n.id) && n.severity === "CRITICAL").length;
  }, [notifications, dismissedIds]);

  const warningCount = useMemo(() => {
    return notifications.filter((n) => !dismissedIds.has(n.id) && n.severity === "WARNING").length;
  }, [notifications, dismissedIds]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissedIds(new Set(notifications.map((n) => n.id)));
  };

  return (
    <>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative h-[34px] w-[34px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 ${
          isOpen
            ? "bg-[#1D1D1F] text-white border-transparent shadow-apple-md ring-2 ring-[#0071E3]/30"
            : "bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border-black/[0.08] shadow-apple-sm active:scale-[0.96]"
        }`}
        title="View Notifications"
        aria-label={`Notifications${allVisibleCount > 0 ? ` (${allVisibleCount} active)` : ""}`}
      >
        <Bell className={`w-4 h-4 ${isOpen ? "text-white" : "text-[#1D1D1F]"}`} strokeWidth={1.8} />
        {allVisibleCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[9.5px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs ${
              criticalCount > 0 ? "bg-[#D70015]" : "bg-[#B25E00]"
            }`}
          >
            {allVisibleCount > 9 ? "9+" : allVisibleCount}
          </span>
        )}
      </button>

      {/* POP-UP PANEL & BACKDROP */}
      {isOpen && (
        <>
          {/* Click-outside backdrop: zero tint, zero blur */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Elevated Floating Pop-up Card: 100% Solid Opaque White (Zero Transparency, Zero Blur) */}
          <div
            className="fixed right-3 sm:right-6 md:right-8 top-[68px] z-50 w-[420px] max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-black/15 shadow-[0_20px_50px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications Panel"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black/[0.04] border border-black/[0.06] flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-[#1D1D1F]" strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">Notifications</span>
                    {allVisibleCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/[0.05] text-[#1D1D1F] font-bold border border-black/[0.06]">
                        {allVisibleCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {allVisibleCount > 0 && (
                  <button
                    type="button"
                    onClick={dismissAll}
                    className="text-[11px] text-[#0071E3] hover:text-black font-semibold transition cursor-pointer px-2 py-1 rounded-lg hover:bg-black/[0.03]"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-black/[0.05] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
                  aria-label="Close notifications panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Chips Bar */}
            <div className="px-5 py-2 border-b border-black/[0.04] bg-white flex items-center gap-1.5 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setFilterSeverity("ALL")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  filterSeverity === "ALL"
                    ? "bg-[#1D1D1F] text-white shadow-2xs font-semibold"
                    : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                All ({allVisibleCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity("CRITICAL")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  filterSeverity === "CRITICAL"
                    ? "bg-[#D70015] text-white shadow-2xs font-semibold"
                    : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D70015]" />
                Critical ({criticalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity("WARNING")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  filterSeverity === "WARNING"
                    ? "bg-[#B25E00] text-white shadow-2xs font-semibold"
                    : "bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#B25E00]" />
                Warnings ({warningCount})
              </button>
            </div>

            {/* Notifications Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] overscroll-contain">
              {visible.length === 0 ? (
                <div className="py-14 px-6 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-5 h-5 text-[#288548]" />
                  </div>
                  <p className="text-xs font-semibold text-[#1D1D1F]">All caught up!</p>
                  <p className="text-[11px] text-[#86868B] mt-1 max-w-[260px] mx-auto leading-relaxed">
                    {filterSeverity === "ALL"
                      ? "Zero pending alerts. Your ledger, claims, and settlements are in good standing."
                      : `No active ${filterSeverity.toLowerCase()} alerts right now.`}
                  </p>
                </div>
              ) : (
                visible.map((n) => {
                  const isCritical = n.severity === "CRITICAL";
                  const isWarning = n.severity === "WARNING";
                  const dotColor = isCritical ? "bg-[#D70015]" : isWarning ? "bg-[#B25E00]" : "bg-[#0071E3]";
                  const badgeBg = isCritical
                    ? "bg-rose-50 text-[#D70015] border-rose-200/60"
                    : isWarning
                    ? "bg-amber-50 text-[#B25E00] border-amber-200/60"
                    : "bg-blue-50 text-[#0071E3] border-blue-200/60";

                  return (
                    <div
                      key={n.id}
                      className="px-5 py-3.5 flex items-start gap-3.5 hover:bg-[#FBFBFD] transition-colors group relative"
                    >
                      {/* Status indicator */}
                      <div className="mt-1 shrink-0 flex items-center justify-center">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                            {n.severity}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-[#1D1D1F] leading-snug">
                          {n.title}
                        </p>

                        <p className="text-[11px] text-[#6E6E73] mt-1 leading-relaxed">
                          {n.body}
                        </p>

                        <div className="mt-2.5">
                          <Link
                            href={n.actionUrl}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#0071E3] hover:text-[#005bb5] font-semibold hover:underline active:scale-95 transition"
                          >
                            <span>{n.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>

                      {/* Quick Dismiss button */}
                      <button
                        type="button"
                        onClick={() => dismiss(n.id)}
                        className="absolute right-3.5 top-3.5 opacity-60 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-black/[0.05] bg-[#FBFBFD] flex items-center justify-between text-[11px] text-[#86868B] shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#288548]" />
                Live Ledger Sync
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-medium hover:text-[#1D1D1F] transition cursor-pointer px-2 py-0.5 rounded hover:bg-black/[0.04]"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
