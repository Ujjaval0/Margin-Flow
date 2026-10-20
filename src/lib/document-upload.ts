import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { DOCUMENT_BUCKET, documentMetadata, type UploadedDocument } from './document-files';

/** File bytes travel straight to private Storage; only references go to the app. */
export async function uploadDocumentFiles(files: File[]): Promise<UploadedDocument[]> {
  const metadata = files.map(file => documentMetadata(file.name, file.size, file.type));
  const response = await fetch('/api/documents/upload', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: metadata }) });
  const result = await response.json();
  if (!response.ok || !result.success || !Array.isArray(result.documents) || result.documents.length !== files.length)
    throw Error(result.error || 'Unable to authorize document upload.');
  const storage = createSupabaseBrowserClient().storage.from(DOCUMENT_BUCKET);
  for (let index = 0; index < files.length; index++) {
    const target = result.documents[index];
    const { error } = await storage.uploadToSignedUrl(target.path, target.token, files[index], { contentType: target.type });
    if (error) throw Error(`Could not upload ${files[index].name}. Please retry.`);
  }
  return result.documents.map(({ name, size, type, savedFileName }: UploadedDocument) => ({ name, size, type, savedFileName }));
}
