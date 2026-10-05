"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, DollarSign, Sparkles, TrendingUp } from "lucide-react";

interface SpectrumPoint {
  label: string;
  category: string;
  amount: string;
  isPositive: boolean;
  isNet?: boolean;
  xRatio: number;
  description: string;
}

const SPECTRUM_POINTS: SpectrumPoint[] = [
  {
    label: "CUSTOMER ORDER PRICE",
    category: "Gross Invoiced",
    amount: "₹1,499",
    isPositive: true,
    xRatio: 0.1,
    description: "Total payment collected at marketplace checkout.",
  },
  {
    label: "PRODUCT UNIT COGS",
    category: "Purchase Cost",
    amount: "−₹420",
    isPositive: false,
    xRatio: 0.28,
    description: "Locked purchase basis so price fluctuations don't distort history.",
  },
  {
    label: "COURIER FREIGHT & RTO",
    category: "Logistics Toll",
    amount: "−₹315",
    isPositive: false,
    xRatio: 0.48,
    description: "Two-way shipping plus deadweight volumetric fees.",
  },
  {
    label: "MARKETPLACE CUT",
    category: "Referral & Closing",
    amount: "−₹220",
    isPositive: false,
    xRatio: 0.66,
    description: "Platform commission tier and payment processing surcharges.",
  },
  {
    label: "MARGINFLOW RECOVERY",
    category: "Overcharge Disputed",
    amount: "+₹185",
    isPositive: true,
    xRatio: 0.82,
    description: "Reclaimed funds from courier weight inflation & SAFE-T claims.",
  },
  {
    label: "REAL NET BANK CASH",
    category: "Cleared Bank Payout",
    amount: "₹729",
    isPositive: true,
    isNet: true,
    xRatio: 0.95,
    description: "True operating cash deposited in your current account.",
  },
];

const GMV_TIERS = [
  { label: "₹25 Lakhs", monthly: "₹95,000", annual: "₹11.4 Lakhs", gmvNum: 2500000 },
  { label: "₹1 Crore", monthly: "₹3,80,000", annual: "₹45.6 Lakhs", gmvNum: 10000000 },
  { label: "₹5 Crores", monthly: "₹19,00,000", annual: "₹2.28 Crores", gmvNum: 50000000 },
  { label: "₹20 Crores+", monthly: "₹76,00,000", annual: "₹9.12 Crores", gmvNum: 200000000 },
];

