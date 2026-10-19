import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/security/session";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { ensureMarketplaceTables, query } from "@/lib/db";

const marketplaceSchema = z.enum(["Amazon India", "Flipkart", "Meesho", "Personal Website", "Myntra", "WooCommerce", "B2B Wholesale", "Other"]);
const saveRateSchema = z.object({
  marketplace: marketplaceSchema,
  rateBps: z.number().int().min(0).max(10000),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const parsedMarketplace = marketplaceSchema.safeParse(req.nextUrl.searchParams.get("marketplace"));
    if (!parsedMarketplace.success) return NextResponse.json({ success: false, error: "A valid marketplace is required." }, { status: 400 });
    await ensureMarketplaceTables();
    const result = await query(`SELECT id, rate_bps, created_at FROM marketplace_quick_fee_rates
      WHERE user_id = $1 AND marketplace = $2 ORDER BY created_at, rate_bps`, [userId, parsedMarketplace.data]);
    return NextResponse.json({ success: true, rates: result.rows.map(row => ({ id: row.id, rateBps: Number(row.rate_bps) })) });
  } catch (error) {
    console.error("[Marketplace quick rates GET Error]", error);
    return NextResponse.json({ success: false, error: "Saved quick rates are unavailable." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const body = await readJsonBody(req, 8 * 1024);
    const input = saveRateSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ success: false, error: "Enter a marketplace and a rate from 0% to 100%." }, { status: 400 });
    await ensureMarketplaceTables();
    const result = await query(`INSERT INTO marketplace_quick_fee_rates (user_id, marketplace, rate_bps)
      VALUES ($1, $2, $3) ON CONFLICT (user_id, marketplace, rate_bps) DO NOTHING
      RETURNING id, rate_bps`, [userId, input.data.marketplace, input.data.rateBps]);
    if (result.rows[0]) return NextResponse.json({ success: true, rate: { id: result.rows[0].id, rateBps: Number(result.rows[0].rate_bps) } }, { status: 201 });
    const existing = await query(`SELECT id, rate_bps FROM marketplace_quick_fee_rates
      WHERE user_id = $1 AND marketplace = $2 AND rate_bps = $3`, [userId, input.data.marketplace, input.data.rateBps]);
    return NextResponse.json({ success: true, rate: { id: existing.rows[0].id, rateBps: Number(existing.rows[0].rate_bps) }, alreadySaved: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Marketplace quick rates POST Error]", error);
    return NextResponse.json({ success: false, error: "Quick rate could not be saved." }, { status: 500 });
  }
}
