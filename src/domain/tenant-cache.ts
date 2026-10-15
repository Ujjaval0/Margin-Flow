import { parseLedgerSnapshot } from "./snapshot-validation";
export const LEDGER_STORAGE_KEY = "MARGINFLOW_PERSISTENT_LEDGER_V3";

export function tenantLedgerKey(userId: string): string {
  if (!userId?.trim()) throw new Error("A verified tenant is required.");
  return `${LEDGER_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

/** Legacy unowned snapshots are never eligible for automatic account hydration. */
export function readTenantSnapshot(storage: Pick<Storage, "getItem">, userId: string): Record<string, any> | null {
  try {
    const raw = storage.getItem(tenantLedgerKey(userId));
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (snapshot.ownerId !== userId || snapshot.version !== 1 || !snapshot.data || typeof snapshot.data !== "object") return null;
    return parseLedgerSnapshot(raw, userId);
  } catch { return null; }
}
