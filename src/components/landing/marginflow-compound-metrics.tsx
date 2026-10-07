"use client";

import React, { useState } from "react";
import { RotateCcw, TrendingUp } from "lucide-react";

export function MarginFlowCompoundMetrics() {
  const [animKey, setAnimKey] = useState(0);
  const [hoverState, setHoverState] = useState<{
    x: number;
    y: number;
    val: string;
    monthText: string;
  } | null>(null);

  // Smooth curve interpolation along the S-curve
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 600;
    const clampedX = Math.max(40, Math.min(560, svgX));
    const t = (clampedX - 40) / 520;

    // Cubic smoothstep interpolation (flat at edges, steeper in middle)
    const s = t * t * (3 - 2 * t);
    const y = 175 - s * 120;
    const multiplier = (1.0 + s * 2.5).toFixed(1);
    const months = Math.round(t * 24);
    const monthText = months === 0 ? "Start" : `Month ${months}`;

    setHoverState({ x: clampedX, y, val: `${multiplier}×`, monthText });
  };

  const handleMouseLeave = () => {
    setHoverState(null);
  };

  return (
    <section id="metrics" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#f6f9f5] text-[#193022] border-t border-[#cfdfd1] select-none">
      {/* Scoped CSS for Chart Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes drawCompoundPath {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes wipeAreaGradient {
          0% {
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
            opacity: 1;
          }
        }
        @keyframes popEndpointMarker {
          0%, 75% {
            opacity: 0;
            transform: scale(0.3);
          }
          88% {
            opacity: 1;
            transform: scale(1.18);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes beaconPingRing {
          0% {
            r: 5px;
            opacity: 0.95;
            stroke-width: 2px;
          }
          75% {
            r: 18px;
            opacity: 0;
            stroke-width: 0.5px;
          }
          100% {
            r: 18px;
            opacity: 0;
            stroke-width: 0px;
          }
        }
        @keyframes beamSweep {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: -100;
          }
        }
      `,
        }}
      />

      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Top Section: 3 Big Growth Numbers (Exact MarginFlow style) */}
        <div>
          <div className="max-w-2xl mb-12">
            <span className="text-[11px] font-mono tracking-widest text-[#00872e] uppercase font-semibold block mb-3">
              MEASURABLE BUSINESS IMPACT
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
              Less manual spreadsheet agony.<br />
              <span className="font-serif italic font-normal text-[#00872e]">
                More net cash in your bank.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#00872e] block mb-2">
                3.8<span>%</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Gross Revenue Protected</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Recovered from courier deadweight inflation, unannounced fee hikes, and missed returns.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#193022] block mb-2">
                15<span>h</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Saved Every Week</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Zero manual Excel VLOOKUPs, formula debugging, or messy statement exports.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-[#cfdfd1] shadow-sm">
              <strong className="text-5xl sm:text-6xl font-mono font-light tracking-tight text-[#00872e] block mb-2">
                100<span>%</span>
              </strong>
              <h3 className="text-lg font-bold text-[#193022] font-mono">Claim SLA Compliance</h3>
              <p className="mt-1 text-sm text-[#5c7062] leading-relaxed">
                Evidence dossiers pre-compiled before 7–30 day platform dispute windows close.
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
                  <h4 className="text-base font-bold text-white font-mono">First-Month Return on Software</h4>
                  <p className="text-xs text-[#8da494]">Capital recovered from your past 90 days of unverified settlements often pays for MarginFlow in week one.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setHoverState(null);
                setAnimKey((k) => k + 1);
              }}
              className="self-start sm:self-center flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-mono text-[#b6f5cc] border border-white/[0.1] transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Curve</span>
            </button>
          </div>

          {/* SVG Animated Return Curve */}
          <div key={animKey} className="py-8 relative">
            <svg
              viewBox="0 0 600 200"
              className="w-full h-48 sm:h-56 overflow-visible select-none cursor-crosshair"
              fill="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="returnAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ae3b" stopOpacity="0.45" />
                  <stop offset="70%" stopColor="#00ae3b" stopOpacity="0.1" />
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

              {/* Area Reveal with synchronized wipe */}
              <path
                d="M 40 175 C 160 170, 240 145, 340 100 S 480 65, 560 55 L 560 175 Z"
                fill="url(#returnAreaGrad)"
                style={{
                  animation: "wipeAreaGradient 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              />

              {/* Base Animated Curve Line */}
              <path
                pathLength="100"
                d="M 40 175 C 160 170, 240 145, 340 100 S 480 65, 560 55"
                stroke="#71d78e"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="100"
                fill="none"
                style={{
                  animation: "drawCompoundPath 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              />

              {/* Continuous Luminous Pulse Gliding Along the Curve */}
              <path
                pathLength="100"
                d="M 40 175 C 160 170, 240 145, 340 100 S 480 65, 560 55"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="14 86"
                fill="none"
                style={{
                  animation: "beamSweep 3.2s linear infinite",
                  opacity: 0.8,
                  filter: "drop-shadow(0 0 6px #00ae3b)",
                }}
              />

              {/* Resting Endpoint Dot & 3.5x Tag Badge with Radar Ring */}
              <g
                style={{
                  animation: "popEndpointMarker 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  transformOrigin: "560px 55px",
                  opacity: hoverState ? 0.35 : 1,
                  transition: "opacity 200ms ease",
                }}
              >
                {/* Radar Ring 1 */}
                <circle
                  cx="560"
                  cy="55"
                  fill="none"
                  stroke="#71d78e"
                  style={{
                    animation: "beaconPingRing 2.4s cubic-bezier(0, 0.2, 0.8, 1) infinite",
                  }}
                />
                {/* Radar Ring 2 (staggered) */}
                <circle
                  cx="560"
                  cy="55"
                  fill="none"
                  stroke="#71d78e"
                  style={{
                    animation: "beaconPingRing 2.4s cubic-bezier(0, 0.2, 0.8, 1) 1.2s infinite",
                  }}
                />
                {/* Core Endpoint Dot */}
                <circle cx="560" cy="55" r="5" fill="#b6f5cc" stroke="#00ae3b" strokeWidth="2" />

                {/* 3.5x Tag Badge */}
                <g transform="translate(508, 15)">
                  <rect
                    width="56"
                    height="26"
                    rx="7"
                    fill="#00ae3b"
                    className="shadow-[0_0_16px_rgba(0,174,59,0.4)]"
                  />
                  <text
                    x="28"
                    y="17"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    3.5×
                  </text>
                </g>
              </g>

              {/* Interactive Hover Crosshair, Tracer Dot & Live Scrubbing Badge */}
              {hoverState && (
                <g className="transition-opacity duration-150">
                  {/* Vertical dashed guideline */}
                  <line
                    x1={hoverState.x}
                    y1={hoverState.y}
                    x2={hoverState.x}
                    y2="175"
                    stroke="#71d78e"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />

                  {/* Tracer Dot on the curve */}
                  <circle
                    cx={hoverState.x}
                    cy={hoverState.y}
                    r="6"
                    fill="#b6f5cc"
                    stroke="#00ae3b"
                    strokeWidth="2.5"
                    style={{ filter: "drop-shadow(0 0 8px rgba(0, 174, 59, 0.9))" }}
                  />

                  {/* Floating Value Pill */}
                  <g
                    transform={`translate(${Math.min(470, Math.max(70, hoverState.x))}, ${Math.max(
                      10,
                      hoverState.y - 38
                    )})`}
                  >
                    <rect
                      x="-65"
                      y="0"
                      width="130"
                      height="28"
                      rx="7"
                      fill="#0c190f"
                      stroke="#2b5e39"
                      strokeWidth="1"
                      className="shadow-xl"
                    />
                    <text
                      x="0"
                      y="18"
                      textAnchor="middle"
                      fill="#b6f5cc"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {hoverState.monthText} • {hoverState.val}
                    </text>
                  </g>
                </g>
              )}
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
