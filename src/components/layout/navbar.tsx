"use client";

import React from "react";
import { Plus } from "lucide-react";
import { Marketplace } from "@/domain/types";

interface NavbarProps {
  selectedMarketplace: Marketplace | "ALL";
  onSelectMarketplace: (mp: Marketplace | "ALL") => void;
  onOpenQuickCreate: () => void;
  activeModule?: string;
}

export function Navbar({
  selectedMarketplace,
  onSelectMarketplace,
  onOpenQuickCreate,
  activeModule = "dashboard",
}: NavbarProps) {
  const marketplaces: { id: Marketplace | "ALL"; label: string }[] = [
    { id: "ALL", label: "All Channels" },
    { id: "Amazon India", label: "Amazon" },
    { id: "Flipkart", label: "Flipkart" },
    { id: "Meesho", label: "Meesho" },
    { id: "Personal Website", label: "Website" },
  ];

  const moduleTitles: Record<string, string> = {
    dashboard: "Financial & Operational Overview",
    orders: "Order Lifecycle & Cost Snapshots",
    returns: "Returns & Reverse Logistics",
    claims: "SAFE-T Claims & Dispute Recoveries",
    products: "Product Catalog & Cost Basis",
    settlements: "Marketplace Settlement Reconciliation",
    suppliers: "Supplier Purchases & Inflow",
    expenses: "Operating Expense Ledger",
    documents: "AI Document Staging Sandbox",
    reports: "Analytics & P&L Statements",
    audit: "Immutable Financial Audit Ledger",
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-black/[0.05] px-6 md:px-8 flex items-center justify-between z-10 sticky top-0 transition-all">
      {/* Left: Clean Breadcrumb & Current View Title */}
      <div className="flex items-center gap-2 select-none">
        <span className="text-xs font-semibold text-slate-400">MarginFlow</span>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-800 tracking-tight">
          {moduleTitles[activeModule] || activeModule}
        </span>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3">
        {/* Pill Segmented Control (Image 2 style) */}
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-slate-200/50 inline-flex items-center gap-0.5 text-xs">
          {marketplaces.map((mp) => {
            const isSelected = selectedMarketplace === mp.id;
            return (
              <button
                key={mp.id}
                onClick={() => onSelectMarketplace(mp.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                {mp.label}
              </button>
            );
          })}
        </div>

        {/* Minimalist Action Button */}
        <button
          onClick={onOpenQuickCreate}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold rounded-full shadow-xs transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>New Transaction</span>
        </button>
      </div>
    </header>
  );
}

