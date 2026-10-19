import { settlementMovement } from "./settlement-evidence";
import { claimRecoveryEvents } from "./claim-recovery";
import { getSettlementWithholding, eligibleReturnGst, marketplaceFeeFacts, isAccountingDate } from "./accounting-policy";
import { getOrderFinancialFacts, money, toPaise, sumMoney, prorateMoney } from "./order-financials";
import { Order, ReturnRecord, Settlement, PurchaseBill, Expense } from "./types";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface AccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: "DEBIT" | "CREDIT";
  description: string;
}

export const CHART_OF_ACCOUNTS: Record<string, AccountDefinition> = {
  // 1000: Assets
  "1010": {
    code: "1010",
    name: "Cash & Bank Accounts",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Liquid operating bank balances received via settlement payouts.",
  },
  "1020": {
    code: "1020",
    name: "Marketplace Escrow Receivables",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Net dues owed by Amazon, Flipkart, Meesho, Shopify pending disbursement.",
  },
  "1030": {
    code: "1030",
    name: "Inventory on Hand",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Asset valuation of physical warehouse stock at landed purchase cost.",
  },
  "1040": {
    code: "1040",
    name: "GST Input Tax Credit (ITC)",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Eligible input GST paid on supplier purchases available for tax offset.",
  },

  "1050": { code: "1050", name: "Supplier Advances", type: "ASSET", normalBalance: "DEBIT", description: "Supplier payments in excess of allocated invoices." },
  "1060": { code:"1060",name:"Supplier Payment Suspense",type:"ASSET",normalBalance:"DEBIT",description:"Evidenced payments awaiting invoice/advance allocation; not a confirmed supplier advance." },
  "1070": {code:"1070",name:"GST Pending Classification",type:"ASSET",normalBalance:"DEBIT",description:"Unresolved tax evidence; not eligible ITC."},
  "1080": {code:"1080",name:"GST TCS Receivable",type:"ASSET",normalBalance:"DEBIT",description:"GST source collections pending official cash-ledger reconciliation."},
  "1090": {code:"1090",name:"Income-tax TDS Receivable",type:"ASSET",normalBalance:"DEBIT",description:"Income-tax withholding pending official statement reconciliation."},
  "2040": {code:"2040",name:"Credit Card Payable",type:"LIABILITY",normalBalance:"CREDIT",description:"Card charges awaiting evidenced bank payment."},
  "6040": {code:"6040",name:"Nonrecoverable Refunded GST",type:"EXPENSE",normalBalance:"DEBIT",description:"Commercial tax refunds without admissible statutory liability reduction."},

  // 2000: Liabilities
  "2010": {
    code: "2010",
    name: "Accounts Payable (Vendors)",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Outstanding dues owed to wholesale manufacturers and suppliers.",
  },
  "2020": {
    code: "2020",
    name: "GST Output Tax Payable",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Goods & Services Tax collected on retail sales payable to government.",
  },
  "2030": {
    code: "2030",
    name: "Unclassified Statutory Withholdings",
    type: "ASSET",
    normalBalance: "DEBIT",
    description: "Legacy aggregate awaiting classification between GST TCS and income-tax TDS; not a confirmed available tax credit.",
  },

  // 4000: Revenue
  "4010": {
    code: "4010",
    name: "Gross Sales Revenue (GMV)",
    type: "REVENUE",
    normalBalance: "CREDIT",
    description: "Gross merchandise customer invoice value before marketplace deductions.",
  },
  "4020": {
    code: "4020",
    name: "Marketplace Claim Recoveries",
    type: "REVENUE",
    normalBalance: "CREDIT",
    description: "Approved SAFE-T / SPF reimbursement claims credited by platforms.",
  },

  "4030": { code: "4030", name: "Sales Returns", type: "REVENUE", normalBalance: "DEBIT", description: "Revenue refunded for returned units." },
  "4040": { code: "4040", name: "Salvage Recoveries", type: "REVENUE", normalBalance: "CREDIT", description: "Recorded damaged inventory salvage." },

  "4050": { code: "4050", name: "Customer Shipping Revenue", type: "REVENUE", normalBalance: "CREDIT", description: "Customer shipping charges excluding GST and explicit refunds." },

  // 5000: Cost of Goods Sold (COGS)
  "5010": {
    code: "5010",
    name: "Cost of Goods Sold (Delivered)",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Wholesale cost basis of products successfully fulfilled to customers.",
  },
  "5020": {
    code: "5020",
    name: "Damaged & Liquidated Return Losses",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Irrecoverable inventory write-offs caused by transit damage or fraud.",
  },

  // 6000: Operating & Platform Expenses
  "6010": {
    code: "6010",
    name: "Marketplace Referral & Commission Fees",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Platform commissions, closing fees, and technology listing tariffs.",
  },
  "6020": {
    code: "6020",
    name: "Logistics & Forward/Reverse Shipping",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Fulfillment shipping, courier fees, and return logistics charges.",
  },
  "6030": {
    code: "6030",
    name: "General & Administrative Overheads",
    type: "EXPENSE",
    normalBalance: "DEBIT",
    description: "Software subscriptions, warehouse rent, packaging, and marketing spend.",
  },
};

