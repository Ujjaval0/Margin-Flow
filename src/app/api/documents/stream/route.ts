import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/security/session";
import { getDocumentDirectory } from "@/lib/security/document-storage";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce Authenticated Merchant Session
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required to access document vault." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawFileName = searchParams.get("file");

    if (!rawFileName || !rawFileName.trim()) {
      return NextResponse.json({ error: "Missing file parameter." }, { status: 400 });
    }

    // 2. Strict Path Traversal Defense
    const SECURE_VAULT_DIR = getDocumentDirectory(session.sub);
    const sanitizedFileName = path.basename(rawFileName.trim());
    if (sanitizedFileName !== rawFileName.trim() || /[\\/\x00-\x1f"]/.test(sanitizedFileName) || sanitizedFileName.includes("..")) {
      return NextResponse.json({ error: "Invalid file name parameter." }, { status: 400 });
    }

    const targetFilePath = path.join(SECURE_VAULT_DIR, sanitizedFileName);

    // Verify path containment inside SECURE_VAULT_DIR
    const resolvedPath = path.resolve(targetFilePath);
    if (path.dirname(resolvedPath) !== path.resolve(SECURE_VAULT_DIR)) {
      return NextResponse.json(
        { error: "Access denied. Illegal directory traversal attempt." },
        { status: 403 }
      );
    }

    // 3. Verify File Exists
    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      const ext = path.extname(sanitizedFileName).toLowerCase();
      const contentType = MIME_MAP[ext] || "application/octet-stream";

      const fileBuffer = await fs.readFile(resolvedPath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(stat.size),
          "Content-Disposition": `inline; filename="${sanitizedFileName}"`,
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }
      throw err;
    }
  } catch (error: any) {
    console.error("[Document Stream Error]:", error);
    return NextResponse.json(
      { error: "Failed to stream requested document." },
      { status: 500 }
    );
  }
}
