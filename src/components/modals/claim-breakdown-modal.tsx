"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "lucide-react";
import { Claim, ClaimStatus } from "@/domain/types";
import { formatINR, formatDate } from "@/lib/utils";

export type ClaimCardType =
  | "disputedAmount"
  | "recoveredReimbursements"
  | "outstandingBalance"
  | "recoveryRate";

export interface ClaimBreakdownModalProps {
  cardType: ClaimCardType | null;
  onClose: () => void;
  claims: Claim[];
  onSelectFilter?: (status: string) => void;
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
  NOT_FILED: "Not Filed",
  FILED: "Filed",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  PARTIALLY_RECOVERED: "Partial",
  RECOVERED: "Recovered",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  NOT_FILED: "bg-slate-100 text-slate-500",
  FILED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  PARTIALLY_RECOVERED: "bg-amber-50 text-amber-800",
  RECOVERED: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700",
  CLOSED: "bg-slate-50 text-slate-500",
};

// Helper: group claims by orderId
function groupByOrder(subset: Claim[]) {
  const map = new Map<string, { orderId: string; claimed: number; recovered: number; claims: Claim[] }>();
  for (const c of subset) {
    if (!map.has(c.orderId)) map.set(c.orderId, { orderId: c.orderId, claimed: 0, recovered: 0, claims: [] });
    const e = map.get(c.orderId)!;
    e.claimed += c.amountClaimed;
    e.recovered += c.amountRecovered;
    e.claims.push(c);
  }
  return Array.from(map.values()).sort((a, b) => b.claimed - a.claimed);
}

