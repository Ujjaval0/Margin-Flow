"use client";

import { archiveRecords, applyArchivePatch, RecycleType } from "./recycle-bin";
import type { LedgerData } from "./snapshot-validation";
import { mergeOrders, mergeSettlements } from "./sync-merge";
import { parseLedgerSnapshot } from "./snapshot-validation";
import { businessDate } from "./report-scope";
import { allocateSupplierPayment } from "./purchase-accounting";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Product,
  Order,
  Marketplace,
  ReturnRecord,
  Settlement,
  Claim,
  Supplier,
  PurchaseBill,
  Expense,
  AIStagedDocument,
  FinancialAuditLog,
  GuardrailCheckResult,
  InventoryMetrics,
  FeesBreakdown,
  ClaimsSummary,
  SettlementSummary,
  CustomerComplaint,
  UserAccount,
  AccountType,
} from "./types";
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_RETURNS,
  INITIAL_CLAIMS,
  INITIAL_SETTLEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
  INITIAL_EXPENSES,
  INITIAL_AI_DOCUMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPLAINTS,
  DEFAULT_ACCOUNTS,
} from "./mock-data";
import { runSystemGuardrailDiagnostics, validateDocumentArithmetic } from "./guardrails";
import {
  calculateBusinessProfitability,
  calculateMarketplaceProfitability,
  calculateSkuProfitability,
  ProfitabilityMetrics,
  MarketplaceProfitability,
  SkuProfitability,
  DateRangePreset,
  DateFilterRange,
  resolveDatePreset,
  filterDatasetByDateRange,
  calculatePercentageChange,
  calculateSettlementAging,
  SettlementAgingSummary,
} from "./profitability-engine";

import { LEDGER_STORAGE_KEY, tenantLedgerKey, readTenantSnapshot } from "./tenant-cache";
export { LEDGER_STORAGE_KEY } from "./tenant-cache";

interface PlatformContextType {
  reportDataset: { orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; expenses: Expense[] };
  products: Product[];
  orders: Order[];
  returns: ReturnRecord[];
  settlements: Settlement[];
  claims: Claim[];
  suppliers: Supplier[];
  purchases: PurchaseBill[];
  expenses: Expense[];
  aiDocuments: AIStagedDocument[];
  auditLogs: FinancialAuditLog[];
  complaints: CustomerComplaint[];
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  switchAccountType: (role: AccountType, supplierId?: string) => void;

  // Channel & Date-Range Filter State
  selectedMarketplace: Marketplace | "ALL";
  setSelectedMarketplace: (mp: Marketplace | "ALL") => void;
  datePreset: DateRangePreset;
  setDatePreset: (preset: DateRangePreset) => void;
  customDateRange: DateFilterRange | null;
  setCustomDateRange: (range: DateFilterRange | null) => void;
  profitability: ProfitabilityMetrics;
  priorProfitability: ProfitabilityMetrics;
  profitabilityTrends: {
    netSalesChange: number;
    grossProfitChange: number;
    contributionProfitChange: number;
    netOperatingProfitChange: number;
    ordersChange: number;
  };
  marketplaceBreakdown: MarketplaceProfitability[];
  skuBreakdown: SkuProfitability[];
  acknowledgedLossLeaderSkus: string[];
  toggleLossLeaderAcknowledgment: (sku: string) => void;
  settlementAging: SettlementAgingSummary;
  guardrailStatus: GuardrailCheckResult[];
  inventoryMetrics: InventoryMetrics;
  feesBreakdown: FeesBreakdown;
  claimsSummary: ClaimsSummary;
  settlementSummary: SettlementSummary;

  // Persistent Ledger Management
  isHydrated: boolean;
  isSyncingWithDb: boolean;
  refreshFromDatabase: () => Promise<void>;
  resetLedgerToDefaults: () => void;
  exportLedgerSnapshot: () => string;
  importLedgerSnapshot: (jsonString: string) => boolean;
  restoreArchivedRecord: (id: string) => Promise<void>;

