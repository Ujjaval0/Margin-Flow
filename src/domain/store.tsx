"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
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
  const [customDateRange, setCustomDateRange] = useState<DateFilterRange | null>(null);

  // Derive dynamic anchor date from latest order in dataset
  const effectiveAnchorDate = useMemo(() => {
    if (orders.length === 0) return "2026-09-07";
    return orders.reduce((max, o) => (o.orderDate > max ? o.orderDate : max), orders[0].orderDate);
  }, [orders]);

  // Filter datasets by date preset & prior period for trend comparisons
  const dateRanges = useMemo(() => {
    return resolveDatePreset(datePreset, effectiveAnchorDate, customDateRange);
  }, [datePreset, effectiveAnchorDate, customDateRange]);

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
    return calculateSettlementAging(orders, settlements, effectiveAnchorDate);
  }, [orders, settlements, effectiveAnchorDate]);

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

  const updateOrder = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: updatedOrder.id,
      fieldName: "all",
      oldValue: "Previous state",
      newValue: `Updated: ${updatedOrder.marketplace}, ${updatedOrder.items[0]?.productName || ""}`,
      modifiedBy: "Operator",
      reason: "Order manually edited",
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const deleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
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
      reason: "Order deleted from ledger",
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const deleteOrders = (orderIds: string[]) => {
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
  };

  const bulkUpdateOrderStatus = (orderIds: string[], status: Order["status"]) => {
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
  };

  const calculateClaimDeadline = (marketplace: Marketplace, returnDateStr: string): string => {
    const returnDate = new Date(returnDateStr);
    let daysToAdd = 30;
    if (marketplace === "Flipkart") daysToAdd = 14;
    else if (marketplace === "Meesho") daysToAdd = 7;
    const deadline = new Date(returnDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return deadline.toISOString().split("T")[0];
  };

  const addReturn = (returnRecord: ReturnRecord) => {
    const enrichedRecord: ReturnRecord = {
      ...returnRecord,
      receivedDate: returnRecord.receivedDate || returnRecord.returnDate,
      claimDeadline:
        returnRecord.claimDeadline ||
        calculateClaimDeadline(returnRecord.marketplace, returnRecord.returnDate),
      restockStatus:
        returnRecord.restockStatus ||
        (returnRecord.condition === "SELLABLE" ? "PENDING_RESTOCK" : "WRITTEN_OFF"),
    };

    setReturns((prev) => [enrichedRecord, ...prev]);
    // Link return to order
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === enrichedRecord.orderId) {
          const currentReturns = o.returnIds || [];
          return {
            ...o,
            status: enrichedRecord.returnType === "RTO" ? "RTO" : "PARTIALLY_RETURNED",
            returnIds: [...currentReturns, enrichedRecord.id],
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
      newValue: `${enrichedRecord.returnType} (${enrichedRecord.condition}) - Loss ₹${enrichedRecord.lossAmount}`,
      modifiedBy: "Operator",
      reason: `Logged return for ${enrichedRecord.sku} (${enrichedRecord.marketplace})`,
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const updateReturn = (updated: ReturnRecord) => {
    setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    const log: FinancialAuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      entityType: "ORDER",
      entityId: updated.id,
      fieldName: "return_update",
      oldValue: "Previous state",
      newValue: `${updated.condition}, Qty: ${updated.quantity}, Loss: ₹${updated.lossAmount}`,
      modifiedBy: "Operator",
      reason: "Return record updated",
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const restockReturn = (returnId: string) => {
    setReturns((prev) =>
      prev.map((r) => {
        if (r.id === returnId) {
          return {
            ...r,
            condition: "SELLABLE",
            restockStatus: "RESTOCKED",
          };
        }
        return r;
      })
    );
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
  };

  const deleteReturn = (returnId: string) => {
    setReturns((prev) => prev.filter((r) => r.id !== returnId));
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        returnIds: o.returnIds?.filter((id) => id !== returnId),
      }))
    );
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

  const addSupplier = (supplier: Supplier) => {
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
  };

  const updateSupplier = (supplier: Supplier) => {
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
  };

  const deleteSupplier = (supplierId: string) => {
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
  };

  const recordSupplierPayment = (
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

  const addStagedDocument = (doc: AIStagedDocument) => {
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

    // Mark document as approved
    setAiDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: "APPROVED_POSTED" as const } : d))
    );

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
        customDateRange,
        setCustomDateRange,
        profitability,
        priorProfitability,
        profitabilityTrends,
        marketplaceBreakdown,
        skuBreakdown,
        settlementAging,
        guardrailStatus,
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
