import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { processDocumentOCR } from "@/domain/ocr-engine";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Maximum

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".csv",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/octet-stream", // Fallback for some desktop browsers sending generic stream for CSV/PDF
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customType = formData.get("fileType") as
      | "SUPPLIER_BILL"
      | "INVOICE"
      | "SETTLEMENT_REPORT"
      | undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file was uploaded." },
        { status: 400 }
      );
    }

    // 1. Guard against unbounded memory / large payloads (DoS)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 10MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        },
        { status: 413 }
      );
    }

    // 2. Validate file extension and MIME type
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: `Disallowed file type "${fileExtension}". Only PDF, images (PNG, JPG, WEBP), TXT, and CSV documents are permitted.`,
        },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Disallowed MIME type "${file.type}". Please upload a standard invoice document or image.`,
        },
        { status: 400 }
      );
    }

    // 3. Read buffer safely within verified size limits
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Ensure uploads directory exists: public/uploads/bills
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "bills");
    await fs.mkdir(uploadsDir, { recursive: true });

    // 5. Generate secure, cryptographically random filename with strict path containment
    const safeRandomToken = crypto.randomUUID().slice(0, 8);
    const sanitizedBase = path
      .basename(file.name, fileExtension)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const savedFileName = `${Date.now()}-${sanitizedBase}-${safeRandomToken}${fileExtension}`;
    const destinationPath = path.join(uploadsDir, savedFileName);

    // Ensure resolved path does not escape the upload directory (Path Traversal Protection)
    if (!destinationPath.startsWith(uploadsDir)) {
      return NextResponse.json(
        { success: false, error: "Invalid file path traversal detected." },
        { status: 400 }
      );
    }

    // Save physical file into directory
    await fs.writeFile(destinationPath, buffer);

    // 6. Extract textual content if text-based or provide honest scan summary
    let textContent = "";
    if (fileExtension === ".txt" || fileExtension === ".csv" || file.type === "text/plain" || file.type === "text/csv") {
      try {
        textContent = buffer.toString("utf-8");
      } catch {
        textContent = `[Document Text: ${file.name}]`;
      }
    } else {
      // For binary scans (PDF, PNG, JPG), provide metadata header
      textContent = `[Binary Scan: ${file.name}]\nFormat: ${fileExtension.toUpperCase()}\nSize: ${(file.size / 1024).toFixed(1)} KB`;
    }

    // Process document through OCR & IDP extraction engine
    const stagedDocument = processDocumentOCR(file.name, textContent, customType);

    return NextResponse.json({
      success: true,
      savedPath: `/uploads/bills/${savedFileName}`,
      fileName: file.name,
      fileSize: file.size,
      stagedDocument,
    });
  } catch (error: any) {
    console.error("Error in /api/upload-bill:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process bill upload.",
      },
      { status: 500 }
    );
  }
}
