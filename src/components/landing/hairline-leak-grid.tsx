"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowRight, Clock, ShieldAlert, TrendingDown } from "lucide-react";

export function HairlineLeakGrid() {
  const [feeRateToggle, setFeeRateToggle] = useState<"expected" | "charged">("charged");

  return (
    <section className="border-t border-black/[0.08] bg-[#FAF7F2] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header: Minimalist & Punchy */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-black/[0.08] text-xs font-mono font-medium text-[#0055FF] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF] animate-pulse" />
            <span>MARGIN LEAKAGE RADAR</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.035em] text-[#121214] leading-[1.05]">
            Where e-commerce margin silently bleeds.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#736F66] leading-relaxed max-w-xl">
            Gross revenue hides real losses. Four systemic leak points drain 3% to 5% of monthly revenue before bank settlements arrive.
          </p>
        </div>

        {/* 4 Clean Elevated Cards with Beautiful Shadows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* Card 1: Silent Commission Creep */}
          <div className="rounded-2xl bg-white border border-black/[0.08] p-7 sm:p-9 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] flex flex-col justify-between group hover:border-black/20 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-[#736F66] font-medium">LEAK 01 // PLATFORM</span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-mono font-semibold">
                  +3.8% Surcharge
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#121214] tracking-tight">
                Silent Marketplace Fee Creep
              </h3>
              <p className="mt-2 text-sm text-[#736F66] leading-relaxed">
                Platforms quietly revise closing fees and referral tiers across categories. MarginFlow compares every deduction against verified master rate cards.
              </p>
            </div>

            {/* Interactive Living Visual: Expected vs Charged */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="flex items-center justify-between text-xs font-mono mb-3">
                <span className="text-[#736F66]">COMMISSION RATE AUDIT</span>
                <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-lg border border-black/[0.06]">
                  <button
                    onClick={() => setFeeRateToggle("expected")}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                      feeRateToggle === "expected"
                        ? "bg-white text-[#121214] shadow-2xs font-semibold"
                        : "text-[#736F66]"
                    }`}
                  >
                    Catalog Rate
                  </button>
                  <button
                    onClick={() => setFeeRateToggle("charged")}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                      feeRateToggle === "charged"
                        ? "bg-rose-50 text-rose-600 shadow-2xs font-semibold"
                        : "text-[#736F66]"
                    }`}
                  >
                    Billed Rate
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-black/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#736F66] block">
                    {feeRateToggle === "expected" ? "Contracted Agreement" : "Settlement Statement"}
                  </span>
                  <span className="text-base font-mono font-bold text-[#121214]">
                    {feeRateToggle === "expected" ? "12.0% (₹180.00)" : "15.8% (₹237.00)"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-[#736F66] block">Net Impact</span>
                  <span className={`text-xs font-mono font-bold ${
                    feeRateToggle === "charged" ? "text-rose-600" : "text-[#129E52]"
                  }`}>
                    {feeRateToggle === "charged" ? "−₹57.00 Leak / Order" : "Target Margin"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Volumetric Weight Slab Inflation */}
          <div className="rounded-2xl bg-white border border-black/[0.08] p-7 sm:p-9 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] flex flex-col justify-between group hover:border-black/20 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-[#736F66] font-medium">LEAK 02 // LOGISTICS</span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-xs font-mono font-semibold">
                  +1,080g Overcharge
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#121214] tracking-tight">
                Courier Weight Slab Inflation
              </h3>
              <p className="mt-2 text-sm text-[#736F66] leading-relaxed">
                Logistics partners routinely classify 420g items into 2kg deadweight slabs. We audit actual SKU dimensions against courier bills to claim instant refunds.
              </p>
            </div>

            {/* Living Visual 2: Dimension Comparison Bar */}
            <div className="mt-8 pt-6 border-t border-black/[0.06] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#736F66]">Catalog Baseline</span>
                <span className="text-[#121214] font-semibold">420 grams (Slab 0.5kg)</span>
              </div>
              
              <div className="w-full bg-black/[0.06] h-2 rounded-full overflow-hidden relative">
                <div className="bg-[#0055FF] h-full w-[28%] rounded-full" />
                <div className="bg-rose-500 h-full w-[72%] absolute right-0 top-0 opacity-80" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[#736F66]">Courier Billed Weight</span>
                <span className="text-rose-600 font-bold">1,500 grams (Slab 2.0kg)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-between font-bold text-[11px]">
                <span>Discrepancy Detected</span>
                <span>−₹185.00 / Order Flagged</span>
              </div>
            </div>
          </div>

          {/* Card 3: Two-Way Courier Toll on RTOs */}
          <div className="rounded-2xl bg-white border border-black/[0.08] p-7 sm:p-9 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] flex flex-col justify-between group hover:border-black/20 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-[#736F66] font-medium">LEAK 03 // RETURNS</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-[#E66A1F] text-xs font-mono font-semibold">
                  Two-Way Toll
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#121214] tracking-tight">
                Double Freight Toll on RTOs
              </h3>
              <p className="mt-2 text-sm text-[#736F66] leading-relaxed">
                When a Cash-on-Delivery delivery bounces, couriers bill forward freight and reverse return shipping. High RTO rates wipe out 3 successful sales.
              </p>
            </div>

            {/* Living Visual 3: Direct Toll Split */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-black/[0.05]">
                  <span className="block text-[10px] text-[#736F66] mb-0.5">FORWARD</span>
                  <span className="font-bold text-[#121214]">₹95.00</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-black/[0.05]">
                  <span className="block text-[10px] text-[#736F66] mb-0.5">REVERSE</span>
                  <span className="font-bold text-[#121214]">₹110.00</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="block text-[10px] text-rose-600 mb-0.5">CASH BURN</span>
                  <span className="font-bold text-rose-600">−₹205.00</span>
                </div>
              </div>
              <p className="text-[11px] font-mono text-[#736F66] mt-3 text-center">
                Net result: ₹0 revenue earned, ₹205 courier cash evaporated.
              </p>
            </div>
          </div>

          {/* Card 4: Expiring Dispute Deadlines */}
          <div className="rounded-2xl bg-white border border-black/[0.08] p-7 sm:p-9 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] flex flex-col justify-between group hover:border-black/20 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs text-[#736F66] font-medium">LEAK 04 // CLAIMS</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#129E52] text-xs font-mono font-semibold">
                  Auto-Recovery
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#121214] tracking-tight">
                Expired SAFE-T Claim Windows
              </h3>
              <p className="mt-2 text-sm text-[#736F66] leading-relaxed">
                Marketplaces give rigid 7–30 day claim windows for damaged, swapped, or empty returns. Without automated tracking, claims expire and cash is permanently lost.
              </p>
            </div>

            {/* Living Visual 4: SLA Countdown & Pre-compiled Dossier */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-black/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#E66A1F] animate-spin-slow" />
                  <div>
                    <span className="text-xs font-semibold text-[#121214] block">Amazon SAFE-T Filing</span>
                    <span className="text-[11px] font-mono text-[#736F66]">AWB-77192 • Damaged Return</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-[#E66A1F] font-mono text-xs font-bold">
                  ⏱ 4 Days Left
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#129E52]">
                <span>✓ Invoice snapshot attached</span>
                <span>✓ Ready to file</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
