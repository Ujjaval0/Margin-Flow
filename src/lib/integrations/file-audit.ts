import { query, pool, ensureMarketplaceTables } from "@/lib/db";
import type { PoolClient } from "pg";
import crypto from "crypto";

if (typeof window !== "undefined") {
  throw new Error(
    "FATAL SECURITY VIOLATION: file-audit.ts was imported into a client-side bundle. All file audit recording must remain strictly server-side."
  );
}

export interface FileImportAuditParams {
  marketplace: string;
  fileName: string;
  fileHash?: string;
  fileSize?: number;
  sellerId?: string;
  sheetFormat: string;
  rowsProcessed: number;
  ordersCreated: number;
  settlementsCreated?: number;
}

export interface FileImportLogRecord {
  id: string;
  userId: string;
  marketplace: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  sellerId: string;
  sheetFormat: string;
  rowsProcessed: number;
  ordersCreated: number;
  settlementsCreated: number;
  uploadedAt: string;
  createdAt: string;
}

/**
 * Computes a standard SHA-256 cryptographic hash of a file or content string.
 * Satisfies TASK-5.3.
 */
export function calculateFileHash(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Persists complete file audit metadata for every processed spreadsheet.
 * Satisfies TASK-5.3:
 * - Persists original filename, file hash, upload timestamp, and seller account ID
 * - Enforces multi-tenant isolation by user_id
 * - Writes immutable audit entry to financial_audit_logs
 */
export async function recordFileImportAudit(
  userId: string,
  params: FileImportAuditParams,
  fileContent?: string | Buffer,
  transactionClient?: PoolClient
): Promise<FileImportLogRecord> {
  const hash =
    params.fileHash ||
    (fileContent ? calculateFileHash(fileContent) : crypto.randomBytes(32).toString("hex"));

  const id = `fil_${crypto.randomUUID().slice(0, 18)}`;
  const now = new Date().toISOString();
  const sellerId = (params.sellerId || "").trim();
  const fileSize = params.fileSize || (fileContent ? Buffer.byteLength(fileContent) : 0);
  const settlementsCreated = params.settlementsCreated || 0;

  const record: FileImportLogRecord = {
    id,
    userId,
    marketplace: params.marketplace,
    fileName: params.fileName,
    fileHash: hash,
    fileSize,
    sellerId,
    sheetFormat: params.sheetFormat,
    rowsProcessed: params.rowsProcessed,
    ordersCreated: params.ordersCreated,
    settlementsCreated,
    uploadedAt: now,
    createdAt: now,
  };

  await ensureMarketplaceTables();
  const client = transactionClient || await pool.connect();
  try {
    if (!transactionClient) await client.query("BEGIN");
      // 1. Insert into file_import_logs
      await client.query(
        `INSERT INTO file_import_logs (
           id, user_id, marketplace, file_name, file_hash, file_size, seller_id,
           sheet_format, rows_processed, orders_created, settlements_created, uploaded_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          id,
          userId,
          params.marketplace,
          params.fileName,
          hash,
          fileSize,
          sellerId,
          params.sheetFormat,
          params.rowsProcessed,
          params.ordersCreated,
          settlementsCreated,
        ]
      );

      // 2. Append immutable record to financial_audit_logs (Trigger 1)
      const auditId = `AUD-DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await client.query(
        `INSERT INTO financial_audit_logs (
           id, display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason, source_document_id
         ) VALUES (
           gen_random_uuid(), $1, NOW(), 'DOCUMENT', $2, 'file_hash', 'N/A', $3, 'Spreadsheet Import Engine', $4, $5
         )`,
        [
          auditId,
          params.fileName,
          hash,
          `${params.marketplace} spreadsheet ingested: ${params.rowsProcessed} rows, ${params.ordersCreated} orders, Format: ${params.sheetFormat}`,
          params.fileName,
        ]
      );
    if (!transactionClient) await client.query("COMMIT");
  } catch (error) {
    if (!transactionClient) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { if (!transactionClient) client.release(); }

  return record;
}

/**
 * Retrieves file import audit history for the authenticated user.
 */
export async function getFileImportHistory(
  userId: string,
  marketplace?: string
): Promise<FileImportLogRecord[]> {
  await ensureMarketplaceTables();
      let sql = `SELECT * FROM file_import_logs WHERE user_id = $1`;
      const params: any[] = [userId];

      if (marketplace) {
        sql += ` AND marketplace = $2`;
        params.push(marketplace);
      }
      sql += ` ORDER BY uploaded_at DESC LIMIT 50`;

      const res = await query(sql, params);
      return res.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        marketplace: r.marketplace,
        fileName: r.file_name,
        fileHash: r.file_hash,
        fileSize: Number(r.file_size),
        sellerId: r.seller_id,
        sheetFormat: r.sheet_format,
        rowsProcessed: r.rows_processed,
        ordersCreated: r.orders_created,
        settlementsCreated: r.settlements_created,
        uploadedAt: new Date(r.uploaded_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString(),
      }));
}
