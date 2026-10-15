import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionUserId } from "@/lib/security/session";
import { readFormBody, RequestBodyError } from "@/lib/security/request-body";
import { query, pool, ensureMarketplaceTables } from "@/lib/db";
import { consolidateCsvOrders, detectAndMapCsv } from "@/domain/csv-auto-mapper";
import { orderSchema } from "@/domain/snapshot-validation";
import { Order, Product } from "@/domain/types";
import { calculateFileHash, recordFileImportAudit, getFileImportHistory } from "@/lib/integrations/file-audit";
import { marketplaceError } from "@/lib/integrations/error-response";
import { upsertOrders } from "@/lib/integrations/order-persistence";

/** Parse original files server-side; commit orders and source audit in one transaction. */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  try {
    const form = await readFormBody(req, 12 * 1024 * 1024);
    const files = form.getAll("file");
    if (!files.length || files.length > 10 || files.some(file => typeof file === "string" || file.size > 5 * 1024 * 1024 || !/\.(csv|xlsx|xls)$/i.test(file.name)) || files.reduce((size, file) => size + (typeof file === "string" ? 0 : file.size), 0) > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Provide up to 10 CSV/Excel files, each at most 5 MB and at most 10 MB in total." }, { status: 400 });
    }
    await ensureMarketplaceTables();
    const catalog = await query("SELECT sku, name FROM products WHERE user_id = $1 AND deleted_at IS NULL", [userId]);
    const costs = await query("SELECT p.sku, h.cost_price, h.valid_from, h.valid_to FROM product_cost_history h JOIN products p ON p.id = h.product_id WHERE p.user_id = $1 AND p.deleted_at IS NULL ORDER BY h.valid_from DESC", [userId]);
    const aliases = await query("SELECT p.sku, a.marketplace, a.alias_sku FROM product_channel_aliases a JOIN products p ON p.id = a.product_id WHERE p.user_id = $1 AND p.deleted_at IS NULL", [userId]);
    const products = catalog.rows.map(row => ({ ...row, channelAliases: Object.fromEntries(aliases.rows.filter(alias => alias.sku === row.sku).map(alias => [alias.marketplace, alias.alias_sku])), costHistory: costs.rows.filter(cost => cost.sku === row.sku).map(cost => ({ costPrice: Number(cost.cost_price), validFrom: new Date(cost.valid_from).toISOString(), validTo: cost.valid_to ? new Date(cost.valid_to).toISOString() : undefined })) })) as Product[];
    const orders: Order[] = [];
    const sources = [];
    for (const entry of files) {
      const file = entry as File;
      const bytes = Buffer.from(await file.arrayBuffer());
      let text = bytes.toString("utf8");
      if (!/\.csv$/i.test(file.name)) {
        const workbook = XLSX.read(bytes, { type: "buffer", sheetRows: 20002 });
        text = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      }
      const result = detectAndMapCsv(text, products);
      if (result.errors.length || !result.orders.length || result.detection.totalRows > 20000) return NextResponse.json({ success: false, error: "Invalid order file. Check order references, dates, SKUs and unit prices.", details: result.errors.slice(0, 10) }, { status: 400 });
      for (const order of result.orders) {
        if (!orderSchema.safeParse(order).success) return NextResponse.json({ success: false, error: "Invalid order record." }, { status: 400 });
        orders.push(order);
      }
      sources.push({ file, hash: calculateFileHash(bytes), result });
    }
    let consolidated: Order[];
    try { consolidated = consolidateCsvOrders(orders); } catch { return NextResponse.json({ success: false, error: "Files contain conflicting source records." }, { status: 400 }); }
    orders.splice(0, orders.length, ...consolidated);
    if (orders.some(order => !orderSchema.safeParse(order).success)) return NextResponse.json({ success: false, error: "Combined order data exceeds the permitted limits." }, { status: 400 });
    if (orders.length > 1000) return NextResponse.json({ success: false, error: "Import at most 1,000 orders per batch." }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const persisted = await upsertOrders(userId, orders, client);
      const attributed = new Set<string>();
      for (const { file, hash, result } of sources) {
        const created = result.orders.filter(order => {
          const index = orders.findIndex(row => row.marketplace === order.marketplace && row.channelOrderId === order.channelOrderId);
          const id = persisted.orderIds[index];
          if (!persisted.insertedOrderIds.includes(id) || attributed.has(id)) return false;
          attributed.add(id);
          return true;
        }).length;
        await recordFileImportAudit(userId, {
        marketplace: new Set(result.orders.map(order => order.marketplace)).size === 1 ? result.orders[0].marketplace : "Mixed", fileName: file.name, fileHash: hash, fileSize: file.size,
        sheetFormat: result.detection.detectedFormat, rowsProcessed: result.detection.totalRows,
        ordersCreated: created, settlementsCreated: 0,
      }, undefined, client);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true, orders: orders.map((order, index) => ({ ...order, id: persisted.orderIds[index] || order.id })), ordersPersisted: persisted });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Import could not be saved. Please retry." }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return marketplaceError(
        "Spreadsheet Import",
        "AUTHENTICATION_REQUIRED",
        "Authentication required to view import history.",
        401
      );
    }
    const marketplace = req.nextUrl.searchParams.get("marketplace") || undefined;

    const history = await getFileImportHistory(userId, marketplace);
    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    return marketplaceError(
      "Spreadsheet Import",
      "FILE_HISTORY_ERROR",
      "Failed to fetch file import history.",
      500
    );
  }
}
