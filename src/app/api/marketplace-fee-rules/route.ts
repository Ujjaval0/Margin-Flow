import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/security/session";
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body";
import { ensureMarketplaceTables, pool, query } from "@/lib/db";
import type { MarketplaceFeeComponent, MarketplaceFeeRule } from "@/domain/marketplace-fees";

const marketplace = z.enum(["Amazon India", "Flipkart", "Meesho", "Personal Website", "Myntra", "WooCommerce", "B2B Wholesale", "Other"]);
const componentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  componentType: z.string().trim().min(1).max(60),
  method: z.enum(["PERCENT", "FIXED_ORDER", "PER_UNIT"]),
  rateBps: z.number().int().min(0).max(10000).optional(),
  amountPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  calculationBase: z.enum(["ITEM_BEFORE_DISCOUNT", "ITEM_AFTER_DISCOUNT", "ITEM_EXCLUDING_TAX"]).optional(),
  taxTreatment: z.enum(["NO_TAX", "TAXABLE", "TAX_INCLUDED"]),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  sequence: z.number().int().min(0).max(10000),
}).superRefine((component, context) => {
  if (component.method === "PERCENT" && (component.rateBps === undefined || !component.calculationBase || component.amountPaise !== undefined))
    context.addIssue({ code: "custom", message: "Percentage components need an integer rate and explicit calculation base." });
  if (component.method !== "PERCENT" && (component.amountPaise === undefined || component.rateBps !== undefined || component.calculationBase !== undefined))
    context.addIssue({ code: "custom", message: "Fixed and per-unit components need an integer paise amount." });
  if (component.taxTreatment === "TAXABLE" && component.taxRateBps === undefined)
    context.addIssue({ code: "custom", message: "Taxable components need an explicit tax rate." });
  if (component.taxTreatment !== "TAXABLE" && component.taxRateBps !== undefined)
    context.addIssue({ code: "custom", message: "Tax rate is only valid for taxable components." });
});
const ruleSchema = z.object({
  marketplace,
  sku: z.string().trim().min(1).max(120).nullable().optional(),
  productCategory: z.string().trim().min(1).max(120).nullable().optional(),
  fulfilmentMode: z.string().trim().min(1).max(80).nullable().optional(),
  minUnitPricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  maxUnitPricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  components: z.array(componentSchema).min(1).max(100),
}).refine(rule => {
  const date = (value: string) => Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  return date(rule.effectiveFrom) && (!rule.effectiveTo || date(rule.effectiveTo));
}).refine(rule => rule.minUnitPricePaise == null || rule.maxUnitPricePaise == null || rule.minUnitPricePaise < rule.maxUnitPricePaise)
  .refine(rule => !rule.effectiveTo || rule.effectiveFrom <= rule.effectiveTo);

type RuleInput = z.infer<typeof ruleSchema>;

function mapRules(rows: any[], components: any[]): MarketplaceFeeRule[] {
  const byRule = new Map<string, MarketplaceFeeComponent[]>();
  for (const row of components) {
    const list = byRule.get(row.rule_id) || [];
    list.push({ id: row.id, name: row.name, componentType: row.component_type, method: row.calculation_method,
      rateBps: row.rate_bps === null ? undefined : Number(row.rate_bps), amountPaise: row.amount_paise === null ? undefined : Number(row.amount_paise),
      calculationBase: row.calculation_base || undefined, taxTreatment: row.tax_treatment,
      taxRateBps: row.tax_rate_bps === null ? undefined : Number(row.tax_rate_bps), sequence: Number(row.sequence) });
    byRule.set(row.rule_id, list);
  }
  return rows.map(row => ({ id: row.id, version: Number(row.version), marketplace: row.marketplace,
    sku: row.sku, productCategory: row.product_category, fulfilmentMode: row.fulfilment_mode,
    minUnitPricePaise: row.min_unit_price_paise === null ? null : Number(row.min_unit_price_paise),
    maxUnitPricePaise: row.max_unit_price_paise === null ? null : Number(row.max_unit_price_paise),
    effectiveFrom: row.effective_from.toISOString?.().slice(0, 10) || String(row.effective_from).slice(0, 10),
    effectiveTo: row.effective_to ? row.effective_to.toISOString?.().slice(0, 10) || String(row.effective_to).slice(0, 10) : null,
    status: row.status, components: byRule.get(row.id) || [] }));
}

async function insertComponents(client: any, userId: string, ruleId: string, components: RuleInput["components"]) {
  for (const component of components) {
    await client.query(`INSERT INTO marketplace_fee_rule_components (
      user_id, rule_id, name, component_type, calculation_method, rate_bps, amount_paise,
      calculation_base, tax_treatment, tax_rate_bps, sequence, enabled
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)`, [
      userId, ruleId, component.name, component.componentType, component.method, component.rateBps ?? null,
      component.amountPaise ?? null, component.calculationBase ?? null, component.taxTreatment,
      component.taxRateBps ?? null, component.sequence,
    ]);
  }
}

