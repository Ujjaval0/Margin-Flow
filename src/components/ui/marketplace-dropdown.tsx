"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, Check, Layers } from "lucide-react";
import { Marketplace } from "@/domain/types";
import {
  MARKETPLACE_CONFIGS,
  MARKETPLACE_LIST,
  getMarketplaceBadge,
  MarketplaceConfigItem,
} from "@/lib/marketplace-config";

const MARKETPLACE_LOGOS: Partial<Record<Marketplace, string>> = {
  "Amazon India": "/integrations/logo-amazon.svg",
  Flipkart: "/integrations/flipkart-icon.svg",
  Myntra: "/integrations/myntra-2.svg",
  Meesho: "/integrations/meesho.svg",
  WooCommerce: "/integrations/woocommerce.png",
  "Personal Website": "/integrations/shopify.svg",
};

function MarketplaceIcon({
  marketplace,
  className,
  fallback,
}: {
  marketplace: Marketplace;
  className: string;
  fallback: React.ReactNode;
}) {
  const logo = MARKETPLACE_LOGOS[marketplace];
  if (!logo) return <>{fallback}</>;

  return (
    <Image
      src={logo}
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={`${className} object-contain`}
    />
  );
}

// ----------------------------------------------------
// 1. Form Marketplace Dropdown (Used in Modals & Forms)
// ----------------------------------------------------
interface FormMarketplaceDropdownProps {
  selected: Marketplace;
  onChange: (mp: Marketplace) => void;
  className?: string;
}

