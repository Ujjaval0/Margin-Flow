"use client";

import React from "react";
import { createPortal } from "react-dom";
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
  X,
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
  const [tooltipPortalReady, setTooltipPortalReady] = React.useState(false);
  const [activeTooltip, setActiveTooltip] = React.useState<{
    item: SidebarNavItem;
    top: number;
    left: number;
  } | null>(null);

  React.useEffect(() => {
    setTooltipPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) setActiveTooltip(null);
  }, [isOpen]);

  const showNavTooltip = (
    event: React.MouseEvent<HTMLAnchorElement> | React.FocusEvent<HTMLAnchorElement>,
    item: SidebarNavItem
  ) => {
    if (isOpen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveTooltip({ item, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };

  const userName = currentUser?.name || "E-Commerce";
  const userSubtitle = currentUser?.companyName || currentUser?.email || "Brand Owner";
  const userInitials = React.useMemo(() => {
    return (
      userName
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "EC"
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
    setActiveTooltip(null);
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

  const ActiveTooltipIcon = activeTooltip?.item.icon ?? Store;

  return (
    <>
      {/* Mobile Backdrop when drawer is open */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <aside
        className={`bg-[#FBFBFD] flex flex-col h-full border-r border-black/[0.06] select-none text-[#1D1D1F] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,transform] overflow-hidden shrink-0 ${
          isOpen
            ? "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-64 max-md:shadow-apple-xl w-64 md:relative"
            : "max-md:w-0 max-md:border-r-0 max-md:overflow-hidden w-[72px] relative z-30"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-black/[0.04] shrink-0 overflow-hidden">
          {isOpen ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => handleNavClick("dashboard")}
                className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity"
                title="MarginFlow Home"
              >
                <MarginFlowLogo className="h-[22px] w-auto text-[#1D1D1F] shrink-0" />
              </Link>
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="md:hidden p-1.5 rounded-lg hover:bg-black/[0.05] text-[#6E6E73] hover:text-[#1D1D1F] transition cursor-pointer"
                  aria-label="Close sidebar"
                  title="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </>
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
              onMouseEnter={(event) => showNavTooltip(event, item)}
              onMouseLeave={() => setActiveTooltip(null)}
              onFocus={(event) => showNavTooltip(event, item)}
              onBlur={() => setActiveTooltip(null)}
              aria-label={!isOpen ? item.label : undefined}
              aria-describedby={!isOpen && activeTooltip?.item.id === item.id ? `sidebar-tooltip-${item.id}` : undefined}
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

      {tooltipPortalReady && !isOpen && activeTooltip && createPortal(
        <div
          id={`sidebar-tooltip-${activeTooltip.item.id}`}
          role="tooltip"
          className="fixed z-[100] flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white/95 px-2.5 py-2 text-xs font-semibold tracking-tight text-[#1D1D1F] shadow-[0_8px_24px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08)] backdrop-blur-sm animate-in fade-in slide-in-from-left-1 duration-150 motion-reduce:animate-none pointer-events-none whitespace-nowrap"
          style={{ top: activeTooltip.top, left: activeTooltip.left, transform: "translateY(-50%)" }}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${activeTooltip.item.bgTint} ${activeTooltip.item.iconColor}`}>
            <ActiveTooltipIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
          </span>
          <span>{activeTooltip.item.label}</span>
          {activeTooltip.item.badge !== undefined && (
            <span className="ml-0.5 rounded-md bg-[#0071E3]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#005BBB]">
              {activeTooltip.item.badge}
            </span>
          )}
          <span className="absolute right-full top-1/2 -mr-px -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-white/95" />
        </div>,
        document.body
      )}

      {/* User Profile & Onboarding Info Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </aside>
  </>
  );
}
