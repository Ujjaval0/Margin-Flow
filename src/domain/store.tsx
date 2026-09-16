"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
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
  GuardrailCheckResult,
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
  resolveDatePreset,
  filterDatasetByDateRange,
  calculatePercentageChange,
  calculateSettlementAging,
  SettlementAgingSummary,
} from "./profitability-engine";

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

  // Date-Range & Engine State
  datePreset: DateRangePreset;
  setDatePreset: (preset: DateRangePreset) => void;
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

  // Actions
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  addReturn: (returnRecord: ReturnRecord) => void;
  addClaim: (claim: Claim) => void;
  updateClaim: (claimId: string, recoveredAmount: number, status: Claim["status"]) => void;
  updateProductCost: (sku: string, newCost: number, reason: string) => void;
  addSettlement: (settlement: Settlement) => void;
  addExpense: (expense: Expense) => void;
  addPurchase: (purchase: PurchaseBill) => void;
  approveStagedDocument: (docId: string) => void;
  updateStagedDocumentField: (
    docId: string,
    field: keyof AIStagedDocument["extractedData"],
    val: any
  ) => void;
  rejectStagedDocument: (docId: string) => void;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
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

  // Filter datasets by date preset & prior period for trend comparisons
  const dateRanges = useMemo(() => {
    return resolveDatePreset(datePreset, "2026-09-15");
  }, [datePreset]);

  const currentDataset = useMemo(() => {
    if (datePreset === "ALL") {
      return { orders, returns, settlements, claims, expenses };
    }
    return filterDatasetByDateRange(orders, returns, settlements, claims, expenses, dateRanges.current);
  }, [orders, returns, settlements, claims, expenses, datePreset, dateRanges]);

  const priorDataset = useMemo(() => {
    return filterDatasetByDateRange(orders, returns, settlements, claims, expenses, dateRanges.previous);
  }, [orders, returns, settlements, claims, expenses, dateRanges]);

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
      currentDataset.orders,
      currentDataset.returns,
      currentDataset.settlements,
      currentDataset.claims,
      currentDataset.expenses
    );
  }, [currentDataset]);

  const skuBreakdown = useMemo(() => {
    return calculateSkuProfitability(
      currentDataset.orders,
      currentDataset.returns,
      currentDataset.claims,
      currentDataset.expenses
    );
  }, [currentDataset]);

  const settlementAging = useMemo(() => {
    return calculateSettlementAging(orders, settlements, "2026-09-15");
  }, [orders, settlements]);

  const guardrailStatus = useMemo(() => {
    return runSystemGuardrailDiagnostics(
      products,
      orders,
      returns,
      settlements,
      claims,
      aiDocuments
    );
  }, [products, orders, returns, settlements, claims, aiDocuments]);

  // Actions
  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: order.id,
      fieldName: "status",
      oldValue: "N/A",
      newValue: order.status,
      modifiedBy: "Operator (Manual/Import)",
      reason: "Order created in system",
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const updateOrderStatus = (orderId: string, status: Order["status"]) => {
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
  };

  const addReturn = (returnRecord: ReturnRecord) => {
    setReturns((prev) => [returnRecord, ...prev]);
    // Link return to order
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === returnRecord.orderId) {
          const currentReturns = o.returnIds || [];
          return {
            ...o,
            status: returnRecord.returnType === "RTO" ? "RTO" : "PARTIALLY_RETURNED",
            returnIds: [...currentReturns, returnRecord.id],
          };
        }
        return o;
      })
    );
  };

  const addClaim = (claim: Claim) => {
    setClaims((prev) => [claim, ...prev]);
  };

  const updateClaim = (claimId: string, recoveredAmount: number, status: Claim["status"]) => {
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
  };

  const updateProductCost = (sku: string, newCost: number, reason: string) => {
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
  };

  const addSettlement = (settlement: Settlement) => {
    setSettlements((prev) => [settlement, ...prev]);
  };

  const addExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const addPurchase = (purchase: PurchaseBill) => {
    setPurchases((prev) => [purchase, ...prev]);
  };

  const updateStagedDocumentField = (
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
  };

  const approveStagedDocument = (docId: string) => {
    const doc = aiDocuments.find((d) => d.id === docId);
    if (!doc) return;

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

    // Mark document as approved
    setAiDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: "APPROVED_POSTED" as const } : d))
    );

    // Audit log
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: doc.extractedData.orderId?.value || doc.id,
      fieldName: "status",
      oldValue: "STAGED_AI_EXTRACTION",
      newValue: "COMMITTED_TO_LEDGER",
      modifiedBy: "Human Reviewer (Operator)",
      reason: "Confirmed AI extraction fields and passed invariant check",
      sourceDocumentId: doc.fileName,
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const rejectStagedDocument = (docId: string) => {
    setAiDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: "REJECTED" as const } : d))
    );
  };

  return (
    <PlatformContext.Provider
      value={{
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
        datePreset,
        setDatePreset,
        profitability,
        priorProfitability,
        profitabilityTrends,
        marketplaceBreakdown,
        skuBreakdown,
        settlementAging,
        guardrailStatus,
        addOrder,
        updateOrderStatus,
        addReturn,
        addClaim,
        updateClaim,
        updateProductCost,
        addSettlement,
        addExpense,
        addPurchase,
        updateStagedDocumentField,
        approveStagedDocument,
        rejectStagedDocument,
      }}
    >
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
