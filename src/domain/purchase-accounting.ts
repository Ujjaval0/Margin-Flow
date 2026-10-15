import { PurchaseBill } from "./types";
import { money } from "./order-financials";

/** Allocate against remaining balances, oldest invoices first, without reordering the UI. */
export function allocateSupplierPayment(bills: PurchaseBill[], supplierId: string, amount: number): PurchaseBill[] {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment must be a positive amount.");
  const updates = new Map<string, PurchaseBill>();
  let remaining = money(amount);
  for (const bill of bills.filter(bill => bill.supplierId === supplierId && bill.paymentStatus !== "PAID")
    .slice().sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id.localeCompare(b.id))) {
    if (remaining <= 0) break;
    if (bill.paymentStatus === "PARTIAL" && bill.paidAmount === undefined) throw new Error("The previous partial payment amount must be reconciled first.");
    const paid = bill.paidAmount ?? 0;
    const applied = Math.min(remaining, Math.max(0, money(bill.totalAmount - paid)));
    const paidAmount = money(paid + applied);
    remaining = money(remaining - applied);
    updates.set(bill.id, { ...bill, paidAmount, paymentStatus: paidAmount >= bill.totalAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING" });
  }
  return bills.map(bill => updates.get(bill.id) || bill);
}