export function GlowingSpectrum() {
  const [activeIdx, setActiveIdx] = useState<number>(4);
  const [activeTierIdx, setActiveTierIdx] = useState<number>(1);

  const activePoint = SPECTRUM_POINTS[activeIdx];
  const activeTier = GMV_TIERS[activeTierIdx];

  return (
    <section className="border-t border-black/[0.08] bg-[#FAF7F2] py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-black/[0.08] text-xs font-mono font-medium text-[#0055FF] mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#0055FF]" />
            <span>ROI & MARGIN RECOVERY CALCULATOR</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.035em] text-[#121214] leading-[1.05]">
            Where every rupee ends up.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#736F66] leading-relaxed">
            Follow the journey from an order checkout to your company bank ledger, and calculate what automated reconciliation saves your brand.
          </p>
        </div>

        {/* 1. Interactive GMV Margin Recovery Simulator Card */}
        <div className="mb-14 rounded-3xl bg-white border border-black/[0.08] p-6 sm:p-10 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_2px_4px_-1px_rgba(0,0,0,0.03),0px_6px_12px_-2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-black/[0.06]">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#736F66] font-semibold block mb-2">
                SELECT YOUR MONTHLY MARKETPLACE GMV
              </span>
              <div className="flex flex-wrap gap-2">
                {GMV_TIERS.map((tier, idx) => (
                  <button
                    key={tier.label}
                    onClick={() => setActiveTierIdx(idx)}
                    className={`px-4 py-2 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer ${
                      activeTierIdx === idx
                        ? "bg-[#121214] text-white shadow-sm"
                        : "bg-[#FAF7F2] text-[#736F66] hover:text-[#121214] border border-black/[0.06]"
                    }`}
                  >
                    {tier.label} / mo
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6 sm:gap-10">
              <div>
                <span className="text-xs font-mono text-[#736F66] block">ESTIMATED MONTHLY RECOVERY</span>
                <span className="text-2xl sm:text-3xl font-mono font-bold text-[#129E52]">
                  {activeTier.monthly}
                </span>
              </div>
              <div className="border-l border-black/[0.08] pl-6 sm:pl-10">
                <span className="text-xs font-mono text-[#736F66] block">ANNUAL CAPITAL PRESERVED</span>
                <span className="text-2xl sm:text-3xl font-mono font-bold text-[#0055FF]">
                  {activeTier.annual}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs font-mono text-[#736F66] pt-4">
            *Based on verified 3.8% average historical recovery from weight disputes, commission corrections, and SAFE-T claims.
          </p>
        </div>

        {/* 2. The Rupee Waterfall Journey Spectrum */}
        <div className="relative py-8 select-none border-y border-black/[0.08]">
          
          {/* Subtle connecting track line */}
          <div className="space-y-10 sm:space-y-12 relative z-10">
            {SPECTRUM_POINTS.map((pt, idx) => {
              const isSelected = activeIdx === idx;
              return (
                <div key={pt.label} className="flex items-center justify-between group">
                  
                  {/* Left Label */}
                  <span className={`text-xs font-mono font-bold tracking-wider transition-colors w-44 sm:w-56 text-left ${
                    isSelected ? "text-[#121214]" : "text-[#736F66]"
                  }`}>
                    {pt.label}
                  </span>

                  {/* Horizontal Wire Line with Node Dot */}
                  <div className="flex-1 mx-4 sm:mx-8 relative flex items-center">
                    <div className="w-full h-[1.5px] bg-black/[0.08]" />

                    {/* Node Dot Button */}
                    <button
                      onClick={() => setActiveIdx(idx)}
                      style={{ left: `${pt.xRatio * 100}%` }}
                      className={`absolute -translate-x-1/2 flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none ${
                        isSelected
                          ? "w-8 h-8 rounded-full bg-[#121214] text-white shadow-lg ring-4 ring-blue-500/20 scale-110"
                          : pt.isNet
                          ? "w-7 h-7 rounded-full bg-[#129E52] text-white hover:scale-110"
                          : idx === 4
                          ? "w-7 h-7 rounded-full bg-[#0055FF] text-white hover:scale-110"
                          : "w-5 h-5 rounded-full bg-[#D1CDC2] hover:bg-[#121214] hover:scale-110"
                      }`}
                      aria-label={`Select ${pt.label}`}
                    >
                      {isSelected ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                      )}
                    </button>
                  </div>

                  {/* Right Value */}
                  <span className={`font-mono text-sm sm:text-base font-bold w-24 sm:w-28 text-right transition-colors ${
                    pt.isNet
                      ? "text-[#129E52]"
                      : pt.isPositive
                      ? "text-[#0055FF]"
                      : "text-rose-600"
                  }`}>
                    {pt.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Inspection Node Status Card */}
        <div className="mt-8 p-6 sm:p-8 bg-white border border-black/[0.08] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div>
            <span className="text-[11px] font-mono text-[#0055FF] uppercase tracking-wider font-semibold block mb-1">
              {activePoint.category}
            </span>
            <h4 className="text-xl font-bold text-[#121214]">
              {activePoint.label}
            </h4>
            <p className="text-xs sm:text-sm text-[#736F66] mt-1 font-mono">
              {activePoint.description}
            </p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="text-xs font-mono text-[#736F66] block">Per-Unit Impact</span>
            <span className={`font-mono text-2xl sm:text-3xl font-bold ${
              activePoint.isNet
                ? "text-[#129E52]"
                : activePoint.isPositive
                ? "text-[#0055FF]"
                : "text-rose-600"
            }`}>
              {activePoint.amount}
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
