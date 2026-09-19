// Core Domain Types for Unified E-Commerce Operations & Profitability Platform

export type Marketplace =
  | "Amazon India"
  | "Flipkart"
  | "Meesho"
  | "Personal Website"
  | "Myntra"
  | "WooCommerce"
  | "B2B Wholesale"
  | "Other";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RTO"
  | "RETURNED"
  | "PARTIALLY_RETURNED";

export type ReturnType =
  | "CUSTOMER_RETURN"
  | "RTO"
  | "DAMAGED_RETURN"
  | "LOST_RETURN"
  | "OTHER";

export type ProductCondition =
  | "SELLABLE"
  | "DAMAGED"
  | "USED"
  | "MISSING"
  | "UNUSABLE"
  | "UNDER_INSPECTION";

export type ClaimStatus =
  | "NOT_FILED"
  | "FILED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PARTIALLY_RECOVERED"
  | "RECOVERED"
  | "REJECTED"
  | "CLOSED";

export type DeductionCategory =
  | "COMMISSION"
  | "LOGISTICS"
  | "FIXED_FEE"
  | "COLLECTION_FEE"
  | "RETURN_SHIPPING"
  | "PENALTY"
  | "TAX_TCS"
  | "TAX_TDS"
  | "OTHER";

export type ReconciliationStatus =
  | "RECONCILED"
  | "MISMATCH_FLAGGED"
  | "PENDING_RECON";

export type ProvenanceType = "AI_EXTRACTED" | "MANUALLY_ENTERED" | "MANUALLY_MODIFIED";

export type ExpenseCategory =
  | "Advertising"
  | "Salaries"
  | "Rent"
  | "Software"
  | "Packaging"
  | "Office"
  | "Transportation"
  | "Professional Services"
  | "Utilities"
  | "Other";

// Partition 1: Product & Cost Basis
export interface HistoricalCost {
  validFrom: string; // ISO date
  validTo?: string;  // ISO date or undefined for current
  costPrice: number;
  sourcePurchaseId?: string;
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  currentCostPrice: number;
  costHistory: HistoricalCost[];
  supplierId: string;
  active: boolean;
  channelAliases: Partial<Record<Marketplace, string>>; // Maps marketplace SKU to master SKU
  stockQuantity?: number; // Physical warehouse inventory units
}

// Partition 2: Orders
export interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  sellingPrice: number; // Unit selling price
  discount: number;     // Total discount for this item
  taxAmount: number;
  snapshotUnitCost: number; // Historical cost snapshot locked at order creation time
  returnedQuantity: number;
}

export interface Order {
  id: string; // e.g. ORD-2026-1001
  channelOrderId: string; // e.g. Amazon order id: 402-1234567-8910111
  marketplace: Marketplace;
  orderDate: string;
  status: OrderStatus;
  customerName: string;
  customerCity: string;
  customerState: string;
  items: OrderItem[];
  shippingFeeCharged: number;
  marketplaceChargesEstimate: number;
  notes?: string;
  documentIds?: string[];
  settlementIds?: string[];
  returnIds?: string[];
  claimIds?: string[];
}

export type RestockStatus = "PENDING_RESTOCK" | "RESTOCKED" | "WRITTEN_OFF";

// Partition 3: Returns & RTOs
export interface ReturnRecord {
  id: string;
  orderId: string;
  channelOrderId: string;
  marketplace: Marketplace;
  returnDate: string;
  receivedDate?: string;         // Date physically received at warehouse
  awbNumber?: string;            // Forward or reverse courier AWB
  returnType: ReturnType;
  returnReason: string;
  sku: string;
  productName?: string;
  quantity: number;
  condition: ProductCondition;
  restockStatus?: RestockStatus; // Restock disposition tracking
  claimDeadline?: string;        // Marketplace SLA claim expiration date
  returnShippingCost: number;
  customerReturnFee: number;      // Marketplace return processing fee (always recorded for CUSTOMER_RETURN, never for RTO)
  otherReturnCosts: number;
  inventoryRecoveryValue: number; // e.g., scrap value or salvage value if damaged
  lossAmount: number;             // Net write-off loss
  claimId?: string;
  notes?: string;
}

// Partition 4: Settlements
export interface SettlementDeduction {
  category: DeductionCategory;
  name: string;
  amount: number;
}

export interface Settlement {
  id: string;
  settlementBatchId: string;
  marketplace: Marketplace;
  settlementDate: string;
  orderId: string;
  grossAmount: number;
  deductions: SettlementDeduction[];
  tcsTdsTax: number;
  netSettlement: number;
  reconciliationStatus: ReconciliationStatus;
  discrepancyAmount?: number;
  bankTxRef?: string;
  sourceDocument?: string;
}

