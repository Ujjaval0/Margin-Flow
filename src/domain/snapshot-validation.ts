import { z } from "zod";
import type { Product, Order, ReturnRecord, Settlement, Claim, Supplier, PurchaseBill, Expense, AIStagedDocument, FinancialAuditLog, CustomerComplaint } from "./types";

const text = z.string().max(20000);
const id = z.string().min(1).max(500);
const amount = z.number().finite().min(0).max(1e12);
const signed = z.number().finite().min(-1e12).max(1e12);
const units = z.number().int().min(0).max(1e9);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10));
const marketplace = z.enum(["Amazon India", "Flipkart", "Meesho", "Personal Website", "Myntra", "WooCommerce", "B2B Wholesale", "Other"]);
const optionalText = text.optional();
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const list = <T extends z.ZodType>(schema: T) => z.array(schema).max(20000);
const identified = { id };
const orderItem = object({ id, sku: id, productName: text, quantity: units.positive(), sellingPrice: amount, discount: amount, taxAmount: amount, snapshotUnitCost: amount, returnedQuantity: units }).refine(item => item.returnedQuantity <= item.quantity && item.discount <= item.quantity * item.sellingPrice);
export const orderSchema = object({ ...identified, channelOrderId: id, marketplace, orderDate: date,
  status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RTO", "RETURNED", "CUSTOMER_RETURN", "DAMAGED_RETURN", "CLAIM_PENDING", "CLAIM_APPROVED", "PARTIALLY_RETURNED"]),
  customerName: text, customerCity: text, customerState: text, items: list(orderItem).min(1), shippingFeeCharged: amount, marketplaceChargesEstimate: amount,
  settlementAmount: signed.optional(), settlementPercent: amount.max(100).optional(), commissionPercent: amount.max(100).optional(),
  supplierName: optionalText, supplierId: optionalText, notes: optionalText,
  documentIds: list(id).optional(), settlementIds: list(id).optional(), returnIds: list(id).optional(), claimIds: list(id).optional(),
}).refine(order => new Set(order.items.map(item => item.id)).size === order.items.length);
const product = object({ ...identified, sku: id, name: text, category: text, brand: text, currentCostPrice: amount,
  costHistory: list(object({ validFrom: date, validTo: date.optional(), costPrice: amount })), supplierId: text.optional(), active: z.boolean(),
  channelAliases: z.partialRecord(marketplace, text), stockQuantity: units.optional(), mfn: optionalText, mfn1: optionalText,
});
const returned = object({ ...identified, orderId: id, channelOrderId: text, marketplace, returnDate: date, receivedDate: date.optional(),
  returnType: z.enum(["CUSTOMER_RETURN", "RTO", "DAMAGED_RETURN", "LOST_RETURN", "OTHER"]), returnReason: text, sku: id, quantity: units.positive(),
  condition: z.enum(["SELLABLE", "DAMAGED", "USED", "MISSING", "UNUSABLE", "UNDER_INSPECTION"]), restockStatus: z.enum(["PENDING_RESTOCK", "RESTOCKED", "WRITTEN_OFF"]).optional(),
  returnShippingCost: amount, customerReturnFee: amount, otherReturnCosts: amount, inventoryRecoveryValue: amount, lossAmount: signed,
  claimId: optionalText, claimDeadline: date.optional(), notes: optionalText, productName: optionalText, awbNumber: optionalText,
});
const settlement = object({ ...identified, orderId: id, marketplace, settlementDate: date, settlementBatchId: id, grossAmount: signed,
  deductions: list(object({ category: z.enum(["COMMISSION", "LOGISTICS", "FIXED_FEE", "COLLECTION_FEE", "RETURN_SHIPPING", "PENALTY", "TAX_TCS", "TAX_TDS", "OTHER"]), name: text, amount: signed })),
  tcsTdsTax: signed, netSettlement: signed, reconciliationStatus: z.enum(["RECONCILED", "MISMATCH_FLAGGED", "PENDING_RECON"]), discrepancyAmount: signed.optional(), bankTxRef: optionalText, sourceDocument: optionalText,
});
const claim = object({ ...identified, orderId: id, returnId: optionalText, marketplace, claimDate: date, amountClaimed: amount, amountRecovered: amount,
  claimType: z.enum(["LOST_IN_TRANSIT", "DAMAGED_INVOICE", "WRONG_RETURN_ITEM", "FEE_DISPUTE"]),
  status: z.enum(["NOT_FILED", "FILED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_RECOVERED", "RECOVERED", "REJECTED", "CLOSED"]), recoveryDate: date.optional(), supportingDocuments: list(text).optional(), notes: optionalText,
});
const supplier = object({ ...identified, name: text, contactPerson: text, email: text, phone: text, address: text, openingBalance: signed.optional(), totalPaid: amount.optional(), gstin: optionalText, paymentTerms: optionalText, bankAccount: optionalText, upiId: optionalText, notes: optionalText });
const purchase = object({ ...identified, supplierId: id, supplierName: text, invoiceNumber: id, invoiceDate: date, sku: id, quantity: units.positive(), unitCost: amount, taxes: amount, totalAmount: amount, paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL"]), paidAmount: amount.optional(), documentUrl: optionalText }).refine(bill => bill.paidAmount === undefined || bill.paidAmount <= bill.totalAmount);
const expense = object({ ...identified, date, category: z.enum(["Advertising", "Salaries", "Rent", "Software", "Packaging", "Office", "Transportation", "Professional Services", "Utilities", "Other"]), description: text, amount, vendor: text, paymentMethod: z.enum(["BANK_TRANSFER", "UPI", "CREDIT_CARD", "CASH"]), isRecurring: z.boolean(), marketplace: marketplace.optional(), attributedSku: optionalText, supportingDocument: optionalText, notes: optionalText });
const field = <T extends z.ZodType>(value: T) => object({ value, confidence: z.number().min(0).max(1), provenance: z.enum(["AI_EXTRACTED", "MANUALLY_ENTERED", "MANUALLY_MODIFIED"]) }).optional();
const document = object({ ...identified, fileName: text, fileType: z.enum(["INVOICE", "SHIPPING_LABEL", "SETTLEMENT_REPORT", "SUPPLIER_BILL", "CLAIM_DOC"]), uploadDate: date, status: z.enum(["STAGED_NEEDS_REVIEW", "APPROVED_POSTED", "REJECTED"]), rawTextPreview: text,
  extractedData: object({ marketplace: field(marketplace), vendorName: field(text), orderId: field(text), invoiceNumber: field(text), orderDate: field(date), sku: field(text), productName: field(text), quantity: field(units), unitPrice: field(amount), discount: field(amount), taxAmount: field(amount), totalAmount: field(amount) }),
  arithmeticValidation: object({ passed: z.boolean(), calculatedTotal: signed, declaredTotal: signed, difference: signed, message: text }), catalogValidation: object({ skuMatched: z.boolean(), matchedSkuId: optionalText, suggestion: optionalText }), fileUrl: optionalText,
});
const audit = object({ ...identified, timestamp: date, entityType: z.enum(["ORDER", "SETTLEMENT", "PRODUCT_COST", "CLAIM", "RETURN", "EXPENSE", "DOCUMENT", "PURCHASE"]), entityId: id, fieldName: text, oldValue: text, newValue: text, modifiedBy: text, reason: optionalText, sourceDocumentId: optionalText });
const complaint = object({ ...identified, ticketNumber: id, customerName: text, customerEmail: text, category: z.enum(["WRONG_ITEM_RECEIVED", "DAMAGED_PRODUCT", "DELIVERY_DELAY", "DEFECTIVE_PRODUCT", "MISSING_QUANTITY", "SETTLEMENT_OR_REFUND_ISSUE", "OTHER"]), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]), subject: text, description: text, createdAt: date, resolvedAt: date.optional(), orderId: optionalText, channelOrderId: optionalText, marketplace: marketplace.optional(), sku: optionalText, customerPhone: optionalText, resolutionNotes: optionalText });
export const ledgerDataSchema = z.object({ products: list(product), orders: list(orderSchema), returns: list(returned), settlements: list(settlement), claims: list(claim), suppliers: list(supplier), purchases: list(purchase), expenses: list(expense), aiDocuments: list(document), auditLogs: list(audit), complaints: list(complaint), acknowledgedLossLeaderSkus: list(id) }).strict();
export interface LedgerData { products: Product[]; orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; suppliers: Supplier[]; purchases: PurchaseBill[]; expenses: Expense[]; aiDocuments: AIStagedDocument[]; auditLogs: FinancialAuditLog[]; complaints: CustomerComplaint[]; acknowledgedLossLeaderSkus: string[] }

export function parseLedgerSnapshot(raw: string, ownerId: string): LedgerData | null {
  if (raw.length > 10 * 1024 * 1024) return null;
  try {
    const parsed = JSON.parse(raw, (key, value) => { if (["__proto__", "constructor", "prototype"].includes(key)) throw Error("Unsafe key"); return value; });
    if (parsed.version !== 1 || parsed.ownerId !== ownerId) return null;
    const result = ledgerDataSchema.safeParse(parsed.data);
    if (!result.success) return null;
    const data = result.data;
    for (const [key, rows] of Object.entries(data)) {
      const identities = rows.map((row: any) => key === "acknowledgedLossLeaderSkus" ? row : row.id);
      if (new Set(identities).size !== identities.length) return null;
    }
    if (new Set(data.products.map(row => row.sku)).size !== data.products.length) return null;
    if (new Set(data.orders.map(row => JSON.stringify([row.marketplace, row.channelOrderId]))).size !== data.orders.length) return null;
    return data as LedgerData;
  } catch { return null; }
}
