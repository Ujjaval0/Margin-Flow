import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query, ensureMarketplaceTables } from "@/lib/db";
import { upsertSettlements } from "@/lib/integrations/order-persistence";
import { Settlement, SettlementDeduction } from "@/domain/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access settlements." },
        { status: 401 }
      );
    }

    await ensureMarketplaceTables();

    const searchParams = req.nextUrl.searchParams;
    const marketplaceFilter = searchParams.get("marketplace") || null;
    const limit = Math.min(Number(searchParams.get("limit")) || 500, 2000);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    let settlementsQuery = `
      SELECT 
        s.id,
        s.display_id,
        s.settlement_batch_id,
        s.marketplace,
        s.settlement_date,
        s.order_id,
        s.gross_amount,
        s.tcs_tds_tax,
        s.net_settlement,
        s.reconciliation_status,
        s.discrepancy_amount,
        s.bank_tx_ref,
        s.source_document,
        s.created_at,
        s.updated_at,
        o.display_id as order_display_id,
        o.channel_order_id as order_channel_id
      FROM settlements s
      LEFT JOIN orders o ON o.id = s.order_id
      WHERE s.user_id = $1 AND s.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
    `;

    const queryParams: any[] = [userId];

    if (marketplaceFilter && marketplaceFilter !== "ALL" && marketplaceFilter !== "All Channels") {
      queryParams.push(marketplaceFilter);
      settlementsQuery += ` AND s.marketplace = $${queryParams.length}`;
    }

    settlementsQuery += ` ORDER BY s.settlement_date DESC, s.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};`;
    queryParams.push(limit, offset);

    let settlementsRes: any;
    try {
      settlementsRes = await query(settlementsQuery, queryParams);
    } catch {
      return NextResponse.json({ success: false, error: "Database temporarily unavailable." }, { status: 503 });
    }

    const settlementRows = settlementsRes.rows || [];
    if (settlementRows.length === 0) {
      return NextResponse.json({
        success: true,
        settlements: [],
        count: 0,
      });
    }

    // Fetch deductions in single batch
    const settlementUuids = settlementRows.map((r: any) => r.id);
    let deductionsBySettlementId: Record<string, SettlementDeduction[]> = {};

    try {
      const dedRes = await query(
        `SELECT 
           id,
           settlement_id,
           category,
           name,
           amount
         FROM settlement_deductions
         WHERE settlement_id = ANY($1::uuid[]);`,
        [settlementUuids]
      );

      for (const d of dedRes.rows || []) {
        if (!deductionsBySettlementId[d.settlement_id]) deductionsBySettlementId[d.settlement_id] = [];
        deductionsBySettlementId[d.settlement_id].push({
          category: d.category,
          name: d.name,
          amount: Number(d.amount || 0),
        });
      }
    } catch (dedErr: any) {
      throw new Error("Settlement deductions unavailable.", { cause: dedErr });
    }

    const mappedSettlements: Settlement[] = settlementRows.map((row: any) => {
      return {
        id: row.display_id || row.id,
        settlementBatchId: row.settlement_batch_id || "",
        marketplace: row.marketplace,
        settlementDate: row.settlement_date ? new Date(row.settlement_date).toISOString().split("T")[0] : "",
        orderId: row.order_channel_id || row.order_display_id || row.order_id,
        grossAmount: Number(row.gross_amount || 0),
        deductions: deductionsBySettlementId[row.id] || [],
        tcsTdsTax: Number(row.tcs_tds_tax || 0),
        netSettlement: Number(row.net_settlement || 0),
        reconciliationStatus: row.reconciliation_status,
        discrepancyAmount: row.discrepancy_amount !== null ? Number(row.discrepancy_amount) : undefined,
        bankTxRef: row.bank_tx_ref || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      settlements: mappedSettlements,
      count: mappedSettlements.length,
    });
  } catch (err: any) {
    console.error("[Settlements API Error]:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load settlements." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to persist settlements." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const settlements: Settlement[] = Array.isArray(body.settlements) ? body.settlements : [];

    if (settlements.length === 0) {
      return NextResponse.json(
        { success: false, error: "No settlements provided for persistence." },
        { status: 400 }
      );
    }

    const result = await upsertSettlements(userId, settlements);

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      settlementIds: result.settlementIds,
    });
  } catch (err: any) {
    console.error("[Settlements POST Error]:", err);
    return NextResponse.json(
      { success: false, error: "Failed to upsert settlements." },
      { status: 500 }
    );
  }
}
