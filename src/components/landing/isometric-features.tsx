"use client";

import React from "react";
import { TrendingUp, Scale, ShieldAlert, Receipt, ArrowRight } from "lucide-react";

export function IsometricFeatures() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-white border-y border-black/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#0071E3] text-xs font-semibold mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
            <span>Architecture & Modules</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-tight">
            Engineered to catch every rupee. <br />
            <span className="text-[#86868B]">Before payouts settle.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#6E6E73] leading-relaxed">
            Four specialized reconciliation modules continuously cross-check orders, courier freight, return shipments, and statutory withholdings.
          </p>
        </div>

        {/* 2x2 Feature Grid with Isometric Diagrams (inspired by Medusa & Image 3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          
          {/* Card 1: 4-Tier True Profit Waterfall */}
          <div className="group rounded-3xl bg-[#FAF9F6] border border-black/[0.07] p-8 sm:p-10 transition-all duration-300 hover:border-black/[0.15] hover:shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            {/* Top Text Content */}
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#0071E3] mb-5">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                True Contribution Margin (CM2 & POAS)
              </h3>
              <p className="mt-3 text-sm text-[#6E6E73] leading-relaxed">
                Calculates real profit on every single order by deducting unit purchase cost (COGS), actual courier freight, reverse logistics, and marketplace commission. Stop scaling unprofitable campaigns with misleading ROAS.
              </p>
            </div>

            {/* Isometric Visual Diagram 1: Stacked Financial Planes */}
            <div className="mt-8 pt-6 border-t border-black/[0.05] flex items-center justify-center">
              <div className="w-full max-w-[340px] aspect-[16/10] relative">
                <svg viewBox="0 0 340 210" fill="none" className="w-full h-full select-none">
                  {/* Layer 1: Base Gross Revenue */}
                  <g className="transition-transform duration-300 group-hover:translate-y-[-2px]">
                    <path
                      d="M 60 70 L 170 125 L 280 70 L 170 15 Z"
                      fill="#FFFFFF"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <text x="170" y="70" textAnchor="middle" fill="#86868B" fontSize="10" fontWeight="600">
                      Tier 1: Gross Revenue (₹1,499)
                    </text>
                  </g>

                  {/* Layer 2: COGS Deduction Plane */}
                  <g className="transition-transform duration-300 group-hover:translate-y-[-4px]">
                    <path
                      d="M 60 100 L 170 155 L 280 100 L 170 45 Z"
                      fill="#F5F5F7"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <text x="170" y="100" textAnchor="middle" fill="#86868B" fontSize="10" fontWeight="600">
                      Tier 2: Product COGS (−₹420)
                    </text>
                  </g>

                  {/* Layer 3: Courier & Commissions Plane */}
                  <g className="transition-transform duration-300 group-hover:translate-y-[-6px]">
                    <path
                      d="M 60 130 L 170 185 L 280 130 L 170 75 Z"
                      fill="#ECECEF"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <text x="170" y="130" textAnchor="middle" fill="#D70015" fontSize="10" fontWeight="600">
                      Tier 3: Courier & Fees (−₹359)
                    </text>
                  </g>

                  {/* Layer 4: Net Bank Cash (Glowing Emerald Highlight) */}
                  <g className="transition-transform duration-300 group-hover:translate-y-[-8px]">
                    <path
                      d="M 60 160 L 170 215 L 280 160 L 170 105 Z"
                      fill="#0071E3"
                      fillOpacity="0.1"
                      stroke="#0071E3"
                      strokeWidth="2"
                    />
                    <text x="170" y="160" textAnchor="middle" fill="#0071E3" fontSize="11" fontWeight="700">
                      Tier 4: Net Bank Cash (+₹720)
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2: Volumetric Courier Weight Discrepancy Radar */}
          <div className="group rounded-3xl bg-[#FAF9F6] border border-black/[0.07] p-8 sm:p-10 transition-all duration-300 hover:border-black/[0.15] hover:shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#B25E00] mb-5">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                Automated Courier Weight Reconciliation
              </h3>
              <p className="mt-3 text-sm text-[#6E6E73] leading-relaxed">
                Couriers regularly bump lightweight packages into 1.5kg or 2kg billing slabs. MarginFlow links to your catalog dimensions and audits every single AWB tracking number to flag ghost weight overcharges automatically.
              </p>
            </div>

            {/* Isometric Visual Diagram 2: Weight Scale & Dimension Scan with Pixel Warning (Image 2 style) */}
            <div className="mt-8 pt-6 border-t border-black/[0.05] flex items-center justify-center">
              <div className="w-full max-w-[340px] aspect-[16/10] relative">
                <svg viewBox="0 0 340 210" fill="none" className="w-full h-full select-none">
                  {/* Calibrated Isometric Weighing Tray */}
                  <path
                    d="M 50 135 L 170 195 L 290 135 L 170 75 Z"
                    fill="#FFFFFF"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 50 135 L 170 195 L 170 205 L 50 145 Z"
                    fill="#E0DDD5"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 170 195 L 290 135 L 290 145 L 170 205 Z"
                    fill="#CCC8C0"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />

                  {/* Tested Package on Scale */}
                  <g>
                    <path
                      d="M 120 120 L 170 145 L 170 175 L 120 150 Z"
                      fill="#EADFC9"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 170 145 L 220 120 L 220 150 L 170 175 Z"
                      fill="#D8CCB2"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 120 120 L 170 145 L 220 120 L 170 95 Z"
                      fill="#F6EEDB"
                      stroke="#1D1D1F"
                      strokeWidth="1.5"
                    />
                  </g>

                  {/* Dimensional Bounding Box / Laser Guides */}
                  <path
                    d="M 100 80 L 170 115 L 240 80 L 170 45 Z"
                    stroke="#0071E3"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    fill="none"
                  />

                  {/* Pixel Warning Triangle Badge (inspired by Image 2) */}
                  <g className="animate-bounce" style={{ animationDuration: "2.5s" }}>
                    <rect x="235" y="45" width="60" height="24" rx="6" fill="#D70015" />
                    <text x="265" y="61" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                      +1.1 kg Over
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Card 3: SAFE-T & Dispute Recovery Engine */}
          <div className="group rounded-3xl bg-[#FAF9F6] border border-black/[0.07] p-8 sm:p-10 transition-all duration-300 hover:border-black/[0.15] hover:shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-[#D70015] mb-5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                Dispute & SAFE-T Recovery Cockpit
              </h3>
              <p className="mt-3 text-sm text-[#6E6E73] leading-relaxed">
                When returns arrive damaged, swapped, or undelivered, marketplaces only allow strict 7–30 day dispute windows. MarginFlow tracks countdowns and compiles evidence checklists before reimbursement windows expire.
              </p>
            </div>

            {/* Isometric Visual Diagram 3: Dispute Packet & Countdown */}
            <div className="mt-8 pt-6 border-t border-black/[0.05] flex items-center justify-center">
              <div className="w-full max-w-[340px] aspect-[16/10] relative">
                <svg viewBox="0 0 340 210" fill="none" className="w-full h-full select-none">
                  {/* Isometric Document Dossier Base */}
                  <path
                    d="M 60 120 L 170 175 L 280 120 L 170 65 Z"
                    fill="#FFFFFF"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 60 120 L 170 175 L 170 185 L 60 130 Z"
                    fill="#E4E1D8"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />

                  {/* Photo Evidence Attached Sheet */}
                  <path
                    d="M 90 100 L 170 140 L 230 110 L 150 70 Z"
                    fill="#0071E3"
                    fillOpacity="0.06"
                    stroke="#0071E3"
                    strokeWidth="1.5"
                  />

                  {/* Verification Checkmark Stamp */}
                  <circle cx="170" cy="115" r="14" fill="#288548" />
                  <path d="M 164 115 L 168 119 L 176 111" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Countdown Warning Chip */}
                  <g>
                    <rect x="40" y="45" width="105" height="26" rx="6" fill="#1D1D1F" />
                    <text x="92" y="62" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                      ⏱ 4 Days to Expire
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Card 4: Settlement & Tax Withholding Shield */}
          <div className="group rounded-3xl bg-[#FAF9F6] border border-black/[0.07] p-8 sm:p-10 transition-all duration-300 hover:border-black/[0.15] hover:shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-[#288548] mb-5">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                Bank Settlement & Tax Asset Isolation
              </h3>
              <p className="mt-3 text-sm text-[#6E6E73] leading-relaxed">
                Never confuse statutory withholdings with operating expenses. MarginFlow segregates 1% GST TCS and 1% Section 194-O TDS into balance-sheet asset ledgers, keeping your books fully compliant and ready for chartered accountants.
              </p>
            </div>

            {/* Isometric Visual Diagram 4: Dual Ledger Asset Vault */}
            <div className="mt-8 pt-6 border-t border-black/[0.05] flex items-center justify-center">
              <div className="w-full max-w-[340px] aspect-[16/10] relative">
                <svg viewBox="0 0 340 210" fill="none" className="w-full h-full select-none">
                  {/* Isometric Bank Tray Foundation */}
                  <path
                    d="M 50 140 L 170 200 L 290 140 L 170 80 Z"
                    fill="#FFFFFF"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 50 140 L 170 200 L 170 210 L 50 150 Z"
                    fill="#DCD9D0"
                    stroke="#1D1D1F"
                    strokeWidth="1.5"
                  />

                  {/* Left Vault: Net Bank Cash */}
                  <g>
                    <path
                      d="M 80 120 L 140 150 L 140 170 L 80 140 Z"
                      fill="#D1E7DD"
                      stroke="#288548"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 140 150 L 190 125 L 190 145 L 140 170 Z"
                      fill="#BADBCC"
                      stroke="#288548"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 80 120 L 140 150 L 190 125 L 130 95 Z"
                      fill="#E8F4EE"
                      stroke="#288548"
                      strokeWidth="1.5"
                    />
                    <text x="135" y="130" textAnchor="middle" fill="#288548" fontSize="10" fontWeight="bold">
                      Bank Deposit
                    </text>
                  </g>

                  {/* Right Shield: Tax Asset Column (GST TCS / 194-O) */}
                  <g>
                    <path
                      d="M 180 80 L 230 105 L 230 130 L 180 105 Z"
                      fill="#E3EFFB"
                      stroke="#0071E3"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 230 105 L 270 85 L 270 110 L 230 130 Z"
                      fill="#C6DFF7"
                      stroke="#0071E3"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 180 80 L 230 105 L 270 85 L 220 60 Z"
                      fill="#F0F7FD"
                      stroke="#0071E3"
                      strokeWidth="1.5"
                    />
                    <text x="225" y="90" textAnchor="middle" fill="#0071E3" fontSize="9" fontWeight="bold">
                      TCS / TDS Assets
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
