import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { processDocumentOCR } from "@/domain/ocr-engine";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customType = formData.get("fileType") as "SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT" | undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file was uploaded." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists: public/uploads/bills
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "bills");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate safe filename with timestamp
    const safeTimestamp = Date.now();
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const savedFileName = `${safeTimestamp}-${sanitizedOriginalName}`;
    const destinationPath = path.join(uploadsDir, savedFileName);

    // Save physical file into directory
    await fs.writeFile(destinationPath, buffer);

    // Try reading text content if text-based or extract string representation
    let textContent = "";
    try {
      textContent = buffer.toString("utf-8");
      // If predominantly binary characters, keep a standard fallback description
      const nonPrintableCount = (textContent.match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
      if (nonPrintableCount > 20) {
        textContent = `[Binary Document Scan - ${file.name}]\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nUploaded: ${new Date().toLocaleString()}`;
      }
    } catch {
      textContent = `[Document Scan: ${file.name}]`;
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
