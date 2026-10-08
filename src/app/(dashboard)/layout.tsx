"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { usePlatform } from "@/domain/store";
import { ReturnRecord } from "@/domain/types";

const CfoCopilot = dynamic(
  () => import("@/components/ai/cfo-copilot").then((mod) => mod.CfoCopilot),
  { ssr: false }
);

const DisputePacketModal = dynamic(
  () => import("@/components/modals/dispute-packet-modal").then((mod) => mod.DisputePacketModal),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  // Rehydrate sidebar preference from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 768) {
          setIsWorkspaceOpen(false);
          return;
        }
        const saved = localStorage.getItem("marginflow_sidebar_open");
        if (saved !== null) {
          setIsWorkspaceOpen(saved === "true");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggle = () => {
    setIsWorkspaceOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("marginflow_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Trigger chart re-dimensioning once sidebar expands/collapses completely (after 300ms transition finishes)
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
    return () => clearTimeout(timer);
  }, [isWorkspaceOpen]);

  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll main container to top on route navigation for instant, snappy transitions
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  const platform = usePlatform();
  const [disputeReturn, setDisputeReturn] = useState<ReturnRecord | null>(null);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);

  // Listen for global dispute modal triggers
  useEffect(() => {
    const handleOpenDispute = (e: any) => {
      const detail = e.detail;
      if (detail?.returnRecord) {
        setDisputeReturn(detail.returnRecord);
        setIsDisputeOpen(true);
      } else if (detail?.returnId) {
        const found = platform.returns.find((r) => r.id === detail.returnId);
        if (found) {
          setDisputeReturn(found);
          setIsDisputeOpen(true);
        }
      }
    };
    window.addEventListener("marginflow_open_dispute_modal", handleOpenDispute);
    return () => window.removeEventListener("marginflow_open_dispute_modal", handleOpenDispute);
  }, [platform.returns]);

  return (
    <div className="fixed inset-0 flex h-full w-full overflow-hidden bg-[#F5F5F7] text-[#1D1D1F] font-apple tracking-[-0.012em] antialiased">
      {/* Persistent Sidebar Navigation */}
      <Sidebar
        isOpen={isWorkspaceOpen}
        onToggle={handleToggle}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          isSidebarOpen={isWorkspaceOpen}
          onToggleSidebar={handleToggle}
        />

        {/* Dynamic Route Scrollable View Container with Silky Page Transition */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0 scroll-smooth">
          <div key={pathname} className="page-transition min-w-0 w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global CFO Copilot Drawer & Trigger */}
      <CfoCopilot />

      {/* Global 1-Click SAFE-T Dispute Packet Modal */}
      <DisputePacketModal
        returnRecord={disputeReturn}
        isOpen={isDisputeOpen}
        onClose={() => {
          setIsDisputeOpen(false);
          setDisputeReturn(null);
        }}
      />
    </div>
  );
}
