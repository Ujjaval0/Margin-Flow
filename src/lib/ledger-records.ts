import { documentArithmetic } from "@/domain/document-arithmetic";
import { importOpeningSnapshot } from './ledger-import';
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { LedgerData } from '@/domain/snapshot-validation';
import { canonicalJson, applyLedgerCommand, type LedgerCommand } from '@/domain/ledger-command';
import { readCanonicalLedger } from './canonical-ledger';
import { upsertOrders } from './integrations/order-persistence';
import { ledgerDataSchema } from '@/domain/snapshot-validation';
import { sumMoney,toPaise,money } from '@/domain/money';

const tables={suppliers:'suppliers',purchases:'purchase_bills',supplierPayments:'supplier_payments',returns:'return_records',claims:'claims',expenses:'expenses',aiDocuments:'ai_staged_documents'} as const;
async function ownedId(client:PoolClient,owner:string,table:string,id:string) {
  const result=await client.query(`SELECT id FROM ${table} WHERE user_id=$1 AND display_id=$2`,[owner,id]);
  if(result.rows.length!==1) throw Error('Linked financial record is missing or ambiguous.');
  return result.rows[0].id;
}
export async function appendFinancialAudit(client:PoolClient,owner:string,type:string,id:string,before:unknown,after:unknown,reason:string) {
  await client.query(`INSERT INTO financial_audit_logs(display_id,user_id,entity_type,entity_id,field_name,old_value,new_value,modified_by,reason)
    VALUES($1,$2,$3,$4,'record',$5,$6,'Authenticated financial command',$7)`,[`AUD-${crypto.randomUUID()}`,owner,type,id,canonicalJson(before)||'null',canonicalJson(after)||'null',reason]);
}
export async function persistLedgerDelta(client:PoolClient,owner:string,before:LedgerData,after:LedgerData) {
  for(const collection of Object.keys(tables) as (keyof typeof tables)[]) {
    const table=tables[collection]; const oldRows:any[]=before[collection]||[],newRows:any[]=after[collection]||[];
    for(const old of oldRows) if(!newRows.some(row=>row.id===old.id)) {
      if(collection!=='suppliers') throw Error('Use archive/reversal to remove financial evidence.');
      await client.query('UPDATE suppliers SET deleted_at=NOW() WHERE user_id=$1 AND display_id=$2',[owner,old.id]);
      await appendFinancialAudit(client,owner,'SUPPLIER',old.id,old,null,'Supplier archived');
    }
    for(const record of newRows) {
      const old=oldRows.find(row=>row.id===record.id);
      if(canonicalJson(old)===canonicalJson(record)) continue;
      let fields:Record<string,any>={};
      if(collection==='suppliers') fields={name:record.name,contact_person:record.contactPerson,email:record.email,phone:record.phone,address:record.address,gstin:record.gstin||null,payment_terms:record.paymentTerms||null,bank_account:record.bankAccount||null,upi_id:record.upiId||null,opening_balance:record.openingBalance||0,notes:record.notes||null};
      if(collection==='purchases') fields={supplier_id:await ownedId(client,owner,'suppliers',record.supplierId),supplier_name:record.supplierName,invoice_number:record.invoiceNumber,invoice_date:record.invoiceDate,sku:record.sku,quantity:record.quantity,unit_cost:record.unitCost,taxes:record.taxes,total_amount:record.totalAmount,payment_status:record.paymentStatus,paid_amount:record.paidAmount??null,document_url:record.documentUrl||null};
      if(collection==='supplierPayments') fields={supplier_id:await ownedId(client,owner,'suppliers',record.supplierId),amount:record.amount,payment_method:record.paymentMethod,reference_code:record.reference,paid_at:record.date,notes:record.notes||null,advance_amount:record.advanceAmount};
      if(collection==='returns') fields={order_id:await ownedId(client,owner,'orders',record.orderId),channel_order_id:record.channelOrderId,marketplace:record.marketplace,return_date:record.returnDate,received_date:record.receivedDate||null,return_type:record.returnType,return_reason:record.returnReason,sku:record.sku,product_name:record.productName||null,quantity:record.quantity,condition:record.condition,restock_status:record.restockStatus||null,claim_deadline:record.claimDeadline||null,return_shipping_cost:record.returnShippingCost,customer_return_fee:record.customerReturnFee,other_return_costs:record.otherReturnCosts,inventory_recovery_value:record.inventoryRecoveryValue,loss_amount:record.lossAmount,notes:record.notes||null,awb_number:record.awbNumber||null};
      if(collection==='claims') fields={order_id:await ownedId(client,owner,'orders',record.orderId),return_id:record.returnId?await ownedId(client,owner,'return_records',record.returnId):null,marketplace:record.marketplace,claim_type:record.claimType,claim_date:record.claimDate,amount_claimed:record.amountClaimed,amount_recovered:record.amountRecovered,status:record.status,recovery_date:record.recoveryDate||null,notes:record.notes||null};
      if(collection==='expenses') fields={expense_date:record.date,category:record.category,description:record.description,amount:record.amount,vendor:record.vendor,payment_method:record.paymentMethod,is_recurring:record.isRecurring,marketplace:record.marketplace||null,attributed_sku:record.attributedSku||null,supporting_document:record.supportingDocument||null,notes:record.notes||null};
      if(collection==='aiDocuments') fields={file_name:record.fileName,file_url:record.fileUrl||null,file_type:record.fileType,upload_date:record.uploadDate,status:record.status,raw_text_preview:record.rawTextPreview,arithmetic_passed:record.arithmeticValidation.passed,arithmetic_calculated:record.arithmeticValidation.calculatedTotal,arithmetic_declared:record.arithmeticValidation.declaredTotal,arithmetic_difference:record.arithmeticValidation.difference,arithmetic_message:record.arithmeticValidation.message,catalog_sku_matched:record.catalogValidation.skuMatched,catalog_matched_sku_id:record.catalogValidation.matchedSkuId||null,catalog_suggestion:record.catalogValidation.suggestion||null};
      fields.record_data=JSON.stringify(record);
      const keys=Object.keys(fields),values=Object.values(fields);
      if(old) {
        if(collection==='supplierPayments') throw Error('Recorded payments are immutable; use an evidenced correction.');
        await client.query(`UPDATE ${table} SET ${keys.map((key,i)=>`${key}=$${i+3}`).join(',')} WHERE user_id=$1 AND display_id=$2`,[owner,record.id,...values]);
      } else {
        const columns=['user_id','display_id',...keys];
        const result=await client.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,[owner,record.id,...values]);
        if(collection==='supplierPayments') for(const allocation of record.allocations) await client.query(`INSERT INTO supplier_payment_allocations(supplier_id,supplier_payment_id,purchase_bill_id,amount) VALUES($1,$2,$3,$4)`,[fields.supplier_id,result.rows[0].id,await ownedId(client,owner,'purchase_bills',allocation.purchaseId),allocation.amount]);
        if(collection==='purchases' && record.paidAmount>0) await client.query('UPDATE suppliers SET total_paid=total_paid+$2 WHERE id=$1',[fields.supplier_id,record.paidAmount]);
      }
      const entity={suppliers:'SUPPLIER',purchases:'PURCHASE',supplierPayments:'SUPPLIER_PAYOUT',returns:'RETURN',claims:'CLAIM',expenses:'EXPENSE',aiDocuments:'DOCUMENT'}[collection];
      await appendFinancialAudit(client,owner,entity,record.id,old,record,'Canonical record mutation');
    }
  }
  for(const claim of after.claims) {
    const old=before.claims.find(c=>c.id===claim.id);if(canonicalJson(old)===canonicalJson(claim))continue;
    const claimId=await ownedId(client,owner,'claims',claim.id);
    for(const document of claim.supportingDocuments||[])await client.query('INSERT INTO claim_documents(claim_id,document_url) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM claim_documents WHERE claim_id=$1 AND document_url=$2)',[claimId,document]);
  }
  for(const r of after.returns) {
    const old=before.returns.find(row=>row.id===r.id);if(canonicalJson(old)===canonicalJson(r))continue;
    await client.query('UPDATE return_records SET claim_id=$3 WHERE user_id=$1 AND display_id=$2',[owner,r.id,r.claimId?await ownedId(client,owner,'claims',r.claimId):null]);
  }
  for(const product of after.products) {
    const old=before.products.find(p=>p.id===product.id); if(!old) continue;
    if(old.stockQuantity!==product.stockQuantity) await client.query('UPDATE products SET stock_quantity=$3 WHERE user_id=$1 AND sku=$2',[owner,product.sku,product.stockQuantity||0]);
    if(canonicalJson(old.costHistory)!==canonicalJson(product.costHistory)) {
      const productId=await ownedId(client,owner,'products',product.id);
      // Reconcile explicit windows, including same-day corrections, before inserting a new active row.
      await client.query('UPDATE product_cost_history SET valid_to=valid_from WHERE product_id=$1 AND valid_to IS NULL',[productId]);
      for(const h of product.costHistory) await client.query(`INSERT INTO product_cost_history(product_id,valid_from,valid_to,cost_price,notes,sku) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(product_id,valid_from) DO UPDATE SET valid_to=EXCLUDED.valid_to,cost_price=EXCLUDED.cost_price,notes=EXCLUDED.notes`,[productId,h.validFrom,h.validTo||null,h.costPrice,h.notes||null,product.sku]);
      await client.query('UPDATE products SET current_cost_price=$3 WHERE user_id=$1 AND sku=$2',[owner,product.sku,product.currentCostPrice]);
    }
    if(canonicalJson(old)!==canonicalJson(product)) await appendFinancialAudit(client,owner,'PRODUCT_COST',product.id,old,product,'Stock/cost movement');
  }
  for(const order of after.orders) {
    const old=before.orders.find(o=>o.id===order.id); if(!old || canonicalJson(old)===canonicalJson(order)) continue;
    await client.query('UPDATE orders SET status=$3,record_data=$4::jsonb WHERE user_id=$1 AND display_id=$2',[owner,order.id,order.status,JSON.stringify(order)]);
    for(const item of order.items) await client.query('UPDATE order_items i SET returned_quantity=$4 FROM orders o WHERE o.id=i.order_id AND o.user_id=$1 AND o.display_id=$2 AND i.display_id=$3',[owner,order.id,item.id,item.returnedQuantity]);
    await appendFinancialAudit(client,owner,'ORDER',order.id,old,order,'Lifecycle movement');
  }
}
export async function executeLedgerCommand(client:PoolClient,owner:string,requestId:string,command:LedgerCommand) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner]);
  const hash=crypto.createHash('sha256').update(canonicalJson(command)).digest('hex');
  const prior=await client.query('SELECT request_hash FROM financial_commands WHERE user_id=$1 AND request_id=$2',[owner,requestId]);
  if(prior.rows.length) {
    if(prior.rows[0].request_hash!==hash) throw Error('Request identity was reused for a different mutation.');
    return readCanonicalLedger(client,owner);
  }
  if(command.action==='importSnapshot') {
    const result=await importOpeningSnapshot(client,owner,command.snapshot);
    await client.query('INSERT INTO financial_commands(user_id,request_id,request_hash) VALUES($1,$2,$3)',[owner,requestId,hash]);return result;
  }
  const before=await readCanonicalLedger(client,owner);
  let after:LedgerData;
  if(command.action==='approveDocument') {
    const doc=before.aiDocuments.find(d=>d.id===command.id);
    if(!doc)throw Error('Document not found.');
    if(doc.status==='APPROVED_POSTED')return before;
    if(doc.status!=='STAGED_NEEDS_REVIEW' || !documentArithmetic(doc).passed)throw Error('Document arithmetic must be verified before posting.');
    if(doc.currency!=='INR')throw Error('Invoice currency must be evidenced as INR.');
    const value=(key:keyof typeof doc.extractedData)=>doc.extractedData[key]?.value;
    const date=String(value('orderDate')||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invoice date is required.');
    const lines=doc.lineItems?.length?doc.lineItems:[{id:doc.id+'-line',sku:String(value('sku')||''),productName:String(value('productName')||''),quantity:Number(value('quantity')),unitPrice:Number(value('unitPrice')),discount:Number(value('discount')||0),taxAmount:Number(value('taxAmount')||0)}];
    if(lines.some(line=>!line.sku || !before.products.some(p=>p.sku===line.sku && p.active) || !Number.isSafeInteger(line.quantity) || line.quantity<=0 || !Number.isFinite(line.unitPrice) || line.unitPrice<0))throw Error('Every invoice line requires a matched catalog SKU and valid amounts.');
    const lineSchema=ledgerDataSchema.shape.aiDocuments.element.shape.lineItems;
    if(!lineSchema.safeParse(lines).success || new Set(lines.map(line=>line.id)).size!==lines.length)throw Error('Invalid invoice line identity, precision or amount.');
    const tax=sumMoney(lines.map(line=>line.taxAmount));
    if(tax>0 && doc.pricesIncludeTax===undefined)throw Error('Confirm the invoice tax-inclusive/exclusive basis before posting.');
    const calculated=sumMoney(lines.map(line=>sumMoney([line.lineSubtotal??line.quantity*line.unitPrice,-line.discount,doc.pricesIncludeTax?0:line.taxAmount])));
    if(toPaise(calculated)!==toPaise(Number(value('totalAmount'))))throw Error('All invoice lines must reconcile to the document total.');
    after=structuredClone(before);
    if(doc.fileType==='INVOICE') {
      const external=String(value('orderId')||value('invoiceNumber')||'');if(!external)throw Error('Source invoice/order reference is required.');
      await upsertOrders(owner,[{id:'ORD-DOC-'+doc.id,channelOrderId:external,marketplace:(value('marketplace')||'Personal Website') as any,orderDate:date,taxInvoiceDate:date,currency:'INR',pricesIncludeTax:doc.pricesIncludeTax,status:'CONFIRMED',customerName:'',customerCity:'',customerState:'',shippingFeeCharged:0,marketplaceChargesEstimate:0,
        items:lines.map(line=>({id:line.id,sku:line.sku,productName:line.productName,quantity:line.quantity,sellingPrice:line.unitPrice,lineSubtotal:line.lineSubtotal,discount:line.discount,taxAmount:line.taxAmount,snapshotUnitCost:0,costEvidence:'UNKNOWN',returnedQuantity:0}))}],client);
    } else if(doc.fileType==='SUPPLIER_BILL') {
      const suppliers=before.suppliers.filter(s=>doc.supplierId?s.id===doc.supplierId:s.name===value('vendorName'));
      if(suppliers.length!==1)throw Error('Match this invoice to one owned supplier before posting.');
      if(!value('invoiceNumber'))throw Error('Printed supplier invoice reference is required.');
      for(const [i,line] of lines.entries()) after=applyLedgerCommand(after,{action:'save',collection:'purchases',record:{id:'PUR-DOC-'+doc.id+'-'+i,supplierId:suppliers[0].id,supplierName:suppliers[0].name,invoiceNumber:String(value('invoiceNumber')||doc.id),invoiceDate:date,sku:line.sku,quantity:line.quantity,unitCost:money(sumMoney([line.lineSubtotal??line.quantity*line.unitPrice,-line.discount,doc.pricesIncludeTax?-line.taxAmount:0])/line.quantity),lineSubtotal:sumMoney([line.lineSubtotal??line.quantity*line.unitPrice,-line.discount,doc.pricesIncludeTax?-line.taxAmount:0]),taxes:line.taxAmount,totalAmount:sumMoney([line.lineSubtotal??line.quantity*line.unitPrice,-line.discount,doc.pricesIncludeTax?0:line.taxAmount]),paymentStatus:doc.paymentStatus||'PENDING',paymentDate:doc.paymentDate,gstCreditStatus:'UNKNOWN'}});
    } else throw Error('This document type cannot create financial postings.');
    after.aiDocuments=after.aiDocuments.map(d=>d.id===doc.id?{...d,status:'APPROVED_POSTED'}:d);
  } else after=applyLedgerCommand(before,command);
  await persistLedgerDelta(client,owner,before,after);
  await client.query('INSERT INTO financial_commands(user_id,request_id,request_hash) VALUES($1,$2,$3)',[owner,requestId,hash]);
  return readCanonicalLedger(client,owner);
}
