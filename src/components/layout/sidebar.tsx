"use client";

import React from "react";
import {
  Store,
  ShoppingCart,
  RotateCcw,
  ShieldAlert,
  Package,
  Landmark,
  Building2,
  Truck,
  Receipt,
  BarChart3,
  Scale,
  Webhook,
  PlugZap,
  Trash2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePlatform } from "@/domain/store";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import { UserProfileModal } from "@/components/modals/user-profile-modal";

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
  | "reports"
  | "ledger"
  | "webhooks"
  | "trash";

interface SidebarNavItem {
  id: NavModule;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconColor: string;
  bgTint: string;
  badge?: number;
}

interface SidebarProps {
  activeModule?: NavModule;
  onSelectModule?: (module: NavModule) => void;
  isOpen: boolean;
  onToggle?: () => void;
}

export function Sidebar({
  activeModule: propActiveModule,
  onSelectModule,
  isOpen,
  onToggle,
}: SidebarProps) {
  const { currentUser } = usePlatform();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const userName = currentUser?.name || "Ujjaval";
  const userSubtitle = currentUser?.companyName || currentUser?.email || "Brand Owner";
  const userInitials = React.useMemo(() => {
    return (
      userName
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  }, [userName]);

  // Determine active module cleanly from prop or pathname without double-render state
  const activeModule = React.useMemo(() => {
    if (propActiveModule) return propActiveModule;
    if (!pathname || pathname === "/" || pathname === "/dashboard") return "dashboard";
    const cleanPath = pathname.replace(/\/$/, "").split("?")[0];
    const segment = cleanPath.split("/")[1] as NavModule;
    return segment || "dashboard";
  }, [propActiveModule, pathname]);

  const handleNavClick = (id: NavModule) => {
    onSelectModule?.(id);
    if (typeof window !== "undefined" && window.innerWidth < 768 && isOpen) {
      onToggle?.();
    }
  };

  const navItems = React.useMemo<SidebarNavItem[]>(() => [
    {
      id: "dashboard" as NavModule,
      href: "/dashboard",
      label: "Home",
      icon: Store,
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
    {
      id: "trash" as NavModule,
      href: "/trash",
      label: "Recycle Bin",
      icon: Trash2,
      iconColor: "text-[#86868B]",
      bgTint: "bg-black/[0.04]",
    },
  ].filter((item) => {
    if (currentUser?.accountType === "SUPPLIER") {
      const allowed: NavModule[] = [
        "dashboard",
        "products",
        "suppliers",
        "purchases",
        "reports",
      ];
      return allowed.includes(item.id);
    }
    return true;
  }), [currentUser?.accountType]);

  return (
    <aside
      className={`bg-[#FBFBFD] flex flex-col h-full border-r border-black/[0.06] select-none text-[#1D1D1F] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] overflow-hidden shrink-0 relative z-30 ${
        isOpen ? "w-64" : "w-[72px]"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center border-b border-black/[0.04] shrink-0 overflow-hidden">
        {isOpen ? (
          <Link
            href="/dashboard"
            onClick={() => handleNavClick("dashboard")}
            className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity"
            title="MarginFlow Home"
          >
            <MarginFlowLogo className="h-9 w-auto text-[#1D1D1F] shrink-0" />
          </Link>
        ) : (
          <div className="w-full flex items-center justify-center">
            <Link
              href="/dashboard"
              onClick={() => handleNavClick("dashboard")}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/[0.04] transition-colors"
              title="MarginFlow Home"
            >
              <MarginFlowLogo variant="mark" className="w-5 h-5 text-[#1D1D1F] shrink-0" />
            </Link>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 no-scrollbar">
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
                isOpen ? "justify-between px-3" : "justify-center px-0"
              } py-2 rounded-xl text-xs font-medium border transition-colors duration-150 active:scale-[0.985] ${
                isActive
                  ? "bg-white text-[#1D1D1F] border-black/[0.06] shadow-apple-sm font-semibold"
                  : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.035] border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 shrink-0 relative ${
                    isActive
                      ? `${item.bgTint} ${item.iconColor}`
                      : "bg-transparent text-[#86868B] group-hover:text-[#1D1D1F]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? item.iconColor : "text-[#86868B] group-hover:text-[#1D1D1F]"}`} strokeWidth={1.8} />
                  {!isOpen && item.badge !== undefined && (
                    <span className="w-2 h-2 rounded-full bg-[#0071E3] absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                  )}
                </div>
                {isOpen && (
                  <span className="tracking-tight truncate whitespace-nowrap animate-in fade-in duration-150">
                    {item.label}
                  </span>
                )}
              </div>
              {isOpen && item.badge !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] text-[#1D1D1F] font-semibold border border-black/[0.06] shrink-0 animate-in fade-in duration-150">
                  {item.badge}
                </span>
              )}

              {/* Floating Tooltip for Collapsed Sidebar */}
              {!isOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1D1D1F] text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 transition-all whitespace-nowrap shadow-apple-md z-50">
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#0071E3] text-white text-[9px]">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-2 border-t border-black/[0.04] shrink-0 overflow-hidden">
        {isOpen ? (
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-[#1D1D1F] hover:bg-black/[0.04] active:scale-[0.985] transition-colors duration-150 group cursor-pointer text-left"
            title="View User Profile & Onboarding Info"
            aria-label="View User Profile & Onboarding Info"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 shadow-apple-xs ring-1 ring-black/[0.08]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071E3] to-[#0051A8] text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-apple-xs select-none">
                  {userInitials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[#1D1D1F] truncate text-xs tracking-tight group-hover:text-[#0071E3] transition-colors">
                  {userName}
                </span>
                <span className="text-[11px] text-[#86868B] truncate tracking-tight font-normal">
                  {userSubtitle}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#86868B] group-hover:text-[#1D1D1F] group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5" />
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/[0.04] active:scale-[0.95] transition-colors duration-150 group relative cursor-pointer"
              title="View User Profile & Onboarding Info"
              aria-label="View User Profile & Onboarding Info"
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 shadow-apple-xs ring-1 ring-black/[0.08]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071E3] to-[#0051A8] text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-apple-xs select-none">
                  {userInitials}
                </div>
              )}
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1D1D1F] text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all whitespace-nowrap shadow-apple-md z-50">
                {userName} <span className="text-white/60">• Profile</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* User Profile & Onboarding Info Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </aside>
  );
}
