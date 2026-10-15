import type { LedgerData } from "./snapshot-validation";
import { getOrderFinancialFacts } from "./order-financials";

export type RecycleType = "orders" | "returns" | "claims" | "expenses" | "products";
export interface ArchivePatch { before: LedgerData; after: LedgerData }
export interface ArchivedRecord { id: string; displayId: string; type: RecycleType; label: string; sublabel: string; deletedAt: string; daysRemaining: number }
export const emptyLedger = (): LedgerData => ({ products: [], orders: [], returns: [], settlements: [], claims: [], suppliers: [], purchases: [], expenses: [], aiDocuments: [], auditLogs: [], complaints: [], acknowledgedLossLeaderSkus: [] });
const domains = ["products", "orders", "returns", "settlements", "claims", "expenses"] as const;
const canonical = (value: unknown): string | undefined => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

/** Keep an exact inverse of every affected row; never overwrite later edits on recovery. */
export function archiveRecords(data: LedgerData, type: RecycleType, ids: string[]): ArchivePatch {
  const selected = new Set(ids);
  const next = structuredClone(data);
  if (!data[type].some(row => selected.has(row.id))) throw new Error("Record no longer exists.");
  if (type === "orders") {
    const removed = data.orders.filter(order => selected.has(order.id));
    const linked = (record: { orderId: string; marketplace: string; channelOrderId?: string }) => removed.some(order => record.marketplace === order.marketplace && (record.orderId === order.id || record.orderId === order.channelOrderId || record.channelOrderId === order.channelOrderId));
    next.orders = next.orders.filter(order => !selected.has(order.id));
    next.returns = next.returns.filter(record => !linked(record));
    next.settlements = next.settlements.filter(record => !linked(record));
    next.claims = next.claims.filter(record => !linked(record));
    for (const product of next.products) {
      const returnedStock = removed.reduce((sum, order) => {
        const returned = getOrderFinancialFacts(order, data.returns, data.settlements, data.claims).lines.filter(line => line.sku === product.sku).reduce((units, line) => units + line.returnedUnits, 0);
        return sum + order.items.filter(item => item.sku === product.sku).reduce((units, item) => units + item.quantity, 0) - returned;
      }, 0);
      if (returnedStock) product.stockQuantity = (product.stockQuantity || 0) + returnedStock;
    }
  } else if (type === "returns") {
    const removed = data.returns.filter(record => selected.has(record.id));
    next.returns = next.returns.filter(record => !selected.has(record.id));
    const claimIds = new Set(removed.map(record => record.claimId).filter(Boolean));
    next.claims = next.claims.filter(claim => !claimIds.has(claim.id) && (!claim.returnId || !selected.has(claim.returnId)));
    for (const record of removed) {
      if (record.restockStatus === "RESTOCKED") {
        const product = next.products.find(product => product.sku === record.sku);
        if (!product || (product.stockQuantity || 0) < record.quantity) throw new Error("Restocked units have been used; reconcile inventory before deleting this return.");
        product.stockQuantity = (product.stockQuantity || 0) - record.quantity;
      }
      for (const order of next.orders.filter(order => order.marketplace === record.marketplace && (order.id === record.orderId || order.channelOrderId === record.channelOrderId))) {
        let remaining = record.quantity;
        order.items = order.items.map(item => {
          if (item.sku !== record.sku) return item;
          const decrement = Math.min(item.returnedQuantity || 0, remaining);
          remaining -= decrement;
          return { ...item, returnedQuantity: (item.returnedQuantity || 0) - decrement };
        });
        order.returnIds = order.returnIds?.filter(id => !selected.has(id));
        order.claimIds = order.claimIds?.filter(id => next.claims.some(claim => claim.id === id));
        const count = order.items.reduce((sum, item) => sum + item.returnedQuantity, 0);
        order.status = count === 0 ? "DELIVERED" : count < order.items.reduce((sum, item) => sum + item.quantity, 0) ? "PARTIALLY_RETURNED" : order.status;
      }
    }
  } else if (type === "claims") {
    next.claims = next.claims.filter(claim => !selected.has(claim.id));
    next.returns = next.returns.map(record => selected.has(record.claimId || "") ? { ...record, claimId: undefined } : record);
    next.orders = next.orders.map(order => {
      if (!order.claimIds?.some(id => selected.has(id)) && !data.claims.some(claim => selected.has(claim.id) && claim.marketplace === order.marketplace && (claim.orderId === order.id || claim.orderId === order.channelOrderId))) return order;
      const claimIds = order.claimIds?.filter(id => !selected.has(id));
      const hasClaims = next.claims.some(claim => claim.marketplace === order.marketplace && (claim.orderId === order.id || claim.orderId === order.channelOrderId));
      const status = !hasClaims && ["CLAIM_PENDING", "CLAIM_APPROVED"].includes(order.status) ? (order.returnIds?.length ? "DAMAGED_RETURN" : "DELIVERED") : order.status;
      return { ...order, claimIds, status };
    });
  } else if (type === "expenses") next.expenses = next.expenses.filter(record => !selected.has(record.id));
  else next.products = next.products.filter(record => !selected.has(record.id));

  const before = emptyLedger(), after = emptyLedger();
  for (const domain of domains) {
    const old = data[domain] as { id: string }[], fresh = next[domain] as { id: string }[];
    const changed = new Set([...old, ...fresh].filter(row => canonical(old.find(item => item.id === row.id)) !== canonical(fresh.find(item => item.id === row.id))).map(row => row.id));
    (before[domain] as { id: string }[]) = old.filter(row => changed.has(row.id));
    (after[domain] as { id: string }[]) = fresh.filter(row => changed.has(row.id));
  }
  return { before, after };
}

export function applyArchivePatch(data: LedgerData, patch: ArchivePatch, restore = false): LedgerData {
  const expected = restore ? patch.after : patch.before, replacement = restore ? patch.before : patch.after;
  const next = { ...data };
  for (const domain of domains) {
    const rows = data[domain] as { id: string }[], old = expected[domain] as { id: string }[], fresh = replacement[domain] as { id: string }[];
    const affected = new Set([...old, ...fresh].map(row => row.id));
    for (const id of affected) if (canonical(rows.find(row => row.id === id)) !== canonical(old.find(row => row.id === id))) throw new Error("A related record changed. Reconcile it before restoring this archive.");
    (next[domain] as { id: string }[]) = [...rows.filter(row => !affected.has(row.id)), ...fresh];
  }
  if (new Set(next.products.map(row => row.sku)).size !== next.products.length || new Set(next.orders.map(row => JSON.stringify([row.marketplace, row.channelOrderId]))).size !== next.orders.length) throw new Error("A record with the same business identity already exists.");
  return next;
}