export interface JournalPostingLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  isProvisional?: boolean;
  issues?: string[];
  id: string;
  timestamp: string;
  referenceType:
    | "ORDER_FULFILLMENT"
    | "SETTLEMENT_REMITTANCE"
    | "CUSTOMER_RETURN"
    | "PURCHASE_BILL"
    | "OPERATING_EXPENSE"
    | "SUPPLIER_PAYMENT"
    | "CLAIM_RECOVERY"
    | "OUTPUT_GST"
    | "MARKETPLACE_FEE";
  referenceId: string;
  description: string;
  lines: JournalPostingLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  type: AccountType;
  normalBalance: "DEBIT" | "CREDIT";
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface TrialBalance {
  isComplete: boolean;
  provisionalEntries: number;
  issues: string[];
  asOf: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  discrepancy: number;
}

/**
 * Validate that sum of debits equals sum of credits exactly in whole paise.
 */
export function validateJournalBalance(lines: JournalPostingLine[]): {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  const normalized = normalizeJournalLines(lines);
  const debitPaise = normalized.reduce((acc, line) => acc + BigInt(toPaise(line.debit)), BigInt(0));
  const creditPaise = normalized.reduce((acc, line) => acc + BigInt(toPaise(line.credit)), BigInt(0));
  if (!Number.isSafeInteger(Number(debitPaise)) || !Number.isSafeInteger(Number(creditPaise))) throw new Error("Journal exceeds the supported money range.");
  return { isBalanced: debitPaise === creditPaise, totalDebit: Number(debitPaise) / 100,
    totalCredit: Number(creditPaise) / 100, difference: Math.abs(Number(debitPaise - creditPaise)) / 100 };
}

/** Reversals swap sides; exported journals never contain negative debit/credit cells. */
export function normalizeJournalLines(lines: JournalPostingLine[]): JournalPostingLine[] {
  return lines.map(line => {
    const net = sumMoney([line.debit, -line.credit]);
    return { ...line, debit: Math.max(0, net), credit: Math.max(0, -net) };
  }).filter(line => line.debit !== 0 || line.credit !== 0);
}

function journalTotals(lines: JournalPostingLine[]) {
  const { totalDebit, totalCredit, isBalanced } = validateJournalBalance(lines);
  return { totalDebit, totalCredit, isBalanced };
}

/**
 * Project evidenced operational events; unresolved classification remains explicitly provisional.
 */