  // Actions
  addOrder: (order: Order) => void;
  syncExternalOrders: (incomingOrders: Order[]) => Promise<{ added: number; updated: number }>;
  updateOrder: (order: Order) => void;
  deleteOrder: (orderId: string) => void;
  deleteOrders: (orderIds: string[]) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  bulkUpdateOrderStatus: (orderIds: string[], status: Order["status"]) => void;
  addReturn: (returnRecord: ReturnRecord) => void;
  updateReturn: (returnRecord: ReturnRecord) => void;
  restockReturn: (returnId: string) => void;
  deleteReturn: (returnId: string) => void;
  addClaim: (claim: Claim) => void;
  updateClaim: (claimId: string, recoveredAmount: number, status: Claim["status"]) => void;
  editClaim: (claimId: string, updates: Partial<Pick<Claim, "claimType" | "claimDate" | "amountClaimed" | "amountRecovered" | "status" | "notes" | "marketplace">>) => void;
  deleteClaim: (claimId: string) => void;
  deleteClaims: (claimIds: string[]) => void;
  addProduct: (product: Product) => void;
  bulkAddProducts: (products: Product[]) => void;
  deleteProduct: (sku: string) => void;
  updateProductCost: (sku: string, newCost: number, reason: string) => void;
  addComplaint: (complaint: CustomerComplaint) => void;
  updateComplaintStatus: (ticketId: string, status: CustomerComplaint["status"], resolutionNotes?: string) => void;
  deleteComplaint: (ticketId: string) => void;
  addSettlement: (settlement: Settlement) => void;
  syncExternalSettlements: (incomingSettlements: Settlement[]) => Promise<{ added: number; updated: number }>;
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (expenseId: string) => void;
  deleteExpenses: (expenseIds: string[]) => void;
  addPurchase: (purchase: PurchaseBill) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (supplierId: string) => void;
  recordSupplierPayment: (
    supplierId: string,
    amount: number,
    paymentMethod: string,
    ref: string,
    notes?: string
  ) => void;
  addStagedDocument: (doc: AIStagedDocument) => void;
  addStagedDocuments: (docs: AIStagedDocument[]) => void;
  approveStagedDocument: (docId: string) => void;
  batchApproveStagedDocuments: (docIds: string[]) => void;
  updateStagedDocumentField: (
    docId: string,
    field: keyof AIStagedDocument["extractedData"],
    val: any
  ) => void;
  rejectStagedDocument: (docId: string) => void;
  deleteStagedDocument: (docId: string) => void;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseBill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aiDocuments, setAiDocuments] = useState<AIStagedDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [complaints, setComplaints] = useState<CustomerComplaint[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount>(DEFAULT_ACCOUNTS[0]);
  const [acknowledgedLossLeaderSkus, setAcknowledgedLossLeaderSkus] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("ALL");
  const [customDateRange, setCustomDateRange] = useState<DateFilterRange | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | "ALL">("ALL");

  const verifiedOwner = useRef<string | null>(null);
  const refreshGeneration = useRef(0);
  const postedPurchases = useRef(new Set<string>());
  const [cacheOwner, setCacheOwner] = useState<string | null>(null);

  const liveLedger = useRef<LedgerData>({ products, orders, returns, settlements, claims, suppliers, purchases, expenses, aiDocuments, auditLogs, complaints, acknowledgedLossLeaderSkus });
  liveLedger.current = { products, orders, returns, settlements, claims, suppliers, purchases, expenses, aiDocuments, auditLogs, complaints, acknowledgedLossLeaderSkus };
  const archiveBusy = useRef(false);
  const applyLedgerChange = useCallback((data: LedgerData) => {
    liveLedger.current = data;
    setProducts(data.products); setOrders(data.orders); setReturns(data.returns);
    setSettlements(data.settlements); setClaims(data.claims); setExpenses(data.expenses);
  }, []);
  const archiveSelection = useCallback(async (type: RecycleType, ids: string[]) => {
    if (archiveBusy.current) { alert("Another archive operation is in progress. Please retry shortly."); return; }
    const owner = verifiedOwner.current;
    if (!owner) { alert("Sign in before deleting records."); return; }
    archiveBusy.current = true;
    try {
      const patch = archiveRecords(liveLedger.current, type, ids);
      const response = await fetch("/api/recycle-bin", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "archive", type, ids, patch }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "Deletion could not be saved.");
      if (verifiedOwner.current !== owner) return;
      applyLedgerChange(applyArchivePatch(liveLedger.current, patch));
    } catch (error) { alert(error instanceof Error ? error.message : "Deletion failed. Please retry."); }
    finally { archiveBusy.current = false; }
  }, [applyLedgerChange]);
  const restoreArchivedRecord = useCallback(async (id: string) => {
    if (archiveBusy.current) throw new Error("Another archive operation is in progress.");
    const owner = verifiedOwner.current;
    if (!owner) throw new Error("Sign in before restoring records.");
    archiveBusy.current = true;
    try {
      const response = await fetch("/api/recycle-bin?id=" + encodeURIComponent(id), { credentials: "same-origin", cache: "no-store" });
      const record = await response.json();
      if (!response.ok || !record.patch) throw new Error("Archive unavailable or expired.");
      if (verifiedOwner.current !== owner) throw new Error("Account changed during recovery.");
      applyArchivePatch(liveLedger.current, record.patch, true);
      const saved = await fetch("/api/recycle-bin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", id }) });
      const result = await saved.json();
      if (!saved.ok || result.success !== true) throw new Error(result.error || "Recovery could not be saved.");
      if (verifiedOwner.current !== owner) throw new Error("Account changed during recovery.");
      applyLedgerChange(applyArchivePatch(liveLedger.current, record.patch, true));
    } finally { archiveBusy.current = false; }
  }, [applyLedgerChange]);

  const clearTenantData = useCallback(() => {
    postedPurchases.current.clear();
    setProducts([]); setOrders([]); setReturns([]); setSettlements([]);
    setClaims([]); setSuppliers([]); setPurchases([]); setExpenses([]);
    setAiDocuments([]); setAuditLogs([]); setComplaints([]);
    setAcknowledgedLossLeaderSkus([]);
    setSelectedMarketplace("ALL"); setDatePreset("ALL"); setCustomDateRange(null);
  }, []);

  // Only the server session may select a tenant cache; browser identity is display metadata.
  const refreshFromDatabase = useCallback(async () => {
    if (typeof window === "undefined") return;
    const generation = ++refreshGeneration.current;
    let identityConfirmed = false;
    setIsSyncingWithDb(true);
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (generation !== refreshGeneration.current) return;
      if (!meRes.ok) {
        verifiedOwner.current = null; setCacheOwner(null); clearTenantData();
        return;
      }
      const meData = await meRes.json();
      if (generation !== refreshGeneration.current) return;
      const ownerId = meData?.user?.id;
      if (typeof ownerId !== "string" || !ownerId) {
        verifiedOwner.current = null; setCacheOwner(null); clearTenantData();
        return;
      }
      identityConfirmed = true;
      if (verifiedOwner.current !== ownerId) {
        clearTenantData();
        verifiedOwner.current = ownerId;
        setCacheOwner(ownerId);
        const data = readTenantSnapshot(localStorage, ownerId);
        if (data) {
          if (Array.isArray(data.products)) setProducts(data.products);
          if (Array.isArray(data.orders)) setOrders(data.orders);
          if (Array.isArray(data.returns)) setReturns(data.returns);
          if (Array.isArray(data.settlements)) setSettlements(data.settlements);
          if (Array.isArray(data.claims)) setClaims(data.claims);
          if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
          if (Array.isArray(data.purchases)) setPurchases(data.purchases);
          if (Array.isArray(data.expenses)) setExpenses(data.expenses);
          if (Array.isArray(data.aiDocuments)) setAiDocuments(data.aiDocuments);
          if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
          if (Array.isArray(data.complaints)) setComplaints(data.complaints);
          if (Array.isArray(data.acknowledgedLossLeaderSkus)) setAcknowledgedLossLeaderSkus(data.acknowledgedLossLeaderSkus);
        }
      }
      setCurrentUser(previous => ({ ...previous, ...meData.user }));
      const responses = await Promise.all([
        fetch("/api/orders?limit=2000", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/settlements?limit=2000", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/products?limit=2000", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (responses.some(response => !response.ok)) throw new Error("Ledger synchronization unavailable.");
      const [ordersJson, settlementsJson, productsJson] = await Promise.all(responses.map(response => response.json()));
      if (generation !== refreshGeneration.current || verifiedOwner.current !== ownerId) return;
      if (!Array.isArray(ordersJson.orders) || !Array.isArray(settlementsJson.settlements) || !Array.isArray(productsJson.products)) {
        throw new Error("Invalid ledger response.");
      }
      // Empty authoritative responses must remove stale cached rows too.
      setOrders(ordersJson.orders);
      setSettlements(settlementsJson.settlements);
      setProducts(productsJson.products);
      const recoveredResponse = await fetch("/api/recycle-bin?recovered=true", { credentials: "same-origin", cache: "no-store" });
      if (recoveredResponse.ok) {
        const recoveredData = (await recoveredResponse.json()).recovered;
        if (generation === refreshGeneration.current && verifiedOwner.current === ownerId && recoveredData) {
          const mergeRecovered = <T extends { id: string }>(current: T[], recovered: T[]) => [...current, ...recovered.filter(row => !current.some(existing => existing.id === row.id))];
          if (Array.isArray(recoveredData.returns)) setReturns(previous => mergeRecovered(previous, recoveredData.returns));
          if (Array.isArray(recoveredData.claims)) setClaims(previous => mergeRecovered(previous, recoveredData.claims));
          if (Array.isArray(recoveredData.expenses)) setExpenses(previous => mergeRecovered(previous, recoveredData.expenses));
        }
      }

    } catch {
      if (generation === refreshGeneration.current) {
        // Fail closed if identity has not been confirmed; never hydrate the unowned legacy cache.
        if (!identityConfirmed) { verifiedOwner.current = null; setCacheOwner(null); clearTenantData(); }
        console.warn("[PlatformStore] Ledger synchronization unavailable.");
      }
    } finally {
      if (generation === refreshGeneration.current) { setIsSyncingWithDb(false); setIsHydrated(true); }
    }
  }, [clearTenantData]);

  useEffect(() => {
    void refreshFromDatabase();
    const onFocus = () => { void refreshFromDatabase(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    window.addEventListener("storage", onFocus);
    window.addEventListener("marginflow:session-changed", onFocus);
    return () => {
      ++refreshGeneration.current;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      window.removeEventListener("storage", onFocus);
      window.removeEventListener("marginflow:session-changed", onFocus);
    };
  }, [refreshFromDatabase]);
  // Debounced synchronization of state mutations to local ledger storage (prevents UI thread freezing)
  useEffect(() => {
    if (!isHydrated || !cacheOwner || verifiedOwner.current !== cacheOwner) return;
    const ownerId = cacheOwner;
    const storageKey = tenantLedgerKey(ownerId);
    const timer = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          const snapshot = {
            version: 1,
            ownerId,
            timestamp: new Date().toISOString(),
            data: {
              products,
              orders,
              returns,
              settlements,
              claims,
              suppliers,
              purchases,
              expenses,
              aiDocuments,
              auditLogs,
              complaints,
              acknowledgedLossLeaderSkus,
            },
          };
          const serialized = JSON.stringify(snapshot);
          if ("requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
              try {
                if (verifiedOwner.current === ownerId) localStorage.setItem(storageKey, serialized);
              } catch (err) {
                console.error("Failed to save ledger to localStorage:", err);
              }
            });
          } else {
            if (verifiedOwner.current === ownerId) localStorage.setItem(storageKey, serialized);
          }
        }
      } catch (e) {
        console.error("Failed to synchronize persistent ledger to storage:", e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    cacheOwner,
    isHydrated,
    products,
    orders,
    returns,
    settlements,
    claims,
    suppliers,
    purchases,
    expenses,
    aiDocuments,
    auditLogs,
    complaints,
    acknowledgedLossLeaderSkus,
  ]);

  // Reports and aging use the current business day, even when imports are old.
  const effectiveAnchorDate = businessDate();

  // Filter datasets by date preset & prior period for trend comparisons
  const dateRanges = useMemo(() => {
    return resolveDatePreset(datePreset, effectiveAnchorDate, customDateRange);
  }, [datePreset, effectiveAnchorDate, customDateRange]);

  const isMarketplaceMatch = useCallback(
    (mp?: string | null) => {
      if (!selectedMarketplace || selectedMarketplace === "ALL") return true;
      if (!mp) return false;
      if (mp === selectedMarketplace) return true;
      if (selectedMarketplace === "Amazon India" && (mp === "Amazon" || mp === "Amazon India")) return true;
      if (selectedMarketplace === "Personal Website" && (mp === "Website" || mp === "Personal Website")) return true;
      return false;
    },
    [selectedMarketplace]
  );

  const dateFilteredCurrent = useMemo(() => {
    if (datePreset === "ALL") {
      return { orders, returns, settlements, claims, expenses };
    }
    return filterDatasetByDateRange(orders, returns, settlements, claims, expenses, dateRanges.current);
  }, [orders, returns, settlements, claims, expenses, datePreset, dateRanges]);

  const dateFilteredPrior = useMemo(() => {
    return filterDatasetByDateRange(orders, returns, settlements, claims, expenses, dateRanges.previous);
  }, [orders, returns, settlements, claims, expenses, dateRanges]);

  const currentDataset = useMemo(() => {
    if (selectedMarketplace === "ALL") {
      return dateFilteredCurrent;
    }
    return {
      orders: dateFilteredCurrent.orders.filter((o) => isMarketplaceMatch(o.marketplace)),
      returns: dateFilteredCurrent.returns.filter((r) => isMarketplaceMatch(r.marketplace)),
      settlements: dateFilteredCurrent.settlements.filter((s) => isMarketplaceMatch(s.marketplace)),
      claims: dateFilteredCurrent.claims.filter((c) => isMarketplaceMatch(c.marketplace)),
      expenses: dateFilteredCurrent.expenses.filter((e) => isMarketplaceMatch(e.marketplace)),
    };
  }, [dateFilteredCurrent, selectedMarketplace, isMarketplaceMatch]);

  const priorDataset = useMemo(() => {
    if (selectedMarketplace === "ALL") {
      return dateFilteredPrior;
    }
    return {
      orders: dateFilteredPrior.orders.filter((o) => isMarketplaceMatch(o.marketplace)),
      returns: dateFilteredPrior.returns.filter((r) => isMarketplaceMatch(r.marketplace)),
      settlements: dateFilteredPrior.settlements.filter((s) => isMarketplaceMatch(s.marketplace)),
      claims: dateFilteredPrior.claims.filter((c) => isMarketplaceMatch(c.marketplace)),
      expenses: dateFilteredPrior.expenses.filter((e) => isMarketplaceMatch(e.marketplace)),
    };
  }, [dateFilteredPrior, selectedMarketplace, isMarketplaceMatch]);

  // Compute live profitability & guardrails
  const profitability = useMemo(() => {
    return calculateBusinessProfitability(
      currentDataset.orders,
      currentDataset.returns,
      currentDataset.settlements,
      currentDataset.claims,
      currentDataset.expenses
    );
  }, [currentDataset]);

  const priorProfitability = useMemo(() => {
    return calculateBusinessProfitability(
      priorDataset.orders,
      priorDataset.returns,
      priorDataset.settlements,
      priorDataset.claims,
      priorDataset.expenses
    );
  }, [priorDataset]);

  const profitabilityTrends = useMemo(() => {
    return {
      netSalesChange: calculatePercentageChange(profitability.netSales, priorProfitability.netSales),
      grossProfitChange: calculatePercentageChange(profitability.grossProfit, priorProfitability.grossProfit),
      contributionProfitChange: calculatePercentageChange(profitability.contributionProfit, priorProfitability.contributionProfit),
      netOperatingProfitChange: calculatePercentageChange(profitability.netOperatingProfit, priorProfitability.netOperatingProfit),
      ordersChange: calculatePercentageChange(profitability.totalOrders, priorProfitability.totalOrders),
    };
  }, [profitability, priorProfitability]);

  const marketplaceBreakdown = useMemo(() => {
    return calculateMarketplaceProfitability(
      dateFilteredCurrent.orders,
      dateFilteredCurrent.returns,
      dateFilteredCurrent.settlements,
      dateFilteredCurrent.claims,
      dateFilteredCurrent.expenses
    );
  }, [dateFilteredCurrent]);

  const skuBreakdown = useMemo(() => {
    return calculateSkuProfitability(
      currentDataset.orders,
      currentDataset.returns,
      currentDataset.settlements,
      currentDataset.claims,
      currentDataset.expenses
    );
  }, [currentDataset]);

  const settlementAging = useMemo(() => {
    return calculateSettlementAging(currentDataset.orders, settlements, effectiveAnchorDate, returns, claims);
  }, [currentDataset.orders, settlements, returns, claims, effectiveAnchorDate]);

  const guardrailStatus = useMemo(() => {
    return runSystemGuardrailDiagnostics(
      products,
      orders,
      returns,
      settlements,
      claims,
      aiDocuments,
      expenses
    );
  }, [products, orders, returns, settlements, claims, aiDocuments, expenses]);

  const inventoryMetrics = useMemo<InventoryMetrics>(() => {
    let purchasedQuantity = 0;
    purchases.forEach((p) => {
      purchasedQuantity += p.quantity;
    });

    let currentStock = 0;
    let inventoryValue = 0;
    products.forEach((p) => {
      const stock = p.stockQuantity ?? 0;
      currentStock += stock;
      inventoryValue += stock * (p.currentCostPrice || 0);
    });

    const isDamaged = (cond: string) => cond === "DAMAGED" || cond === "UNUSABLE" || cond === "MISSING";
    let goodReturnedQuantity = 0;
    let damagedReturnedQuantity = 0;
    returns.forEach((r) => {
      if (isDamaged(r.condition)) {
        damagedReturnedQuantity += r.quantity;
      } else {
        goodReturnedQuantity += r.quantity;
      }
    });

    const soldQuantity = profitability.totalUnitsSold;
    const openingStock = Math.max(0, currentStock + soldQuantity - goodReturnedQuantity - purchasedQuantity);

    return {
      openingStock,
      purchasedQuantity,
      soldQuantity,
      goodReturnedQuantity,
      damagedReturnedQuantity,
      currentStock,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
    };
  }, [products, purchases, returns, profitability.totalUnitsSold]);

  const feesBreakdown = useMemo<FeesBreakdown>(() => {
    return {
      platformCommission: profitability.marketplaceCharges,
      shippingLogistics: profitability.shippingLogisticsCosts,
      customerReturnFees: profitability.customerReturnFees,
      otherDeductions: Math.max(
        0,
        Math.round(
          (profitability.totalFees -
            (profitability.marketplaceCharges +
              profitability.shippingLogisticsCosts +
              profitability.customerReturnFees)) *
            100
        ) / 100
      ),
      totalFees: profitability.totalFees,
    };
  }, [profitability]);

  const claimsSummary = useMemo<ClaimsSummary>(() => {
    let claimsFiled = 0;
    let pendingClaims = 0;
    let approvedClaims = 0;
    let reimbursementReceived = 0;
    let outstandingClaimAmount = 0;

    currentDataset.claims.forEach((c) => {
      claimsFiled += 1;
      if (c.status === "FILED" || c.status === "UNDER_REVIEW") {
        pendingClaims += 1;
        outstandingClaimAmount += Math.max(0, c.amountClaimed - c.amountRecovered);
      } else if (
        c.status === "APPROVED" ||
        c.status === "RECOVERED" ||
        c.status === "PARTIALLY_RECOVERED"
      ) {
        approvedClaims += 1;
        reimbursementReceived += c.amountRecovered;
        if (c.status === "PARTIALLY_RECOVERED") {
          outstandingClaimAmount += Math.max(0, c.amountClaimed - c.amountRecovered);
        }
      }
    });

    return {
      claimsFiled,
      pendingClaims,
      approvedClaims,
      reimbursementReceived: Math.round(reimbursementReceived * 100) / 100,
      outstandingClaimAmount: Math.round(outstandingClaimAmount * 100) / 100,
    };
  }, [currentDataset.claims]);

  const settlementSummary = useMemo<SettlementSummary>(() => {
    let totalDeductions = 0;
    currentDataset.settlements.forEach((s) => {
      s.deductions.forEach((d) => {
        totalDeductions += d.amount;
      });
      totalDeductions += s.tcsTdsTax || 0;
    });

    const expectedSettlement = Math.round(
      (profitability.grossSales - profitability.marketplaceCharges - profitability.shippingLogisticsCosts) * 100
    ) / 100;

    return {
      expectedSettlement,
      actualReceived: profitability.actualSettlementsReceived,
      pendingSettlement: profitability.outstandingSettlementEstimated,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
    };
  }, [currentDataset.settlements, profitability]);

  // Actions
  const addOrder = useCallback((order: Order) => {
    let assignedId = order.id;
    setOrders((prev) => {
      let uniqueId = order.id;
      if (prev.some((o) => o.id === uniqueId)) {
        uniqueId = `${order.id}_dup_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
      }
      assignedId = uniqueId;
      const normalizedOrder: Order = {
        ...order,
        id: uniqueId,
        status: order.status || "DELIVERED",
      };
      return [normalizedOrder, ...prev];
    });

    // Inventory Engine: Sale = inventory - quantity
    setProducts((prev) =>
      prev.map((p) => {
        const item = order.items.find((i) => i.sku === p.sku);
        if (item) {
          return {
            ...p,
            stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - item.quantity),
          };
        }
        return p;
      })
    );

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: assignedId,
      fieldName: "status",
      oldValue: "N/A",
      newValue: order.status,
      modifiedBy: "Operator (Manual/Import)",
      reason: "Order created in system and stock deducted",
    };
    setAuditLogs((prev) => [log, ...prev]);

    // Persist to multi-tenant backend PostgreSQL
    if (typeof window !== "undefined") {
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orders: [{ ...order, id: assignedId }] }),
      }).catch((e) => console.warn("[PlatformStore] Async order persistence deferred:", e));
    }
  }, []);

  const syncExternalOrders = useCallback(async (incomingOrders: Order[]) => {
    if (!incomingOrders.length) return { added: 0, updated: 0 };
    const owner = verifiedOwner.current;
    if (!owner) throw new Error("Authentication required to synchronize records.");
    const response = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ orders: incomingOrders }),
    });
    const saved = await response.json();
    if (!response.ok || saved.success !== true) throw new Error("Records could not be saved. Please retry.");
    if (verifiedOwner.current !== owner) throw new Error("Account changed during synchronization.");
    const canonicalIncoming = incomingOrders.map((order, index) => ({ ...order, id: saved.orderIds?.[index] || order.id }));
    const result = mergeOrders(liveLedger.current.orders, canonicalIncoming);
    const { added: addedCount, updated: updatedCount } = result;
    liveLedger.current = { ...liveLedger.current, orders: result.rows };
    setOrders(result.rows);

    if (addedCount > 0 || updatedCount > 0) {
      const log: FinancialAuditLog = {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        entityType: "ORDER",
        entityId: `SYNC-${Date.now()}`,
        fieldName: "status",
        oldValue: "N/A",
        newValue: "SYNCED",
        modifiedBy: "Channel Integration",
        reason: `Orders synchronized: ${addedCount} added, ${updatedCount} updated`,
      };
      setAuditLogs((prev) => [log, ...prev]);
    }


    return { added: addedCount, updated: updatedCount };
  }, [orders]);

  const updateOrderStatus = useCallback((orderId: string, status: Order["status"]) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const log: FinancialAuditLog = {
            id: `AUD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            entityType: "ORDER",
            entityId: orderId,
            fieldName: "status",
            oldValue: o.status,
            newValue: status,
            modifiedBy: "Operator",
            reason: `Order transitioned to ${status}`,
          };
          setAuditLogs((p) => [log, ...p]);
          return { ...o, status };
        }
        return o;
      })
    );
  }, []);

  const updateOrder = useCallback((updatedOrder: Order) => {
    setOrders((prev) => {
      const oldOrder = prev.find((o) => o.id === updatedOrder.id);
      if (oldOrder) {
        // State-aware Inventory Delta: adjust inventory based on delta of ordered quantities
        setProducts((pList) =>
          pList.map((p) => {
            const oldItem = oldOrder.items.find((i) => i.sku === p.sku);
            const newItem = updatedOrder.items.find((i) => i.sku === p.sku);
            const oldQty = oldItem ? oldItem.quantity : 0;
            const newQty = newItem ? newItem.quantity : 0;
            const delta = newQty - oldQty;
            if (delta !== 0) {
              // If newQty > oldQty, additional stock sold (-delta). If newQty < oldQty, stock restored.
              return {
                ...p,
                stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - delta),
              };
            }
            return p;
          })
        );
      }
      return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
    });

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: updatedOrder.id,
      fieldName: "all",
      oldValue: "Previous state",
      newValue: `Updated: ${updatedOrder.marketplace}, ${updatedOrder.items[0]?.productName || ""}`,
      modifiedBy: "Operator",
      reason: "Order manually edited with delta recalculation",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteOrder = useCallback((orderId: string) => {
    void archiveSelection("orders", [orderId]);
  }, [archiveSelection]);

  const deleteOrders = useCallback((orderIds: string[]) => {
    void archiveSelection("orders", orderIds);
  }, [archiveSelection]);

  const bulkUpdateOrderStatus = useCallback((orderIds: string[], status: Order["status"]) => {
    const idSet = new Set(orderIds);
    setOrders((prev) =>
      prev.map((o) => (idSet.has(o.id) ? { ...o, status } : o))
    );
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: orderIds.slice(0, 3).join(", ") + (orderIds.length > 3 ? "..." : ""),
      fieldName: "status",
      oldValue: "Various",
      newValue: status,
      modifiedBy: "Operator",
      reason: `Bulk updated ${orderIds.length} orders to ${status}`,
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const calculateClaimDeadline = (marketplace: Marketplace, returnDateStr: string): string => {
    const returnDate = new Date(returnDateStr);
    let daysToAdd = 30;
    if (marketplace === "Flipkart") daysToAdd = 14;
    else if (marketplace === "Meesho") daysToAdd = 7;
    const deadline = new Date(returnDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return deadline.toISOString().split("T")[0];
  };

  const addReturn = useCallback((returnRecord: ReturnRecord) => {
    const isDamaged =
      returnRecord.condition === "DAMAGED" ||
      returnRecord.condition === "UNUSABLE" ||
      returnRecord.condition === "MISSING" ||
      returnRecord.returnType === "DAMAGED_RETURN";

    const effectiveReturnFee =
      returnRecord.returnType === "RTO" ? 0 : (returnRecord.customerReturnFee ?? 0);
    const effectiveLossAmount =
      (returnRecord.returnType === "RTO" && !isDamaged) ? 0 : returnRecord.lossAmount;

    let claimIdToLink = returnRecord.claimId;
    if (!claimIdToLink && (isDamaged || returnRecord.returnType === "LOST_RETURN")) {
      claimIdToLink = `CLM-${Date.now().toString().slice(-4)}`;
    }

    const enrichedRecord: ReturnRecord = {
      ...returnRecord,
      receivedDate: returnRecord.receivedDate || returnRecord.returnDate,
      claimDeadline:
        returnRecord.claimDeadline ||
        calculateClaimDeadline(returnRecord.marketplace, returnRecord.returnDate),
      restockStatus:
        returnRecord.restockStatus ||
        (!isDamaged ? "RESTOCKED" : "WRITTEN_OFF"),
      customerReturnFee: effectiveReturnFee,
      lossAmount: effectiveLossAmount,
      claimId: claimIdToLink,
    };

    setReturns((prev) => [enrichedRecord, ...prev]);

    // Inventory Engine:
    // Good/Undamaged return with RESTOCKED status = inventory + quantity
    // If PENDING_RESTOCK, inventory will be incremented when restockReturn is called to avoid double-counting
    if (!isDamaged && enrichedRecord.restockStatus === "RESTOCKED") {
      setProducts((prev) =>
        prev.map((p) =>
          p.sku === enrichedRecord.sku
            ? { ...p, stockQuantity: (p.stockQuantity ?? 0) + enrichedRecord.quantity }
            : p
        )
      );
    }

    // Auto-create Claim if damaged/lost and no claim exists
    if (isDamaged || enrichedRecord.returnType === "LOST_RETURN") {
      setClaims((prev) => {
        const existingClaim = prev.find(
          (c) => c.orderId === enrichedRecord.orderId || c.returnId === enrichedRecord.id
        );
        if (!existingClaim) {
          const autoClaim: Claim = {
            id: claimIdToLink || `CLM-${Date.now().toString().slice(-4)}`,
            orderId: enrichedRecord.orderId,
            returnId: enrichedRecord.id,
            marketplace: enrichedRecord.marketplace,
            claimType: enrichedRecord.returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
            claimDate: enrichedRecord.returnDate,
            amountClaimed: enrichedRecord.lossAmount,
            amountRecovered: enrichedRecord.inventoryRecoveryValue || 0,
            status: "FILED",
            notes: `Auto-generated claim from return (${enrichedRecord.condition})`,
          };
          return [autoClaim, ...prev];
        }
        return prev;
      });
    }

    // Link return to order and update line-item returned quantity & order status
    setOrders((prev) =>
      prev.map((o) => {
        if (
          o.id === enrichedRecord.orderId ||
          (enrichedRecord.channelOrderId && o.channelOrderId === enrichedRecord.channelOrderId)
        ) {
          const currentReturns = o.returnIds || [];
          let remainingReturned = enrichedRecord.quantity;
          const updatedItems = o.items.map((item) => {
            if (item.sku === enrichedRecord.sku) {
              const applied = Math.min(remainingReturned, Math.max(0, item.quantity - (item.returnedQuantity || 0)));
              remainingReturned -= applied;
              return {
                ...item,
                returnedQuantity: (item.returnedQuantity || 0) + applied,
              };
            }
            return item;
          });

          // Point 8: Automatic order status transition
          const newStatus: Order["status"] =
            updatedItems.reduce((sum, item) => sum + (item.returnedQuantity || 0), 0) < updatedItems.reduce((sum, item) => sum + item.quantity, 0)
              ? "PARTIALLY_RETURNED"
              : enrichedRecord.returnType === "RTO"
              ? "RTO"
              : isDamaged
              ? "CLAIM_PENDING"
              : "CUSTOMER_RETURN";

          return {
            ...o,
            items: updatedItems,
            status: newStatus,
            returnIds: Array.from(new Set([...currentReturns, enrichedRecord.id])),
          };
        }
        return o;
      })
    );

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: enrichedRecord.id,
      fieldName: "reverse_logistics",
      oldValue: "None",
      newValue: `${enrichedRecord.returnType} (${enrichedRecord.condition}) - Return Fee ₹${enrichedRecord.customerReturnFee}`,
      modifiedBy: "Operator",
      reason: `Logged return for ${enrichedRecord.sku} (${enrichedRecord.marketplace})`,
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const updateReturn = useCallback((updated: ReturnRecord) => {
    setReturns((prev) => {
      const oldReturn = prev.find((r) => r.id === updated.id);
      if (oldReturn) {
        const oldIsDamaged =
          oldReturn.condition === "DAMAGED" ||
          oldReturn.condition === "UNUSABLE" ||
          oldReturn.condition === "MISSING";
        const newIsDamaged =
          updated.condition === "DAMAGED" ||
          updated.condition === "UNUSABLE" ||
          updated.condition === "MISSING";

        // CRITICAL STATE-AWARE EDIT RULE:
        // Good Return -> Damaged Return: Remove previous inventory addition
        // Damaged Return -> Good Return: Add product back into inventory
        if (!oldIsDamaged && newIsDamaged) {
          // Was Good, now Damaged: undo the stock addition!
          setProducts((pList) =>
            pList.map((p) =>
              p.sku === updated.sku
                ? { ...p, stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - oldReturn.quantity) }
                : p
            )
          );
          // Enable claim tracking if none exists
          setClaims((cList) => {
            const hasClaim = cList.some((c) => c.returnId === updated.id || c.orderId === updated.orderId);
            if (!hasClaim) {
              const newClaim: Claim = {
                id: `CLM-${Date.now().toString().slice(-4)}`,
                orderId: updated.orderId,
                returnId: updated.id,
                marketplace: updated.marketplace,
                claimType: updated.returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE",
                claimDate: updated.returnDate,
                amountClaimed: updated.lossAmount,
                amountRecovered: updated.inventoryRecoveryValue || 0,
                status: "FILED",
                notes: `Claim enabled after return updated to ${updated.condition}`,
              };
              return [newClaim, ...cList];
            }
            return cList;
          });
        } else if (oldIsDamaged && !newIsDamaged) {
          // Was Damaged, now Good: add to stock!
          setProducts((pList) =>
            pList.map((p) =>
              p.sku === updated.sku
                ? { ...p, stockQuantity: (p.stockQuantity ?? 0) + updated.quantity }
                : p
            )
          );
          // Disable / close linked claim if it was draft/filed
          setClaims((cList) =>
            cList.map((c) =>
              c.returnId === updated.id && (c.status === "FILED" || c.status === "NOT_FILED" || c.status === "UNDER_REVIEW")
                ? { ...c, status: "CLOSED" as const, notes: "Auto-closed: return marked SELLABLE/GOOD" }
                : c
            )
          );
        } else if (!newIsDamaged && oldReturn.quantity !== updated.quantity) {
          // Remained Good, but quantity changed: apply delta
          const delta = updated.quantity - oldReturn.quantity;
          setProducts((pList) =>
            pList.map((p) =>
              p.sku === updated.sku
                ? { ...p, stockQuantity: Math.max(0, (p.stockQuantity ?? 0) + delta) }
                : p
            )
          );
        }
      }
      return prev.map((r) => (r.id === updated.id ? updated : r));
    });

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: updated.id,
      fieldName: "return_update",
      oldValue: "Previous state",
      newValue: `${updated.condition}, Qty: ${updated.quantity}, Fee: ₹${updated.customerReturnFee}`,
      modifiedBy: "Operator",
      reason: "Return state updated with delta recalculation",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const restockReturn = useCallback((returnId: string) => {
    let restockedSku = "";
    let restockedQty = 0;

    setReturns((prev) =>
      prev.map((r) => {
        if (r.id === returnId) {
          restockedSku = r.sku;
          restockedQty = r.quantity;
          return {
            ...r,
            condition: "SELLABLE",
            restockStatus: "RESTOCKED",
          };
        }
        return r;
      })
    );

    if (restockedSku && restockedQty > 0) {
      setProducts((prev) =>
        prev.map((p) =>
          p.sku === restockedSku
            ? { ...p, stockQuantity: (p.stockQuantity ?? 0) + restockedQty }
            : p
        )
      );
    }

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: returnId,
      fieldName: "restockStatus",
      oldValue: "PENDING_RESTOCK",
      newValue: "RESTOCKED",
      modifiedBy: "Warehouse Operator",
      reason: "Item inspected and put away back to active sellable inventory",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteReturn = useCallback((returnId: string) => {
    void archiveSelection("returns", [returnId]);
  }, [archiveSelection]);

  const addClaim = useCallback((claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
    if (claim.returnId) {
      setReturns((prevReturns) =>
        prevReturns.map((r) =>
          r.id === claim.returnId ? { ...r, claimId: claim.id } : r
        )
      );
    }
  }, []);

  const updateClaim = useCallback((claimId: string, recoveredAmount: number, status: Claim["status"]) => {
    let linkedReturnId: string | undefined;

    setClaims((prev) =>
      prev.map((c) => {
        if (c.id === claimId) {
          linkedReturnId = c.returnId;
          const log: FinancialAuditLog = {
            id: `AUD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            entityType: "CLAIM",
            entityId: claimId,
            fieldName: "amountRecovered",
            oldValue: `₹${c.amountRecovered}`,
            newValue: `₹${recoveredAmount}`,
            modifiedBy: "Finance/Claims Lead",
            reason: `Claim resolution status: ${status}`,
          };
          setAuditLogs((p) => [log, ...p]);
          // Point 10: Damaged Return -> Claim Order Status synchronization
          const newOrderStatus: Order["status"] =
            status === "APPROVED" || status === "RECOVERED" || status === "PARTIALLY_RECOVERED"
              ? "CLAIM_APPROVED"
              : status === "REJECTED"
              ? "DAMAGED_RETURN"
              : "CLAIM_PENDING";

          if (c.orderId) {
            setOrders((oList) =>
              oList.map((o) =>
                o.id === c.orderId || (o.channelOrderId && o.channelOrderId === c.orderId)
                  ? { ...o, status: newOrderStatus }
                  : o
              )
            );
          }

          return {
            ...c,
            amountRecovered: recoveredAmount,
            status,
            recoveryDate: new Date().toISOString().split("T")[0],
          };
        }
        return c;
      })
    );

    // Keep linked return synchronized with claimId
    setReturns((prevReturns) =>
      prevReturns.map((r) => {
        if (r.claimId === claimId || (linkedReturnId && r.id === linkedReturnId)) {
          return {
            ...r,
            claimId,
          };
        }
        return r;
      })
    );
  }, []);

  const deleteClaim = useCallback((claimId: string) => {
    void archiveSelection("claims", [claimId]);
  }, [archiveSelection]);

  const editClaim = useCallback((
    claimId: string,
    updates: Partial<Pick<Claim, "claimType" | "claimDate" | "amountClaimed" | "amountRecovered" | "status" | "notes" | "marketplace">>
  ) => {
    setClaims((prev) =>
      prev.map((c) => {
        if (c.id !== claimId) return c;
        return { ...c, ...updates };
      })
    );
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "CLAIM",
      entityId: claimId,
      fieldName: "details",
      oldValue: "Previous values",
      newValue: JSON.stringify(updates),
      modifiedBy: "Operator",
      reason: "Claim details edited",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteClaims = useCallback((claimIds: string[]) => {
    void archiveSelection("claims", claimIds);
  }, [archiveSelection]);

  const updateProductCost = useCallback((sku: string, newCost: number, reason: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.sku === sku) {
          const oldCost = p.currentCostPrice;
          const today = new Date().toISOString().split("T")[0];

          // Close previous active cost window
          const updatedHistory = p.costHistory.map((h) =>
            !h.validTo ? { ...h, validTo: today } : h
          );
          // Add new cost period
          updatedHistory.push({
            validFrom: today,
            costPrice: newCost,
            notes: reason,
          });

          const log: FinancialAuditLog = {
            id: `AUD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            entityType: "PRODUCT_COST",
            entityId: sku,
            fieldName: "currentCostPrice",
            oldValue: `₹${oldCost}`,
            newValue: `₹${newCost}`,
            modifiedBy: "Purchasing Manager",
            reason,
          };
          setAuditLogs((pLog) => [log, ...pLog]);

          return {
            ...p,
            currentCostPrice: newCost,
            costHistory: updatedHistory,
          };
        }
        return p;
      })
    );
  }, []);

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [product, ...prev]);
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: product.sku,
      fieldName: "all",
      oldValue: "None",
      newValue: `Created Product: ${product.sku} - ${product.name}`,
      modifiedBy: "Operator",
      reason: "New catalog product created",
    };
    setAuditLogs((prev) => [log, ...prev]);

    // Persist to multi-tenant backend PostgreSQL
    if (typeof window !== "undefined") {
      fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ product }),
      }).catch((e) => console.warn("[PlatformStore] Async product persistence deferred:", e));
    }
  }, []);

  const deleteProduct = useCallback((sku: string) => {
    void archiveSelection("products", products.filter(product => product.sku === sku).map(product => product.id));
  }, [archiveSelection, products]);

  const addSettlement = useCallback((settlement: Settlement) => {
    setSettlements((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.marketplace === settlement.marketplace && s.id === settlement.id
      );
      if (existingIdx >= 0) {
        return prev.map((s, idx) => (idx === existingIdx ? settlement : s));
      }
      return [settlement, ...prev];
    });

    // Persist to multi-tenant backend PostgreSQL
    if (typeof window !== "undefined") {
      fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ settlements: [settlement] }),
      }).catch((e) => console.warn("[PlatformStore] Async settlement persistence deferred:", e));
    }
  }, []);

  const syncExternalSettlements = useCallback(async (incomingSettlements: Settlement[]) => {
    if (!incomingSettlements.length) return { added: 0, updated: 0 };
    const owner = verifiedOwner.current;
    if (!owner) throw new Error("Authentication required to synchronize records.");
    const response = await fetch("/api/settlements", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ settlements: incomingSettlements }),
    });
    const saved = await response.json();
    if (!response.ok || saved.success !== true) throw new Error("Records could not be saved. Please retry.");
    if (verifiedOwner.current !== owner) throw new Error("Account changed during synchronization.");
    const canonicalIncoming = incomingSettlements.map((settlement, index) => ({ ...settlement, id: saved.settlementIds?.[index] || settlement.id }));
    const result = mergeSettlements(liveLedger.current.settlements, canonicalIncoming);
    const { added: addedCount, updated: updatedCount } = result;
    liveLedger.current = { ...liveLedger.current, settlements: result.rows };
    setSettlements(result.rows);

    if (addedCount > 0 || updatedCount > 0) {
      const log: FinancialAuditLog = {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        entityType: "SETTLEMENT",
        entityId: `SYNC-SET-${Date.now()}`,
        fieldName: "netSettlement",
        oldValue: "N/A",
        newValue: "SYNCED",
        modifiedBy: "Channel Integration",
        reason: `Settlements synchronized: ${addedCount} added, ${updatedCount} updated`,
      };
      setAuditLogs((prev) => [log, ...prev]);
    }


    return { added: addedCount, updated: updatedCount };
  }, [settlements]);

  const addExpense = useCallback((expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const updateExpense = useCallback((updatedExpense: Expense) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
    );
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "EXPENSE" as any,
      entityId: updatedExpense.id,
      fieldName: "all",
      oldValue: "Previous state",
      newValue: `Updated: ${updatedExpense.description} (₹${updatedExpense.amount})`,
      modifiedBy: "Operator",
      reason: "Operating expense details modified",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteExpense = useCallback((expenseId: string) => {
    void archiveSelection("expenses", [expenseId]);
  }, [archiveSelection]);

  const deleteExpenses = useCallback((expenseIds: string[]) => {
    void archiveSelection("expenses", expenseIds);
  }, [archiveSelection]);

  const addPurchase = useCallback((purchase: PurchaseBill) => {
    if (postedPurchases.current.has(purchase.id) || purchases.some(bill => bill.id === purchase.id)) return;
    if (!Number.isSafeInteger(purchase.quantity) || purchase.quantity <= 0 || !Number.isFinite(purchase.unitCost) || purchase.unitCost < 0 ||
        !Number.isFinite(purchase.totalAmount) || purchase.totalAmount < 0 || !products.some(product => product.sku === purchase.sku)) {
      throw new Error("Purchase requires a catalog item and valid quantity and amounts.");
    }
    postedPurchases.current.add(purchase.id);
    const paidAmount = purchase.paidAmount ?? (purchase.paymentStatus === "PAID" ? purchase.totalAmount : 0);
    setPurchases(previous => [{ ...purchase, paidAmount }, ...previous]);
    setProducts(previous => previous.map(product => product.sku === purchase.sku ? {
      ...product, stockQuantity: (product.stockQuantity || 0) + purchase.quantity,
    } : product));
    if (paidAmount > 0) setSuppliers(previous => previous.map(supplier => supplier.id === purchase.supplierId ? {
      ...supplier, totalPaid: Math.round(((supplier.totalPaid || 0) + paidAmount) * 100) / 100,
    } : supplier));
  }, [purchases, products]);
  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliers((prev) => [supplier, ...prev]);
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "SUPPLIER" as any,
      entityId: supplier.id,
      fieldName: "all",
      oldValue: "None",
      newValue: `Created: ${supplier.name}`,
      modifiedBy: "Operator",
      reason: "New wholesale supplier configured",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const updateSupplier = useCallback((supplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? supplier : s))
    );
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "SUPPLIER" as any,
      entityId: supplier.id,
      fieldName: "all",
      oldValue: "Previous state",
      newValue: `Updated: ${supplier.name}`,
      modifiedBy: "Operator",
      reason: "Supplier details modified",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteSupplier = useCallback((supplierId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "SUPPLIER" as any,
      entityId: supplierId,
      fieldName: "status",
      oldValue: "Active",
      newValue: "DELETED",
      modifiedBy: "Operator",
      reason: "Supplier removed from directory",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const recordSupplierPayment = useCallback((
    supplierId: string,
    amount: number,
    paymentMethod: string,
    ref: string,
    notes?: string
  ) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment must be a positive amount.");
    // Validate legacy partial allocations before committing either side of the payment.
    allocateSupplierPayment(purchases, supplierId, amount);
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === supplierId) {
          const currentTotal = s.totalPaid || 0;
          return {
            ...s,
            totalPaid: currentTotal + amount,
          };
        }
        return s;
      })
    );

    // Reconcile remaining invoice balances oldest-first; retain allocated amounts.
    setPurchases(previous => allocateSupplierPayment(previous, supplierId, amount));

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "SUPPLIER_PAYOUT" as any,
      entityId: supplierId,
      fieldName: "totalPaid",
      oldValue: "Prior",
      newValue: `Paid: ₹${amount} via ${paymentMethod} (${ref})`,
      modifiedBy: "Finance/Operator",
      reason: notes || "Supplier balance payout recorded",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, [purchases]);

  const updateStagedDocumentField = useCallback((
    docId: string,
    field: keyof AIStagedDocument["extractedData"],
    val: any
  ) => {
    setAiDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          const currentField = doc.extractedData[field];
          const updatedExtracted = {
            ...doc.extractedData,
            [field]: {
              ...currentField,
              value: val,
              provenance: "MANUALLY_MODIFIED" as const,
            },
          };

          // Recalculate arithmetic invariant
          const qty = field === "quantity" ? Number(val) : doc.extractedData.quantity?.value;
          const price = field === "unitPrice" ? Number(val) : doc.extractedData.unitPrice?.value;
          const discount = field === "discount" ? Number(val) : (doc.extractedData.discount?.value || 0);
          const tax = field === "taxAmount" ? Number(val) : (doc.extractedData.taxAmount?.value || 0);
          const total = field === "totalAmount" ? Number(val) : doc.extractedData.totalAmount?.value;

          const arithmeticValidation = validateDocumentArithmetic(qty, price, discount, tax, total);

          return {
            ...doc,
            extractedData: updatedExtracted,
            arithmeticValidation,
          };
        }
        return doc;
      })
    );
  }, []);

  const addStagedDocument = useCallback((doc: AIStagedDocument) => {
    setAiDocuments((prev) => [doc, ...prev]);

    // Audit log for document ingestion
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "DOCUMENT",
      entityId: doc.id,
      fieldName: "status",
      oldValue: "EXTERNAL_FILE",
      newValue: "STAGED_NEEDS_REVIEW",
      modifiedBy: "OCR Ingestion Engine",
      reason: `Uploaded bill ${doc.fileName} ingested and quarantined for review`,
      sourceDocumentId: doc.fileName,
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const addStagedDocuments = useCallback((docs: AIStagedDocument[]) => {
    if (docs.length === 0) return;
    setAiDocuments((prev) => [...docs, ...prev]);

    const newLogs: FinancialAuditLog[] = docs.map((doc, idx) => ({
      id: `AUD-${Date.now()}-${idx}`,
      timestamp: new Date().toISOString(),
      entityType: "DOCUMENT",
      entityId: doc.id,
      fieldName: "status",
      oldValue: "EXTERNAL_FILE",
      newValue: "STAGED_NEEDS_REVIEW",
      modifiedBy: "Batch Ingestion Engine",
      reason: `Uploaded document ${doc.fileName} ingested and queued for review`,
      sourceDocumentId: doc.fileName,
    }));
    setAuditLogs((prev) => [...newLogs, ...prev]);
  }, []);

  const approveStagedDocument = useCallback((docId: string) => {
    setAiDocuments((prevDocs) => {
      const doc = prevDocs.find((d) => d.id === docId);
      if (!doc) return prevDocs;

      // Convert staged document into an Order if it's an Invoice
      if (doc.fileType === "INVOICE" && doc.extractedData.orderId?.value) {
        const orderId = `ORD-${Date.now().toString().slice(-4)}`;
        const newOrder: Order = {
          id: orderId,
          channelOrderId: doc.extractedData.orderId.value,
          marketplace: doc.extractedData.marketplace?.value || "Personal Website",
          orderDate: doc.extractedData.orderDate?.value || new Date().toISOString().split("T")[0],
          status: "CONFIRMED",
          customerName: "Extracted Customer",
          customerCity: "Mumbai",
          customerState: "Maharashtra",
          shippingFeeCharged: 0,
          marketplaceChargesEstimate: Math.round(Number(doc.extractedData.totalAmount?.value || 0) * 0.15),
          items: [
            {
              id: `ITEM-${Date.now().toString().slice(-3)}`,
              sku: doc.extractedData.sku?.value || "ELEC-WEM-01",
              productName: doc.extractedData.productName?.value || "Extracted Item",
              quantity: Number(doc.extractedData.quantity?.value || 1),
              sellingPrice: Number(doc.extractedData.unitPrice?.value || 0),
              discount: Number(doc.extractedData.discount?.value || 0),
              taxAmount: Number(doc.extractedData.taxAmount?.value || 0),
              snapshotUnitCost: 380, // Snapshot preserved
              returnedQuantity: 0,
            },
          ],
          documentIds: [doc.id],
        };
        setOrders((prev) => [newOrder, ...prev]);
      }

      // Convert staged document into a PurchaseBill if it's a Supplier Bill
      if (doc.fileType === "SUPPLIER_BILL") {
        const purchaseId = `PUR-${Date.now().toString().slice(-4)}`;
        const unitCost = Number(doc.extractedData.unitPrice?.value || 0);
        const sku = doc.extractedData.sku?.value || "ELEC-WEM-01";
        const newPurchase: PurchaseBill = {
          id: purchaseId,
          supplierId: "SUP-001",
          supplierName: "Apex Components Ltd",
          invoiceNumber: doc.extractedData.invoiceNumber?.value || `BILL-${Date.now()}`,
          invoiceDate: doc.extractedData.orderDate?.value || new Date().toISOString().split("T")[0],
          sku: sku,
          quantity: Number(doc.extractedData.quantity?.value || 1),
          unitCost: unitCost,
          taxes: Number(doc.extractedData.taxAmount?.value || 0),
          totalAmount: Number(doc.extractedData.totalAmount?.value || 0),
          paymentStatus: "PAID",
          documentUrl: doc.fileName,
        };
        setPurchases((prev) => [newPurchase, ...prev]);

        // If unitCost is positive, update product historical cost basis
        if (unitCost > 0) {
          updateProductCost(sku, unitCost, `Supplier Bill Approved (${doc.fileName})`);
        }
      }

      // Audit log
      const log: FinancialAuditLog = {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        entityType: doc.fileType === "SUPPLIER_BILL" ? "PURCHASE" : "ORDER",
        entityId: doc.extractedData.invoiceNumber?.value || doc.id,
        fieldName: "status",
        oldValue: "STAGED_AI_EXTRACTION",
        newValue: "COMMITTED_TO_LEDGER",
        modifiedBy: "Human Reviewer (Operator)",
        reason: "Confirmed AI extraction fields and passed invariant check",
        sourceDocumentId: doc.fileName,
      };
      setAuditLogs((prev) => [log, ...prev]);

      return prevDocs.map((d) => (d.id === docId ? { ...d, status: "APPROVED_POSTED" as const } : d));
    });
  }, [updateProductCost]);

  const rejectStagedDocument = useCallback((docId: string) => {
    setAiDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: "REJECTED" as const } : d))
    );
  }, []);

  const batchApproveStagedDocuments = useCallback(
    (docIds: string[]) => {
      docIds.forEach((id) => approveStagedDocument(id));
    },
    [approveStagedDocument]
  );

  const deleteStagedDocument = useCallback((docId: string) => {
    setAiDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const resetLedgerToDefaults = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        if (verifiedOwner.current) localStorage.removeItem(tenantLedgerKey(verifiedOwner.current));
      }
    } catch (e) {
      console.error("Failed to clear persistent ledger:", e);
    }
    setProducts([]);
    setOrders([]);
    setReturns([]);
    setSettlements([]);
    setClaims([]);
    setSuppliers([]);
    setPurchases([]);
    setExpenses([]);
    setAiDocuments([]);
    setAuditLogs([]);
    setComplaints([]);
    setAcknowledgedLossLeaderSkus([]);
    setDatePreset("ALL");
    setCustomDateRange(null);
  }, []);

  const exportLedgerSnapshot = useCallback((): string => {
    const snapshot = {
      version: 1,
      ownerId: verifiedOwner.current,
      exportedAt: new Date().toISOString(),
      data: {
        products,
        orders,
        returns,
        settlements,
        claims,
        suppliers,
        purchases,
        expenses,
        aiDocuments,
        auditLogs,
        complaints,
        acknowledgedLossLeaderSkus,
      },
    };
    return JSON.stringify(snapshot, null, 2);
  }, [
    products,
    orders,
    returns,
    settlements,
    claims,
    suppliers,
    purchases,
    expenses,
    aiDocuments,
    auditLogs,
    complaints,
    acknowledgedLossLeaderSkus,
  ]);

  const importLedgerSnapshot = useCallback((jsonString: string): boolean => {
    try {
      if (!verifiedOwner.current) return false;
      const data = parseLedgerSnapshot(jsonString, verifiedOwner.current);
      if (!data) return false;
      setProducts(data.products);
      setOrders(data.orders);
      setReturns(data.returns);
      setSettlements(data.settlements);
      setClaims(data.claims);
      setSuppliers(data.suppliers);
      setPurchases(data.purchases);
      setExpenses(data.expenses);
      setAiDocuments(data.aiDocuments);
      setAuditLogs(data.auditLogs);
      setComplaints(data.complaints);
      setAcknowledgedLossLeaderSkus(data.acknowledgedLossLeaderSkus);
      return true;
    } catch (e) {
      console.error("Failed to parse imported ledger snapshot:", e);
      return false;
    }
  }, []);

  const toggleLossLeaderAcknowledgment = useCallback((sku: string) => {
    setAcknowledgedLossLeaderSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  }, []);

  const bulkAddProducts = useCallback((newProducts: Product[]) => {
    setProducts((prev) => {
      const existingSkuMap = new Map(prev.map((p) => [p.sku.toUpperCase(), p]));
      const updated = [...prev];
      newProducts.forEach((np) => {
        const key = np.sku.toUpperCase();
        if (existingSkuMap.has(key)) {
          const idx = updated.findIndex((p) => p.sku.toUpperCase() === key);
          if (idx !== -1) updated[idx] = { ...updated[idx], ...np };
        } else {
          updated.unshift(np);
        }
      });
      return updated;
    });

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: `BULK-${newProducts.length}`,
      fieldName: "all",
      oldValue: "None",
      newValue: `Bulk imported ${newProducts.length} catalog products with MFN identifiers`,
      modifiedBy: "Operator",
      reason: "Bulk catalog SKU ingestion",
    };
    setAuditLogs((prev) => [log, ...prev]);

    // Persist to multi-tenant backend PostgreSQL
    if (typeof window !== "undefined" && newProducts.length > 0) {
      fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ products: newProducts }),
      }).catch((e) => console.warn("[PlatformStore] Async bulk products persistence deferred:", e));
    }
  }, []);

  const addComplaint = useCallback((complaint: CustomerComplaint) => {
    setComplaints((prev) => [complaint, ...prev]);
  }, []);

  const updateComplaintStatus = useCallback(
    (ticketId: string, status: CustomerComplaint["status"], resolutionNotes?: string) => {
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === ticketId
            ? {
                ...c,
                status,
                ...(status === "RESOLVED" || status === "CLOSED"
                  ? {
                      resolvedAt: new Date().toISOString(),
                      resolutionNotes: resolutionNotes || c.resolutionNotes || "Issue marked resolved",
                    }
                  : {}),
              }
            : c
        )
      );
    },
    []
  );

  const deleteComplaint = useCallback((ticketId: string) => {
    setComplaints((prev) => prev.filter((c) => c.id !== ticketId));
  }, []);

  const switchAccountType = useCallback((role: AccountType, supplierId?: string) => {
    const matching = DEFAULT_ACCOUNTS.find((a) => a.accountType === role) || {
      id: `ACC-${Date.now()}`,
      name: role === "SUPPLIER" ? "Wholesale Supplier" : role === "WHOLESALER" ? "B2B Wholesaler" : "Brand Owner",
      email: `${role.toLowerCase()}@marginflow.io`,
      accountType: role,
      companyName: role === "SUPPLIER" ? "Apex Electronics Mfg Ltd" : role === "WHOLESALER" ? "Metro B2B Wholesalers" : "VoltTech Consumer Electronics",
      supplierId: supplierId || (role === "SUPPLIER" ? "SUP-001" : undefined),
      authenticatedAt: new Date().toISOString(),
    };
    setCurrentUser(matching);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("marginflow_session", JSON.stringify(matching));
      }
    } catch {}
  }, []);

  const contextValue = useMemo(
    () => ({
      products,
      orders,
      returns,
      settlements,
      claims,
      suppliers,
      purchases,
      expenses,
      aiDocuments,
      auditLogs,
      complaints,
      currentUser,
      setCurrentUser,
      switchAccountType,
      isHydrated,
      isSyncingWithDb,
      refreshFromDatabase,
      resetLedgerToDefaults,
      reportDataset: currentDataset,
      exportLedgerSnapshot,
      importLedgerSnapshot,
      restoreArchivedRecord,
      selectedMarketplace,
      setSelectedMarketplace,
      datePreset,
      setDatePreset,
      customDateRange,
      setCustomDateRange,
      profitability,
      priorProfitability,
      profitabilityTrends,
      marketplaceBreakdown,
      skuBreakdown,
      acknowledgedLossLeaderSkus,
      toggleLossLeaderAcknowledgment,
      settlementAging,
      guardrailStatus,
      inventoryMetrics,
      feesBreakdown,
      claimsSummary,
      settlementSummary,
      addOrder,
      syncExternalOrders,
      updateOrder,
      deleteOrder,
      deleteOrders,
      updateOrderStatus,
      bulkUpdateOrderStatus,
      addReturn,
      updateReturn,
      restockReturn,
      deleteReturn,
      addClaim,
      updateClaim,
      editClaim,
      deleteClaim,
      deleteClaims,
      addProduct,
      bulkAddProducts,
      deleteProduct,
      updateProductCost,
      addComplaint,
      updateComplaintStatus,
      deleteComplaint,
      addSettlement,
      syncExternalSettlements,
      addExpense,
      updateExpense,
      deleteExpense,
      deleteExpenses,
      addPurchase,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierPayment,
      addStagedDocument,
      addStagedDocuments,
      updateStagedDocumentField,
      approveStagedDocument,
      batchApproveStagedDocuments,
      rejectStagedDocument,
      deleteStagedDocument,
    }),
    [
      currentDataset,
      products,
      orders,
      returns,
      settlements,
      claims,
      suppliers,
      purchases,
      expenses,
      aiDocuments,
      auditLogs,
      complaints,
      currentUser,
      setCurrentUser,
      switchAccountType,
      isHydrated,
      isSyncingWithDb,
      refreshFromDatabase,
      resetLedgerToDefaults,
      exportLedgerSnapshot,
      importLedgerSnapshot,
      selectedMarketplace,
      datePreset,
      customDateRange,
      profitability,
      priorProfitability,
      profitabilityTrends,
      marketplaceBreakdown,
      skuBreakdown,
      acknowledgedLossLeaderSkus,
      toggleLossLeaderAcknowledgment,
      settlementAging,
      guardrailStatus,
      inventoryMetrics,
      feesBreakdown,
      claimsSummary,
      settlementSummary,
      addOrder,
      syncExternalOrders,
      updateOrder,
      deleteOrder,
      deleteOrders,
      updateOrderStatus,
      bulkUpdateOrderStatus,
      addReturn,
      updateReturn,
      restockReturn,
      deleteReturn,
      addClaim,
      updateClaim,
      editClaim,
      deleteClaim,
      deleteClaims,
      addProduct,
      bulkAddProducts,
      deleteProduct,
      updateProductCost,
      addComplaint,
      updateComplaintStatus,
      deleteComplaint,
      addSettlement,
      syncExternalSettlements,
      addExpense,
      updateExpense,
      deleteExpense,
      deleteExpenses,
      addPurchase,
      addSupplier,
      updateSupplier,
      deleteSupplier,
      recordSupplierPayment,
      addStagedDocument,
      addStagedDocuments,
      updateStagedDocumentField,
      approveStagedDocument,
      batchApproveStagedDocuments,
      rejectStagedDocument,
      deleteStagedDocument,
    ]
  );

  return (
    <PlatformContext.Provider value={contextValue}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used within a PlatformProvider");
  }
  return context;
}
