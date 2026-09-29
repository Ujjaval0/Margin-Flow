"use client";

import React from "react";

export function HairlineLeakGrid() {
  return (
    <section className="border-t border-black/[0.08] bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0055FF] mb-3">
            Marketplace Economics
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#121214] leading-[1.05]">
            Where Indian sellers silently lose money every single week.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#736F66] leading-relaxed max-w-xl">
            Gross revenue charts create the illusion of profitability. Four systemic leakage points drain lakhs before payouts hit your bank account.
          </p>
        </div>

        {/* The 4-Quadrant Hairline Border Grid (Medusa & Digital Swift style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 border border-black/[0.08] bg-white divide-y md:divide-y-0 md:divide-x divide-black/[0.08]">
          
          {/* Quadrant 1: Silent Commission Creep */}
          <div className="p-8 sm:p-12 flex flex-col justify-between group hover:bg-[#FAF7F2]/40 transition-colors">
            <div>
              {/* Electric Blue Pixel Warning Indicator (Inspired by Image 2) */}
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-[#736F66]">LEAK 01 // PLATFORM</span>
                {/* SVG Pixel Warning Triangle */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0055FF]">
                  <path d="M12 2L2 22H22L12 2Z" fill="#0055FF" />
                  <rect x="11" y="8" width="2" height="7" fill="white" />
                  <rect x="11" y="17" width="2" height="2" fill="white" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#121214] tracking-tight">
                Silent Marketplace Fee Creep
              </h3>
              <p className="mt-3 text-sm text-[#736F66] leading-relaxed">
                Platforms quietly update closing fees, referral percentages, and pick-and-pack rates across categories. A ₹12 difference per unit across 10,000 monthly orders drains ₹1,20,000 without raising a single flag.
              </p>
            </div>

            {/* Wireframe Diagram 1 */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="h-20 w-full flex items-end gap-1.5 pt-4">
                {[35, 42, 38, 55, 48, 62, 78, 65, 84, 95].map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      style={{ height: `${val}%` }}
                      className={`w-full rounded-xs transition-all ${
                        i >= 6 ? "bg-[#0055FF]" : "bg-black/[0.08]"
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono text-[#736F66] mt-2">
                <span>EXPECTED COMMISSION RATE</span>
                <span className="text-[#0055FF] font-semibold">+3.8% UNANNOUNCED SURCHARGE</span>
              </div>
            </div>
          </div>

          {/* Quadrant 2: Volumetric Weight Inflation */}
          <div className="p-8 sm:p-12 flex flex-col justify-between group hover:bg-[#FAF7F2]/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-[#736F66]">LEAK 02 // LOGISTICS</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0055FF]">
                  <path d="M12 2L2 22H22L12 2Z" fill="#0055FF" />
                  <rect x="11" y="8" width="2" height="7" fill="white" />
                  <rect x="11" y="17" width="2" height="2" fill="white" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#121214] tracking-tight">
                Courier Weight Slab Inflation
              </h3>
              <p className="mt-3 text-sm text-[#736F66] leading-relaxed">
                Logistics partners routinely categorize lightweight items into inflated weight slabs—billing 1.5 kg for a 420g shirt. Without continuous catalog dimension verification, you overpay thousands every settlement cycle.
              </p>
            </div>

            {/* Wireframe Diagram 2 */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="flex items-center justify-between text-xs font-mono py-2 border-b border-black/[0.05]">
                <span className="text-[#736F66]">Actual Catalog Baseline</span>
                <span className="font-semibold text-[#121214]">420 grams (Slab 0.5kg)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono py-2 border-b border-black/[0.05]">
                <span className="text-[#736F66]">Courier Billed Weight</span>
                <span className="font-semibold text-rose-600">1,500 grams (Slab 2.0kg)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono pt-2 text-[#0055FF] font-bold">
                <span>Discrepancy Detected</span>
                <span>−₹185.00 / Order</span>
              </div>
            </div>
          </div>

          {/* Quadrant 3: Double Freight on RTOs */}
          <div className="p-8 sm:p-12 flex flex-col justify-between group hover:bg-[#FAF7F2]/40 transition-colors border-t border-black/[0.08]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-[#736F66]">LEAK 03 // RETURNS</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0055FF]">
                  <path d="M12 2L2 22H22L12 2Z" fill="#0055FF" />
                  <rect x="11" y="8" width="2" height="7" fill="white" />
                  <rect x="11" y="17" width="2" height="2" fill="white" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#121214] tracking-tight">
                Two-Way Courier Toll on RTOs
              </h3>
              <p className="mt-3 text-sm text-[#736F66] leading-relaxed">
                When an undelivered Cash-on-Delivery order bounces, you pay forward logistics and reverse shipping fees plus packaging loss. A single 25% RTO rate wipes out the operating profit of 3 successful sales.
              </p>
            </div>

            {/* Wireframe Diagram 3 */}
            <div className="mt-8 pt-6 border-t border-black/[0.06] flex items-center justify-between text-xs font-mono">
              <div className="text-center flex-1">
                <span className="text-[#736F66] block text-[10px]">FORWARD</span>
                <span className="font-bold text-[#121214]">₹95.00</span>
              </div>
              <span className="text-[#0055FF] font-bold">+</span>
              <div className="text-center flex-1">
                <span className="text-[#736F66] block text-[10px]">REVERSE</span>
                <span className="font-bold text-[#121214]">₹110.00</span>
              </div>
              <span className="text-[#0055FF] font-bold">=</span>
              <div className="text-center flex-1 bg-rose-50 py-1.5 rounded-sm">
                <span className="text-rose-600 block text-[10px]">TOTAL LOSS</span>
                <span className="font-bold text-rose-600">−₹205.00</span>
              </div>
            </div>
          </div>

          {/* Quadrant 4: Expiring Dispute Deadlines */}
          <div className="p-8 sm:p-12 flex flex-col justify-between group hover:bg-[#FAF7F2]/40 transition-colors border-t border-black/[0.08]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-[#736F66]">LEAK 04 // CLAIMS</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0055FF]">
                  <path d="M12 2L2 22H22L12 2Z" fill="#0055FF" />
                  <rect x="11" y="8" width="2" height="7" fill="white" />
                  <rect x="11" y="17" width="2" height="2" fill="white" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-[#121214] tracking-tight">
                Expired SAFE-T Claim Windows
              </h3>
              <p className="mt-3 text-sm text-[#736F66] leading-relaxed">
                When returns arrive damaged, swapped with stones, or missing, marketplaces enforce rigid 7–30 day claim deadlines. Without automated countdown alerts, claims lapse and money is permanently surrendered.
              </p>
            </div>

            {/* Wireframe Diagram 4 */}
            <div className="mt-8 pt-6 border-t border-black/[0.06]">
              <div className="flex items-center justify-between text-xs font-mono py-1">
                <span className="text-[#736F66]">SAFE-T Window</span>
                <span className="text-[#E66A1F] font-bold">⏱ 4 Days Remaining</span>
              </div>
              <div className="w-full bg-black/[0.06] h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#E66A1F] h-full w-[70%]" />
              </div>
              <p className="text-[11px] text-[#736F66] mt-2 font-mono">
                Dossier pre-compiled with photo checklists and AWB tracking snapshots.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
