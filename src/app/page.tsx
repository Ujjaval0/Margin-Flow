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
import { ExpensesView } from "@/components/modules/expenses-view";
import { AIStagingView } from "@/components/modules/ai-staging-view";
import { ReportsView } from "@/components/modules/reports-view";
import { AuditView } from "@/components/modules/audit-view";
import { Marketplace } from "@/domain/types";

export default function Home() {
  const [activeModule, setActiveModule] = useState<NavModule>("dashboard");
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const handleQuickCreate = () => {
    setActiveModule("orders");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          selectedMarketplace={selectedMarketplace}
          onSelectMarketplace={setSelectedMarketplace}
            onOpenQuickCreate={handleQuickCreate}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Dynamic View Scrollable Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeModule === "dashboard" && (
            <DashboardView selectedMarketplace={selectedMarketplace} />
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
          {activeModule === "expenses" && <ExpensesView />}
          {activeModule === "documents" && <AIStagingView />}
          {activeModule === "reports" && <ReportsView />}
          {activeModule === "audit" && <AuditView />}
        </main>
      </div>


    </div>
  );
}
