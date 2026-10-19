import { PurchaseBill } from "./types";
import { money, sumMoney } from "./order-financials";

/** Allocate against remaining balances, oldest invoices first, without reordering the UI. */
export function allocateSupplierPayment(bills: PurchaseBill[], supplierId: string, amount: number): PurchaseBill[] {
  if (!Number.isFinite(amount) || money(amount) <= 0) throw new Error("Payment must be a positive amount.");
  const updates = new Map<string, PurchaseBill>();
  let remaining = money(amount);
  for (const bill of bills.filter(bill => bill.supplierId === supplierId && bill.paymentStatus !== "PAID")
    .slice().sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id.localeCompare(b.id))) {
    if (remaining <= 0) break;
    if (bill.paymentStatus === "PARTIAL" && bill.paidAmount === undefined) throw new Error("The previous partial payment amount must be reconciled first.");
    const paid = bill.paidAmount ?? (bill.paymentStatus === "PAID" ? bill.totalAmount : 0);
    const applied = Math.min(remaining, Math.max(0, sumMoney([bill.totalAmount, -paid])));
    const paidAmount = sumMoney([paid, applied]);
    remaining = sumMoney([remaining, -applied]);
    updates.set(bill.id, { ...bill, paidAmount, paymentStatus: paidAmount >= bill.totalAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING" });
  }
  return bills.map(bill => updates.get(bill.id) || bill);
}

/** Retain the entire payment, including any amount beyond open invoices. */
export function createSupplierPayment(bills: PurchaseBill[], input: Omit<import("./types").SupplierPayment, "allocations" | "advanceAmount">) {
  const updatedBills = allocateSupplierPayment(bills, input.supplierId, input.amount);
  const allocations = updatedBills.flatMap((bill, index) => {
    const previous = bills[index].paidAmount ?? (bills[index].paymentStatus === "PAID" ? bills[index].totalAmount : 0);
    const amount = sumMoney([bill.paidAmount ?? previous, -previous]);
    return amount > 0 ? [{ purchaseId: bill.id, amount }] : [];
  });
  return { bills: updatedBills, payment: { ...input, amount: money(input.amount), allocations,
    advanceAmount: sumMoney([money(input.amount), -sumMoney(allocations.map(allocation => allocation.amount))]) } };
}
