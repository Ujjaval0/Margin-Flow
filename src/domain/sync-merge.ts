import { Order, Settlement } from "./types";

export const orderIdentity = (order: Order): string => JSON.stringify([order.marketplace, order.channelOrderId || order.id]);
const settlementIdentity = (settlement: Settlement): string => JSON.stringify(settlement.id ? [settlement.marketplace, settlement.id] : [settlement.marketplace, settlement.settlementBatchId, settlement.orderId]);

/** Append while indexing; prepending during a batch invalidates existing indexes. */
function merge<T>(previous: T[], incoming: T[], identity: (row: T) => string, update: (old: T, row: T) => T) {
  const rows = [...previous];
  const positions = new Map(rows.map((row, index) => [identity(row), index]));
  let added = 0;
  let updated = 0;
  for (const row of incoming) {
    const key = identity(row);
    const index = positions.get(key);
    if (index === undefined) {
      positions.set(key, rows.length);
      rows.push(row);
      added++;
    } else {
      rows[index] = update(rows[index], row);
      updated++;
    }
  }
  return { rows, added, updated };
}

export function mergeOrders(previous: Order[], incoming: Order[]) {
  return merge(previous, incoming, orderIdentity, (old, row) => ({
    ...old, ...row, id: old.id,
    items: row.items.map(item => {
      const existing = old.items.find(line => line.id === item.id);
      return existing ? { ...item, snapshotUnitCost: existing.snapshotUnitCost } : item;
    }),
  }));
}

export function mergeSettlements(previous: Settlement[], incoming: Settlement[]) {
  return merge(previous, incoming, settlementIdentity, (old, row) => ({ ...old, ...row, id: old.id }));
}
