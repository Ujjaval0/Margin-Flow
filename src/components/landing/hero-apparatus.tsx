"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Zap } from "lucide-react";

interface PipelineStep {
  id: string;
  badge: string;
  title: string;
  metric: string;
  delta: string;
  status: "intake" | "audit" | "discrepancy" | "settled";
  note: string;
}

const STEPS: PipelineStep[] = [
  {
    id: "intake",
    badge: "STAGE 01 // INTAKE",
    title: "Order Captured",
    metric: "₹1,499.00",
    delta: "Gross Invoiced",
    status: "intake",
    note: "Product COGS locked at purchase basis: ₹420.00",
  },
  {
    id: "audit",
    badge: "STAGE 02 // AUDIT",
    title: "Dimensional Telemetry",
    metric: "420g Actual",
    delta: "Courier Billed: 1,500g",
    status: "audit",
    note: "Cross-checked against master SKU dimensions (24×16×4 cm)",
  },
  {
    id: "discrepancy",
    badge: "STAGE 03 // DETECT",
    title: "Fee Leak Intercepted",
    metric: "−₹185.00 Flagged",
    delta: "Discrepancy Ticket Pre-filed",
    status: "discrepancy",
    note: "SAFE-T claim compiled with tracking telemetry before settlement",
  },
  {
    id: "settled",
    badge: "STAGE 04 // SETTLE",
    title: "Cleared Bank Cash",
    metric: "+₹729.00",
    delta: "Verified Deposit",
    status: "settled",
    note: "1% GST TCS & TDS isolated as balance sheet assets",
  },
];

