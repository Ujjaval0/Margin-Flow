import { pool } from "@/lib/db";
import type { Order } from "@/domain/types";
import { upsertOrders as persistOrders } from "./order-persistence";
import { ProviderRequestError } from "./provider-http";

/** A disconnect and a ledger write serialize on the same owned connection row. */
export async function upsertOrders(owner: string, orders: Order[], connectionId?: string) {
  if (orders.length > 1000) throw new ProviderRequestError(413, true);
  if (!connectionId) return persistOrders(owner, orders);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const active = await client.query("SELECT id FROM marketplace_connections WHERE user_id=$1 AND id=$2 AND is_active=TRUE FOR SHARE", [owner, connectionId]);
    if (!active.rows.length) throw new ProviderRequestError(401, false);
    const result = await persistOrders(owner, orders, client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
