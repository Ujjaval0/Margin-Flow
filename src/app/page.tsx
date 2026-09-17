"use client";

import React, { useState } from "react";
import { Sidebar, NavModule } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardView } from "@/components/modules/dashboard-view";
import { OrdersView } from "@/components/modules/orders-view";
import { ReturnsView } from "@/components/modules/returns-view";
import { ClaimsView } from "@/components/modules/claims-view";
import { ProductsView } from "@/components/modules/products-view";
import { SettlementsView } from "@/components/modules/settlements-view";
import { SuppliersView } from "@/components/modules/suppliers-view";
import { PurchasesView } from "@/components/modules/purchases-view";
import { ExpensesView } from "@/components/modules/expenses-view";
import { AIStagingView } from "@/components/modules/ai-staging-view";
import { ReportsView } from "@/components/modules/reports-view";
import { AuditView } from "@/components/modules/audit-view";
import { Marketplace } from "@/domain/types";

export default function Home() {
  const [activeModule, setActiveModule] = useState<NavModule>("dashboard");
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | "ALL">("ALL");
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle workspace
  React.useEffect(() => {
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
  React.useEffect(() => {
    const timer1 = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    const timer2 = setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isWorkspaceOpen]);

  const handleQuickCreate = () => {
    setActiveModule("orders");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isOpen={isWorkspaceOpen}
        onToggle={() => setIsWorkspaceOpen((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300">
        {/* Top Navbar */}
        <Navbar
          selectedMarketplace={selectedMarketplace}
          onSelectMarketplace={setSelectedMarketplace}
          onOpenQuickCreate={handleQuickCreate}
          activeModule={activeModule}
        />

        {/* Dynamic View Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0 transition-all">
          {activeModule === "dashboard" && (
            <DashboardView
              selectedMarketplace={selectedMarketplace}
              onSelectModule={setActiveModule}
            />
          )}
          {activeModule === "orders" && (
            <OrdersView selectedMarketplace={selectedMarketplace} />
          )}
          {activeModule === "returns" && (
            <ReturnsView selectedMarketplace={selectedMarketplace} />
          )}
          {activeModule === "claims" && (
            <ClaimsView selectedMarketplace={selectedMarketplace} />
          )}
          {activeModule === "products" && <ProductsView />}
          {activeModule === "settlements" && (
            <SettlementsView selectedMarketplace={selectedMarketplace} />
          )}
          {activeModule === "suppliers" && <SuppliersView />}
          {activeModule === "purchases" && <PurchasesView />}
          {activeModule === "expenses" && <ExpensesView />}
          {activeModule === "documents" && <AIStagingView />}
          {activeModule === "reports" && <ReportsView />}
          {activeModule === "audit" && <AuditView />}
        </main>
      </div>


    </div>
  );
}