export function HeroApparatus() {
  const [activeStep, setActiveStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);

  // Gentle auto-rotation when idle unless user clicks
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const triggerScanCycle = () => {
    setIsScanning(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < STEPS.length) {
        setActiveStep(step);
      } else {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 400);
  };

  const current = STEPS[activeStep];

  return (
    <div className="w-full max-w-xl mx-auto select-none">
      {/* Container with Apple-style layered neutral elevation */}
      <div className="rounded-3xl bg-white border border-black/[0.08] shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_2px_4px_-1px_rgba(0,0,0,0.03),0px_6px_12px_-2px_rgba(0,0,0,0.04),0px_16px_24px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        
        {/* Top Control Bar with living status */}
        <div className="px-5 py-3.5 bg-[#FAF7F2]/80 border-b border-black/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#129E52] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#129E52]" />
            </span>
            <span className="font-mono font-semibold text-[#121214] tracking-tight">
              LIVE RECONCILIATION ENGINE
            </span>
            <span className="hidden sm:inline text-[#736F66] font-mono">• AWB-94829</span>
          </div>

          <button
            onClick={triggerScanCycle}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#F0ECE1] active:scale-95 border border-black/10 text-[#121214] font-medium transition-all text-[11px] cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin text-[#0055FF]" : "text-[#736F66]"}`} />
            <span>Simulate Order</span>
          </button>
        </div>

        {/* Central Living Visual: Isometric Dynamic Scanner */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAF7F2]/50 relative">
          
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#121214_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none" />

          {/* Living Inspection Visual Card */}
          <div className="relative z-10 aspect-[16/9] w-full max-w-md mx-auto flex items-center justify-center">
            <svg viewBox="0 0 440 240" fill="none" className="w-full h-full drop-shadow-sm">
              <defs>
                {/* Glow for scan beam */}
                <linearGradient id="scanBeamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0055FF" stopOpacity="0" />
                  <stop offset="50%" stopColor="#0055FF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0055FF" stopOpacity="0.8" />
                </linearGradient>
                {/* Glass plane gradient */}
                <linearGradient id="glassPlane" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#EBF3FF" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {/* Base Platform Grid */}
              <path
                d="M 60 120 L 220 200 L 380 120 L 220 40 Z"
                fill="#F4F1EA"
                stroke="#121214"
                strokeWidth="1.25"
                strokeDasharray="3 3"
                className="opacity-40"
              />

              {/* Elevated Stage Bed */}
              <path
                d="M 90 120 L 220 185 L 350 120 L 220 55 Z"
                fill="url(#glassPlane)"
                stroke="#121214"
                strokeWidth="2"
              />
              <path
                d="M 90 120 L 220 185 L 220 195 L 90 130 Z"
                fill="#D8D4C8"
                stroke="#121214"
                strokeWidth="2"
              />
              <path
                d="M 220 185 L 350 120 L 350 130 L 220 195 Z"
                fill="#C6C1B4"
                stroke="#121214"
                strokeWidth="2"
              />

              {/* Center Inspection Package */}
              <g className="transition-all duration-300 ease-out">
                {/* Left side */}
                <path
                  d="M 175 105 L 220 128 L 220 160 L 175 137 Z"
                  fill="#EDE3CE"
                  stroke="#121214"
                  strokeWidth="1.75"
                />
                {/* Right side */}
                <path
                  d="M 220 128 L 265 105 L 265 137 L 220 160 Z"
                  fill="#DECFA8"
                  stroke="#121214"
                  strokeWidth="1.75"
                />
                {/* Top face */}
                <path
                  d="M 175 105 L 220 128 L 265 105 L 220 82 Z"
                  fill="#F7F1E1"
                  stroke="#121214"
                  strokeWidth="1.75"
                />

                {/* Sealing tape */}
                <path
                  d="M 195 92 L 245 117 L 245 125 L 195 100 Z"
                  fill={activeStep === 2 ? "#D70015" : activeStep === 3 ? "#129E52" : "#0055FF"}
                  className="transition-colors duration-300"
                />
              </g>

              {/* Dynamic Laser Scanning Bounding Box (Stage 1 & 2) */}
              {(activeStep === 1 || activeStep === 2) && (
                <g className="transition-opacity duration-300">
                  {/* Bounding box cage */}
                  <path
                    d="M 160 85 L 220 115 L 280 85 L 220 55 Z"
                    stroke="#0055FF"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    className="opacity-80 animate-pulse"
                  />
                  <line x1="160" y1="85" x2="160" y2="135" stroke="#0055FF" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="280" y1="85" x2="280" y2="135" stroke="#0055FF" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="220" y1="115" x2="220" y2="165" stroke="#0055FF" strokeWidth="1.2" strokeDasharray="3 3" />

                  {/* Laser Sweeper Beam */}
                  <line
                    x1="150"
                    y1="108"
                    x2="290"
                    y2="108"
                    stroke="#0055FF"
                    strokeWidth="2.5"
                    className="animate-pulse"
                  />
                </g>
              )}

              {/* Discrepancy Alert Tag (Stage 2) */}
              {activeStep === 2 && (
                <g className="animate-in fade-in zoom-in-95 duration-200">
                  <rect x="250" y="45" width="160" height="32" rx="6" fill="#121214" stroke="#D70015" strokeWidth="1.5" />
                  <circle cx="266" cy="61" r="5" fill="#D70015" />
                  <text x="277" y="65" fill="#FFFFFF" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                    OVERCHARGE: +1,080g
                  </text>
                  <line x1="250" y1="65" x2="225" y2="95" stroke="#D70015" strokeWidth="1.5" strokeDasharray="2 2" />
                </g>
              )}

              {/* Cleared Cash Verification Stamp (Stage 3) */}
              {activeStep === 3 && (
                <g className="animate-in fade-in zoom-in-95 duration-200">
                  <circle cx="220" cy="120" r="28" fill="#129E52" fillOpacity="0.15" stroke="#129E52" strokeWidth="2" strokeDasharray="4 2" />
                  <circle cx="220" cy="120" r="20" fill="#129E52" />
                  <path
                    d="M 213 120 L 218 125 L 228 114"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect x="255" y="48" width="145" height="30" rx="6" fill="#121214" stroke="#129E52" strokeWidth="1.5" />
                  <text x="327" y="67" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="monospace">
                    BANK CLEARED: ₹729
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Real-time Telemetry Readout */}
          <div className="mt-4 p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#0055FF]">
                  {current.badge}
                </span>
                <span className="text-xs text-[#736F66]">•</span>
                <span className="text-xs font-semibold text-[#121214]">{current.title}</span>
              </div>
              <p className="text-xs text-[#736F66] mt-0.5">{current.note}</p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className={`text-base sm:text-lg font-mono font-bold ${
                current.status === "discrepancy"
                  ? "text-[#D70015]"
                  : current.status === "settled"
                  ? "text-[#129E52]"
                  : "text-[#121214]"
              }`}>
                {current.metric}
              </span>
              <span className="block text-[11px] font-mono text-[#736F66]">{current.delta}</span>
            </div>
          </div>
        </div>

        {/* 4 Interactive Pipeline Progress Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-black/[0.06] divide-x divide-black/[0.06] bg-[#FAF7F2]/40">
          {STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(idx)}
                className={`p-3 text-left transition-all cursor-pointer relative ${
                  isActive ? "bg-white" : "hover:bg-white/60"
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-[#0055FF]" />
                )}
                <span className="block text-[10px] font-mono text-[#736F66] mb-0.5">
                  0{idx + 1}
                </span>
                <span className={`block text-xs font-semibold truncate ${
                  isActive ? "text-[#121214]" : "text-[#736F66]"
                }`}>
                  {step.title}
                </span>
                <span className="block text-[11px] font-mono text-[#121214] font-medium mt-0.5">
                  {step.metric}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
