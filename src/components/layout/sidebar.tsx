"use client";

import React from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  RotateCcw,
  ShieldAlert,
  Package,
  Landmark,
  Building2,
  Truck,
  Receipt,
  FileCheck2,
  BarChart3,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { usePlatform } from "@/domain/store";

export type NavModule =
  | "dashboard"
  | "orders"
  | "returns"
  | "claims"
  | "products"
  | "settlements"
  | "suppliers"
  | "purchases"
  | "expenses"
  | "documents"
  | "reports"
  | "audit";

interface SidebarProps {
  activeModule: NavModule;
  onSelectModule: (module: NavModule) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  activeModule,
  onSelectModule,
  isOpen,
  onToggle,
}: SidebarProps) {
  const { aiDocuments } = usePlatform();

  const pendingDocsCount = aiDocuments.filter((d) => d.status === "STAGED_NEEDS_REVIEW").length;

  const navItems = [
    {
      id: "dashboard" as NavModule,
      label: "Dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-600",
      bgTint: "bg-blue-500/10",
    },
    {
      id: "orders" as NavModule,
      label: "Orders",
      icon: ShoppingCart,
      iconColor: "text-indigo-600",
      bgTint: "bg-indigo-500/10",
    },
    {
      id: "returns" as NavModule,
      label: "Returns & RTO",
      icon: RotateCcw,
      iconColor: "text-amber-600",
      bgTint: "bg-amber-500/10",
    },
    {
      id: "claims" as NavModule,
      label: "Claims & Disputes",
      icon: ShieldAlert,
      iconColor: "text-rose-600",
      bgTint: "bg-rose-500/10",
    },
    {
      id: "products" as NavModule,
      label: "Products & SKUs",
      icon: Package,
      iconColor: "text-teal-600",
      bgTint: "bg-teal-500/10",
    },
    {
      id: "settlements" as NavModule,
      label: "Settlements",
      icon: Landmark,
      iconColor: "text-emerald-600",
      bgTint: "bg-emerald-500/10",
    },
    {
      id: "suppliers" as NavModule,
      label: "Suppliers",
      icon: Building2,
      iconColor: "text-cyan-600",
      bgTint: "bg-cyan-500/10",
    },
    {
      id: "purchases" as NavModule,
      label: "Purchases & Bills",
      icon: Truck,
      iconColor: "text-amber-600",
      bgTint: "bg-amber-500/10",
    },
    {
      id: "expenses" as NavModule,
      label: "Operating Expenses",
      icon: Receipt,
      iconColor: "text-violet-600",
      bgTint: "bg-violet-500/10",
    },
    {
      id: "documents" as NavModule,
      label: "AI Staging Sandbox",
      icon: FileCheck2,
      iconColor: "text-purple-600",
      bgTint: "bg-purple-500/10",
      badge: pendingDocsCount > 0 ? pendingDocsCount : undefined,
    },
    {
      id: "reports" as NavModule,
      label: "Analytics & P&L",
      icon: BarChart3,
      iconColor: "text-orange-600",
      bgTint: "bg-orange-500/10",
    },
  ];

  return (
    <aside
      className={`bg-[#FBFBFD] flex flex-col h-screen border-r border-black/[0.06] select-none text-[#1D1D1F] transition-all duration-300 ease-in-out shrink-0 ${
        isOpen ? "w-64" : "w-[72px]"
      }`}
    >
      {/* Brand Header */}
      {isOpen ? (
        <div className="p-4 pb-3 flex items-center justify-between border-b border-black/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-[0_2px_8px_rgba(37,99,235,0.25)] shrink-0">
              MF
            </div>
            <div className="min-w-0">
              <span className="font-semibold tracking-tight text-sm text-[#1D1D1F] block leading-none truncate">
                MarginFlow
              </span>
              <span className="text-[11px] text-[#86868B] tracking-tight mt-0.5 block font-normal truncate">
                Financial Intelligence
              </span>
            </div>
          </div>

          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-lg hover:bg-black/[0.05] text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors shrink-0"
            title="Minimize sidebar (Ctrl+B)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 pb-3 flex items-center justify-center border-b border-black/[0.03]">
          <button
            onClick={onToggle}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-[0_2px_8px_rgba(37,99,235,0.25)] hover:scale-105 transition-transform"
            title="MarginFlow — Click to expand sidebar (Ctrl+B)"
          >
            MF
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {isOpen && (
          <div className="px-2 pb-2 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
            Workspace
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              title={item.label}
              className={`w-full flex items-center ${
                isOpen ? "justify-between px-2.5 py-1.5" : "justify-center py-2 px-0"
              } rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-black/[0.07] text-[#1D1D1F] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  : "text-[#555559] hover:text-[#1D1D1F] hover:bg-black/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all relative ${
                    isActive
                      ? `${item.bgTint} ${item.iconColor}`
                      : "bg-black/[0.03] text-[#6E6E73] group-hover:bg-black/[0.05]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? item.iconColor : "text-[#6E6E73]"}`} strokeWidth={2} />
                  {!isOpen && item.badge !== undefined && (
                    <span className="w-2 h-2 rounded-full bg-purple-600 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                  )}
                </div>
                {isOpen && <span className="tracking-tight truncate">{item.label}</span>}
              </div>
              {isOpen && item.badge !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Footer Toggle */}
      <div className="p-2 border-t border-black/[0.04]">
        <button
          onClick={onToggle}
          className={`w-full flex items-center ${
            isOpen ? "gap-2 px-2.5 py-1.5" : "justify-center py-2"
          } rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-black/[0.04] transition-all`}
          title={isOpen ? "Minimize sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)"}
        >
          {isOpen ? (
            <>
              <PanelLeftClose className="w-3.5 h-3.5" />
              <span className="tracking-tight">Minimize</span>
              <span className="ml-auto text-[10px] text-slate-400 font-mono">Ctrl+B</span>
            </>
          ) : (
            <PanelLeftOpen className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>
    </aside>
  );
}
