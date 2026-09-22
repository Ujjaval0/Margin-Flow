"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
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

export const LEDGER_STORAGE_KEY = "MARGINFLOW_PERSISTENT_LEDGER_V2";

interface PlatformContextType {
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
  settlementAging: SettlementAgingSummary;
  guardrailStatus: GuardrailCheckResult[];
  inventoryMetrics: InventoryMetrics;
  feesBreakdown: FeesBreakdown;
  claimsSummary: ClaimsSummary;
  settlementSummary: SettlementSummary;

  // Persistent Ledger Management
  isHydrated: boolean;
  resetLedgerToDefaults: () => void;
  exportLedgerSnapshot: () => string;
  importLedgerSnapshot: (jsonString: string) => boolean;

  // Actions
  addOrder: (order: Order) => void;
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
  updateProductCost: (sku: string, newCost: number, reason: string) => void;
  addSettlement: (settlement: Settlement) => void;
  addExpense: (expense: Expense) => void;
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
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [returns, setReturns] = useState<ReturnRecord[]>(INITIAL_RETURNS);
  const [settlements, setSettlements] = useState<Settlement[]>(INITIAL_SETTLEMENTS);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [purchases, setPurchases] = useState<PurchaseBill[]>(INITIAL_PURCHASES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [aiDocuments, setAiDocuments] = useState<AIStagedDocument[]>(INITIAL_AI_DOCUMENTS);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("ALL");
  const [customDateRange, setCustomDateRange] = useState<DateFilterRange | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | "ALL">("ALL");

  // Rehydrate persistent ledger from localStorage on client mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(LEDGER_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.data) {
            if (Array.isArray(parsed.data.products)) setProducts(parsed.data.products);
            if (Array.isArray(parsed.data.orders)) setOrders(parsed.data.orders);
            if (Array.isArray(parsed.data.returns)) setReturns(parsed.data.returns);
            if (Array.isArray(parsed.data.settlements)) setSettlements(parsed.data.settlements);
            if (Array.isArray(parsed.data.claims)) setClaims(parsed.data.claims);
            if (Array.isArray(parsed.data.suppliers)) setSuppliers(parsed.data.suppliers);
            if (Array.isArray(parsed.data.purchases)) setPurchases(parsed.data.purchases);
            if (Array.isArray(parsed.data.expenses)) setExpenses(parsed.data.expenses);
            if (Array.isArray(parsed.data.aiDocuments)) setAiDocuments(parsed.data.aiDocuments);
            if (Array.isArray(parsed.data.auditLogs)) setAuditLogs(parsed.data.auditLogs);
          }
        }
      }
    } catch (e) {
      console.error("Failed to rehydrate persistent ledger from storage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Debounced synchronization of state mutations to local ledger storage (prevents UI thread freezing)
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          const snapshot = {
            version: 1,
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
            },
          };
          const serialized = JSON.stringify(snapshot);
          if ("requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
              try {
                localStorage.setItem(LEDGER_STORAGE_KEY, serialized);
              } catch (err) {
                console.error("Failed to save ledger to localStorage:", err);
              }
            });
          } else {
            localStorage.setItem(LEDGER_STORAGE_KEY, serialized);
          }
        }
      } catch (e) {
        console.error("Failed to synchronize persistent ledger to storage:", e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
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
  ]);

  // Derive dynamic anchor date from latest order in dataset
  const effectiveAnchorDate = useMemo(() => {
    if (orders.length === 0) return "2026-09-07";
    return orders.reduce((max, o) => (o.orderDate > max ? o.orderDate : max), orders[0].orderDate);
  }, [orders]);

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
      currentDataset.claims,
      currentDataset.expenses
    );
  }, [currentDataset]);

  const settlementAging = useMemo(() => {
    return calculateSettlementAging(currentDataset.orders, currentDataset.settlements, effectiveAnchorDate);
  }, [currentDataset.orders, currentDataset.settlements, effectiveAnchorDate]);

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
    setOrders((prev) => [order, ...prev]);

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
      entityId: order.id,
      fieldName: "status",
      oldValue: "N/A",
      newValue: order.status,
      modifiedBy: "Operator (Manual/Import)",
      reason: "Order created in system and stock deducted",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

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
    setOrders((prev) => {
      const orderToDelete = prev.find((o) => o.id === orderId);
      if (orderToDelete) {
        // Restore inventory for items sold in this order that were not returned
        setProducts((pList) =>
          pList.map((p) => {
            const item = orderToDelete.items.find((i) => i.sku === p.sku);
            if (item) {
              const activeSoldQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
              return {
                ...p,
                stockQuantity: (p.stockQuantity ?? 0) + activeSoldQty,
              };
            }
            return p;
          })
        );
      }
      return prev.filter((o) => o.id !== orderId);
    });
    setReturns((prev) => prev.filter((r) => r.orderId !== orderId));
    setSettlements((prev) => prev.filter((s) => s.orderId !== orderId));
    setClaims((prev) => prev.filter((c) => c.orderId !== orderId));
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: orderId,
      fieldName: "status",
      oldValue: "Active",
      newValue: "DELETED",
      modifiedBy: "Operator",
      reason: "Order deleted and associated inventory restored",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const deleteOrders = useCallback((orderIds: string[]) => {
    const idSet = new Set(orderIds);
    setOrders((prev) => prev.filter((o) => !idSet.has(o.id)));
    setReturns((prev) => prev.filter((r) => !idSet.has(r.orderId)));
    setSettlements((prev) => prev.filter((s) => !idSet.has(s.orderId)));
    setClaims((prev) => prev.filter((c) => !idSet.has(c.orderId)));
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: orderIds.slice(0, 3).join(", ") + (orderIds.length > 3 ? "..." : ""),
      fieldName: "bulk_deletion",
      oldValue: `${orderIds.length} orders`,
      newValue: "DELETED",
      modifiedBy: "Operator",
      reason: `Bulk deleted ${orderIds.length} orders from ledger`,
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

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
      returnRecord.condition === "MISSING";

    const effectiveReturnFee =
      returnRecord.returnType === "RTO" ? 0 : (returnRecord.customerReturnFee ?? 0);

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
    };

    setReturns((prev) => [enrichedRecord, ...prev]);

    // Inventory Engine:
    // Good/Undamaged return = inventory + quantity
    // Damaged return = no inventory addition (written off)
    if (!isDamaged) {
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
            id: `CLM-${Date.now().toString().slice(-4)}`,
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
          const updatedItems = o.items.map((item) => {
            if (item.sku === enrichedRecord.sku) {
              return {
                ...item,
                returnedQuantity: (item.returnedQuantity || 0) + enrichedRecord.quantity,
              };
            }
            return item;
          });

          const totalOrdered = updatedItems.reduce((acc, it) => acc + it.quantity, 0);
          const totalReturned = updatedItems.reduce((acc, it) => acc + (it.returnedQuantity || 0), 0);
          const newStatus =
            enrichedRecord.returnType === "RTO"
              ? "RTO"
              : totalReturned >= totalOrdered
              ? "RETURNED"
              : "PARTIALLY_RETURNED";

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
    setReturns((prevReturns) => {
      const returnToDelete = prevReturns.find((r) => r.id === returnId);
      if (returnToDelete) {
        setOrders((prevOrders) =>
          prevOrders.map((o) => {
            if (
              o.id === returnToDelete.orderId ||
              (returnToDelete.channelOrderId && o.channelOrderId === returnToDelete.channelOrderId)
            ) {
              const updatedReturnIds = o.returnIds?.filter((id) => id !== returnId) || [];
              const updatedItems = o.items.map((item) => {
                if (item.sku === returnToDelete.sku) {
                  return {
                    ...item,
                    returnedQuantity: Math.max(0, (item.returnedQuantity || 0) - returnToDelete.quantity),
                  };
                }
                return item;
              });
              const totalReturned = updatedItems.reduce((acc, it) => acc + (it.returnedQuantity || 0), 0);
              const totalOrdered = updatedItems.reduce((acc, it) => acc + it.quantity, 0);

              let newStatus = o.status;
              if (updatedReturnIds.length === 0 || totalReturned === 0) {
                newStatus = "DELIVERED";
              } else if (totalReturned < totalOrdered) {
                newStatus = "PARTIALLY_RETURNED";
              }

              return {
                ...o,
                status: newStatus,
                items: updatedItems,
                returnIds: updatedReturnIds,
              };
            }
            return o;
          })
        );
      }
      return prevReturns.filter((r) => r.id !== returnId);
    });

    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: returnId,
      fieldName: "status",
      oldValue: "Active",
      newValue: "DELETED",
      modifiedBy: "Operator",
      reason: "Return record deleted",
    };
    setAuditLogs((prev) => [log, ...prev]);
  }, []);

  const addClaim = useCallback((claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
  }, []);

  const updateClaim = useCallback((claimId: string, recoveredAmount: number, status: Claim["status"]) => {
    setClaims((prev) =>
      prev.map((c) => {
        if (c.id === claimId) {
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
  }, []);

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

  const addSettlement = useCallback((settlement: Settlement) => {
    setSettlements((prev) => [settlement, ...prev]);
  }, []);

  const addExpense = useCallback((expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const addPurchase = useCallback((purchase: PurchaseBill) => {
    setPurchases((prev) => [purchase, ...prev]);
  }, []);

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

    // Reconcile open purchase bills for this supplier FIFO
    setPurchases((prev) => {
      let remainingPayment = amount;
      return prev.map((bill) => {
        if (
          bill.supplierId === supplierId &&
          bill.paymentStatus !== "PAID" &&
          remainingPayment > 0
        ) {
          if (remainingPayment >= bill.totalAmount) {
            remainingPayment -= bill.totalAmount;
            return { ...bill, paymentStatus: "PAID" as const };
          } else {
            remainingPayment = 0;
            return { ...bill, paymentStatus: "PARTIAL" as const };
          }
        }
        return bill;
      });
    });

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
  }, []);

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
        localStorage.removeItem(LEDGER_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to clear persistent ledger:", e);
    }
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setReturns(INITIAL_RETURNS);
    setSettlements(INITIAL_SETTLEMENTS);
    setClaims(INITIAL_CLAIMS);
    setSuppliers(INITIAL_SUPPLIERS);
    setPurchases(INITIAL_PURCHASES);
    setExpenses(INITIAL_EXPENSES);
    setAiDocuments(INITIAL_AI_DOCUMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setDatePreset("ALL");
    setCustomDateRange(null);
  }, []);

  const exportLedgerSnapshot = useCallback((): string => {
    const snapshot = {
      version: 1,
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
  ]);

  const importLedgerSnapshot = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed?.data || parsed;
      if (!data || typeof data !== "object") return false;

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
      return true;
    } catch (e) {
      console.error("Failed to parse imported ledger snapshot:", e);
      return false;
    }
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
      isHydrated,
      resetLedgerToDefaults,
      exportLedgerSnapshot,
      importLedgerSnapshot,
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
      settlementAging,
      guardrailStatus,
      inventoryMetrics,
      feesBreakdown,
      claimsSummary,
      settlementSummary,
      addOrder,
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
      updateProductCost,
      addSettlement,
      addExpense,
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
      isHydrated,
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
      settlementAging,
      guardrailStatus,
      inventoryMetrics,
      feesBreakdown,
      claimsSummary,
      settlementSummary,
      addOrder,
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
      updateProductCost,
      addSettlement,
      addExpense,
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