// Partition 5: Claims & Recoveries
export interface Claim {
  id: string;
  orderId: string;
  returnId?: string;
  marketplace: Marketplace;
  claimType: "LOST_IN_TRANSIT" | "DAMAGED_INVOICE" | "WRONG_RETURN_ITEM" | "FEE_DISPUTE";
  claimDate: string;
  amountClaimed: number;
  amountRecovered: number;
  status: ClaimStatus;
  recoveryDate?: string;
  notes?: string;
  supportingDocuments?: string[];
}

// Partition 6: Suppliers, Purchases & Expenses
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin?: string;
  address: string;
  paymentTerms?: string;
  bankAccount?: string;
  upiId?: string;
  openingBalance?: number;
  totalPaid?: number;
  notes?: string;
}

export interface PurchaseBill {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxes: number;
  totalAmount: number;
  paymentStatus: "PAID" | "PENDING" | "PARTIAL";
  documentUrl?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor: string;
  paymentMethod: "BANK_TRANSFER" | "UPI" | "CREDIT_CARD" | "CASH";
  isRecurring: boolean;
  marketplace?: Marketplace; // Optional channel attribution (e.g. Amazon PPC or Website Meta Ads)
  attributedSku?: string;     // Optional SKU attribution
  supportingDocument?: string;
  notes?: string;
}

// Partition 7: AI Document Staging & HITL Extraction
export interface ExtractedField<T> {
  value: T;
  confidence: number; // 0.0 - 1.0
  provenance: ProvenanceType;
  sourceBoundingBox?: { x: number; y: number; width: number; height: number };
  pageNumber?: number;
  isFlaggedAnomaly?: boolean;
  anomalyMessage?: string;
}

export interface AIStagedDocument {
  id: string;
  fileName: string;
  fileType: "INVOICE" | "SHIPPING_LABEL" | "SETTLEMENT_REPORT" | "SUPPLIER_BILL" | "CLAIM_DOC";
  uploadDate: string;
  status: "STAGED_NEEDS_REVIEW" | "APPROVED_POSTED" | "REJECTED";
  rawTextPreview: string;
  extractedData: {
    marketplace?: ExtractedField<Marketplace>;
    orderId?: ExtractedField<string>;
    invoiceNumber?: ExtractedField<string>;
    orderDate?: ExtractedField<string>;
    sku?: ExtractedField<string>;
    productName?: ExtractedField<string>;
    quantity?: ExtractedField<number>;
    unitPrice?: ExtractedField<number>;
    discount?: ExtractedField<number>;
    taxAmount?: ExtractedField<number>;
    totalAmount?: ExtractedField<number>;
  };
  arithmeticValidation: {
    passed: boolean;
    calculatedTotal: number;
    declaredTotal: number;
    difference: number;
    message: string;
  };
  catalogValidation: {
    skuMatched: boolean;
    matchedSkuId?: string;
    suggestion?: string;
  };
}

// Financial Audit Trail
export interface FinancialAuditLog {
  id: string;
  timestamp: string;
  entityType: "ORDER" | "SETTLEMENT" | "PRODUCT_COST" | "CLAIM" | "RETURN" | "EXPENSE" | "DOCUMENT" | "PURCHASE";
  entityId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  reason?: string;
  sourceDocumentId?: string;
}

// Guardrail Monitor Status
export interface GuardrailCheckResult {
  partition: string;
  name: string;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  details: string;
  count?: number;
}

// Dashboard Inventory Card Metrics
export interface InventoryMetrics {
  openingStock: number;
  purchasedQuantity: number;
  soldQuantity: number;
  goodReturnedQuantity: number;
  damagedReturnedQuantity: number;
  currentStock: number;
  inventoryValue: number;
}

// Dashboard Fees Breakdown Card Metrics
export interface FeesBreakdown {
  platformCommission: number;
  shippingLogistics: number;
  customerReturnFees: number;
  otherDeductions: number;
  totalFees: number;
}

// Dashboard Claims Summary Card Metrics
export interface ClaimsSummary {
  claimsFiled: number;
  pendingClaims: number;
  approvedClaims: number;
  reimbursementReceived: number;
  outstandingClaimAmount: number;
}

// Dashboard Settlement Summary Card Metrics
export interface SettlementSummary {
  expectedSettlement: number;
  actualReceived: number;
  pendingSettlement: number;
  totalDeductions: number;
}

