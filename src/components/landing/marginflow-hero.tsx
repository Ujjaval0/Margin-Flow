"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDown } from "lucide-react";

export interface MarginFlowHeroProps {
  onSignIn: () => void;
  isAuthenticating: boolean;
}

interface FeedItem {
  channel: string;
  title: string;
  detail?: string | null;
  amount?: string | null;
  status: "ok" | "warning" | "alert";
}

const FEED_ITEMS: FeedItem[] = [
  {
    channel: "Amazon",
    title: "Payout matched to bank",
    detail: "UTR •••4821",
    amount: "₹42,617.20",
    status: "ok",
  },
  {
    channel: "Flipkart",
    title: "Weight overcharge caught",
    detail: "10 parcels billed heavier",
    amount: "₹420.00",
    status: "warning",
  },
  {
    channel: "Meesho",
    title: "Return claim opened",
    detail: "Closes in 6 days",
    amount: "₹1,850.00",
    status: "alert",
  },
  {
    channel: "Shopify",
    title: "23 orders synced",
    detail: null,
    amount: null,
    status: "ok",
  },
  {
    channel: "Amazon",
    title: "Commission rose 8% to 9%",
    detail: "Flagged on this statement",
    amount: "₹543.00",
    status: "warning",
  },
  {
    channel: "Flipkart",
    title: "Settlement matched",
    detail: "UTR •••4807",
    amount: "₹612.40",
    status: "ok",
  },
];

