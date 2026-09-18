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
  Scale,
  Webhook,
  PlugZap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  | "audit"
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
  const [optimisticModule, setOptimisticModule] = React.useState<NavModule | null>(null);

  // Synchronize optimistic selection whenever route pathname settles
  React.useEffect(() => {
    setOptimisticModule(null);
  }, [pathname]);

  // Determine active module immediately from optimistic selection, prop, or pathname
  const activeModule = React.useMemo(() => {
    if (optimisticModule) return optimisticModule;
    if (propActiveModule) return propActiveModule;
    if (!pathname || pathname === "/" || pathname === "/dashboard") return "dashboard";
    const segment = pathname.split("/")[1] as NavModule;
    return segment || "dashboard";
  }, [optimisticModule, propActiveModule, pathname]);

  const pendingDocsCount = React.useMemo(() => {
    return aiDocuments.filter((d) => d.status === "STAGED_NEEDS_REVIEW").length;
  }, [aiDocuments]);

  const navItems = React.useMemo(() => [
    {
      id: "dashboard" as NavModule,
      href: "/",
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
      id: "audit" as NavModule,
      href: "/audit",
      label: "Audit Trail",
      icon: ShieldCheck,
      iconColor: "text-emerald-600",
      bgTint: "bg-emerald-500/10",
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
      className={`bg-[#FBFBFD] flex flex-col h-screen border-r border-black/[0.06] select-none text-[#1D1D1F] transition-all duration-300 ease-in-out shrink-0 ${
        isOpen ? "w-64" : "w-[72px]"
      }`}
    >
      {/* Brand Header */}
      {isOpen ? (
        <div className="p-4 pb-3 flex items-center justify-between border-b border-black/[0.03]">
          <Link
            href="/"
            onClick={() => setOptimisticModule("dashboard")}
            className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity"
            title="MarginFlow Dashboard"
          >
            <Image
              src="/margin-flow-logo.png"
              alt="Margin Flow"
              width={160}
              height={44}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>

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
            className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center p-1.5 hover:scale-105 hover:border-slate-300 transition-all shrink-0"
            title="MarginFlow — Click to expand sidebar (Ctrl+B)"
          >
            <Image
              src="/margin-flow-icon.png"
              alt="Margin Flow"
              width={26}
              height={26}
              priority
              className="w-full h-full object-contain"
            />
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
            <Link
              key={item.id}
              href={item.href}
              prefetch={true}
              onClick={() => {
                setOptimisticModule(item.id);
                onSelectModule?.(item.id);
              }}
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
            </Link>
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
