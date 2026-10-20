"use client";
import { documentArithmetic } from "./document-arithmetic";
import { getSettlementWithholding } from "./accounting-policy";
import { claimRecoveryEvents } from "./claim-recovery";


import { money, sumMoney, getOrderFinancialFacts } from "@/domain/order-financials";
import { createRecordId } from "./record-id";
import { scheduleIdleTask } from "@/lib/browser-tasks";
import { loadFinancialPages } from "./load-financial-pages";
import type { LedgerCommand, OperatingCollection } from "./ledger-command";
import { calculatePeriodProfitability,periodMarketplace,periodSku } from './financial-period';


import { archiveRecords, applyArchivePatch, RecycleType } from "./recycle-bin";
import type { LedgerData } from "./snapshot-validation";
import { mergeOrders, mergeSettlements } from "./sync-merge";
import { parseLedgerSnapshot } from "./snapshot-validation";
import { businessDate } from "./report-scope";
import { allocateSupplierPayment, createSupplierPayment } from "./purchase-accounting";

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
  SupplierPayment,
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
} from "./types";
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
  reportDataset: { orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; expenses: Expense[];
    financialContext?:{ orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; expenses: Expense[] };reportRange?:DateFilterRange };
  products: Product[];
  orders: Order[];
  returns: ReturnRecord[];
  settlements: Settlement[];
  claims: Claim[];
  suppliers: Supplier[];
  purchases: PurchaseBill[];
  supplierPayments: SupplierPayment[];
  expenses: Expense[];
  aiDocuments: AIStagedDocument[];
  auditLogs: FinancialAuditLog[];
  complaints: CustomerComplaint[];
  currentUser: UserAccount;
  verifiedOwnerId: string | null;
  setCurrentUser: (user: UserAccount) => void;

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
  importLedgerSnapshot: (jsonString: string) => Promise<boolean>;
  restoreArchivedRecord: (id: string) => Promise<void>;

  // Actions
  addOrder: (order: Order) => Promise<Order>;
  syncExternalOrders: (incomingOrders: Order[]) => Promise<{ added: number; updated: number }>;
  updateOrder: (order: Order) => Promise<Order>;
  deleteOrder: (orderId: string) => Promise<void>;
  deleteOrders: (orderIds: string[]) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
  bulkUpdateOrderStatus: (orderIds: string[], status: Order["status"]) => Promise<void>;
  addReturn: (returnRecord: ReturnRecord) => Promise<void>;
  updateReturn: (returnRecord: ReturnRecord) => Promise<void>;
  restockReturn: (returnId: string) => Promise<void>;
  deleteReturn: (returnId: string) => Promise<void>;
  addClaim: (claim: Claim) => Promise<void>;
  updateClaim: (claimId: string, recoveredAmount: number, status: Claim["status"], recoveryDate?:string, recoveryId?:string) => Promise<void>;
  editClaim: (claimId: string, updates: Partial<Pick<Claim, "claimType" | "claimDate" | "amountClaimed" | "amountRecovered" | "status" | "notes" | "marketplace">>) => Promise<void>;
  deleteClaim: (claimId: string) => Promise<void>;
  deleteClaims: (claimIds: string[]) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  bulkAddProducts: (products: Product[]) => Promise<void>;
  deleteProduct: (sku: string) => Promise<void>;
  updateProductCost: (sku: string, newCost: number, reason: string) => Promise<void>;
  addComplaint: (complaint: CustomerComplaint) => Promise<void>;
  updateComplaintStatus: (ticketId: string, status: CustomerComplaint["status"], resolutionNotes?: string) => Promise<void>;
  deleteComplaint: (ticketId: string) => Promise<void>;
  addSettlement: (settlement: Settlement) => Promise<void>;
  syncExternalSettlements: (incomingSettlements: Settlement[]) => Promise<{ added: number; updated: number }>;
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  deleteExpenses: (expenseIds: string[]) => Promise<void>;
  addPurchase: (purchase: PurchaseBill) => Promise<void>;
  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  recordSupplierPayment: (
    supplierId: string,
    amount: number,
    paymentMethod: string,
    ref: string,
    notes?: string,
    date?: string,
    paymentId?: string
  ) => Promise<void>;
  addStagedDocument: (doc: AIStagedDocument) => Promise<void>;
  addStagedDocuments: (docs: AIStagedDocument[]) => Promise<void>;
  approveStagedDocument: (docId: string) => Promise<void>;
  batchApproveStagedDocuments: (docIds: string[]) => Promise<void>;
  updateStagedDocumentField: (
    docId: string,
    field: keyof AIStagedDocument["extractedData"] | "currency" | "pricesIncludeTax",
    val: any
  ) => Promise<void>;
  rejectStagedDocument: (docId: string) => Promise<void>;
  deleteStagedDocument: (docId: string) => Promise<void>;
}

