import type { PoolClient } from 'pg';
import { parseLedgerSnapshot } from '@/domain/snapshot-validation';
import { toPaise } from '@/domain/money';
import { readCanonicalLedger } from './canonical-ledger';
import { persistCatalog } from './catalog-persistence';
import { upsertOrders,upsertSettlements } from './integrations/order-persistence';
import { appendFinancialAudit,persistLedgerDelta } from './ledger-records';
import { emptyLedger } from '@/domain/recycle-bin';

/** Recovery imports are explicit opening books, never a replay over current postings. */
export async function importOpeningSnapshot(client:PoolClient,owner:string,raw:string) {
  const data=parseLedgerSnapshot(raw,owner);if(!data)throw Error('Invalid snapshot or different account owner.');
  if(data.supplierPayments?.some(p=>p.allocationStatus==='UNRESOLVED'))throw Error('Reconcile historical supplier payment allocations before opening recovery.');
  const current=await readCanonicalLedger(client,owner);
  if(['products','orders','returns','claims','purchases','supplierPayments','expenses','settlements','suppliers','aiDocuments'].some(key=>((current as any)[key]||[]).length))throw Error('Snapshot recovery requires empty server books. Current books were preserved; reconcile local-only records before merging.');
  const supplierIds=new Set(data.suppliers.map(s=>s.id)),skus=new Set(data.products.map(p=>p.sku));
  const parent=(r:{orderId:string;marketplace:string})=>data.orders.filter(o=>o.marketplace===r.marketplace && [o.id,o.channelOrderId].includes(r.orderId));
  if(data.purchases.some(p=>!supplierIds.has(p.supplierId)||!skus.has(p.sku)||toPaise(p.totalAmount)!==toPaise((p.lineSubtotal??p.quantity*p.unitCost)+p.taxes)) || data.products.some(p=>p.supplierId&&!supplierIds.has(p.supplierId)))throw Error('Snapshot purchase/catalog references or totals do not reconcile.');
  if([...data.returns,...data.claims,...data.settlements].some(r=>parent(r).length!==1))throw Error('Snapshot parent references are missing or ambiguous.');
  for(const r of [...data.returns,...data.claims,...data.settlements])r.orderId=parent(r)[0].id;
  for(const order of data.orders)for(const sku of new Set(order.items.map(i=>i.sku))) {
    const units=order.items.filter(i=>i.sku===sku).reduce((sum,i)=>sum+i.quantity,0);
    if(data.returns.filter(r=>r.orderId===order.id&&r.sku===sku).reduce((sum,r)=>sum+r.quantity,0)>units)throw Error('Snapshot returned units exceed ordered units.');
  }
  for(const c of data.claims)if(c.amountRecovered>c.amountClaimed || c.returnId&&!data.returns.some(r=>r.id===c.returnId&&r.orderId===c.orderId&&r.marketplace===c.marketplace))throw Error('Snapshot claim references or amounts do not reconcile.');
  for(const payment of data.supplierPayments||[])if(!supplierIds.has(payment.supplierId)||payment.allocations.some(a=>!data.purchases.some(p=>p.id===a.purchaseId&&p.supplierId===payment.supplierId)))throw Error('Snapshot payment allocation does not belong to its supplier.');
  // Keep exact opening stock and original dated evidence; do not reapply old stock movements.
  const opening=emptyLedger();opening.suppliers=data.suppliers;
  await persistLedgerDelta(client,owner,emptyLedger(),opening);
  if(data.products.length)await persistCatalog(client,owner,data.products);
  if(data.orders.length)await upsertOrders(owner,data.orders.map(o=>({...o,physicalDispatchRecorded:false})),client);
  for(const order of data.orders)await client.query('UPDATE orders SET record_data=record_data || $3::jsonb WHERE user_id=$1 AND display_id=$2',[owner,order.id,JSON.stringify(order)]);
  const before=await readCanonicalLedger(client,owner),after=structuredClone(data);
  // Paid-to-date includes these payment allocations. Count the opening residual only once.
  for(const bill of after.purchases) {
    const allocated=(data.supplierPayments||[]).flatMap(p=>p.allocations).filter(a=>a.purchaseId===bill.id).reduce((sum,a)=>sum+toPaise(a.amount),0);
    const paid=bill.paidAmount??(bill.paymentStatus==='PAID'?bill.totalAmount:bill.paymentStatus==='PENDING'?0:undefined);
    if(paid===undefined || allocated>toPaise(paid))throw Error('Historical partial payment allocations need reconciliation.');
    bill.paidAmount=(toPaise(paid)-allocated)/100;
  }
  await persistLedgerDelta(client,owner,before,after);
  for(const bill of data.purchases)await client.query('UPDATE purchase_bills SET paid_amount=$3,payment_status=$4,record_data=$5::jsonb WHERE user_id=$1 AND display_id=$2',[owner,bill.id,bill.paidAmount??(bill.paymentStatus==='PAID'?bill.totalAmount:0),bill.paymentStatus,JSON.stringify(bill)]);
  if(data.settlements.length)await upsertSettlements(owner,[...data.settlements].sort((a,b)=>Number(a.evidenceType!=='FINANCIAL_EVENT')-Number(b.evidenceType!=='FINANCIAL_EVENT')),client);
  await appendFinancialAudit(client,owner,'DOCUMENT','SNAPSHOT',null,{counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Array.isArray(v)?v.length:0])),sourceAuditLogs:data.auditLogs},'Explicit tenant-owned opening snapshot recovery; source evidence retained, authenticity unverified');
  return readCanonicalLedger(client,owner);
}