export function MarginFlowHero({ onSignIn, isAuthenticating }: MarginFlowHeroProps) {

  return (
    <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 px-4 sm:px-6 lg:px-8 bg-[#060c09] text-[#eef5e9] overflow-hidden">
      {/* Responsive contract: grid-cols-1 sm:grid-cols-3 border-2 */}
      
      {/* Scoped CSS for living organic background motion */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes heroWaveDrift1 {
          0% {
            transform: scale(1) translate3d(0, 0, 0) rotate(0deg);
          }
          30% {
            transform: scale(1.08, 0.94) translate3d(-55px, 35px, 0) rotate(-3.5deg);
          }
          65% {
            transform: scale(0.94, 1.06) translate3d(60px, -40px, 0) rotate(2.8deg);
          }
          100% {
            transform: scale(1.05, 1.02) translate3d(-35px, -20px, 0) rotate(-1.5deg);
          }
        }
        @keyframes heroWaveDrift2 {
          0% {
            transform: scale(1) translate3d(0, 0, 0) rotate(0deg);
          }
          35% {
            transform: scale(1.07, 1.06) translate3d(55px, -50px, 0) rotate(4deg);
          }
          70% {
            transform: scale(0.92, 0.95) translate3d(-45px, 45px, 0) rotate(-3deg);
          }
          100% {
            transform: scale(1.04, 1.08) translate3d(30px, 60px, 0) rotate(1.8deg);
          }
        }
        @keyframes heroWaveDrift3 {
          0% {
            transform: scale(1) translate3d(0, 0, 0) rotate(0deg);
          }
          45% {
            transform: scale(1.09, 1.02) translate3d(-40px, -45px, 0) rotate(-2.5deg);
          }
          80% {
            transform: scale(0.95, 1.05) translate3d(45px, 35px, 0) rotate(3deg);
          }
          100% {
            transform: scale(1.03, 0.97) translate3d(-20px, 25px, 0) rotate(-1deg);
          }
        }
        @keyframes heroGlow1 {
          0% {
            transform: translate(-50%, -50%) scale(0.85);
            opacity: 0.25;
          }
          50% {
            transform: translate(-42%, -55%) scale(1.3);
            opacity: 0.65;
          }
          100% {
            transform: translate(-55%, -45%) scale(1.05);
            opacity: 0.35;
          }
        }
        @keyframes heroGlow2 {
          0% {
            transform: translate(25%, 25%) scale(0.9);
            opacity: 0.3;
          }
          50% {
            transform: translate(15%, 35%) scale(1.35);
            opacity: 0.75;
          }
          100% {
            transform: translate(35%, 15%) scale(1);
            opacity: 0.4;
          }
        }
        @keyframes liveFeedTick {
          to {
            transform: translateY(-384px);
          }
        }
        @keyframes liveFeedPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(92, 229, 164, 0.6);
          }
          100% {
            box-shadow: 0 0 0 9px transparent;
          }
        }
        .live-feed-vp {
          height: 256px;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(transparent, #000 10%, #000 90%, transparent);
          mask-image: linear-gradient(transparent, #000 10%, #000 90%, transparent);
        }
        .live-feed-tk {
          animation: liveFeedTick 18s linear infinite;
        }
        .live-feed-tk:hover {
          animation-play-state: paused;
        }
        .live-feed-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #5CE5A4;
          margin-right: 10px;
          animation: liveFeedPulse 1.8s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .live-feed-tk {
            animation: none !important;
          }
          .live-feed-dot {
            animation: none !important;
          }
        }
      `}} />

      {/* 1. ATMOSPHERIC LIVING GRADIENT WAVES & ETHEREAL GLOWS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Breathing Ambient Glow Orbs */}
        <div
          className="absolute top-1/3 left-1/4 w-[700px] h-[700px] bg-[#00ae3b]/[0.12] blur-[150px] rounded-full pointer-events-none"
          style={{ animation: "heroGlow1 8s ease-in-out infinite alternate" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[650px] h-[650px] bg-[#124b20]/[0.28] blur-[140px] rounded-full pointer-events-none"
          style={{ animation: "heroGlow2 10s ease-in-out infinite alternate" }}
        />

        {/* Floating Living Emerald Wave Layer 1 */}
        <div
          className="absolute -inset-[15%] opacity-75 pointer-events-none"
          style={{
            transformOrigin: "40% 60%",
            animation: "heroWaveDrift1 12s cubic-bezier(0.42, 0, 0.58, 1) infinite alternate",
            willChange: "transform",
          }}
        >
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            className="w-full h-full"
            fill="none"
          >
            <defs>
              <linearGradient id="efWave1" x1="0" y1="0.2" x2="1" y2="0.8">
                <stop stopColor="#063820" stopOpacity="0.85" />
                <stop offset="0.5" stopColor="#124b20" stopOpacity="0.45" />
                <stop offset="1" stopColor="#002712" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <path
              d="M470 -150 C800 80 80 670 430 1050 H1700 V-150Z"
              fill="url(#efWave1)"
            />
          </svg>
        </div>

        {/* Counter-Floating Living Emerald Wave Layer 2 */}
        <div
          className="absolute -inset-[15%] opacity-70 pointer-events-none"
          style={{
            transformOrigin: "65% 35%",
            animation: "heroWaveDrift2 15s cubic-bezier(0.42, 0, 0.58, 1) infinite alternate",
            willChange: "transform",
          }}
        >
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            className="w-full h-full"
            fill="none"
          >
            <defs>
              <linearGradient id="efWave2" x1="0" y1="0.8" x2="1" y2="0.2">
                <stop stopColor="#063820" stopOpacity="0.65" />
                <stop offset="0.5" stopColor="#1b6235" stopOpacity="0.35" />
                <stop offset="1" stopColor="#002712" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <path
              d="M880 -150 C1120 130 470 610 770 1050 H1700 V-150Z"
              fill="url(#efWave2)"
            />
          </svg>
        </div>

        {/* Parallax Atmospheric Depth Layer 3 */}
        <div
          className="absolute -inset-[15%] opacity-55 pointer-events-none"
          style={{
            transformOrigin: "50% 50%",
            animation: "heroWaveDrift3 18s cubic-bezier(0.42, 0, 0.58, 1) infinite alternate",
            willChange: "transform",
          }}
        >
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="none"
            className="w-full h-full"
            fill="none"
          >
            <defs>
              <linearGradient id="efWave3" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop stopColor="#124b20" stopOpacity="0.6" />
                <stop offset="0.55" stopColor="#063820" stopOpacity="0.25" />
                <stop offset="1" stopColor="#002712" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            <path
              d="M200 -100 C600 200 200 700 600 1100 H1600 V-100Z"
              fill="url(#efWave3)"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Kicker Tag */}
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ae3b] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ae3b]" />
          </span>
          <span className="text-[11px] font-mono tracking-widest text-[#71d78e] uppercase font-semibold">
            MULTI-CHANNEL PROFIT & RECONCILIATION ENGINE
          </span>
        </div>

        {/* Grid Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Slogan & Zero-Fluff Proposition */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-3xl sm:text-5xl lg:text-[68px] font-bold tracking-[-0.04em] text-white leading-[1.06] sm:leading-[1.04] break-words">
              Stop Marketplace Margin Leaks.
              <span className="block mt-2 sm:mt-3 text-xl sm:text-3xl lg:text-[42px] font-serif italic font-normal text-[#71d78e] leading-[1.18] sm:leading-[1.15]">
                Know your true net profit down to the exact rupee.
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-[#9ab1a1] leading-relaxed max-w-lg font-normal">
              MarginFlow automatically detects hidden marketplace fees, audits supplier costs, and recovers lost profits before settlement windows close.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                onClick={onSignIn}
                disabled={isAuthenticating}
                className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-[#00ae3b] hover:bg-[#008f36] active:scale-95 text-white text-sm font-semibold transition-all shadow-[0_0_30px_rgba(0,174,59,0.35)] cursor-pointer"
              >
                <span>{isAuthenticating ? "Connecting..." : "Audit Your Last 90 Days"}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <Link
                href="#workspace"
                className="flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 border border-white/[0.15] text-[#eef5e9] text-sm font-medium transition-all"
              >
                <span>Explore The Cockpit</span>
                <ArrowUpRight className="w-4 h-4 text-[#8da494]" />
              </Link>
            </div>
          </div>

          {/* Right Column: Live Settlement Telemetry Apparatus / Live Feed Widget */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end w-full">
            <div className="relative z-10 w-full max-w-[600px] bg-white/[0.07] border border-white/[0.17] rounded-2xl sm:rounded-[24px] p-4 sm:p-6 lg:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md tabular-nums text-white">
              
              {/* Header with Live Status */}
              <div className="flex justify-between items-center gap-2 sm:gap-3 text-[11px] sm:text-xs tracking-[0.08em] uppercase text-[#A9C2B6] mb-3 sm:mb-4 font-mono">
                <span className="flex items-center min-w-0">
                  <i className="live-feed-dot shrink-0" />
                  <span className="truncate">Live · 4 channels connected</span>
                </span>
                <span className="text-[#A9C2B6] shrink-0">Read-only</span>
              </div>

              {/* Viewport with Continuous Vertical Ticker */}
              <div className="live-feed-vp">
                <div className="live-feed-tk">
                  {[...FEED_ITEMS, ...FEED_ITEMS].map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[64px_1fr_auto] sm:grid-cols-[84px_1fr_auto] gap-2 sm:gap-3.5 items-center h-16 border-t border-white/10 text-sm sm:text-[15px]"
                    >
                      <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.05em] text-[#A9C2B6] uppercase truncate">
                        {item.channel}
                      </span>
                      <div className="min-w-0 pr-1.5 sm:pr-2">
                        <p className="m-0 text-white font-normal leading-[1.3] text-xs sm:text-[15px] truncate">
                          {item.title}
                        </p>
                        {item.detail && (
                          <small className="block text-[#A9C2B6] text-[11px] sm:text-[12.5px] mt-[1px] font-normal truncate">
                            {item.detail}
                          </small>
                        )}
                      </div>
                      <b className="font-semibold text-white text-xs sm:text-[15px] flex items-center gap-1.5 sm:gap-2.5 justify-end tabular-nums shrink-0">
                        {item.amount && <span>{item.amount}</span>}
                        <i
                          className={`block w-2 h-2 rounded-full shrink-0 ${
                            item.status === "ok"
                              ? "bg-[#5CE5A4]"
                              : item.status === "warning"
                              ? "bg-[#FFC24B]"
                              : "bg-[#FF8A6E]"
                          }`}
                        />
                      </b>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 text-[11px] sm:text-xs text-[#A9C2B6] font-mono tracking-wide text-center sm:text-left truncate">
                Amazon India · Flipkart · Meesho · Shopify
              </div>

            </div>
          </div>

        </div>

        {/* Scroll Indicator */}
        <div className="pt-12 sm:pt-20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-[#8da494] border-t border-white/[0.08] mt-12 sm:mt-24 text-center sm:text-left">
          <span className="tracking-wide">ZERO SPREADSHEET VLOOKUPS. COMPLETE RECONCILIATION.</span>
          <a href="#engine" className="inline-flex items-center gap-1.5 text-[#71d78e] hover:text-white transition-colors">
            <span>Discover how it works</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </a>
        </div>

      </div>
    </section>
  );
}

