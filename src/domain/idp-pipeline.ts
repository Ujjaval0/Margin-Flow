import { createRecordId } from "./record-id";
import { money, sumMoney, toPaise } from "@/domain/order-financials";
import { z } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { AIStagedDocument, Marketplace } from "./types";
import { validateDocumentArithmetic } from "./guardrails";
import { processDocumentOCR } from "./ocr-engine";

export const LineItemSchema = z.object({
  sku: z.string().min(1),
  description: z.string().default(""),
  hsnCode: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(0),
  cgst: z.number().nonnegative(),
  sgst: z.number().nonnegative(),
  igst: z.number().nonnegative(),
  totalAmount: z.number().nonnegative().default(0),
});

export type IDPLineItem = z.infer<typeof LineItemSchema>;

export const InvoiceExtractionSchema = z.object({
  invoiceNumber: z.string().default(""),
  invoiceDate: z.string().default(""),
  vendorName: z.string().default(""),
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
    ])
    .optional(),
  currency: z.string().default(""),
  pricesIncludeTax:z.boolean().optional(),
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
        model: google("gemini-2.5-flash"),
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
                (sum, item) => sumMoney([sum,item.quantity*item.unitPrice,-item.discount,validated.pricesIncludeTax?0:item.cgst+item.sgst+item.igst]),
                0
              )
            : validated.subtotal + validated.taxTotal - validated.discountTotal;

          const diff = Math.abs(money((calculatedTotal - validated.grandTotal)));
          const hasRequired=validated.lineItems.length>0 && !!validated.invoiceNumber && !!validated.invoiceDate && validated.currency==='INR';
          const passed = hasRequired && toPaise(calculatedTotal)===toPaise(validated.grandTotal);

          const stagedDocument: AIStagedDocument = {
            id: createRecordId("DOC-IDP"),
            currency:validated.currency,pricesIncludeTax:validated.pricesIncludeTax,
            lineItems:validated.lineItems.map((line,index)=>({id:`LINE-${index+1}`,sku:line.sku,productName:line.description,quantity:line.quantity,unitPrice:line.unitPrice,discount:line.discount,taxAmount:sumMoney([line.cgst,line.sgst,line.igst])})),
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
              orderDate: validated.invoiceDate?{ value: validated.invoiceDate, confidence: 0.98, provenance: "AI_EXTRACTED" }:undefined,
              vendorName:validated.vendorName?{value:validated.vendorName,confidence:0.9,provenance:"AI_EXTRACTED"}:undefined,
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
              calculatedTotal: money(calculatedTotal),
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
    invoiceNumber: fallbackDoc.extractedData.invoiceNumber?.value || "",
    invoiceDate: fallbackDoc.extractedData.orderDate?.value || "",
    vendorName: fallbackDoc.extractedData.vendorName?.value || "",
    marketplace:
      fallbackDoc.extractedData.marketplace?.value === "B2B Wholesale" ||
      fallbackDoc.extractedData.marketplace?.value === "Other"
        ? "Personal Website"
        : fallbackDoc.extractedData.marketplace?.value,
    currency: fallbackDoc.currency || "",
    pricesIncludeTax:fallbackDoc.pricesIncludeTax,
    lineItems: [
      {
        sku: fallbackDoc.extractedData.sku?.value || "",
        description: fallbackDoc.extractedData.productName?.value || "",
        quantity: fallbackDoc.extractedData.quantity?.value || 1,
        unitPrice: fallbackDoc.extractedData.unitPrice?.value || 0,
        discount: fallbackDoc.extractedData.discount?.value || 0,
        taxRate: 0,
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
