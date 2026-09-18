import React from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Globe,
  Building2,
  Layers,
  LucideIcon,
} from "lucide-react";
import { Marketplace } from "@/domain/types";

export interface MarketplaceConfigItem {
  id: Marketplace;
  label: string;
  sublabel: string;
  estCommission: number;
  icon: LucideIcon;
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
    icon: ShoppingBag,
    colorClass: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    pillClass: "bg-amber-50 text-amber-700 border border-amber-200/60",
    dotClass: "bg-amber-500",
    tag: "AMZ",
  },
  Flipkart: {
    id: "Flipkart",
    label: "Flipkart",
    sublabel: "15% est. fee",
    estCommission: 15,
    icon: ShoppingCart,
    colorClass: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    pillClass: "bg-blue-50 text-blue-700 border border-blue-200/60",
    dotClass: "bg-blue-500",
    tag: "FK",
  },
  Myntra: {
    id: "Myntra",
    label: "Myntra",
    sublabel: "20% est. fee",
    estCommission: 20,
    icon: Store,
    colorClass: "bg-pink-500/10 text-pink-700 border-pink-500/20",
    pillClass: "bg-pink-50 text-pink-700 border border-pink-200/60",
    dotClass: "bg-pink-500",
    tag: "MYN",
  },
  Meesho: {
    id: "Meesho",
    label: "Meesho",
    sublabel: "0% commission",
    estCommission: 0,
    icon: Tag,
    colorClass: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    pillClass: "bg-rose-50 text-rose-700 border border-rose-200/60",
    dotClass: "bg-rose-500",
    tag: "MSH",
  },
  WooCommerce: {
    id: "WooCommerce",
    label: "WooCommerce",
    sublabel: "2% gateway fee",
    estCommission: 2,
    icon: Globe,
    colorClass: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
    pillClass: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
    dotClass: "bg-indigo-500",
    tag: "WC",
  },
  "Personal Website": {
    id: "Personal Website",
    label: "Direct Store / Website",
    sublabel: "2% gateway fee",
    estCommission: 2,
    icon: Globe,
    colorClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    pillClass: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    dotClass: "bg-emerald-500",
    tag: "D2C",
  },
  "B2B Wholesale": {
    id: "B2B Wholesale",
    label: "B2B Wholesale",
    sublabel: "0% commission",
    estCommission: 0,
    icon: Building2,
    colorClass: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    pillClass: "bg-purple-50 text-purple-700 border border-purple-200/60",
    dotClass: "bg-purple-500",
    tag: "B2B",
  },
  Other: {
    id: "Other",
    label: "Other Channel / Offline",
    sublabel: "Custom / 0% fee",
    estCommission: 0,
    icon: Layers,
    colorClass: "bg-slate-500/10 text-slate-700 border-slate-500/20",
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
  "Other",
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
    clean === "d2c"
  )
    return "Personal Website";
  if (clean.includes("b2b") || clean.includes("wholesale")) return "B2B Wholesale";
  return "Other";
}

export function getMarketplaceBadge(marketplace: Marketplace): MarketplaceConfigItem {
  return MARKETPLACE_CONFIGS[marketplace] || MARKETPLACE_CONFIGS["Other"];
}
