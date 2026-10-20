import { query } from "@/lib/db";
import { encryptPayload } from "@/lib/security/encryption";

/** Missing provider prices are retained as encrypted source evidence, never invented ledger amounts. */
export async function deferProviderOrder(owner: string, connectionId: string, sourceId: string, payload: any, reason: string) {
  await query(`INSERT INTO provider_deferred_orders(user_id,connection_id,source_id,reason,encrypted_payload)
    SELECT $1,$2,$3,$4,$5 WHERE EXISTS(SELECT 1 FROM marketplace_connections WHERE user_id=$1 AND id=$2 AND is_active=TRUE)
    ON CONFLICT(connection_id,source_id) DO UPDATE SET reason=EXCLUDED.reason, encrypted_payload=EXCLUDED.encrypted_payload,updated_at=NOW()`,
    [owner, connectionId, sourceId, reason, encryptPayload({ source: payload })]);
}

export async function resolveDeferredOrders(owner: string, connectionId: string, sourceIds: string[]) {
  if (sourceIds.length) await query("DELETE FROM provider_deferred_orders WHERE user_id=$1 AND connection_id=$2 AND source_id=ANY($3::text[])", [owner, connectionId, sourceIds]);
}
