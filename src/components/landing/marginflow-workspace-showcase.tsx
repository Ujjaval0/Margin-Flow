"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Layers, RotateCcw, ShieldCheck, FileCheck, DollarSign } from "lucide-react";

export function MarginFlowWorkspaceShowcase() {
  const [activeTab, setActiveTab] = useState<"orders" | "returns" | "claims" | "settlements">("orders");

  return (
    <section id="workspace" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] border-t border-[#cfdfd1]">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Heading */}
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
            Not another spreadsheet.<br />
            <span className="font-serif italic font-normal text-[#00872e]">
              Your daily workspace.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Real unit economics, reverse logistics RTO tracking, and audit-ready dispute dossiers in one cockpit.
          </p>

          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#193022] hover:bg-black text-white text-xs font-semibold transition-all shadow-sm"
            >
              <span>Explore Live Demo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* macOS Style Application Window (Exact MarginFlow structure) */}
        <div className="rounded-3xl bg-white border border-[#cfdfd1] shadow-[0_24px_60px_rgba(25,48,34,0.08)] overflow-hidden">
          
          {/* macOS Title Bar */}
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-[#f1f5ee] border-b border-[#cfdfd1] flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="flex gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56] inline-block" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e] inline-block" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f] inline-block" />
              </span>
              <span className="ml-2 sm:ml-3 font-semibold text-[#193022] text-[11px] sm:text-xs truncate">
                MarginFlow Workspace • Financial Cockpit
              </span>
            </div>

            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-[11px] text-[#00872e] font-semibold hover:underline shrink-0"
            >
              <span>Open in app</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Dynamic Content Frame based on Active Tab */}
          <div className="p-4 sm:p-6 lg:p-10 bg-gradient-to-b from-white to-[#f7faf5]">
            {activeTab === "orders" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-bold text-[#193022] tracking-wider uppercase">ORDER WATERFALL // TRUE CM2 & POAS</span>
                    <p className="text-xs text-[#5c7062]">Gross checkout price verified against locked COGS, courier fees, and return losses.</p>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-50 text-[#00872e] text-xs font-semibold tabular-nums">
                    +41.3% True Net Margin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">INVOICED PRICE</span>
                    <strong className="text-xl text-[#193022] block mt-1 tabular-nums font-semibold">₹1,499.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Gross checkout value</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">UNIT COGS</span>
                    <strong className="text-xl text-rose-700 block mt-1 tabular-nums font-semibold">−₹420.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Locked purchase cost</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">COURIER & COMM</span>
                    <strong className="text-xl text-rose-700 block mt-1 tabular-nums font-semibold">−₹460.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Platform & logistics fees</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">CLEARED BANK CASH</span>
                    <strong className="text-xl text-[#71d78e] block mt-1 tabular-nums font-semibold">+₹619.00</strong>
                    <span className="text-[10px] text-[#8da494]">Deposited in account</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "returns" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-bold text-[#193022] tracking-wider uppercase">REVERSE LOGISTICS &amp; RTO TOLL RADAR</span>
                    <p className="text-xs text-[#5c7062]">Isolates non-refundable two-way shipping freight from customer return damage losses.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold tabular-nums">
                    ⚠️ −₹205.00 RTO Cash Bleed Isolated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-600 block">RTO COD BOUNCE</span>
                    <strong className="text-lg text-rose-700 block mt-1 tabular-nums font-semibold">−₹205.00 Two-Way Freight</strong>
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">₹95 Forward + ₹110 Reverse Toll</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">DAMAGED RETURN QC</span>
                    <strong className="text-lg text-[#193022] block mt-1 tabular-nums font-semibold">₹420.00 COGS Loss</strong>
                    <span className="text-[10px] text-amber-700 mt-1 block font-medium">Salvage: ₹100 • Claim Queued</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">SELLABLE PUTAWAY</span>
                    <strong className="text-lg text-[#71d78e] block mt-1 tabular-nums font-semibold">1-Click Restock</strong>
                    <span className="text-[10px] text-[#8da494] mt-1 block">Stock Replenished (+1 Unit)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "claims" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-bold text-[#193022] tracking-wider uppercase">DISPUTE RECOVERY & SAFE-T DOCKET</span>
                    <p className="text-xs text-[#5c7062]">Active SLA countdown timers and pre-compiled SAFE-T/SPF evidence dossiers.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-[#b67d46] text-xs font-semibold tabular-nums">
                    ⏱ 4 Days Left in SLA
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <strong className="text-sm text-[#193022] block font-semibold">Claim #CLM-88392 • Damaged Return</strong>
                    <span className="text-xs text-[#5c7062]">Amazon SAFE-T dossier compiled with invoice, unboxing QC, and loss calculation.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-[#00872e] text-xs font-bold">
                      ✓ Evidence Ready
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#193022] text-white text-xs font-bold tabular-nums">
                      ₹840.00 Claim Value
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settlements" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-bold text-[#193022] tracking-wider uppercase">BANK SETTLEMENT &amp; GENERAL LEDGER</span>
                    <p className="text-xs text-[#5c7062]">One-to-one matching between marketplace UTR remittances, orders, and 1% tax withholdings.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#00872e] text-xs font-semibold tabular-nums">
                    100% Reconciled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">REMITTANCE UTR</span>
                    <strong className="text-base text-[#193022] block mt-1 font-mono font-medium">AXIS-882940124</strong>
                    <span className="text-[10px] text-[#5c7062]">Direct Bank Deposit</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">TAX WITHHELD (TCS & TDS)</span>
                    <strong className="text-base text-[#00872e] block mt-1 tabular-nums font-semibold">₹30.00 (Isolated)</strong>
                    <span className="text-[10px] text-[#5c7062]">Tax Asset, Not Expense</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">VARIANCE</span>
                    <strong className="text-base text-[#71d78e] block mt-1 tabular-nums font-semibold">₹0.00 Exact Match</strong>
                    <span className="text-[10px] text-[#8da494]">Audit-Ready</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4 Interactive Feature Category Buttons (Exact MarginFlow .platform-shortcuts) */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-[#cfdfd1] bg-[#f1f5ee]">
            {[
              { id: "orders", label: "Orders & CM2", sub: "True net profit per SKU", icon: Layers },
              { id: "returns", label: "Returns & RTO", sub: "Isolate reverse freight tolls", icon: RotateCcw },
              { id: "claims", label: "Claims Docket", sub: "Pre-compiled SLA dossiers", icon: FileCheck },
              { id: "settlements", label: "Settlements", sub: "UTR bank remittance match", icon: ShieldCheck },
            ].map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`p-3.5 sm:p-4 text-left transition-all cursor-pointer border-[#cfdfd1] ${
                    idx % 2 === 0 ? "border-r" : ""
                  } ${idx < 2 ? "border-b md:border-b-0" : ""} ${
                    idx < 3 ? "md:border-r" : "md:border-r-0"
                  } ${
                    isActive ? "bg-white text-[#193022]" : "hover:bg-white/60 text-[#5c7062]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#00872e]" : "text-[#5c7062]"}`} />
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`} />
                  </div>
                  <strong className="block text-xs font-mono font-bold truncate">
                    {tab.label}
                  </strong>
                  <span className="block text-[11px] truncate opacity-75 mt-0.5">
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}

