"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function AlternatingEngines() {
  return (
    <section className="border-t border-black/[0.08] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 space-y-24 sm:space-y-32">
        
        {/* ROW 1: True Unit Economics Waterfall (Text Left / Isometric Blueprint Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-[#736F66]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>RECONCILIATION ENGINE 01</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              True Contribution Margin (CM2 & POAS)
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Deducts true purchase cost (COGS), actual courier weight freight, return transit deductions, and category commissions on every single order. Never scale loss-making SKUs with misleading ROAS again.
            </p>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline pt-2"
            >
              <span>Explore Waterfall Statement</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            {/* Micro Category Pills (Exact Medusa style) */}
            <div className="flex flex-wrap gap-2 pt-4">
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

          {/* Isometric Blueprint Diagram 1 (Medusa style stacked translucent planes) */}
          <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 bg-[#FAF7F2] rounded-3xl border border-black/[0.06]">
            <div className="w-full max-w-[480px] aspect-[16/11]">
              <svg viewBox="0 0 480 330" fill="none" className="w-full h-full select-none">
                {/* Isometric Grid Floor */}
                <path
                  d="M 50 140 L 240 250 L 430 140 L 240 30 Z"
                  stroke="#121214"
                  strokeWidth="1.25"
                  strokeDasharray="4 4"
                  className="opacity-20"
                />

                {/* Layer 1: Base Gross Invoiced Order */}
                <g className="transition-transform duration-300 hover:translate-y-[-2px]">
                  <path
                    d="M 80 120 L 240 210 L 400 120 L 240 30 Z"
                    fill="#FFFFFF"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                  <text x="240" y="115" textAnchor="middle" fill="#736F66" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                    Gross Order Revenue • ₹1,499.00
                  </text>
                </g>

                {/* Layer 2: COGS Deduction Plane */}
                <g className="transition-transform duration-300 hover:translate-y-[-4px]">
                  <path
                    d="M 80 160 L 240 250 L 400 160 L 240 70 Z"
                    fill="#F4F1EA"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                  <text x="240" y="155" textAnchor="middle" fill="#736F66" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                    Product COGS Deduction • −₹420.00
                  </text>
                </g>

                {/* Layer 3: Courier Freight & Marketplace Commission Plane */}
                <g className="transition-transform duration-300 hover:translate-y-[-6px]">
                  <path
                    d="M 80 200 L 240 290 L 400 200 L 240 110 Z"
                    fill="#EAE5DA"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                  <text x="240" y="195" textAnchor="middle" fill="#D70015" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                    Freight & Commissions • −₹535.00
                  </text>
                </g>

                {/* Layer 4: Net Bank Cash Plane (Electric Blue Highlight) */}
                <g className="transition-transform duration-300 hover:translate-y-[-8px]">
                  <path
                    d="M 80 240 L 240 330 L 400 240 L 240 150 Z"
                    fill="#0055FF"
                    fillOpacity="0.12"
                    stroke="#0055FF"
                    strokeWidth="2.5"
                  />
                  {/* Glowing Outline */}
                  <path
                    d="M 80 240 L 240 330 L 400 240 L 240 150 Z"
                    stroke="#0055FF"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text x="240" y="235" textAnchor="middle" fill="#0055FF" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
                    Net Verified Bank Cash • +₹729.00
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* ROW 2: Volumetric Weight Radar (Isometric Diagram Left / Text Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Isometric Blueprint Diagram 2 (Weight Scale & Dimension Scanner) */}
          <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 bg-[#FAF7F2] rounded-3xl border border-black/[0.06] order-2 lg:order-1">
            <div className="w-full max-w-[480px] aspect-[16/11]">
              <svg viewBox="0 0 480 330" fill="none" className="w-full h-full select-none">
                {/* Calibration Base Bed */}
                <path
                  d="M 70 200 L 240 295 L 410 200 L 240 105 Z"
                  fill="#FFFFFF"
                  stroke="#121214"
                  strokeWidth="2"
                />
                <path
                  d="M 70 200 L 240 295 L 240 315 L 70 220 Z"
                  fill="#D8D4C8"
                  stroke="#121214"
                  strokeWidth="2"
                />
                <path
                  d="M 240 295 L 410 200 L 410 220 L 240 315 Z"
                  fill="#C2BEB2"
                  stroke="#121214"
                  strokeWidth="2"
                />

                {/* Package on Scale */}
                <g>
                  <path
                    d="M 170 175 L 240 215 L 240 260 L 170 220 Z"
                    fill="#E8DEC8"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M 240 215 L 310 175 L 310 220 L 240 260 Z"
                    fill="#D5C7AA"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                  <path
                    d="M 170 175 L 240 215 L 310 175 L 240 135 Z"
                    fill="#F2EBDC"
                    stroke="#121214"
                    strokeWidth="1.75"
                  />
                </g>

                {/* Laser Bounding Box Wireframe (Measuring dimensions) */}
                <path
                  d="M 150 115 L 240 165 L 330 115 L 240 65 Z"
                  stroke="#0055FF"
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
                <line x1="150" y1="115" x2="150" y2="190" stroke="#0055FF" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="330" y1="115" x2="330" y2="190" stroke="#0055FF" strokeWidth="1" strokeDasharray="3 3" />

                {/* High Contrast Pixel Alert Badge (Image 2 style) */}
                <g>
                  <rect x="290" y="55" width="130" height="34" rx="6" fill="#121214" stroke="#0055FF" strokeWidth="1.5" />
                  <text x="355" y="76" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    +1,080g OVERCHARGE
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Text Content */}
          <div className="lg:col-span-5 space-y-5 order-1 lg:order-2">
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-[#736F66]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>RECONCILIATION ENGINE 02</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              Volumetric Weight Overcharge Radar
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Cross-checks every package AWB against your catalog dead and dimensional weights. Flag courier weight slab overcharges and automatically compile reimbursement dispute tickets before payouts settle.
            </p>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline pt-2"
            >
              <span>View Weight Audit Rules</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <div className="flex flex-wrap gap-2 pt-4">
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

        {/* ROW 3: SAFE-T & Dispute Recovery Docket (Text Left / Isometric Blueprint Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-[#736F66]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]" />
              <span>RECONCILIATION ENGINE 03</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
              Dispute Recovery & SAFE-T Docket
            </h3>

            <p className="text-base text-[#736F66] leading-relaxed">
              Automatically monitors strict 7–30 day claim windows for damaged, swapped, or undelivered packages. Assembles order invoice snapshots, weight telemetry, and damage checklists into pre-formatted claim packets.
            </p>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055FF] hover:underline pt-2"
            >
              <span>Explore Claims Cockpit</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <div className="flex flex-wrap gap-2 pt-4">
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

          {/* Isometric Blueprint Diagram 3 (Dispute Dossier & SLA Clock) */}
          <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10 bg-[#FAF7F2] rounded-3xl border border-black/[0.06]">
            <div className="w-full max-w-[480px] aspect-[16/11]">
              <svg viewBox="0 0 480 330" fill="none" className="w-full h-full select-none">
                {/* Dossier Portfolio Base */}
                <path
                  d="M 80 160 L 240 250 L 400 160 L 240 70 Z"
                  fill="#FFFFFF"
                  stroke="#121214"
                  strokeWidth="2"
                />
                <path
                  d="M 80 160 L 240 250 L 240 270 L 80 180 Z"
                  fill="#D8D4C8"
                  stroke="#121214"
                  strokeWidth="2"
                />

                {/* Evidence Photo Attachment Sheet */}
                <path
                  d="M 120 135 L 240 200 L 320 155 L 200 90 Z"
                  fill="#0055FF"
                  fillOpacity="0.08"
                  stroke="#0055FF"
                  strokeWidth="1.5"
                />

                {/* Green Stamp Seal */}
                <circle cx="240" cy="165" r="20" fill="#129E52" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M 233 165 L 238 170 L 248 160" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Expiring Window Callout */}
                <g>
                  <rect x="60" y="60" width="140" height="34" rx="6" fill="#121214" stroke="#E66A1F" strokeWidth="1.5" />
                  <text x="130" y="81" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                    ⏱ 4 DAYS TO FILE
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
