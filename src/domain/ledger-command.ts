import { documentArithmetic } from "./document-arithmetic";
import { claimRecoveryEvents } from "./claim-recovery";
import type { LedgerData } from './snapshot-validation';
import { ledgerDataSchema } from './snapshot-validation';
import { createSupplierPayment } from './purchase-accounting';
import { isDamagedReturn, sumMoney, toPaise } from './order-financials';
import type { Order, ReturnRecord } from './types';

export type OperatingCollection = 'suppliers'|'purchases'|'expenses'|'returns'|'claims'|'aiDocuments'|'complaints';
export type LedgerCommand =
  | { action:'save'; collection:OperatingCollection; record:any; expected?:any }
  | { action:'deleteSupplier'; id:string }
  | { action:'deleteComplaint'; id:string }
  | { action:'paySupplier'; id:string; supplierId:string; date:string; amount:number; paymentMethod:string; reference:string; notes?:string }
  | { action:'restock'; id:string; date?:string }
  | { action:'productCost'; sku:string; cost:number; date:string; reason:string }
  | { action:'orderStatus'; ids:string[]; status:Order['status']; date:string }
  | { action:'approveDocument'; id:string }
  | { action:'importSnapshot'; snapshot:string }; 
export const canonicalJson = (value:unknown):string => JSON.stringify(value, (_key,item) => item && typeof item==='object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
export function returnStock(record:ReturnRecord):number {
  return record.condition==='SELLABLE' && !isDamagedReturn(record) && record.restockStatus==='RESTOCKED' ? record.quantity : 0;
}
export function dispatched(order:Order):boolean {
  return order.physicalDispatchRecorded === true || ['SHIPPED','DELIVERED','PARTIALLY_RETURNED','CUSTOMER_RETURN','DAMAGED_RETURN','RETURNED','RTO','CLAIM_PENDING','CLAIM_APPROVED'].includes(order.status);
}
/** Server applies a command to authenticated, current books, never an arbitrary client snapshot. */
export function applyLedgerCommand(data:LedgerData, command:LedgerCommand):LedgerData {
  const next=structuredClone(data);
  const changeStock=(sku:string,delta:number)=>{
    if (!delta) return;
    const product=next.products.find(product=>product.sku===sku);
    if (!product || !Number.isSafeInteger(delta) || (product.stockQuantity||0)+delta<0) throw Error('Inventory movement cannot be reconciled to catalog stock.');
    product.stockQuantity=(product.stockQuantity||0)+delta;
  };
  if(command.action==='save') {
    const schema=ledgerDataSchema.shape[command.collection].element;
    const parsed=schema.safeParse(command.record);
    if(!parsed.success) throw Error('Invalid financial record.');
    const record:any=parsed.data;
    const rows:any[]=next[command.collection];
    const old=rows.find(row=>row.id===record.id);
    if(old && canonicalJson(old)===canonicalJson(record))return next;
    if(command.expected!==undefined && canonicalJson(old)!==canonicalJson(command.expected)) throw Error('Record changed. Reload before saving.');
    if(old && command.expected===undefined) {
      if(canonicalJson(old)===canonicalJson(record)) return next;
      throw Error('Record already exists. Reload before editing.');
    }
    if(command.collection==='suppliers' && old) record.totalPaid=old.totalPaid;
    if(command.collection==='complaints' && record.orderId) {
      const parents=next.orders.filter(order=>[order.id,order.channelOrderId].includes(record.orderId)
        && (!record.marketplace || record.marketplace===order.marketplace));
      if(parents.length!==1) throw Error('An unambiguous owned complaint order is required.');
      record.orderId=parents[0].id;
    }
    if(command.collection==='purchases') {
      if(old) throw Error('Posted purchase corrections require an evidenced reversal; bills cannot be overwritten.');
      if(!next.suppliers.some(s=>s.id===record.supplierId)) throw Error('Supplier not found.');
      if(toPaise(sumMoney([record.lineSubtotal??record.quantity*record.unitCost,record.taxes]))!==toPaise(record.totalAmount)) throw Error('Purchase totals do not reconcile.');
      if(record.paymentStatus==='PARTIAL' && record.paidAmount===undefined) throw Error('Partial payment amount is required.');
      record.paidAmount=record.paidAmount ?? (record.paymentStatus==='PAID'?record.totalAmount:0);
      if(record.totalAmount===0)record.paymentStatus='PAID';
      if(record.paymentStatus!==(record.paidAmount===record.totalAmount?'PAID':record.paidAmount===0?'PENDING':'PARTIAL'))throw Error('Payment status does not match the evidenced allocation.');
      if(record.paidAmount>0 && !record.paymentDate) throw Error('An evidenced supplier payment date is required.');
      changeStock(record.sku,record.quantity);
    }
    if(command.collection==='claims' || command.collection==='returns') {
      const parents=next.orders.filter(order=>order.marketplace===record.marketplace && [order.id,order.channelOrderId].includes(record.orderId));
      if(parents.length!==1) throw Error('An unambiguous owned parent order is required.');
      const parent=parents[0]; record.orderId=parent.id;
      if(command.collection==='claims') {
        if(record.amountRecovered>record.amountClaimed) throw Error('Recovery exceeds claim amount.');
        if(record.amountRecovered>0 && !claimRecoveryEvents(record).length) throw Error('Recovery date is required.');
        if(old && (record.amountRecovered<old.amountRecovered || claimRecoveryEvents(old).some(event=>!claimRecoveryEvents(record).some(next=>canonicalJson(next)===canonicalJson(event)))))throw Error('Recovery history is immutable; use an evidenced correction.');
        if(record.returnId && !next.returns.some(r=>r.id===record.returnId && r.marketplace===record.marketplace && [parent.id,parent.channelOrderId].includes(r.orderId))) throw Error('Claim return does not belong to this order.');
        // Claims never change fulfillment or physical-return state.
      } else {
        if(old && (old.orderId!==record.orderId || old.marketplace!==record.marketplace))throw Error('Posted returns cannot be reassigned to another order.');
        if(!dispatched(parent)) throw Error('A return requires a dispatched order.');
        const same=next.returns.filter(r=>r.id!==record.id && r.marketplace===record.marketplace && [parent.id,parent.channelOrderId].includes(r.orderId) && r.sku===record.sku);
        const ordered=parent.items.filter(i=>i.sku===record.sku).reduce((sum,i)=>sum+i.quantity,0);
        if(same.reduce((sum,r)=>sum+r.quantity,0)+record.quantity>ordered) throw Error('Returned quantity exceeds dispatched units.');
        record.restockStatus=record.restockStatus || (record.condition==='SELLABLE' && !isDamagedReturn(record)?'PENDING_RESTOCK':'WRITTEN_OFF');
        if(record.restockStatus==='RESTOCKED' && !record.receivedDate)throw Error('Physical receipt date is required to restock.');
        if(record.receivedDate && record.receivedDate<record.returnDate)throw Error('Receipt date cannot precede the return.');
        if(record.orderItemId && !parent.items.some(line=>line.id===record.orderItemId && line.sku===record.sku))throw Error('Return line does not belong to this order.');
        if(isDamagedReturn(record) && record.restockStatus==='RESTOCKED') throw Error('Damaged/used goods cannot enter sellable stock.');
        if(old) changeStock(old.sku,-returnStock(old));
        changeStock(record.sku,returnStock(record));
      }
    }
    if(command.collection==='aiDocuments')record.arithmeticValidation=documentArithmetic(record);
    if(command.collection==='aiDocuments' && record.status==='APPROVED_POSTED')throw Error('Use verified document approval to create postings.');
    if(command.collection==='aiDocuments' && old?.status==='APPROVED_POSTED' && canonicalJson(old)!==canonicalJson(record)) throw Error('Posted document cannot be edited.');
    (next[command.collection] as any[])=[...rows.filter(row=>row.id!==record.id),record];
    if(command.collection==='returns') {
      const parent=next.orders.find(order=>order.id===record.orderId && order.marketplace===record.marketplace)!;
      const linked=next.returns.filter(r=>r.marketplace===parent.marketplace && [parent.id,parent.channelOrderId].includes(r.orderId));
      const used=new Map<string,number>();
      for(const line of parent.items) {
        const count=linked.filter(r=>r.sku===line.sku).reduce((sum,r)=>sum+r.quantity,0)-(used.get(line.sku)||0);
        line.returnedQuantity=Math.max(0,Math.min(line.quantity,count)); used.set(line.sku,(used.get(line.sku)||0)+line.returnedQuantity);
      }
      const units=parent.items.reduce((sum,i)=>sum+i.quantity,0),returned=parent.items.reduce((sum,i)=>sum+i.returnedQuantity,0);
      parent.status=returned<units?'PARTIALLY_RETURNED':linked.every(r=>r.returnType==='RTO')?'RTO':linked.some(isDamagedReturn)?'DAMAGED_RETURN':'CUSTOMER_RETURN';
      parent.returnIds=linked.map(r=>r.id);
    }
  } else if(command.action==='restock') {
    const record=next.returns.find(r=>r.id===command.id);
    if(!record) throw Error('Return not found.');
    if(record.restockStatus==='RESTOCKED') return next;
    if(record.restockStatus!=='PENDING_RESTOCK' || record.condition!=='SELLABLE' || isDamagedReturn(record)) throw Error('Only inspected sellable pending returns can be restocked.');
    const receiptDate=command.date||record.receivedDate;
    if(!receiptDate || receiptDate<record.returnDate)throw Error('An evidenced physical receipt date is required.');
    changeStock(record.sku,record.quantity); record.restockStatus='RESTOCKED';record.receivedDate=receiptDate;
  } else if(command.action==='deleteComplaint') {
    if(!next.complaints.some(row=>row.id===command.id))throw Error('Complaint not found.');
    next.complaints=next.complaints.filter(row=>row.id!==command.id);
  } else if(command.action==='deleteSupplier') {
    if(next.purchases.some(p=>p.supplierId===command.id) || next.supplierPayments?.some(p=>p.supplierId===command.id) || next.products.some(p=>p.supplierId===command.id)) throw Error('Supplier has linked financial or catalog records.');
    next.suppliers=next.suppliers.filter(s=>s.id!==command.id);
  } else if(command.action==='paySupplier') {
    if(!next.suppliers.some(s=>s.id===command.supplierId)) throw Error('Supplier not found.');
    const result=createSupplierPayment(next.purchases,command);
    next.purchases=result.bills;next.supplierPayments=[...(next.supplierPayments||[]),result.payment];
  } else if(command.action==='productCost') {
    if(!Number.isFinite(command.cost) || command.cost<0 || !Number.isFinite(Date.parse(command.date))) throw Error('Invalid cost evidence.');
    const product=next.products.find(p=>p.sku===command.sku);
    if(!product) throw Error('Product not found.');
    if(product.costHistory.some(h=>h.validFrom>command.date))throw Error('Backdated cost changes require an evidenced historical-window correction.');
    const previous=new Date(command.date+'T00:00:00Z'); previous.setUTCDate(previous.getUTCDate()-1);
    product.costHistory=product.costHistory.filter(h=>h.validFrom!==command.date).map(h=>!h.validTo && h.validFrom<command.date?{...h,validTo:previous.toISOString().slice(0,10)}:h);
    product.costHistory.push({validFrom:command.date,costPrice:command.cost,notes:command.reason});
    product.currentCostPrice=command.cost;
  } else if(command.action==='orderStatus') {
    if(command.ids.some(id=>!next.orders.some(order=>order.id===id)))throw Error('One or more selected orders no longer exist.');
    for(const order of next.orders.filter(o=>command.ids.includes(o.id))) {
      if(order.status===command.status) continue;
      const was=dispatched(order); const after={...order,status:command.status}; const now=dispatched(after);
      if(was && command.status==='CANCELLED') throw Error('A dispatched order requires evidenced refund/return movements before cancellation.');
      if(!was && now) { for(const line of order.items) changeStock(line.sku,-line.quantity); order.physicalDispatchRecorded=true; }
      order.status=command.status;
      if(command.status==='DELIVERED' && !order.revenueRecognisedDate) order.revenueRecognisedDate=command.date;
    }
  }
  return next;
}
