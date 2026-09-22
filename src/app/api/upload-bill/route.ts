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

const MAX_FILES_PER_BATCH = 50;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // Gather all uploaded files from 'files' or 'file' keys
    const rawFiles: File[] = [];
    const filesList = formData.getAll("files");
    const fileList = formData.getAll("file");
    
    for (const item of [...filesList, ...fileList]) {
      if (item && typeof item === "object" && "name" in item && "size" in item) {
        rawFiles.push(item as File);
      }
    }

    const customType = formData.get("fileType") as
      | "SUPPLIER_BILL"
      | "INVOICE"
      | "SETTLEMENT_REPORT"
      | undefined;

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files were uploaded. Please select one or more documents." },
        { status: 400 }
      );
    }

    if (rawFiles.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        {
          success: false,
          error: `Batch limit exceeded. Maximum ${MAX_FILES_PER_BATCH} documents can be uploaded at one time (received ${rawFiles.length}).`,
        },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "bills");
    await fs.mkdir(uploadsDir, { recursive: true });

    const stagedDocuments = [];
    const results = [];
    const errors: { fileName: string; error: string }[] = [];

    for (const file of rawFiles) {
      try {
        // 1. Guard against unbounded memory / large payloads (DoS)
        if (file.size > MAX_FILE_SIZE) {
          errors.push({
            fileName: file.name,
            error: `File exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
          });
          continue;
        }

        // 2. Validate file extension and MIME type
        const fileExtension = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
          errors.push({
            fileName: file.name,
            error: `Disallowed extension "${fileExtension}". Only PDF, images, CSV, and TXT are permitted.`,
          });
          continue;
        }

        if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
          errors.push({
            fileName: file.name,
            error: `Disallowed MIME type "${file.type}".`,
          });
          continue;
        }

        // 3. Read buffer safely
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 4. Generate secure unique filename
        const safeRandomToken = crypto.randomUUID().slice(0, 8);
        const sanitizedBase = path
          .basename(file.name, fileExtension)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 40);
        const savedFileName = `${Date.now()}-${sanitizedBase}-${safeRandomToken}${fileExtension}`;
        const destinationPath = path.join(uploadsDir, savedFileName);

        if (!destinationPath.startsWith(uploadsDir)) {
          errors.push({ fileName: file.name, error: "Invalid path traversal detected." });
          continue;
        }

        await fs.writeFile(destinationPath, buffer);

        // 5. Extract textual content
        let textContent = "";
        if (
          fileExtension === ".txt" ||
          fileExtension === ".csv" ||
          file.type === "text/plain" ||
          file.type === "text/csv"
        ) {
          try {
            textContent = buffer.toString("utf-8");
          } catch {
            textContent = `[Document Text: ${file.name}]`;
          }
        } else {
          textContent = `[Document Scan: ${file.name}]\nFormat: ${fileExtension.toUpperCase()}\nSize: ${(file.size / 1024).toFixed(1)} KB`;
        }

        // 6. Process through OCR engine
        const stagedDocument = processDocumentOCR(file.name, textContent, customType);
        stagedDocuments.push(stagedDocument);
        results.push({
          fileName: file.name,
          savedPath: `/uploads/bills/${savedFileName}`,
          fileSize: file.size,
        });
      } catch (fileErr: any) {
        errors.push({
          fileName: file.name,
          error: fileErr.message || "Failed to process file.",
        });
      }
    }

    if (stagedDocuments.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors.map((e) => `${e.fileName}: ${e.error}`).join("; "),
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: stagedDocuments.length,
      stagedDocuments,
      stagedDocument: stagedDocuments[0], // backward compatibility
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error in /api/upload-bill:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process document upload.",
      },
      { status: 500 }
    );
  }
}
