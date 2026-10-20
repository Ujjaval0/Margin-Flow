export const DOCUMENT_BUCKET = 'marginflow-private-documents';
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  txt: 'text/plain', csv: 'text/csv',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export interface UploadedDocument {
  name: string; size: number; type: string; savedFileName: string;
}
export function documentMetadata(name: unknown, size: unknown, type: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.length > 255 || /[\\/\x00-\x1f]/.test(name))
    throw Error('Invalid document filename.');
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const contentType = Object.prototype.hasOwnProperty.call(MIME_TYPES, extension) ? MIME_TYPES[extension] : undefined;
  if (!contentType) throw Error('Only PDF, images, CSV, Excel and TXT documents are supported.');
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > MAX_DOCUMENT_SIZE)
    throw Error('Each document must contain data and be no larger than 10MB.');
  const compatibleCsv = extension === 'csv' && (type === 'application/vnd.ms-excel' || type === 'text/plain');
  if (typeof type !== 'string' || (type && type !== 'application/octet-stream' && type.toLowerCase() !== contentType && !compatibleCsv))
    throw Error('Document content type does not match its filename.');
  return { name, size, type: contentType, extension };
}
