"use client";

import React from "react";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { Marketplace } from "@/domain/types";
import { usePlatform } from "@/domain/store";

interface NavbarProps {
  selectedMarketplace: Marketplace | "ALL";
  onSelectMarketplace: (mp: Marketplace | "ALL") => void;
  onOpenQuickCreate: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export function Navbar({
  selectedMarketplace,
  onSelectMarketplace,
  onOpenQuickCreate,
  searchTerm,
  onSearchChange,
}: NavbarProps) {

  const marketplaces: { id: Marketplace | "ALL"; label: string }[] = [
    { id: "ALL", label: "All Channels" },
    { id: "Amazon India", label: "Amazon" },
    { id: "Flipkart", label: "Flipkart" },
    { id: "Meesho", label: "Meesho" },
    { id: "Personal Website", label: "Website" },
  ];

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-black/[0.05] px-8 flex items-center justify-between z-10 sticky top-0">
      {/* Search Input (Apple Pill Style) */}
      <div className="w-80 relative">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" strokeWidth={2} />
        <input
          type="text"
          placeholder="Search orders, SKUs, returns, claims..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-black/[0.04] hover:bg-black/[0.06] focus:bg-white text-[#1D1D1F] placeholder-[#86868B] border border-transparent focus:border-black/[0.12] rounded-full focus:outline-none transition-all shadow-none focus:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        />
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3">
        {/* Apple Segmented Control */}
        <div className="flex items-center p-1 bg-black/[0.04] rounded-full text-xs">
          {marketplaces.map((mp) => {
            const isSelected = selectedMarketplace === mp.id;
            return (
              <button
                key={mp.id}
                onClick={() => onSelectMarketplace(mp.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
              >
                {mp.label}
              </button>
            );
          })}
        </div>



        {/* Minimalist Apple Action Button */}
        <button
          onClick={onOpenQuickCreate}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          <span>New Transaction</span>
        </button>
      </div>
    </header>
  );
}
