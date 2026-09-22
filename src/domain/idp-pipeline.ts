import { z } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AIStagedDocument, Marketplace } from "./types";
import { validateDocumentArithmetic } from "./guardrails";
import { processDocumentOCR } from "./ocr-engine";

export const LineItemSchema = z.object({
  sku: z.string().default(""),
  description: z.string().default(""),
  hsnCode: z.string().optional(),
  quantity: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(18),
  cgst: z.number().nonnegative().default(0),
  sgst: z.number().nonnegative().default(0),
  igst: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative().default(0),
});

export type IDPLineItem = z.infer<typeof LineItemSchema>;

export const InvoiceExtractionSchema = z.object({
  invoiceNumber: z.string().min(1).default("INV-PENDING"),
  invoiceDate: z.string().default(() => new Date().toISOString().split("T")[0]),
  vendorName: z.string().min(1).default("Unknown Vendor"),
  vendorGstin: z.string().optional(),
  buyerName: z.string().optional(),
  marketplace: z
    .enum([
      "Amazon India",
      "Flipkart",
      "Meesho",
      "Personal Website",
      "Myntra",
      "WooCommerce",
      "B2B Wholesale",
      "Other",
    ])
    .optional(),
  currency: z.string().default("INR"),
  lineItems: z.array(LineItemSchema).default([]),
  subtotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  discountTotal: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
});

export type IDPInvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

export interface IDPPipelineResult {
  source: "LLM_STRUCTURED_IDP" | "DETERMINISTIC_PARSER";
  extraction: IDPInvoiceExtraction;
  stagedDocument: AIStagedDocument;
  validation: {
    passed: boolean;
    calculatedTotal: number;
    difference: number;
    discrepancyMessage?: string;
  };
}

/**
 * Intelligent Document Processing (IDP) Pipeline
 * Combines Zod schema validation, optional LLM provider extraction,
 * and deterministic fallback with arithmetic guardrails.
 */
