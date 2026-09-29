"use client";

import React, { useState } from "react";

interface SpectrumPoint {
  label: string;
  category: string;
  amount: string;
  isPositive: boolean;
  isNet?: boolean;
  xRatio: number; // 0 to 1
}

const SPECTRUM_POINTS: SpectrumPoint[] = [
  { label: "CUSTOMER ORDER PRICE", category: "Gross Invoiced", amount: "₹1,499", isPositive: true, xRatio: 0.15 },
  { label: "PRODUCT UNIT COGS", category: "Purchase Basis", amount: "−₹420", isPositive: false, xRatio: 0.35 },
  { label: "COURIER FREIGHT & RTO", category: "Two-Way Logistics", amount: "−₹315", isPositive: false, xRatio: 0.52 },
  { label: "MARKETPLACE COMMISSION", category: "Referral & Closing", amount: "−₹220", isPositive: false, xRatio: 0.68 },
  { label: "DISPUTE & WEIGHT RECOVERY", category: "MarginFlow Engine", amount: "+₹185", isPositive: true, xRatio: 0.82 },
  { label: "REAL NET BANK CASH", category: "Cleared Bank Deposit", amount: "₹729", isPositive: true, isNet: true, xRatio: 0.94 },
];

export function GlowingSpectrum() {
  const [activeIdx, setActiveIdx] = useState<number>(4);

  const activePoint = SPECTRUM_POINTS[activeIdx];

  return (
    <section className="border-t border-black/[0.08] bg-[#FAF7F2] py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0055FF] mb-3">
            Cash Retention Spectrum
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#121214] leading-[1.05]">
            Where every rupee ends up.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#736F66] leading-relaxed">
            Follow the journey from an order checkout to your company bank ledger, and see the exact difference MarginFlow makes.
          </p>
        </div>

        {/* Spectrum Canvas (Image 5 aesthetic: warm canvas, horizontal lines, glowing fluid trail) */}
        <div className="relative py-10 sm:py-16 select-none border-y border-black/[0.08]">
          
          {/* SVG Glowing Fluid S-Curve (Behind tracks) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none" fill="none">
              {/* Cyan/Blue Aura Blur */}
              <path
                d="M 150 40 C 350 110, 520 180, 680 250 S 820 320, 940 360"
                stroke="#0055FF"
                strokeWidth="48"
                strokeLinecap="round"
                className="opacity-10 blur-xl"
              />
              {/* Crisp Electric Guideline */}
              <path
                d="M 150 40 C 350 110, 520 180, 680 250 S 820 320, 940 360"
                stroke="#0055FF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="4 6"
                className="opacity-50"
              />
            </svg>
          </div>

          {/* Horizontal Track Lines */}
          <div className="space-y-12 sm:space-y-14 relative z-10">
            {SPECTRUM_POINTS.map((pt, idx) => {
              const isSelected = activeIdx === idx;
              return (
                <div key={pt.label} className="flex items-center justify-between group">
                  {/* Left Label */}
                  <span className={`text-xs font-mono font-bold tracking-wider transition-colors w-48 sm:w-56 text-left ${
                    isSelected ? "text-[#121214]" : "text-[#736F66]"
                  }`}>
                    {pt.label}
                  </span>

                  {/* Horizontal Wire Line with Node Dot */}
                  <div className="flex-1 mx-4 sm:mx-10 relative flex items-center">
                    <div className="w-full h-[1.5px] bg-black/[0.08]" />

                    {/* Node Dot Button */}
                    <button
                      onClick={() => setActiveIdx(idx)}
                      style={{ left: `${pt.xRatio * 100}%` }}
                      className={`absolute -translate-x-1/2 flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none ${
                        isSelected
                          ? "w-8 h-8 rounded-full bg-[#121214] text-white shadow-lg ring-4 ring-blue-500/30 scale-110"
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

        {/* Selected Inspection Status Banner */}
        <div className="mt-12 p-6 sm:p-8 bg-white border border-black/[0.08] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div>
            <span className="text-xs font-mono text-[#0055FF] uppercase tracking-wider block mb-1">
              {activePoint.category}
            </span>
            <h4 className="text-xl font-bold text-[#121214]">
              {activePoint.label}
            </h4>
            <p className="text-xs sm:text-sm text-[#736F66] mt-1 font-mono">
              Impact on order level bank deposit reconciliation
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-mono text-[#736F66] block">Net Value</span>
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
