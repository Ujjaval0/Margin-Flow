import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query, pool, ensureMarketplaceTables } from "@/lib/db";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { Product } from "@/domain/types";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access catalog products." },
        { status: 401 }
      );
    }

    await ensureMarketplaceTables();

    let productsRes: any;
    try {
      productsRes = await query(
        `SELECT 
           p.id,
           p.display_id,
           p.sku,
           p.mfn,
           p.mfn1,
           p.name,
           p.category,
           p.brand,
           p.current_cost_price,
           p.supplier_id,
           p.active,
           p.stock_quantity,
           COALESCE((SELECT jsonb_agg(jsonb_build_object('validFrom', h.valid_from, 'validTo', h.valid_to, 'costPrice', h.cost_price, 'notes', h.notes) ORDER BY h.valid_from DESC) FROM product_cost_history h WHERE h.product_id = p.id), '[]'::jsonb) AS cost_history,
           COALESCE((SELECT jsonb_object_agg(a.marketplace, a.alias_sku) FROM product_channel_aliases a WHERE a.product_id = p.id), '{}'::jsonb) AS channel_aliases,
           s.name as supplier_name
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.user_id = p.user_id
         WHERE p.user_id = $1 AND (p.deleted_at IS NULL)
         ORDER BY p.name ASC;`,
        [userId]
      );
    } catch {
      return NextResponse.json({ success: false, error: "Database temporarily unavailable." }, { status: 503 });
    }

    const mappedProducts: Product[] = (productsRes.rows || []).map((row: any) => ({
      id: row.display_id || row.id,
      sku: row.sku,
      mfn: row.mfn || undefined,
      mfn1: row.mfn1 || undefined,
      name: row.name,
      category: row.category,
      brand: row.brand,
      currentCostPrice: Number(row.current_cost_price || 0),
      supplierId: row.supplier_id || undefined,
      supplierName: row.supplier_name || undefined,
      active: row.active ?? true,
      stockQuantity: Number(row.stock_quantity || 0),
      costHistory: (row.cost_history || []).map((cost: any) => ({ ...cost, validTo: cost.validTo || undefined, notes: cost.notes || undefined })),
      channelAliases: row.channel_aliases || {},
    }));

    return NextResponse.json({
      success: true,
      products: mappedProducts,
      count: mappedProducts.length,
    });
  } catch (err: any) {
    console.error("[Products API Error]:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load products." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to modify catalog products." },
        { status: 401 }
      );
    }

    await ensureMarketplaceTables();

    const body = await readJsonBody(req);
    const products: Product[] = Array.isArray(body.products)
      ? body.products
      : body.product
      ? [body.product]
      : [];

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No products provided for persistence." },
        { status: 400 }
      );
    }

    let inserted = 0;
    let updated = 0;

    if (products.length > 1000 || products.some(p => !p || typeof p.sku !== "string" || !p.sku.trim() ||
      !Number.isFinite(Number(p.currentCostPrice ?? 0)) || Number(p.currentCostPrice ?? 0) < 0 ||
      !Number.isSafeInteger(Number(p.stockQuantity ?? 0)) || Number(p.stockQuantity ?? 0) < 0)) {
      return NextResponse.json({ success: false, error: "Invalid catalog batch." }, { status: 400 });
    }
    const client = await pool.connect();
    try {
    await client.query("BEGIN");
    for (const p of products) {
      const displayId = p.id || `PROD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const sku = String(p.sku || "").trim();

      const name = p.name || sku;
      const category = p.category || "General";
      const brand = p.brand || "My Brand";
      const costPrice = Number(p.currentCostPrice || 0);
      const stock = Number(p.stockQuantity || 0);

      const upsertSql = `
        INSERT INTO products (
          id, user_id, display_id, sku, mfn, mfn1, name, category, brand,
          current_cost_price, active, stock_quantity, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        ON CONFLICT (user_id, sku)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          brand = EXCLUDED.brand,
          current_cost_price = EXCLUDED.current_cost_price,
          stock_quantity = EXCLUDED.stock_quantity,
          active = EXCLUDED.active,
          mfn = EXCLUDED.mfn,
          mfn1 = EXCLUDED.mfn1,
          updated_at = NOW()
        WHERE products.deleted_at IS NULL
        RETURNING (xmax = 0) AS is_insert;
      `;

      try {
        const res = await client.query(upsertSql, [
          userId,
          displayId,
          sku,
          p.mfn || null,
          p.mfn1 || null,
          name,
          category,
          brand,
          costPrice,
          p.active ?? true,
          stock,
        ]);
        if (!res.rows.length) throw new Error("Archived product must be restored before editing.");
        if (res.rows[0]?.is_insert) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err: any) {
        throw new Error("Catalog write failed.", { cause: err });
      }
    }
    await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
    });
  } catch (err: any) {
    if (err instanceof RequestBodyError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    console.error("[Products POST Error]:", err);
    return NextResponse.json(
      { success: false, error: "Failed to upsert products." },
      { status: 500 }
    );
  }
}
