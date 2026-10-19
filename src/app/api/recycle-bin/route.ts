import { financialJson } from "@/lib/security/financial-response";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSessionUserId } from "@/lib/security/session";
import { query, pool } from "@/lib/db";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { ledgerDataSchema } from "@/domain/snapshot-validation";
import { persistArchivePatch } from "@/lib/recycle-persistence";
import type { ArchivePatch } from "@/domain/recycle-bin";
import { getRecoveredRecords } from "@/lib/recovered-records";
import { readCanonicalLedger } from '@/lib/canonical-ledger';
import { archiveRecords,applyArchivePatch } from '@/domain/recycle-bin';
import { canonicalJson } from '@/domain/ledger-command';
import { appendFinancialAudit } from '@/lib/ledger-records';

const archive = z.object({ action: z.literal("archive"), type: z.enum(["orders", "returns", "claims", "expenses", "products"]), ids: z.array(z.string().min(1).max(500)).min(1).max(1000), patch: z.object({ before: ledgerDataSchema, after: ledgerDataSchema }) });
const restore = z.object({ action: z.literal("restore"), id: z.string().uuid() });

export async function GET(req: NextRequest) {
  const owner = await getSessionUserId(req);
  if (!owner) return financialJson({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    if (req.nextUrl.searchParams.get("recovered") === "true") return financialJson({ success: true, recovered: await getRecoveredRecords(owner) });
    const id = req.nextUrl.searchParams.get("id");
    if (id && !z.string().uuid().safeParse(id).success) return financialJson({ success: false }, { status: 400 });
    const result = await query(`SELECT id, record_type, record_ids, deleted_at${id ? ", patch" : ""} FROM ledger_archives WHERE user_id = $1 AND restored_at IS NULL AND deleted_at > NOW() - INTERVAL '7 days'${id ? " AND id = $2" : ""} ORDER BY deleted_at DESC`, id ? [owner, id] : [owner]);
    if (id) return result.rows.length ? financialJson({ success: true, patch: result.rows[0].patch }) : financialJson({ success: false, error: "Archive unavailable or expired." }, { status: 404 });
    return financialJson({ success: true, records: result.rows.map(row => ({ id: row.id, displayId: row.record_ids.join(", "), type: row.record_type, label: row.record_ids.join(", "), sublabel: row.record_type, deletedAt: new Date(row.deleted_at).toISOString(), daysRemaining: Math.max(0, Math.ceil((new Date(row.deleted_at).getTime() + 7 * 86400000 - Date.now()) / 86400000)) })) });
  } catch { return financialJson({ success: false, error: "Recycle bin temporarily unavailable." }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  const owner = await getSessionUserId(req);
  if (!owner) return financialJson({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const parsed = z.union([archive, restore]).safeParse(await readJsonBody(req, 10 * 1024 * 1024));
    if (!parsed.success) return financialJson({ success: false, error: "Invalid archive request." }, { status: 400 });
    const body = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [owner]);
      if (body.action === "archive") {
        const books=await readCanonicalLedger(client,owner);
        const authoritative=archiveRecords(books,body.type,body.ids);
        if(canonicalJson(authoritative)!==canonicalJson(body.patch))throw Error('Records changed; reload before archiving.');
        const conflict = await client.query("SELECT id FROM ledger_archives WHERE user_id = $1 AND record_type = $2 AND record_ids && $3::text[] AND restored_at IS NULL AND deleted_at > NOW() - INTERVAL '7 days'", [owner, body.type, body.ids]);
        if (conflict.rows.length || !body.ids.every(id => body.patch.before[body.type].some(row => row.id === id) && !body.patch.after[body.type].some(row => row.id === id))) throw Error("Archive conflict.");
        const id = crypto.randomUUID();
        await persistArchivePatch(client, owner, body.patch as ArchivePatch, false);
        await client.query("INSERT INTO ledger_archives (id, user_id, record_type, record_ids, patch) VALUES ($1,$2,$3,$4,$5::jsonb)", [id, owner, body.type, body.ids, JSON.stringify(body.patch)]);
        await appendFinancialAudit(client,owner,body.type==='products'?'PRODUCT_COST':body.type==='orders'?'ORDER':body.type==='returns'?'RETURN':body.type==='claims'?'CLAIM':'EXPENSE',body.ids.join(','),authoritative.before,authoritative.after,'Archived with exact inverse retained');
      } else {
        const result = await client.query("SELECT patch FROM ledger_archives WHERE id = $1 AND user_id = $2 AND restored_at IS NULL AND deleted_at > NOW() - INTERVAL '7 days' FOR UPDATE", [body.id, owner]);
        if (!result.rows.length) throw Error("Archive unavailable.");
        applyArchivePatch(await readCanonicalLedger(client,owner),result.rows[0].patch,true);
        await persistArchivePatch(client, owner, result.rows[0].patch, true);
        await client.query("UPDATE ledger_archives SET restored_at = NOW() WHERE id = $1 AND user_id = $2", [body.id, owner]);
        await appendFinancialAudit(client,owner,'DOCUMENT',body.id,result.rows[0].patch.after,result.rows[0].patch.before,'Archive restored with conflict checks');
      }
      await client.query("COMMIT");
      return financialJson({ success: true });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      return financialJson({ success: false, error: "Archive conflicts with current records or could not be saved. Reload and retry." }, { status: 409 });
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof RequestBodyError) return financialJson({ success: false, error: error.message }, { status: error.status });
    return financialJson({ success: false, error: "Recycle bin temporarily unavailable." }, { status: 503 });
  }
}
