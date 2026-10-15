import {
  Product,
  Order,
  ReturnRecord,
  Settlement,
  Claim,
  Supplier,
  PurchaseBill,
  Expense,
  AIStagedDocument,
  FinancialAuditLog,
  CustomerComplaint,
  UserAccount,
} from "./types";

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_RETURNS: ReturnRecord[] = [];

export const INITIAL_CLAIMS: Claim[] = [];

export const INITIAL_SETTLEMENTS: Settlement[] = [];

export const INITIAL_PURCHASES: PurchaseBill[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_AI_DOCUMENTS: AIStagedDocument[] = [];

export const INITIAL_AUDIT_LOGS: FinancialAuditLog[] = [];

export const INITIAL_COMPLAINTS: CustomerComplaint[] = [];

export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: "ACC-001",
    name: "E-Commerce",
    email: "founder@brand.in",
    accountType: "BRAND_OWNER",
    companyName: "VoltTech Consumer Electronics",
    gstin: "27AABCV1234F1Z1",
    phone: "+91 98200 99881",
    authenticatedAt: "2026-09-24T08:00:00Z",
    onboardingPreferences: {
      role: "FOUNDER",
      channels: ["AMAZON", "FLIPKART", "SHOPIFY"],
      volume: "GROWTH",
      completedAt: "2026-09-24T08:05:00Z",
    },
  },
  {
    id: "ACC-002",
    name: "Rajesh Sharma (Apex)",
    email: "rajesh@apexelectronics.in",
    accountType: "SUPPLIER",
    supplierId: "SUP-001",
    companyName: "Apex Electronics Mfg Ltd",
    gstin: "27AAACA1234A1Z5",
    phone: "+91 98200 12345",
    authenticatedAt: "2026-09-24T08:30:00Z",
    onboardingPreferences: {
      role: "SUPPLIER_MANUFACTURER",
      channels: ["OFFLINE_B2B", "AMAZON"],
      volume: "SCALE",
      completedAt: "2026-09-24T08:35:00Z",
    },
  },
  {
    id: "ACC-003",
    name: "Metro Retail Distribution",
    email: "orders@metrodistributors.com",
    accountType: "WHOLESALER",
    companyName: "Metro B2B Wholesalers & Logistics",
    gstin: "24AABCM9981K1Z3",
    phone: "+91 99120 44556",
    authenticatedAt: "2026-09-24T09:00:00Z",
    onboardingPreferences: {
      role: "AGENCY_CONSULTANT",
      channels: ["OFFLINE_B2B", "FLIPKART", "AMAZON"],
      volume: "ENTERPRISE",
      completedAt: "2026-09-24T09:05:00Z",
    },
  },
];
