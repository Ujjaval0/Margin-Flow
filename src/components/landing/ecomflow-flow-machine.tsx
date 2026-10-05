"use client";

import React, { useState } from "react";
import { AlertTriangle, ShoppingCart, Truck, CreditCard, ShieldCheck, BookOpen, ReceiptText } from "lucide-react";

export function MarginFlowFlowMachine() {
  const [isConnected, setIsConnected] = useState(true);

  return (
    <section id="engine" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] transition-colors duration-500 select-none border-t border-[#cfdfd1]">
      {/* Scoped CSS for smooth continuous flow */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marginflowStream {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -100; }
        }
        @keyframes ecomflowStream {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -100; }
        }
      `}} />

      <div className="max-w-6xl mx-auto">
        
        {/* Section Heading */}
        <div className="max-w-2xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#cfdfd1] text-xs font-mono font-medium text-[#00872e] mb-4 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ae3b] animate-pulse" />
            <span>01 // THE RECONCILIATION ENGINE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
            From scattered to connected.<br />
            <span className="font-serif italic font-normal text-[#00872e]">
              Everything working in balance.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Give every rupee a clear, verified path from marketplace checkout to your company bank account and general ledger.
          </p>
        </div>

        {/* The Interactive Machine Board */}
        <div className="rounded-3xl bg-white border border-[#cfdfd1] shadow-[0_20px_50px_rgba(25,48,34,0.06)] overflow-hidden">
          
          {/* Machine Header */}
          <div className="px-6 py-4 bg-[#f1f5ee] border-b border-[#cfdfd1] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-[#193022]">
              <span className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                isConnected ? "bg-[#00ae3b]" : "bg-rose-500"
              }`} />
              <span className="font-bold tracking-wider">THE FINANCIAL RECONCILIATION CORE</span>
            </div>

            {/* Interactive Toggle Switch */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#5c7062] hidden sm:inline">
                {isConnected ? "Turn MarginFlow off to see the leaks:" : "Re-connect MarginFlow:"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isConnected}
                onClick={() => setIsConnected(!isConnected)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                  isConnected ? "bg-[#00ae3b]" : "bg-[#c29668]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                    isConnected ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Machine Circuit Board */}
          <div className="p-6 sm:p-10 relative">
            
            {/* Context Subtitle */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e5ebe3]">
              <div>
                <strong className="text-sm font-mono text-[#193022] block">
                  {isConnected ? "One Connected Audit Ledger" : "Disconnected Multi-Channel Chaos"}
                </strong>
                <span className="text-xs text-[#5c7062]">
                  {isConnected
                    ? "Orders, courier bills, bank deposits, and statutory ledger synchronized in real time."
                    : "Marketplaces and couriers deduct in secret. Your team is forced to guess."}
                </span>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-colors ${
                isConnected
                  ? "bg-[#eaf5ed] text-[#00872e]"
                  : "bg-rose-50 text-rose-700"
              }`}>
                {isConnected ? "● SYSTEM IN FLOW" : "⚠️ UNMATCHED LEAKS"}
              </span>
            </div>

            {/* Circuit Grid: Inputs -> SVG Flow Rails -> Outputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-center">
              
              {/* 4 Left Inputs */}
              <div className="md:col-span-3 space-y-2.5 font-mono text-xs">
                <div className="h-[64px] p-2.5 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex items-center gap-2.5">
                  <ShoppingCart className="w-4 h-4 text-[#00872e] shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-[#193022] truncate text-xs">Marketplace Orders</strong>
                    <span className="text-[10px] text-[#5c7062] block truncate">Amazon • Flipkart • Meesho</span>
                  </div>
                </div>

                <div className="h-[64px] p-2.5 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-[#00872e] shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-[#193022] truncate text-xs">Courier Telemetry</strong>
                    <span className="text-[10px] text-[#5c7062] block truncate">AWBs • Billed Slabs • RTO</span>
                  </div>
                </div>

                <div className="h-[64px] p-2.5 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-[#00872e] shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-[#193022] truncate text-xs">Bank Settlement UTR</strong>
                    <span className="text-[10px] text-[#5c7062] block truncate">1% TCS & TDS Isolated</span>
                  </div>
                </div>

                <div className="h-[64px] p-2.5 rounded-2xl bg-[#f6f9f5] border border-[#cfdfd1] flex items-center gap-2.5">
                  <ReceiptText className="w-4 h-4 text-[#00872e] shrink-0" />
                  <div className="min-w-0">
                    <strong className="block text-[#193022] truncate text-xs">Supplier Tax Invoices</strong>
                    <span className="text-[10px] text-[#5c7062] block truncate">Wholesale COGS • GST ITC</span>
                  </div>
                </div>
              </div>

              {/* Central Dynamic SVG Flow Conduit */}
              <div className="md:col-span-6 relative flex items-center justify-center my-4 md:my-0">
                <div className="w-full aspect-[4/3] sm:aspect-[16/10] relative flex items-center justify-center">
                  
                  {/* SVG Rails */}
                  <svg viewBox="0 0 400 240" className="w-full h-full select-none" fill="none">
                    {isConnected ? (
                      /* Connected Smooth Curved Rails with Continuous Moving Light Streams */
                      <g className="transition-opacity duration-300">
                        {/* Rail 1 (Top) */}
                        <path d="M 0 32 C 120 32 110 120 200 120 S 280 120 400 32" stroke="#b4c99c" strokeWidth="2" />
                        <path
                          d="M 0 32 C 120 32 110 120 200 120 S 280 120 400 32"
                          stroke="#00ae3b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="20 80"
                          style={{ animation: "marginflowStream 2.2s linear infinite" }}
                        />

                        {/* Rail 2 (Mid-Upper) */}
                        <path d="M 0 88 C 110 88 130 120 200 120 S 270 120 400 88" stroke="#b4c99c" strokeWidth="2" />
                        <path
                          d="M 0 88 C 110 88 130 120 200 120 S 270 120 400 88"
                          stroke="#00ae3b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="20 80"
                          style={{ animation: "marginflowStream 1.8s linear infinite" }}
                        />

                        {/* Rail 3 (Mid-Lower) */}
                        <path d="M 0 152 C 110 152 130 120 200 120 S 270 120 400 152" stroke="#b4c99c" strokeWidth="2" />
                        <path
                          d="M 0 152 C 110 152 130 120 200 120 S 270 120 400 152"
                          stroke="#00ae3b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="20 80"
                          style={{ animation: "marginflowStream 2.1s linear infinite" }}
                        />

                        {/* Rail 4 (Bottom) */}
                        <path d="M 0 208 C 120 208 110 120 200 120 S 280 120 400 208" stroke="#b4c99c" strokeWidth="2" />
                        <path
                          d="M 0 208 C 120 208 110 120 200 120 S 280 120 400 208"
                          stroke="#00ae3b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="20 80"
                          style={{ animation: "marginflowStream 2.4s linear infinite" }}
                        />
                      </g>
                    ) : (
                      /* Disconnected Circuit (Severed Rails) */
                      <g className="transition-opacity duration-300">
                        {/* Left Severed */}
                        <path d="M 0 32 C 70 32 90 55 125 70" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="125" cy="70" r="3" fill="#c29668" />

                        <path d="M 0 88 C 70 88 90 95 125 105" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="125" cy="105" r="3" fill="#c29668" />

                        <path d="M 0 152 C 70 152 90 145 125 135" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="125" cy="135" r="3" fill="#c29668" />

                        <path d="M 0 208 C 70 208 90 185 125 170" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="125" cy="170" r="3" fill="#c29668" />

                        {/* Right Severed */}
                        <path d="M 275 70 C 310 55 330 32 400 32" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="275" cy="70" r="3" fill="#c29668" />

                        <path d="M 275 105 C 310 95 330 88 400 88" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="275" cy="105" r="3" fill="#c29668" />

                        <path d="M 275 135 C 310 145 330 152 400 152" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="275" cy="135" r="3" fill="#c29668" />

                        <path d="M 275 170 C 310 185 330 208 400 208" stroke="#c29668" strokeWidth="2" strokeDasharray="5 6" />
                        <circle cx="275" cy="170" r="3" fill="#c29668" />
                      </g>
                    )}
                  </svg>

                  {/* Central Hub Icon */}
                  <div className={`absolute z-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isConnected
                      ? "bg-[#193022] text-[#71d78e] border-2 border-[#00ae3b] shadow-md scale-100"
                      : "bg-[#764b28] text-amber-200 border-2 border-amber-500 shadow-md scale-95"
                  }`}>
                    {isConnected ? (
                      <ShieldCheck className="w-8 h-8" />
                    ) : (
                      <AlertTriangle className="w-8 h-8" />
                    )}
                  </div>

                </div>
              </div>

              {/* 4 Right Outputs with Explicit General Ledger & CA Sync */}
              <div className="md:col-span-3 space-y-2.5 font-mono text-xs">
                <div className={`h-[64px] p-2.5 rounded-2xl border transition-all flex flex-col justify-center ${
                  isConnected
                    ? "bg-[#eaf5ed] border-[#b4c99c] text-[#193022]"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <strong className="block text-xs font-bold truncate">
                    {isConnected ? "Cleared Bank Deposit" : "₹1.42L Unmatched Variance"}
                  </strong>
                  <span className="text-[10px] opacity-75 block truncate">
                    {isConnected ? "Reconciled to the rupee" : "Silent payouts leakage"}
                  </span>
                </div>

                <div className={`h-[64px] p-2.5 rounded-2xl border transition-all flex flex-col justify-center ${
                  isConnected
                    ? "bg-[#eaf5ed] border-[#b4c99c] text-[#193022]"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <strong className="block text-xs font-bold truncate">
                    {isConnected ? "True CM2 & POAS" : "Blinded by Fake ROAS"}
                  </strong>
                  <span className="text-[10px] opacity-75 block truncate">
                    {isConnected ? "Actual profit after all cuts" : "Scaling loss-making SKUs"}
                  </span>
                </div>

                <div className={`h-[64px] p-2.5 rounded-2xl border transition-all flex flex-col justify-center ${
                  isConnected
                    ? "bg-[#eaf5ed] border-[#b4c99c] text-[#193022]"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <strong className="block text-xs font-bold truncate">
                    {isConnected ? "Dispute Recoveries" : "Expired SAFE-T Windows"}
                  </strong>
                  <span className="text-[10px] opacity-75 block truncate">
                    {isConnected ? "100% claims filed in SLA" : "₹1,000s lost to couriers"}
                  </span>
                </div>

                <div className={`h-[64px] p-2.5 rounded-2xl border transition-all flex flex-col justify-center ${
                  isConnected
                    ? "bg-[#eaf5ed] border-[#b4c99c] text-[#193022]"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <strong className="block text-xs font-bold truncate">
                    {isConnected ? "Statutory General Ledger" : "Untracked Tax & Audit Gaps"}
                  </strong>
                  <span className="text-[10px] opacity-75 block truncate">
                    {isConnected ? "Chartered Accountant Sync • Tally Ready" : "Unbalanced books & lump sums"}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Status Bar */}
            <div className={`mt-8 p-4 rounded-xl border flex items-center justify-between text-xs font-mono transition-colors ${
              isConnected
                ? "bg-[#f1f5ee] border-[#cfdfd1] text-[#00872e]"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}>
              <span>
                {isConnected ? "CONNECTED. RECONCILED. IN FLOW." : "DISCONNECTED. GUESSWORK IN SPREADSHEETS."}
              </span>
              <span className="font-semibold hidden sm:inline">
                {isConnected ? "3.8% Margin Recovered • Audit-Ready Books" : "Cash Leaking Daily"}
              </span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

// Backward-compatible alias
export const EcomflowFlowMachine = MarginFlowFlowMachine;

