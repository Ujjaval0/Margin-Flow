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
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Webhook,
  PlugZap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/domain/store";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";

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
  | "ledger"
  | "webhooks";

interface SidebarProps {
  activeModule?: NavModule;
  onSelectModule?: (module: NavModule) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  activeModule: propActiveModule,
  onSelectModule,
  isOpen,
  onToggle,
}: SidebarProps) {
  const { aiDocuments } = usePlatform();
  const pathname = usePathname();

  // Determine active module cleanly from prop or pathname without double-render state
  const activeModule = React.useMemo(() => {
    if (propActiveModule) return propActiveModule;
    if (!pathname || pathname === "/" || pathname === "/dashboard") return "dashboard";
    const cleanPath = pathname.replace(/\/$/, "").split("?")[0];
    const segment = cleanPath.split("/")[1] as NavModule;
    return segment || "dashboard";
  }, [propActiveModule, pathname]);

  const pendingDocsCount = React.useMemo(() => {
    return aiDocuments.filter((d) => d.status === "STAGED_NEEDS_REVIEW").length;
  }, [aiDocuments]);

  const handleNavClick = (id: NavModule) => {
    onSelectModule?.(id);
    if (typeof window !== "undefined" && window.innerWidth < 768 && isOpen) {
      onToggle();
    }
  };

  const navItems = React.useMemo(() => [
    {
      id: "dashboard" as NavModule,
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-600",
      bgTint: "bg-blue-500/10",
    },
    {
      id: "orders" as NavModule,
      href: "/orders",
      label: "Orders",
      icon: ShoppingCart,
      iconColor: "text-indigo-600",
      bgTint: "bg-indigo-500/10",
    },
    {
      id: "returns" as NavModule,
      href: "/returns",
      label: "Returns & RTO",
      icon: RotateCcw,
      iconColor: "text-amber-600",
      bgTint: "bg-amber-500/10",
    },
    {
      id: "claims" as NavModule,
      href: "/claims",
      label: "Claims & Disputes",
      icon: ShieldAlert,
      iconColor: "text-rose-600",
      bgTint: "bg-rose-500/10",
    },
    {
      id: "products" as NavModule,
      href: "/products",
      label: "Products & SKUs",
      icon: Package,
      iconColor: "text-teal-600",
      bgTint: "bg-teal-500/10",
    },
    {
      id: "settlements" as NavModule,
      href: "/settlements",
      label: "Settlements",
      icon: Landmark,
      iconColor: "text-emerald-600",
      bgTint: "bg-emerald-500/10",
    },
    {
      id: "suppliers" as NavModule,
      href: "/suppliers",
      label: "Suppliers",
      icon: Building2,
      iconColor: "text-cyan-600",
      bgTint: "bg-cyan-500/10",
    },
    {
      id: "purchases" as NavModule,
      href: "/purchases",
      label: "Purchases & Bills",
      icon: Truck,
      iconColor: "text-amber-600",
      bgTint: "bg-amber-500/10",
    },
    {
      id: "expenses" as NavModule,
      href: "/expenses",
      label: "Operating Expenses",
      icon: Receipt,
      iconColor: "text-violet-600",
      bgTint: "bg-violet-500/10",
    },
    {
      id: "documents" as NavModule,
      href: "/documents",
      label: "AI Staging Sandbox",
      icon: FileCheck2,
      iconColor: "text-purple-600",
      bgTint: "bg-purple-500/10",
      badge: pendingDocsCount > 0 ? pendingDocsCount : undefined,
    },
    {
      id: "reports" as NavModule,
      href: "/reports",
      label: "Analytics & P&L",
      icon: BarChart3,
      iconColor: "text-orange-600",
      bgTint: "bg-orange-500/10",
    },
    {
      id: "ledger" as NavModule,
      href: "/ledger",
      label: "General Ledger",
      icon: Scale,
      iconColor: "text-indigo-600",
      bgTint: "bg-indigo-500/10",
    },
    {
      id: "webhooks" as NavModule,
      href: "/webhooks",
      label: "Store Integrations",
      icon: PlugZap,
      iconColor: "text-blue-600",
      bgTint: "bg-blue-500/10",
    },
  ], [pendingDocsCount]);

  return (
    <aside
      className={`bg-[#FBFBFD] flex flex-col h-full border-r border-black/[0.06] select-none text-[#1D1D1F] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 relative z-30 ${
        isOpen ? "w-64" : "w-[72px]"
      }`}
    >
      {/* Brand Header */}
      {isOpen ? (
        <div className="h-16 px-4 flex items-center justify-between border-b border-black/[0.04] shrink-0">
          <Link
            href="/dashboard"
            onClick={() => handleNavClick("dashboard")}
            className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity"
            title="MarginFlow Dashboard"
          >
            <MarginFlowLogo className="h-7 w-auto text-[#1D1D1F]" />
          </Link>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center border-b border-black/[0.04] shrink-0">
          <Link
            href="/dashboard"
            onClick={() => handleNavClick("dashboard")}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/[0.04] transition-colors"
            title="MarginFlow Dashboard"
          >
            <MarginFlowLogo variant="mark" className="w-5 h-5 text-[#1D1D1F]" />
          </Link>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 no-scrollbar">
        {isOpen && (
          <div className="px-3 pt-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </div>
        )}

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={true}
              onClick={() => handleNavClick(item.id)}
              className={`group relative w-full flex items-center ${
                isOpen ? "justify-between px-3 py-2" : "justify-center py-2 px-0"
              } rounded-xl text-xs font-medium border transition-colors duration-100 ${
                isActive
                  ? "bg-white text-slate-900 border-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-black/[0.03] border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100 relative ${
                    isActive
                      ? `${item.bgTint} ${item.iconColor}`
                      : "bg-transparent text-slate-500 group-hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? item.iconColor : "text-slate-500 group-hover:text-slate-900"}`} strokeWidth={1.75} />
                  {!isOpen && item.badge !== undefined && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                  )}
                </div>
                {isOpen && <span className="tracking-tight truncate">{item.label}</span>}
              </div>
              {isOpen && item.badge !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/80">
                  {item.badge}
                </span>
              )}

              {/* Floating Tooltip for Collapsed Sidebar */}
              {!isOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 transition-all whitespace-nowrap shadow-xl z-50">
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px]">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Modern, Clean Bottom Footer */}
      {isOpen ? (
        <div className="p-2.5 border-t border-black/[0.04] shrink-0">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-black/[0.04] transition-colors group cursor-pointer"
            title="Collapse sidebar (⌘B)"
            aria-label="Collapse sidebar"
          >
            <div className="flex items-center gap-2.5">
              <PanelLeftClose className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-colors" />
              <span className="tracking-tight text-slate-600 group-hover:text-slate-900 font-medium">
                Collapse
              </span>
            </div>
            <kbd className="text-[10px] font-mono text-slate-400 bg-black/[0.03] border border-black/[0.04] px-1.5 py-0.5 rounded-md">
              ⌘B
            </kbd>
          </button>
        </div>
      ) : (
        <div className="p-2.5 border-t border-black/[0.04] flex justify-center shrink-0">
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-black/[0.04] transition-colors group relative cursor-pointer"
            title="Expand sidebar (⌘B)"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4 text-slate-500 group-hover:text-slate-900 transition-colors" />
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap shadow-xl z-50">
              Expand <kbd className="ml-1 text-[9px] font-mono text-slate-400">⌘B</kbd>
            </div>
          </button>
        </div>
      )}
    </aside>
  );
}