export async function executeIDPPipeline(
  fileName: string,
  rawText: string,
  options?: {
    customType?: "SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT";
    apiKey?: string;
  }
): Promise<IDPPipelineResult> {
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;

  // 1. If Gemini API key is available, execute structured LLM extraction via Vercel AI SDK
  if (apiKey) {
    try {
      const google = createGoogleGenerativeAI({ apiKey });
      const { object: validated } = await generateObject({
        model: google("gemini-1.5-flash"),
        schema: InvoiceExtractionSchema,
        prompt: `You are a statutory financial document extraction engine. Extract data from the invoice/bill text below:\n\nDOCUMENT TEXT:\n${rawText}`,
      });

          // Convert to AIStagedDocument
          const primaryItem = validated.lineItems[0] || {
            sku: "",
            description: "",
            quantity: 1,
            unitPrice: validated.subtotal,
            discount: validated.discountTotal,
            totalAmount: validated.grandTotal,
          };

          const calculatedTotal = validated.lineItems.length > 0
            ? validated.lineItems.reduce(
                (sum, item) => sum + (item.quantity * item.unitPrice - item.discount + item.cgst + item.sgst + item.igst),
                0
              )
            : validated.subtotal + validated.taxTotal - validated.discountTotal;

          const diff = Math.abs(Math.round((calculatedTotal - validated.grandTotal) * 100) / 100);
          const passed = diff <= 1.0;

          const stagedDocument: AIStagedDocument = {
            id: `DOC-IDP-${Date.now().toString().slice(-6)}`,
            fileName,
            fileType: options?.customType || "SUPPLIER_BILL",
            uploadDate: new Date().toISOString(),
            status: "STAGED_NEEDS_REVIEW",
            rawTextPreview: rawText.slice(0, 300),
            extractedData: {
              marketplace: validated.marketplace
                ? { value: validated.marketplace, confidence: 0.98, provenance: "AI_EXTRACTED" }
                : undefined,
              orderId: { value: validated.invoiceNumber, confidence: 0.99, provenance: "AI_EXTRACTED" },
              invoiceNumber: { value: validated.invoiceNumber, confidence: 0.99, provenance: "AI_EXTRACTED" },
              orderDate: { value: validated.invoiceDate, confidence: 0.98, provenance: "AI_EXTRACTED" },
              sku: primaryItem.sku
                ? { value: primaryItem.sku, confidence: 0.95, provenance: "AI_EXTRACTED" }
                : {
                    value: "",
                    confidence: 0,
                    provenance: "MANUALLY_ENTERED",
                    isFlaggedAnomaly: true,
                    anomalyMessage: "SKU not detected by LLM.",
                  },
              productName: primaryItem.description
                ? { value: primaryItem.description, confidence: 0.95, provenance: "AI_EXTRACTED" }
                : undefined,
              quantity: {
                value: primaryItem.quantity,
                confidence: 0.99,
                provenance: "AI_EXTRACTED",
              },
              unitPrice: {
                value: primaryItem.unitPrice,
                confidence: 0.98,
                provenance: "AI_EXTRACTED",
              },
              discount: {
                value: validated.discountTotal,
                confidence: 0.95,
                provenance: "AI_EXTRACTED",
              },
              taxAmount: {
                value: validated.taxTotal,
                confidence: 0.98,
                provenance: "AI_EXTRACTED",
              },
              totalAmount: {
                value: validated.grandTotal,
                confidence: 0.99,
                provenance: "AI_EXTRACTED",
                isFlaggedAnomaly: !passed,
                anomalyMessage: !passed ? `Arithmetic variance of ₹${diff}` : undefined,
              },
            },
            arithmeticValidation: {
              passed,
              calculatedTotal: Math.round(calculatedTotal * 100) / 100,
              declaredTotal: validated.grandTotal,
              difference: diff,
              message: passed ? "Arithmetic invariant verified" : `Variance ₹${diff}`,
            },
            catalogValidation: {
              skuMatched: Boolean(primaryItem.sku),
              matchedSkuId: primaryItem.sku || undefined,
              suggestion: primaryItem.sku ? `Matched SKU ${primaryItem.sku}` : "No catalog SKU found",
            },
          };

          return {
            source: "LLM_STRUCTURED_IDP",
            extraction: validated,
            stagedDocument,
            validation: {
              passed,
              calculatedTotal,
              difference: diff,
              discrepancyMessage: passed ? undefined : `Variance ₹${diff}`,
            },
          };
    } catch (llmError) {
      console.warn("LLM IDP extraction failed, falling back to deterministic parser:", llmError);
    }
  }

  // 2. Deterministic Fallback Parser
  const fallbackDoc = processDocumentOCR(fileName, rawText, options?.customType);

  const fallbackExtraction: IDPInvoiceExtraction = {
    invoiceNumber: fallbackDoc.extractedData.invoiceNumber?.value || "INV-UNKNOWN",
    invoiceDate: fallbackDoc.extractedData.orderDate?.value || new Date().toISOString().split("T")[0],
    vendorName: "Detected Vendor",
    marketplace: fallbackDoc.extractedData.marketplace?.value,
    currency: "INR",
    lineItems: [
      {
        sku: fallbackDoc.extractedData.sku?.value || "",
        description: fallbackDoc.extractedData.productName?.value || "",
        quantity: fallbackDoc.extractedData.quantity?.value || 1,
        unitPrice: fallbackDoc.extractedData.unitPrice?.value || 0,
        discount: fallbackDoc.extractedData.discount?.value || 0,
        taxRate: 18,
        cgst: 0,
        sgst: 0,
        igst: fallbackDoc.extractedData.taxAmount?.value || 0,
        totalAmount: fallbackDoc.extractedData.totalAmount?.value || 0,
      },
    ],
    subtotal:
      (fallbackDoc.extractedData.quantity?.value || 1) *
      (fallbackDoc.extractedData.unitPrice?.value || 0),
    taxTotal: fallbackDoc.extractedData.taxAmount?.value || 0,
    discountTotal: fallbackDoc.extractedData.discount?.value || 0,
    grandTotal: fallbackDoc.extractedData.totalAmount?.value || 0,
  };

  return {
    source: "DETERMINISTIC_PARSER",
    extraction: fallbackExtraction,
    stagedDocument: fallbackDoc,
    validation: {
      passed: fallbackDoc.arithmeticValidation.passed,
      calculatedTotal: fallbackDoc.arithmeticValidation.calculatedTotal,
      difference: fallbackDoc.arithmeticValidation.difference,
      discrepancyMessage: fallbackDoc.arithmeticValidation.message,
    },
  };
}
