"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Scale, RefreshCw } from "lucide-react";

interface PipelineStep {
  id: string;
  number: string;
  title: string;
  badge: string;
  metric: string;
  subtext: string;
  status: "verified" | "flagged" | "recovered" | "cleared";
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "intake",
    number: "01",
    title: "Multi-Channel Order Intake",
    badge: "Amazon • Flipkart • Meesho",
    metric: "₹1,499.00 Invoiced",
    subtext: "COGS locked at intake: ₹420.00",
    status: "cleared",
  },
  {
    id: "weight",
    number: "02",
    title: "Volumetric Weight Audit",
    badge: "Courier Freight Check",
    metric: "⚠️ 1.5kg Billed vs 420g Actual",
    subtext: "Overcharge detected: ₹185.00 flagged for refund",
    status: "flagged",
  },
  {
    id: "dispute",
    number: "03",
    title: "SAFE-T & RTO Recovery",
    badge: "Automated Evidence Dossier",
    metric: "₹640.00 Claim Pre-Compiled",
    subtext: "Auto-filed before 14-day SLA deadline expires",
    status: "recovered",
  },
  {
    id: "settlement",
    number: "04",
    title: "Net Bank Cash Payout",
    badge: "CA & Tax Audit Ready",
    metric: "₹729.00 Deposited to Bank",
    subtext: "1% GST TCS & TDS isolated as tax assets",
    status: "verified",
  },
];

