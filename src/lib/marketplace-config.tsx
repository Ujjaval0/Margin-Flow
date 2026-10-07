import React from "react";
import { Layers } from "lucide-react";
import { Marketplace } from "@/domain/types";

// ====================================================
// Authentic Brand Vector SVG Logos
// ====================================================

export function AmazonLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="Amazon">
      <path d="M13.9 14.1c-1.8 1.4-4.4 2.1-6.6 2.1-3.1 0-5.8-1.2-7.3-3.1-.2-.2 0-.5.2-.4 2.4 1.3 5.4 2.1 8.5 2.1 2 0 4.2-.5 6.1-1.5.3-.2.5.2.1.8zm1.2-1.3c-.2-.3-.5-.4-.8-.4-.4 0-.8.2-1.1.5-.1.1-.1.2 0 .3.5.7 1.3 1.1 2.2 1.1.2 0 .4 0 .5-.1.3-.1.5-.4.4-.7-.1-.3-.4-.6-.7-.7-.4-.1-.7-.1-1-.1l.5.2zM21.9 19c-1.8 2.2-4.7 3.5-7.9 3.5-4.4 0-8.3-2.4-10.4-6.1-.2-.3.1-.6.4-.4 2.4 1.8 5.5 2.9 8.8 2.9 2.8 0 5.4-.8 7.6-2.3.4-.3.8.1.5.4z" />
      <path d="M16.5 10.4c-.1-1.3-.7-2.6-1.7-3.4-1.2-1-2.9-1.5-4.7-1.5-3.4 0-6.1 1.7-7 4.5-.1.3.1.5.4.5l2.2-.3c.3 0 .4-.2.5-.4.5-1.5 1.9-2.5 3.7-2.5 1.1 0 2.1.3 2.8.9.6.5.9 1.2 1 2-.8.1-1.8.2-2.8.4-2.7.4-4.5 1.5-4.5 3.6 0 1.9 1.4 3 3.3 3 1.5 0 2.8-.7 3.5-1.9v1.4c0 .3.2.5.5.5h2.1c.3 0 .5-.2.5-.5v-6.7c0-.2-.1-.4-.2-.5zm-2.8 3.5c-.4.9-1.3 1.5-2.3 1.5-.9 0-1.6-.5-1.6-1.4 0-1.1.9-1.7 2.4-1.9.8-.1 1.5-.2 1.5-.2v2z" />
    </svg>
  );
}

export function FlipkartLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="Flipkart">
      <path d="M17.6 3H6.4C5.1 3 4 4.1 4 5.4v13.2C4 19.9 5.1 21 6.4 21h11.2c1.3 0 2.4-1.1 2.4-2.4V5.4C20 4.1 18.9 3 17.6 3zm-2.9 4.8l-1.2 4.1h2.2l-3.9 6.8 1.1-4.7h-2.1l3.9-6.2z" />
    </svg>
  );
}

export function MyntraLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Myntra">
      <defs>
        <linearGradient id="myntra-badge-grad" x1="3" y1="8" x2="21" y2="17.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF3F6C" />
          <stop offset="0.5" stopColor="#FF6B00" />
          <stop offset="1" stopColor="#FF9000" />
        </linearGradient>
      </defs>
      <path
        d="M4.2 17.5C3.5 17.5 3 16.8 3 15.6C3 13.2 5.5 8 7.8 8C9.5 8 10.5 9.4 11.2 10.9L12 12.5L12.8 10.9C13.5 9.4 14.5 8 16.2 8C18.5 8 21 13.2 21 15.6C21 16.8 20.5 17.5 19.8 17.5C18.5 17.5 17.3 15.5 16.3 13.5C15.5 11.9 14.9 10.5 14.3 10.5C13.9 10.5 13.5 11.2 13 12.2L12 14L11 12.2C10.5 11.2 10.1 10.5 9.7 10.5C9.1 10.5 8.5 11.9 7.7 13.5C6.7 15.5 5.5 17.5 4.2 17.5Z"
        fill="url(#myntra-badge-grad)"
      />
    </svg>
  );
}

