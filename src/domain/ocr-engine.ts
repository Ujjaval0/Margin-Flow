import { AIStagedDocument, ExtractedField, Marketplace } from "./types";
import { validateDocumentArithmetic } from "./guardrails";

export interface OCRResult {
  document: AIStagedDocument;
  extractedText: string;
}

/**
 * Intelligent Document Processing (IDP) & OCR Parsing Engine
 * Extracts structured financial entities from invoice text/buffers
 * with field-level confidence and arithmetic invariant verification.
 */
export function processDocumentOCR(
  fileName: string,
  rawContent: string,
  customType?: "SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT"
): AIStagedDocument {
  const text = rawContent.trim();
  const lower = text.toLowerCase();

  // Detect document type
  let fileType: AIStagedDocument["fileType"] = "SUPPLIER_BILL";
  if (customType) {
    fileType = customType;
  } else if (lower.includes("supplier") || lower.includes("purchase order") || lower.includes("wholesale") || lower.includes("vendor")) {
    fileType = "SUPPLIER_BILL";
  } else if (lower.includes("settlement") || lower.includes("disbursement") || lower.includes("payout")) {
    fileType = "SETTLEMENT_REPORT";
  } else {
    fileType = "INVOICE";
  }

  // Extract Invoice/Bill Number
  const invMatch =
    text.match(/(?:invoice|bill|tax invoice|ref|voucher)\s*(?:no|number|#)?[:.\s]*([A-Z0-9\-_/]+)/i) ||
    text.match(/([A-Z]{2,4}-[0-9]{4,8})/i) ||
    text.match(/INV[0-9]+/i);
  const invoiceNumber = invMatch ? invMatch[1].trim() : `BILL-${Math.floor(100000 + Math.random() * 900000)}`;

  // Extract Date
  const dateMatch =
    text.match(/(?:date|dated|invoice date|bill date)[:.\s]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})/i) ||
    text.match(/(?:date|dated)[:.\s]*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i);
  let orderDate = new Date().toISOString().split("T")[0];
  if (dateMatch) {
    const rawDate = dateMatch[1];
    if (rawDate.includes("-") && rawDate.length === 10 && rawDate.startsWith("202")) {
      orderDate = rawDate;
    } else if (rawDate.includes("/")) {
      const parts = rawDate.split("/");
      if (parts[2]?.length === 4) {
        orderDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
  }

  // Extract Marketplace / Channel / Vendor
  let marketplace: Marketplace | undefined = undefined;
  if (lower.includes("amazon")) marketplace = "Amazon India";
  else if (lower.includes("flipkart")) marketplace = "Flipkart";
  else if (lower.includes("meesho")) marketplace = "Meesho";
  else if (lower.includes("website") || lower.includes("shopify")) marketplace = "Personal Website";

  // Extract Vendor / Supplier Name
  const vendorMatch =
    text.match(/(?:vendor|supplier|seller|billed by|m\/s|company)[:.\s]*([A-Za-z0-9\s.,&]+?)(?:\n|gst|address|phone|email)/i) ||
    text.match(/^([A-Za-z\s]+(?:Enterprises|Electronics|Tech|Solutions|Pvt Ltd|Industries|Wholesale))/m);
  const vendorName = vendorMatch ? vendorMatch[1].trim() : (fileType === "SUPPLIER_BILL" ? "Apex Components Ltd" : "D2C Direct Store");

  // Check if document content is an unparsed binary scan or sparse text
  const isBinaryScan =
    text.startsWith("[Binary Scan:") ||
    text.includes("Binary Document Scan") ||
    text.length < 15;

  // Extract SKU
  const skuMatch = !isBinaryScan
    ? text.match(/(?:sku|item code|product code|model)[:.\s]*([A-Z0-9\-_]+)/i) ||
      text.match(/([A-Z]{3,4}-[A-Z0-9]+-[0-9]{2})/)
    : null;
  const sku = skuMatch ? skuMatch[1].trim() : undefined;

  // Extract Product Name / Description
  const prodMatch = !isBinaryScan
    ? text.match(/(?:description|item name|product|item)[:.\s]*([A-Za-z0-9\s\-–]+?)(?:\n|qty|price|hsn)/i)
    : null;
  const productName = prodMatch ? prodMatch[1].trim() : undefined;

  // Extract Quantity
  const qtyMatch = !isBinaryScan
    ? text.match(/(?:qty|quantity|units|pcs)[:.\s]*([0-9]+)/i) ||
      text.match(/\b([0-9]{1,4})\s*(?:units|pcs|pieces)\b/i)
    : null;
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

  // Extract Unit Price
  const priceMatch = !isBinaryScan
    ? text.match(/(?:rate|unit price|price|cost)[:.\s]*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
      text.match(/@\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/)
    : null;
  const unitPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : undefined;

  // Extract Discount
  const discMatch = !isBinaryScan
    ? text.match(/(?:discount|rebate|disc)[:.\s]*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    : null;
  const discount = discMatch ? parseFloat(discMatch[1].replace(/,/g, "")) : 0;

  // Extract Tax / GST
  const taxMatch = !isBinaryScan
    ? text.match(/(?:tax|gst|igst|cgst\+sgst|vat)[:.\s]*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    : null;
  const taxAmount = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, "")) : 0;

  // Extract Declared Total strictly from document text (DO NOT tautologically compute total)
  const totalMatch = !isBinaryScan
    ? text.match(/(?:total|grand total|net payable|invoice total|final amount)[:.\s]*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
      text.match(/total\s*amount[:.\s]*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    : null;
  const declaredTotal = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : undefined;

  // Run authentic arithmetic invariant check against declared total
  const arithmeticValidation = validateDocumentArithmetic(
    quantity,
    unitPrice,
    discount,
    taxAmount,
    declaredTotal
  );

  const docId = `DOC-AI-${Date.now().toString().slice(-4)}`;

  const stagedDocument: AIStagedDocument = {
    id: docId,
    fileName,
    fileType,
    uploadDate: new Date().toISOString().split("T")[0],
    status: "STAGED_NEEDS_REVIEW",
    rawTextPreview:
      !isBinaryScan && text.length > 20
        ? text
        : `[Binary / Image Document Scan: ${fileName}]\nOptical character recognition could not detect clear machine text.\nPlease review and enter required invoice entities in the Human-in-the-Loop staging sandbox.`,
    extractedData: {
      marketplace: marketplace
        ? { value: marketplace, confidence: 0.95, provenance: "AI_EXTRACTED" }
        : undefined,
      vendorName: vendorName
        ? { value: vendorName, confidence: vendorMatch ? 0.92 : 0.6, provenance: "AI_EXTRACTED" }
        : undefined,
      orderId: invoiceNumber
        ? {
            value: invoiceNumber,
            confidence: invMatch ? 0.95 : 0.4,
            provenance: invMatch ? "AI_EXTRACTED" : "MANUALLY_ENTERED",
          }
        : undefined,
      invoiceNumber: invoiceNumber
        ? {
            value: invoiceNumber,
            confidence: invMatch ? 0.95 : 0.4,
            provenance: invMatch ? "AI_EXTRACTED" : "MANUALLY_ENTERED",
          }
        : undefined,
      orderDate: {
        value: orderDate,
        confidence: dateMatch ? 0.95 : 0.5,
        provenance: dateMatch ? "AI_EXTRACTED" : "MANUALLY_ENTERED",
      },
      sku: sku
        ? {
            value: sku,
            confidence: 0.92,
            provenance: "AI_EXTRACTED",
          }
        : {
            value: "",
            confidence: 0,
            provenance: "MANUALLY_ENTERED",
            isFlaggedAnomaly: true,
            anomalyMessage: "SKU not detected in document OCR.",
          },
      productName: productName
        ? {
            value: productName,
            confidence: 0.88,
            provenance: "AI_EXTRACTED",
          }
        : undefined,
      quantity:
        quantity !== undefined
          ? {
              value: quantity,
              confidence: 0.96,
              provenance: "AI_EXTRACTED",
            }
          : {
              value: 0,
              confidence: 0,
              provenance: "MANUALLY_ENTERED",
              isFlaggedAnomaly: true,
              anomalyMessage: "Quantity not detected in document.",
            },
      unitPrice:
        unitPrice !== undefined
          ? {
              value: unitPrice,
              confidence: 0.94,
              provenance: "AI_EXTRACTED",
            }
          : {
              value: 0,
              confidence: 0,
              provenance: "MANUALLY_ENTERED",
              isFlaggedAnomaly: true,
              anomalyMessage: "Unit price not detected in document.",
            },
      discount: {
        value: discount,
        confidence: discMatch ? 0.9 : 0.6,
        provenance: "AI_EXTRACTED",
      },
      taxAmount: {
        value: taxAmount,
        confidence: taxMatch ? 0.92 : 0.5,
        provenance: "AI_EXTRACTED",
      },
      totalAmount: {
        value: declaredTotal !== undefined ? declaredTotal : arithmeticValidation.calculatedTotal,
        confidence: declaredTotal !== undefined ? 0.98 : 0,
        provenance: declaredTotal !== undefined ? "AI_EXTRACTED" : "MANUALLY_ENTERED",
        isFlaggedAnomaly: !arithmeticValidation.passed,
        anomalyMessage: !arithmeticValidation.passed
          ? arithmeticValidation.message
          : undefined,
      },
    },
    arithmeticValidation,
    catalogValidation: {
      skuMatched: Boolean(sku && sku.length > 0),
      matchedSkuId: sku || undefined,
      suggestion: sku ? `Detected SKU candidate: ${sku}` : "No catalog SKU detected in document OCR.",
    },
  };

  return stagedDocument;
}

export function generateSampleBillText(
  fileName: string,
  invoiceNo: string,
  orderDate: string,
  vendorName: string,
  sku: string,
  productName: string,
  quantity: number,
  unitPrice: number,
  discount: number,
  taxAmount: number,
  totalAmount: number
): string {
  return `TAX INVOICE / VENDOR BILL
--------------------------------------------------
Vendor / Supplier : ${vendorName}
Invoice No        : ${invoiceNo}
Date              : ${orderDate}
File Reference    : ${fileName}

LINE ITEMS:
--------------------------------------------------
SKU               : ${sku}
Description       : ${productName}
Quantity          : ${quantity}
Unit Price        : INR ${unitPrice.toFixed(2)}
Discount          : INR ${discount.toFixed(2)}
Tax (GST)         : INR ${taxAmount.toFixed(2)}
--------------------------------------------------
Subtotal          : INR ${(quantity * unitPrice).toFixed(2)}
Total Amount      : INR ${totalAmount.toFixed(2)}
--------------------------------------------------
Authorized Signatory / E-Invoice System
`;
}
