import crypto from "crypto";
import { after } from "next/server";
import { query } from "@/lib/db";
import { getConnectionById, updateSyncStatus } from "@/lib/security/marketplace-vault";
import { encryptPayload, decryptPayload } from "@/lib/security/encryption";
import { providerOperation } from "./connection-service";
import type { ApiPlatform } from "./connection-input";
import { persistWebhookOrder } from "./webhook-persistence";

export async function enqueueStoreSync(owner: string, connectionId: string) {
  const connection = await getConnectionById(owner, connectionId);
    if (!connection || !["Shopify", "WooCommerce", "Amazon India", "Flipkart"].includes(connection.marketplace)) throw new Error("Store connection is unavailable.");
  if (connection.credentialStatus !== "VERIFIED") throw new Error("Verify and save this store before synchronizing.");
  const result = await query(`INSERT INTO integration_tasks(user_id,connection_id,kind,dedupe_key) VALUES($1,$2,'ORDERS','ORDERS')
    ON CONFLICT(connection_id,kind,dedupe_key) DO UPDATE SET
      status=CASE WHEN integration_tasks.status='PROCESSING' THEN 'PROCESSING' ELSE 'QUEUED' END,
      available_at=NOW(), attempts=CASE WHEN integration_tasks.status='PROCESSING' THEN integration_tasks.attempts ELSE 0 END,
      result=CASE WHEN integration_tasks.status='PROCESSING' THEN integration_tasks.result ELSE NULL END,
      payload=CASE WHEN integration_tasks.status='PROCESSING' THEN integration_tasks.payload ELSE '{}'::jsonb END,
      error_message=NULL,updated_at=NOW() RETURNING id`, [owner, connectionId]);
  return result.rows[0].id as string;
}

export async function enqueueWebhook(connection: { id: string; userId: string }, eventId: string, bytes: Buffer, order: any) {
  if (!eventId || eventId.length > 255) throw new Error("Invalid delivery identifier.");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const result = await query(`INSERT INTO integration_tasks(user_id,connection_id,kind,dedupe_key,body_hash,encrypted_payload)
    SELECT $1,$2,'WEBHOOK',$3,$4,$5 WHERE EXISTS(SELECT 1 FROM marketplace_connections WHERE user_id=$1 AND id=$2 AND is_active=TRUE)
    ON CONFLICT(connection_id,kind,dedupe_key) DO UPDATE SET dedupe_key=EXCLUDED.dedupe_key
    WHERE integration_tasks.body_hash=EXCLUDED.body_hash RETURNING id,(xmax<>0) AS duplicate`,
    [connection.userId, connection.id, eventId, hash, encryptPayload({ rawBody: bytes.toString("base64"), order })]);
  if (!result.rows.length) throw new Error("Webhook delivery conflicts with an existing receipt.");
  dispatchIntegrationTasks(connection.userId, connection.id);
  return { isDuplicate: Boolean(result.rows[0].duplicate) };
}

export function dispatchIntegrationTasks(ownerId: string, connectionId: string) {
  after(async () => {
    try { await runIntegrationTasks({ ownerId, connectionId, limit: 8 }); }
    catch { console.error("Store processing deferred to durable queue recovery."); }
  });
}

export async function seedScheduledSyncs() {
  await query(`INSERT INTO integration_tasks(user_id,connection_id,kind,dedupe_key)
    SELECT user_id,id,'ORDERS','ORDERS' FROM marketplace_connections WHERE is_active=TRUE
      AND marketplace IN ('Shopify','WooCommerce','Amazon India','Flipkart') AND last_sync_status IN ('VERIFIED','SUCCEEDED','PARTIAL')
    ON CONFLICT(connection_id,kind,dedupe_key) DO NOTHING`);
  // Creation-date-only marketplace APIs need a separate historical lifecycle reconciliation.
  await query(`INSERT INTO integration_tasks(user_id,connection_id,kind,dedupe_key)
    SELECT user_id,id,'RECONCILE','RECONCILE' FROM marketplace_connections WHERE is_active=TRUE
      AND marketplace='Flipkart' AND last_sync_status IN ('VERIFIED','SUCCEEDED','PARTIAL')
    ON CONFLICT(connection_id,kind,dedupe_key) DO NOTHING`);
}

