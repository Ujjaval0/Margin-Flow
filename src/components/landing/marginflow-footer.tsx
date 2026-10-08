"use client";

import React from "react";
import Link from "next/link";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";

export interface MarginFlowFooterProps {
  onSignIn?: () => void;
  isAuthenticating?: boolean;
}

export function MarginFlowFooter({ onSignIn, isAuthenticating }: MarginFlowFooterProps) {
  return (
    <footer className="relative bg-[#050a07] text-[#eef5e9] overflow-hidden select-none border-t border-white/[0.08]">
      {/* Subtle Atmospheric Horizon Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-[#00ae3b]/25 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[120px] bg-[#00ae3b]/[0.05] blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20 sm:pb-14">
        
        {/* Navigation Row: Brand on left, Product + Channels & Trust side-by-side on right */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-10 lg:gap-16 pb-16 sm:pb-20 border-b border-white/[0.06]">
          
          {/* Brand Anchor */}
          <div className="max-w-sm space-y-3.5 shrink-0">
            <Link href="/" className="inline-flex items-center">
              <MarginFlowLogo className="h-7 w-auto text-white" />
            </Link>
            <p className="text-sm text-[#9ab1a1] leading-relaxed font-sans">
              Financial truth for marketplace commerce. Continuous transaction-level reconciliation down to the exact rupee.
            </p>
          </div>

          {/* Right Group: Product and Channels & Trust strictly side-by-side */}
          <div className="flex flex-row items-start gap-12 sm:gap-16 md:gap-24">
            
            {/* Column 1: Product */}
            <div className="space-y-3.5 min-w-[130px]">
              <span className="text-xs font-mono tracking-widest text-[#71d78e] uppercase font-semibold block">
                PRODUCT
              </span>
              <ul className="space-y-2.5 text-sm font-sans text-[#b2c8b7]">
                <li>
                  <a href="#engine" className="hover:text-white transition-colors block">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#routes" className="hover:text-white transition-colors block">
                    Reconciliation
                  </a>
                </li>
                <li>
                  <a href="#workspace" className="hover:text-white transition-colors block">
                    Cockpit
                  </a>
                </li>
                <li>
                  <a href="#metrics" className="hover:text-white transition-colors block">
                    Metrics
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2: Channels & Trust (Directly beside Product) */}
            <div className="space-y-3.5 min-w-[200px]">
              <span className="text-xs font-mono tracking-widest text-[#71d78e] uppercase font-semibold block">
                CHANNELS &amp; TRUST
              </span>
              <ul className="space-y-2.5 text-sm font-sans text-[#b2c8b7]">
                <li>
                  <span className="text-[#8da494] block">Amazon India • Flipkart</span>
                </li>
                <li>
                  <span className="text-[#8da494] block">Meesho • Shopify D2C</span>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors block">
                    Frequently Asked Questions
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors block">
                    Bank-Grade Read-Only Security
                  </a>
                </li>
              </ul>
            </div>

          </div>

        </div>

        {/* Monumental Architectural Watermark with increased generous spacing */}
        <div className="pt-16 sm:pt-24 pb-12 sm:pb-16 flex items-center justify-center overflow-hidden pointer-events-none select-none">
          <span className="text-[14vw] font-bold tracking-[-0.05em] text-white/[0.035] leading-none whitespace-nowrap block text-center font-sans">
            MARGINFLOW
          </span>
        </div>

        {/* Legal & Meta Bottom Bar */}
        <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-[#687d6e]">
          <p>© {new Date().getFullYear()} MarginFlow Technologies Pvt. Ltd. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}

export default MarginFlowFooter;
