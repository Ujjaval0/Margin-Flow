import path from "path";
import { processDocumentOCR } from "@/domain/ocr-engine";
import { executeIDPPipeline } from "@/domain/idp-pipeline";
import { query } from "@/lib/db";
import { AIStagedDocument, ExtractedField } from "@/domain/types";

export interface DocumentExtractionResult {
  stagedDocument: AIStagedDocument;
  rawText: string;
  sourceEngine: "GEMINI_MULTIMODAL" | "PDF_TEXT" | "TESSERACT_OCR" | "PLAIN_TEXT";
  dbRecordId?: string;
}

/**
 * Extracts raw textual content from buffer using the best available engine:
 * 1. PDF -> Digital PDF text parser (PDFParse)
 * 2. Image -> Tesseract Optical Character Recognition (OCR)
 * 3. Text/CSV -> UTF-8 decoding
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{ text: string; engine: DocumentExtractionResult["sourceEngine"] }> {
  const ext = path.extname(fileName).toLowerCase();

  // 1. Digital PDF extraction
  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      // Dynamic import to support various runtime environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      const text = result?.text?.trim() || "";
      if (text.length > 20) {
        return { text, engine: "PDF_TEXT" };
      }
    } catch (pdfErr) {
      console.warn("Digital PDF text extraction warning:", pdfErr);
    }
  }

  // 2. Image OCR via Tesseract.js
  if (
    [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(ext) ||
    mimeType?.startsWith("image/")
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Tesseract = require("tesseract.js");
      const { data } = await Tesseract.recognize(buffer, "eng", {
        logger: () => {},
      });
      const text = data?.text?.trim() || "";
      if (text.length > 5) {
        return { text, engine: "TESSERACT_OCR" };
      }
    } catch (ocrErr) {
      console.warn("Tesseract OCR warning:", ocrErr);
    }
  }

  // 3. Fallback for CSV / TXT / Plain Text
  try {
    const text = buffer.toString("utf-8");
    return { text, engine: "PLAIN_TEXT" };
  } catch {
    return {
      text: `[Scanned Document: ${fileName}]\nFormat: ${ext.toUpperCase()}`,
      engine: "PLAIN_TEXT",
    };
  }
}

/**
 * Full End-to-End Extraction Pipeline:
 * - Extracts text from file buffer
 * - Analyzes structured fields (Vendor, Invoice #, Line Items, GST, Totals)
 * - Verifies arithmetic consistency
 * - Cross-references catalog SKUs in PostgreSQL
 * - Persists staged document and fields directly into PostgreSQL
 */
export async function processAndStageDocument(
  fileName: string,
  fileUrl: string,
  fileBuffer: Buffer,
  options?: {
    customType?: "SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT";
    mimeType?: string;
  }
): Promise<DocumentExtractionResult> {
  const { text: rawText, engine } = await extractTextFromBuffer(
    fileBuffer,
    fileName,
    options?.mimeType
  );

  let stagedDoc: AIStagedDocument;

  // Try LLM Extraction if Gemini Key is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const idpResult = await executeIDPPipeline(fileName, rawText, {
        customType: options?.customType,
        apiKey: process.env.GEMINI_API_KEY,
      });
      stagedDoc = idpResult.stagedDocument;
    } catch (aiErr) {
      console.warn("LLM extraction failed, using deterministic OCR engine:", aiErr);
      stagedDoc = processDocumentOCR(fileName, rawText, options?.customType);
    }
  } else {
    stagedDoc = processDocumentOCR(fileName, rawText, options?.customType);
  }

  stagedDoc.fileUrl = fileUrl;

  // Cross-reference extracted SKU against database products table
  let catalogMatchedSku: string | undefined = undefined;
  const detectedSku = stagedDoc.extractedData.sku?.value;
  if (detectedSku) {
    try {
      const prodRes = await query(
        `SELECT sku, name FROM products WHERE active = TRUE AND (sku ILIKE $1 OR name ILIKE $1) LIMIT 1`,
        [`%${detectedSku}%`]
      );
      if (prodRes.rows.length > 0) {
        catalogMatchedSku = prodRes.rows[0].sku;
        stagedDoc.catalogValidation = {
          skuMatched: true,
          matchedSkuId: catalogMatchedSku,
        };
      } else {
        stagedDoc.catalogValidation = {
          skuMatched: false,
        };
      }
    } catch (dbErr) {
      console.warn("Catalog lookup error:", dbErr);
    }
  }

  // Persist directly to PostgreSQL (ai_staged_documents & ai_staged_fields)
  let dbRecordId: string | undefined;
  try {
    const displayId = `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const declaredTotal = stagedDoc.extractedData.totalAmount?.value || 0;
    const calculatedTotal =
      stagedDoc.arithmeticValidation?.calculatedTotal || declaredTotal;
    const diff = stagedDoc.arithmeticValidation?.difference || 0;
    const passed = stagedDoc.arithmeticValidation?.passed ?? true;
    const diffMsg = stagedDoc.arithmeticValidation?.message || null;

    const docInsertRes = await query(
      `
      INSERT INTO ai_staged_documents (
        display_id, file_name, file_url, file_type, status,
        raw_text_preview, arithmetic_passed, arithmetic_calculated,
        arithmetic_declared, arithmetic_difference, arithmetic_message,
        catalog_sku_matched, catalog_matched_sku_id, catalog_suggestion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, display_id;
    `,
      [
        displayId,
        fileName,
        fileUrl,
        stagedDoc.fileType,
        stagedDoc.status,
        rawText.slice(0, 1000),
        passed,
        calculatedTotal,
        declaredTotal,
        diff,
        diffMsg,
        stagedDoc.catalogValidation?.skuMatched || false,
        catalogMatchedSku || null,
        stagedDoc.catalogValidation?.suggestion || null,
      ]
    );

    if (docInsertRes.rows.length > 0) {
      dbRecordId = docInsertRes.rows[0].id;
      stagedDoc.id = docInsertRes.rows[0].display_id;

      // Insert individual extracted fields
      const fields = Object.entries(stagedDoc.extractedData) as [
        string,
        ExtractedField<any> | undefined,
      ][];

      for (const [fieldName, fieldData] of fields) {
        if (!fieldData || fieldData.value === undefined || fieldData.value === null) {
          continue;
        }

        const provenance =
          fieldData.provenance === "MANUALLY_MODIFIED"
            ? "MANUALLY_ENTERED"
            : "AI_EXTRACTED";

        await query(
          `
          INSERT INTO ai_staged_fields (
            document_id, field_name, value_text, confidence, provenance, is_flagged, anomaly_message
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (document_id, field_name) DO UPDATE
            SET value_text = EXCLUDED.value_text,
                confidence = EXCLUDED.confidence,
                is_flagged = EXCLUDED.is_flagged,
                anomaly_message = EXCLUDED.anomaly_message,
                updated_at = now();
        `,
          [
            dbRecordId,
            fieldName,
            String(fieldData.value),
            fieldData.confidence || 0.9,
            provenance,
            fieldData.isFlaggedAnomaly || false,
            fieldData.anomalyMessage || null,
          ]
        );
      }
    }
  } catch (persistErr) {
    console.warn("Failed to persist staged document to PostgreSQL:", persistErr);
  }

  return {
    stagedDocument: stagedDoc,
    rawText,
    sourceEngine: engine,
    dbRecordId,
  };
}
