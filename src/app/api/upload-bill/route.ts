import { NextRequest, NextResponse } from "next/server";
import { RequestBodyError } from "@/lib/security/request-body";
import { checkProcessingBudget } from "@/lib/security/api-guard";
import { processAndStageDocument } from "@/lib/ocr/extractor";
import { getSessionUserId } from "@/lib/security/session";
import { readDocumentInputs, storeDocument, DocumentStorageError } from "@/lib/security/document-storage";
import { documentMetadata } from "@/lib/document-files";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required to upload documents to the vault." }, { status: 401 });
    const budgetError = checkProcessingBudget(request, userId);
    if (budgetError) return budgetError;
    const { files, fileType: customType } = await readDocumentInputs(request, userId, 50);
    const stagedDocuments = [];
    const results = [];
    const errors: { fileName: string; error: string }[] = [];
    for (const file of files) {
      try {
        documentMetadata(file.name, file.size, file.type);
        const buffer = Buffer.from(await file.arrayBuffer());
        // Durable private bytes are saved before document metadata is acknowledged.
        const savedFileName = file.storedName || await storeDocument(userId, file, buffer);
        const savedPath = `/api/documents/stream?file=${savedFileName}`;
        const extraction = await processAndStageDocument(userId, file.name, savedPath, buffer, { customType, mimeType: file.type });
        stagedDocuments.push(extraction.stagedDocument);
        results.push({ fileName: file.name, savedPath, fileSize: file.size, sourceEngine: extraction.sourceEngine, dbRecordId: extraction.dbRecordId });
      } catch (error) {
        errors.push({ fileName: file.name, error: error instanceof Error ? error.message : "Failed to process file." });
      }
    }
    if (!stagedDocuments.length && errors.length) return NextResponse.json({ success: false, error: errors.map(e => `${e.fileName}: ${e.error}`).join('; '), errors }, { status: 400 });
    return NextResponse.json({ success: true, count: stagedDocuments.length, stagedDocuments,
      stagedDocument: stagedDocuments[0], results, errors: errors.length ? errors : undefined }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestBodyError || error instanceof DocumentStorageError)
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Failed to process document upload." }, { status: 500 });
  }
}
