"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, Layers, Scale, ShieldCheck, FileCheck, DollarSign } from "lucide-react";

export function MarginFlowWorkspaceShowcase() {
  const [activeTab, setActiveTab] = useState<"orders" | "weight" | "claims" | "settlements">("orders");

  return (
    <section id="workspace" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] border-t border-[#cfdfd1] select-none">
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
            Real unit economics, courier deadweight detection, and automated dispute dossiers in one cockpit.
          </p>

          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#193022] hover:bg-black text-white text-xs font-mono font-semibold transition-all shadow-sm"
            >
              <span>Explore Live Demo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* macOS Style Application Window (Exact MarginFlow structure) */}
        <div className="rounded-3xl bg-white border border-[#cfdfd1] shadow-[0_24px_60px_rgba(25,48,34,0.08)] overflow-hidden">
          
          {/* macOS Title Bar */}
          <div className="px-6 py-4 bg-[#f1f5ee] border-b border-[#cfdfd1] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
              </span>
              <span className="ml-3 font-semibold text-[#193022]">MarginFlow Workspace • Financial Cockpit</span>
            </div>

            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-[11px] text-[#00872e] font-semibold hover:underline"
            >
              <span>Open in app</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Dynamic Content Frame based on Active Tab */}
          <div className="p-6 sm:p-10 bg-gradient-to-b from-white to-[#f7faf5]">
            {activeTab === "orders" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#193022]">ORDER WATERFALL // TRUE CM2 & POAS</span>
                    <p className="text-xs text-[#5c7062]">Gross checkout price verified against locked COGS, courier fees, and return losses.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#00872e] text-xs font-mono font-bold">
                    +41.3% True Net Margin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">INVOICED PRICE</span>
                    <strong className="text-xl text-[#193022] block mt-1">₹1,499.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Gross checkout value</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">UNIT COGS</span>
                    <strong className="text-xl text-rose-700 block mt-1">−₹420.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Locked purchase cost</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">COURIER & COMM</span>
                    <strong className="text-xl text-rose-700 block mt-1">−₹460.00</strong>
                    <span className="text-[10px] text-[#5c7062]">Platform & logistics fees</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">CLEARED BANK CASH</span>
                    <strong className="text-xl text-[#71d78e] block mt-1">+₹619.00</strong>
                    <span className="text-[10px] text-[#8da494]">Deposited in account</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "weight" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#193022]">COURIER WEIGHT SLAB RADAR</span>
                    <p className="text-xs text-[#5c7062]">Disparity detection between catalog dimensions and billed courier weight slabs.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-mono font-bold">
                    ⚠️ −₹185.00 Flagged Overcharge
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">CATALOG BASELINE</span>
                    <strong className="text-lg text-[#193022] block mt-1">420 grams (0.5kg Slab)</strong>
                    <span className="text-[10px] text-[#00872e] mt-1 block">Verified SKU Spec</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-600 block">COURIER BILLED</span>
                    <strong className="text-lg text-rose-700 block mt-1">1,500 grams (2.0kg Slab)</strong>
                    <span className="text-[10px] text-rose-600 mt-1 block">Inflated Weight Slab</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">DISPUTE CLAIM QUEUED</span>
                    <strong className="text-lg text-[#71d78e] block mt-1">+₹185.00 Refund</strong>
                    <span className="text-[10px] text-[#8da494] mt-1 block">Auto-Filed Before Settlement</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "claims" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#193022]">DISPUTE RECOVERY & SAFE-T DOCKET</span>
                    <p className="text-xs text-[#5c7062]">Active SLA countdown timers and pre-compiled SAFE-T/SPF evidence dossiers.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-[#b67d46] text-xs font-mono font-bold">
                    ⏱ 4 Days Left in SLA
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                  <div className="space-y-1">
                    <strong className="text-sm text-[#193022] block">Claim #CLM-88392 • Damaged Return</strong>
                    <span className="text-xs text-[#5c7062]">Amazon SAFE-T dossier compiled with invoice and unboxing telemetry.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-[#00872e] text-xs font-bold">
                      ✓ Evidence Ready
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#193022] text-white text-xs font-bold">
                      ₹840.00 Claim Value
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settlements" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-[#e5ebe3]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#193022]">BANK SETTLEMENT RECONCILIATION</span>
                    <p className="text-xs text-[#5c7062]">One-to-one matching between marketplace UTR remittances, orders, and 1% tax withholdings.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#00872e] text-xs font-mono font-bold">
                    100% Reconciled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">REMITTANCE UTR</span>
                    <strong className="text-base text-[#193022] block mt-1">AXIS-882940124</strong>
                    <span className="text-[10px] text-[#5c7062]">Direct Bank Deposit</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1]">
                    <span className="text-[10px] text-[#5c7062] block">TAX WITHHELD (TCS & TDS)</span>
                    <strong className="text-base text-[#00872e] block mt-1">₹30.00 (Isolated)</strong>
                    <span className="text-[10px] text-[#5c7062]">Tax Asset, Not Expense</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#193022] text-white">
                    <span className="text-[10px] text-[#71d78e] block">VARIANCE</span>
                    <strong className="text-base text-[#71d78e] block mt-1">₹0.00 Exact Match</strong>
                    <span className="text-[10px] text-[#8da494]">Audit-Ready</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4 Interactive Feature Category Buttons (Exact MarginFlow .platform-shortcuts) */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-[#cfdfd1] divide-x divide-[#cfdfd1] bg-[#f1f5ee]">
            {[
              { id: "orders", label: "Orders & CM2", sub: "True net profit per SKU", icon: Layers },
              { id: "weight", label: "Weight Radar", sub: "Courier overcharge alerts", icon: Scale },
              { id: "claims", label: "Claims Docket", sub: "7-30 day dispute countdown", icon: FileCheck },
              { id: "settlements", label: "Settlements", sub: "UTR bank remittance match", icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`p-4 text-left transition-all cursor-pointer ${
                    isActive ? "bg-white text-[#193022]" : "hover:bg-white/60 text-[#5c7062]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#00872e]" : "text-[#5c7062]"}`} />
                    <ArrowUpRight className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-0"}`} />
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

