import { toPaise } from "./money";
import { z } from "zod";
import type { Product, Order, ReturnRecord, Settlement, Claim, Supplier, PurchaseBill, SupplierPayment, Expense, AIStagedDocument, FinancialAuditLog, CustomerComplaint } from "./types";

const text = z.string().max(20000);
const id = z.string().min(1).max(500);
const amount = z.number().finite().min(0).max(1e12).refine(value => Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7);
const signed = z.number().finite().min(-1e12).max(1e12).refine(value => Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7);
const units = z.number().int().min(0).max(1e9);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10));
const marketplace = z.enum(["Amazon India", "Flipkart", "Meesho", "Personal Website", "Myntra", "WooCommerce", "B2B Wholesale", "Other"]);
const optionalText = text.optional();
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const list = <T extends z.ZodType>(schema: T) => z.array(schema).max(20000);
const identified = { id };
const creditStatus=z.enum(['UNKNOWN','ELIGIBLE','INELIGIBLE']);
const orderItem = object({ id, sku: id, productName: text, quantity: units.positive(), sellingPrice: amount, lineSubtotal: amount.optional(), discount: amount, taxAmount: amount, snapshotUnitCost: amount, costEvidence:z.enum(['RECORDED','UNKNOWN']).optional(), returnedQuantity: units }).refine(item => item.returnedQuantity <= item.quantity && item.discount <= (item.lineSubtotal ?? item.quantity * item.sellingPrice));
export const orderSchema = object({ ...identified, channelOrderId: id, marketplace, orderDate: date,
  sourceEvidenceStatus:z.enum(['UNRESOLVED_PARENT','RECORDED']).optional(),
  currency:z.literal('INR').optional(),taxEvidenceStatus:z.enum(['RECORDED','UNKNOWN']).optional(),sourceUpdatedAt:date.optional(),revenueRecognisedDate:date.optional(),taxInvoiceDate:date.optional(),taxPointDate:date.optional(),taxEvidenceReference:optionalText,sourceTotal:amount.optional(),customerCharges:amount.optional(),customerChargesTax:amount.optional(),physicalDispatchRecorded:z.boolean().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RTO", "RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "CLAIM_PENDING", "CLAIM_APPROVED", "PARTIALLY_RETURNED"]),
  customerName: text, customerCity: text, customerState: text, items: list(orderItem), shippingFeeCharged: amount, marketplaceChargesEstimate: amount,
  gstRegistrationType: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]).optional(),
  marketplaceFeesIncludeGst: z.boolean().optional(), marketplaceFeeGstRateBps: z.number().int().min(0).max(10000).optional(), estimatedFeeTaxAmount: amount.optional(),
  logisticsRateSlabs: list(object({ marketplace, maxWeightGrams: z.number().positive(), amount, effectiveFrom: date, effectiveTo: date.optional() })).optional(),
  pricesIncludeTax: z.boolean().optional(), shippingTaxAmount: amount.optional(), shippingRefundAmount: amount.optional(), shippingRefundDate:date.optional(),
  fulfilmentMode: z.string().max(80).optional(),
  quickFeeRateBps: z.number().int().min(0).max(10000).nullable().optional(),
  settlementAmount: signed.optional(), settlementPercent: amount.max(100).optional(), commissionPercent: amount.max(100).optional(),
  supplierName: optionalText, supplierId: optionalText, notes: optionalText,
  documentIds: list(id).optional(), settlementIds: list(id).optional(), returnIds: list(id).optional(), claimIds: list(id).optional(),
}).refine(order => (order.items.length>0||order.sourceEvidenceStatus==='UNRESOLVED_PARENT') && new Set(order.items.map(item => item.id)).size === order.items.length);
const product = object({ ...identified, sku: id, name: text, category: text, brand: text, currentCostPrice: amount,
  costHistory: list(object({ validFrom: date, validTo: date.optional(), costPrice: amount })), supplierId: text.optional(), active: z.boolean(),
  channelAliases: z.partialRecord(marketplace, text), stockQuantity: units.optional(), weightGrams: z.number().positive().optional(), mfn: optionalText, mfn1: optionalText,
});
const returned = object({ ...identified, orderId: id, channelOrderId: text, marketplace, returnDate: date, receivedDate: date.optional(),
  orderItemId:id.optional(),gstAdjustment:object({status:creditStatus,amount,creditNoteNumber:optionalText,creditNoteDate:date.optional(),originalSupplyDate:date.optional(),declaredDate:date.optional(),annualReturnFiledDate:date.optional(),evidenceReference:optionalText}).optional(),
  returnType: z.enum(["CUSTOMER_RETURN", "RTO", "DAMAGED_RETURN", "LOST_RETURN", "OTHER"]), returnReason: text, sku: id, quantity: units.positive(),
  condition: z.enum(["SELLABLE", "DAMAGED", "USED", "MISSING", "UNUSABLE", "UNDER_INSPECTION"]), restockStatus: z.enum(["PENDING_RESTOCK", "RESTOCKED", "WRITTEN_OFF"]).optional(),
  returnShippingCost: amount, customerReturnFee: amount, otherReturnCosts: amount, inventoryRecoveryValue: amount, lossAmount: signed,
  claimId: optionalText, claimDeadline: date.optional(), notes: optionalText, productName: optionalText, awbNumber: optionalText,
});
export const settlementSchema = object({ ...identified, orderId: id, marketplace, settlementDate: date, settlementBatchId: id, grossAmount: signed,
  financialEventIds:list(id).optional(),
  evidenceType:z.enum(['BANK_RECEIPT','FINANCIAL_EVENT']).optional(),feeCoverage:z.enum(['COMPLETE','PARTIAL']).optional(),tdsCreditOrPaymentDate:date.optional(),tcsCollectionDate:date.optional(),withholdingApplicability:z.enum(['VERIFIED_APPLICABLE','VERIFIED_EXEMPT','UNKNOWN']).optional(),
  deductions: list(object({ category: z.enum(["COMMISSION", "LOGISTICS", "FIXED_FEE", "COLLECTION_FEE", "RETURN_SHIPPING", "PENALTY", "TAX_TCS", "TAX_TDS", "OTHER"]), name: text, amount: signed, gstAmount: signed.optional(),gstCreditStatus:creditStatus.optional(),eligibleGstAmount:amount.optional(),gstEvidenceReference:optionalText })),
  tcsTdsTax: signed, tcsTax: signed.optional(), tdsTax: signed.optional(), tcsTaxableValue: signed.optional(), tdsGrossAmount: signed.optional(),
  withholdingRates: list(object({ effectiveFrom: date, tcsBps: z.number().int().min(0).max(10000), tdsBps: z.number().int().min(0).max(10000) })).optional(), netSettlement: signed, reconciliationStatus: z.enum(["RECONCILED", "MISMATCH_FLAGGED", "PENDING_RECON"]), discrepancyAmount: signed.optional(), bankTxRef: optionalText, sourceDocument: optionalText,
});
const claim = object({ ...identified, orderId: id, returnId: optionalText,cashSettlementId:optionalText, marketplace, claimDate: date, amountClaimed: amount, amountRecovered: amount,
  recoveries:list(object({id,date,amount:amount.positive(),cashSettlementId:optionalText})).optional(),
  claimType: z.enum(["LOST_IN_TRANSIT", "DAMAGED_INVOICE", "WRONG_RETURN_ITEM", "FEE_DISPUTE"]),
  status: z.enum(["NOT_FILED", "FILED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_RECOVERED", "RECOVERED", "REJECTED", "CLOSED"]), recoveryDate: date.optional(), supportingDocuments: list(text).optional(), notes: optionalText,
}).refine(c=>c.amountRecovered<=c.amountClaimed && (!c.recoveries || new Set(c.recoveries.map(r=>r.id)).size===c.recoveries.length && c.recoveries.reduce((sum,r)=>sum+toPaise(r.amount),0)===toPaise(c.amountRecovered)));
const supplier = object({ ...identified, name: text, contactPerson: text, email: text, phone: text, address: text, openingBalance: signed.optional(), totalPaid: amount.optional(), gstin: optionalText, paymentTerms: optionalText, bankAccount: optionalText, upiId: optionalText, notes: optionalText });
const purchase = object({ ...identified, supplierId: id, supplierName: text, invoiceNumber: id, invoiceDate: date, sku: id, quantity: units.positive(), unitCost: amount,lineSubtotal:amount.optional(), taxes: amount, totalAmount: amount, paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL"]), paidAmount: amount.optional(),paymentDate:date.optional(),gstCreditStatus:creditStatus.optional(),eligibleGstAmount:amount.optional(),gstEvidenceReference:optionalText, documentUrl: optionalText }).refine(bill => (bill.paidAmount === undefined || bill.paidAmount <= bill.totalAmount) && (bill.eligibleGstAmount===undefined || bill.eligibleGstAmount<=bill.taxes));
const supplierPayment = object({ id, supplierId: id, date, amount: amount.positive(), paymentMethod: text, reference: text, notes: optionalText,
  allocationStatus:z.enum(['RECORDED','UNRESOLVED']).optional(),
  allocations: list(object({ purchaseId: id, amount: amount.positive() })), advanceAmount: amount,
}).refine(payment => payment.allocationStatus==='UNRESOLVED' || toPaise(payment.amount) === payment.allocations.reduce((sum, allocation) => sum + toPaise(allocation.amount), toPaise(payment.advanceAmount)));
const expense = object({ ...identified, date, category: z.enum(["Advertising", "Salaries", "Rent", "Software", "Packaging", "Office", "Transportation", "Professional Services", "Utilities", "Other"]), description: text, amount, vendor: text, paymentMethod: z.enum(["BANK_TRANSFER", "UPI", "CREDIT_CARD", "CASH"]), isRecurring: z.boolean(), marketplace: marketplace.optional(), attributedSku: optionalText, supportingDocument: optionalText, notes: optionalText });
const field = <T extends z.ZodType>(value: T) => object({ value, confidence: z.number().min(0).max(1), provenance: z.enum(["AI_EXTRACTED", "MANUALLY_ENTERED", "MANUALLY_MODIFIED"]) }).optional();
const document = object({ ...identified, fileName: text, fileType: z.enum(["INVOICE", "SHIPPING_LABEL", "SETTLEMENT_REPORT", "SUPPLIER_BILL", "CLAIM_DOC"]), uploadDate: date, status: z.enum(["STAGED_NEEDS_REVIEW", "APPROVED_POSTED", "REJECTED"]), rawTextPreview: text,
  currency:z.string().max(8).optional(),pricesIncludeTax:z.boolean().optional(),supplierId:optionalText,paymentStatus:z.enum(['PAID','PENDING']).optional(),paymentDate:date.optional(),lineItems:list(object({id,sku:text,productName:text,quantity:units.positive(),unitPrice:amount,lineSubtotal:amount.optional(),discount:amount,taxAmount:amount})).optional(),
  extractedData: object({ marketplace: field(marketplace), vendorName: field(text), orderId: field(text), invoiceNumber: field(text), orderDate: field(date), sku: field(text), productName: field(text), quantity: field(units), unitPrice: field(amount), discount: field(amount), taxAmount: field(amount), totalAmount: field(amount) }),
  arithmeticValidation: object({ passed: z.boolean(), calculatedTotal: signed, declaredTotal: signed, difference: signed, message: text }), catalogValidation: object({ skuMatched: z.boolean(), matchedSkuId: optionalText, suggestion: optionalText }), fileUrl: optionalText,
});
const audit = object({ ...identified, timestamp: date, entityType: z.enum(["ORDER", "SETTLEMENT", "PRODUCT_COST", "CLAIM", "RETURN", "EXPENSE", "DOCUMENT", "PURCHASE", "SUPPLIER", "SUPPLIER_PAYOUT", "COMPLAINT"]), entityId: id, fieldName: text, oldValue: text, newValue: text, modifiedBy: text, reason: optionalText, sourceDocumentId: optionalText });
const complaint = object({ ...identified, ticketNumber: id, customerName: text, customerEmail: text, category: z.enum(["WRONG_ITEM_RECEIVED", "DAMAGED_PRODUCT", "DELIVERY_DELAY", "DEFECTIVE_PRODUCT", "MISSING_QUANTITY", "SETTLEMENT_OR_REFUND_ISSUE", "OTHER"]), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]), subject: text, description: text, createdAt: date, resolvedAt: date.optional(), orderId: optionalText, channelOrderId: optionalText, marketplace: marketplace.optional(), sku: optionalText, customerPhone: optionalText, resolutionNotes: optionalText });
export const ledgerDataSchema = z.object({ financialRevision:z.number().int().nonnegative().optional(),financialIssues:list(text).optional(), products: list(product), orders: list(orderSchema), returns: list(returned), settlements: list(settlementSchema), claims: list(claim), suppliers: list(supplier), purchases: list(purchase), supplierPayments: list(supplierPayment).default([]), expenses: list(expense), aiDocuments: list(document), auditLogs: list(audit), complaints: list(complaint), acknowledgedLossLeaderSkus: list(id) }).strict();
export interface LedgerData { financialRevision?:number;financialIssues?:string[]; products: Product[]; orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; suppliers: Supplier[]; purchases: PurchaseBill[]; supplierPayments?: SupplierPayment[]; expenses: Expense[]; aiDocuments: AIStagedDocument[]; auditLogs: FinancialAuditLog[]; complaints: CustomerComplaint[]; acknowledgedLossLeaderSkus: string[] }

export function parseLedgerSnapshot(raw: string, ownerId: string): LedgerData | null {
  if (raw.length > 10 * 1024 * 1024) return null;
  try {
    const parsed = JSON.parse(raw, (key, value) => { if (["__proto__", "constructor", "prototype"].includes(key)) throw Error("Unsafe key"); return value; });
    if (parsed.version !== 1 || parsed.ownerId !== ownerId) return null;
    const result = ledgerDataSchema.safeParse(parsed.data);
    if (!result.success) return null;
    const data = result.data;
    for (const [key, rows] of Object.entries(data)) {
      if(!Array.isArray(rows) || key==="financialIssues")continue;
      const identities = rows.map((row: any) => key === "acknowledgedLossLeaderSkus" ? row : row.id);
      if (new Set(identities).size !== identities.length) return null;
    }
    if (new Set(data.products.map(row => row.sku)).size !== data.products.length) return null;
    if (new Set(data.orders.map(row => JSON.stringify([row.marketplace, row.channelOrderId]))).size !== data.orders.length) return null;
    return data as LedgerData;
  } catch { return null; }
}
