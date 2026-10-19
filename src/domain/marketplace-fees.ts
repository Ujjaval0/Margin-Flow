import type { Marketplace } from "./types";

export type FeeCalculationMethod = "PERCENT" | "FIXED_ORDER" | "PER_UNIT";
export type FeeCalculationBase = "ITEM_BEFORE_DISCOUNT" | "ITEM_AFTER_DISCOUNT" | "ITEM_EXCLUDING_TAX";
export type FeeTaxTreatment = "NO_TAX" | "TAXABLE" | "TAX_INCLUDED";

export interface MarketplaceFeeComponent {
  id: string;
  name: string;
  componentType: string;
  method: FeeCalculationMethod;
  rateBps?: number;
  amountPaise?: number;
  calculationBase?: FeeCalculationBase;
  taxTreatment: FeeTaxTreatment;
  taxRateBps?: number;
  sequence: number;
}

export interface MarketplaceFeeRule {
  id: string;
  version: number;
  marketplace: Marketplace;
  sku?: string | null;
  productCategory?: string | null;
  fulfilmentMode?: string | null;
  minUnitPricePaise?: number | null;
  maxUnitPricePaise?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: "ACTIVE" | "ARCHIVED" | "SUPERSEDED";
  components: MarketplaceFeeComponent[];
}

export interface FeeOrderLineInput {
  sku: string;
  productCategory?: string | null;
  fulfilmentMode?: string | null;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  taxPaise: number;
}

export function buildFeeOrderLineInputs(items: Array<{ sku: string; quantity: number; sellingPrice: number; discount?: number; taxAmount?: number }>,
  categoriesBySku: ReadonlyMap<string, string>, fulfilmentMode?: string | null): FeeOrderLineInput[] {
  return items.map(item => ({ sku: item.sku, productCategory: categoriesBySku.get(item.sku), fulfilmentMode: fulfilmentMode || null,
    quantity: item.quantity, unitPricePaise: decimalRupeesToPaise(String(item.sellingPrice)),
    discountPaise: decimalRupeesToPaise(String(item.discount ?? 0)), taxPaise: decimalRupeesToPaise(String(item.taxAmount ?? 0)) }));
}

export interface FeeRuleSnapshotComponent {
  ruleId: string | null;
  ruleVersion: number | null;
  componentId: string | null;
  componentName: string;
  componentType: string;
  method: FeeCalculationMethod;
  basePaise: number;
  rateBps?: number;
  amountPaise: number;
  taxTreatment: FeeTaxTreatment;
  taxRateBps: number;
  taxPaise: number;
  quantity: number;
  lineSku: string;
}

export type FeeEstimateResult =
  | { status: "NOT_CONFIGURED"; totalPaise: null; components: []; reason: string }
  | { status: "CONFIGURED"; totalPaise: number; components: FeeRuleSnapshotComponent[]; calculationVersion: 1 | 2 };

export interface FeeReconciliationResult {
  status: "UNAVAILABLE" | "UNMATCHED_TOTAL" | "MATCHED_COMPONENTS";
  estimatedTotalPaise: number | null;
  actualTotalPaise: number | null;
  variancePaise: number | null;
}

export function aggregateMarketplaceFeeDeductionsByOrder(deductions: Array<{ orderId: string; category: string; name: string; amountPaise: number }>): Record<string, Array<{ category: string; name: string; amountPaise: number }>> {
  return deductions.reduce<Record<string, Array<{ category: string; name: string; amountPaise: number }>>>((byOrder, deduction) => {
    if (!Number.isSafeInteger(deduction.amountPaise)) throw new Error("Actual marketplace deductions must be integer paise values.");
    (byOrder[deduction.orderId] ||= []).push({ category: deduction.category, name: deduction.name, amountPaise: deduction.amountPaise });
    return byOrder;
  }, {});
}

