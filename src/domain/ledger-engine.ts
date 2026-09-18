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
    name: "Statutory Withholdings (TCS/TDS)",
    type: "LIABILITY",
    normalBalance: "CREDIT",
    description: "Tax collected at source by e-commerce operators under Section 52 CGST.",
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
  id: string;
  timestamp: string;
  referenceType:
    | "ORDER_FULFILLMENT"
    | "SETTLEMENT_REMITTANCE"
    | "CUSTOMER_RETURN"
    | "PURCHASE_BILL"
    | "OPERATING_EXPENSE";
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
  asOf: string;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  discrepancy: number;
}

/**
 * Validate that sum of debits equals sum of credits within standard 2-decimal precision.
 */
export function validateJournalBalance(lines: JournalPostingLine[]): {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  const totalDebit = lines.reduce((acc, l) => acc + (l.debit || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (l.credit || 0), 0);
  const diff = Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
  return {
    isBalanced: diff <= 0.01,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    difference: diff,
  };
}

/**
 * Generate a complete statutory Double-Entry General Ledger from platform operational datasets.
 */
export function generateGeneralLedger(
  orders: Order[],
  returns: ReturnRecord[],
  settlements: Settlement[],
  purchases: PurchaseBill[],
  expenses: Expense[]
): JournalEntry[] {
  const entries: JournalEntry[] = [];

  // 1. Order Fulfillments
  orders.forEach((order) => {
    const grossSales = Math.round(
      order.items.reduce((sum, it) => sum + it.sellingPrice * it.quantity, 0) * 100
    ) / 100;
    const cogs = Math.round(
      order.items.reduce((sum, it) => sum + it.snapshotUnitCost * it.quantity, 0) * 100
    ) / 100;
    const totalFees = Math.round((order.marketplaceChargesEstimate || 0) * 100) / 100;
    const commFee = Math.round(totalFees * 0.65 * 100) / 100;
    const shippingFee = Math.round((totalFees - commFee) * 100) / 100;
    const netReceivable = Math.round((grossSales - totalFees) * 100) / 100;

    const skuSummary = order.items.map((it) => `${it.sku} (x${it.quantity})`).join(", ");

    const lines: JournalPostingLine[] = [
      {
        accountCode: "1020",
        accountName: CHART_OF_ACCOUNTS["1020"].name,
        debit: netReceivable,
        credit: 0,
        memo: `Net receivable due from ${order.marketplace}`,
      },
      {
        accountCode: "6010",
        accountName: CHART_OF_ACCOUNTS["6010"].name,
        debit: commFee,
        credit: 0,
        memo: "Marketplace referral & platform commissions",
      },
      {
        accountCode: "6020",
        accountName: CHART_OF_ACCOUNTS["6020"].name,
        debit: shippingFee,
        credit: 0,
        memo: "Forward fulfillment & delivery logistics",
      },
      {
        accountCode: "4010",
        accountName: CHART_OF_ACCOUNTS["4010"].name,
        debit: 0,
        credit: grossSales,
        memo: `Customer GMV for ${skuSummary}`,
      },
    ];

    // Inventory reduction leg
    if (cogs > 0) {
      lines.push(
        {
          accountCode: "5010",
          accountName: CHART_OF_ACCOUNTS["5010"].name,
          debit: cogs,
          credit: 0,
          memo: `Cost of goods sold for ${skuSummary}`,
        },
        {
          accountCode: "1030",
          accountName: CHART_OF_ACCOUNTS["1030"].name,
          debit: 0,
          credit: cogs,
          memo: `Inventory stock reduction for ${skuSummary}`,
        }
      );
    }

    const validation = validateJournalBalance(lines);

    entries.push({
      id: `JE-ORD-${order.id}`,
      timestamp: `${order.orderDate}T10:00:00.000Z`,
      referenceType: "ORDER_FULFILLMENT",
      referenceId: order.id,
      description: `Dispatched order ${order.channelOrderId || order.id} on ${order.marketplace}`,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  // 2. Marketplace Settlements Remitted
  settlements.forEach((settlement) => {
    const netCash = Math.round(settlement.netSettlement * 100) / 100;
    const tcsTds = Math.round((settlement.tcsTdsTax || 0) * 100) / 100;
    const grossCredit = Math.round((netCash + tcsTds) * 100) / 100;

    const lines: JournalPostingLine[] = [
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: netCash,
        credit: 0,
        memo: `Disbursement received into bank account (${settlement.marketplace})`,
      },
    ];

    if (tcsTds > 0) {
      lines.push({
        accountCode: "2030",
        accountName: CHART_OF_ACCOUNTS["2030"].name,
        debit: tcsTds,
        credit: 0,
        memo: "Statutory TCS & TDS withheld by platform operator",
      });
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
      description: `Bank disbursement remitted by ${settlement.marketplace}`,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  // 3. Customer Returns & Write-Offs
  returns.forEach((ret) => {
    const lines: JournalPostingLine[] = [];
    const returnShipping = Math.round((ret.returnShippingCost || 0) * 100) / 100;

    if (ret.restockStatus === "RESTOCKED" || ret.condition === "SELLABLE") {
      // Re-enter inventory, credit COGS
      const unitCost = Math.round((ret.lossAmount > 0 ? ret.lossAmount : 0) * 100) / 100;
      if (unitCost > 0) {
        lines.push(
          {
            accountCode: "1030",
            accountName: CHART_OF_ACCOUNTS["1030"].name,
            debit: unitCost,
            credit: 0,
            memo: `Restocked undamaged units (${ret.sku})`,
          },
          {
            accountCode: "5010",
            accountName: CHART_OF_ACCOUNTS["5010"].name,
            debit: 0,
            credit: unitCost,
            memo: "Reversal of COGS for restocked return",
          }
        );
      }
    } else {
      // Damaged/Liquidated write-off
      const damageLoss = Math.round((ret.lossAmount || 0) * 100) / 100;
      if (damageLoss > 0) {
        lines.push(
          {
            accountCode: "5020",
            accountName: CHART_OF_ACCOUNTS["5020"].name,
            debit: damageLoss,
            credit: 0,
            memo: `Inventory damage write-off (${ret.returnReason})`,
          },
          {
            accountCode: "1030",
            accountName: CHART_OF_ACCOUNTS["1030"].name,
            debit: 0,
            credit: damageLoss,
            memo: "De-recognition of scrapped inventory",
          }
        );
      }
    }

    // Reverse shipping logistics fee
    if (returnShipping > 0) {
      lines.push(
        {
          accountCode: "6020",
          accountName: CHART_OF_ACCOUNTS["6020"].name,
          debit: returnShipping,
          credit: 0,
          memo: "Reverse courier transit charges",
        },
        {
          accountCode: "1020",
          accountName: CHART_OF_ACCOUNTS["1020"].name,
          debit: 0,
          credit: returnShipping,
          memo: "Marketplace deduction for reverse shipping",
        }
      );
    }

    if (lines.length > 0) {
      const validation = validateJournalBalance(lines);
      entries.push({
        id: `JE-RET-${ret.id}`,
        timestamp: `${ret.returnDate}T14:00:00.000Z`,
        referenceType: "CUSTOMER_RETURN",
        referenceId: ret.id,
        description: `Customer Return #${ret.id} (${ret.restockStatus || ret.condition})`,
        lines,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        isBalanced: validation.isBalanced,
      });
    }
  });

  // 4. Purchase Bills (Wholesale Inventory Intake)
  purchases.forEach((purch) => {
    const subtotal = Math.round(purch.quantity * purch.unitCost * 100) / 100;
    const tax = Math.round((purch.taxes || 0) * 100) / 100;
    const totalPayable = Math.round(purch.totalAmount * 100) / 100;

    const lines: JournalPostingLine[] = [
      {
        accountCode: "1030",
        accountName: CHART_OF_ACCOUNTS["1030"].name,
        debit: subtotal,
        credit: 0,
        memo: `Wholesale inventory intake from ${purch.supplierName}`,
      },
    ];

    if (tax > 0) {
      lines.push({
        accountCode: "1040",
        accountName: CHART_OF_ACCOUNTS["1040"].name,
        debit: tax,
        credit: 0,
        memo: "Input GST credit on supplier invoice",
      });
    }

    lines.push({
      accountCode: "2010",
      accountName: CHART_OF_ACCOUNTS["2010"].name,
      debit: 0,
      credit: totalPayable,
      memo: `Payable liability to ${purch.supplierName} (Bill: ${purch.invoiceNumber})`,
    });

    const validation = validateJournalBalance(lines);

    entries.push({
      id: `JE-PUR-${purch.id}`,
      timestamp: `${purch.invoiceDate}T11:00:00.000Z`,
      referenceType: "PURCHASE_BILL",
      referenceId: purch.id,
      description: `Wholesale purchase from ${purch.supplierName} (Bill ${purch.invoiceNumber})`,
      lines,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      isBalanced: validation.isBalanced,
    });
  });

  // 5. Operating Expenses
  expenses.forEach((exp) => {
    const amount = Math.round(exp.amount * 100) / 100;
    const lines: JournalPostingLine[] = [
      {
        accountCode: "6030",
        accountName: CHART_OF_ACCOUNTS["6030"].name,
        debit: amount,
        credit: 0,
        memo: `${exp.category}: ${exp.description}`,
      },
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
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

  // Sort chronologically descending
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Calculate Trial Balance across all accounts from posted journal entries.
 */
export function calculateTrialBalance(entries: JournalEntry[]): TrialBalance {
  const accountTotals: Record<string, { totalDebit: number; totalCredit: number }> = {};

  // Initialize all accounts with zero
  Object.keys(CHART_OF_ACCOUNTS).forEach((code) => {
    accountTotals[code] = { totalDebit: 0, totalCredit: 0 };
  });

  // Sum postings
  entries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (!accountTotals[line.accountCode]) {
        accountTotals[line.accountCode] = { totalDebit: 0, totalCredit: 0 };
      }
      accountTotals[line.accountCode].totalDebit += line.debit || 0;
      accountTotals[line.accountCode].totalCredit += line.credit || 0;
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

      const debit = Math.round(accountTotals[code].totalDebit * 100) / 100;
      const credit = Math.round(accountTotals[code].totalCredit * 100) / 100;

      // Net balance according to normal balance convention
      const net =
        def.normalBalance === "DEBIT"
          ? Math.round((debit - credit) * 100) / 100
          : Math.round((credit - debit) * 100) / 100;

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
    .filter((row) => row.totalDebit > 0 || row.totalCredit > 0);

  const grandTotalDebit = Math.round(rows.reduce((sum, r) => sum + r.totalDebit, 0) * 100) / 100;
  const grandTotalCredit = Math.round(rows.reduce((sum, r) => sum + r.totalCredit, 0) * 100) / 100;
  const discrepancy = Math.abs(Math.round((grandTotalDebit - grandTotalCredit) * 100) / 100);

  return {
    asOf: new Date().toISOString(),
    rows,
    totalDebits: grandTotalDebit,
    totalCredits: grandTotalCredit,
    isBalanced: discrepancy <= 0.01,
    discrepancy,
  };
}
