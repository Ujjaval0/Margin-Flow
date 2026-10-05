"use client";

import React from "react";
import { ShoppingBag, ShoppingCart, Tag, Globe, Rocket, ShieldCheck } from "lucide-react";

export function MarginFlowBrandMarquee() {
  const CHANNELS = [
    {
      name: "Amazon India",
      badge: "Official SP-API",
      badgeClass: "bg-[#233528] text-[#71d78e] border-[#00ae3b]/40",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#ff9900]" role="img" aria-label="Amazon">
          <path d="M13.9 14.1c-1.8 1.4-4.4 2.1-6.6 2.1-3.1 0-5.8-1.2-7.3-3.1-.2-.2 0-.5.2-.4 2.4 1.3 5.4 2.1 8.5 2.1 2 0 4.2-.5 6.1-1.5.3-.2.5.2.1.8zm1.2-1.3c-.2-.3-.5-.4-.8-.4-.4 0-.8.2-1.1.5-.1.1-.1.2 0 .3.5.7 1.3 1.1 2.2 1.1.2 0 .4 0 .5-.1.3-.1.5-.4.4-.7-.1-.3-.4-.6-.7-.7-.4-.1-.7-.1-1-.1l.5.2zM21.9 19c-1.8 2.2-4.7 3.5-7.9 3.5-4.4 0-8.3-2.4-10.4-6.1-.2-.3.1-.6.4-.4 2.4 1.8 5.5 2.9 8.8 2.9 2.8 0 5.4-.8 7.6-2.3.4-.3.8.1.5.4z" />
          <path d="M16.5 10.4c-.1-1.3-.7-2.6-1.7-3.4-1.2-1-2.9-1.5-4.7-1.5-3.4 0-6.1 1.7-7 4.5-.1.3.1.5.4.5l2.2-.3c.3 0 .4-.2.5-.4.5-1.5 1.9-2.5 3.7-2.5 1.1 0 2.1.3 2.8.9.6.5.9 1.2 1 2-.8.1-1.8.2-2.8.4-2.7.4-4.5 1.5-4.5 3.6 0 1.9 1.4 3 3.3 3 1.5 0 2.8-.7 3.5-1.9v1.4c0 .3.2.5.5.5h2.1c.3 0 .5-.2.5-.5v-6.7c0-.2-.1-.4-.2-.5zm-2.8 3.5c-.4.9-1.3 1.5-2.3 1.5-.9 0-1.6-.5-1.6-1.4 0-1.1.9-1.7 2.4-1.9.8-.1 1.5-.2 1.5-.2v2z" />
        </svg>
      ),
    },
    {
      name: "Flipkart",
      badge: "Settlement & SPF Sync",
      badgeClass: "bg-[#1b2b3a] text-[#60a5fa] border-[#3b82f6]/40",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#2874f0]" role="img" aria-label="Flipkart">
          <path d="M17.6 3H6.4C5.1 3 4 4.1 4 5.4v13.2C4 19.9 5.1 21 6.4 21h11.2c1.3 0 2.4-1.1 2.4-2.4V5.4C20 4.1 18.9 3 17.6 3zm-2.9 4.8l-1.2 4.1h2.2l-3.9 6.8 1.1-4.7h-2.1l3.9-6.2z" />
        </svg>
      ),
    },
    {
      name: "Meesho",
      badge: "Smart Statement Auto-Mapper",
      badgeClass: "bg-[#331c2b] text-[#f472b6] border-[#ec4899]/40",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#f43397]" role="img" aria-label="Meesho">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14h-2.1v-4.2c0-.9-.6-1.4-1.4-1.4s-1.4.5-1.4 1.4V16H9.5v-4.2c0-.9-.6-1.4-1.4-1.4s-1.4.5-1.4 1.4V16H4.6V9.4h2.1v1.1c.6-.8 1.5-1.3 2.5-1.3 1.2 0 2.2.6 2.7 1.6.6-1 1.7-1.6 2.9-1.6 1.9 0 3.2 1.3 3.2 3.3V16h-1.5z" />
        </svg>
      ),
    },
    {
      name: "Shopify Plus",
      badge: "HMAC-Verified Webhooks",
      badgeClass: "bg-[#183628] text-[#86efac] border-[#22c55e]/40",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#95bf47]" role="img" aria-label="Shopify">
          <path d="M19.9 6.2c-.1-.4-.4-.6-.7-.6-.1 0-1.8-.1-1.8-.1s-1.2-1.2-1.4-1.4c-.2-.2-.5-.3-.8-.3-.1 0-.6 0-1.2.1-.5-1.6-1.5-3-3.2-3-.3 0-.6 0-.8.1-.4-.3-.8-.5-1.3-.5-2.2 0-3.3 2.7-3.6 4.3l-2.4.7c-.7.2-.7.3-.8.9L.7 20.3c0 .3.1.5.3.7l10.1 2.9c.3.1.7.1 1 0l10.1-2.9c.2-.2.3-.4.3-.7L19.9 6.2zM12.8 3.5c.9 0 1.6 1.2 1.8 2.8l-3.8 1.1c.3-1.6 1.1-3.9 2-3.9zm-2.1 4.7l3.7-1.1c.1.9.1 1.8 0 2.6l-3.7 1.1v-2.6z" />
        </svg>
      ),
    },
    {
      name: "Shiprocket",
      badge: "Courier Telemetry",
      badgeClass: "bg-[#332a19] text-[#fcd34d] border-[#eab308]/40",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#79529cfb]" role="img" aria-label="Shiprocket">
          <path d="M12 2.5l8.5 4.9v9.8L12 22.1l-8.5-4.9V7.4L12 2.5zm0 2.3L5.5 8.5 12 12.2l6.5-3.7L12 4.8zm-7 5.1v6.8l6 3.5v-6.8L5 9.9zm14 0l-6 3.5v6.8l6-3.5V9.9z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-14 bg-[#060c09] border-y border-white/[0.08] overflow-hidden select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-mono tracking-widest text-[#71d78e] uppercase font-semibold mb-8">
          IN GOOD COMPANY. AUDITING MULTI-CHANNEL TRANSACTIONS ACROSS INDIA.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {CHANNELS.map((ch) => (
            <div
              key={ch.name}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.16] transition-all group shadow-sm"
            >
              <div className="w-6 h-6 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/[0.06]">
                {ch.icon}
              </div>
              <span className="text-xs sm:text-sm font-mono font-semibold text-white group-hover:text-[#b6f5cc] transition-colors">
                {ch.name}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-tight border ${ch.badgeClass}`}
              >
                {ch.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Backward-compatible alias
export const EcomflowBrandMarquee = MarginFlowBrandMarquee;