export function reconcileMarketplaceFees(estimate: { status: string; totalPaise: number | null; components: FeeRuleSnapshotComponent[] }, actual: Array<{ category: string; name: string; amountPaise: number }>): FeeReconciliationResult {
  if (estimate.status !== "CONFIGURED" || estimate.totalPaise === null)
    return { status: "UNAVAILABLE", estimatedTotalPaise: null, actualTotalPaise: actual.length ? actual.reduce((sum, item) => sum + item.amountPaise, 0) : null, variancePaise: null };
  if (!actual.length) return { status: "UNMATCHED_TOTAL", estimatedTotalPaise: estimate.totalPaise, actualTotalPaise: null, variancePaise: null };
  const expectedByName = new Map<string, number>();
  const actualByName = new Map<string, number>();
  const normalize = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const component of estimate.components) {
    const name = normalize(component.componentName);
    expectedByName.set(name, (expectedByName.get(name) || 0) + component.amountPaise + component.taxPaise);
  }
  for (const deduction of actual) {
    const name = normalize(deduction.name);
    actualByName.set(name, (actualByName.get(name) || 0) + deduction.amountPaise);
  }
  const componentNamesMatch = expectedByName.size > 0 && expectedByName.size === actualByName.size &&
    [...expectedByName.keys()].every(name => actualByName.has(name));
  const actualTotalPaise = actual.reduce((sum, item) => sum + item.amountPaise, 0);
  if (!componentNamesMatch) return { status: "UNMATCHED_TOTAL", estimatedTotalPaise: estimate.totalPaise, actualTotalPaise,
    variancePaise: actualTotalPaise - estimate.totalPaise };
  const variancePaise = [...expectedByName].reduce((sum, [name, expected]) => sum + (actualByName.get(name)! - expected), 0);
  return { status: "MATCHED_COMPONENTS", estimatedTotalPaise: estimate.totalPaise, actualTotalPaise, variancePaise };
}

export function reconcileSettlementNet(input: { grossPaise: number; deductionPaise: number[]; taxPaise: number; netPaise: number }): number {
  for (const value of [input.grossPaise, input.taxPaise, input.netPaise, ...input.deductionPaise])
    if (!Number.isSafeInteger(value)) throw new Error("Settlement reconciliation requires integer paise values.");
  return input.grossPaise - input.deductionPaise.reduce((sum, amount) => sum + amount, 0) - input.taxPaise - input.netPaise;
}

const MAX_SAFE_MONEY_PAISE = Number.MAX_SAFE_INTEGER;

export function decimalRupeesToPaise(value: number | string): number {
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Money must be an INR amount with at most two decimal places.");
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [rupees, fraction = ""] = unsigned.split(".");
  const paise = Number(rupees) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(paise) || paise > MAX_SAFE_MONEY_PAISE) throw new Error("Money amount is outside the supported range.");
  return negative ? -paise : paise;
}

export function paiseToDecimalString(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error("Paise value must be a safe integer.");
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function validateLine(line: FeeOrderLineInput): void {
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 0) throw new Error("Quantity must be a non-negative integer.");
  for (const amount of [line.unitPricePaise, line.discountPaise, line.taxPaise]) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Fee inputs must be non-negative integer paise.");
  }
  if (line.discountPaise > line.unitPricePaise * line.quantity) throw new Error("Discount cannot exceed the line value.");
  if (!Number.isSafeInteger(line.unitPricePaise * line.quantity) || !Number.isSafeInteger(line.taxPaise * Math.max(1, line.quantity)))
    throw new Error("Fee input totals exceed the supported money range.");
}

function specificity(rule: MarketplaceFeeRule): number {
  return Number(Boolean(rule.sku)) + Number(Boolean(rule.productCategory)) + Number(Boolean(rule.fulfilmentMode)) +
    Number(rule.minUnitPricePaise !== null && rule.minUnitPricePaise !== undefined || rule.maxUnitPricePaise !== null && rule.maxUnitPricePaise !== undefined);
}

function matches(rule: MarketplaceFeeRule, line: FeeOrderLineInput, marketplace: Marketplace, date: string): boolean {
  return rule.status === "ACTIVE" && rule.marketplace === marketplace && rule.effectiveFrom <= date &&
    (!rule.effectiveTo || date <= rule.effectiveTo) && (!rule.sku || rule.sku === line.sku) &&
    (!rule.productCategory || rule.productCategory === line.productCategory) &&
    (!rule.fulfilmentMode || rule.fulfilmentMode === line.fulfilmentMode) &&
    (rule.minUnitPricePaise === null || rule.minUnitPricePaise === undefined || line.unitPricePaise >= rule.minUnitPricePaise) &&
    (rule.maxUnitPricePaise === null || rule.maxUnitPricePaise === undefined || line.unitPricePaise < rule.maxUnitPricePaise);
}

export function resolveMarketplaceFeeRule(rules: MarketplaceFeeRule[], line: FeeOrderLineInput, marketplace: Marketplace, date: string): MarketplaceFeeRule | null {
  const matchesForLine = rules.filter(rule => matches(rule, line, marketplace, date));
  if (!matchesForLine.length) return null;
  const topSpecificity = Math.max(...matchesForLine.map(specificity));
  const best = matchesForLine.filter(rule => specificity(rule) === topSpecificity);
  if (best.length !== 1) throw new Error("Multiple equally specific active marketplace fee rules match this order line.");
  return best[0];
}