export function HeroConveyorVisual() {
  const [activeStep, setActiveStep] = useState<number>(1); // Default to Weight Audit for high visual impact

  const step = PIPELINE_STEPS[activeStep];

  return (
    <div className="w-full max-w-5xl mx-auto mt-12 sm:mt-16">
      {/* Outer Elevated Glass Container */}
      <div className="rounded-3xl bg-[#FAF9F6] border border-black/[0.08] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_3px_6px_-1.5px_rgba(0,0,0,0.04),0px_12px_24px_-6px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-300">
        
        {/* Top Control Bar */}
        <div className="px-6 py-4 bg-white/70 backdrop-blur-md border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80 border border-black/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80 border border-black/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80 border border-black/10" />
            <span className="ml-3 text-xs font-semibold tracking-tight text-[#1D1D1F]">
              MarginFlow Audit Pipeline
            </span>
            <span className="text-[11px] text-[#86868B] hidden sm:inline">• Automated Inspection Stream</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[#288548] font-medium border border-emerald-200/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#288548] animate-pulse" />
              Live Invariants Active
            </span>
          </div>
        </div>

        {/* Isometric Assembly Visual Canvas */}
        <div className="relative p-6 sm:p-10 lg:p-12 overflow-hidden bg-gradient-to-b from-[#FAF9F6] to-[#F5F4F0]">
          {/* Subtle Isometric Background Grid */}
          <div 
            className="absolute inset-0 opacity-[0.035] pointer-events-none" 
            style={{
              backgroundImage: `radial-gradient(#1D1D1F 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
            {/* Left: Isometric Assembly Line Canvas (inspired by aintrum / medusa) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center">
              <div className="w-full max-w-[520px] aspect-[16/11] relative">
                <svg
                  viewBox="0 0 600 420"
                  className="w-full h-full drop-shadow-sm select-none"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Isometric Conveyor Belt Track Base */}
                  <g className="opacity-90">
                    {/* Conveyor Floor Guide */}
                    <path
                      d="M 50 160 L 330 325 L 550 200 L 270 35 Z"
                      fill="#EFECE6"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />

                    {/* Left Conveyor Rail */}
                    <path
                      d="M 40 165 L 320 330 L 320 345 L 40 180 Z"
                      fill="#D8D4CC"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    {/* Right Conveyor Rail */}
                    <path
                      d="M 320 330 L 560 195 L 560 210 L 320 345 Z"
                      fill="#C8C4BC"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />

                    {/* Conveyor Belt Track Plates */}
                    <path
                      d="M 80 155 L 170 208 L 220 180 L 130 127 Z"
                      fill="#FFFFFF"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                      className="transition-transform duration-500"
                    />
                    <path
                      d="M 380 235 L 470 182 L 520 210 L 430 263 Z"
                      fill="#FFFFFF"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                      className="transition-transform duration-500"
                    />

                    {/* Moving Package 1 (Intake Node - Left) */}
                    <g className={`transition-all duration-500 ${activeStep === 0 ? "scale-105" : "opacity-80"}`}>
                      {/* Box Base */}
                      <path
                        d="M 120 160 L 165 186 L 165 215 L 120 189 Z"
                        fill="#E8DEC8"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 165 186 L 205 163 L 205 192 L 165 215 Z"
                        fill="#D9CEA8"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      {/* Box Top */}
                      <path
                        d="M 120 160 L 165 186 L 205 163 L 160 137 Z"
                        fill="#F3EBD8"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      {/* Marketplace Tape */}
                      <path
                        d="M 140 148 L 185 174 L 185 188 L 140 162 Z"
                        fill="#0071E3"
                        fillOpacity="0.8"
                      />
                    </g>

                    {/* Central Audit Core Chamber (The Inspection Station) */}
                    {/* Chamber Elevated Foundation */}
                    <path
                      d="M 215 170 L 335 240 L 415 195 L 295 125 Z"
                      fill="#FFFFFF"
                      stroke="#1D1D1F"
                      strokeWidth="2"
                    />
                    <path
                      d="M 215 170 L 335 240 L 335 270 L 215 200 Z"
                      fill="#E2DFD8"
                      stroke="#1D1D1F"
                      strokeWidth="2"
                    />
                    <path
                      d="M 335 240 L 415 195 L 415 225 L 335 270 Z"
                      fill="#D0CDC4"
                      stroke="#1D1D1F"
                      strokeWidth="2"
                    />

                    {/* Chamber Glass Top (Transparent isometric dome) */}
                    <path
                      d="M 240 145 L 325 195 L 385 160 L 300 110 Z"
                      fill="#0071E3"
                      fillOpacity="0.08"
                      stroke="#0071E3"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    {/* Inspection Beam / Scan Line */}
                    <line
                      x1="265"
                      y1="130"
                      x2="350"
                      y2="180"
                      stroke={activeStep === 1 ? "#D70015" : "#0071E3"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="animate-pulse"
                    />

                    {/* Package Inside Chamber Being Audited */}
                    <g className="transition-all duration-300">
                      <path
                        d="M 275 168 L 310 188 L 310 210 L 275 190 Z"
                        fill="#EFE8D6"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 310 188 L 340 170 L 340 192 L 310 210 Z"
                        fill="#DDD2BD"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 275 168 L 310 188 L 340 170 L 305 150 Z"
                        fill="#FAF5E8"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                    </g>

                    {/* Mechanical Corner Screws on Chamber (Apple / Aintrum precision details) */}
                    <circle cx="230" cy="180" r="3" fill="#1D1D1F" />
                    <circle cx="335" cy="242" r="3" fill="#1D1D1F" />
                    <circle cx="400" cy="198" r="3" fill="#1D1D1F" />
                    <circle cx="295" cy="136" r="3" fill="#1D1D1F" />

                    {/* Front Control Panel Tray with Dials */}
                    <path
                      d="M 200 245 L 265 282 L 295 265 L 230 228 Z"
                      fill="#FFFFFF"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 200 245 L 265 282 L 265 292 L 200 255 Z"
                      fill="#D8D4CC"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    {/* Control Knobs */}
                    <circle cx="235" cy="255" r="4.5" fill="#1D1D1F" />
                    <circle cx="255" cy="266" r="4.5" fill="#0071E3" />
                    <line x1="228" y1="248" x2="242" y2="248" stroke="#1D1D1F" strokeWidth="1" />
                    <line x1="248" y1="259" x2="262" y2="259" stroke="#0071E3" strokeWidth="1" />

                    {/* Exit Package (Validated Bank Cash - Right) */}
                    <g className={`transition-all duration-500 ${activeStep === 3 ? "scale-105" : "opacity-90"}`}>
                      <path
                        d="M 430 215 L 465 235 L 465 258 L 430 238 Z"
                        fill="#D1E7DD"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 465 235 L 495 218 L 495 241 L 465 258 Z"
                        fill="#BADBCC"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M 430 215 L 465 235 L 495 218 L 460 198 Z"
                        fill="#E8F4EE"
                        stroke="#1D1D1F"
                        strokeWidth="1.5"
                      />
                      {/* Green Verified Stamp */}
                      <circle cx="462" cy="216" r="7" fill="#288548" />
                      <path d="M 459 216 L 461 218 L 465 214" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  </g>
                </svg>

                {/* Floating Status Pill over visual */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-black/[0.08] shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0071E3] animate-ping" />
                  <span className="font-mono text-[11px] font-semibold text-[#1D1D1F]">
                    {activeStep === 0 && "INGESTING ORDERS"}
                    {activeStep === 1 && "AUDITING COURIER WEIGHT"}
                    {activeStep === 2 && "PRE-COMPILING CLAIMS"}
                    {activeStep === 3 && "NET BANK DEPOSIT MATCHED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Step Explanation & Metrics Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
                  <span>Step {step.number}</span>
                  <span className="text-[#86868B]">•</span>
                  <span>{step.badge}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
                  {step.title}
                </h3>
              </div>

              {/* Dynamic Live Result Card */}
              <div className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868B] font-medium">Reconciled Status</span>
                  {step.status === "flagged" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-[#D70015] border border-rose-200/60 font-mono">
                      <AlertTriangle className="w-3 h-3" /> Discrepancy Caught
                    </span>
                  )}
                  {step.status === "recovered" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#0071E3] border border-blue-200/60 font-mono">
                      <ShieldCheck className="w-3 h-3" /> Ready to File
                    </span>
                  )}
                  {step.status === "verified" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-[#288548] border border-emerald-200/60 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> 100% Reconciled
                    </span>
                  )}
                  {step.status === "cleared" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                      <CheckCircle2 className="w-3 h-3" /> Synced
                    </span>
                  )}
                </div>

                <p className="text-lg sm:text-xl font-bold text-[#1D1D1F] tracking-tight">
                  {step.metric}
                </p>
                <p className="text-xs text-[#86868B] leading-relaxed">
                  {step.subtext}
                </p>
              </div>

              {/* Interactive Step Switcher (Tabs with animated indicator) */}
              <div className="pt-2">
                <p className="text-[11px] font-medium text-[#86868B] mb-2 uppercase tracking-wider">
                  Explore Reconciled Lifecycle
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PIPELINE_STEPS.map((s, idx) => {
                    const isSelected = activeStep === idx;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveStep(idx)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer ${
                          isSelected
                            ? "bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-sm"
                            : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border-black/[0.06] hover:border-black/[0.15]"
                        }`}
                      >
                        <span className="font-mono">{s.number}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
