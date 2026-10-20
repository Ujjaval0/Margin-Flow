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
  | "CUSTOMER_RETURN"
  | "DAMAGED_RETURN"
  | "CLAIM_PENDING"
  | "CLAIM_APPROVED"
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
  mfn?: string;       // Primary MFN Number (e.g. MFN-88192)
  mfn1?: string;      // MFN-1 Secondary Identifier (e.g. MFN1-88192-A)
  name: string;
  category: string;
  brand: string;
  currentCostPrice: number;
  costHistory: HistoricalCost[];
  supplierId: string;
  active: boolean;
  channelAliases: Partial<Record<Marketplace, string>>; // Maps marketplace SKU to master SKU
  stockQuantity?: number; // Physical warehouse inventory units
  weightGrams?: number;
}

// Partition 2: Orders
export interface OrderItem {
  costEvidence?: "RECORDED" | "UNKNOWN";
  id: string;
  sku: string;
  mfn?: string;
  mfn1?: string;
  productName: string;
  quantity: number;
  sellingPrice: number; // Unit selling price
  lineSubtotal?: number; // Exact source line total before discounts; preserves division remainders.
  discount: number;     // Total discount for this item
  taxAmount: number;
  snapshotUnitCost: number; // Historical cost snapshot locked at order creation time
  returnedQuantity: number;
}

export interface Order {
  sourceEvidenceStatus?:"UNRESOLVED_PARENT"|"RECORDED";
  currency?: "INR";
  taxEvidenceStatus?: "RECORDED" | "UNKNOWN";
  sourceUpdatedAt?: string;
  revenueRecognisedDate?: string;
  taxInvoiceDate?: string;
  taxPointDate?: string;
  taxEvidenceReference?: string;
  sourceTotal?: number;
  customerCharges?: number;
  customerChargesTax?: number;
  physicalDispatchRecorded?: boolean;
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
  shippingTaxAmount?: number;
  shippingRefundAmount?: number;
  shippingRefundDate?: string;
  logisticsRateSlabs?: { marketplace: string; maxWeightGrams: number; amount: number; effectiveFrom: string; effectiveTo?: string }[];
  pricesIncludeTax?: boolean; // Explicit channel/import snapshot; unset preserves legacy data.
  marketplaceChargesEstimate: number;
  feeEstimateStatus?: "CONFIGURED" | "NOT_CONFIGURED" | "LEGACY";
  feeEstimateTotalPaise?: number | null;
  quickFeeRateBps?: number | null;
  estimatedFeeTaxAmount?: number;
  gstRegistrationType?: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  marketplaceFeesIncludeGst?: boolean;
  marketplaceFeeGstRateBps?: number;
  fulfilmentMode?: string;
  settlementAmount?: number;
  settlementPercent?: number;
  commissionPercent?: number;
  supplierName?: string;
  supplierId?: string;
  notes?: string;
  documentIds?: string[];
  settlementIds?: string[];
  returnIds?: string[];
  claimIds?: string[];
}

export type RestockStatus = "PENDING_RESTOCK" | "RESTOCKED" | "WRITTEN_OFF";

// Partition 3: Returns & RTOs
export interface ReturnRecord {
  orderItemId?: string;
  gstAdjustment?: { status: "UNKNOWN" | "ELIGIBLE" | "INELIGIBLE"; amount: number; creditNoteNumber?: string;
    creditNoteDate?: string; originalSupplyDate?: string; declaredDate?: string; annualReturnFiledDate?: string; evidenceReference?: string };
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
  customerReturnFee: number;      // Recorded marketplace return processing fee; no inferred shipping split.
  otherReturnCosts: number;
  inventoryRecoveryValue: number; // e.g., scrap value or salvage value if damaged
  lossAmount: number;             // Net write-off loss
  claimId?: string;
  notes?: string;
}

// Partition 4: Settlements
export interface SettlementDeduction {
  eligibleGstAmount?: number;
  gstCreditStatus?: "UNKNOWN" | "ELIGIBLE" | "INELIGIBLE";
  gstEvidenceReference?: string;
  gstAmount?: number; // Explicit GST already contained in amount; never inferred from a label.
  category: DeductionCategory;
  name: string;
  amount: number;
}

