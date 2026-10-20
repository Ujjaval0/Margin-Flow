import crypto from "crypto";
import { pool } from "@/lib/db";
import { Order } from "@/domain/types";
import { upsertOrders } from "./order-persistence";

/** Receipt and ledger mutations commit together; a failed delivery remains retryable. */
export async function persistWebhookOrder(connection: { id: string; userId: string }, eventId: string, body: Buffer, order: Order) {
  if (!eventId || eventId.length > 255) throw new Error("A stable webhook delivery ID is required.");
  const client = await pool.connect();
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  try {
    await client.query("BEGIN");
    const active = await client.query("SELECT id FROM marketplace_connections WHERE user_id=$1 AND id=$2 AND is_active=TRUE FOR SHARE", [connection.userId, connection.id]);
    if (!active.rows.length) throw new Error("Store connection is unavailable.");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify([connection.id, eventId])]);
    const receipt = await client.query("SELECT body_hash FROM webhook_receipts WHERE connection_id = $1 AND event_id = $2", [connection.id, eventId]);
    if (receipt.rows.length) {
      if (receipt.rows[0].body_hash !== hash) throw new Error("Webhook delivery ID has conflicting contents.");
      await client.query("COMMIT");
      return { isDuplicate: true };
    }
    await upsertOrders(connection.userId, [order], client);
    await client.query("INSERT INTO webhook_receipts (connection_id, event_id, user_id, body_hash) VALUES ($1, $2, $3, $4)", [connection.id, eventId, connection.userId, hash]);
    await client.query("COMMIT");
    return { isDuplicate: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
