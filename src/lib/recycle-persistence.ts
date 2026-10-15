import type { PoolClient } from "pg";
import type { ArchivePatch } from "@/domain/recycle-bin";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { recoverMissingRecords } from "@/lib/recovered-records";

/** Archive and its relational visibility changes share one transaction. */
export async function persistArchivePatch(client: PoolClient, owner: string, patch: ArchivePatch, restore: boolean) {
  const before = restore ? patch.after : patch.before;
  const after = restore ? patch.before : patch.after;
  for (const product of before.products) {
    const replacement = after.products.find(row => row.id === product.id);
    const result = await client.query("SELECT stock_quantity, deleted_at FROM products WHERE user_id = $1 AND sku = $2 FOR UPDATE", [owner, product.sku]);
    if (result.rows.length && (result.rows[0].deleted_at || Number(result.rows[0].stock_quantity) !== (product.stockQuantity || 0))) throw Error("Catalog changed during archival.");
    if (!replacement) await client.query("UPDATE products SET deleted_at = NOW() WHERE user_id = $1 AND sku = $2 AND deleted_at IS NULL", [owner, product.sku]);
  }
  for (const product of after.products) {
    const old = before.products.find(row => row.id === product.id);
    if (old) {
      await client.query("UPDATE products SET stock_quantity = $3 WHERE user_id = $1 AND sku = $2 AND deleted_at IS NULL", [owner, product.sku, product.stockQuantity || 0]);
    } else {
      const existing = await client.query("SELECT deleted_at FROM products WHERE user_id = $1 AND sku = $2 FOR UPDATE", [owner, product.sku]);
      if (existing.rows.length && !existing.rows[0].deleted_at) throw Error("Product already exists.");
      await client.query(`INSERT INTO products (id, user_id, display_id, sku, name, category, brand, current_cost_price, active, stock_quantity)
        VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (user_id, sku) DO UPDATE SET deleted_at = NULL`, [owner, product.id, product.sku, product.name, product.category, product.brand, product.currentCostPrice, product.active, product.stockQuantity || 0]);
    }
  }
  for (const order of before.orders) {
    if (!after.orders.some(row => row.id === order.id)) {
      const existing = await client.query("SELECT deleted_at FROM orders WHERE user_id = $1 AND display_id = $2 FOR UPDATE", [owner, order.id]);
      if (existing.rows[0]?.deleted_at) throw Error("Order is already archived.");
      await client.query("UPDATE orders SET deleted_at = NOW() WHERE user_id = $1 AND display_id = $2 AND deleted_at IS NULL", [owner, order.id]);
    }
  }
  for (const order of after.orders) {
    const old = before.orders.find(row => row.id === order.id);
    if (!old) {
      const existing = await client.query("SELECT deleted_at FROM orders WHERE user_id = $1 AND marketplace = $2 AND channel_order_id = $3 FOR UPDATE", [owner, order.marketplace, order.channelOrderId]);
      if (existing.rows.length && !existing.rows[0].deleted_at) throw Error("Order already exists.");
      await client.query("UPDATE orders SET deleted_at = NULL WHERE user_id = $1 AND display_id = $2", [owner, order.id]);
      await upsertOrders(owner, [order], client);
    } else {
      // Related return/claim recovery changes only lifecycle facts; never replace newer prices or costs.
      const updated = await client.query("UPDATE orders SET status = $3 WHERE user_id = $1 AND display_id = $2 AND status = $4 AND deleted_at IS NULL RETURNING id", [owner, order.id, order.status, old.status]);
      if (!updated.rows.length) {
        const existing = await client.query("SELECT id FROM orders WHERE user_id = $1 AND display_id = $2", [owner, order.id]);
        if (existing.rows.length) throw Error("Related order changed.");
        await upsertOrders(owner, [order], client);
      }
      for (const item of order.items) {
        const original = old.items.find(row => row.id === item.id);
        if (!original || original.returnedQuantity === item.returnedQuantity) continue;
        const changed = await client.query("UPDATE order_items i SET returned_quantity = $3 FROM orders o WHERE i.order_id = o.id AND o.user_id = $1 AND o.display_id = $2 AND i.display_id = $4 AND i.returned_quantity = $5 RETURNING i.id", [owner, order.id, item.returnedQuantity, item.id, original.returnedQuantity]);
        if (updated.rows.length && !changed.rows.length) throw Error("Returned quantity changed.");
      }
    }
  }
  for (const [domain, table] of [["returns", "return_records"], ["claims", "claims"], ["settlements", "settlements"], ["expenses", "expenses"]] as const) {
    for (const record of before[domain]) if (!after[domain].some(row => row.id === record.id)) {
      const ownership = domain === "expenses" || domain === "settlements" ? "t.user_id = $1" : "EXISTS (SELECT 1 FROM orders o WHERE o.id = t.order_id AND o.user_id = $1)";
      await client.query(`UPDATE ${table} t SET deleted_at = NOW() WHERE ${ownership} AND t.display_id = $2 AND t.deleted_at IS NULL`, [owner, record.id]);
    }
    for (const record of after[domain]) if (!before[domain].some(row => row.id === record.id)) {
      const ownership = domain === "expenses" || domain === "settlements" ? "t.user_id = $1" : "EXISTS (SELECT 1 FROM orders o WHERE o.id = t.order_id AND o.user_id = $1)";
      const existing = await client.query(`SELECT t.deleted_at FROM ${table} t WHERE ${ownership} AND t.display_id = $2 FOR UPDATE`, [owner, record.id]);
      if (existing.rows.some(row => !row.deleted_at)) throw Error("A related record already exists.");
      await client.query(`UPDATE ${table} t SET deleted_at = NULL WHERE ${ownership} AND t.display_id = $2 AND t.deleted_at IS NOT NULL`, [owner, record.id]);
    }
  }
  if (restore) await recoverMissingRecords(client, owner, after);
}