const PlatformContext = createContext<PlatformContextType | null>(null);
const EMPTY_USER: UserAccount = { id: "", name: "", email: "", accountType: "BRAND_OWNER", companyName: "", authenticatedAt: "" };

// Compatibility mirror for existing onboarding readers; never an identity authority.
function mirrorVerifiedProfile(user: UserAccount | null) {
  try {
    if (!user) localStorage.removeItem("marginflow_session");
    else {
      const value = JSON.stringify(user);
      if (localStorage.getItem("marginflow_session") !== value) localStorage.setItem("marginflow_session", value);
    }
  } catch { /* Storage may be disabled; the verified in-memory session still works. */ }
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [financialRevision,setFinancialRevision]=useState(0);
  const [financialIssues,setFinancialIssues]=useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseBill[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aiDocuments, setAiDocuments] = useState<AIStagedDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [complaints, setComplaints] = useState<CustomerComplaint[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount>(EMPTY_USER);
  const [acknowledgedLossLeaderSkus, setAcknowledgedLossLeaderSkus] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("ALL");
  const [customDateRange, setCustomDateRange] = useState<DateFilterRange | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | "ALL">("ALL");

  const verifiedOwner = useRef<string | null>(null);
  const refreshGeneration = useRef(0);
  const postedPurchases = useRef(new Set<string>());
  const restockedReturnIds = useRef(new Set<string>());
  const [cacheOwner, setCacheOwner] = useState<string | null>(null);

  const liveLedger = useRef<LedgerData>({ products, orders, returns, settlements, claims, suppliers, purchases, supplierPayments, expenses, aiDocuments, auditLogs, complaints, acknowledgedLossLeaderSkus });
  liveLedger.current = { financialRevision,financialIssues, products, orders, returns, settlements, claims, suppliers, purchases, supplierPayments, expenses, aiDocuments, auditLogs, complaints, acknowledgedLossLeaderSkus };
  const archiveBusy = useRef(false);
  const applyLedgerChange = useCallback((data: LedgerData) => {
    if((data.financialRevision||0)<(liveLedger.current.financialRevision||0))return;
    setFinancialRevision(data.financialRevision||0);liveLedger.current = data;setFinancialIssues(data.financialIssues||[]);
    setProducts(data.products); setOrders(data.orders); setReturns(data.returns);
    setSettlements(data.settlements); setClaims(data.claims); setExpenses(data.expenses);
    setSuppliers(data.suppliers);setPurchases(data.purchases);setSupplierPayments(data.supplierPayments||[]);
    setAiDocuments(data.aiDocuments);setAuditLogs(data.auditLogs);setComplaints(data.complaints);
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
    } catch (error) { throw error; }
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
    setCurrentUser(EMPTY_USER);
    setFinancialRevision(0);setFinancialIssues([]);postedPurchases.current.clear();
    setProducts([]); setOrders([]); setReturns([]); setSettlements([]);
    setClaims([]); setSuppliers([]); setPurchases([]); setSupplierPayments([]); setExpenses([]);
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
        mirrorVerifiedProfile(null);
        return;
      }
      const meData = await meRes.json();
      if (generation !== refreshGeneration.current) return;
      const ownerId = meData?.user?.id;
      if (typeof ownerId !== "string" || !ownerId) {
        verifiedOwner.current = null; setCacheOwner(null); clearTenantData();
        mirrorVerifiedProfile(null);
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
          setSupplierPayments(data.supplierPayments || []);
          if (Array.isArray(data.expenses)) setExpenses(data.expenses);
          if (Array.isArray(data.aiDocuments)) setAiDocuments(data.aiDocuments);
          if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
          if (Array.isArray(data.complaints)) setComplaints(data.complaints);
          if (Array.isArray(data.acknowledgedLossLeaderSkus)) setAcknowledgedLossLeaderSkus(data.acknowledgedLossLeaderSkus);
        }
      }
      const verifiedProfile: UserAccount = { ...EMPTY_USER, ...meData.user };
      setCurrentUser(previous => JSON.stringify(previous) === JSON.stringify(verifiedProfile) ? previous : verifiedProfile);
      mirrorVerifiedProfile(verifiedProfile);
      const ledgerResponse=await fetch('/api/ledger-records',{credentials:'same-origin',cache:'no-store'});
      if(!ledgerResponse.ok) throw Error('Ledger synchronization unavailable.');
      const ledgerJson=await ledgerResponse.json();
      if (generation !== refreshGeneration.current || verifiedOwner.current !== ownerId) return;
      if (!ledgerJson.success || !ledgerJson.data || !Array.isArray(ledgerJson.data.orders)) {
        throw new Error("Invalid ledger response.");
      }
      // Empty authoritative responses must remove stale cached rows too.
      const cached=readTenantSnapshot(localStorage,ownerId);
      const pending=['suppliers','purchases','supplierPayments','returns','claims','expenses','aiDocuments','complaints'] as const;
      if(cached && pending.some(key=>(cached[key]||[]).some((row:{id:string})=>!(ledgerJson.data[key]||[]).some((saved:{id:string})=>saved.id===row.id)))) {
        const pendingKey=tenantLedgerKey(ownerId)+':pending-migration';
        if(!localStorage.getItem(pendingKey)) localStorage.setItem(pendingKey,JSON.stringify({version:1,ownerId,data:cached}));
      }
      if(localStorage.getItem(tenantLedgerKey(ownerId)+':pending-migration'))ledgerJson.data.financialIssues=[...(ledgerJson.data.financialIssues||[]),'Local-only recovery snapshot preserved; reconcile it before treating these books as complete.'];
      applyLedgerChange(ledgerJson.data);

    } catch {
      if (generation === refreshGeneration.current) {
        // Fail closed if identity has not been confirmed; never hydrate the unowned legacy cache.
        if (!identityConfirmed) { verifiedOwner.current = null; setCacheOwner(null); clearTenantData(); mirrorVerifiedProfile(null); }
        else setFinancialIssues(previous=>Array.from(new Set([...previous,'Server synchronization unavailable; displayed books may be stale.'])));
        console.warn("[PlatformStore] Ledger synchronization unavailable.");
      }
    } finally {
      if (generation === refreshGeneration.current) { setIsSyncingWithDb(false); setIsHydrated(true); }
    }
  }, [clearTenantData,applyLedgerChange]);

  useEffect(() => {
    let backgroundRefresh: Promise<void> | null = null;
    const onFocus = () => {
      // Mount, focus and restored-page events can arrive together. Share only
      // background work; explicit saves and session changes still force a fresh read.
      if (backgroundRefresh) return;
      backgroundRefresh = refreshFromDatabase().finally(() => { backgroundRefresh = null; });
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onFocus(); };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      const key = event.key;
      if (key === null || key === "marginflow_session" || /^sb-.*-auth-token(?:\.\d+)?$/.test(key)) {
        void refreshFromDatabase();
      } else if (verifiedOwner.current && key === tenantLedgerKey(verifiedOwner.current)) {
        onFocus();
      }
    };
    const onSessionChanged = () => {
      verifiedOwner.current = null; setCacheOwner(null); clearTenantData();
      void refreshFromDatabase();
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    window.addEventListener("marginflow:session-changed", onSessionChanged);
    return () => {
      ++refreshGeneration.current;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("marginflow:session-changed", onSessionChanged);
    };
  }, [refreshFromDatabase, clearTenantData]);
  // Debounced synchronization of state mutations to local ledger storage (prevents UI thread freezing)
  useEffect(() => {
    if (!isHydrated || !cacheOwner || verifiedOwner.current !== cacheOwner) return;
    const ownerId = cacheOwner;
    const storageKey = tenantLedgerKey(ownerId);
    let cancelIdleTask: (() => void) | undefined;
    const timer = setTimeout(() => {
      cancelIdleTask = scheduleIdleTask(() => {
      try {
        if (typeof window !== "undefined") {
          if (verifiedOwner.current !== ownerId) return;
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
              supplierPayments,
              expenses,
              aiDocuments,
              auditLogs,
              complaints,
              acknowledgedLossLeaderSkus,
            },
          };
          const serialized = JSON.stringify(snapshot);
          if (verifiedOwner.current === ownerId) localStorage.setItem(storageKey, serialized);
        }
      } catch (e) {
        console.error("Failed to synchronize persistent ledger to storage:", e);
      }
      });
    }, 800);

    return () => { clearTimeout(timer); cancelIdleTask?.(); };
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
    supplierPayments,
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
  const financialContext=useMemo(()=>({financialIssues,orders:orders.filter(o=>isMarketplaceMatch(o.marketplace)),returns:returns.filter(r=>isMarketplaceMatch(r.marketplace)),settlements:settlements.filter(s=>isMarketplaceMatch(s.marketplace)),claims:claims.filter(c=>isMarketplaceMatch(c.marketplace)),expenses:expenses.filter(e=>isMarketplaceMatch(e.marketplace))}),[financialIssues,orders,returns,settlements,claims,expenses,isMarketplaceMatch]);
  const profitability = useMemo(() => {
    return calculatePeriodProfitability(financialContext,datePreset==='ALL'?undefined:dateRanges.current);
  }, [financialContext,datePreset,dateRanges]);

  const priorProfitability = useMemo(() => {
    return calculatePeriodProfitability(financialContext,dateRanges.previous);
  }, [financialContext,dateRanges]);

  const profitabilityTrends = useMemo(() => {
    return {
      netSalesChange: calculatePercentageChange(profitability.netSales, priorProfitability.netSales),
      grossProfitChange: calculatePercentageChange(profitability.grossProfit, priorProfitability.grossProfit),
      contributionProfitChange: calculatePercentageChange(profitability.contributionProfit, priorProfitability.contributionProfit),
      netOperatingProfitChange: calculatePercentageChange(profitability.netOperatingProfit, priorProfitability.netOperatingProfit),
      ordersChange: calculatePercentageChange(profitability.totalOrders, priorProfitability.totalOrders),
    };
  }, [profitability, priorProfitability]);

  const marketplaceBreakdown = useMemo(()=>periodMarketplace(financialContext,datePreset==='ALL'?undefined:dateRanges.current),[financialContext,datePreset,dateRanges]);
  const skuBreakdown = useMemo(()=>periodSku(financialContext,datePreset==='ALL'?undefined:dateRanges.current),[financialContext,datePreset,dateRanges]);

  const settlementAging = useMemo(() => {
    return calculateSettlementAging(financialContext.orders, settlements, effectiveAnchorDate, returns, claims);
  }, [currentDataset.orders, settlements, returns, claims, effectiveAnchorDate]);

  const guardrailStatus = useMemo(() => {
    const checks=runSystemGuardrailDiagnostics(
      products,
      orders,
      returns,
      settlements,
      claims,
      aiDocuments,
      expenses
    );
    if(financialIssues.length)checks.push({partition:'Financial evidence',name:'Unresolved source records',status:'WARNING',details:financialIssues.join(' '),count:financialIssues.length});
    return checks;
  }, [financialIssues,products, orders, returns, settlements, claims, aiDocuments, expenses]);

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

    const isDamaged = (cond: string) => ["DAMAGED","UNUSABLE","MISSING","USED"].includes(cond);
    let goodReturnedQuantity = 0;
    let damagedReturnedQuantity = 0;
    returns.forEach((r) => {
      if (isDamaged(r.condition)) {
        damagedReturnedQuantity += r.quantity;
      } else if(r.condition==='SELLABLE' && r.restockStatus==='RESTOCKED' && r.receivedDate) {
        goodReturnedQuantity += r.quantity;
      }
    });

    const soldQuantity = orders.filter(order=>order.physicalDispatchRecorded===true).reduce((sum,order)=>sum+order.items.reduce((count,line)=>count+line.quantity,0),0);
    const openingStock = currentStock + soldQuantity - goodReturnedQuantity - purchasedQuantity;

    return {
      openingStock,
      purchasedQuantity,
      soldQuantity,
      goodReturnedQuantity,
      damagedReturnedQuantity,
      currentStock,
      inventoryValue: money(inventoryValue),
    };
  }, [products, purchases, returns, orders]);

  const feesBreakdown = useMemo<FeesBreakdown>(() => {
    return {
      platformCommission: profitability.marketplaceCharges,
      shippingLogistics: profitability.shippingLogisticsCosts,
      customerReturnFees: profitability.customerReturnFees,
      otherDeductions: Math.max(
        0,
        money((profitability.totalFees -
            (profitability.marketplaceCharges +
              profitability.shippingLogisticsCosts +
              profitability.customerReturnFees)))
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
      reimbursementReceived: profitability.claimRecoveries,
      outstandingClaimAmount: money(outstandingClaimAmount),
    };
  }, [currentDataset.claims,profitability.claimRecoveries]);

  const settlementSummary = useMemo<SettlementSummary>(() => {
    const end=datePreset==='ALL'?undefined:dateRanges.current.endDate;
    const facts=financialContext.orders.map(order=>getOrderFinancialFacts(order,financialContext.returns,financialContext.settlements,financialContext.claims,end));
    const expectedSettlement=facts.some(f=>f.revenueRecognised&&f.expectedPayout===null)?null:sumMoney(facts.map(f=>f.expectedPayout||0));
    const totalDeductions=sumMoney(currentDataset.settlements.flatMap(settlement=>[...settlement.deductions.filter(d=>d.category!=='TAX_TCS'&&d.category!=='TAX_TDS').map(d=>d.amount),getSettlementWithholding(settlement)]));
    return {expectedSettlement,actualReceived:profitability.actualSettlementsReceived,pendingSettlement:profitability.outstandingSettlementEstimated,totalDeductions};
  },[financialContext,currentDataset.settlements,profitability,datePreset,dateRanges]);

  // Actions
  const commitFinancialCommand = useCallback(async (command: LedgerCommand) => {
    const owner=verifiedOwner.current;
    if(!owner) throw Error('Authentication required to save financial records.');
    const snapshotHash=command.action==='importSnapshot'?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(command.snapshot)))).map(b=>b.toString(16).padStart(2,'0')).join(''):undefined;
    const requestId=command.action==='importSnapshot'?'IMPORT-'+snapshotHash:command.action==='save' && command.expected===undefined ? 'CREATE-'+command.collection+'-'+command.record.id
      : command.action==='paySupplier' ? command.id : createRecordId('CMD');
    const response=await fetch('/api/ledger-records',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({requestId,command})});
    const saved=await response.json();
    if(!response.ok || saved.success!==true) throw Error(saved.error||'Financial record could not be saved.');
    if(verifiedOwner.current!==owner) throw Error('Account changed while saving.');
    applyLedgerChange(saved.data);
  },[applyLedgerChange]);
  const saveOperatingRecord = useCallback(async (collection: OperatingCollection,record: any,edit=false) => {
    const expected=edit?(liveLedger.current[collection] as any[]).find(row=>row.id===record.id):undefined;
    if(edit && !expected) throw Error('Record no longer exists.');
    await commitFinancialCommand({action:'save',collection,record,expected});
  },[commitFinancialCommand]);
  const addOrder = useCallback(async (order:Order) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    if(liveLedger.current.orders.some(o=>o.marketplace===order.marketplace&&o.channelOrderId===order.channelOrderId))throw Error('Source order already exists; edit its existing record.');
    const normalized={...order,currency:'INR',physicalDispatchRecorded:['SHIPPED','DELIVERED','PARTIALLY_RETURNED','RETURNED','CUSTOMER_RETURN','DAMAGED_RETURN','RTO'].includes(order.status)};
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orders:[normalized],intent:'CREATE'})});
    const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Order could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    const saved=liveLedger.current.orders.find(o=>o.marketplace===order.marketplace&&o.channelOrderId===order.channelOrderId);if(!saved)throw Error('Order saved but refresh failed; reload before retrying.');return saved;
  },[refreshFromDatabase]);

  const syncExternalOrders = useCallback(async (incomingOrders:Order[]) => {
    if(!incomingOrders.length)return {added:0,updated:0};
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orders:incomingOrders})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Records could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    return {added:saved.inserted||0,updated:saved.updated||0};
  },[refreshFromDatabase]);

  const updateOrderStatus = useCallback(async (orderId: string,status: Order['status']) => {
    await commitFinancialCommand({action:'orderStatus',ids:[orderId],status,date:businessDate()});
  },[commitFinancialCommand]);

  const updateOrder = useCallback(async (order:Order) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orders:[order],intent:'UPDATE'})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Order could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    return liveLedger.current.orders.find(o=>o.id===order.id)||order;
  },[refreshFromDatabase]);

  const deleteOrder = useCallback(async (orderId: string) => {
    await archiveSelection("orders", [orderId]);
  }, [archiveSelection]);

  const deleteOrders = useCallback(async (orderIds: string[]) => {
    await archiveSelection("orders", orderIds);
  }, [archiveSelection]);

  const bulkUpdateOrderStatus = useCallback(async (ids:string[],status:Order['status']) => {
    await commitFinancialCommand({action:'orderStatus',ids,status,date:businessDate()});
  },[commitFinancialCommand]);

  const calculateClaimDeadline = (marketplace: Marketplace, returnDateStr: string): string => {
    const returnDate = new Date(returnDateStr);
    let daysToAdd = 30;
    if (marketplace === "Flipkart") daysToAdd = 14;
    else if (marketplace === "Meesho") daysToAdd = 7;
    const deadline = new Date(returnDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return deadline.toISOString().split("T")[0];
  };

  const addReturn = useCallback(async (record:ReturnRecord) => {
    await saveOperatingRecord('returns',record);
  },[saveOperatingRecord]);

  const updateReturn = useCallback(async (record:ReturnRecord) => {
    await saveOperatingRecord('returns',record,true);
  },[saveOperatingRecord]);

  const restockReturn = useCallback(async (id:string) => {
    await commitFinancialCommand({action:'restock',id,date:businessDate()});
  },[commitFinancialCommand]);

  const deleteReturn = useCallback(async (returnId: string) => {
    await archiveSelection("returns", [returnId]);
  }, [archiveSelection]);

  const addClaim = useCallback(async (claim:Claim) => { await saveOperatingRecord('claims',claim); },[saveOperatingRecord]);

  const updateClaim = useCallback(async (id:string,amountRecovered:number,status:Claim['status'],date?:string,recoveryId?:string) => {
    const claim=liveLedger.current.claims.find(c=>c.id===id); if(!claim) throw Error('Claim not found.');
    const delta=sumMoney([amountRecovered,-claim.amountRecovered]);if(delta<0)throw Error('Recorded recovery requires an evidenced reversal to decrease.');
    const history=claimRecoveryEvents(claim);if(claim.amountRecovered>0 && !history.length)throw Error('Reconcile the prior recovery date before recording another receipt.');
    const recoveries=delta?[...history,{id:recoveryId||'REC-'+claim.id+'-'+Math.round(amountRecovered*100),date:date||businessDate(),amount:delta}]:history;
    await saveOperatingRecord('claims',{...claim,amountRecovered,status,recoveries,recoveryDate:delta?date||businessDate():claim.recoveryDate},true);
  },[saveOperatingRecord]);

  const deleteClaim = useCallback(async (claimId: string) => {
    await archiveSelection("claims", [claimId]);
  }, [archiveSelection]);

  const editClaim = useCallback(async (id:string,updates:Partial<Pick<Claim,'claimType'|'claimDate'|'amountClaimed'|'amountRecovered'|'status'|'notes'|'marketplace'>>) => {
    const claim=liveLedger.current.claims.find(c=>c.id===id);if(!claim)throw Error('Claim not found.');
    await saveOperatingRecord('claims',{...claim,...updates},true);
  },[saveOperatingRecord]);

  const deleteClaims = useCallback(async (claimIds: string[]) => {
    await archiveSelection("claims", claimIds);
  }, [archiveSelection]);

  const updateProductCost = useCallback(async (sku:string,cost:number,reason:string) => {
    await commitFinancialCommand({action:'productCost',sku,cost,reason,date:businessDate()});
  },[commitFinancialCommand]);

  const addProduct = useCallback(async (product:Product) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({product})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Product could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
  },[refreshFromDatabase]);

  const deleteProduct = useCallback(async (sku: string) => {
    await archiveSelection("products", products.filter(product => product.sku === sku).map(product => product.id));
  }, [archiveSelection, products]);

  const addSettlement = useCallback(async (settlement:Settlement) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/settlements',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({settlements:[settlement]})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Settlement could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
  },[refreshFromDatabase]);
  const syncExternalSettlements = useCallback(async (incomingSettlements:Settlement[]) => {
    if(!incomingSettlements.length)return {added:0,updated:0};
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/settlements',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({settlements:incomingSettlements})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Records could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    return {added:saved.inserted||0,updated:saved.updated||0};
  },[refreshFromDatabase]);

  const addExpense = useCallback(async (record:Expense) => {await saveOperatingRecord('expenses',record);},[saveOperatingRecord]);

  const updateExpense = useCallback(async (record:Expense) => {await saveOperatingRecord('expenses',record,true);},[saveOperatingRecord]);

  const deleteExpense = useCallback(async (expenseId: string) => {
    await archiveSelection("expenses", [expenseId]);
  }, [archiveSelection]);

  const deleteExpenses = useCallback(async (expenseIds: string[]) => {
    await archiveSelection("expenses", expenseIds);
  }, [archiveSelection]);

  const addPurchase = useCallback(async (record:PurchaseBill) => {await saveOperatingRecord('purchases',record);},[saveOperatingRecord]);

  const addSupplier = useCallback(async (record:Supplier) => {await saveOperatingRecord('suppliers',record);},[saveOperatingRecord]);

  const updateSupplier = useCallback(async (record:Supplier) => {await saveOperatingRecord('suppliers',record,true);},[saveOperatingRecord]);

  const deleteSupplier = useCallback(async (id:string) => {await commitFinancialCommand({action:'deleteSupplier',id});},[commitFinancialCommand]);

  const recordSupplierPayment = useCallback(async (supplierId:string,amount:number,paymentMethod:string,reference:string,notes?:string,date?:string,paymentId?:string) => {
    await commitFinancialCommand({action:'paySupplier',id:paymentId||createRecordId('PAY'),supplierId,amount,paymentMethod,reference,notes,date:date||businessDate()});
  },[commitFinancialCommand]);

  const updateStagedDocumentField = useCallback(async (id:string,field:keyof AIStagedDocument['extractedData']|'currency'|'pricesIncludeTax',value:any) => {
    const doc=liveLedger.current.aiDocuments.find(d=>d.id===id);if(!doc)throw Error('Document not found.');
    if(field==='currency' || field==='pricesIncludeTax'){const updated={...doc,[field]:value};await saveOperatingRecord('aiDocuments',{...updated,arithmeticValidation:documentArithmetic(updated)},true);return;}
    if(doc.lineItems && doc.lineItems.length>1 && ['sku','productName','quantity','unitPrice','discount','taxAmount'].includes(field))throw Error('Multi-line documents require line-level correction before posting; the summary cannot replace source lines.');
    const extractedData={...doc.extractedData,[field]:{...doc.extractedData[field],value,confidence:1,provenance:'MANUALLY_MODIFIED' as const}};
    const lineKey=field==='productName'?'productName':field==='unitPrice'?'unitPrice':field;
    const lineItems=doc.lineItems?.length===1 && ['sku','productName','quantity','unitPrice','discount','taxAmount'].includes(field)?doc.lineItems.map(line=>({...line,[lineKey]:value,...(['quantity','unitPrice'].includes(field)?{lineSubtotal:undefined}:{})})):doc.lineItems;
    const updated={...doc,extractedData,lineItems};
    await saveOperatingRecord('aiDocuments',{...updated,arithmeticValidation:documentArithmetic(updated)},true);
  },[saveOperatingRecord]);

  const addStagedDocument = useCallback(async (doc:AIStagedDocument) => {
    await refreshFromDatabase();
    if(liveLedger.current.aiDocuments.some(d=>d.id===doc.id))return;
    await saveOperatingRecord('aiDocuments',doc);
  },[saveOperatingRecord,refreshFromDatabase]);

  const addStagedDocuments = useCallback(async (docs:AIStagedDocument[]) => {for(const doc of docs)await addStagedDocument(doc);},[addStagedDocument]);

  const approveStagedDocument = useCallback(async (id:string) => {await commitFinancialCommand({action:'approveDocument',id});},[commitFinancialCommand]);

  const rejectStagedDocument = useCallback(async (id:string) => {
    const doc=liveLedger.current.aiDocuments.find(d=>d.id===id);if(!doc)throw Error('Document not found.');
    await saveOperatingRecord('aiDocuments',{...doc,status:'REJECTED'},true);
  },[saveOperatingRecord]);

  const batchApproveStagedDocuments = useCallback(
    async (docIds: string[]) => {
      await Promise.all(docIds.map((id) => approveStagedDocument(id)));
    },
    [approveStagedDocument]
  );

  const deleteStagedDocument = useCallback(async (id:string) => {await rejectStagedDocument(id);},[rejectStagedDocument]);

  const resetLedgerToDefaults = useCallback(() => {
    // Reset affects cache and view preferences; committed books reload from the server.
    if(verifiedOwner.current)localStorage.removeItem(tenantLedgerKey(verifiedOwner.current));
    setDatePreset('ALL');setCustomDateRange(null);void refreshFromDatabase();
  },[refreshFromDatabase]);

  const exportLedgerSnapshot = useCallback((): string => {
    const pending=verifiedOwner.current && localStorage.getItem(tenantLedgerKey(verifiedOwner.current)+':pending-migration');
    if(pending && parseLedgerSnapshot(pending,verifiedOwner.current!))return pending;
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
        supplierPayments,
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
    supplierPayments,
    expenses,
    aiDocuments,
    auditLogs,
    complaints,
    acknowledgedLossLeaderSkus,
  ]);

  const importLedgerSnapshot = useCallback(async (jsonString:string):Promise<boolean> => {
    const owner=verifiedOwner.current;if(!owner || !parseLedgerSnapshot(jsonString,owner))return false;
    await commitFinancialCommand({action:'importSnapshot',snapshot:jsonString});
    localStorage.removeItem(tenantLedgerKey(owner)+':pending-migration');return true;
  },[commitFinancialCommand]);

  const toggleLossLeaderAcknowledgment = useCallback((sku: string) => {
    setAcknowledgedLossLeaderSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  }, []);

  const bulkAddProducts = useCallback(async (products:Product[]) => {
    if(!products.length)return;const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({products})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Catalog could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
  },[refreshFromDatabase]);

  const addComplaint = useCallback(async (complaint: CustomerComplaint) => {
    await saveOperatingRecord('complaints',complaint);
  }, [saveOperatingRecord]);

  const updateComplaintStatus = useCallback(
    async (ticketId: string, status: CustomerComplaint["status"], resolutionNotes?: string) => {
      const record=liveLedger.current.complaints.find(row=>row.id===ticketId);
      if(!record)throw Error('Complaint not found.');
      await saveOperatingRecord('complaints',{...record,status,...(['RESOLVED','CLOSED'].includes(status)
        ? {resolvedAt:new Date().toISOString(),resolutionNotes:resolutionNotes||record.resolutionNotes||'Issue marked resolved'}:{})},true);
    },
    [saveOperatingRecord]
  );

  const deleteComplaint = useCallback(async (ticketId: string) => {
    await commitFinancialCommand({action:'deleteComplaint',id:ticketId});
  }, [commitFinancialCommand]);

  const reportDataset = useMemo(() => ({
    ...currentDataset, financialContext, reportRange: datePreset === 'ALL' ? undefined : dateRanges.current,
  }), [currentDataset, financialContext, datePreset, dateRanges.current]);

  const contextValue = useMemo(
    () => ({
      products,
      orders,
      returns,
      settlements,
      claims,
      suppliers,
      purchases,
      supplierPayments,
      expenses,
      aiDocuments,
      auditLogs,
      complaints,
      currentUser,
      verifiedOwnerId: cacheOwner,
      setCurrentUser,
      isHydrated,
      isSyncingWithDb,
      refreshFromDatabase,
      resetLedgerToDefaults,
      reportDataset,
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
      reportDataset,
      products,
      orders,
      returns,
      settlements,
      claims,
      suppliers,
      purchases,
      supplierPayments,
      expenses,
      aiDocuments,
      auditLogs,
      complaints,
      currentUser,
      cacheOwner,
      setCurrentUser,
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
