/** Internal identity is independent of a human reference or the wall clock. */
export function createRecordId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
