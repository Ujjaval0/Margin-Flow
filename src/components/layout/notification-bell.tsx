"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, CheckCheck, CheckCircle2, ChevronDown } from "lucide-react";
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
  timestamp?: string;
  detailsTitle?: string;
  details?: string[];
  extraCount?: number;
}

type FilterOption = "ALL" | "CRITICAL" | "WARNING" | "INFO" | "UNREAD";

const FILTER_LABELS: Record<FilterOption, string> = {
  ALL: "All",
  CRITICAL: "Critical",
  WARNING: "Warnings",
  INFO: "Updates",
  UNREAD: "Unread",
};

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
          title: daysLeft === 0 ? "Claim deadline expires today" : `Claim deadline in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
          body: `${returnLabel} (${ret.marketplace})${amtStr}. File your dispute before the window closes.`,
          actionUrl: "/claims",
          actionLabel: "Go to Claims",
          entityId: ret.id,
          timestamp: daysLeft === 0 ? "Urgent · Today" : `${daysLeft}d left`,
          detailsTitle: "Dispute details:",
          details: [
            `Return ID: ${returnLabel} · ${ret.marketplace}`,
            ret.lossAmount > 0 ? `At-risk loss: ₹${ret.lossAmount.toLocaleString("en-IN")}` : `Reason: ${ret.returnReason || "Customer Return"}`,
          ],
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
          timestamp: `${daysOver}d ago`,
          detailsTitle: "Expired claim summary:",
          details: [
            `Return ID: ${returnLabel} (${ret.marketplace})`,
            `Dispute SLA expired by ${daysOver} day${daysOver > 1 ? "s" : ""}`,
          ],
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
        timestamp: "3 hours ago",
        detailsTitle: "Orders awaiting payout:",
        details: overdueOrders.slice(0, 3).map((o) => {
          const ordId = (o as any).displayId || o.id.slice(0, 8);
          const amt = (o.items || []).reduce((s, i) => s + (i.sellingPrice || 0) * (i.quantity || 1), 0);
          return `Order #${ordId}: ₹${amt.toLocaleString("en-IN")} (${o.marketplace})`;
        }),
        extraCount: overdueOrders.length > 3 ? overdueOrders.length - 3 : 0,
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
        title: stock === 0 ? "Out of stock alert" : `Low stock — ${stock} unit${stock !== 1 ? "s" : ""} left`,
        body: `${p.name} (${p.sku}) is running low. Reorder soon to avoid stockouts.`,
        actionUrl: "/products",
        actionLabel: "View Products",
        entityId: p.sku,
        timestamp: "4 hours ago",
        detailsTitle: "Catalog item:",
        details: [
          `SKU: ${p.sku}`,
          `Units on hand: ${stock}`,
        ],
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
          timestamp: `${daysAgo}d ago`,
          detailsTitle: "Reverse logistics:",
          details: [
            `Return ID: ${returnLabel}`,
            `Status: Pending Restock Examination`,
          ],
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
        timestamp: "Yesterday",
        detailsTitle: "Documents awaiting approval:",
        details: pendingDocs.slice(0, 3).map((d) => `${d.fileName || d.id}: ${d.fileType || "INVOICE"}`),
        extraCount: pendingDocs.length > 3 ? pendingDocs.length - 3 : 0,
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
          timestamp: `${daysOld}d ago`,
          detailsTitle: "Payable breakdown:",
          details: [
            `Supplier: ${bill.supplierName}`,
            `Total due: ₹${bill.totalAmount.toLocaleString("en-IN")}`,
          ],
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [mounted, setMounted] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click when open
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  // Non-dismissed notifications
  const activeNotifications = useMemo(() => {
    return notifications.filter((n) => !dismissedIds.has(n.id));
  }, [notifications, dismissedIds]);

  // Counts
  const unreadCount = useMemo(() => {
    return activeNotifications.filter((n) => !readIds.has(n.id)).length;
  }, [activeNotifications, readIds]);

  const criticalCount = useMemo(() => {
    return activeNotifications.filter((n) => n.severity === "CRITICAL").length;
  }, [activeNotifications]);

  const warningCount = useMemo(() => {
    return activeNotifications.filter((n) => n.severity === "WARNING").length;
  }, [activeNotifications]);

  const infoCount = useMemo(() => {
    return activeNotifications.filter((n) => n.severity === "INFO").length;
  }, [activeNotifications]);

  // Filtered items based on active dropdown selection
  const visible = useMemo(() => {
    return activeNotifications.filter((n) => {
      if (filter === "CRITICAL") return n.severity === "CRITICAL";
      if (filter === "WARNING") return n.severity === "WARNING";
      if (filter === "INFO") return n.severity === "INFO";
      if (filter === "UNREAD") return !readIds.has(n.id);
      return true;
    });
  }, [activeNotifications, filter, readIds]);

  // Group notifications into cleanly partitioned sections
  const partitions = useMemo(() => {
    const groups: {
      key: "CRITICAL" | "WARNING" | "INFO";
      label: string;
      sublabel: string;
      items: AppNotification[];
    }[] = [];

    const crit = visible.filter((n) => n.severity === "CRITICAL");
    if (crit.length > 0) {
      groups.push({
        key: "CRITICAL",
        label: "Critical",
        sublabel: "Immediate action required",
        items: crit,
      });
    }

    const warn = visible.filter((n) => n.severity === "WARNING");
    if (warn.length > 0) {
      groups.push({
        key: "WARNING",
        label: "Warnings",
        sublabel: "Action advised",
        items: warn,
      });
    }

    const info = visible.filter((n) => n.severity === "INFO");
    if (info.length > 0) {
      groups.push({
        key: "INFO",
        label: "Updates",
        sublabel: "Operational notices",
        items: info,
      });
    }

    return groups;
  }, [visible]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsFilterOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const markAsRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  return (
    <>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsFilterOpen(false);
        }}
        className={`relative h-[34px] w-[34px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 ${
          isOpen
            ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30 shadow-apple-sm ring-2 ring-[#0071E3]/20"
            : "bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border-black/[0.08] shadow-apple-sm active:scale-[0.96]"
        }`}
        title="View Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className={`w-4 h-4 ${isOpen ? "text-[#0071E3]" : "text-[#1D1D1F]"}`} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs bg-[#0071E3]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Pop-up Panel & Backdrop */}
      {isOpen && mounted && createPortal(
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] animate-in fade-in duration-150"
            onClick={() => {
              setIsOpen(false);
              setIsFilterOpen(false);
            }}
            aria-hidden="true"
          />

          {/* Elevated Floating Pop-up Card */}
          <div
            className="fixed right-3 sm:right-6 md:right-8 top-[60px] z-50 w-[380px] max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-black/[0.08] shadow-apple-lg overflow-hidden flex flex-col max-h-[530px] animate-in fade-in zoom-in-95 duration-150 origin-top-right"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications Panel"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header: Clean title + Filter Dropdown + Mark all as read */}
            <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold text-[#1D1D1F] tracking-tight">Notifications</h2>

                {/* Filter Dropdown Selector */}
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F] bg-black/[0.04] hover:bg-black/[0.07] px-2 py-0.5 rounded-md transition cursor-pointer"
                    aria-label="Filter notifications"
                    aria-expanded={isFilterOpen}
                  >
                    <span>{FILTER_LABELS[filter]}</span>
                    <ChevronDown className="w-3 h-3 text-[#86868B]" />
                  </button>

                {/* Filter Menu */}
                  {isFilterOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-40 bg-white rounded-xl shadow-apple-md p-1 z-30 animate-in fade-in zoom-in-95 duration-100 divide-y divide-black/[0.04]">
                      <div className="py-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFilter("ALL");
                            setIsFilterOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                            filter === "ALL"
                              ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold"
                              : "text-[#1D1D1F] hover:bg-black/[0.04]"
                          }`}
                        >
                          <span>All</span>
                          <span className="text-[10px] text-[#86868B] tabular-nums font-mono">
                            {activeNotifications.length}
                          </span>
                        </button>
                      </div>

                      <div className="py-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFilter("CRITICAL");
                            setIsFilterOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                            filter === "CRITICAL"
                              ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold"
                              : "text-[#1D1D1F] hover:bg-black/[0.04]"
                          }`}
                        >
                          <span>Critical</span>
                          <span className="text-[10px] text-[#86868B] tabular-nums font-mono">
                            {criticalCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFilter("WARNING");
                            setIsFilterOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                            filter === "WARNING"
                              ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold"
                              : "text-[#1D1D1F] hover:bg-black/[0.04]"
                          }`}
                        >
                          <span>Warnings</span>
                          <span className="text-[10px] text-[#86868B] tabular-nums font-mono">
                            {warningCount}
                          </span>
                        </button>

                        {infoCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilter("INFO");
                              setIsFilterOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                              filter === "INFO"
                                ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold"
                                : "text-[#1D1D1F] hover:bg-black/[0.04]"
                            }`}
                          >
                            <span>Updates</span>
                            <span className="text-[10px] text-[#86868B] tabular-nums font-mono">
                              {infoCount}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFilter("UNREAD");
                            setIsFilterOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11.5px] flex items-center justify-between transition cursor-pointer ${
                            filter === "UNREAD"
                              ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold"
                              : "text-[#1D1D1F] hover:bg-black/[0.04]"
                          }`}
                        >
                          <span>Unread</span>
                          <span className="text-[10px] text-[#86868B] tabular-nums font-mono">
                            {unreadCount}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Mark all as read + Close Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className={`text-[12px] font-medium flex items-center gap-1.5 px-1 py-0.5 transition cursor-pointer ${
                    unreadCount > 0
                      ? "text-[#6E6E73] hover:text-[#1D1D1F]"
                      : "text-[#AEAEB2] cursor-default pointer-events-none"
                  }`}
                  title={unreadCount > 0 ? "Mark all as read" : "All notifications are read"}
                >
                  <span>Mark all as read</span>
                  <CheckCheck className={`w-3.5 h-3.5 ${unreadCount > 0 ? "text-[#0071E3]" : "text-[#AEAEB2]"}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsFilterOpen(false);
                  }}
                  className="w-6 h-6 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
                  aria-label="Close notifications panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Notifications List partitioned by section */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {visible.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-[#288548] flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-[#1D1D1F]">All caught up</p>
                  <p className="text-[11px] text-[#86868B] mt-0.5 leading-snug">
                    {filter === "ALL"
                      ? "Zero pending alerts. Your ledger is in good standing."
                      : `No ${FILTER_LABELS[filter].toLowerCase()} alerts found.`}
                  </p>
                </div>
              ) : (
                partitions.map((group) => {
                  return (
                    <div key={group.key} className="border-b border-black/[0.04] last:border-b-0">
                      {/* Section Partition Header */}
                      <div className="px-4 py-2 bg-[#F9F9FB] border-y border-black/[0.04] flex items-center justify-between sticky top-0 z-10">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#1D1D1F]">
                            {group.label}
                          </span>
                          <span className="text-[10px] font-medium text-[#6E6E73] bg-black/[0.05] px-1.5 py-0.5 rounded-full tabular-nums">
                            {group.items.length}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#86868B] font-normal">
                          {group.sublabel}
                        </span>
                      </div>

                      {/* Items in this Partition */}
                      <div className="divide-y divide-black/[0.04]">
                        {group.items.map((n) => {
                          const isUnread = !readIds.has(n.id);

                          return (
                            <div
                              key={n.id}
                              className="px-4 py-3.5 hover:bg-black/[0.015] transition-colors flex items-start gap-2.5 relative group"
                            >
                              {/* Blue Dot for unread only, consistent across all severities */}
                              <div className="shrink-0 mt-1 flex items-center justify-center w-2 h-2">
                                {isUnread && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-[#0071E3] shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>

                              {/* Notification Body Content */}
                              <div className="flex-1 min-w-0 pr-2">
                                <h4
                                  className={`text-[13px] tracking-tight leading-snug ${
                                    isUnread ? "font-semibold text-[#1D1D1F]" : "font-medium text-[#424245]"
                                  }`}
                                >
                                  {n.title}
                                </h4>

                                <p className="text-[12px] text-[#515154] mt-1 leading-relaxed">
                                  {n.body}
                                </p>

                                {/* Optional Item Review List Preview */}
                                {n.details && n.details.length > 0 && (
                                  <div className="mt-2 text-[11px] text-[#6E6E73] bg-[#F9F9FB] rounded-lg p-2.5 border border-black/[0.04] space-y-1">
                                    {n.detailsTitle && (
                                      <p className="font-semibold text-[#1D1D1F] text-[10.5px] mb-1">
                                        {n.detailsTitle}
                                      </p>
                                    )}
                                    {n.details.map((detail, idx) => (
                                      <p key={idx} className="font-mono text-[10.5px] text-[#424245] leading-normal">
                                        {detail}
                                      </p>
                                    ))}
                                    {n.extraCount && n.extraCount > 0 ? (
                                      <p className="text-[10px] text-[#86868B] pt-0.5">
                                        ... and {n.extraCount} more
                                      </p>
                                    ) : null}
                                  </div>
                                )}

                                {/* Action Button */}
                                <div className="mt-2.5">
                                  <Link
                                    href={n.actionUrl}
                                    onClick={() => {
                                      markAsRead(n.id);
                                      setIsOpen(false);
                                    }}
                                    className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#1D1D1F] hover:bg-black text-white text-[11px] font-medium transition-all active:scale-95 shadow-xs"
                                  >
                                    {n.actionLabel}
                                  </Link>
                                </div>

                                {/* Timestamp */}
                                {n.timestamp && (
                                  <p className="text-[11px] text-[#86868B] mt-2">
                                    {n.timestamp}
                                  </p>
                                )}
                              </div>

                              {/* Quick Dismiss Button (Hover) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismiss(n.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/[0.06] text-[#86868B] hover:text-[#1D1D1F] cursor-pointer shrink-0"
                                title="Dismiss notification"
                                aria-label="Dismiss notification"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-black/[0.05] bg-[#FBFBFD] flex items-center justify-between text-[10.5px] text-[#86868B] shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0071E3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#0071E3]"></span>
                </span>
                <span className="font-medium text-[#1D1D1F] text-[10.5px]">Live Ledger Sync</span>
              </div>
              <div className="flex items-center gap-1 text-[9.5px] text-[#86868B]">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] font-mono text-[9px] border border-black/[0.06] text-[#1D1D1F]">
                  ESC
                </kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
