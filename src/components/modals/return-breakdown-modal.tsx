"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  RotateCcw,
  Truck,
  Clock,
  ShieldAlert,
  ArrowRight,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Store,
} from "lucide-react";
import { ReturnRecord, Order } from "@/domain/types";
import { formatINR } from "@/lib/utils";

export type ReturnCardType =
  | "totalReturnsLoss"
  | "rtoFailureRate"
  | "oldAgingBacklog"
  | "disputeClaimPotential";

export interface ReturnBreakdownModalProps {
  cardType: ReturnCardType | null;
  onClose: () => void;
  returns: ReturnRecord[];
  orders: Order[];
  effectiveChannel: string;
  onSelectTab?: (tab: "ALL" | "CUSTOMER_RETURN" | "RTO" | "OLD_RETURNS") => void;
}

export function ReturnBreakdownModal({
  cardType,
  onClose,
  returns,
  orders,
  effectiveChannel,
  onSelectTab,
}: ReturnBreakdownModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!cardType || !mounted) return null;

  const CURRENT_SIM_DATE = new Date("2026-09-17");

  const getAgingDays = (dateStr: string): number => {
    const d = new Date(dateStr);
    return Math.max(
      0,
      Math.floor((CURRENT_SIM_DATE.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    );
  };

  const isOldReturn = (r: ReturnRecord): boolean => {
    const returnDate = new Date(r.receivedDate || r.returnDate);
    const diffDays = Math.floor(
      (CURRENT_SIM_DATE.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays >= 14) return true;
    if (r.condition === "UNDER_INSPECTION" && diffDays >= 7) return true;
    if (r.claimDeadline) {
      const deadline = new Date(r.claimDeadline);
      const daysUntilDeadline = Math.floor(
        (deadline.getTime() - CURRENT_SIM_DATE.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDeadline <= 4) return true;
    }
    return false;
  };

  // Channel-filtered returns
  const filteredReturns = returns.filter(
    (r) => effectiveChannel === "ALL" || r.marketplace === effectiveChannel
  );

  // Return Type Groups
  const rtoReturns = filteredReturns.filter((r) => r.returnType === "RTO");
  const customerReturns = filteredReturns.filter(
    (r) => r.returnType === "CUSTOMER_RETURN" || r.returnType === "DAMAGED_RETURN"
  );

  // Units
  const totalUnits = filteredReturns.reduce((sum, r) => sum + r.quantity, 0);
  const rtoUnits = rtoReturns.reduce((sum, r) => sum + r.quantity, 0);
  const customerUnits = customerReturns.reduce((sum, r) => sum + r.quantity, 0);

  // Financials
  const totalLoss = filteredReturns.reduce((sum, r) => sum + r.lossAmount, 0);
  const rtoLoss = rtoReturns.reduce((sum, r) => sum + r.lossAmount, 0);
  const customerLoss = customerReturns.reduce((sum, r) => sum + r.lossAmount, 0);

  const customerFreight = customerReturns.reduce((sum, r) => sum + r.returnShippingCost, 0);
  const customerReturnFees = customerReturns.reduce(
    (sum, r) => sum + (r.customerReturnFee ?? 0),
    0
  );
  const rtoFreight = rtoReturns.reduce((sum, r) => sum + r.returnShippingCost, 0);
  const totalSalvageValue = filteredReturns.reduce(
    (sum, r) => sum + r.inventoryRecoveryValue,
    0
  );

  // QC conditions
  const sellableReturns = filteredReturns.filter((r) => r.condition === "SELLABLE");
  const damagedReturns = filteredReturns.filter(
    (r) =>
      r.condition === "DAMAGED" ||
      r.condition === "UNUSABLE" ||
      r.returnType === "DAMAGED_RETURN"
  );
  const inspectionReturns = filteredReturns.filter(
    (r) => r.condition === "UNDER_INSPECTION" || r.condition === "USED"
  );

  // Channels Breakdown
  const channelBreakdown = Array.from(
    new Set(filteredReturns.map((r) => r.marketplace))
  ).map((channel) => {
    const chReturns = filteredReturns.filter((r) => r.marketplace === channel);
    const chRto = chReturns.filter((r) => r.returnType === "RTO");
    const chCust = chReturns.filter(
      (r) => r.returnType === "CUSTOMER_RETURN" || r.returnType === "DAMAGED_RETURN"
    );
    return {
      channel,
      totalUnits: chReturns.reduce((sum, r) => sum + r.quantity, 0),
      rtoUnits: chRto.reduce((sum, r) => sum + r.quantity, 0),
      customerUnits: chCust.reduce((sum, r) => sum + r.quantity, 0),
      loss: chReturns.reduce((sum, r) => sum + r.lossAmount, 0),
      count: chReturns.length,
    };
  });

  // Orders comparison
  const relevantOrders = orders.filter(
    (o) => effectiveChannel === "ALL" || o.marketplace === effectiveChannel
  );
  const totalOrderedUnits = relevantOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
    0
  );
  const deliveredUnits = Math.max(0, totalOrderedUnits - rtoUnits);
  const rtoRate = totalOrderedUnits > 0 ? ((rtoUnits / totalOrderedUnits) * 100).toFixed(1) : "0.0";

  // Aging Backlog
  const agingOver14 = filteredReturns.filter((r) => getAgingDays(r.receivedDate || r.returnDate) >= 14);
  const aging7to14 = filteredReturns.filter((r) => {
    const d = getAgingDays(r.receivedDate || r.returnDate);
    return d >= 7 && d < 14;
  });
  const agingUnder7 = filteredReturns.filter(
    (r) => getAgingDays(r.receivedDate || r.returnDate) < 7
  );

  // Dispute Potential
  const claimCost = damagedReturns.reduce((sum, r) => sum + r.lossAmount, 0);
  const filedClaims = damagedReturns.filter((r) => !!r.claimId);
  const unfiledClaims = damagedReturns.filter((r) => !r.claimId);
  const unfiledLoss = unfiledClaims.reduce((sum, r) => sum + r.lossAmount, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-black/[0.06] flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-black/[0.05] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black/[0.03] border border-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              {cardType === "totalReturnsLoss" && <RotateCcw className="w-4 h-4" />}
              {cardType === "rtoFailureRate" && <Truck className="w-4 h-4 text-[#1D1D1F]" />}
              {cardType === "oldAgingBacklog" && <Clock className="w-4 h-4 text-[#1D1D1F]" />}
              {cardType === "disputeClaimPotential" && <ShieldAlert className="w-4 h-4 text-[#1D1D1F]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  {cardType === "totalReturnsLoss" && "Total Returns Loss Breakdown"}
                  {cardType === "rtoFailureRate" && "RTO Delivery Failure Rate Breakdown"}
                  {cardType === "oldAgingBacklog" && "Old & Aging Returns Backlog Breakdown"}
                  {cardType === "disputeClaimPotential" && "Dispute Claim Potential Breakdown"}
                </h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/[0.04] text-[#6E6E73]">
                  {effectiveChannel === "ALL" ? "All Channels" : effectiveChannel}
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-0.5 leading-relaxed">
                {cardType === "totalReturnsLoss" &&
                  "Direct operational breakdown comparing Customer Returns vs RTO undelivered packages."}
                {cardType === "rtoFailureRate" &&
                  "Delivery failure proportion against total units dispatched across marketplaces."}
                {cardType === "oldAgingBacklog" &&
                  "Aging reverse inventory packages resting in quarantine or pending warehouse QC putaway."}
                {cardType === "disputeClaimPotential" &&
                  "Damaged and scrap return loss eligible for marketplace SAFE-T claims and carrier disputes."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#6E6E73] flex items-center justify-center transition cursor-pointer shrink-0 ml-4"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* ── CARD 1: TOTAL RETURNS LOSS BREAKDOWN ── */}
          {cardType === "totalReturnsLoss" && (
            <div className="space-y-4">
              {/* Top Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Total Loss
                  </span>
                  <span className="text-xl font-semibold text-rose-600 tracking-tight tabular-nums block mt-1">
                    {formatINR(totalLoss)}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">{totalUnits} total units</span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Customer Return
                  </span>
                  <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block mt-1">
                    {customerUnits} units
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {customerReturns.length} records · {formatINR(customerLoss)}
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    RTO Undelivered
                  </span>
                  <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block mt-1">
                    {rtoUnits} units
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {rtoReturns.length} records · {formatINR(rtoLoss)}
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Restocked Salvage
                  </span>
                  <span className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums block mt-1">
                    {formatINR(totalSalvageValue)}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {sellableReturns.reduce((s, r) => s + r.quantity, 0)} units sellable
                  </span>
                </div>
              </div>

              {/* Ratio Progress Bar */}
              <div className="p-3.5 bg-[#FAFAFC] rounded-2xl border border-black/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0071E3] inline-block"></span>
                    Customer Returns ({totalUnits > 0 ? Math.round((customerUnits / totalUnits) * 100) : 0}%)
                  </span>
                  <span className="font-medium text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#FF9500] inline-block"></span>
                    RTO Undelivered ({totalUnits > 0 ? Math.round((rtoUnits / totalUnits) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/[0.06] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-[#0071E3] transition-all duration-300"
                    style={{
                      width: `${totalUnits > 0 ? (customerUnits / totalUnits) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#FF9500] transition-all duration-300"
                    style={{
                      width: `${totalUnits > 0 ? (rtoUnits / totalUnits) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Detailed Arithmetic Comparison: RTO vs Customer Return */}
              <div>
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Detailed Operational Split
                  <span className="ml-1.5 normal-case font-normal text-[#86868B]">Units &amp; Financial Impact</span>
                </p>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04] bg-white">
                  {/* Customer Returns Row */}
                  <div className="p-4 bg-white hover:bg-[#FAFAFC] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#0071E3]"></span>
                        <span className="text-xs font-semibold text-[#1D1D1F]">Customer Returns</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-900 px-2 py-0.5 rounded-full font-medium">
                          {customerReturns.length} records
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums">
                          {customerUnits} units
                        </span>
                        <span className="text-xs text-rose-600 font-medium block">
                          Loss: {formatINR(customerLoss)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-black/[0.04] text-[11px] text-[#86868B]">
                      <div>
                        <span>Return Logistics Freight: </span>
                        <span className="font-medium text-[#1D1D1F]">{formatINR(customerFreight)}</span>
                      </div>
                      <div>
                        <span>Customer Return Penalty Fees: </span>
                        <span className="font-medium text-[#1D1D1F]">{formatINR(customerReturnFees)}</span>
                      </div>
                    </div>
                  </div>

                  {/* RTO Undelivered Row */}
                  <div className="p-4 bg-white hover:bg-[#FAFAFC] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF9500]"></span>
                        <span className="text-xs font-semibold text-[#1D1D1F]">RTO (Doorstep Rejection / Undelivered)</span>
                        <span className="text-[10px] bg-amber-500/15 text-amber-950 px-2 py-0.5 rounded-full font-medium">
                          {rtoReturns.length} records
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums">
                          {rtoUnits} units
                        </span>
                        <span className="text-xs text-[#86868B] font-medium block">
                          Loss: {formatINR(rtoLoss)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-black/[0.04] text-[11px] text-[#86868B]">
                      <div>
                        <span>RTO Freight Incurred: </span>
                        <span className="font-medium text-[#1D1D1F]">{formatINR(rtoFreight)}</span>
                      </div>
                      <div>
                        <span>Product Integrity: </span>
                        <span className="font-medium text-[#288548]">100% Intact / Restockable</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Summary Row */}
                  <div className="px-4 py-3 bg-[#FAFAFC] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#1D1D1F]">Total Reverse Pipeline</span>
                      <p className="text-[11px] text-[#86868B] mt-0.5">
                        Net realized reverse logistics deficit across all channels
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-semibold text-rose-600 tabular-nums">
                        {formatINR(totalLoss)}
                      </span>
                      <span className="text-[11px] text-[#86868B] font-medium block mt-0.5">
                        {totalUnits} returned units
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Channel Breakdown Table */}
              <div>
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Channel Distribution
                </p>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04] bg-white text-xs">
                  {channelBreakdown.map((ch) => (
                    <div
                      key={ch.channel}
                      className="flex items-center justify-between px-4 py-3 bg-white hover:bg-[#FAFAFC] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-[#86868B]" />
                        <span className="font-medium text-[#1D1D1F]">{ch.channel}</span>
                        <span className="text-[11px] text-[#86868B]">({ch.count} entries)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#6E6E73] font-medium">
                          {ch.customerUnits} Cust.
                        </span>
                        <span className="text-[11px] text-[#6E6E73] font-medium">
                          {ch.rtoUnits} RTO
                        </span>
                        <span className="font-semibold text-[#1D1D1F] tabular-nums min-w-[70px] text-right">
                          {formatINR(ch.loss)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CARD 2: RTO FAILURE RATE BREAKDOWN ── */}
          {cardType === "rtoFailureRate" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    RTO Failure Rate
                  </span>
                  <span className="text-xl font-semibold text-amber-700 tracking-tight tabular-nums block mt-1">
                    {rtoRate}%
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {rtoUnits} of {totalOrderedUnits} units failed
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Delivered / Active
                  </span>
                  <span className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums block mt-1">
                    {deliveredUnits} units
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {totalOrderedUnits > 0
                      ? ((deliveredUnits / totalOrderedUnits) * 100).toFixed(1)
                      : 100}
                    % success rate
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Total Dispatched
                  </span>
                  <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block mt-1">
                    {totalOrderedUnits} units
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {relevantOrders.length} customer orders
                  </span>
                </div>
              </div>

              {/* Formula Card */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] text-xs space-y-1.5">
                <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                  Computation Formula
                </span>
                <div className="font-mono text-xs text-[#1D1D1F] bg-white px-2.5 py-1.5 rounded-lg border border-black/[0.04] inline-block">
                  RTO Failure Rate = (RTO Undelivered Units / Total Dispatched Units) × 100
                </div>
                <div className="text-[11px] text-[#86868B] mt-1">
                  = ({rtoUnits} RTO Units / {totalOrderedUnits} Total Dispatched Units) × 100 ={" "}
                  <span className="font-semibold text-[#1D1D1F]">{rtoRate}%</span>
                </div>
              </div>

              {/* Channel RTO Breakdown Table */}
              <div>
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Marketplace Dispatch vs RTO Performance
                </p>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04] bg-white text-xs">
                  {channelBreakdown.map((ch) => {
                    const chOrders = relevantOrders.filter((o) => o.marketplace === ch.channel);
                    const chDispatched = chOrders.reduce(
                      (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0),
                      0
                    );
                    const chRate =
                      chDispatched > 0
                        ? ((ch.rtoUnits / chDispatched) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <div
                        key={ch.channel}
                        className="flex items-center justify-between px-4 py-3 bg-white hover:bg-[#FAFAFC] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-[#86868B]" />
                          <span className="font-medium text-[#1D1D1F]">{ch.channel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-[#86868B]">
                            {ch.rtoUnits} RTO / {chDispatched} Disp.
                          </span>
                          <span
                            className={`font-semibold tabular-nums min-w-[50px] text-right ${
                              parseFloat(chRate) > 20
                                ? "text-rose-600"
                                : parseFloat(chRate) > 0
                                ? "text-amber-700"
                                : "text-[#288548]"
                            }`}
                          >
                            {chRate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── CARD 3: OLD & AGING BACKLOG BREAKDOWN ── */}
          {cardType === "oldAgingBacklog" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Critical (&gt; 14 Days)
                  </span>
                  <span className="text-xl font-semibold text-rose-600 tracking-tight tabular-nums block mt-1">
                    {agingOver14.length}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {agingOver14.reduce((s, r) => s + r.quantity, 0)} units resting
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Moderate (7-14 Days)
                  </span>
                  <span className="text-xl font-semibold text-amber-700 tracking-tight tabular-nums block mt-1">
                    {aging7to14.length}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {aging7to14.reduce((s, r) => s + r.quantity, 0)} units
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Fresh (&lt; 7 Days)
                  </span>
                  <span className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums block mt-1">
                    {agingUnder7.length}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {agingUnder7.reduce((s, r) => s + r.quantity, 0)} units
                  </span>
                </div>
              </div>

              {/* Backlog Type Split */}
              <div>
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Backlog Composition (&gt; 14 Days)
                </p>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04] bg-white text-xs">
                  <div className="p-4 bg-white hover:bg-[#FAFAFC] flex items-center justify-between transition-colors">
                    <div>
                      <span className="font-medium text-[#1D1D1F] block">Customer Returns Overdue</span>
                      <span className="text-[11px] text-[#86868B] mt-0.5 block">
                        Awaiting physical unboxing, QC grading, or customer dispute filing
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums">
                        {agingOver14.filter((r) => r.returnType !== "RTO").length} packages
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-white hover:bg-[#FAFAFC] flex items-center justify-between transition-colors">
                    <div>
                      <span className="font-medium text-[#1D1D1F] block">RTO Courier Parcels Overdue</span>
                      <span className="text-[11px] text-[#86868B] mt-0.5 block">
                        Courier hub return undelivered packages awaiting restock intake
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums">
                        {agingOver14.filter((r) => r.returnType === "RTO").length} packages
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CARD 4: DISPUTE CLAIM POTENTIAL BREAKDOWN ── */}
          {cardType === "disputeClaimPotential" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Claim Potential
                  </span>
                  <span className="text-xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums block mt-1">
                    {formatINR(claimCost)}
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {damagedReturns.length} damaged packages
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Actionable / Unfiled
                  </span>
                  <span className="text-xl font-semibold text-purple-700 tracking-tight tabular-nums block mt-1">
                    {unfiledClaims.length} ready
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    {formatINR(unfiledLoss)} recoverable
                  </span>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                    Claims Filed
                  </span>
                  <span className="text-xl font-semibold text-[#288548] tracking-tight tabular-nums block mt-1">
                    {filedClaims.length} filed
                  </span>
                  <span className="text-[11px] text-[#86868B] block mt-0.5">
                    In dispute adjudication
                  </span>
                </div>
              </div>

              {/* Damaged Packages List */}
              <div>
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Damaged Return Parcels
                </p>
                <div className="rounded-2xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04] bg-white text-xs">
                  {damagedReturns.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#86868B]">
                      No damaged or dispute-eligible returns recorded in current channel.
                    </div>
                  ) : (
                    damagedReturns.map((r) => (
                      <div
                        key={r.id}
                        className="p-3.5 bg-white hover:bg-[#FAFAFC] flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1D1D1F]">{r.id}</span>
                            <span className="text-[11px] text-[#86868B]">({r.orderId})</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-black/[0.04] text-[#6E6E73]">
                              {r.marketplace}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#86868B] mt-0.5">{r.productName || r.sku}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-rose-600 tabular-nums block">
                            Loss: {formatINR(r.lossAmount)}
                          </span>
                          {r.claimId ? (
                            <span className="text-[10px] font-medium text-emerald-900 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                              Claim: {r.claimId}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-purple-900 bg-purple-500/10 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                              Unfiled (Eligible)
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {cardType === "totalReturnsLoss" && onSelectTab && (
              <>
                <button
                  onClick={() => {
                    onSelectTab("CUSTOMER_RETURN");
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.03] text-[#1D1D1F] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Filter Customer Returns ({customerReturns.length})</span>
                  <ArrowRight className="w-3 h-3 text-[#86868B]" />
                </button>
                <button
                  onClick={() => {
                    onSelectTab("RTO");
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.03] text-[#1D1D1F] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Filter RTOs ({rtoReturns.length})</span>
                  <ArrowRight className="w-3 h-3 text-[#86868B]" />
                </button>
              </>
            )}

            {cardType === "rtoFailureRate" && onSelectTab && (
              <button
                onClick={() => {
                  onSelectTab("RTO");
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.03] text-[#1D1D1F] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Filter RTO Records ({rtoReturns.length})</span>
                <ArrowRight className="w-3 h-3 text-[#86868B]" />
              </button>
            )}

            {cardType === "oldAgingBacklog" && onSelectTab && (
              <button
                onClick={() => {
                  onSelectTab("OLD_RETURNS");
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-black/[0.08] hover:bg-black/[0.03] text-[#1D1D1F] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Filter Aging Backlog ({agingOver14.length})</span>
                <ArrowRight className="w-3 h-3 text-[#86868B]" />
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-[#1D1D1F] hover:bg-black active:scale-[0.99] text-white text-xs font-medium rounded-xl transition shadow-[0_1px_3px_rgba(0,0,0,0.15)] cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
