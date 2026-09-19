"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Marketplace } from "@/domain/types";
import { usePlatform } from "@/domain/store";

interface NavbarProps {
  selectedMarketplace?: Marketplace | "ALL";
  onSelectMarketplace?: (mp: Marketplace | "ALL") => void;
  activeModule?: string;
}

export function Navbar({
  selectedMarketplace: propMarketplace,
  onSelectMarketplace: propOnSelectMarketplace,
  activeModule: propActiveModule,
}: NavbarProps) {
  const platform = usePlatform();
  const selectedMarketplace = propMarketplace ?? platform.selectedMarketplace;
  const onSelectMarketplace = propOnSelectMarketplace ?? platform.setSelectedMarketplace;
  const pathname = usePathname();

  const activeModule = React.useMemo(() => {
    if (propActiveModule) return propActiveModule;
    if (!pathname || pathname === "/" || pathname === "/dashboard") return "dashboard";
    const segment = pathname.split("/")[1];
    return segment || "dashboard";
  }, [propActiveModule, pathname]);

  const marketplaces: { id: Marketplace | "ALL"; label: string }[] = [
    { id: "ALL", label: "All Channels" },
    { id: "Amazon India", label: "Amazon" },
    { id: "Flipkart", label: "Flipkart" },
    { id: "Myntra", label: "Myntra" },
    { id: "Meesho", label: "Meesho" },
  ];

  const moduleTitles: Record<string, string> = {
    dashboard: "Financial & Operational Overview",
    orders: "Order Lifecycle & Cost Snapshots",
    returns: "Returns & Reverse Logistics",
    claims: "SAFE-T Claims & Dispute Recoveries",
    products: "Product Catalog & Cost Basis",
    settlements: "Marketplace Settlement Reconciliation",
    suppliers: "Wholesale Suppliers & Vendors",
    purchases: "Wholesale Purchases & Inflow",
    expenses: "Operating Expense Ledger",
    documents: "AI Document Staging Sandbox",
    reports: "Analytics & P&L Statements",
    audit: "Immutable Financial Audit Ledger",
    ledger: "Double-Entry General Ledger & Trial Balance",
    webhooks: "Store Integrations",
  };

  return (
    <header className="shrink-0 h-16 w-full bg-white/80 backdrop-blur-md border-b border-black/[0.05] px-4 sm:px-6 md:px-8 flex items-center justify-between z-20 sticky top-0 transition-all">
      {/* Left: Clean Breadcrumb & Current View Title */}
      <div className="flex items-center gap-2 select-none shrink-0 mr-3">
        <Image
          src="/margin-flow-icon.png"
          alt="Margin Flow"
          width={18}
          height={18}
          className="w-4 h-4 object-contain opacity-80 shrink-0"
        />
        <span className="text-xs font-semibold text-slate-500">MarginFlow</span>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-800 tracking-tight whitespace-nowrap">
          {moduleTitles[activeModule] || activeModule}
        </span>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3 min-w-0 overflow-x-auto no-scrollbar py-1">
        {/* Pill Segmented Control (Image 2 style) */}
        <div className="bg-[#F1F3F5] p-1 rounded-full border border-slate-200/50 inline-flex items-center gap-0.5 text-xs shrink-0">
          {marketplaces.map((mp) => {
            const isSelected = selectedMarketplace === mp.id;
            return (
              <button
                key={mp.id}
                onClick={() => onSelectMarketplace(mp.id)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
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
      </div>
    </header>
  );
}

