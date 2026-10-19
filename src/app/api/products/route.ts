import { financialJson } from "@/lib/security/financial-response";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query, pool, ensureMarketplaceTables } from "@/lib/db";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { Product } from "@/domain/types";
import { persistCatalog } from "@/lib/catalog-persistence";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return financialJson(
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
           p.weight_grams,
           COALESCE((SELECT jsonb_agg(jsonb_build_object('validFrom', h.valid_from, 'validTo', h.valid_to, 'costPrice', h.cost_price, 'notes', h.notes) ORDER BY h.valid_from DESC) FROM product_cost_history h WHERE h.product_id = p.id), '[]'::jsonb) AS cost_history,
           COALESCE((SELECT jsonb_object_agg(a.marketplace, a.alias_sku) FROM product_channel_aliases a WHERE a.product_id = p.id), '{}'::jsonb) AS channel_aliases,
           s.display_id AS supplier_display_id,s.name as supplier_name
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.user_id = p.user_id
         WHERE p.user_id = $1 AND (p.deleted_at IS NULL)
         ORDER BY p.name ASC;`,
        [userId]
      );
    } catch {
      return financialJson({ success: false, error: "Database temporarily unavailable." }, { status: 503 });
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
      supplierId: row.supplier_display_id || "",
      supplierName: row.supplier_name || undefined,
      active: row.active ?? true,
      stockQuantity: Number(row.stock_quantity || 0),
      weightGrams: row.weight_grams == null ? undefined : Number(row.weight_grams),
      costHistory: (row.cost_history || []).map((cost: any) => ({ ...cost, validTo: cost.validTo || undefined, notes: cost.notes || undefined })),
      channelAliases: row.channel_aliases || {},
    }));

    return financialJson({
      success: true,
      products: mappedProducts,
      count: mappedProducts.length,
    });
  } catch (err: any) {
    console.error("[Products API Error]:", err);
    return financialJson(
      { success: false, error: "Failed to load products." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return financialJson(
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
      return financialJson(
        { success: false, error: "No products provided for persistence." },
        { status: 400 }
      );
    }

    const client=await pool.connect();let result;
    try {await client.query('BEGIN');result=await persistCatalog(client,userId,products);await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
    const {inserted,updated}=result;

    return financialJson({
      success: true,
      inserted,
      updated,
    });
  } catch (err: any) {
    if (err instanceof RequestBodyError) return financialJson({ success: false, error: err.message }, { status: err.status });
    console.error("[Products POST Error]:", err);
    return financialJson(
      { success: false, error: "Failed to upsert products." },
      { status: 500 }
    );
  }
}