export interface Settlement {
  financialEventIds?:string[];
  evidenceType?: "BANK_RECEIPT" | "FINANCIAL_EVENT";
  feeCoverage?: "COMPLETE" | "PARTIAL";
  tdsCreditOrPaymentDate?: string;
  tcsCollectionDate?: string;
  withholdingApplicability?: "VERIFIED_APPLICABLE" | "VERIFIED_EXEMPT" | "UNKNOWN";
  id: string;
  settlementBatchId: string;
  marketplace: Marketplace;
  settlementDate: string;
  orderId: string;
  grossAmount: number;
  deductions: SettlementDeduction[];
  tcsTdsTax: number; // Legacy aggregate, used only when separate fields are absent.
  tcsTax?: number;
  tdsTax?: number;
  tcsTaxableValue?: number; // Evidenced net taxable value for this collection period, excluding GST.
  tdsGrossAmount?: number; // Evidenced gross base before commission, excluding separately shown GST.
  withholdingRates?: { effectiveFrom: string; tcsBps: number; tdsBps: number }[];
  netSettlement: number;
  reconciliationStatus: ReconciliationStatus;
  discrepancyAmount?: number;
  bankTxRef?: string;
  sourceDocument?: string;
  feeReconciliation?: import("./marketplace-fees").FeeReconciliationResult;
  feeReconciliationScope?: "ORDER";
  netVariancePaise?: number;
}

// Partition 5: Claims & Recoveries
export interface Claim {
  recoveries?:{id:string;date:string;amount:number;cashSettlementId?:string}[];
  cashSettlementId?: string;
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
  lineSubtotal?:number;
  gstCreditStatus?: "UNKNOWN" | "ELIGIBLE" | "INELIGIBLE";
  eligibleGstAmount?: number;
  gstEvidenceReference?: string;
  paymentDate?: string;
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
  paidAmount?: number; // Recorded allocation against this bill, preserved across partial payments.
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

export interface SupplierPayment {
  allocationStatus?:"RECORDED"|"UNRESOLVED";
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  notes?: string;
  allocations: { purchaseId: string; amount: number }[];
  advanceAmount: number;
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
  currency?: string;
  pricesIncludeTax?: boolean;
  supplierId?: string;
  paymentStatus?: "PAID" | "PENDING";
  paymentDate?: string;
  lineItems?: { id: string; sku: string; productName: string; quantity: number; unitPrice: number; discount: number; taxAmount: number; lineSubtotal?: number }[];
  id: string;
  fileName: string;
  fileUrl?: string;
  fileType: "INVOICE" | "SHIPPING_LABEL" | "SETTLEMENT_REPORT" | "SUPPLIER_BILL" | "CLAIM_DOC";
  uploadDate: string;
  status: "STAGED_NEEDS_REVIEW" | "APPROVED_POSTED" | "REJECTED";
  rawTextPreview: string;
  extractedData: {
    marketplace?: ExtractedField<Marketplace>;
    vendorName?: ExtractedField<string>;
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
  entityType: "ORDER" | "SETTLEMENT" | "PRODUCT_COST" | "CLAIM" | "RETURN" | "EXPENSE" | "DOCUMENT" | "PURCHASE" | "SUPPLIER" | "SUPPLIER_PAYOUT" | "COMPLAINT";
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
  expectedSettlement: number | null;
  actualReceived: number;
  pendingSettlement: number | null;
  totalDeductions: number;
}

// Partition 8: Customer Support & Complaints
export type ComplaintCategory =
  | "WRONG_ITEM_RECEIVED"
  | "DAMAGED_PRODUCT"
  | "DELIVERY_DELAY"
  | "DEFECTIVE_PRODUCT"
  | "MISSING_QUANTITY"
  | "SETTLEMENT_OR_REFUND_ISSUE"
  | "OTHER";

export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface CustomerComplaint {
  id: string;               // e.g. TKT-1002
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string;         // Link to Order ID
  channelOrderId?: string;
  marketplace?: Marketplace;
  sku?: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  subject: string;
  description: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

// Partition 9: User Accounts & Roles
export type AccountType = "BRAND_OWNER" | "SUPPLIER" | "WHOLESALER";

export interface OnboardingPreferences {
  role?: string;
  roleLabel?: string;
  channels?: string[];
  volume?: string;
  completedAt?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  supplierId?: string;     // Links to specific Supplier record if role is SUPPLIER
  companyName: string;
  gstin?: string;
  phone?: string;
  avatarUrl?: string;
  authenticatedAt: string;
  onboardingPreferences?: OnboardingPreferences;
  workspaceTourPending?: boolean;
}

// Partition 10: Marketplace Synchronization Contract (Task 6.1)
export type SyncStatus = "pending" | "running" | "succeeded" | "partial" | "failed";

export interface SyncErrorItem {
  code: string;
  message: string;
}

export interface MarketplaceSyncResult {
  marketplace: Marketplace;
  status: SyncStatus;
  fetchedCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  lastSyncedAt: string;
  nextCursor?: string;
  errors: SyncErrorItem[];
}
