"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDown, ShieldCheck, CheckCircle2, RefreshCw, Zap } from "lucide-react";

export interface MarginFlowHeroProps {
  onSignIn: () => void;
  isAuthenticating: boolean;
}

export type EcomflowHeroProps = MarginFlowHeroProps;

export function MarginFlowHero({ onSignIn, isAuthenticating }: MarginFlowHeroProps) {
  const [activeChannel, setActiveChannel] = useState<number>(0);

  const CHANNELS = [
    { name: "Amazon India", type: "SP-API Read-Only", status: "Reconciled", metric: "₹1,499.00 Invoiced", fee: "₹220.00 Comm", bank: "₹729.00 Bank" },
    { name: "Flipkart", type: "Order & SPF Sync", status: "Overcharge Intercepted", metric: "420g vs 1.5kg", fee: "−₹185.00 Flagged", bank: "Refund Queued" },
    { name: "Meesho", type: "Zero Commission", status: "RTO Toll Audited", metric: "COD Bounced", fee: "−₹205.00 Toll", bank: "Loss Isolated" },
    { name: "Shopify D2C", type: "Gateway & COGS", status: "POAS Verified", metric: "3.2x ROAS", fee: "2.14x POAS", bank: "True Margin" },
  ];

  return (
    <section className="relative pt-32 pb-24 sm:pt-40 sm:pb-32 px-4 sm:px-6 lg:px-8 bg-[#060c09] text-[#eef5e9] overflow-hidden select-none">
      
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
            YOUR RECONCILED CASH LEDGER
          </span>
        </div>

        {/* Grid Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Slogan & Zero-Fluff Proposition */}
          <div className="lg:col-span-6 space-y-6">
            <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-[-0.04em] text-white leading-[1.04]">
              Stop Marketplace Margin Leaks.<br />
              <span className="font-serif italic font-normal text-[#71d78e]">
                Know your true net profit down to the exact rupee.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#9ab1a1] leading-relaxed max-w-lg font-normal">
              Amazon, Flipkart, and couriers deduct fees in silence—from inflated weight slabs to expired return claims. MarginFlow reconciles every order, audits courier bills, and recovers your lost capital before payouts lock.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                onClick={onSignIn}
                disabled={isAuthenticating}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#00ae3b] hover:bg-[#008f36] active:scale-95 text-white text-sm font-mono font-semibold transition-all shadow-[0_0_30px_rgba(0,174,59,0.35)] cursor-pointer"
              >
                <span>{isAuthenticating ? "Connecting..." : "Let’s Audit Your Store"}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <Link
                href="#workspace"
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 border border-white/[0.15] text-[#eef5e9] text-sm font-mono font-medium transition-all"
              >
                <span>Explore The Workspace</span>
                <ArrowUpRight className="w-4 h-4 text-[#8da494]" />
              </Link>
            </div>

            {/* Human Trust Note */}
            <div className="pt-4 flex items-center gap-3 text-xs text-[#8da494]">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#122314] border border-[#2b5e39] text-[#71d78e] font-serif italic text-sm">
                m.
              </span>
              <span>
                Built by multi-channel operators. <strong className="text-[#eef5e9]">Protected by statutory double-entry math.</strong>
              </span>
            </div>
          </div>

          {/* Right Column: Live Settlement Telemetry Apparatus */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl bg-[#0c140e]/90 border border-white/[0.12] p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] space-y-6">
              
              {/* Header with Live Status */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00ae3b] animate-pulse" />
                  <span className="text-xs font-mono font-bold tracking-wider text-[#eef5e9]">
                    MULTI-CHANNEL INGESTION STREAM
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#71d78e]">Live Sync • Read-Only</span>
              </div>

              {/* Channel Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CHANNELS.map((ch, idx) => (
                  <button
                    key={ch.name}
                    onClick={() => setActiveChannel(idx)}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      activeChannel === idx
                        ? "bg-[#183d24] border border-[#00ae3b]/40 text-white shadow-[0_0_15px_rgba(0,174,59,0.2)]"
                        : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-[#8da494]"
                    }`}
                  >
                    <span className="block text-[10px] font-mono opacity-60">0{idx + 1}</span>
                    <span className="block text-xs font-semibold truncate mt-0.5">{ch.name}</span>
                  </button>
                ))}
              </div>

              {/* Active Channel Telemetry Card */}
              <div className="p-5 rounded-2xl bg-[#060c09] border border-white/[0.08] space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between text-[#8da494]">
                  <span>Active Connection</span>
                  <span className="text-[#b6f5cc] font-semibold">{CHANNELS[activeChannel].type}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[10px] text-[#8da494] mb-1">INTAKE</span>
                    <span className="text-xs font-bold text-white">{CHANNELS[activeChannel].metric}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[10px] text-[#8da494] mb-1">DEDUCTIONS</span>
                    <span className="text-xs font-bold text-rose-400">{CHANNELS[activeChannel].fee}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#122314] border border-[#00ae3b]/30">
                    <span className="block text-[10px] text-[#71d78e] mb-1">CLEARED CASH</span>
                    <span className="text-xs font-bold text-[#b6f5cc]">{CHANNELS[activeChannel].bank}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-[11px] text-[#8da494]">
                  <span>Status:</span>
                  <span className="text-[#00ae3b] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {CHANNELS[activeChannel].status}
                  </span>
                </div>
              </div>

              {/* Bottom Metric Bar */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <strong className="block text-2xl font-mono font-light tracking-tight text-[#b6f5cc]">
                    3.8<span className="text-sm font-sans">%</span>
                  </strong>
                  <span className="text-[11px] text-[#8da494] font-mono mt-0.5 block">
                    Avg. margin recovered
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <strong className="block text-2xl font-mono font-light tracking-tight text-white">
                    100<span className="text-sm font-sans">%</span>
                  </strong>
                  <span className="text-[11px] text-[#8da494] font-mono mt-0.5 block">
                    Claims filed before SLA
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Scroll Indicator */}
        <div className="pt-16 sm:pt-20 flex items-center justify-between text-xs font-mono text-[#8da494] border-t border-white/[0.08] mt-16 sm:mt-24">
          <span>ZERO SPREADSHEET VLOOKUPS. COMPLETE RECONCILIATION.</span>
          <a href="#engine" className="flex items-center gap-1.5 text-[#71d78e] hover:text-white transition-colors">
            <span>Discover the engine</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </a>
        </div>

      </div>
    </section>
  );
}

// Backward-compatible alias
export const EcomflowHero = MarginFlowHero;