// Shared: one order row with claim detail sub-rows
function OrderRow({
  row,
  showRecovered = true,
  showGap = false,
}: {
  row: ReturnType<typeof groupByOrder>[number];
  showRecovered?: boolean;
  showGap?: boolean;
}) {
  const gap = Math.max(0, row.claimed - row.recovered);
  const rate = row.claimed > 0 ? row.recovered / row.claimed : 0;
  return (
    <div className="px-4 py-3.5 bg-white hover:bg-[#FAFAFC] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">{row.orderId}</span>
          <span className="ml-2 text-[10px] text-[#86868B]">
            {row.claims.length} claim{row.claims.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-[#1D1D1F] tabular-nums">{formatINR(row.claimed)}</div>
          <div className="text-[10px] text-[#86868B]">claimed</div>
        </div>
      </div>

      {showRecovered && (
        <>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-[#288548] rounded-full" style={{ width: `${Math.min(100, rate * 100)}%` }} />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#288548] font-semibold tabular-nums">{formatINR(row.recovered)} recovered</span>
            {gap > 0 && <span className="text-[#86868B] tabular-nums">· {formatINR(gap)} pending</span>}
            <span className="ml-auto text-[#86868B]">{(rate * 100).toFixed(0)}%</span>
          </div>
        </>
      )}

      {showGap && !showRecovered && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-amber-700 font-semibold tabular-nums">{formatINR(gap)} outstanding</span>
          <span className="ml-auto text-[#86868B]">{(rate * 100).toFixed(0)}% recovered so far</span>
        </div>
      )}

      {row.claims.map((c) => (
        <div key={c.id} className="mt-2.5 pt-2.5 border-t border-black/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#1D1D1F]">{c.id}</span>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#86868B]">
            <span className="tabular-nums">{c.claimType.replace(/_/g, " ")}</span>
            <span className="tabular-nums font-semibold text-[#1D1D1F]">{formatINR(c.amountClaimed)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClaimBreakdownModal({ cardType, onClose, claims, onSelectFilter }: ClaimBreakdownModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  if (!cardType || !mounted) return null;

  // ── Global metrics ────────────────────────────────────────────────────────
  const totalClaimed   = claims.reduce((s, c) => s + c.amountClaimed, 0);
  const totalRecovered = claims.reduce((s, c) => s + c.amountRecovered, 0);
  const outstanding    = Math.max(0, totalClaimed - totalRecovered);
  const rate           = totalClaimed > 0 ? totalRecovered / totalClaimed : 0;

  // ── Card-specific data ────────────────────────────────────────────────────
  // Card 1 – all claims
  const allOrderRows = groupByOrder(claims);
  const typeGroups   = new Map<string, { count: number; total: number }>();
  for (const c of claims) {
    const key = c.claimType.replace(/_/g, " ");
    const e   = typeGroups.get(key) ?? { count: 0, total: 0 };
    e.count++; e.total += c.amountClaimed;
    typeGroups.set(key, e);
  }

  // Card 2 – only claims with some recovery
  const creditedClaims    = claims.filter((c) => c.amountRecovered > 0);
  const creditedOrderRows = groupByOrder(creditedClaims);

  // Card 3 – only claims with remaining outstanding
  const pendingClaims    = claims.filter((c) => c.amountClaimed > c.amountRecovered);
  const pendingOrderRows = groupByOrder(pendingClaims);

  // Card 4 – channel rates & status funnel
  const channelMap = new Map<string, { claimed: number; recovered: number; count: number }>();
  for (const c of claims) {
    const e = channelMap.get(c.marketplace) ?? { claimed: 0, recovered: 0, count: 0 };
    e.claimed += c.amountClaimed; e.recovered += c.amountRecovered; e.count++;
    channelMap.set(c.marketplace, e);
  }
  const channelRows = Array.from(channelMap.entries()).sort((a, b) => b[1].claimed - a[1].claimed);

  const statusGroups = new Map<ClaimStatus, number>();
  for (const c of claims) statusGroups.set(c.status, (statusGroups.get(c.status) ?? 0) + 1);

  // ── Shared header config ──────────────────────────────────────────────────
  const cfg = {
    disputedAmount:        { title: "Disputed Amount",            subtitle: "All filed disputes by order & type",                   hero: formatINR(totalClaimed),             heroLabel: `${claims.length} total dispute${claims.length !== 1 ? "s" : ""}`,      accent: "text-[#1D1D1F]" },
    recoveredReimbursements: { title: "Recovered Reimbursements", subtitle: "Claims with at least partial credit received",         hero: formatINR(totalRecovered),           heroLabel: `${creditedClaims.length} claim${creditedClaims.length !== 1 ? "s" : ""} credited`, accent: "text-[#288548]" },
    outstandingBalance:    { title: "Outstanding Balance",        subtitle: "Claims with unpaid amounts still pending approval",    hero: formatINR(outstanding),              heroLabel: `${pendingClaims.length} claim${pendingClaims.length !== 1 ? "s" : ""} pending`, accent: "text-[#1D1D1F]" },
    recoveryRate:          { title: "Recovery Rate",              subtitle: "How much of total disputed value has been recovered",  hero: `${(rate * 100).toFixed(1)}%`,       heroLabel: `${formatINR(totalRecovered)} of ${formatINR(totalClaimed)}`, accent: "text-[#1D1D1F]" },
  }[cardType];

  // ── Section label ─────────────────────────────────────────────────────────
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04]">
      {children}
    </div>
  );

  const SectionLabel = ({ label, sub }: { label: string; sub?: string }) => (
    <p className="text-xs font-semibold text-[#1D1D1F] tracking-tight mb-2">
      {label}
      {sub && <span className="ml-1.5 text-xs text-[#86868B] font-normal">{sub}</span>}
    </p>
  );

  const EmptyRow = ({ msg }: { msg: string }) => (
    <div className="px-4 py-6 text-center text-xs text-[#86868B]">{msg}</div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-black/[0.05]">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">{cfg.title}</h2>
            <p className="text-xs text-[#86868B] mt-0.5 leading-relaxed">{cfg.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition shrink-0 ml-4 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hero strip */}
        <div className="px-6 py-4 flex items-center gap-5 border-b border-black/[0.05] bg-[#FAFAFC]">
          <div>
            <div className={`text-3xl font-semibold tracking-tight tabular-nums ${cfg.accent}`}>{cfg.hero}</div>
            <div className="text-xs text-[#86868B] mt-0.5">{cfg.heroLabel}</div>
          </div>
          {/* only card 4 gets progress bar in hero */}
          {cardType === "recoveryRate" && (
            <div className="flex-1">
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#288548] rounded-full" style={{ width: `${Math.min(100, rate * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#86868B] mt-1">
                <span>Recovered</span><span>Disputed</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ─── CARD 1: Disputed Amount ──────────────────────────────────── */}
          {cardType === "disputedAmount" && (
            <>
              {/* Dispute type distribution */}
              {typeGroups.size > 0 && (
                <div>
                  <SectionLabel label="By Dispute Type" />
                  <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04]">
                    {Array.from(typeGroups.entries()).map(([type, { count, total }]) => (
                      <div key={type} className="flex items-center justify-between px-4 py-2.5 text-xs bg-white hover:bg-[#FAFAFC] transition-colors">
                        <span className="font-medium text-[#1D1D1F]">{type}</span>
                        <div className="flex items-center gap-3 text-[#86868B]">
                          <span>{count} claim{count !== 1 ? "s" : ""}</span>
                          <span className="font-semibold text-[#1D1D1F] tabular-nums">{formatINR(total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All orders breakdown */}
              <div>
                <SectionLabel label="Breakdown by Order" sub={`(${allOrderRows.length} order${allOrderRows.length !== 1 ? "s" : ""})`} />
                <Row>
                  {allOrderRows.length === 0
                    ? <EmptyRow msg="No claims filed." />
                    : allOrderRows.map((row) => <OrderRow key={row.orderId} row={row} showRecovered />)
                  }
                </Row>
              </div>
            </>
          )}

          {/* ─── CARD 2: Recovered Reimbursements ────────────────────────── */}
          {cardType === "recoveredReimbursements" && (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
                  <div className="text-base font-semibold text-[#288548] tabular-nums tracking-tight">{formatINR(totalRecovered)}</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">Total Credited</div>
                </div>
                <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.05] px-4 py-3 text-center">
                  <div className="text-base font-semibold text-[#1D1D1F] tabular-nums tracking-tight">{creditedClaims.length}</div>
                  <div className="text-[10px] text-[#86868B] mt-0.5">Claims with credits</div>
                </div>
              </div>

              {/* Credited claims per order */}
              <div>
                <SectionLabel label="Credited Orders" sub={`(${creditedOrderRows.length} order${creditedOrderRows.length !== 1 ? "s" : ""})`} />
                <Row>
                  {creditedOrderRows.length === 0
                    ? <EmptyRow msg="No recoveries credited yet." />
                    : creditedOrderRows.map((row) => (
                        <div key={row.orderId} className="px-4 py-3.5 bg-white hover:bg-[#FAFAFC] transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">{row.orderId}</span>
                            <span className="text-xs font-semibold text-[#288548] tabular-nums">{formatINR(row.recovered)} credited</span>
                          </div>
                          {row.claims.map((c) => (
                            <div key={c.id} className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-[#1D1D1F]">{c.id}</span>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-[#86868B] tabular-nums line-through">{formatINR(c.amountClaimed)}</span>
                                <ArrowRight className="w-3 h-3 text-[#86868B]" />
                                <span className="text-[#288548] font-semibold tabular-nums">{formatINR(c.amountRecovered)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                  }
                </Row>
              </div>
            </>
          )}

          {/* ─── CARD 3: Outstanding Balance ──────────────────────────────── */}
          {cardType === "outstandingBalance" && (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                  <div className="text-base font-semibold text-amber-900 tabular-nums tracking-tight">{formatINR(outstanding)}</div>
                  <div className="text-[10px] text-amber-700 mt-0.5">Total Pending</div>
                </div>
                <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.05] px-4 py-3 text-center">
                  <div className="text-base font-semibold text-[#1D1D1F] tabular-nums tracking-tight">{pendingClaims.length}</div>
                  <div className="text-[10px] text-[#86868B] mt-0.5">Pending claims</div>
                </div>
              </div>

              {/* Pending gap per order */}
              <div>
                <SectionLabel label="Pending by Order" sub={`(${pendingOrderRows.length} order${pendingOrderRows.length !== 1 ? "s" : ""})`} />
                <Row>
                  {pendingOrderRows.length === 0
                    ? <EmptyRow msg="All claims are fully settled." />
                    : pendingOrderRows.map((row) => (
                        <div key={row.orderId} className="px-4 py-3.5 bg-white hover:bg-[#FAFAFC] transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">{row.orderId}</span>
                            <span className="text-xs font-semibold text-amber-700 tabular-nums">
                              {formatINR(Math.max(0, row.claimed - row.recovered))} outstanding
                            </span>
                          </div>
                          {/* Claimed → recovered gap bar */}
                          <div className="w-full h-1 bg-amber-100 rounded-full overflow-hidden mb-1.5">
                            <div
                              className="h-full bg-[#288548] rounded-full"
                              style={{ width: `${Math.min(100, row.claimed > 0 ? (row.recovered / row.claimed) * 100 : 0)}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-[#86868B] mb-2">
                            {formatINR(row.recovered)} received of {formatINR(row.claimed)} claimed
                          </div>
                          {row.claims.map((c) => {
                            const claimGap = Math.max(0, c.amountClaimed - c.amountRecovered);
                            return (
                              <div key={c.id} className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium text-[#1D1D1F]">{c.id}</span>
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                                </div>
                                <span className="text-[11px] font-semibold text-amber-700 tabular-nums">
                                  {formatINR(claimGap)} gap
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))
                  }
                </Row>
              </div>
            </>
          )}

          {/* ─── CARD 4: Recovery Rate ────────────────────────────────────── */}
          {cardType === "recoveryRate" && (
            <>
              {/* Formula */}
              <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.05] px-4 py-3.5 text-xs space-y-1">
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">Formula</p>
                <p className="font-medium text-[#1D1D1F]">
                  Recovery Rate = Recovered ÷ Disputed × 100
                </p>
                <p className="text-[#86868B]">
                  = {formatINR(totalRecovered)} ÷ {formatINR(totalClaimed)} × 100
                  {" = "}<span className="font-semibold text-[#1D1D1F]">{(rate * 100).toFixed(1)}%</span>
                </p>
              </div>

              {/* Status funnel */}
              {statusGroups.size > 0 && (
                <div>
                  <SectionLabel label="Status Funnel" />
                  <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04]">
                    {Array.from(statusGroups.entries()).map(([status, count]) => (
                      <button
                        key={status}
                        onClick={() => { onSelectFilter?.(status); onClose(); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-[#FAFAFC] transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#86868B]">
                          <span>{count} claim{count !== 1 ? "s" : ""}</span>
                          <ArrowRight className="w-3 h-3 opacity-40" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel-wise rates */}
              {channelRows.length > 0 && (
                <div>
                  <SectionLabel label="Recovery by Channel" />
                  <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04]">
                    {channelRows.map(([channel, { claimed, recovered, count }]) => {
                      const chRate = claimed > 0 ? recovered / claimed : 0;
                      return (
                        <div key={channel} className="px-4 py-3 bg-white hover:bg-[#FAFAFC] transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-[#1D1D1F]">{channel}</span>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-[#86868B]">{count} claim{count !== 1 ? "s" : ""}</span>
                              <span className="font-semibold text-[#1D1D1F] tabular-nums">{(chRate * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#288548] rounded-full" style={{ width: `${Math.min(100, chRate * 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#86868B] mt-1">
                            <span>{formatINR(recovered)} recovered</span>
                            <span>{formatINR(claimed)} disputed</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/[0.05] flex justify-end bg-[#FAFAFC] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-full transition shadow-apple-sm cursor-pointer btn-press"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
