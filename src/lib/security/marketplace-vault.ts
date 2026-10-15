import crypto from "crypto";
import { query, ensureMarketplaceTables } from "../db";
import { encryptPayload, decryptPayload } from "./encryption";
import { webhookPath } from "./webhook-connection";

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: marketplace-vault.ts was imported into a client-side bundle. All vault access must remain strictly server-side."
  );
}

export interface VaultedConnectionMetadata {
  id: string;
  webhookPath?: string;
  userId: string;
  marketplace: string;
  sellerId: string;
  marketplaceId?: string;
  authType: string;
  isActive: boolean;
  lastSyncStatus: string;
  lastSyncCursor?: string;
  lastSyncedAt?: string;
  syncCheckpoints?: Record<string, { lastSyncedAt?: string; cursor?: string | null }>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveConnectionParams {
  marketplace: string;
  sellerId?: string;
  marketplaceId?: string;
  authType?: string;
  credentials: Record<string, any>;
}

/**
 * Retrieves all active connections for a specific authenticated user.
 * Satisfies TASK-2.5: Multi-Tenant Query Isolation (WHERE user_id = $1).
 * Safe projection: NEVER returns encrypted_credentials or secrets to callers.
 */
export async function getConnectionsForUser(userId: string): Promise<VaultedConnectionMetadata[]> {
  try {
    await ensureMarketplaceTables();
    const res = await query(
      `SELECT id, user_id, marketplace, seller_id, marketplace_id, auth_type, is_active, encrypted_credentials,
              last_sync_status, last_sync_cursor, last_synced_at, sync_checkpoints, error_message, created_at, updated_at
       FROM marketplace_connections
       WHERE user_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [userId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      webhookPath: webhookPath(r.id, r.marketplace, r.encrypted_credentials),
      userId: r.user_id,
      marketplace: r.marketplace,
      sellerId: r.seller_id,
      marketplaceId: r.marketplace_id,
      authType: r.auth_type,
      isActive: r.is_active,
      lastSyncStatus: r.last_sync_status,
      lastSyncCursor: r.last_sync_cursor,
      lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : undefined,
      syncCheckpoints: r.sync_checkpoints || {},
      errorMessage: r.error_message,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}

/**
 * Vaults a marketplace connection encrypted with AES-256-GCM.
 * Satisfies TASK-2.2 and TASK-2.4.
 */
export async function saveConnection(
  userId: string,
  params: SaveConnectionParams
): Promise<VaultedConnectionMetadata> {
  const sellerId = (params.sellerId || "").trim();
  // Preserve the server-generated routing capability across credential updates.
  const previous = await query(
    "SELECT encrypted_credentials FROM marketplace_connections WHERE user_id = $1 AND marketplace = $2 AND seller_id = $3 AND is_active = TRUE",
    [userId, params.marketplace, sellerId]
  );
  const previousCredentials = previous.rows[0]?.encrypted_credentials
    ? decryptPayload<Record<string, any>>(previous.rows[0].encrypted_credentials) : {};
  const encryptedBlob = encryptPayload({
    ...params.credentials,
    webhookRoutingKey: previousCredentials.webhookRoutingKey || crypto.randomBytes(32).toString("hex"),
  });
  const now = new Date().toISOString();
  const id = `conn_${crypto.randomUUID().slice(0, 18)}`;
  let authType = params.authType;
  if (!authType) {
    if (params.marketplace === "Flipkart") {
      authType = params.credentials?.refreshToken ? "OAUTH2" : "SELF_ACCESS";
    } else if (params.marketplace === "Amazon India") {
      authType = "LWA_REFRESH_TOKEN";
    } else {
      authType = "API_KEY";
    }
  }

  try {
    await ensureMarketplaceTables();
    const res = await query(
      `INSERT INTO marketplace_connections 
       (id, user_id, marketplace, seller_id, marketplace_id, encrypted_credentials, auth_type, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
       ON CONFLICT (user_id, marketplace, seller_id)
       DO UPDATE SET
         encrypted_credentials = EXCLUDED.encrypted_credentials,
         marketplace_id = COALESCE(EXCLUDED.marketplace_id, marketplace_connections.marketplace_id),
         auth_type = EXCLUDED.auth_type,
         is_active = true,
         error_message = NULL,
         updated_at = NOW()
       RETURNING id, user_id, marketplace, seller_id, marketplace_id, auth_type, is_active, encrypted_credentials,
                 last_sync_status, last_sync_cursor, last_synced_at, sync_checkpoints, error_message, created_at, updated_at`,
      [id, userId, params.marketplace, sellerId, params.marketplaceId || null, encryptedBlob, authType]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      webhookPath: webhookPath(r.id, r.marketplace, r.encrypted_credentials),
      userId: r.user_id,
      marketplace: r.marketplace,
      sellerId: r.seller_id,
      marketplaceId: r.marketplace_id,
      authType: r.auth_type,
      isActive: r.is_active,
      lastSyncStatus: r.last_sync_status,
      lastSyncCursor: r.last_sync_cursor,
      lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : undefined,
      syncCheckpoints: r.sync_checkpoints || {},
      errorMessage: r.error_message,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}

/**
 * Retrieves and decrypts connection credentials for a specific tenant and marketplace.
 * STRICTLY SERVER-ONLY: Used exclusively by backend sync workers.
 */
export async function getConnectionCredentials<T = Record<string, any>>(
  userId: string,
  marketplace: string,
  sellerId: string = ""
): Promise<T | null> {
  try {
    await ensureMarketplaceTables();
    let res;
    if (sellerId) {
      res = await query(
        `SELECT encrypted_credentials FROM marketplace_connections
         WHERE user_id = $1 AND marketplace = $2 AND seller_id = $3 AND is_active = true
         LIMIT 1`,
        [userId, marketplace, sellerId]
      );
    } else {
      res = await query(
        `SELECT encrypted_credentials FROM marketplace_connections
         WHERE user_id = $1 AND marketplace = $2 AND is_active = true
         ORDER BY updated_at DESC
         LIMIT 2`,
        [userId, marketplace]
      );
    }

    if (res.rows.length > 1) throw new Error("Select an explicit store connection.");
    if (res.rows.length > 0 && res.rows[0].encrypted_credentials) {
      return decryptPayload<T>(res.rows[0].encrypted_credentials);
    }
    return null;
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}

/**
 * Disconnects and revokes a channel connection.
 */
export async function disconnectConnection(
  userId: string,
  marketplace: string,
  sellerId?: string
): Promise<boolean> {
  try {
    await ensureMarketplaceTables();
    if (sellerId) {
      await query(
        `UPDATE marketplace_connections
         SET is_active = false, encrypted_credentials = '', updated_at = NOW()
         WHERE user_id = $1 AND marketplace = $2 AND seller_id = $3`,
        [userId, marketplace, sellerId]
      );
    } else {
      await query(
        `UPDATE marketplace_connections
         SET is_active = false, encrypted_credentials = '', updated_at = NOW()
         WHERE user_id = $1 AND marketplace = $2`,
        [userId, marketplace]
      );
    }
    return true;
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}

/**
 * Updates sync status and cursor for a connected channel.
 */
export async function updateSyncStatus(
  userId: string,
  marketplace: string,
  status: string,
  options?: { lastSyncedAt?: string; lastSyncCursor?: string | null; errorMessage?: string; stream?: string }
): Promise<void> {
  try {
    await ensureMarketplaceTables();
    await query(
      `UPDATE marketplace_connections
       SET sync_checkpoints = CASE WHEN $7::text IS NOT NULL THEN jsonb_set(sync_checkpoints, ARRAY[$7::text], $8::jsonb, true) ELSE sync_checkpoints END,
           last_sync_status = $1,
           last_synced_at = CASE WHEN $7::text IS NULL OR $7 = 'orders' THEN COALESCE($2, last_synced_at) ELSE last_synced_at END,
           last_sync_cursor = CASE WHEN $7::text IS NULL OR $7 = 'orders' THEN $3 ELSE last_sync_cursor END,
           error_message = $4,
           updated_at = NOW()
       WHERE user_id = $5 AND marketplace = $6 AND is_active = true
         AND (SELECT COUNT(*) FROM marketplace_connections WHERE user_id = $5 AND marketplace = $6 AND is_active = true) = 1`,
      [status, options?.lastSyncedAt || null, options?.lastSyncCursor || null, options?.errorMessage || null, userId, marketplace, options?.stream || null, JSON.stringify({ lastSyncedAt: options?.lastSyncedAt, cursor: options?.lastSyncCursor ?? null })]
    );
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}

/**
 * Records an audit entry in marketplace_sync_logs.
 */
export async function recordSyncLog(
  userId: string,
  logData: {
    connectionId?: string;
    marketplace: string;
    syncType?: string;
    status: string;
    fetchedCount?: number;
    importedCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const id = `log_${crypto.randomUUID().slice(0, 18)}`;
  try {
    await ensureMarketplaceTables();
    await query(
      `INSERT INTO marketplace_sync_logs 
       (id, connection_id, user_id, marketplace, sync_type, status, fetched_count, imported_count, updated_count, skipped_count, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        id,
        logData.connectionId || null,
        userId,
        logData.marketplace,
        logData.syncType || "DELTA",
        logData.status,
        logData.fetchedCount || 0,
        logData.importedCount || 0,
        logData.updatedCount || 0,
        logData.skippedCount || 0,
        logData.errorMessage || null,
      ]
    );
  } catch (err: any) {
    throw new Error("Marketplace database operation failed.", { cause: err });
  }
}
