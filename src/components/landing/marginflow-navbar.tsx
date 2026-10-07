"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import { ArrowUpRight, Menu, X, ChevronDown } from "lucide-react";

export interface MarginFlowNavbarProps {
  onSignIn: () => void;
  isAuthenticating: boolean;
}

export function MarginFlowNavbar({ onSignIn, isAuthenticating }: MarginFlowNavbarProps) {
  const [isFloating, setIsFloating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setIsFloating((prev) => {
            // Smooth response threshold: morph into floating island as user begins scrolling (> 20px)
            // Settle back to flat hero layout only when returning to the very top (< 10px)
            if (!prev && currentY > 20) return true;
            if (prev && currentY < 10) return false;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">

      {/* 2. MAIN NAV CONTAINER (Fluid morph into floating island pill on scroll) */}
      <div
        className={`transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          isFloating ? "pt-3.5 px-4 sm:px-6 lg:px-8" : "pt-0 px-0"
        }`}
      >
        <div
          className={`relative mx-auto pointer-events-auto flex items-center justify-between transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
            isFloating
              ? "max-w-7xl h-16 px-6 sm:px-8"
              : "max-w-7xl h-22 sm:h-24 px-4 sm:px-6 lg:px-8"
          }`}
          style={{
            borderRadius: isFloating ? "32px" : "0px",
          }}
        >
          {/* Glassmorphic White Island Background Layer (Hardware accelerated opacity transition) */}
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{
              opacity: isFloating ? 1 : 0,
              borderRadius: isFloating ? "32px" : "0px",
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: isFloating ? "blur(20px) saturate(180%)" : "blur(0px) saturate(100%)",
              WebkitBackdropFilter: isFloating ? "blur(20px) saturate(180%)" : "blur(0px) saturate(100%)",
              border: isFloating ? "1px solid rgba(0, 0, 0, 0.08)" : "1px solid rgba(255, 255, 255, 0)",
              boxShadow: isFloating
                ? "0 16px 36px -4px rgba(25, 48, 34, 0.08), 0 4px 12px -2px rgba(25, 48, 34, 0.04)"
                : "0 0 0 0 rgba(25, 48, 34, 0)",
              willChange: "opacity, transform, border-radius",
            }}
          />

          {/* Logo (Dual-layer cross-fade for seamless color shift) */}
          <Link href="/" className="relative z-10 flex items-center gap-2.5 group shrink-0">
            {/* Dark Brand Logo (fades in on white floating island) */}
            <MarginFlowLogo
              className="h-6 sm:h-7 w-auto text-[#193022] transition-opacity duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:opacity-90"
              style={{ opacity: isFloating ? 1 : 0 }}
            />
            {/* White Brand Logo (fades out as island appears) */}
            <MarginFlowLogo
              className="absolute inset-0 h-6 sm:h-7 w-auto text-white transition-opacity duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:opacity-90 pointer-events-none"
              style={{ opacity: isFloating ? 0 : 1 }}
            />
          </Link>

          {/* Desktop Nav Links */}
          <nav
            className="relative z-10 hidden lg:flex items-center gap-6 xl:gap-8 text-xs sm:text-[13px] font-sans font-medium whitespace-nowrap shrink-0 transition-colors duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{
              color: isFloating ? "#5c7062" : "#9ab1a1",
            }}
          >
            <a
              href="#engine"
              className={`transition-colors duration-200 ${
                isFloating ? "hover:text-[#193022]" : "hover:text-[#b6f5cc]"
              }`}
            >
              How It Works
            </a>
            <a
              href="#routes"
              className={`transition-colors duration-200 ${
                isFloating ? "hover:text-[#193022]" : "hover:text-[#b6f5cc]"
              }`}
            >
              Reconciliation
            </a>
            <a
              href="#workspace"
              className={`transition-colors duration-200 ${
                isFloating ? "hover:text-[#193022]" : "hover:text-[#b6f5cc]"
              }`}
            >
              Cockpit
            </a>
            <a
              href="#metrics"
              className={`transition-colors duration-200 ${
                isFloating ? "hover:text-[#193022]" : "hover:text-[#b6f5cc]"
              }`}
            >
              Results
            </a>
            <a
              href="#faq"
              className={`transition-colors duration-200 ${
                isFloating ? "hover:text-[#193022]" : "hover:text-[#b6f5cc]"
              }`}
            >
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="relative z-10 flex items-center gap-3 shrink-0 whitespace-nowrap">
            <Link
              href="/login"
              className={`hidden sm:inline-block text-xs sm:text-[13px] font-sans font-medium px-3.5 py-2 transition-colors duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] shrink-0 whitespace-nowrap ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
              style={{
                color: isFloating ? "#5c7062" : "#c2d7c8",
              }}
            >
              Sign In
            </Link>

            <button
              onClick={onSignIn}
              disabled={isAuthenticating}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full bg-[#00ae3b] hover:bg-[#008f36] active:scale-95 text-white text-xs sm:text-[13px] font-sans font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(0,174,59,0.3)] cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>{isAuthenticating ? "Connecting..." : "Audit Your Store Free"}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Mobile Menu Toggle (Cross-fade between dark and white icon) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden relative p-2 shrink-0 flex items-center justify-center w-9 h-9"
              aria-label="Toggle menu"
            >
              <span
                className="transition-opacity duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] text-[#193022] flex items-center justify-center"
                style={{ opacity: isFloating ? 1 : 0 }}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </span>
              <span
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] text-white pointer-events-none"
                style={{ opacity: isFloating ? 0 : 1 }}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div
          className={`lg:hidden pointer-events-auto mx-4 mt-2 p-6 rounded-2xl border shadow-2xl space-y-4 transition-all duration-300 ${
            isFloating
              ? "bg-white/95 border-black/[0.08] text-[#193022]"
              : "bg-[#060c09] border-white/[0.12] text-white"
          }`}
        >
          <div
            className={`flex flex-col space-y-3 font-sans font-medium text-sm ${
              isFloating ? "text-[#5c7062]" : "text-[#9ab1a1]"
            }`}
          >
            <a
              href="#engine"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`transition-colors ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
            >
              How It Works
            </a>
            <a
              href="#routes"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`transition-colors ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
            >
              Reconciliation
            </a>
            <a
              href="#workspace"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`transition-colors ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
            >
              Cockpit
            </a>
            <a
              href="#metrics"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`transition-colors ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
            >
              Results
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`transition-colors ${
                isFloating ? "hover:text-[#193022]" : "hover:text-white"
              }`}
            >
              FAQ
            </a>
          </div>

          <div
            className={`pt-4 border-t flex items-center justify-between font-sans ${
              isFloating ? "border-black/[0.08]" : "border-white/[0.1]"
            }`}
          >
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`text-xs transition-colors ${
                isFloating ? "text-[#5c7062] hover:text-[#193022]" : "text-[#c2d7c8] hover:text-white"
              }`}
            >
              Sign In
            </Link>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onSignIn();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00ae3b] text-white text-xs font-semibold"
            >
              <span>Audit Your Store Free</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