export function FormMarketplaceDropdown({
  selected,
  onChange,
  className = "",
}: FormMarketplaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }
    let frame: number | null = null;
    const updatePosition = () => {
      frame = null;
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const width = Math.min(280, Math.max(180, window.innerWidth - margin * 2));
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const maxHeight = Math.max(100, Math.min(288, Math.max(spaceBelow, spaceAbove)));
      const openAbove = spaceBelow < Math.min(240, maxHeight) && spaceAbove > spaceBelow;
      const top = openAbove ? Math.max(margin, rect.top - maxHeight - 6) : rect.bottom + 6;
      setMenuPosition(previous => previous && previous.left === left && previous.top === top && previous.width === width && previous.maxHeight === maxHeight
        ? previous : { left, top, width, maxHeight });
    };
    const schedulePosition = () => {
      if (frame === null) frame = window.requestAnimationFrame(updatePosition);
    };
    updatePosition();
    window.addEventListener("resize", schedulePosition, { passive: true });
    window.addEventListener("scroll", schedulePosition, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  const activeOption = MARKETPLACE_CONFIGS[selected] || MARKETPLACE_CONFIGS["Amazon India"];
  const ActiveIcon = activeOption.icon;

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-xl border text-xs font-medium transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-apple-sm ${
          isOpen
            ? "border-black/20 ring-2 ring-[#0071E3]/20 bg-white text-[#1D1D1F]"
            : "border-black/[0.08] text-[#1D1D1F] hover:border-black/20"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border text-[10px] ${activeOption.colorClass}`}
          >
          <MarketplaceIcon
            marketplace={selected}
            className="w-3.5 h-3.5"
            fallback={<ActiveIcon className="w-3.5 h-3.5" />}
          />
          </span>
          <span className="font-semibold text-[#1D1D1F] tracking-tight truncate">
            {activeOption.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#86868B] shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#1D1D1F]" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && menuPosition && createPortal(
        <div ref={menuRef} role="listbox" style={{ position: "fixed", left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: menuPosition.maxHeight }} className="bg-white/95 backdrop-blur-xl rounded-2xl border border-black/[0.08] shadow-apple-lg p-1.5 z-[1000] animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-medium text-[#86868B] border-b border-black/[0.04] mb-1 flex items-center justify-between">
            <span>Marketplace</span>
          </div>
          <div className="space-y-0.5">
            {MARKETPLACE_LIST.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                    isSelected
                      ? "bg-black/[0.04] text-[#1D1D1F] font-semibold"
                      : "hover:bg-black/[0.025] text-[#1D1D1F] font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${option.colorClass}`}
                    >
                      <MarketplaceIcon
                        marketplace={option.id}
                        className="w-4 h-4"
                        fallback={<Icon className="w-3.5 h-3.5" />}
                      />
                    </span>
                    <span className="font-semibold text-[#1D1D1F] whitespace-nowrap truncate">
                      {option.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-2">
                    <span className="text-xs text-[#86868B] tabular-nums font-normal">
                      Rule based
                    </span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#1D1D1F] shrink-0 stroke-[2.2]" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. Platform Filter Dropdown (Used in Table Toolbars)
// ----------------------------------------------------
export interface PlatformFilterOption {
  id: Marketplace | "ALL";
  label: string;
  tag: string;
}

interface PlatformFilterDropdownProps {
  selected: Marketplace | "ALL";
  onChange: (val: Marketplace | "ALL") => void;
  counts?: Record<string, number>;
  className?: string;
}

export function PlatformFilterDropdown({
  selected,
  onChange,
  counts = {},
  className = "",
}: PlatformFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isAll = selected === "ALL";
  const activeConfig: MarketplaceConfigItem | null = isAll ? null : MARKETPLACE_CONFIGS[selected];
  const ActiveIcon = activeConfig?.icon || Layers;
  const label = isAll ? "All Platforms" : activeConfig?.label || selected;
  const totalCount = counts["ALL"] ?? Object.values(counts).reduce((a, b) => a + b, 0);
  const currentCount = isAll ? totalCount : counts[selected] ?? 0;

  return (
    <div ref={containerRef} className={`relative min-w-[190px] ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-4 py-2 bg-white rounded-full text-xs font-medium border transition shadow-xs cursor-pointer ${
          isOpen
            ? "border-black/20 ring-2 ring-[#0071E3]/20 text-[#1D1D1F] bg-white shadow-apple-sm"
            : !isAll
            ? "border-black/10 bg-black/[0.02] text-[#1D1D1F] font-semibold ring-1 ring-black/5 shadow-apple-sm"
            : "border-black/[0.08] hover:border-black/20 text-[#1D1D1F] shadow-apple-sm"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold border ${
              activeConfig ? activeConfig.colorClass : "text-slate-700 bg-slate-100 border-slate-200"
            }`}
          >
            {isAll ? (
              <ActiveIcon className="w-3 h-3" />
            ) : (
              <MarketplaceIcon
                marketplace={selected}
                className="w-3.5 h-3.5"
                fallback={<ActiveIcon className="w-3 h-3" />}
              />
            )}
          </span>
          <span className="font-semibold truncate">{label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md font-medium ${
              !isAll ? "bg-[#1D1D1F] text-white" : "bg-black/[0.04] text-[#6E6E73]"
            }`}
          >
            {currentCount}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#86868B] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#1D1D1F]" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-white/95 backdrop-blur-xl rounded-2xl border border-black/[0.08] shadow-apple-lg p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#86868B] border-b border-black/[0.04] mb-1 flex items-center justify-between">
            <span>Filter By Platform</span>
            <span>Count</span>
          </div>

          <div className="space-y-0.5">
            {/* All Platforms Option */}
            <button
              type="button"
              onClick={() => {
                onChange("ALL");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                isAll ? "bg-black/[0.04] text-[#1D1D1F] font-semibold" : "hover:bg-black/[0.025] text-[#6E6E73] font-medium"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] text-slate-700 bg-slate-100 border-slate-200">
                  <Layers className="w-3.5 h-3.5" />
                </span>
                <span>All Platforms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {totalCount}
                </span>
                {isAll && <Check className="w-3.5 h-3.5 text-slate-900" />}
              </div>
            </button>

            {/* Individual Marketplaces */}
            {MARKETPLACE_LIST.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.id;
              const count = counts[option.id] ?? 0;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 text-slate-950 font-bold"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${option.colorClass}`}
                    >
                      <MarketplaceIcon
                        marketplace={option.id}
                        className="w-4 h-4"
                        fallback={<Icon className="w-3.5 h-3.5" />}
                      />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-[#1D1D1F] text-white font-semibold"
                          : "bg-black/[0.04] text-[#6E6E73] group-hover:bg-black/[0.06]"
                      }`}
                    >
                      {count}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#1D1D1F]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 3. Marketplace Badge (Used in Tables and Cards)
// ----------------------------------------------------
export function MarketplaceBadge({ marketplace }: { marketplace: Marketplace }) {
  const badge = getMarketplaceBadge(marketplace);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${badge.pillClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
      <span>{badge.label}</span>
    </span>
  );
}
