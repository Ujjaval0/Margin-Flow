import type { Order, Settlement, SettlementDeduction, ReturnRecord } from "./types";
import { money, prorateMoney, sumMoney } from "./money";

export interface ChannelAccountingPolicy {
  effectiveFrom: string;
  effectiveTo?: string | null;
  pricesIncludeTax?: boolean;
  gstRegistrationType?: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  marketplaceFeesIncludeGst?: boolean;
  marketplaceFeeGstRateBps: number;
}

/** Recorded tax is not automatically recoverable: eligibility and its evidence are separate facts. */
export function marketplaceFeeFacts(order: Order, deduction: SettlementDeduction) {
  const cash = money(deduction.amount);
  const recordedTax = deduction.gstAmount !== undefined ? money(deduction.gstAmount)
    : order.marketplaceFeesIncludeGst === true
      ? prorateMoney(cash, order.marketplaceFeeGstRateBps ?? 1800, 10000 + (order.marketplaceFeeGstRateBps ?? 1800)) : 0;
  if (Math.abs(recordedTax) > Math.abs(cash) || recordedTax * cash < 0) throw new Error("Fee GST cannot exceed the recorded deduction.");
  const eligible = order.gstRegistrationType === "REGULAR" && deduction.gstCreditStatus === "ELIGIBLE" && !!deduction.gstEvidenceReference?.trim();
  const credit = deduction.eligibleGstAmount === undefined ? recordedTax : money(deduction.eligibleGstAmount);
  if (Math.abs(credit) > Math.abs(recordedTax) || credit * recordedTax < 0) throw new Error("Eligible fee GST cannot exceed recorded GST or reverse its sign.");
  const provisionalInputCredit = eligible ? credit : 0;
  const creditUnresolved = recordedTax !== 0 && deduction.gstCreditStatus !== "INELIGIBLE" && (!eligible || credit !== recordedTax);
  return { cash, expense: sumMoney([cash, -provisionalInputCredit]), provisionalInputCredit, recordedTax, creditUnresolved };
}

export const STATUTORY_WITHHOLDING_RATES = [
  { effectiveFrom: "2020-10-01", tcsBps: 100, tdsBps: 75 },
  { effectiveFrom: "2021-04-01", tcsBps: 100, tdsBps: 100 },
  { effectiveFrom: "2024-07-10", tcsBps: 50, tdsBps: 100 },
  { effectiveFrom: "2024-10-01", tcsBps: 50, tdsBps: 10 },
] as const;

/** Warnings only: callers supply evidenced monthly taxable/gross bases, never payout net of fees. */
export function validateStatutoryWithholding(input: {
  date?: string; netTaxableValue: number; grossExcludingGst: number;
  tdsDate?: string; tdsApplicability?: "VERIFIED_APPLICABLE" | "VERIFIED_EXEMPT" | "UNKNOWN";
  tcsTax?: number; tdsTax?: number; rates?: { effectiveFrom: string; tcsBps: number; tdsBps: number }[];
}) {
  const rateAt = (date: string | undefined) => isAccountingDate(date) ? [...(input.rates || STATUTORY_WITHHOLDING_RATES)]
    .filter(rate => rate.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] : undefined;
  const tcsRate = rateAt(input.date);
  const tdsRate = rateAt(input.tdsDate);
  const expectedTcs = tcsRate ? prorateMoney(Math.max(0, input.netTaxableValue), tcsRate.tcsBps, 10000) : undefined;
  const expectedTds = input.tdsApplicability === "VERIFIED_EXEMPT" ? 0
    : input.tdsApplicability === "VERIFIED_APPLICABLE" && tdsRate ? prorateMoney(Math.max(0, input.grossExcludingGst), tdsRate.tdsBps, 10000) : undefined;
  return ([ ["TCS", input.tcsTax, expectedTcs], ["TDS", input.tdsTax, expectedTds] ] as const)
    .filter(([, actual, expected]) => actual !== undefined && expected !== undefined && Math.abs(sumMoney([actual, -expected])) > 0.01)
    .map(([tax, actual, expected]) => ({ tax, actual, expected, message: `${tax} differs from the configured dated rate; verify applicability and taxable base.` }));
}

/** Keep an unclassified legacy aggregate until both statutory components are evidenced. */
export function getSettlementWithholding(settlement: Pick<Settlement, "tcsTax" | "tdsTax" | "tcsTdsTax">): number {
  return settlement.tcsTax !== undefined && settlement.tdsTax !== undefined
    ? sumMoney([settlement.tcsTax, settlement.tdsTax])
    : money(settlement.tcsTdsTax || sumMoney([settlement.tcsTax || 0, settlement.tdsTax || 0]));
}

export function isAccountingDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Section 34 eligibility is evidenced independently of the commercial customer refund. */
export function eligibleReturnGst(record: ReturnRecord, maximum: number): number {
  const evidence = record.gstAdjustment;
  if (evidence?.status !== "ELIGIBLE") return 0;
  if (!evidence.creditNoteNumber?.trim() || !evidence.evidenceReference?.trim() ||
      !isAccountingDate(evidence.originalSupplyDate) || !isAccountingDate(evidence.creditNoteDate) || !isAccountingDate(evidence.declaredDate) ||
      evidence.annualReturnFiledDate !== undefined && !isAccountingDate(evidence.annualReturnFiledDate))
    throw new Error("GST adjustment requires valid supply, credit-note and declaration evidence.");
  const supply = evidence.originalSupplyDate;
  const financialYearEnd = Number(supply.slice(0, 4)) + (Number(supply.slice(5, 7)) > 3 ? 1 : 0);
  // For FY ending March 2027, the ordinary cutoff is 30 November 2027.
  const cutoff = [financialYearEnd + "-11-30", evidence.annualReturnFiledDate].filter((date): date is string => !!date).sort()[0];
  if (evidence.declaredDate > cutoff || evidence.creditNoteDate > evidence.declaredDate || evidence.creditNoteDate < supply ||
      evidence.annualReturnFiledDate !== undefined && evidence.annualReturnFiledDate < supply ||
      !Number.isFinite(evidence.amount) || toEvidencePaise(evidence.amount) < 0 || toEvidencePaise(evidence.amount) > toEvidencePaise(maximum))
    throw new Error("GST adjustment exceeds the evidenced amount or statutory declaration window.");
  return money(evidence.amount);
}

const toEvidencePaise = (amount: number) => Math.round(money(amount) * 100);
