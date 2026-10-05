"use client";

import React, { useState } from "react";
import { RotateCcw, TrendingUp } from "lucide-react";

export function EcomflowCompoundMetrics() {
  const [animKey, setAnimKey] = useState(0);

  return (
    <section id="metrics" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] border-t border-[#cfdfd1] select-none">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Top Section: 3 Big Growth Numbers (Exact Ecomflow style) */}
        <div>
          <div className="max-w-2xl mb-12">
            <span className="text-[11px] font-mono tracking-widest text-[#00872e] uppercase font-semibold block mb-3">
              MORE ROOM FOR PROFIT
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
              Less manual guesswork.<br />
              <span className="font-serif italic font-normal text-[#00872e]">
                More cash in your bank.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#00872e] block mb-2">
                3.8<span>%</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Margin Recovered</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Reclaimed from courier weight slab inflation and unannounced fee hikes.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#193022] block mb-2">
                15<span>h</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Back Every Week</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Zero manual Excel VLOOKUPs or messy settlement downloads.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#00872e] block mb-2">
                100<span>%</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Claim SLA Compliance</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Evidence packets pre-compiled before 7–30 day dispute windows close.
              </p>
            </div>
          </div>
        </div>

        {/* Lower Section: High-Contrast Obsidian & Emerald Compound Effect Card */}
        <div className="rounded-3xl bg-[#122314] text-[#eef5e9] p-8 sm:p-12 border border-[#23452d] shadow-2xl relative overflow-hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-white/[0.1]">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#71d78e] uppercase font-semibold block mb-2">
                THE COMPOUND EFFECT
              </span>
              <div className="flex items-center gap-4">
                <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#b6f5cc]">
                  3.5<span>×</span>
                </strong>
                <div>
                  <h4 className="text-base font-bold text-white font-mono">Average Return on Software</h4>
                  <p className="text-xs text-[#8da494]">Capital preserved and recovered within 24 months.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setAnimKey((k) => k + 1)}
              className="self-start sm:self-center flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-mono text-[#b6f5cc] border border-white/[0.1] transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Curve</span>
            </button>
          </div>

          {/* SVG Animated Return Curve */}
          <div key={animKey} className="py-8 relative">
            <svg viewBox="0 0 600 200" className="w-full h-48 overflow-visible" fill="none">
              <defs>
                <linearGradient id="returnAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ae3b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00ae3b" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="40" x2="560" y2="40" stroke="#23452d" strokeDasharray="3 4" />
              <text x="15" y="44" fill="#8da494" fontSize="10" fontFamily="monospace">4×</text>

              <line x1="40" y1="85" x2="560" y2="85" stroke="#23452d" strokeDasharray="3 4" />
              <text x="15" y="89" fill="#8da494" fontSize="10" fontFamily="monospace">3×</text>

              <line x1="40" y1="130" x2="560" y2="130" stroke="#23452d" strokeDasharray="3 4" />
              <text x="15" y="134" fill="#8da494" fontSize="10" fontFamily="monospace">2×</text>

              <line x1="40" y1="175" x2="560" y2="175" stroke="#23452d" strokeDasharray="3 4" />
              <text x="15" y="179" fill="#8da494" fontSize="10" fontFamily="monospace">1×</text>

              {/* Area */}
              <path
                d="M 40 175 C 160 170, 240 145, 340 100 S 480 65, 560 55 L 560 175 Z"
                fill="url(#returnAreaGrad)"
                className="animate-in fade-in duration-700"
              />

              {/* Curve */}
              <path
                d="M 40 175 C 160 170, 240 145, 340 100 S 480 65, 560 55"
                stroke="#71d78e"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="animate-in fade-in duration-500"
              />

              {/* Endpoint Dot & Tag */}
              <circle cx="560" cy="55" r="5" fill="#b6f5cc" />
              <rect x="510" y="15" width="55" height="24" rx="6" fill="#00ae3b" />
              <text x="537" y="31" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                3.5×
              </text>
            </svg>

            <div className="flex justify-between text-[11px] font-mono text-[#8da494] px-8 pt-2">
              <span>Start</span>
              <span>6 Months</span>
              <span>12 Months</span>
              <span>18 Months</span>
              <span>24 Months</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-[#8da494]">
            <span>Continuous automated margin audit</span>
            <span className="text-[#b6f5cc]">Verified Across 300+ Merchant Accounts</span>
          </div>

        </div>

      </div>
    </section>
  );
}
