import { financialJson } from "@/lib/security/financial-response";
import { rejectCrossOrigin } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import { query, ensureMarketplaceTables } from "@/lib/db";
import { upsertSettlements } from "@/lib/integrations/order-persistence";
import { settlementSchema } from "@/domain/snapshot-validation";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { Settlement, SettlementDeduction } from "@/domain/types";
import { aggregateMarketplaceFeeDeductionsByOrder, decimalRupeesToPaise, reconcileMarketplaceFees, reconcileSettlementNet, type FeeRuleSnapshotComponent } from "@/domain/marketplace-fees";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return financialJson(
        { success: false, error: "Authentication required to access settlements." },
        { status: 401 }
      );
    }

    await ensureMarketplaceTables();

    const searchParams = req.nextUrl.searchParams;
    const marketplaceFilter = searchParams.get("marketplace") || null;
    const limit = Math.min(Math.max(1, Math.floor(Number(searchParams.get("limit")) || 500)), 2000);
    const offset = Math.max(Math.floor(Number(searchParams.get("offset")) || 0), 0);

    let settlementsQuery = `
      SELECT 
        s.id,s.record_data,
        s.display_id,
        s.settlement_batch_id,
        s.marketplace,
        s.settlement_date,
        s.order_id,
        s.gross_amount,
        s.tcs_tds_tax,
        s.tcs_tax,
        s.tds_tax,
        s.tcs_taxable_value,
        s.tds_gross_amount,
        s.net_settlement,
        s.reconciliation_status,
        s.discrepancy_amount,
        s.bank_tx_ref,
        s.source_document,
        s.created_at,
        s.updated_at,
        o.id as order_uuid,
        o.display_id as order_display_id,
        o.channel_order_id as order_channel_id,
        fee.id as fee_estimate_id,
        fee.status as fee_estimate_status,
        fee.total_paise as fee_estimate_total_paise
      FROM settlements s
      LEFT JOIN orders o ON o.id = s.order_id AND o.user_id = s.user_id
      LEFT JOIN LATERAL (
        SELECT estimate.id, estimate.status, estimate.total_paise
        FROM order_fee_estimates estimate
        WHERE estimate.user_id = s.user_id AND estimate.order_id = s.order_id
        ORDER BY estimate.calculated_at DESC, estimate.id DESC LIMIT 1
      ) fee ON TRUE
      WHERE s.user_id = $1 AND s.deleted_at IS NULL AND (o.id IS NULL OR o.deleted_at IS NULL)
    `;

    const queryParams: any[] = [userId];

    if (marketplaceFilter && marketplaceFilter !== "ALL" && marketplaceFilter !== "All Channels") {
      queryParams.push(marketplaceFilter);
      settlementsQuery += ` AND s.marketplace = $${queryParams.length}`;
    }

    settlementsQuery += ` ORDER BY s.settlement_date DESC, s.created_at DESC, s.id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};`;
    queryParams.push(limit, offset);

    let settlementsRes: any;
    try {
      settlementsRes = await query(settlementsQuery, queryParams);
    } catch {
      return financialJson({ success: false, error: "Database temporarily unavailable." }, { status: 503 });
    }

    const settlementRows = settlementsRes.rows || [];
    if (settlementRows.length === 0) {
      return financialJson({
        success: true,
        settlements: [],
        count: 0,
      });
    }

    // Fetch deductions in single batch
    const settlementUuids = settlementRows.map((r: any) => r.id);
    const orderUuids = Array.from(new Set(settlementRows.map((row: any) => row.order_uuid).filter(Boolean)));
    let deductionsBySettlementId: Record<string, SettlementDeduction[]> = {};
    let actualFeeDeductionsByOrderId: Record<string, Array<{ category: string; name: string; amountPaise: number }>> = {};
    let estimateComponentsByEstimateId: Record<string, FeeRuleSnapshotComponent[]> = {};

    try {
      const dedRes = await query(
        `SELECT 
           id,
           settlement_id,
           category,
           name,
           amount, gst_amount,record_data
         FROM settlement_deductions
         WHERE settlement_id = ANY($1::uuid[]);`,
        [settlementUuids]
      );

      for (const d of dedRes.rows || []) {
        if (!deductionsBySettlementId[d.settlement_id]) deductionsBySettlementId[d.settlement_id] = [];
        deductionsBySettlementId[d.settlement_id].push({
          ...d.record_data,
          category: d.category,
          name: d.name,
          amount: Number(d.amount || 0),
          gstAmount: d.gst_amount == null ? undefined : Number(d.gst_amount),
        });
      }
      if (orderUuids.length) {
        const actualRes = await query(`SELECT s.order_id, d.category, d.name, d.amount
          FROM settlements s JOIN settlement_deductions d ON d.settlement_id = s.id
          WHERE s.user_id = $1 AND s.order_id = ANY($2::uuid[]) AND s.deleted_at IS NULL`, [userId, orderUuids]);
        actualFeeDeductionsByOrderId = aggregateMarketplaceFeeDeductionsByOrder((actualRes.rows || [])
          .filter((deduction: any) => deduction.category !== "TAX_TCS" && deduction.category !== "TAX_TDS")
          .map((deduction: any) => ({ orderId: deduction.order_id, category: deduction.category,
            name: deduction.name, amountPaise: decimalRupeesToPaise(String(deduction.amount)) })));
      }
      const estimateIds = Array.from(new Set(settlementRows.map((row: any) => row.fee_estimate_id).filter(Boolean)));
      if (estimateIds.length) {
        const componentRes = await query(`SELECT estimate_id, rule_id, rule_version, rule_component_id, line_sku,
            component_name, component_type, calculation_method, calculation_base_paise, rate_bps, amount_paise,
            tax_treatment, tax_rate_bps, tax_paise, quantity
          FROM order_fee_estimate_components WHERE user_id = $1 AND estimate_id = ANY($2::uuid[]) ORDER BY sequence`, [userId, estimateIds]);
        for (const component of componentRes.rows || []) {
          const list = estimateComponentsByEstimateId[component.estimate_id] || [];
          list.push({ ruleId: component.rule_id, ruleVersion: Number(component.rule_version), componentId: component.rule_component_id,
            componentName: component.component_name, componentType: component.component_type, method: component.calculation_method,
            basePaise: Number(component.calculation_base_paise), rateBps: component.rate_bps === null ? undefined : Number(component.rate_bps),
            amountPaise: Number(component.amount_paise), taxTreatment: component.tax_treatment,
            taxRateBps: Number(component.tax_rate_bps), taxPaise: Number(component.tax_paise), quantity: Number(component.quantity), lineSku: component.line_sku });
          estimateComponentsByEstimateId[component.estimate_id] = list;
        }
      }
    } catch (dedErr: any) {
      throw new Error("Settlement deductions unavailable.", { cause: dedErr });
    }

    const rateRows = await query("SELECT effective_from, tcs_bps, tds_bps FROM statutory_withholding_rates WHERE user_id = $1 ORDER BY effective_from", [userId]);
    const withholdingRates = rateRows.rows.map((rate: any) => ({ effectiveFrom: new Date(rate.effective_from).toISOString().slice(0, 10), tcsBps: Number(rate.tcs_bps), tdsBps: Number(rate.tds_bps) }));
    const mappedSettlements: Settlement[] = settlementRows.map((row: any) => {
      return {
        ...row.record_data,
        id: row.display_id || row.id,
        settlementBatchId: row.settlement_batch_id || "",
        marketplace: row.marketplace,
        settlementDate: row.settlement_date ? new Date(row.settlement_date).toISOString().split("T")[0] : "",
        orderId: row.order_channel_id || row.order_display_id || row.order_id,
        grossAmount: Number(row.gross_amount || 0),
        deductions: deductionsBySettlementId[row.id] || [],
        tcsTdsTax: Number(row.tcs_tds_tax || 0),
        tcsTax: row.tcs_tax == null ? undefined : Number(row.tcs_tax),
        tdsTax: row.tds_tax == null ? undefined : Number(row.tds_tax),
        tcsTaxableValue: row.tcs_taxable_value == null ? undefined : Number(row.tcs_taxable_value),
        tdsGrossAmount: row.tds_gross_amount == null ? undefined : Number(row.tds_gross_amount),
        withholdingRates: withholdingRates.length ? withholdingRates : undefined,
        netSettlement: Number(row.net_settlement || 0),
        reconciliationStatus: row.reconciliation_status,
        discrepancyAmount: row.discrepancy_amount !== null ? Number(row.discrepancy_amount) : undefined,
        bankTxRef: row.bank_tx_ref || undefined,
        netVariancePaise: reconcileSettlementNet({
          grossPaise: decimalRupeesToPaise(String(row.gross_amount)),
          deductionPaise: (deductionsBySettlementId[row.id] || []).filter(item => item.category !== "TAX_TCS" && item.category !== "TAX_TDS").map(item => decimalRupeesToPaise(String(item.amount))),
          taxPaise: decimalRupeesToPaise(String(row.tcs_tds_tax)),
          netPaise: decimalRupeesToPaise(String(row.net_settlement)),
        }),
        feeReconciliation: reconcileMarketplaceFees({
          status: row.fee_estimate_status || "NOT_CONFIGURED",
          totalPaise: row.fee_estimate_status === "CONFIGURED" ? Number(row.fee_estimate_total_paise) : null,
          components: estimateComponentsByEstimateId[row.fee_estimate_id] || [],
        }, actualFeeDeductionsByOrderId[row.order_uuid] || []),
        feeReconciliationScope: row.order_uuid ? "ORDER" : undefined,
      };
    });

    return financialJson({
      success: true,
      settlements: mappedSettlements,
      count: mappedSettlements.length,
    });
  } catch (err: any) {
    console.error("[Settlements API Error]:", err);
    return financialJson(
      { success: false, error: "Failed to load settlements." },
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
        { success: false, error: "Authentication required to persist settlements." },
        { status: 401 }
      );
    }

    const body = await readJsonBody(req);
    const settlements: Settlement[] = Array.isArray(body.settlements) ? body.settlements : [];

    if (settlements.length === 0 || settlements.length > 1000 || settlements.some(settlement => !settlementSchema.safeParse(settlement).success) ||
        new Set(settlements.map(settlement => settlement.id)).size !== settlements.length) {
      return financialJson(
        { success: false, error: "A valid batch of 1–1000 settlements is required." },
        { status: 400 }
      );
    }

    const result = await upsertSettlements(userId, settlements);

    return financialJson({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      settlementIds: result.settlementIds,
    });
  } catch (err: any) {
    if (err instanceof RequestBodyError) return financialJson({ success: false, error: err.message }, { status: err.status });
    console.error("[Settlements POST Error]:", err);
    return financialJson(
      { success: false, error: "Failed to upsert settlements." },
      { status: 500 }
    );
  }
}
