"use client";

import React from "react";
import {
  ShoppingCart,
  Truck,
  Receipt,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export function MarginFlowFlowMachine() {
  return (
    <section
      id="engine"
      className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#fafbfa] text-[#193022] select-none border-t border-[#e2e8e0]"
    >
      {/* Scoped CSS for continuous flowing light streams */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes flowMachineBeam {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -168; }
        }
      `,
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Section Heading */}
        <div className="max-w-2xl mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
            Four sources of data.<br />
            <span className="font-serif italic font-normal text-[#00872e]">
              One unquestionable financial truth.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Marketplaces, couriers, and suppliers bill in silos. MarginFlow continuously cross-references orders, courier bills, bank UTRs, and purchase invoices to catch leaks before they hit your P&L.
          </p>
        </div>

        {/* Compact, Professional Apparatus Card */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-white border border-[#e2e8e0] p-5 sm:p-8 lg:p-10 shadow-[0_12px_36px_rgba(0,0,0,0.03)]">
          {/* Inner Dotted Canvas Arena (Clean Neutral with Subtle Accents) */}
          <div
            className="relative rounded-2xl sm:rounded-3xl border border-[#e8ece6] bg-[#fbfcfb] overflow-hidden p-5 sm:p-8 min-h-[220px] sm:min-h-[250px] flex items-center justify-between"
            style={{
              backgroundImage: "radial-gradient(#d1dbd0 1.2px, transparent 1.2px)",
              backgroundSize: "22px 22px",
            }}
          >
            {/* SVG Connecting Rails with Live Animated Light Streams */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              viewBox="0 0 1000 240"
              preserveAspectRatio="none"
              fill="none"
            >
              <g>
                {/* Left Rails Base */}
                <path
                  d="M 230 50 C 350 50, 410 120, 465 120"
                  stroke="#e2e8e0"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path d="M 230 120 L 465 120" stroke="#e2e8e0" strokeWidth="1.5" fill="none" />
                <path
                  d="M 230 190 C 350 190, 410 120, 465 120"
                  stroke="#e2e8e0"
                  strokeWidth="1.5"
                  fill="none"
                />

                {/* Right Rails Base */}
                <path
                  d="M 535 120 C 590 120, 650 50, 770 50"
                  stroke="#e2e8e0"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path d="M 535 120 L 770 120" stroke="#e2e8e0" strokeWidth="1.5" fill="none" />
                <path
                  d="M 535 120 C 590 120, 650 190, 770 190"
                  stroke="#e2e8e0"
                  strokeWidth="1.5"
                  fill="none"
                />

                {/* Flowing Emerald Light Pulses */}
                <path
                  d="M 230 50 C 350 50, 410 120, 465 120"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="28 140"
                  fill="none"
                  style={{ animation: "flowMachineBeam 2.4s linear infinite" }}
                />
                <path
                  d="M 230 120 L 465 120"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="32 120"
                  fill="none"
                  style={{ animation: "flowMachineBeam 1.9s linear infinite" }}
                />
                <path
                  d="M 230 190 C 350 190, 410 120, 465 120"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="28 140"
                  fill="none"
                  style={{ animation: "flowMachineBeam 2.6s linear infinite" }}
                />

                <path
                  d="M 535 120 C 590 120, 650 50, 770 50"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="28 140"
                  fill="none"
                  style={{ animation: "flowMachineBeam 2.3s linear infinite" }}
                />
                <path
                  d="M 535 120 L 770 120"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="32 120"
                  fill="none"
                  style={{ animation: "flowMachineBeam 1.8s linear infinite" }}
                />
                <path
                  d="M 535 120 C 590 120, 650 190, 770 190"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="28 140"
                  fill="none"
                  style={{ animation: "flowMachineBeam 2.5s linear infinite" }}
                />
              </g>
            </svg>

            {/* Left Column: 3 Compact Cards with Decreased Gaps */}
            <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 shrink-0 w-38 sm:w-46 lg:w-50">
              {/* Card 1 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  Marketplace orders
                </span>
              </div>

              {/* Card 2 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  Courier telemetry
                </span>
              </div>

              {/* Card 3 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  Bank UTR & bills
                </span>
              </div>
            </div>

            {/* Center Column: Signature "m." Circular Logo Emblem matching Image 2 */}
            <div className="relative z-10 flex items-center justify-center shrink-0 mx-2 sm:mx-6">
              <div className="relative flex items-center justify-center w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#111813] border border-[#233829] shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
                {/* Subtle inner highlight ring */}
                <div className="absolute inset-0.5 rounded-full border border-white/10 pointer-events-none" />
                <span className="font-serif italic text-base sm:text-lg font-medium text-[#52c47a] select-none pl-0.5 pb-0.5">
                  m.
                </span>
              </div>
            </div>

            {/* Right Column: 3 Compact Output Cards with Decreased Gaps */}
            <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 shrink-0 w-38 sm:w-46 lg:w-50">
              {/* Card 1 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  Cleared bank cash
                </span>
              </div>

              {/* Card 2 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  Dispute recoveries
                </span>
              </div>

              {/* Card 3 */}
              <div className="bg-white rounded-xl border border-[#e2e8e0] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:border-[#cbd5e1] transition-all">
                <div className="w-6 h-6 rounded-md bg-[#f4f6f4] flex items-center justify-center text-[#193022] shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#193022] tracking-tight whitespace-nowrap">
                  True net margin
                </span>
              </div>
            </div>
          </div>

          {/* Three Clean Feature Columns Below Canvas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-[#e2e8e0]">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#193022] tracking-tight">
                A single audit ledger
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#5c7062] leading-relaxed">
                Orders, courier deadweights, and bank settlements reconciled in one workspace.
              </p>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#193022] tracking-tight">
                Coordinated recoveries
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#5c7062] leading-relaxed">
                Courier deadweight overcharges and dispute dossiers auto-compiled before SLA.
              </p>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#193022] tracking-tight">
                Zero surprise deductions
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#5c7062] leading-relaxed">
                MarginFlow tracks true contribution profit and isolates 1% TCS/TDS withholdings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
