"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock3, FileSpreadsheet } from "lucide-react";

export function MarginFlowRouteComparison() {
  const [activeStep, setActiveStep] = useState(0);

  // Smooth gentle progression across the 4 steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const marginFlowSteps = [
    { title: "Data Ingest", note: "API sync or statement upload" },
    { title: "4-Way Cross Check", note: "COGS, weight slab & fee audit" },
    { title: "Dispute Queue", note: "Dossier compiled before SLA" },
    { title: "Bank Cash Matched", note: "UTR verified down to the rupee" },
  ];

  const traditionalSteps = [
    { num: "01", title: "Order Placed", note: "Gross GMV spike" },
    { num: "02", title: "Portal CSV Dump", note: "Messy manual export" },
    { num: "03", title: "Courier Surcharges", note: "Deadweight slab bump" },
    { num: "04", title: "Excel VLOOKUP", note: "Broken formulas & lag" },
    { num: "05", title: "Lump Payout", note: "No SKU-level attribution" },
    { num: "06", title: "Expired Claim SLA", note: "Cash lost permanently", isExpired: true },
  ];

  return (
    <section id="routes" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafbfa] text-[#193022] border-t border-[#e2e8e0] select-none">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Heading */}
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
            The manual audit bottleneck.<br />
            <span className="font-serif italic font-normal text-[#00872e]">
              Solved with automated precision.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Stop waiting weeks for monthly CSV exports or CA reconciliations. Catch deductions, courier weight hikes, and missing returns the moment statements drop.
          </p>
        </div>

        {/* The Two Routes Comparison Board */}
        <div className="rounded-3xl bg-white border border-[#e2e8e0] p-6 sm:p-10 shadow-[0_16px_40px_rgba(0,0,0,0.04)] space-y-6">
          
          {/* Header strip */}
          <div className="pb-4 border-b border-[#e5ebe3] flex items-center justify-between text-xs font-mono text-[#5c7062]">
            <span>TWO ROUTES. ONE FINANCIAL TRUTH.</span>
            <span className="hidden sm:inline">CAPITAL RECOVERY VELOCITY</span>
          </div>

          {/* ========================================================================= */}
          {/* LANE 1: THE TRADITIONAL WAY (Spreadsheet Agony)                            */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#fafafa] border border-[#e5e5e5] text-neutral-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-neutral-200/70 flex items-center justify-center text-neutral-600">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-base font-semibold text-neutral-900 tracking-tight block">The Traditional Way</span>
                  <span className="text-[11px] text-neutral-400 font-sans">Fragmented manual reporting</span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">RECONCILIATION TIME</span>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-800 tabular-nums">
                  Up to 21 <span className="text-lg sm:text-xl font-normal text-neutral-400">Days</span>
                </div>
                <span className="block text-[11px] text-neutral-400">Order to uncertain guesswork</span>
              </div>
            </div>

            {/* 6 Painful Nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-left font-sans text-xs">
              {traditionalSteps.map((step) => (
                <div
                  key={step.title}
                  className={`p-3 rounded-xl border transition-all ${
                    step.isExpired
                      ? "bg-rose-50/80 border-rose-200/90 shadow-2xs"
                      : "bg-white border-neutral-200/80 shadow-2xs"
                  }`}
                >
                  <span className={`text-[10px] font-mono font-medium block ${step.isExpired ? "text-rose-500" : "text-neutral-400"}`}>
                    {step.num}
                  </span>
                  <strong className={`text-[11px] font-semibold block mt-0.5 tracking-tight ${step.isExpired ? "text-rose-700" : "text-neutral-800"}`}>
                    {step.title}
                  </strong>
                  <span className={`text-[10px] block mt-0.5 leading-snug ${step.isExpired ? "text-rose-600" : "text-neutral-400"}`}>
                    {step.note}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-200 flex items-center gap-2 text-xs text-neutral-500">
              <Clock3 className="w-4 h-4 shrink-0 text-neutral-400" />
              <span>Six manual handoffs. Hidden margin leaks surrendered before anyone notices.</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LANE 2: WITH MARGINFLOW (Direct Automated Settlement)                      */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#f8faf8] border border-[#dbe6da] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#111813] text-[#52c47a] font-serif italic text-sm font-medium border border-[#233829]">
                  m.
                </span>
                <div>
                  <span className="text-base font-semibold text-[#193022] tracking-tight block">With MarginFlow</span>
                  <span className="text-[11px] text-[#5c7062] font-sans">Continuous real-time verification</span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-semibold text-[#5c7062] uppercase tracking-wider">RECONCILIATION SPEED</span>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#193022]">
                  Instant <span className="font-serif italic font-normal text-[#00872e]">Audit</span>
                </div>
                <span className="block text-[11px] text-[#5c7062]">Statement upload to verified net cash</span>
              </div>
            </div>

            {/* 4 Clean Direct Nodes with smooth subtle transition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 relative">
              {marginFlowSteps.map((node, idx) => {
                const isCurrent = activeStep === idx;
                return (
                  <div
                    key={node.title}
                    onClick={() => setActiveStep(idx)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                      isCurrent
                        ? "bg-white border-2 border-[#00ae3b] shadow-[0_4px_16px_rgba(0,174,59,0.12)] -translate-y-0.5"
                        : "bg-white/90 border-[#e2ece0] hover:border-[#b8ccb5] hover:bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono font-semibold tracking-wider ${
                        isCurrent ? "text-[#00872e]" : "text-[#5c7062]"
                      }`}>
                        STEP 0{idx + 1}
                      </span>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00ae3b] animate-pulse" />
                      )}
                    </div>
                    <strong className="block text-xs sm:text-[13px] font-semibold text-[#193022] tracking-tight">
                      {node.title}
                    </strong>
                    <span className="block text-[11px] text-[#5c7062] mt-1 font-sans leading-relaxed">
                      {node.note}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-[#dbe6da] flex items-center gap-2 text-xs font-medium text-[#00872e]">
              <Check className="w-4 h-4 shrink-0" />
              <span>One automated engine. Zero manual CSV exports or formula debugging.</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 pt-2 font-medium">
            *Automated ingestion and 4-way cross checks execute in seconds upon receiving transaction files.
          </p>
        </div>

      </div>
    </section>
  );
}

