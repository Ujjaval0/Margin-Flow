import crypto from "crypto";
import path from "path";
import { createClient } from '@supabase/supabase-js';
import { DOCUMENT_BUCKET, documentMetadata, type UploadedDocument } from '@/lib/document-files';
import { readFormBody, readJsonBody, RequestBodyError } from './request-body';

function bucket() {
  if (typeof window !== 'undefined') throw Error('Private document credentials are server-only.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new DocumentStorageError('Private document storage is not configured.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(DOCUMENT_BUCKET);
}
export class DocumentStorageError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export function documentObjectPath(owner: string, file: string): string {
  if (!owner || !file || file !== path.basename(file) || /[\\/\x00-\x1f"]/.test(file) || file.includes('..'))
    throw new DocumentStorageError('Invalid document filename.', 400);
  return crypto.createHash('sha256').update(owner).digest('hex') + '/' + file;
}
export async function signDocumentUpload(owner: string, input: { name: unknown; size: unknown; type: unknown }) {
  const metadata = documentMetadata(input.name, input.size, input.type);
  const savedFileName = crypto.randomUUID() + '.' + metadata.extension;
  const objectPath = documentObjectPath(owner, savedFileName);
  const { data, error } = await bucket().createSignedUploadUrl(objectPath, { upsert: false });
  if (error || !data) throw new DocumentStorageError('Unable to authorize document upload.');
  return { name: metadata.name, size: metadata.size, type: metadata.type, savedFileName,
    path: objectPath, token: data.token };
}
export async function storeDocument(owner: string, file: { name: string; size: number; type: string }, bytes: Buffer) {
  const metadata = documentMetadata(file.name, file.size, file.type);
  if (metadata.size !== bytes.length) throw new DocumentStorageError('Document size does not match its metadata.', 400);
  const name = crypto.randomUUID() + '.' + metadata.extension;
  const { error } = await bucket().upload(documentObjectPath(owner, name), bytes, { contentType: metadata.type, upsert: false });
  if (error) throw new DocumentStorageError('Document could not be saved.');
  return name;
}
export async function downloadDocument(owner: string, reference: UploadedDocument) {
  const metadata = documentMetadata(reference.name, reference.size, reference.type);
  if (typeof reference.savedFileName !== 'string' || !/^[0-9a-f-]{36}\.[a-z]+$/.test(reference.savedFileName)
    || !reference.savedFileName.endsWith('.' + metadata.extension))
    throw new DocumentStorageError('Invalid uploaded document reference.', 400);
  const { data, error } = await bucket().download(documentObjectPath(owner, reference.savedFileName));
  if (error || !data) throw new DocumentStorageError('Uploaded document is unavailable.', 404);
  if (data.size !== metadata.size || (data.type && data.type.split(';')[0] !== metadata.type))
    throw new DocumentStorageError('Uploaded document does not match its declared metadata.', 400);
  return data;
}
export async function signDocumentDownload(owner: string, name: string) {
  const { data, error } = await bucket().createSignedUrl(documentObjectPath(owner, name), 60);
  if (error || !data) throw new DocumentStorageError('Document is unavailable.', 404);
  return data.signedUrl;
}
export interface DocumentInput {
  name: string; size: number; type: string; storedName?: string; arrayBuffer(): Promise<ArrayBuffer>;
}
/** JSON references keep large file bytes out of Vercel requests; multipart remains compatible. */
export async function readDocumentInputs(request: Request, owner: string, limit: number) {
  const files: DocumentInput[] = [];
  let fileType: unknown;
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await readJsonBody(request, 64 * 1024);
    if (!body || !Array.isArray(body.documents) || !body.documents.length || body.documents.length > limit)
      throw new RequestBodyError('Invalid document batch.', 400);
    if (body.documents.reduce((total: number, item: UploadedDocument) => total + (typeof item?.size === 'number' ? item.size : Infinity), 0) > 50 * 1024 * 1024)
      throw new RequestBodyError('Process at most 50MB of documents per request.', 413);
    fileType = body.fileType;
    for (const reference of body.documents) {
      if (!reference || typeof reference !== 'object') throw new RequestBodyError('Invalid document reference.', 400);
      let blob;
      try { blob = await downloadDocument(owner, reference); }
      catch (error) { if (error instanceof DocumentStorageError) throw error; throw new RequestBodyError('Invalid document reference.', 400); }
      files.push({ name: reference.name, size: blob.size, type: documentMetadata(reference.name, reference.size, reference.type).type, storedName: reference.savedFileName,
        arrayBuffer: () => blob.arrayBuffer() });
    }
  } else {
    const form = await readFormBody(request);
    fileType = form.get('fileType');
    for (const value of [...form.getAll('files'), ...form.getAll('file')])
      if (value && typeof value === 'object' && 'name' in value) files.push(value);
    if (!files.length || files.length > limit) throw new RequestBodyError('Invalid document batch.', 400);
  }
  if (fileType != null && !['SUPPLIER_BILL','INVOICE','SETTLEMENT_REPORT','SHIPPING_LABEL','CLAIM_DOC'].includes(String(fileType)))
    throw new RequestBodyError('Invalid document type.', 400);
  return { files, fileType: (fileType == null ? undefined : fileType) as 'SUPPLIER_BILL' | 'INVOICE' | 'SETTLEMENT_REPORT' | undefined };
}
