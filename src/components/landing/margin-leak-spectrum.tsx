"use client";

import React, { useState } from "react";
import { ShieldCheck, ArrowRight, Zap, RefreshCw } from "lucide-react";

interface SpectrumNode {
  label: string;
  category: string;
  amount: string;
  leakOrGain: "base" | "leak" | "gain" | "net";
  description: string;
  xPercent: number; // 0 to 100 on the track
}

const SPECTRUM_NODES: SpectrumNode[] = [
  {
    label: "Selling Price",
    category: "CUSTOMER PAYMENT",
    amount: "₹1,499",
    leakOrGain: "base",
    description: "Invoiced order amount on marketplace",
    xPercent: 12,
  },
  {
    label: "Product COGS",
    category: "MANUFACTURING / SOURCING",
    amount: "−₹420",
    leakOrGain: "leak",
    description: "Factory unit purchase & packaging materials",
    xPercent: 28,
  },
  {
    label: "Courier Freight",
    category: "LOGISTICS & RTO",
    amount: "−₹315",
    leakOrGain: "leak",
    description: "Forward shipping + blended return transit loss",
    xPercent: 44,
  },
  {
    label: "Marketplace Fee",
    category: "COMMISSION & CLOSING",
    amount: "−₹220",
    leakOrGain: "leak",
    description: "Platform commission & collection fees",
    xPercent: 60,
  },
  {
    label: "Dispute Recovery",
    category: "MARGINFLOW ENGINE",
    amount: "+₹185",
    leakOrGain: "gain",
    description: "Auto-claimed weight overcharge & return damage",
    xPercent: 76,
  },
  {
    label: "Net Bank Cash",
    category: "REAL PROFIT",
    amount: "₹729",
    leakOrGain: "net",
    description: "Final cash credited to your company bank account",
    xPercent: 90,
  },
];

export function MarginLeakSpectrum() {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(4); // Highlight Dispute Recovery by default

  const selectedNode = SPECTRUM_NODES[selectedNodeIndex];

  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="max-w-4xl mx-auto text-center mb-14 sm:mb-18">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[#288548] text-xs font-semibold mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#288548]" />
          <span>Interactive Cash Spectrum</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-tight">
          Where does your money actually go?
        </h2>
        <p className="mt-4 text-base sm:text-lg text-[#6E6E73] leading-relaxed max-w-2xl mx-auto">
          Trace how a ₹1,499 marketplace sale flows down to your bank account, and how MarginFlow recovers ₹185 on every affected order.
        </p>
      </div>

      {/* Spectrum Visual Container (Warm Apple aesthetic inspired by Image 5) */}
      <div className="max-w-5xl mx-auto rounded-3xl bg-[#FAF9F6] border border-black/[0.08] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.03),0px_4px_12px_rgba(0,0,0,0.03)] p-6 sm:p-12 relative overflow-hidden">
        
        {/* Soft glowing ambient gradient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* The Visual Track Canvas */}
        <div className="relative py-8 sm:py-12 select-none">
          {/* Horizontal Track Lines (inspired by Image 5) */}
          <div className="space-y-10 sm:space-y-12 relative z-10">
            {SPECTRUM_NODES.map((node, idx) => {
              const isSelected = selectedNodeIndex === idx;
              return (
                <div key={node.label} className="relative flex items-center justify-between">
                  {/* Left Label */}
                  <span className={`text-xs font-semibold tracking-wider transition-colors duration-200 w-32 text-left ${
                    isSelected ? "text-[#1D1D1F]" : "text-[#86868B]"
                  }`}>
                    {node.label.toUpperCase()}
                  </span>

                  {/* Center Track Line with Dots */}
                  <div className="flex-1 mx-4 sm:mx-8 relative flex items-center">
                    <div className="w-full h-[1px] bg-black/[0.08]" />

                    {/* Node on Track */}
                    <button
                      onClick={() => setSelectedNodeIndex(idx)}
                      style={{ left: `${node.xPercent}%` }}
                      className={`absolute -translate-x-1/2 flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none ${
                        isSelected
                          ? "w-8 h-8 rounded-full bg-[#1D1D1F] text-white shadow-md scale-110 ring-4 ring-blue-500/20"
                          : node.leakOrGain === "gain"
                          ? "w-6 h-6 rounded-full bg-[#0071E3] text-white hover:scale-110"
                          : "w-5 h-5 rounded-full bg-[#D8D4CC] hover:bg-[#1D1D1F] hover:scale-110"
                      }`}
                      aria-label={`Select ${node.label}`}
                    >
                      {node.leakOrGain === "gain" && !isSelected && (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      )}
                      {isSelected && (
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  </div>

                  {/* Right Metric Value */}
                  <span className={`font-mono text-xs sm:text-sm font-semibold w-24 text-right transition-colors duration-200 ${
                    node.leakOrGain === "gain"
                      ? "text-[#288548]"
                      : node.leakOrGain === "leak"
                      ? "text-[#D70015]"
                      : "text-[#1D1D1F]"
                  }`}>
                    {node.amount}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Smooth S-curve Glowing Blue Fluid Ribbon (inspired by Image 5) */}
          <div className="absolute inset-0 pointer-events-none hidden sm:block">
            <svg className="w-full h-full" fill="none">
              <path
                d="M 220 50 Q 280 110 360 160 T 520 280 T 680 340"
                stroke="#0071E3"
                strokeWidth="12"
                strokeLinecap="round"
                className="opacity-15 blur-md"
              />
              <path
                d="M 220 50 Q 280 110 360 160 T 520 280 T 680 340"
                stroke="#0071E3"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 4"
                className="opacity-60"
              />
            </svg>
          </div>
        </div>

        {/* Selected Milestone Inspection Drawer */}
        <div className="mt-8 pt-6 border-t border-black/[0.06] bg-white rounded-2xl p-5 sm:p-6 border border-black/[0.05] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#86868B]">
                {selectedNode.category}
              </span>
              <span className="text-[11px] text-[#86868B]">•</span>
              <span className="text-xs font-semibold text-[#1D1D1F]">
                {selectedNode.label}
              </span>
            </div>
            <p className="text-sm text-[#6E6E73]">
              {selectedNode.description}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-[#86868B]">Unit Impact</p>
              <p className={`font-mono text-xl font-bold ${
                selectedNode.leakOrGain === "gain"
                  ? "text-[#288548]"
                  : selectedNode.leakOrGain === "leak"
                  ? "text-[#D70015]"
                  : "text-[#1D1D1F]"
              }`}>
                {selectedNode.amount}
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Callout: Without vs With MarginFlow */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-black/[0.03] border border-black/[0.04]">
            <p className="text-[#86868B] font-medium">Without MarginFlow Auditing</p>
            <p className="text-lg font-bold text-[#6E6E73] font-mono mt-1">
              ₹544 <span className="text-xs font-normal text-[#86868B]">Net Deposit</span>
            </p>
            <p className="text-[#86868B] mt-1 text-[11px]">
              ₹185 lost permanently to undetected weight inflation & missed claims.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 border border-[#288548]/20">
            <div className="flex items-center justify-between">
              <p className="text-[#288548] font-semibold">With MarginFlow Protection</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#288548] text-white">
                +34% MORE CASH
              </span>
            </div>
            <p className="text-lg font-bold text-[#1D1D1F] font-mono mt-1">
              ₹729 <span className="text-xs font-normal text-[#288548]">Real Bank Cash</span>
            </p>
            <p className="text-[#288548] mt-1 text-[11px] font-medium">
              Every single rupee reconciled, audited, and secured directly to your ledger.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
