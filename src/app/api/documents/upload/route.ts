import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/security/session';
import { rejectCrossOrigin } from '@/lib/security/api-guard';
import { TokenBucketRateLimiter } from '@/lib/security/rate-limiter';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';
import { signDocumentUpload, DocumentStorageError } from '@/lib/security/document-storage';

const uploadBudget = new TokenBucketRateLimiter({ capacity: 60, refillRatePerSec: 1 });

export async function POST(request: Request) {
  const owner = await getSessionUserId(request);
  if (!owner) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const budget = uploadBudget.consume(owner);
  if (!budget.allowed) return NextResponse.json({ success: false, error: 'Too many upload requests.' }, { status: 429, headers: { 'Retry-After': String(budget.retryAfterSeconds) } });
  try {
    const body = await readJsonBody(request, 64 * 1024);
    if (!body || !Array.isArray(body.files) || !body.files.length || body.files.length > 50)
      throw new RequestBodyError('Select between 1 and 50 documents.', 400);
    const documents = [];
    for (const file of body.files) {
      if (!file || typeof file !== 'object') throw new RequestBodyError('Invalid document metadata.', 400);
      documents.push(await signDocumentUpload(owner, file));
    }
    return NextResponse.json({ success: true, documents }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error instanceof RequestBodyError || error instanceof DocumentStorageError ? error.status : 400;
    return NextResponse.json({ success: false, error: status === 503 ? 'Document storage is unavailable.' : 'Document upload could not be authorized. Check file type and size.' }, { status });
  }
}
