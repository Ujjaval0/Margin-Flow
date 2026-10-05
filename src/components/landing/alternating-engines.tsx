"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, FileCheck, Layers, Scale, ShieldCheck, Sparkles } from "lucide-react";

export function AlternatingEngines() {
  // Engine 2: Interactive Weight Slider State
  const [sliderWeight, setSliderWeight] = useState(420);
  
  // Calculate overcharge dynamically for Engine 2
  const expectedSlab = sliderWeight <= 500 ? "0.5 kg" : sliderWeight <= 1000 ? "1.0 kg" : sliderWeight <= 1500 ? "1.5 kg" : "2.0 kg";
  const expectedFreight = sliderWeight <= 500 ? 65 : sliderWeight <= 1000 ? 95 : sliderWeight <= 1500 ? 135 : 175;
  const billedSlab = "2.0 kg";
  const billedFreight = 195;
  const overcharge = Math.max(0, billedFreight - expectedFreight);

  // Engine 3: Interactive Claim Action State
  const [claimStatus, setClaimStatus] = useState<"pending" | "submitting" | "filed">("pending");

  const handleSimulateClaim = () => {
    setClaimStatus("submitting");
    setTimeout(() => {
      setClaimStatus("filed");
    }, 700);
  };

  return (
    <section className="border-t border-black/[0.08] bg-white py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28 sm:space-y-36">
        
        {/* ========================================================================= */}
        {/* ROW 1: True Unit Economics Waterfall (CM2 & POAS)                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Text Left */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.08] text-xs font-mono font-medium text-[#0055FF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>ENGINE 01 // UNIT ECONOMICS</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              True Contribution Margin (CM2 & POAS)
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Never scale loss-making products with misleading ROAS. MarginFlow calculates verified bank profit per order after deducting unit COGS, logistics, return reserves, and platform cuts.
            </p>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline"
              >
                <span>Explore Live Waterfall</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              {["Order Cost Basis", "Forward Logistics", "Reverse Toll", "Marketplace Fee", "POAS Target"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.06] text-xs font-mono text-[#736F66]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Living Visual Right: Interactive Waterfall Breakdown Card */}
          <div className="lg:col-span-7 rounded-3xl bg-[#FAF7F2] p-6 sm:p-10 border border-black/[0.06] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_2px_4px_-1px_rgba(0,0,0,0.03),0px_6px_12px_-2px_rgba(0,0,0,0.04)]">
            <div className="bg-white rounded-2xl border border-black/[0.08] p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#0055FF]" />
                  <span className="text-xs font-mono font-bold text-[#121214]">SKU-COT-092 • Polo T-Shirt</span>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#129E52] font-semibold">
                  POAS: 2.14x (Healthy)
                </span>
              </div>

              {/* Waterfall Rows */}
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF7F2]">
                  <span className="text-[#121214] font-medium">Customer Invoiced Price</span>
                  <span className="font-bold text-[#121214]">₹1,499.00</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-rose-50/60 transition-colors">
                  <span className="text-[#736F66]">− Unit Cost (COGS)</span>
                  <span className="font-bold text-[#736F66]">−₹420.00</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-rose-50/60 transition-colors">
                  <span className="text-[#736F66]">− Marketplace Referral & Closing</span>
                  <span className="font-bold text-rose-600">−₹225.00</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-rose-50/60 transition-colors">
                  <span className="text-[#736F66]">− Courier Freight (0.5kg Slab)</span>
                  <span className="font-bold text-rose-600">−₹125.00</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-rose-50/60 transition-colors">
                  <span className="text-[#736F66]">− Return & RTO Risk Reserve</span>
                  <span className="font-bold text-rose-600">−₹110.00</span>
                </div>
              </div>

              {/* Net Cash Cleared Banner */}
              <div className="pt-4 border-t border-black/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#736F66] block">Verified Net Bank Cash (CM2)</span>
                  <span className="text-xs font-mono text-[#129E52] font-semibold">41.3% Net Margin</span>
                </div>
                <span className="text-2xl font-mono font-bold text-[#129E52]">+₹619.00</span>
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* ROW 2: Volumetric Overcharge Radar (Interactive Weight Slider)             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Living Visual Left: Interactive Weight Slider */}
          <div className="lg:col-span-7 rounded-3xl bg-[#FAF7F2] p-6 sm:p-10 border border-black/[0.06] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_2px_4px_-1px_rgba(0,0,0,0.03),0px_6px_12px_-2px_rgba(0,0,0,0.04)] order-2 lg:order-1">
            <div className="bg-white rounded-2xl border border-black/[0.08] p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#0055FF]" />
                  <span className="text-xs font-mono font-bold text-[#121214]">LIVE WEIGHT SLAB SIMULATOR</span>
                </div>
                <span className="text-[11px] font-mono text-[#736F66]">Drag to test SKU weight</span>
              </div>

              {/* Slider Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-[#736F66]">Catalog Item Weight:</span>
                  <span className="font-bold text-[#0055FF] text-sm">{sliderWeight} grams</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="50"
                  value={sliderWeight}
                  onChange={(e) => setSliderWeight(Number(e.target.value))}
                  className="w-full h-2 bg-[#FAF7F2] rounded-lg appearance-none cursor-pointer accent-[#0055FF]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#736F66]">
                  <span>200g (Lightweight)</span>
                  <span>1,000g (Standard)</span>
                  <span>2,000g (Heavy)</span>
                </div>
              </div>

              {/* Comparison Matrix */}
              <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-black/[0.05]">
                  <span className="text-[10px] text-[#736F66] block">EXPECTED SLAB</span>
                  <span className="font-bold text-[#121214] block mt-1">{expectedSlab} (₹{expectedFreight})</span>
                  <span className="text-[10px] text-[#129E52] mt-1 block">Catalog Baseline</span>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-600 block">COURIER BILLED</span>
                  <span className="font-bold text-rose-700 block mt-1">{billedSlab} (₹{billedFreight})</span>
                  <span className="text-[10px] text-rose-600 mt-1 block">Inflated Slab</span>
                </div>
              </div>

              {/* Live Discrepancy Flag */}
              <div className="p-3.5 rounded-xl bg-[#121214] text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#D1CDC2] block">FLAGGED FOR DISPUTE</span>
                  <span className="text-xs font-bold font-mono">
                    {overcharge > 0 ? "Automated Refund Claim Generated" : "Weight Within Policy"}
                  </span>
                </div>
                <span className="text-lg font-mono font-bold text-[#0055FF]">
                  {overcharge > 0 ? `+₹${overcharge}.00 Refund` : "₹0 Discrepancy"}
                </span>
              </div>
            </div>
          </div>

          {/* Text Right */}
          <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.08] text-xs font-mono font-medium text-[#0055FF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>ENGINE 02 // LOGISTICS AUDIT</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              Volumetric Overcharge Radar
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Cross-checks every package AWB against your catalog dimensions. Automatically detects when couriers bill lightweight items into 2kg deadweight slabs and compiles dispute tickets before payouts settle.
            </p>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline"
              >
                <span>View Weight Audit Rules</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {["AWB Tracking", "Dead Weight Check", "Dimensional L×W×H", "Courier Slabs", "Auto-Dispute"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.06] text-xs font-mono text-[#736F66]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* ROW 3: Dispute Recovery & SAFE-T Docket (Interactive Dossier)              */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Text Left */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.08] text-xs font-mono font-medium text-[#0055FF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>ENGINE 03 // DISPUTE RECOVERY</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              Dispute Recovery & SAFE-T Docket
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Monitors strict 7–30 day claim windows for damaged, swapped, or undelivered packages. Automatically compiles order cost snapshots, tracking records, and damage checklists into pre-formatted claim packets.
            </p>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline"
              >
                <span>Explore Claims Cockpit</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {["Amazon SAFE-T", "Flipkart SPF", "Damaged Returns", "14-Day Countdown", "Bank Reimbursement"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-black/[0.06] text-xs font-mono text-[#736F66]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Living Visual Right: Interactive Dispute Dossier */}
          <div className="lg:col-span-7 rounded-3xl bg-[#FAF7F2] p-6 sm:p-10 border border-black/[0.06] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_2px_4px_-1px_rgba(0,0,0,0.03),0px_6px_12px_-2px_rgba(0,0,0,0.04)]">
            <div className="bg-white rounded-2xl border border-black/[0.08] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#E66A1F]" />
                  <span className="text-xs font-mono font-bold text-[#121214]">EVIDENCE DOSSIER #CLM-88392</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-[#E66A1F] text-xs font-mono font-bold">
                  ⏱ 4 Days Left
                </span>
              </div>

              {/* Evidence Checklist */}
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF7F2]">
                  <span className="flex items-center gap-2 text-[#121214]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#129E52]" />
                    Invoiced Order Snapshot Attached
                  </span>
                  <span className="text-[#736F66]">₹1,499.00</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF7F2]">
                  <span className="flex items-center gap-2 text-[#121214]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#129E52]" />
                    Return Photo Evidence Verified
                  </span>
                  <span className="text-[#129E52]">Damaged Seal</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF7F2]">
                  <span className="flex items-center gap-2 text-[#121214]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#129E52]" />
                    Courier AWB Weight History Logged
                  </span>
                  <span className="text-[#0055FF]">Telemetry Matched</span>
                </div>
              </div>

              {/* Claim Action Button / Status */}
              <div className="pt-2">
                {claimStatus === "filed" ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center animate-in fade-in duration-200">
                    <span className="text-xs font-mono font-bold text-[#129E52] block">
                      ✓ SAFE-T Claim Filed Automatically
                    </span>
                    <span className="text-[11px] font-mono text-[#736F66]">
                      ₹840.00 recovery queued for bank deposit settlement
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleSimulateClaim}
                    disabled={claimStatus === "submitting"}
                    className="w-full py-3 rounded-full bg-[#121214] hover:bg-black active:scale-[0.98] text-white text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {claimStatus === "submitting" ? (
                      <span>Compiling Dispute Dossier...</span>
                    ) : (
                      <>
                        <span>Submit Claim Packet ↗</span>
                        <span className="text-[10px] text-amber-300">• 1-Click Filing</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
