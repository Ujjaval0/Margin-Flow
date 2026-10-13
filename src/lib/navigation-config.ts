/**
 * Authoritative Navigation Configuration & Naming Convention Registry: MarginFlow
 * 
 * Enforces unified, standardized, hardcoded naming conventions across:
 * 1. Sidebar Navigation Labels
 * 2. Top Navbar Module Titles
 * 3. Page Header H1 Titles
 * 4. Page Subheadings
 */

export interface ModuleNavigationMeta {
  id: string;
  sidebarLabel: string;
  navbarTitle: string;
  pageTitle: string;
  pageSubtitle: string;
}

export const MODULE_NAVIGATION_CONFIG: Record<string, ModuleNavigationMeta> = {
  dashboard: {
    id: "dashboard",
    sidebarLabel: "Home",
    navbarTitle: "Home",
    pageTitle: "Financial Overview",
    pageSubtitle: "Real-Time Multi-Channel Performance & Profit Intelligence",
  },
  orders: {
    id: "orders",
    sidebarLabel: "Orders",
    navbarTitle: "Orders",
    pageTitle: "Orders",
    pageSubtitle: "Order Lifecycle, Unit Economics & Settlement Status",
  },
  returns: {
    id: "returns",
    sidebarLabel: "Returns & RTO",
    navbarTitle: "Returns & RTO",
    pageTitle: "Returns & Reverse Logistics",
    pageSubtitle: "Customer Returns, Courier RTO & Reverse Freight Tolls",
  },
  claims: {
    id: "claims",
    sidebarLabel: "Claims & Disputes",
    navbarTitle: "Claims & Disputes",
    pageTitle: "Claims & Dispute Recoveries",
    pageSubtitle: "Automated SAFE-T Claims, SPF Filing & Capital Recovery",
  },
  products: {
    id: "products",
    sidebarLabel: "Products & SKUs",
    navbarTitle: "Products & SKUs",
    pageTitle: "Product Catalog & Cost Basis",
    pageSubtitle: "Catalog SKUs, Landed COGS & Courier Weight Slabs",
  },
  settlements: {
    id: "settlements",
    sidebarLabel: "Settlements",
    navbarTitle: "Settlements",
    pageTitle: "Marketplace Settlements",
    pageSubtitle: "Bank Remittances, UTR Reconciliation & Statutory Withholdings",
  },
  suppliers: {
    id: "suppliers",
    sidebarLabel: "Suppliers",
    navbarTitle: "Suppliers",
    pageTitle: "Wholesale Suppliers",
    pageSubtitle: "Vendor Directory, Cost Trends & Accounts Payable",
  },
  purchases: {
    id: "purchases",
    sidebarLabel: "Purchases & Bills",
    navbarTitle: "Purchases & Bills",
    pageTitle: "Purchases & Inbound Bills",
    pageSubtitle: "Inbound Wholesale Invoices, Landed Costs & Inventory Restock",
  },
  expenses: {
    id: "expenses",
    sidebarLabel: "Operating Expenses",
    navbarTitle: "Operating Expenses",
    pageTitle: "Operating Expenses",
    pageSubtitle: "Business Overheads, Subscriptions & Operational OPEX Ledger",
  },
  reports: {
    id: "reports",
    sidebarLabel: "Analytics & P&L",
    navbarTitle: "Analytics & P&L",
    pageTitle: "Analytics & Financial Reports",
    pageSubtitle: "Contribution Margin P&L, SKU Breakdown & Growth Trends",
  },
  ledger: {
    id: "ledger",
    sidebarLabel: "General Ledger",
    navbarTitle: "General Ledger",
    pageTitle: "Double-Entry General Ledger",
    pageSubtitle: "Immutable Financial Transaction Journal & Trial Balance",
  },
  webhooks: {
    id: "webhooks",
    sidebarLabel: "Store Integrations",
    navbarTitle: "Store Integrations",
    pageTitle: "Store Integrations",
    pageSubtitle: "Marketplace SP-API Connectors, Couriers & Webhooks",
  },
  trash: {
    id: "trash",
    sidebarLabel: "Recycle Bin",
    navbarTitle: "Recycle Bin",
    pageTitle: "Recycle Bin",
    pageSubtitle: "Restorable Archival Ledger & Soft-Deleted Records",
  },
  documents: {
    id: "documents",
    sidebarLabel: "Document Staging",
    navbarTitle: "Document Staging",
    pageTitle: "Document Verification & Staging",
    pageSubtitle: "Intelligent Document Processing & Multi-Model Ingestion",
  },
};

export function getModuleNavMeta(moduleId: string): ModuleNavigationMeta {
  return (
    MODULE_NAVIGATION_CONFIG[moduleId] || {
      id: moduleId,
      sidebarLabel: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
      navbarTitle: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
      pageTitle: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
      pageSubtitle: "Financial Intelligence & Operational Telemetry",
    }
  );
}
