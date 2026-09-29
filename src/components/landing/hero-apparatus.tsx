"use client";

import React, { useState } from "react";

export function HeroApparatus() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditPassed, setAuditPassed] = useState(true);

  const triggerScan = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditPassed(true);
    }, 1200);
  };

  return (
    <div className="w-full relative select-none">
      {/* The Isometric Apparatus Canvas (Free-flowing, no bounding card, pure Aintrum style) */}
      <div className="w-full aspect-[16/12] max-w-[620px] mx-auto relative flex items-center justify-center">
        <svg
          viewBox="0 0 680 500"
          className="w-full h-full drop-shadow-sm overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Glass reflection gradient */}
            <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.45" />
            </linearGradient>

            {/* Ambient shadow gradient */}
            <radialGradient id="apparatusGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Ambient Glow */}
          <ellipse cx="340" cy="270" rx="260" ry="140" fill="url(#apparatusGlow)" />

          {/* 1. DIAGONAL CONVEYOR BELT TRACK (From top-left to bottom-right across canvas) */}
          <g>
            {/* Lower Shadow Bed */}
            <path
              d="M 60 140 L 390 330 L 620 200 L 290 10 Z"
              fill="#E8E5DD"
              fillOpacity="0.7"
            />

            {/* Conveyor Bed Guide Track */}
            <path
              d="M 70 145 L 385 325 L 610 195 L 295 15 Z"
              fill="#F4F1EA"
              stroke="#121214"
              strokeWidth="1.75"
              strokeDasharray="5 5"
            />

            {/* Left Conveyor Frame Rail */}
            <path
              d="M 55 150 L 380 335 L 380 355 L 55 170 Z"
              fill="#D1CDC2"
              stroke="#121214"
              strokeWidth="2"
            />
            {/* Right Conveyor Frame Rail */}
            <path
              d="M 380 335 L 625 195 L 625 215 L 380 355 Z"
              fill="#BEBAAE"
              stroke="#121214"
              strokeWidth="2"
            />

            {/* Conveyor Support Legs (Mechanical Structural Columns) */}
            <path d="M 120 185 L 120 240 M 130 191 L 130 246" stroke="#121214" strokeWidth="2.5" />
            <path d="M 560 230 L 560 285 M 570 224 L 570 279" stroke="#121214" strokeWidth="2.5" />
            <path d="M 380 355 L 380 415" stroke="#121214" strokeWidth="3" />

            {/* Conveyor Rollers / Drive Slats */}
            {[0, 1, 2, 3, 4].map((i) => {
              const startX = 110 + i * 45;
              const startY = 168 + i * 26;
              return (
                <path
                  key={`slat-in-${i}`}
                  d={`M ${startX} ${startY} L ${startX + 50} ${startY - 29}`}
                  stroke="#121214"
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                  className="opacity-40"
                />
              );
            })}
          </g>

          {/* 2. INTAKE PACKAGE (Entering from Amazon/Flipkart - Left) */}
          <g className="transition-transform duration-500 hover:translate-y-[-4px] cursor-pointer">
            {/* Isometric Package Body */}
            <path
              d="M 140 160 L 195 192 L 195 235 L 140 203 Z"
              fill="#EADFC8"
              stroke="#121214"
              strokeWidth="1.75"
            />
            <path
              d="M 195 192 L 250 160 L 250 203 L 195 235 Z"
              fill="#DACDB2"
              stroke="#121214"
              strokeWidth="1.75"
            />
            <path
              d="M 140 160 L 195 192 L 250 160 L 195 128 Z"
              fill="#F5EFE0"
              stroke="#121214"
              strokeWidth="1.75"
            />

            {/* Sealing Tape (Cobalt) */}
            <path
              d="M 167 144 L 222 176 L 222 190 L 167 158 Z"
              fill="#0055FF"
              fillOpacity="0.85"
            />

            {/* High-Tech AWB Chip Tag (Image 1 style orange microchip) */}
            <rect x="175" y="196" width="30" height="14" rx="2" fill="#FF5500" stroke="#121214" strokeWidth="1" />
            <text x="190" y="206" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="monospace">
              AWB:IN
            </text>
          </g>

          {/* 3. THE CENTRAL RECONCILIATION & AUDIT CORE APPARATUS (Aintrum Machine Core) */}
          <g>
            {/* Foundation Chassis Bed */}
            <path
              d="M 245 175 L 400 265 L 515 200 L 360 110 Z"
              fill="#FFFFFF"
              stroke="#121214"
              strokeWidth="2.5"
            />
            {/* Base Vertical Lip Left */}
            <path
              d="M 245 175 L 400 265 L 400 305 L 245 215 Z"
              fill="#D6D1C4"
              stroke="#121214"
              strokeWidth="2.5"
            />
            {/* Base Vertical Lip Right */}
            <path
              d="M 400 265 L 515 200 L 515 240 L 400 305 Z"
              fill="#BFB9A8"
              stroke="#121214"
              strokeWidth="2.5"
            />

            {/* Corner Mechanical Fasteners / Hex Bolts (Aintrum precision) */}
            <circle cx="265" cy="188" r="4.5" fill="#FFFFFF" stroke="#121214" strokeWidth="2" />
            <circle cx="395" cy="265" r="4.5" fill="#FFFFFF" stroke="#121214" strokeWidth="2" />
            <circle cx="495" cy="206" r="4.5" fill="#FFFFFF" stroke="#121214" strokeWidth="2" />
            <circle cx="365" cy="128" r="4.5" fill="#FFFFFF" stroke="#121214" strokeWidth="2" />

            {/* Transparent Glass Hood / Inspection Enclosure (3D Isometric Dome) */}
            <path
              d="M 285 155 L 385 212 L 465 166 L 365 109 Z"
              fill="url(#glassGrad)"
              stroke="#0055FF"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            {/* Glass Thickness / Bevel Reflection */}
            <path
              d="M 285 155 L 385 212 L 385 235 L 285 178 Z"
              fill="#0055FF"
              fillOpacity="0.08"
              stroke="#0055FF"
              strokeWidth="1.5"
            />
            <path
              d="M 385 212 L 465 166 L 465 189 L 385 235 Z"
              fill="#0055FF"
              fillOpacity="0.12"
              stroke="#0055FF"
              strokeWidth="1.5"
            />

            {/* Inside Inspection Chamber: Package Under Active Volumetric Audit */}
            <g className={isAuditing ? "animate-pulse" : ""}>
              <path
                d="M 330 180 L 375 206 L 375 235 L 330 209 Z"
                fill="#F0E8D7"
                stroke="#121214"
                strokeWidth="1.5"
              />
              <path
                d="M 375 206 L 415 183 L 415 212 L 375 235 Z"
                fill="#E2D6C0"
                stroke="#121214"
                strokeWidth="1.5"
              />
              <path
                d="M 330 180 L 375 206 L 415 183 L 370 157 Z"
                fill="#FAF6ED"
                stroke="#121214"
                strokeWidth="1.5"
              />
            </g>

            {/* Laser Scanning Calibration Beam (Scanning Volumetric Bounding Box) */}
            <g>
              <line
                x1="315"
                y1="168"
                x2="430"
                y2="198"
                stroke={isAuditing ? "#FF3333" : "#0055FF"}
                strokeWidth="2.5"
                strokeDasharray="3 3"
                className="animate-pulse"
              />
              <path
                d="M 305 145 L 375 185 L 440 148 L 370 108 Z"
                stroke="#0055FF"
                strokeWidth="1.25"
                strokeDasharray="2 3"
                className="opacity-70"
              />
            </g>

            {/* Analog Sensor Console with Knobs & Precision Status Dials (Image 1 style) */}
            <g>
              {/* Floating Gauge Bed on Front Lip */}
              <path
                d="M 230 260 L 310 306 L 350 283 L 270 237 Z"
                fill="#FFFFFF"
                stroke="#121214"
                strokeWidth="1.75"
              />
              <path
                d="M 230 260 L 310 306 L 310 320 L 230 274 Z"
                fill="#D8D4C8"
                stroke="#121214"
                strokeWidth="1.75"
              />

              {/* Rotary Dials */}
              <ellipse cx="270" cy="272" rx="7" ry="4" fill="#121214" />
              <ellipse cx="295" cy="287" rx="7" ry="4" fill="#0055FF" />

              {/* Dial Pointers */}
              <line x1="270" y1="272" x2="274" y2="269" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="295" y1="287" x2="299" y2="284" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </g>

          {/* 4. VALIDATED OUTPUT PACKAGE (Exiting to Bank Settlement - Right) */}
          <g className="transition-transform duration-500 hover:translate-y-[-4px]">
            {/* Green Clean Verified Box */}
            <path
              d="M 500 215 L 545 241 L 545 272 L 500 246 Z"
              fill="#D1E7DD"
              stroke="#121214"
              strokeWidth="1.75"
            />
            <path
              d="M 545 241 L 585 218 L 585 249 L 545 272 Z"
              fill="#BADBCC"
              stroke="#121214"
              strokeWidth="1.75"
            />
            <path
              d="M 500 215 L 545 241 L 585 218 L 540 192 Z"
              fill="#E8F4EE"
              stroke="#121214"
              strokeWidth="1.75"
            />

            {/* Emerald Verified Seal Stamp */}
            <circle cx="542" cy="216" r="9" fill="#129E52" stroke="#FFFFFF" strokeWidth="1.5" />
            <path d="M 538 216 L 541 219 L 547 213" stroke="#FFFFFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

            {/* Output Cash Pill */}
            <rect x="525" y="248" width="46" height="15" rx="3" fill="#121214" />
            <text x="548" y="259" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="monospace">
              ₹729.00
            </text>
          </g>

          {/* 5. LIVE RECONCILIATION FLOATING ANNOTATION HUD (Architectural Callouts) */}
          {/* Audit Callout Node 1: Weight Discrepancy */}
          <g className="transition-all duration-300">
            {/* Pointer Line */}
            <line x1="390" y1="130" x2="480" y2="70" stroke="#121214" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="390" cy="130" r="3" fill="#0055FF" />

            {/* HUD Callout Pill */}
            <rect x="470" y="50" width="180" height="42" rx="8" fill="#FFFFFF" stroke="#121214" strokeWidth="1.5" className="filter drop-shadow-sm" />
            <text x="484" y="66" fill="#121214" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
              VOLUMETRIC FREIGHT AUDIT
            </text>
            <text x="484" y="81" fill="#E66A1F" fontSize="9" fontWeight="600" fontFamily="monospace">
              ⚠️ 1.5kg billed vs 420g actual
            </text>
          </g>

          {/* Audit Callout Node 2: Recovered Money */}
          <g className="transition-all duration-300">
            <line x1="310" y1="330" x2="220" y2="390" stroke="#121214" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="310" cy="330" r="3" fill="#129E52" />

            <rect x="130" y="375" width="180" height="42" rx="8" fill="#FFFFFF" stroke="#121214" strokeWidth="1.5" className="filter drop-shadow-sm" />
            <text x="144" y="391" fill="#121214" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
              OVERCHARGE RECOVERED
            </text>
            <text x="144" y="406" fill="#129E52" fontSize="9" fontWeight="bold" fontFamily="monospace">
              +₹185.00 Credited to Ledger
            </text>
          </g>
        </svg>

        {/* Interactive Scan Trigger Button (Bottom Center of Apparatus) */}
        <button
          onClick={triggerScan}
          disabled={isAuditing}
          className="absolute bottom-2 sm:bottom-4 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-black/10 hover:border-black/20 text-[#121214] text-xs font-semibold tracking-tight shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full ${isAuditing ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`} />
          <span>{isAuditing ? "Reconciling live AWB..." : "Run Inspection Simulation"}</span>
        </button>
      </div>
    </div>
  );
}
