import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSessionUser } from "@/lib/security/session";
import { signDocumentDownload, DocumentStorageError } from "@/lib/security/document-storage";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Authentication required to access document vault." }, { status: 401 });
    const rawFileName = new URL(req.url).searchParams.get('file');
    if (!rawFileName?.trim()) return NextResponse.json({ error: 'Missing file parameter.' }, { status: 400 });
    // The account-derived object prefix is never accepted from the caller.
    const name = path.basename(rawFileName.trim());
    if (name !== rawFileName.trim() || /[\\/\x00-\x1f"]/.test(name) || name.includes('..'))
      return NextResponse.json({ error: 'Invalid file name parameter.' }, { status: 400 });
    const target = await signDocumentDownload(session.sub, name);
    // Storage serves the bytes directly, including documents beyond Vercel's response limit.
    const response = NextResponse.redirect(target, 307);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof DocumentStorageError ? error.message : 'Failed to retrieve document.' },
      { status: error instanceof DocumentStorageError ? error.status : 500 });
  }
}