export function MeeshoLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="Meesho">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14h-2.1v-4.2c0-.9-.6-1.4-1.4-1.4s-1.4.5-1.4 1.4V16H9.5v-4.2c0-.9-.6-1.4-1.4-1.4s-1.4.5-1.4 1.4V16H4.6V9.4h2.1v1.1c.6-.8 1.5-1.3 2.5-1.3 1.2 0 2.2.6 2.7 1.6.6-1 1.7-1.6 2.9-1.6 1.9 0 3.2 1.3 3.2 3.3V16h-1.5z" />
    </svg>
  );
}

export function WooCommerceLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="WooCommerce">
      <path d="M2.5 5.5C2.5 3.6 4 2 6 2h12c2 0 3.5 1.6 3.5 3.5v8c0 1.9-1.5 3.5-3.5 3.5h-5.2l-3.8 3.5V17H6c-2 0-3.5-1.6-3.5-3.5v-8zm4.2 3.8c-.4 0-.8.3-.8.8 0 1.5 1 2.8 2.5 2.8 1.1 0 1.9-.7 2.3-1.7.4 1 1.2 1.7 2.3 1.7 1.5 0 2.5-1.3 2.5-2.8 0-.5-.4-.8-.8-.8s-.8.3-.8.8c0 .8-.5 1.4-1.2 1.4-.6 0-1.1-.5-1.2-1.3v-.9c0-.4-.4-.8-.8-.8s-.8.4-.8.8v.9c-.1.8-.6 1.3-1.2 1.3-.7 0-1.2-.6-1.2-1.4 0-.5-.4-.8-.8-.8z" />
    </svg>
  );
}

export function ShopifyLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="Shopify">
      <path d="M19.9 6.2c-.1-.4-.4-.6-.7-.6-.1 0-1.8-.1-1.8-.1s-1.2-1.2-1.4-1.4c-.2-.2-.5-.3-.8-.3-.1 0-.6 0-1.2.1-.5-1.6-1.5-3-3.2-3-.3 0-.6 0-.8.1-.4-.3-.8-.5-1.3-.5-2.2 0-3.3 2.7-3.6 4.3l-2.4.7c-.7.2-.7.3-.8.9L.7 20.3c0 .3.1.5.3.7l10.1 2.9c.3.1.7.1 1 0l10.1-2.9c.2-.2.3-.4.3-.7L19.9 6.2zM12.8 3.5c.9 0 1.6 1.2 1.8 2.8l-3.8 1.1c.3-1.6 1.1-3.9 2-3.9zm-2.1 4.7l3.7-1.1c.1.9.1 1.8 0 2.6l-3.7 1.1v-2.6z" />
    </svg>
  );
}

