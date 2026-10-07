import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFiles: File[] = [];

    const filesList = formData.getAll("files");
    const fileList = formData.getAll("file");

    for (const item of [...filesList, ...fileList]) {
      if (item && typeof item === "object" && "name" in item && "size" in item) {
        rawFiles.push(item as File);
      }
    }

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided." },
        { status: 400 }
      );
    }

    const results: Array<{
      fileName: string;
      fileType: string;
      text: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const file of rawFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let extractedText = "";

        if (ext === "pdf" || file.type === "application/pdf") {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { PDFParse } = require("pdf-parse");
          const parser = new PDFParse({ data: buffer });
          const res = await parser.getText();
          await parser.destroy();
          extractedText = res?.text?.trim() || "";
        } else if (
          [".png", ".jpg", ".jpeg", ".webp"].includes(`.${ext}`) ||
          file.type.startsWith("image/")
        ) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Tesseract = require("tesseract.js");
            const { data } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
            extractedText = data?.text?.trim() || "";
          } catch (tessErr: any) {
            console.warn("OCR fallback error:", tessErr);
          }
        } else {
          // CSV / TXT / Plain Text
          extractedText = buffer.toString("utf-8");
        }

        results.push({
          fileName: file.name,
          fileType: ext.toUpperCase(),
          text: extractedText,
          success: true,
        });
      } catch (err: any) {
        console.warn(`Extraction error for ${file.name}:`, err);
        results.push({
          fileName: file.name,
          fileType: ext.toUpperCase(),
          text: "",
          success: false,
          error: err.message || "Failed to extract text from file.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Error in /api/extract-invoice-text:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to extract invoice text." },
      { status: 500 }
    );
  }
}
