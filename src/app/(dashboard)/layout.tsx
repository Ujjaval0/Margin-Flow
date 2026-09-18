"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsWorkspaceOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Trigger chart re-dimensioning when sidebar expands/collapses
  useEffect(() => {
    const timer1 = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    const timer2 = setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isWorkspaceOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Persistent Sidebar Navigation */}
      <Sidebar
        isOpen={isWorkspaceOpen}
        onToggle={() => setIsWorkspaceOpen((prev) => !prev)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300">
        {/* Top Sticky Navbar */}
        <Navbar />

        {/* Dynamic Route Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0 transition-all duration-200">
          <React.Suspense fallback={null}>
            {children}
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
