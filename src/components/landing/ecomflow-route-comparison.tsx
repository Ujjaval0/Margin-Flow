"use client";

import React, { useState, useEffect } from "react";
import { Check, Clock3, FileSpreadsheet } from "lucide-react";

export function EcomflowRouteComparison() {
  const [activeStep, setActiveStep] = useState(0);

  // Smooth gentle progression across the 4 steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const marginFlowSteps = [
    { title: "Marketplace Order", note: "Amazon/Flipkart checkout" },
    { title: "MarginFlow Engine", note: "Unit COGS & slab check" },
    { title: "Dispute Intercept", note: "Auto-compiled claim dossier" },
    { title: "Verified Bank Cash", note: "Cleared current account" },
  ];

  const traditionalSteps = [
    { num: "01", title: "Order Placed", note: "Gross GMV spike" },
    { num: "02", title: "Portal CSV", note: "Messy manual export" },
    { num: "03", title: "Courier Bill", note: "Inflated weight slabs" },
    { num: "04", title: "Excel VLOOKUP", note: "Broken formulas" },
    { num: "05", title: "Lump Deposit", note: "No SKU attribution" },
    { num: "06", title: "Expired Claims", note: "Cash lost forever", isExpired: true },
  ];

  return (
    <section id="routes" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] border-t border-[#cfdfd1] select-none">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Heading */}
        <div className="max-w-2xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#cfdfd1] text-xs font-mono font-medium text-[#00872e] mb-4 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ae3b]" />
            <span>02 // RECONCILIATION ROUTES</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
            Same starting point.<br />
            <span className="font-serif italic font-normal text-[#00872e]">
              A different way forward.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Eliminate six manual spreadsheet handoffs and verify every rupee before settlements lock.
          </p>
        </div>

        {/* The Two Routes Comparison Board */}
        <div className="rounded-3xl bg-white border border-[#cfdfd1] p-6 sm:p-10 shadow-[0_20px_50px_rgba(25,48,34,0.06)] space-y-6">
          
          {/* Header strip */}
          <div className="pb-4 border-b border-[#e5ebe3] flex items-center justify-between text-xs font-mono text-[#5c7062]">
            <span>TWO ROUTES. ONE FINANCIAL TRUTH.</span>
            <span className="hidden sm:inline">CAPITAL RECOVERY VELOCITY</span>
          </div>

          {/* ========================================================================= */}
          {/* LANE 1: WITH MARGINFLOW (Direct Automated Settlement)                      */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#eaf2e3] border border-[#cbd8bc]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#193022] text-[#71d78e] font-serif italic text-sm font-bold">
                  m.
                </span>
                <span className="text-base font-bold text-[#193022] font-mono">With MarginFlow</span>
              </div>

              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-mono text-[#5c7062] uppercase">RECONCILIATION TIME</span>
                <strong className="text-3xl sm:text-4xl font-mono font-light tracking-tight text-[#193022]">
                  3 <span className="text-base font-sans font-medium text-[#00872e]">Seconds</span>
                </strong>
                <span className="block text-[10px] font-mono text-[#5c7062]">Checkout to verified bank profit</span>
              </div>
            </div>

            {/* 4 Clean Direct Nodes with smooth subtle transition */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
              {marginFlowSteps.map((node, idx) => {
                const isCurrent = activeStep === idx;
                return (
                  <div
                    key={node.title}
                    onClick={() => setActiveStep(idx)}
                    className={`p-4 rounded-xl border text-center cursor-pointer transition-all duration-500 ease-out ${
                      isCurrent
                        ? "bg-[#d5e7c4] border-[#00ae3b] shadow-sm"
                        : "bg-white/80 border-[#cbd8bc] hover:bg-white"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-[#5c7062] block mb-1">
                      STEP 0{idx + 1}
                    </span>
                    <strong className="block text-xs font-mono font-bold text-[#193022]">
                      {node.title}
                    </strong>
                    <span className="block text-[11px] text-[#5c7062] mt-1 font-sans">
                      {node.note}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-[#cbd8bc]/60 flex items-center gap-2 text-xs font-mono text-[#00872e]">
              <Check className="w-4 h-4 shrink-0" />
              <span>One automated setup. Zero manual CSV exports or formula debugging.</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LANE 2: THE TRADITIONAL WAY (Spreadsheet Agony)                            */}
          {/* ========================================================================= */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#f5f3ec] border border-[#e2dcd0] text-[#766a55]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#8c7e68]" />
                <span className="text-base font-bold font-mono text-[#5c5240]">The Traditional Way</span>
              </div>

              <div className="text-left sm:text-right">
                <span className="block text-[10px] font-mono opacity-75 uppercase">RECONCILIATION TIME</span>
                <strong className="text-3xl sm:text-4xl font-mono font-light tracking-tight text-[#5c5240]">
                  Up to 21 <span className="text-base font-sans font-medium">Days</span>
                </strong>
                <span className="block text-[10px] font-mono opacity-75">Order to uncertain guesswork</span>
              </div>
            </div>

            {/* 6 Painful Nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center font-mono text-xs">
              {traditionalSteps.map((step) => (
                <div
                  key={step.title}
                  className={`p-3 rounded-xl border ${
                    step.isExpired
                      ? "bg-rose-50/80 border-rose-200 text-rose-700"
                      : "bg-white/70 border-[#e2dcd0]"
                  }`}
                >
                  <span className="text-[9px] opacity-60 block">{step.num}</span>
                  <strong className={`text-[11px] block mt-0.5 ${step.isExpired ? "text-rose-700" : "text-[#5c5240]"}`}>
                    {step.title}
                  </strong>
                  <span className={`text-[9px] ${step.isExpired ? "text-rose-600" : "opacity-75"}`}>
                    {step.note}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[#e2dcd0] flex items-center gap-2 text-xs font-mono text-[#8c7e68]">
              <Clock3 className="w-4 h-4 shrink-0" />
              <span>Six manual handoffs. Hidden margin leaks surrendered before anyone notices.</span>
            </div>
          </div>

          <p className="text-[11px] font-mono text-[#8a9680] pt-2">
            *3 seconds is the automated ingestion audit cycle. Illustrative operational comparison.
          </p>
        </div>

      </div>
    </section>
  );
}