export function B2BWholesaleLogo({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="B2B Wholesale">
      <path d="M3 21h18M3 7v14M21 7v14M9 3h6v4H9zM9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  );
}

export type MarketplaceLogoComponent = React.ComponentType<{ className?: string }>;

export interface MarketplaceConfigItem {
  id: Marketplace;
  label: string;
  sublabel: string;
  estCommission: number;
  icon: MarketplaceLogoComponent;
  colorClass: string;
  pillClass: string;
  dotClass: string;
  tag: string;
}

export const MARKETPLACE_CONFIGS: Record<Marketplace, MarketplaceConfigItem> = {
  "Amazon India": {
    id: "Amazon India",
    label: "Amazon India",
    sublabel: "15% est. fee",
    estCommission: 15,
    icon: AmazonLogo,
    colorClass: "bg-amber-500/10 text-[#FF9900] border-amber-500/25",
    pillClass: "bg-amber-50 text-amber-800 border border-amber-200/60",
    dotClass: "bg-[#FF9900]",
    tag: "AMZ",
  },
  Flipkart: {
    id: "Flipkart",
    label: "Flipkart",
    sublabel: "15% est. fee",
    estCommission: 15,
    icon: FlipkartLogo,
    colorClass: "bg-blue-500/10 text-[#2874F0] border-blue-500/25",
    pillClass: "bg-blue-50 text-blue-800 border border-blue-200/60",
    dotClass: "bg-[#2874F0]",
    tag: "FK",
  },
  Myntra: {
    id: "Myntra",
    label: "Myntra",
    sublabel: "20% est. fee",
    estCommission: 20,
    icon: MyntraLogo,
    colorClass: "bg-pink-500/10 text-[#FF3F6C] border-pink-500/25",
    pillClass: "bg-pink-50 text-pink-800 border border-pink-200/60",
    dotClass: "bg-[#FF3F6C]",
    tag: "MYN",
  },
  Meesho: {
    id: "Meesho",
    label: "Meesho",
    sublabel: "0% commission",
    estCommission: 0,
    icon: MeeshoLogo,
    colorClass: "bg-rose-500/10 text-[#F43397] border-rose-500/25",
    pillClass: "bg-rose-50 text-rose-800 border border-rose-200/60",
    dotClass: "bg-[#F43397]",
    tag: "MSH",
  },
  WooCommerce: {
    id: "WooCommerce",
    label: "WooCommerce",
    sublabel: "2% gateway fee",
    estCommission: 2,
    icon: WooCommerceLogo,
    colorClass: "bg-purple-500/10 text-[#7F54B3] border-purple-500/25",
    pillClass: "bg-purple-50 text-purple-800 border border-purple-200/60",
    dotClass: "bg-[#7F54B3]",
    tag: "WC",
  },
  "Personal Website": {
    id: "Personal Website",
    label: "Direct Store / Website",
    sublabel: "2% gateway fee",
    estCommission: 2,
    icon: ShopifyLogo,
    colorClass: "bg-emerald-500/10 text-[#008060] border-emerald-500/25",
    pillClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/60",
    dotClass: "bg-[#008060]",
    tag: "D2C",
  },
  "B2B Wholesale": {
    id: "B2B Wholesale",
    label: "B2B Wholesale",
    sublabel: "0% commission",
    estCommission: 0,
    icon: B2BWholesaleLogo,
    colorClass: "bg-slate-500/10 text-slate-700 border-slate-500/25",
    pillClass: "bg-slate-50 text-slate-800 border border-slate-200/60",
    dotClass: "bg-slate-600",
    tag: "B2B",
  },
  Other: {
    id: "Other",
    label: "Other Channel / Offline",
    sublabel: "Custom / 0% fee",
    estCommission: 0,
    icon: Layers,
    colorClass: "bg-slate-400/10 text-slate-600 border-slate-400/25",
    pillClass: "bg-slate-50 text-slate-700 border border-slate-200/60",
    dotClass: "bg-slate-500",
    tag: "OTH",
  },
};

export const ALL_MARKETPLACES: Marketplace[] = [
  "Amazon India",
  "Flipkart",
  "Myntra",
  "Meesho",
  "WooCommerce",
  "Personal Website",
  "B2B Wholesale",
];

export const MARKETPLACE_LIST: MarketplaceConfigItem[] = ALL_MARKETPLACES.map(
  (id) => MARKETPLACE_CONFIGS[id]
);

export function normalizeMarketplace(raw: string): Marketplace {
  const clean = raw.trim().toLowerCase();
  if (clean.includes("amazon") || clean === "amz") return "Amazon India";
  if (clean.includes("flipkart") || clean === "fk") return "Flipkart";
  if (clean.includes("myntra") || clean === "myn") return "Myntra";
  if (clean.includes("meesho") || clean === "msh") return "Meesho";
  if (clean.includes("woocommerce") || clean === "wc") return "WooCommerce";
  if (
    clean.includes("website") ||
    clean.includes("direct") ||
    clean.includes("personal") ||
    clean === "d2c" ||
    clean.includes("shopify")
  )
    return "Personal Website";
  if (clean.includes("b2b") || clean.includes("wholesale")) return "B2B Wholesale";
  return "Other";
}

export function getMarketplaceBadge(marketplace: Marketplace): MarketplaceConfigItem {
  return MARKETPLACE_CONFIGS[marketplace] || MARKETPLACE_CONFIGS["Other"];
}
