import { Order, ReturnRecord, Settlement, Claim, Expense } from "./types";

export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function scopeReport(dataset: { orders: Order[]; returns: ReturnRecord[]; settlements: Settlement[]; claims: Claim[]; expenses: Expense[] }, channel: string) {
  const marketplace = channel === "Amazon" ? "Amazon India" : channel === "Website" ? "Personal Website" : channel;
  const matches = (record: { marketplace?: string }) => channel === "All Channels" || record.marketplace === marketplace;
  return {
    orders: dataset.orders.filter(matches), returns: dataset.returns.filter(matches),
    settlements: dataset.settlements.filter(matches), claims: dataset.claims.filter(matches), expenses: dataset.expenses.filter(matches),
  };
}
