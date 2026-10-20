import type { LedgerData } from '@/domain/snapshot-validation';
import { emptyLedger } from '@/domain/recycle-bin';
export type LedgerClient={query:(sql:string,params?:any[])=>Promise<{rows:any[]}>};
const day=(v:any)=>v?new Date(v).toISOString().slice(0,10):undefined;
const n=(v:any)=>Number(v||0);
const metadata=(row:any)=>row.record_data || {};
function indexChildren(records:any[],key:string):Map<string,any[]> {
  const index=new Map<string,any[]>();
  for(const record of records) {
    const group=index.get(record[key]);
    if(group)group.push(record);else index.set(record[key],[record]);
  }
  return index;
}
/** Complete owner-scoped books; callers use a repeatable-read or mutation transaction. */
export async function readCanonicalLedger(client:LedgerClient,owner:string):Promise<LedgerData> {
  const tables=['orders','products','suppliers','purchase_bills','supplier_payments','return_records','claims','expenses','ai_staged_documents','settlements'] as const;
  const reads:Record<string,string>={};
  for(const table of tables) {
    const soft=['supplier_payments','purchase_bills'].includes(table)?'': ' AND deleted_at IS NULL';
    reads[table]=`SELECT * FROM ${table} WHERE user_id=$1${soft} ORDER BY id`;
  }
  const child=(table:string,parent:string)=>`SELECT c.* FROM ${table} c JOIN ${parent} p ON p.id=c.${parent==='orders'?'order_id':parent==='products'?'product_id':'settlement_id'} WHERE p.user_id=$1`;
  Object.assign(reads,{
    revision:'SELECT COALESCE(MAX(sequence),0) AS revision FROM financial_audit_logs WHERE user_id=$1',
    unresolved:'SELECT marketplace,event_type,count(*) AS count FROM provider_financial_events WHERE user_id=$1 AND projection_issue IS NOT NULL GROUP BY marketplace,event_type ORDER BY marketplace,event_type',
    feeSnapshots:'SELECT DISTINCT ON(e.order_id) e.order_id,e.input_snapshot,e.total_paise FROM order_fee_estimates e WHERE e.user_id=$1 ORDER BY e.order_id,e.calculated_at DESC,e.id DESC',
    items:child('order_items','orders'),histories:child('product_cost_history','products'),
    aliases:child('product_channel_aliases','products'),deductions:child('settlement_deductions','settlements'),
    allocations:'SELECT a.* FROM supplier_payment_allocations a JOIN suppliers s ON s.id=a.supplier_id WHERE s.user_id=$1',
    claimDocs:'SELECT d.* FROM claim_documents d JOIN claims c ON c.id=d.claim_id WHERE c.user_id=$1',
    docs:'SELECT f.* FROM ai_staged_fields f JOIN ai_staged_documents d ON d.id=f.document_id WHERE d.user_id=$1 AND d.deleted_at IS NULL',
    statutoryRates:'SELECT effective_from,tcs_bps,tds_bps FROM statutory_withholding_rates WHERE user_id=$1 ORDER BY effective_from',
    auditLogs:'SELECT * FROM financial_audit_logs WHERE user_id=$1 ORDER BY timestamp,id',
    complaints:'SELECT * FROM customer_complaints WHERE user_id=$1 ORDER BY created_at,id',
  });
  // One round trip for the same owner-scoped snapshot, rather than 22 sequential reads.
  // Each sorted subquery feeds only its own aggregate, preserving its row order.
  // Keep distinct parameters so PostgreSQL infers UUID and legacy text owner columns independently.
  const entries=Object.entries(reads);
  const statement='SELECT '+entries.map(([key,sql],index)=>
    `(SELECT COALESCE(jsonb_agg(ledger_row),'[]'::jsonb) FROM (${sql.replace(/\$1\b/g,'$'+(index+1))}) ledger_row) AS "${key}"`).join(',');
  const rows:Record<string,any[]>=(await client.query(statement,entries.map(()=>owner))).rows[0];
  const {feeSnapshots,items,histories,aliases,deductions,allocations,claimDocs,docs}=rows;
  const data=emptyLedger();
  data.financialRevision=Number(rows.revision[0]?.revision||0);
  data.financialIssues=rows.unresolved.map(row=>row.marketplace+': '+row.count+' '+row.event_type+' records need source reconciliation.');
  const feesByOrder=new Map(feeSnapshots.map(row=>[row.order_id,row]));
  for(const row of rows.orders){const fee=feesByOrder.get(row.id);row.record_data={...(fee?.input_snapshot||{}),...(row.record_data||{}),feeEstimateTotalPaise:fee?.total_paise==null?null:n(fee.total_paise)};}
  const orderByUuid=new Map(rows.orders.map(row=>[row.id,row.display_id]));
  const supplierByUuid=new Map(rows.suppliers.map(row=>[row.id,row.display_id]));
  const productByUuid=new Map(rows.products.map(row=>[row.id,row]));
  const itemsByOrder=indexChildren(items,'order_id'),historiesByProduct=indexChildren(histories,'product_id');
  const aliasesByProduct=indexChildren(aliases,'product_id'),deductionsBySettlement=indexChildren(deductions,'settlement_id');
  const allocationsByPayment=indexChildren(allocations,'supplier_payment_id'),documentsByClaim=indexChildren(claimDocs,'claim_id');
  const fieldsByDocument=indexChildren(docs,'document_id');
  const claimsByUuid=new Map(rows.claims.map(row=>[row.id,row])),returnsByUuid=new Map(rows.return_records.map(row=>[row.id,row]));
  data.orders=rows.orders.map(row=>({...metadata(row),id:row.display_id,channelOrderId:row.channel_order_id,marketplace:row.marketplace,
    orderDate:day(row.order_date),status:row.status,customerName:row.customer_name,customerCity:row.customer_city,customerState:row.customer_state,
    shippingFeeCharged:n(row.shipping_fee_charged),marketplaceChargesEstimate:n(row.marketplace_charges_estimate),
    quickFeeRateBps:row.quick_fee_rate_bps==null?undefined:n(row.quick_fee_rate_bps), feeEstimateStatus:row.fee_estimate_status,
    settlementAmount:row.settlement_amount==null?undefined:n(row.settlement_amount),fulfilmentMode:row.fulfilment_mode||undefined,notes:row.notes||undefined,
    items:(itemsByOrder.get(row.id)||[]).map(item=>({...metadata(item),costEvidence:metadata(item).costEvidence||(n(item.snapshot_unit_cost)>0?'RECORDED':'UNKNOWN'),id:item.display_id,sku:item.sku,productName:item.product_name,quantity:n(item.quantity),sellingPrice:n(item.selling_price),
      lineSubtotal:item.line_subtotal==null?undefined:n(item.line_subtotal),discount:n(item.discount),taxAmount:n(item.tax_amount),snapshotUnitCost:n(item.snapshot_unit_cost),returnedQuantity:n(item.returned_quantity)}))}));
  const shells=data.orders.filter(o=>o.sourceEvidenceStatus==='UNRESOLVED_PARENT');if(shells.length)data.financialIssues!.push(shells.length+' settlement parents need source invoices.');
  data.products=rows.products.map(row=>({id:row.display_id,sku:row.sku,name:row.name,category:row.category,brand:row.brand,currentCostPrice:n(row.current_cost_price),
    supplierId:supplierByUuid.get(row.supplier_id)||'',active:row.active,stockQuantity:n(row.stock_quantity),weightGrams:row.weight_grams==null?undefined:n(row.weight_grams),mfn:row.mfn||undefined,mfn1:row.mfn1||undefined,
    costHistory:(historiesByProduct.get(row.id)||[]).map(h=>({validFrom:day(h.valid_from)!,validTo:day(h.valid_to),costPrice:n(h.cost_price),notes:h.notes||undefined})),
    channelAliases:Object.fromEntries((aliasesByProduct.get(row.id)||[]).map(a=>[a.marketplace,a.alias_sku]))}));
  data.suppliers=rows.suppliers.map(row=>({...metadata(row),id:row.display_id,name:row.name,contactPerson:row.contact_person,email:row.email,phone:row.phone,address:row.address,
    gstin:row.gstin||undefined,paymentTerms:row.payment_terms||undefined,bankAccount:row.bank_account||undefined,upiId:row.upi_id||undefined,notes:row.notes||undefined,openingBalance:n(row.opening_balance),totalPaid:n(row.total_paid)}));
  data.purchases=rows.purchase_bills.filter(row=>supplierByUuid.has(row.supplier_id)).map(row=>({...metadata(row),id:row.display_id,supplierId:supplierByUuid.get(row.supplier_id),supplierName:row.supplier_name,
    invoiceNumber:row.invoice_number,invoiceDate:day(row.invoice_date),sku:row.sku,quantity:n(row.quantity),unitCost:n(row.unit_cost),taxes:n(row.taxes),totalAmount:n(row.total_amount),
    paymentStatus:row.payment_status,paidAmount:row.paid_amount==null?undefined:n(row.paid_amount),documentUrl:row.document_url||undefined}));
  const purchaseByUuid=new Map(rows.purchase_bills.map(row=>[row.id,row.display_id]));
  data.supplierPayments=rows.supplier_payments.filter(row=>supplierByUuid.has(row.supplier_id)).map(row=>({...metadata(row),id:row.display_id,supplierId:supplierByUuid.get(row.supplier_id),date:day(row.paid_at),amount:n(row.amount),paymentMethod:row.payment_method,
    reference:row.reference_code||'',notes:row.notes||undefined,advanceAmount:n(row.advance_amount),allocations:(allocationsByPayment.get(row.id)||[]).map(a=>({purchaseId:purchaseByUuid.get(a.purchase_bill_id),amount:n(a.amount)}))}));
  for(const payment of data.supplierPayments||[]) {
    const allocated=payment.allocations.reduce((sum,a)=>sum+Math.round(a.amount*100),Math.round(payment.advanceAmount*100));
    payment.allocationStatus=allocated===Math.round(payment.amount*100)?'RECORDED':'UNRESOLVED';
    if(payment.allocationStatus==='UNRESOLVED')data.financialIssues!.push('Supplier payment '+payment.id+' has unresolved invoice/advance allocation.');
  }
  data.returns=rows.return_records.filter(row=>orderByUuid.has(row.order_id)).map(row=>({...metadata(row),id:row.display_id,orderId:orderByUuid.get(row.order_id),channelOrderId:row.channel_order_id||'',marketplace:row.marketplace,
    returnDate:day(row.return_date),receivedDate:day(row.received_date),returnType:row.return_type,returnReason:row.return_reason,sku:row.sku,productName:row.product_name||undefined,quantity:n(row.quantity),condition:row.condition,
    restockStatus:row.restock_status||undefined,claimDeadline:day(row.claim_deadline),returnShippingCost:n(row.return_shipping_cost),customerReturnFee:n(row.customer_return_fee),otherReturnCosts:n(row.other_return_costs),inventoryRecoveryValue:n(row.inventory_recovery_value),lossAmount:n(row.loss_amount),
    notes:row.notes||undefined,awbNumber:row.awb_number||undefined,claimId:claimsByUuid.get(row.claim_id)?.display_id||metadata(row).claimId}));
  data.claims=rows.claims.filter(row=>orderByUuid.has(row.order_id)).map(row=>({...metadata(row),id:row.display_id,orderId:orderByUuid.get(row.order_id),returnId:returnsByUuid.get(row.return_id)?.display_id,
    marketplace:row.marketplace,claimType:row.claim_type,claimDate:day(row.claim_date),amountClaimed:n(row.amount_claimed),amountRecovered:n(row.amount_recovered),status:row.status,recoveryDate:day(row.recovery_date),notes:row.notes||undefined,supportingDocuments:metadata(row).supportingDocuments||(documentsByClaim.get(row.id)||[]).map(d=>d.document_url)}));
  data.aiDocuments=rows.ai_staged_documents.map(row=>({...metadata(row),id:row.display_id,fileName:row.file_name,fileUrl:row.file_url||undefined,fileType:row.file_type,uploadDate:day(row.upload_date),status:row.status,rawTextPreview:row.raw_text_preview||'',
    extractedData:metadata(row).extractedData || Object.fromEntries((fieldsByDocument.get(row.id)||[]).map(f=>[f.field_name,{value:['quantity','unitPrice','discount','taxAmount','totalAmount'].includes(f.field_name)?n(f.value_text):f.value_text,confidence:n(f.confidence),provenance:f.provenance}])),
    arithmeticValidation:{passed:!!row.arithmetic_passed,calculatedTotal:n(row.arithmetic_calculated),declaredTotal:n(row.arithmetic_declared),difference:n(row.arithmetic_difference),message:row.arithmetic_message||''},
    catalogValidation:{skuMatched:!!row.catalog_sku_matched,matchedSkuId:row.catalog_matched_sku_id||undefined,suggestion:row.catalog_suggestion||undefined}}));
  data.expenses=rows.expenses.map(row=>({...metadata(row),id:row.display_id,date:day(row.expense_date),category:row.category,description:row.description,amount:n(row.amount),vendor:row.vendor,paymentMethod:row.payment_method,isRecurring:row.is_recurring,marketplace:row.marketplace||undefined,attributedSku:row.attributed_sku||undefined,supportingDocument:row.supporting_document||undefined,notes:row.notes||undefined}));
  const statutoryRates=rows.statutoryRates.map(r=>({effectiveFrom:day(r.effective_from),tcsBps:n(r.tcs_bps),tdsBps:n(r.tds_bps)}));
  data.settlements=rows.settlements.filter(row=>orderByUuid.has(row.order_id)).map(row=>({...metadata(row),withholdingRates:metadata(row).withholdingRates||(statutoryRates.length?statutoryRates:undefined),id:row.display_id,orderId:orderByUuid.get(row.order_id),marketplace:row.marketplace,settlementBatchId:row.settlement_batch_id,settlementDate:day(row.settlement_date),grossAmount:n(row.gross_amount),tcsTdsTax:n(row.tcs_tds_tax),
    tcsTax:row.tcs_tax==null?undefined:n(row.tcs_tax),tdsTax:row.tds_tax==null?undefined:n(row.tds_tax),tcsTaxableValue:row.tcs_taxable_value==null?undefined:n(row.tcs_taxable_value),tdsGrossAmount:row.tds_gross_amount==null?undefined:n(row.tds_gross_amount),netSettlement:n(row.net_settlement),reconciliationStatus:row.reconciliation_status,bankTxRef:row.bank_tx_ref||undefined,sourceDocument:row.source_document||undefined,
    deductions:(deductionsBySettlement.get(row.id)||[]).map(d=>({...metadata(d),category:d.category,name:d.name,amount:n(d.amount),gstAmount:d.gst_amount==null?undefined:n(d.gst_amount)}))}));
  data.auditLogs=rows.auditLogs.map(row=>({id:row.display_id,timestamp:new Date(row.timestamp).toISOString(),entityType:row.entity_type,entityId:row.entity_id,fieldName:row.field_name,oldValue:row.old_value||'',newValue:row.new_value||'',modifiedBy:row.modified_by,reason:row.reason||undefined,sourceDocumentId:row.source_document_id||undefined}));
  data.complaints=rows.complaints.map(row=>({...metadata(row),id:row.display_id,ticketNumber:row.ticket_number,
    customerName:row.customer_name,customerEmail:row.customer_email,customerPhone:row.customer_phone||undefined,
    orderId:orderByUuid.get(row.order_id),channelOrderId:row.channel_order_id||undefined,marketplace:row.marketplace||undefined,
    sku:row.sku||undefined,category:row.category,priority:row.priority,status:row.status,subject:row.subject,
    description:row.description,createdAt:new Date(row.created_at).toISOString(),
    resolvedAt:row.resolved_at?new Date(row.resolved_at).toISOString():undefined,resolutionNotes:row.resolution_notes||undefined}));
  return data;
}
