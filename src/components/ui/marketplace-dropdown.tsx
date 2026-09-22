"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Layers } from "lucide-react";
import { Marketplace } from "@/domain/types";
import {
  MARKETPLACE_CONFIGS,
  MARKETPLACE_LIST,
  getMarketplaceBadge,
  MarketplaceConfigItem,
} from "@/lib/marketplace-config";

// ----------------------------------------------------
// 1. Form Marketplace Dropdown (Used in Modals & Forms)
// ----------------------------------------------------
interface FormMarketplaceDropdownProps {
  selected: Marketplace;
  onChange: (mp: Marketplace, defaultCommission: number) => void;
  className?: string;
}

export function FormMarketplaceDropdown({
  selected,
  onChange,
  className = "",
}: FormMarketplaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeOption = MARKETPLACE_CONFIGS[selected] || MARKETPLACE_CONFIGS["Amazon India"];
  const ActiveIcon = activeOption.icon;

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 rounded-xl text-xs font-semibold border transition-all shadow-2xs cursor-pointer ${
          isOpen
            ? "border-slate-900 ring-2 ring-slate-900/10 bg-white text-slate-900"
            : "border-slate-200/90 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${activeOption.colorClass}`}
          >
            <ActiveIcon className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-slate-900 tracking-tight truncate">{activeOption.label}</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200/60 text-slate-600 font-semibold tabular-nums shrink-0">
              {activeOption.sublabel}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-slate-900" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-300/30 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Marketplace Channel</span>
            <span>Est. Platform Fee</span>
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
                    onChange(option.id, option.estCommission);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 text-slate-950 font-bold"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${option.colorClass}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold text-slate-800 group-hover:text-slate-900">
                      {option.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] tabular-nums font-semibold px-2.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200/70"
                      }`}
                    >
                      {option.sublabel}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
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
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            ? "border-slate-900 ring-2 ring-slate-900/10 text-slate-900"
            : !isAll
            ? "border-slate-900 bg-slate-50 text-slate-950 font-semibold ring-1 ring-slate-900/10"
            : "border-slate-200 hover:border-slate-300 text-slate-800"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold border ${
              activeConfig ? activeConfig.colorClass : "text-slate-700 bg-slate-100 border-slate-200"
            }`}
          >
            <ActiveIcon className="w-3 h-3" />
          </span>
          <span className="font-semibold truncate">{label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-mono px-1.5 py-0.2 rounded-md font-medium ${
              !isAll ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {currentCount}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-slate-900" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl shadow-slate-300/30 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
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
                isAll ? "bg-slate-100 text-slate-950 font-bold" : "hover:bg-slate-50 text-slate-700 font-medium"
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
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-slate-900 text-white font-bold"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
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