export async function runIntegrationTasks(filter: { ownerId?: string; connectionId?: string; limit?: number } = {}) {
  const deadline = Date.now() + 200_000;
  let processed = 0;
  while (processed < (filter.limit || 1) && Date.now() < deadline - 120_000) {
    await query(`UPDATE integration_tasks SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'QUEUED' END,lease_token=NULL,locked_at=NULL,available_at=NOW()
      WHERE status='PROCESSING' AND locked_at<NOW()-interval '5 minutes'
        AND ($1::uuid IS NULL OR user_id=$1) AND ($2::text IS NULL OR connection_id=$2)`, [filter.ownerId || null, filter.connectionId || null]);
    const claimed = await query(`WITH candidate AS (
      SELECT t.id FROM integration_tasks t JOIN marketplace_connections c ON c.id=t.connection_id AND c.user_id=t.user_id
      WHERE t.status='QUEUED' AND t.available_at<=NOW() AND c.is_active=TRUE
        AND ($1::uuid IS NULL OR t.user_id=$1) AND ($2::text IS NULL OR t.connection_id=$2)
      ORDER BY CASE WHEN t.kind='WEBHOOK' THEN 0 ELSE 1 END,t.available_at FOR UPDATE OF t SKIP LOCKED LIMIT 1
    ) UPDATE integration_tasks t SET status='PROCESSING',locked_at=NOW(),lease_token=gen_random_uuid(),attempts=attempts+1,updated_at=NOW(),
      result=CASE WHEN t.payload='{}'::jsonb THEN NULL ELSE t.result END
      FROM candidate WHERE t.id=candidate.id RETURNING t.*`, [filter.ownerId || null, filter.connectionId || null]);
    const task = claimed.rows[0];
    if (!task) break;
    processed++;
    try {
      const connection = await getConnectionById(task.user_id, task.connection_id);
      if (!connection) throw new Error("Store connection is unavailable.");
      if (task.kind === "WEBHOOK") {
        const payload = decryptPayload<any>(task.encrypted_payload);
        await persistWebhookOrder(connection, task.dedupe_key, Buffer.from(payload.rawBody, "base64"), payload.order);
        await query(`UPDATE integration_tasks SET status='COMPLETED',encrypted_payload=NULL,lease_token=NULL,locked_at=NULL,
          result='{"success":true}'::jsonb,updated_at=NOW() WHERE id=$1 AND lease_token=$2`, [task.id, task.lease_token]);
        continue;
      }
      const reconciliation = task.kind === "RECONCILE";
      const finalEnd = task.payload.finalEnd || new Date(Date.now() - 120_000).toISOString();
      const checkpoint = connection.syncCheckpoints?.orders?.lastSyncedAt;
      const from = task.payload.from || new Date(reconciliation ? Date.parse(finalEnd) - 180 * 86400000
        : checkpoint ? Date.parse(checkpoint) - 48 * 3600000 : Date.parse(finalEnd) - 30 * 86400000).toISOString();
      const pendingEnds: string[] = Array.isArray(task.payload.pendingEnds) ? [...task.payload.pendingEnds] : [];
      const to = task.payload.windowEnd || pendingEnds.shift() || new Date(Math.min(Date.parse(from) + 86400000, Date.parse(finalEnd))).toISOString();
      const response = await providerOperation(connection.marketplace as ApiPlatform, task.user_id, {
        action: "fetch_orders", connectionId: connection.id, syncWindowStart: from, syncWindowEnd: to, reconciliation,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        // A dense window is divided before any provider records are posted.
        if (response.status === 413 && Date.parse(to) - Date.parse(from) > 60000) {
          const midpoint = new Date(Math.floor((Date.parse(to) + Date.parse(from)) / 2)).toISOString();
          await query(`UPDATE integration_tasks SET status='QUEUED',payload=$1::jsonb,attempts=0,available_at=NOW(),lease_token=NULL,locked_at=NULL
            WHERE id=$2 AND lease_token=$3`, [JSON.stringify({ ...task.payload, from, finalEnd, windowEnd: midpoint, pendingEnds: [to, ...pendingEnds] }), task.id, task.lease_token]);
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          await updateSyncStatus(task.user_id, connection.marketplace, "REAUTH_REQUIRED", { connectionId: connection.id, errorMessage: "Platform authorization expired or was revoked. Reconnect the store." });
          await query("UPDATE integration_tasks SET status='REAUTH_REQUIRED',lease_token=NULL,locked_at=NULL,error_message=$1 WHERE id=$2 AND lease_token=$3", ["Reconnect the store to resume synchronization.", task.id, task.lease_token]);
          continue;
        }
        throw new Error("Store synchronization will retry.");
      }
      const more = pendingEnds.length > 0 || Date.parse(to) < Date.parse(finalEnd);
      const totals = { fetchedCount: Number(task.payload.fetchedCount || 0) + Number(result.fetchedCount || 0),
        importedCount: Number(task.payload.importedCount || 0) + Number(result.importedCount || 0),
        updatedCount: Number(task.payload.updatedCount || 0) + Number(result.updatedCount || 0),
        skippedCount: Number(task.payload.skippedCount || 0) + Number(result.skippedCount || 0) };
      await query(`UPDATE integration_tasks SET status='QUEUED',lease_token=NULL,locked_at=NULL,attempts=0,
        payload=$1::jsonb,result=$2::jsonb,available_at=NOW()+($3::int*interval '1 second'),error_message=NULL,updated_at=NOW()
        WHERE id=$4 AND lease_token=$5`, [JSON.stringify(more ? { from: to, finalEnd, pendingEnds, ...totals } : {}),
        JSON.stringify({ success: true, status: more ? "running" : totals.skippedCount ? "partial" : "succeeded", ...totals, lastSyncedAt: to }), more ? 0 : reconciliation ? 86400 : 900, task.id, task.lease_token]);
    } catch {
      await query(`UPDATE integration_tasks SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'QUEUED' END,
        available_at=NOW()+(LEAST(900,30*POWER(2,attempts))::int*interval '1 second'),
        lease_token=NULL,locked_at=NULL,error_message='Store processing failed. Retry or review the store configuration.',updated_at=NOW()
        WHERE id=$1 AND lease_token=$2`, [task.id, task.lease_token]);
    }
  }
  return processed;
}
