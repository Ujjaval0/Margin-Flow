import { orderSchema } from "@/domain/snapshot-validation";
import type { Order } from "@/domain/types";
import { upsertOrders } from "@/lib/integrations/order-persistence";
import { PermanentJobError, registerJobProcessor } from "./queue-manager";
import { readCanonicalLedger } from '@/lib/canonical-ledger';
import { calculatePeriodProfitability } from '@/domain/financial-period';

function reportDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

registerJobProcessor("BULK_CSV_IMPORT", async ({ job, client, updateProgress }) => {
  const payload = job.payload as { orders?: unknown };
  if (!Array.isArray(payload?.orders) || payload.orders.length < 1 || payload.orders.length > 1000) {
    throw new PermanentJobError("Import jobs require between 1 and 1,000 validated orders.");
  }
  const orders: Order[] = [];
  for (const candidate of payload.orders) {
    const parsed = orderSchema.safeParse(candidate);
    if (!parsed.success) throw new PermanentJobError("Import job contains an invalid order.");
    orders.push(parsed.data as Order);
  }
  await updateProgress(10);
  const result = await upsertOrders(job.ownerId!, orders, client);
  await updateProgress(90);
  return {
    success: true,
    inserted: result.inserted,
    updated: result.updated,
    orderIds: result.orderIds,
  };
});

registerJobProcessor("GENERATE_FINANCIAL_REPORT", async ({ job, client, updateProgress }) => {
  const payload = job.payload as { startDate?: unknown; endDate?: unknown };
  if (!reportDate(payload?.startDate) || !reportDate(payload?.endDate) || payload.startDate > payload.endDate) {
    throw new PermanentJobError("Report jobs require a valid startDate and endDate.");
  }
  const start = Date.parse(`${payload.startDate}T00:00:00Z`);
  const end = Date.parse(`${payload.endDate}T00:00:00Z`);
  if (end - start > 366 * 24 * 60 * 60 * 1000) throw new PermanentJobError("Report range cannot exceed 367 calendar days.");
  await updateProgress(10);
  const data=await readCanonicalLedger(client,job.ownerId!);
  const byMarketplace=Array.from(new Set([...data.orders.map(o=>o.marketplace),...data.settlements.map(s=>s.marketplace)])).sort().map(marketplace=>({marketplace,
    ...calculatePeriodProfitability({orders:data.orders.filter(o=>o.marketplace===marketplace),returns:data.returns.filter(r=>r.marketplace===marketplace),settlements:data.settlements.filter(s=>s.marketplace===marketplace),claims:data.claims.filter(c=>c.marketplace===marketplace),expenses:data.expenses.filter(e=>e.marketplace===marketplace)},
      {startDate:payload.startDate as string,endDate:payload.endDate as string})}));
  await updateProgress(90);
  return { startDate: payload.startDate, endDate: payload.endDate, byMarketplace };
});