export function generateGeneralLedger(
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  purchases: PurchaseBill[],
  expenses: Expense[],
  supplierPayments: import("./types").SupplierPayment[] = [],
  claims: import("./types").Claim[] = []
): JournalEntry[] {
  const entries: JournalEntry[] = [];
  settlements = Array.from(new Map(settlements.map(settlement => [settlement.id, settlement])).values());

  // Revenue and tax have independent evidenced accounting dates.
  orders.forEach((order) => {
    const facts = getOrderFinancialFacts(order, returns, settlements, claims);
    const recognitionDate = order.revenueRecognisedDate || order.orderDate;
    const originalShippingTax = money(order.shippingTaxAmount || 0);
    const shippingRevenue = sumMoney([order.shippingFeeCharged || 0, -originalShippingTax, order.customerCharges || 0]);
    const outputTax = sumMoney([...order.items.map(item => item.taxAmount || 0), originalShippingTax, order.customerChargesTax || 0]);
    const evidencedTaxDate = isAccountingDate(order.taxPointDate) && !!order.taxEvidenceReference?.trim();
    const taxDate = evidencedTaxDate ? order.taxPointDate! : recognitionDate;
    if (outputTax && (facts.revenueRecognised || evidencedTaxDate)) {
      const issues = evidencedTaxDate ? [] : ['GST tax point unverified; date is provisional'];
      if (!order.gstRegistrationType || order.gstRegistrationType !== 'REGULAR') issues.push('GST registration/tax collection treatment requires verification');
      entries.push({ id: 'JE-GST-' + order.id, timestamp: taxDate.slice(0, 10) + 'T09:00:00.000Z',
        referenceType: 'OUTPUT_GST', referenceId: order.id, description: 'Recorded invoice GST for order ' + (order.channelOrderId || order.id),
        isProvisional: issues.length > 0, issues, lines: [
          { accountCode: '1020', accountName: CHART_OF_ACCOUNTS['1020'].name, debit: outputTax, credit: 0 },
          { accountCode: '2020', accountName: CHART_OF_ACCOUNTS['2020'].name, debit: 0, credit: outputTax },
        ], totalDebit: outputTax, totalCredit: outputTax, isBalanced: true });
    }
    if (!facts.revenueRecognised) return;
    const issues = [...facts.issues];
    if (!facts.taxBasisKnown) issues.push('Price tax basis unresolved; monetary sales posting withheld');
    const lines: JournalPostingLine[] = [];
    const revenue = sumMoney([facts.revenueBeforeReturns, shippingRevenue]);
    if (facts.taxBasisKnown) {
      lines.push({ accountCode: '1020', accountName: CHART_OF_ACCOUNTS['1020'].name, debit: revenue, credit: 0 },
        { accountCode: '4010', accountName: CHART_OF_ACCOUNTS['4010'].name, debit: 0, credit: facts.revenueBeforeReturns });
      if (shippingRevenue) lines.push({ accountCode: '4050', accountName: CHART_OF_ACCOUNTS['4050'].name, debit: 0, credit: shippingRevenue });
    }
    if (facts.dispatchedCogs) lines.push(
      { accountCode: '5010', accountName: CHART_OF_ACCOUNTS['5010'].name, debit: facts.dispatchedCogs, credit: 0 },
      { accountCode: '1030', accountName: CHART_OF_ACCOUNTS['1030'].name, debit: 0, credit: facts.dispatchedCogs });
    entries.push({ id: 'JE-ORD-' + order.id, timestamp: recognitionDate.slice(0, 10) + 'T10:00:00.000Z',
      referenceType: 'ORDER_FULFILLMENT', referenceId: order.id, description: 'Recognised order ' + (order.channelOrderId || order.id) + ' on ' + order.marketplace,
      isProvisional: !facts.isComplete || issues.length > 0, issues, lines, ...journalTotals(lines) });

    if (order.shippingRefundAmount) {
      const refund = Math.min(money(order.shippingRefundAmount), money(order.shippingFeeCharged || 0));
      const taxRefund = order.shippingFeeCharged > 0 ? prorateMoney(originalShippingTax, toPaise(refund), toPaise(order.shippingFeeCharged)) : 0;
      const refundLines: JournalPostingLine[] = [];
      const refundIssues: string[] = [];
      if (!isAccountingDate(order.shippingRefundDate)) refundIssues.push('Shipping refund date unresolved; refund posting withheld');
      else {
        refundLines.push({ accountCode: '1020', accountName: CHART_OF_ACCOUNTS['1020'].name, debit: 0, credit: refund },
          { accountCode: '4050', accountName: CHART_OF_ACCOUNTS['4050'].name, debit: sumMoney([refund, -taxRefund]), credit: 0 });
        if (taxRefund) {
          refundIssues.push('Shipping refund GST credit-note eligibility unresolved');
          refundLines.push({ accountCode: '1070', accountName: CHART_OF_ACCOUNTS['1070'].name, debit: taxRefund, credit: 0 });
        }
      }
      entries.push({ id: 'JE-SHIP-RET-' + order.id, timestamp: (order.shippingRefundDate || recognitionDate).slice(0, 10) + 'T14:00:00.000Z',
        referenceType: 'CUSTOMER_RETURN', referenceId: order.id, description: 'Recorded customer shipping refund', lines: refundLines,
        isProvisional: refundIssues.length > 0, issues: refundIssues, ...journalTotals(refundLines) });
    }
  });

  // Actual platform charges belong to their source event date, including cancelled orders.
  settlements.forEach(source => {
    const settlement=settlementMovement(source,settlements);
    const order = orders.find(order => order.marketplace === settlement.marketplace && [order.id, order.channelOrderId].includes(settlement.orderId));
    const lines: JournalPostingLine[] = [];
    const issues: string[] = [];
    for (const deduction of settlement.deductions.filter(deduction => !['TAX_TCS', 'TAX_TDS'].includes(deduction.category))) {
      const facts = marketplaceFeeFacts(order || { gstRegistrationType: undefined } as Order, deduction);
      const accountCode = ['LOGISTICS', 'RETURN_SHIPPING'].includes(deduction.category) ? '6020' : '6010';
      lines.push({ accountCode, accountName: CHART_OF_ACCOUNTS[accountCode].name, debit: facts.expense, credit: 0, memo: deduction.name },
        { accountCode: '1020', accountName: CHART_OF_ACCOUNTS['1020'].name, debit: 0, credit: facts.cash, memo: deduction.name });
      if (facts.provisionalInputCredit) lines.push({ accountCode: '1040', accountName: CHART_OF_ACCOUNTS['1040'].name, debit: facts.provisionalInputCredit, credit: 0, memo: deduction.gstEvidenceReference });
      if (facts.creditUnresolved) issues.push('Fee GST recoverability unresolved: ' + deduction.name);
      if (deduction.gstAmount === undefined && order?.marketplaceFeesIncludeGst === undefined) issues.push('Fee GST component/basis unverified: ' + deduction.name);
    }
    if (!lines.length) return;
    if (settlement.feeCoverage !== 'COMPLETE') issues.push('Actual marketplace fee coverage incomplete');
    entries.push({ id: 'JE-FEE-' + settlement.id, timestamp: settlement.settlementDate.slice(0, 10) + 'T13:00:00.000Z',
      referenceType: 'MARKETPLACE_FEE', referenceId: settlement.id, description: 'Recorded marketplace charges for ' + settlement.orderId,
      lines, isProvisional: issues.length > 0, issues, ...journalTotals(lines) });
  });

  // 2. Marketplace Settlements Remitted
  settlements.forEach((source) => {
    const settlement=settlementMovement(source,settlements);
    const financialEvent = settlement.evidenceType === "FINANCIAL_EVENT";
    const netCash = financialEvent ? 0 : money(settlement.netSettlement);
    const tcsTds = getSettlementWithholding(settlement);
    if (financialEvent && !tcsTds) return;
    const grossCredit = sumMoney([netCash, tcsTds]);
    const issues: string[] = [];
    if (!settlement.evidenceType) issues.push("Legacy settlement bank-receipt evidence requires verification");

    const lines: JournalPostingLine[] = [
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: netCash,
        credit: 0,
        memo: `Disbursement received into bank account (${settlement.marketplace})`,
      },
    ];

    const knownWithholding = sumMoney([settlement.tcsTax || 0, settlement.tdsTax || 0]);
    const separate = settlement.tcsTax !== undefined && settlement.tdsTax !== undefined;
    const remainder = sumMoney([tcsTds, -knownWithholding]);
    const conflicting = !separate && knownWithholding !== 0 && (Math.sign(knownWithholding) !== Math.sign(tcsTds) || Math.abs(knownWithholding) > Math.abs(tcsTds));
    if (conflicting) issues.push("Withholding aggregate conflicts with its recorded components; classification withheld");
    if (!conflicting) for (const [code, amount] of [["1080", settlement.tcsTax], ["1090", settlement.tdsTax]] as const)
      if (amount) lines.push({ accountCode: code, accountName: CHART_OF_ACCOUNTS[code].name, debit: amount, credit: 0, memo: "Recorded withholding; official tax-credit confirmation is separate" });
    const unclassified = conflicting ? tcsTds : remainder;
    if (unclassified) {
      issues.push("Legacy statutory withholding has an unclassified balance");
      lines.push({ accountCode: "2030", accountName: CHART_OF_ACCOUNTS["2030"].name, debit: unclassified, credit: 0 });
    }

    lines.push({
      accountCode: "1020",
      accountName: CHART_OF_ACCOUNTS["1020"].name,
      debit: 0,
      credit: grossCredit,
      memo: `Settlement payout clearance for batch ${settlement.id}`,
    });

    const validation = validateJournalBalance(lines);

    entries.push({
      id: `JE-SET-${settlement.id}`,
      timestamp: `${settlement.settlementDate}T16:30:00.000Z`,
      referenceType: "SETTLEMENT_REMITTANCE",
      referenceId: settlement.id,
      description: financialEvent ? `Recorded statutory withholding by ${settlement.marketplace}` : `Bank disbursement remitted by ${settlement.marketplace}`,
      isProvisional: issues.length > 0,
      issues,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  // Commercial refunds and physical inventory receipts are distinct dated events.
  orders.forEach(order => {
    const facts = getOrderFinancialFacts(order, returns, settlements, claims);
    if (!facts.revenueRecognised) return;
    facts.returnDetails.forEach(detail => {
      const record = detail.record;
      const lines: JournalPostingLine[] = [];
      const issues: string[] = [];
      const pair = (debit: string, credit: string, amount: number, memo: string) => {
        if (!amount) return;
        lines.push({ accountCode: debit, accountName: CHART_OF_ACCOUNTS[debit].name, debit: amount, credit: 0, memo },
          { accountCode: credit, accountName: CHART_OF_ACCOUNTS[credit].name, debit: 0, credit: amount, memo });
      };
      if (!facts.taxBasisKnown && (detail.refundedRevenue || detail.refundedTax)) issues.push('Price tax basis unresolved; commercial refund posting withheld');
      else {
        pair('4030', '1020', detail.refundedRevenue, 'Commercial revenue refunded for bounded returned units');
        let eligible = 0;
        try { eligible = eligibleReturnGst(record, detail.refundedTax); }
        catch (error) { issues.push(error instanceof Error ? error.message : 'Invalid GST credit-note evidence'); }
        // Section 34 reports the note in its issue month; filing date is eligibility evidence.
        if (eligible) entries.push({ id: 'JE-GST-RET-' + record.id, timestamp: record.gstAdjustment!.creditNoteDate! + 'T09:30:00.000Z',
          referenceType: 'OUTPUT_GST', referenceId: record.id, description: 'Evidenced GST credit-note adjustment', lines: [
            { accountCode: '2020', accountName: CHART_OF_ACCOUNTS['2020'].name, debit: eligible, credit: 0 },
            { accountCode: '1070', accountName: CHART_OF_ACCOUNTS['1070'].name, debit: 0, credit: eligible },
          ], totalDebit: eligible, totalCredit: eligible, isBalanced: true });
        const pending = sumMoney([detail.refundedTax, -eligible]);
        if (pending && record.gstAdjustment?.status !== 'INELIGIBLE') issues.push('Commercial GST refund eligibility unresolved');
        pair(record.gstAdjustment?.status === 'INELIGIBLE' ? '6040' : '1070', '1020', detail.refundedTax,
          'Commercial GST refund; statutory credit is separately evidenced');
      }
      pair('6010', '1020', detail.customerReturnFee, 'Recorded customer return fee');
      pair('6020', '1020', sumMoney([detail.returnShippingCost, detail.otherReturnCosts]), 'Recorded reverse logistics and other return costs');
      const inventoryLines: JournalPostingLine[] = [];
      const inventoryPair = (debit: string, credit: string, amount: number, memo: string) => {
        if (!amount) return;
        inventoryLines.push({ accountCode: debit, accountName: CHART_OF_ACCOUNTS[debit].name, debit: amount, credit: 0, memo },
          { accountCode: credit, accountName: CHART_OF_ACCOUNTS[credit].name, debit: 0, credit: amount, memo });
      };
      if (isAccountingDate(record.receivedDate)) {
        inventoryPair('1030', '5010', detail.restockedCost, 'Physically received and restocked at original snapshot cost');
        inventoryPair('5020', '5010', detail.damagedCost, 'Reclassification of evidenced damaged inventory cost');
        inventoryPair('1030', '5020', detail.salvageValue, 'Recovered inventory at bounded cost/NRV; no invented sales income');
      } else if (detail.restockedCost || detail.damagedCost || detail.salvageValue || record.restockStatus === 'RESTOCKED') {
        issues.push('Physical return receipt date unresolved; inventory posting withheld');
      }
      if (inventoryLines.length) entries.push({ id: 'JE-RET-STOCK-' + record.id, timestamp: record.receivedDate! + 'T14:30:00.000Z',
        referenceType: 'CUSTOMER_RETURN', referenceId: record.id, description: 'Physical inventory return for ' + (order.channelOrderId || order.id),
        lines: inventoryLines, ...journalTotals(inventoryLines) });
      if (lines.length || issues.length) entries.push({ id: 'JE-RET-' + record.id, timestamp: record.returnDate.slice(0, 10) + 'T14:00:00.000Z',
        referenceType: 'CUSTOMER_RETURN', referenceId: record.id, description: 'Commercial return for ' + (order.channelOrderId || order.id),
        lines, isProvisional: issues.length > 0, issues, ...journalTotals(lines) });
    });
  });

  Array.from(new Map(claims.map(claim => [claim.id, claim])).values()).forEach(claim => {
    if (!claim.amountRecovered) return; // Closing or rejecting a claim never erases an evidenced recovery.
    const issues: string[] = [];
    if (!claimRecoveryEvents(claim).length || claimRecoveryEvents(claim).some(event=>!isAccountingDate(event.date))) issues.push("Claim recovery date unresolved; recovery posting withheld");
    if (!orders.some(order => order.marketplace === claim.marketplace && [order.id, order.channelOrderId].includes(claim.orderId))) issues.push("Claim has no linked order; recovery classification unresolved");
    if (issues.length) {
      entries.push({ id: "JE-CLAIM-" + claim.id, timestamp: claim.claimDate.slice(0, 10) + "T15:00:00.000Z",
        referenceType: "CLAIM_RECOVERY", referenceId: claim.id, description: "Unresolved recorded claim recovery", lines: [],
        isProvisional: true, issues, totalDebit: 0, totalCredit: 0, isBalanced: true });
      return;
    }
    for(const event of claimRecoveryEvents(claim)) {
      const amount=money(event.amount),lines=[{accountCode:'1020',accountName:CHART_OF_ACCOUNTS['1020'].name,debit:amount,credit:0},{accountCode:'4020',accountName:CHART_OF_ACCOUNTS['4020'].name,debit:0,credit:amount}];
      entries.push({id:'JE-CLAIM-'+claim.id+'-'+event.id,timestamp:event.date+'T15:00:00.000Z',referenceType:'CLAIM_RECOVERY',referenceId:claim.id,description:'Recorded marketplace claim recovery',lines,totalDebit:amount,totalCredit:amount,isBalanced:true});
    }
  });

  // 4. Purchase Bills (Wholesale Inventory Intake)
  purchases.forEach((purch) => {
    const rawSubtotal = purch.lineSubtotal??prorateMoney(purch.unitCost, purch.quantity, 1);
    const tax = money((purch.taxes || 0));
    const declaredTotal = money(purch.totalAmount);
    const totalPayable = declaredTotal;
    const subtotal = sumMoney([totalPayable, -tax]);

    const lines: JournalPostingLine[] = [
      {
        accountCode: "1030",
        accountName: CHART_OF_ACCOUNTS["1030"].name,
        debit: subtotal,
        credit: 0,
        memo: `Wholesale inventory intake from ${purch.supplierName}`,
      },
    ];

    if (subtotal < 0) throw new Error("Purchase tax exceeds the recorded invoice payable.");
    const issues: string[] = [];
    const eligible = purch.gstCreditStatus === "ELIGIBLE" && purch.gstEvidenceReference?.trim() ? money(purch.eligibleGstAmount ?? tax) : 0;
    if (eligible < 0 || eligible > tax) throw new Error("Eligible purchase GST must be bounded by recorded invoice tax.");
    const pending = purch.gstCreditStatus === "INELIGIBLE" ? 0 : sumMoney([tax, -eligible]);
    if (purch.gstCreditStatus === "INELIGIBLE") lines[0].debit = sumMoney([subtotal, tax]);
    if (eligible) lines.push({ accountCode: "1040", accountName: CHART_OF_ACCOUNTS["1040"].name, debit: eligible, credit: 0, memo: "Evidenced recoverable purchase GST: " + purch.gstEvidenceReference });
    if (pending) {
      issues.push("Purchase GST recoverability unresolved; pending classification is not eligible ITC");
      lines.push({ accountCode: "1070", accountName: CHART_OF_ACCOUNTS["1070"].name, debit: pending, credit: 0, memo: "Unresolved purchase tax classification" });
    }
    if (toPaise(sumMoney([rawSubtotal, tax])) !== toPaise(totalPayable)) issues.push("Invoice total differs from quantity/cost plus tax; inventory basis requires reconciliation");

    lines.push({
      accountCode: "2010",
      accountName: CHART_OF_ACCOUNTS["2010"].name,
      debit: 0,
      credit: totalPayable,
      memo: `Payable liability to ${purch.supplierName} (Bill: ${purch.invoiceNumber})`,
    });

    const validation = validateJournalBalance(lines);

    // Legacy paid totals exclude allocations represented by dated payment records.
    const recorded = sumMoney(supplierPayments.flatMap(payment => payment.allocations.filter(allocation => allocation.purchaseId === purch.id).map(allocation => allocation.amount)));
    const paid = Math.max(0, sumMoney([Math.min(totalPayable, purch.paidAmount ?? (purch.paymentStatus === "PAID" ? totalPayable : 0)), -recorded]));
    if (paid > 0 && !isAccountingDate(purch.paymentDate)) issues.push("Legacy paid amount has no valid payment date; cash posting withheld");
    if (paid > 0 && isAccountingDate(purch.paymentDate)) {
      const paymentLines = [
        { accountCode: "2010", accountName: CHART_OF_ACCOUNTS["2010"].name, debit: paid, credit: 0 },
        { accountCode: "1010", accountName: CHART_OF_ACCOUNTS["1010"].name, debit: 0, credit: paid },
      ];
      entries.push({ id: "JE-PAY-" + purch.id, timestamp: purch.paymentDate + "T11:30:00.000Z", referenceType: "SUPPLIER_PAYMENT", referenceId: purch.id,
        description: "Evidenced supplier payment", lines: paymentLines,
        totalDebit: paid, totalCredit: paid, isBalanced: true });
    }
    entries.push({
      id: `JE-PUR-${purch.id}`,
      timestamp: `${purch.invoiceDate}T11:00:00.000Z`,
      referenceType: "PURCHASE_BILL",
      referenceId: purch.id,
      description: `Wholesale purchase from ${purch.supplierName} (Bill ${purch.invoiceNumber})`,
      isProvisional: issues.length > 0,
      issues,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  supplierPayments.forEach(payment => {
    const applied = sumMoney(payment.allocations.map(allocation => allocation.amount));
    if(payment.allocationStatus==='UNRESOLVED') {
      const amount=money(payment.amount),code=payment.paymentMethod==='CREDIT_CARD'?'2040':'1010';
      const lines=[{accountCode:'1060',accountName:CHART_OF_ACCOUNTS['1060'].name,debit:amount,credit:0},{accountCode:code,accountName:CHART_OF_ACCOUNTS[code].name,debit:0,credit:amount}];
      entries.push({id:'JE-PAY-'+payment.id,timestamp:payment.date+'T11:30:00.000Z',referenceType:'SUPPLIER_PAYMENT',referenceId:payment.id,description:'Supplier payment allocation unresolved',lines,isProvisional:true,issues:['Invoice/advance allocation needs source reconciliation'],...journalTotals(lines)});return;
    }
    if (toPaise(sumMoney([applied, payment.advanceAmount])) !== toPaise(payment.amount)) throw new Error("Supplier payment allocations do not reconcile.");
    const lines: JournalPostingLine[] = [
      { accountCode: "2010", accountName: CHART_OF_ACCOUNTS["2010"].name, debit: applied, credit: 0 },
      { accountCode: "1050", accountName: CHART_OF_ACCOUNTS["1050"].name, debit: payment.advanceAmount, credit: 0 },
      { accountCode: payment.paymentMethod === "CREDIT_CARD" ? "2040" : "1010", accountName: CHART_OF_ACCOUNTS[payment.paymentMethod === "CREDIT_CARD" ? "2040" : "1010"].name, debit: 0, credit: payment.amount },
    ];
    const validation = validateJournalBalance(lines);
    entries.push({ id: "JE-PAY-" + payment.id, timestamp: payment.date + "T11:30:00.000Z", referenceType: "SUPPLIER_PAYMENT", referenceId: payment.id,
      description: "Supplier payment " + payment.reference, lines, totalDebit: validation.totalDebit, totalCredit: validation.totalCredit, isBalanced: validation.isBalanced });
  });

  // 5. Operating Expenses
  expenses.forEach((exp) => {
    const amount = money(exp.amount);
    const lines: JournalPostingLine[] = [
      {
        accountCode: "6030",
        accountName: CHART_OF_ACCOUNTS["6030"].name,
        debit: amount,
        credit: 0,
        memo: `${exp.category}: ${exp.description}`,
      },
      {
        accountCode: exp.paymentMethod==='CREDIT_CARD'?'2040':'1010',
        accountName: CHART_OF_ACCOUNTS[exp.paymentMethod==='CREDIT_CARD'?'2040':'1010'].name,
        debit: 0,
        credit: amount,
        memo: "Cash outflow for operational expense",
      },
    ];

    const validation = validateJournalBalance(lines);

    entries.push({
      id: `JE-EXP-${exp.id}`,
      timestamp: `${exp.date}T12:00:00.000Z`,
      referenceType: "OPERATING_EXPENSE",
      referenceId: exp.id,
      description: `Opex: ${exp.category} - ${exp.description}`,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  // Normalize signed reversals before display/export and recompute exact posting totals.
  return entries.map(entry => {
    const lines = normalizeJournalLines(entry.lines);
    return { ...entry, lines, ...journalTotals(lines) };
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id));
}

/**
 * Calculate Trial Balance across all accounts from posted journal entries.
 */
export function calculateTrialBalance(entries: JournalEntry[]): TrialBalance {
  const accountTotals: Record<string, { totalDebit: bigint; totalCredit: bigint }> = {};

  // Initialize all accounts with zero
  Object.keys(CHART_OF_ACCOUNTS).forEach((code) => {
    accountTotals[code] = { totalDebit: BigInt(0), totalCredit: BigInt(0) };
  });

  // Sum postings
  entries.forEach((entry) => {
    normalizeJournalLines(entry.lines).forEach((line) => {
      if (!accountTotals[line.accountCode]) {
        accountTotals[line.accountCode] = { totalDebit: BigInt(0), totalCredit: BigInt(0) };
      }
      accountTotals[line.accountCode].totalDebit += BigInt(toPaise(line.debit));
      accountTotals[line.accountCode].totalCredit += BigInt(toPaise(line.credit));
    });
  });

  const rows: TrialBalanceRow[] = Object.keys(accountTotals)
    .sort()
    .map((code) => {
      const def = CHART_OF_ACCOUNTS[code] || {
        code,
        name: "Unknown Account",
        type: "EXPENSE" as AccountType,
        normalBalance: "DEBIT" as const,
        description: "",
      };

      if (!Number.isSafeInteger(Number(accountTotals[code].totalDebit)) || !Number.isSafeInteger(Number(accountTotals[code].totalCredit))) throw new Error("Trial balance exceeds the supported money range.");
      const debit = Number(accountTotals[code].totalDebit) / 100;
      const credit = Number(accountTotals[code].totalCredit) / 100;

      // Net balance according to normal balance convention
      const net =
        def.normalBalance === "DEBIT"
          ? money((debit - credit))
          : money((credit - debit));

      return {
        accountCode: code,
        accountName: def.name,
        type: def.type,
        normalBalance: def.normalBalance,
        totalDebit: debit,
        totalCredit: credit,
        netBalance: net,
      };
    })
    .filter((row) => row.totalDebit !== 0 || row.totalCredit !== 0);

  const grandTotalDebit = sumMoney(rows.map(row => row.totalDebit));
  const grandTotalCredit = sumMoney(rows.map(row => row.totalCredit));
  const discrepancy = Math.abs(money((grandTotalDebit - grandTotalCredit)));

  return {
    isComplete: entries.every(entry => !entry.isProvisional && !entry.issues?.length),
    provisionalEntries: entries.filter(entry => entry.isProvisional || entry.issues?.length).length,
    issues: Array.from(new Set(entries.flatMap(entry => entry.issues || []))),
    asOf: new Date().toISOString(),
    rows,
    totalDebits: grandTotalDebit,
    totalCredits: grandTotalCredit,
    isBalanced: discrepancy === 0,
    discrepancy,
  };
}