function roundedRate(basePaise: number, rateBps: number): number {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error("Rate must be integer basis points between 0 and 10000.");
  const numerator = BigInt(basePaise) * BigInt(rateBps);
  return Number((numerator + BigInt(5000)) / BigInt(10000));
}

export function calculateMarketplaceFeeEstimate(rules: MarketplaceFeeRule[], lines: FeeOrderLineInput[], marketplace: Marketplace, date: string, quickFeeRateBps?: number | null): FeeEstimateResult {
  if (!lines.length) throw new Error("At least one order line is required.");
  if (quickFeeRateBps !== null && quickFeeRateBps !== undefined && (!Number.isSafeInteger(quickFeeRateBps) || quickFeeRateBps < 0 || quickFeeRateBps > 10000))
    throw new Error("Quick commission rate must be integer basis points between 0 and 10000.");
  lines.forEach(validateLine);
  const components: FeeRuleSnapshotComponent[] = [];
  const appliedFixedComponents = new Set<string>();
  for (const line of lines) {
    const rule = resolveMarketplaceFeeRule(rules, line, marketplace, date);
    if (!rule && (quickFeeRateBps === null || quickFeeRateBps === undefined))
      return { status: "NOT_CONFIGURED", totalPaise: null, components: [], reason: `No fee rule or quick commission rate matches SKU ${line.sku}.` };
    const grossPaise = line.unitPricePaise * line.quantity;
    const discountedPaise = grossPaise - line.discountPaise;
    const taxExcludedPaise = Math.max(0, discountedPaise - line.taxPaise);
    const orderedComponents = [...(rule?.components || [])].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
    for (const component of orderedComponents) {
      if (quickFeeRateBps !== null && quickFeeRateBps !== undefined && component.componentType.trim().toUpperCase() === "COMMISSION") continue;
      const fixedComponentKey = `${rule?.id}:${component.id}`;
      if (component.method === "FIXED_ORDER" && appliedFixedComponents.has(fixedComponentKey)) continue;
      if (component.method === "PERCENT" && !component.calculationBase) throw new Error("Percentage fee components require an explicit calculation base.");
      const basePaise = component.method === "PERCENT"
        ? component.calculationBase === "ITEM_BEFORE_DISCOUNT" ? grossPaise : component.calculationBase === "ITEM_EXCLUDING_TAX" ? taxExcludedPaise : discountedPaise
        : 0;
      let amountPaise: number;
      if (component.method === "PERCENT") amountPaise = roundedRate(basePaise, component.rateBps ?? -1);
      else {
        const amount = component.amountPaise;
        if (!Number.isSafeInteger(amount) || (amount as number) < 0) throw new Error("Fixed fee components require a non-negative integer paise amount.");
        amountPaise = component.method === "PER_UNIT" ? (amount as number) * line.quantity : amount as number;
        if (!Number.isSafeInteger(amountPaise)) throw new Error("Calculated fee exceeds the supported money range.");
      }
      const taxRateBps = component.taxTreatment === "TAXABLE" ? component.taxRateBps ?? -1 : 0;
      const taxPaise = component.taxTreatment === "TAXABLE" ? roundedRate(amountPaise, taxRateBps) : 0;
      components.push({ ruleId: rule!.id, ruleVersion: rule!.version, componentId: component.id, componentName: component.name,
        componentType: component.componentType, method: component.method, basePaise, rateBps: component.rateBps,
        amountPaise, taxTreatment: component.taxTreatment, taxRateBps, taxPaise,
        quantity: component.method === "FIXED_ORDER" ? 1 : line.quantity, lineSku: line.sku });
      if (component.method === "FIXED_ORDER") appliedFixedComponents.add(fixedComponentKey);
    }
    if (quickFeeRateBps !== null && quickFeeRateBps !== undefined) {
      const amountPaise = roundedRate(taxExcludedPaise, quickFeeRateBps);
      components.push({ ruleId: null, ruleVersion: null, componentId: null, componentName: "Quick commission override",
        componentType: "COMMISSION", method: "PERCENT", basePaise: taxExcludedPaise, rateBps: quickFeeRateBps,
        amountPaise, taxTreatment: "NO_TAX", taxRateBps: 0, taxPaise: 0, quantity: line.quantity, lineSku: line.sku });
    }
  }
  const totalPaise = components.reduce((sum, component) => sum + component.amountPaise + component.taxPaise, 0);
  if (!Number.isSafeInteger(totalPaise)) throw new Error("Calculated fee exceeds the supported money range.");
  return { status: "CONFIGURED", totalPaise, components, calculationVersion: quickFeeRateBps === null || quickFeeRateBps === undefined ? 1 : 2 };
}