async function insertRuleAudit(client: any, userId: string, ruleId: string, field: string, oldValue: string, newValue: string, reason: string) {
  await client.query(`INSERT INTO financial_audit_logs (
    display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason, user_id
  ) VALUES ('AUD-FEE-' || gen_random_uuid()::TEXT, now(), 'FEE_RULE', $1, $2, $3, $4, 'Authenticated Merchant', $5, $6)`,
  [ruleId, field, oldValue, newValue, reason, userId]);
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    await ensureMarketplaceTables();
    const [rules, components, accountingPolicies] = await Promise.all([
      query("SELECT * FROM marketplace_fee_rules WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
      query("SELECT c.* FROM marketplace_fee_rule_components c WHERE c.user_id = $1 AND c.enabled = TRUE ORDER BY c.sequence, c.id", [userId]),
      query("SELECT * FROM channel_accounting_policies WHERE user_id = $1 ORDER BY effective_from DESC", [userId]),
    ]);
    return NextResponse.json({ success: true, rules: mapRules(rules.rows, components.rows), accountingPolicies: accountingPolicies.rows });
  } catch (error) {
    console.error("[Marketplace fee rules GET Error]", error);
    return NextResponse.json({ success: false, error: "Fee rules are unavailable." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let client: Awaited<ReturnType<typeof pool.connect>> | undefined;
  try {
    const userId = await getSessionUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const body = await readJsonBody(req, 512 * 1024);
    if (!body || !["create", "update", "archive"].includes(body.action))
      return NextResponse.json({ success: false, error: "A valid rule action is required." }, { status: 400 });
    await ensureMarketplaceTables();
    client = await pool.connect();
    await client.query("BEGIN");
    let ruleId: string;
    if (body.action === "archive") {
      if (!z.string().uuid().safeParse(body.ruleId).success) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Invalid rule ID." }, { status: 400 });
      }
      const archived = await client.query(`UPDATE marketplace_fee_rules SET status = 'ARCHIVED', updated_at = now()
        WHERE user_id = $1 AND id = $2 AND status = 'ACTIVE' RETURNING id`, [userId, body.ruleId]);
      if (!archived.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Active fee rule not found." }, { status: 404 });
      }
      await insertRuleAudit(client, userId, body.ruleId, "status", "ACTIVE", "ARCHIVED", "Marketplace fee rule archived.");
      await client.query("COMMIT");
      return NextResponse.json({ success: true, ruleId: body.ruleId, status: "ARCHIVED" });
    }

    const parsed = ruleSchema.safeParse(body.rule);
    if (!parsed.success) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "Invalid fee rule.", details: parsed.error.flatten() }, { status: 400 });
    }
    const input = parsed.data;
    if (input.sku) {
      const skuExists = await client.query("SELECT 1 FROM products WHERE user_id = $1 AND sku = $2 LIMIT 1", [userId, input.sku]);
      if (!skuExists.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "SKU scope must refer to one of your products." }, { status: 400 });
      }
    }
    if (input.productCategory) {
      const categoryExists = await client.query("SELECT 1 FROM products WHERE user_id = $1 AND category = $2 LIMIT 1", [userId, input.productCategory]);
      if (!categoryExists.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Category scope must match one of your product categories." }, { status: 400 });
      }
    }
    let version = 1;
    let ruleGroupId: string | null = null;
    if (body.action === "update") {
      if (!z.string().uuid().safeParse(body.ruleId).success) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Invalid rule ID." }, { status: 400 });
      }
      const current = await client.query(`SELECT id, rule_group_id, version, effective_from, effective_to FROM marketplace_fee_rules
        WHERE user_id = $1 AND id = $2 AND status = 'ACTIVE' FOR UPDATE`, [userId, body.ruleId]);
      if (!current.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Active fee rule not found." }, { status: 404 });
      }
      const effectiveFrom = new Date(`${input.effectiveFrom}T00:00:00Z`);
      const currentFrom = new Date(current.rows[0].effective_from);
      if (effectiveFrom <= currentFrom) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Rule updates must take effect after the current version begins." }, { status: 400 });
      }
      const proposedCutoff = new Date(effectiveFrom.getTime() - 86400000).toISOString().slice(0, 10);
      const priorCutoff = current.rows[0].effective_to
        ? new Date(current.rows[0].effective_to).toISOString().slice(0, 10)
        : proposedCutoff;
      const cutoff = priorCutoff < proposedCutoff ? priorCutoff : proposedCutoff;
      await client.query("UPDATE marketplace_fee_rules SET effective_to = $3, updated_at = now() WHERE user_id = $1 AND id = $2", [userId, body.ruleId, cutoff]);
      await insertRuleAudit(client, userId, body.ruleId, "version", String(current.rows[0].version), String(Number(current.rows[0].version) + 1), "Marketplace fee rule superseded by a new effective version.");
      version = Number(current.rows[0].version) + 1;
      ruleGroupId = current.rows[0].rule_group_id;
    }
    const inserted = await client.query(`INSERT INTO marketplace_fee_rules (
      user_id, marketplace, sku, product_category, fulfilment_mode, min_unit_price_paise, max_unit_price_paise,
      effective_from, effective_to, rule_group_id, version, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10, gen_random_uuid()),$11,'ACTIVE') RETURNING id`, [
      userId, input.marketplace, input.sku ?? null, input.productCategory ?? null, input.fulfilmentMode ?? null,
      input.minUnitPricePaise ?? null, input.maxUnitPricePaise ?? null, input.effectiveFrom,
      input.effectiveTo ?? null, ruleGroupId, version,
    ]);
    ruleId = inserted.rows[0].id;
    await insertComponents(client, userId, ruleId, input.components);
    await insertRuleAudit(client, userId, ruleId, "configuration", "NONE", JSON.stringify(input), `Marketplace fee rule ${body.action}d.`);
    await client.query("COMMIT");
    return NextResponse.json({ success: true, ruleId, version }, { status: body.action === "create" ? 201 : 200 });
  } catch (error: any) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (error?.code === "23P01") return NextResponse.json({ success: false, error: "An equally specific active fee rule overlaps this scope and effective period." }, { status: 409 });
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Marketplace fee rules POST Error]", error);
    return NextResponse.json({ success: false, error: "Fee rule could not be saved." }, { status: 500 });
  } finally {
    client?.release();
  }
}
