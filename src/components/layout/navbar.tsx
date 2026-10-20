"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { PanelLeft, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { Marketplace } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { AssistantEmblem } from "@/components/ai/assistant-emblem";
import { getModuleNavMeta } from "@/lib/navigation-config";

const NotificationBell = dynamic(
  () => import("@/components/layout/notification-bell").then((m) => m.NotificationBell),
  { ssr: false }
);

const ThemeToggle = dynamic(
  () => import("@/components/layout/theme-toggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

interface NavbarProps {
  selectedMarketplace?: Marketplace | "ALL";
  onSelectMarketplace?: (mp: Marketplace | "ALL") => void;
  activeModule?: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function Navbar({
  selectedMarketplace: propMarketplace,
  onSelectMarketplace: propOnSelectMarketplace,
  activeModule: propActiveModule,
  isSidebarOpen,
  onToggleSidebar,
}: NavbarProps) {
  const platform = usePlatform();
  const selectedMarketplace = propMarketplace ?? platform.selectedMarketplace;
  const onSelectMarketplace = propOnSelectMarketplace ?? platform.setSelectedMarketplace;
  const pathname = usePathname();

  const activeModule = React.useMemo(() => {
    if (propActiveModule) return propActiveModule;
    if (!pathname || pathname === "/" || pathname === "/dashboard") return "dashboard";
    const cleanPath = pathname.replace(/\/$/, "").split("?")[0];
    const segment = cleanPath.split("/")[1];
    return segment || "dashboard";
  }, [propActiveModule, pathname]);

  const marketplaces: { id: Marketplace | "ALL"; label: string }[] = [
    { id: "ALL", label: "All Channels" },
    { id: "Amazon India", label: "Amazon" },
    { id: "Flipkart", label: "Flipkart" },
    { id: "Myntra", label: "Myntra" },
    { id: "Personal Website", label: "Shopify" },
  ];

  const navMeta = getModuleNavMeta(activeModule);

  return (
    <header className="workspace-navbar shrink-0 h-16 w-full bg-white/85 backdrop-blur-xl border-b border-black/[0.06] px-4 sm:px-6 md:px-8 flex items-center justify-between z-20 sticky top-0 transition-all select-none">
      {/* Left: Sidebar Toggle & Current View Title */}
      <div className="flex items-center gap-2.5 select-none min-w-0 mr-3">
        {onToggleSidebar ? (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1 rounded-lg hover:bg-black/[0.05] active:scale-95 text-[#6E6E73] hover:text-[#1D1D1F] transition focus-visible:ring-2 focus-visible:ring-[#0071E3]/40 cursor-pointer shrink-0"
            title={isSidebarOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="p-1.5 -ml-1 text-[#6E6E73]">
            <PanelLeft className="w-4 h-4" />
          </div>
        )}
        <span className="text-sm font-medium text-[#1D1D1F] tracking-tight whitespace-nowrap truncate max-w-[120px] sm:max-w-none">
          {navMeta.navbarTitle}
        </span>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 py-1 overflow-visible">
        {/* Mobile Marketplace Dropdown (< 640px) */}
        <div className="sm:hidden relative shrink-0">
          <select
            value={selectedMarketplace}
            onChange={(e) => onSelectMarketplace(e.target.value as any)}
            className="h-[34px] pl-3 pr-7 py-1 rounded-full bg-[#F1F3F5] border border-black/[0.06] text-xs font-semibold text-[#1D1D1F] appearance-none focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30 cursor-pointer"
            aria-label="Filter by marketplace"
          >
            {marketplaces.map((mp) => (
              <option key={mp.id} value={mp.id}>
                {mp.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#6E6E73] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Tablet & Desktop Segmented Control (>= 640px) */}
        <div className="hidden sm:inline-flex bg-[#F1F3F5] p-1 rounded-full border border-black/[0.05] items-center gap-0.5 text-xs min-w-0 max-w-full overflow-x-auto no-scrollbar">
          {marketplaces.map((mp) => {
            const isSelected = selectedMarketplace === mp.id;
            return (
              <button
                key={mp.id}
                onClick={() => onSelectMarketplace(mp.id)}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
                  isSelected
                    ? "bg-white text-[#1D1D1F] shadow-apple-sm font-semibold"
                    : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                }`}
              >
                {mp.label}
              </button>
            );
          })}
        </div>

        {/* Theme Toggle (Day / Dark Mode) */}
        <ThemeToggle />

        {/* Notification Bell */}
        <NotificationBell />

        {/* Flow Assistant Quick Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("marginflow_open_copilot"))}
          className="h-[34px] px-2.5 sm:px-3.5 rounded-full bg-white hover:bg-[#F5F5F7] active:scale-[0.98] border border-black/[0.08] text-xs font-medium text-[#1D1D1F] flex items-center gap-1.5 shadow-apple-sm transition-all cursor-pointer shrink-0"
          title="Open Flow Assistant (Ctrl+J)"
          aria-label="Open Flow Assistant"
          data-tour="assistant"
        >
          <AssistantEmblem className="w-4 h-4 text-[#1D1D1F] shrink-0" />
          <span className="font-semibold tracking-tight hidden sm:inline">Flow</span>
          <kbd className="text-[10px] text-[#86868B] bg-black/[0.04] px-1.5 py-0.5 rounded font-mono hidden md:inline ml-0.5">
            ⌘J
          </kbd>
        </button>
      </div>
    </header>
  );
}

