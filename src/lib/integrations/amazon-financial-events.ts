import crypto from 'crypto';
import type { PoolClient } from 'pg';
import type { Settlement,SettlementDeduction,DeductionCategory } from '@/domain/types';
import { sumMoney } from '@/domain/money';
import { appendFinancialAudit } from '@/lib/ledger-records';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const amazonEventIdentity=(event:any)=>crypto.createHash('sha256').update(JSON.stringify(canonical(event))).digest('hex');
const category=(name:string):DeductionCategory=>/tcs/i.test(name)?'TAX_TCS':/tds/i.test(name)?'TAX_TDS':/commission|referral/i.test(name)?'COMMISSION':/return|refund/i.test(name)?'RETURN_SHIPPING':/shipping|handling|easyship|fba|pickpack/i.test(name)?'LOGISTICS':/closing|fixed/i.test(name)?'FIXED_FEE':/penalty/i.test(name)?'PENALTY':'OTHER';
const amount=(value:any)=>{
  if(!value || value.CurrencyCode!=='INR')throw Error('Financial event has missing or unsupported currency.');
  const v=Number(value.CurrencyAmount??value.Amount);if(!Number.isFinite(v)||Math.abs(v*100-Math.round(v*100))>1e-7)throw Error('Invalid financial event amount.');return v;
};
/** Signed provider events are receivable evidence, never proof of a bank transfer. */
export function projectAmazonEvent(type:string,event:any):{settlement?:Settlement;issue?:string} {
  if(!['ShipmentEventList','RefundEventList','ChargebackEventList','GuaranteeClaimEventList'].includes(type))return {issue:`${type} retained for account-level reconciliation; no order/bank posting inferred.`};
  if(!event.AmazonOrderId || !event.PostedDate || !Number.isFinite(Date.parse(event.PostedDate)))return {issue:'Financial event lacks an order or posted date.'};
  try {
    const deductions:SettlementDeduction[]=[],charges:number[]=[];
    const fee=(list:any[])=>{for(const f of list||[]){const value=-amount(f.FeeAmount);deductions.push({category:category(f.FeeType||''),name:f.FeeType||'Unclassified provider fee',amount:value,gstCreditStatus:'UNKNOWN'});}};
    const charge=(list:any[])=>{for(const c of list||[])charges.push(amount(c.ChargeAmount));};
    charge(event.OrderChargeList);charge(event.OrderChargeAdjustmentList);fee(event.ShipmentFeeList);fee(event.ShipmentFeeAdjustmentList);fee(event.OrderFeeList);fee(event.OrderFeeAdjustmentList);
    for(const item of [...event.ShipmentItemList||[],...event.ShipmentItemAdjustmentList||[]]) {
      charge(item.ItemChargeList);charge(item.ItemChargeAdjustmentList);fee(item.ItemFeeList);fee(item.ItemFeeAdjustmentList);
      for(const promotion of [...item.PromotionList||[],...item.PromotionAdjustmentList||[]])charges.push(amount(promotion.PromotionAmount));
      for(const withheld of item.ItemTaxWithheldList||[])for(const tax of withheld.TaxesWithheld||[]) {
        const cat=category(tax.ChargeType||'');if(cat!=='TAX_TCS'&&cat!=='TAX_TDS')throw Error('Unclassified withholding needs source reconciliation.');
        deductions.push({category:cat,name:tax.ChargeType,amount:-amount(tax.ChargeAmount)});
      }
    }
    const tcsTax=sumMoney(deductions.filter(d=>d.category==='TAX_TCS').map(d=>d.amount)),tdsTax=sumMoney(deductions.filter(d=>d.category==='TAX_TDS').map(d=>d.amount));
    const settlementDate=event.PostedDate.slice(0,10),hash=amazonEventIdentity(event),grossAmount=sumMoney(charges);
    const eventSuffix=type==='ShipmentEventList'?hash:type+'-'+hash;
    return {settlement:{id:`SET-AMZ-${event.AmazonOrderId}-${eventSuffix}`,settlementBatchId:'FIN-AMZ-'+settlementDate.replaceAll('-',''),marketplace:'Amazon India',settlementDate,orderId:event.AmazonOrderId,
      grossAmount,deductions,tcsTax,tdsTax,tcsTdsTax:sumMoney([tcsTax,tdsTax]),netSettlement:sumMoney([grossAmount,-sumMoney(deductions.map(d=>d.amount))]),
      evidenceType:'FINANCIAL_EVENT',feeCoverage:'PARTIAL',reconciliationStatus:'PENDING_RECON',sourceDocument:`Amazon ${type} ${hash}`},
      issue:type==='ShipmentEventList'?undefined:'Refund/chargeback financial evidence retained; commercial refund and physical-return reconciliation are still required.'};
  }catch(error){return {issue:error instanceof Error?error.message:'Unmapped financial event.'};}
}
export async function retainAmazonEvents(client:PoolClient,owner:string,events:Record<string,any[]>) {
  const settlements:Settlement[]=[],issues:string[]=[];let count=0;
  for(const [type,list] of Object.entries(events))for(const event of list) {
    count++;const identity=amazonEventIdentity(event),projection=projectAmazonEvent(type,event);
    if(projection.settlement) {
      const prior=(await client.query(`SELECT s.display_id,s.record_data,s.tcs_tds_tax,EXISTS(SELECT 1 FROM settlement_deductions d WHERE d.settlement_id=s.id AND d.amount<>0) AS has_fees
        FROM settlements s JOIN orders o ON o.id=s.order_id AND o.user_id=s.user_id
        WHERE s.user_id=$1 AND s.marketplace='Amazon India' AND (o.display_id=$2 OR o.channel_order_id=$2) AND s.deleted_at IS NULL`,[owner,event.AmazonOrderId])).rows;
      if(!prior.some(s=>s.display_id===projection.settlement!.id) && prior.some(s=>s.record_data?.evidenceType!=='FINANCIAL_EVENT' && (s.has_fees||Number(s.tcs_tds_tax)))) {
        projection.issue='Bank deductions already exist; source event linkage must be reconciled before adding duplicate fee/withholding accruals.';
        projection.settlement=undefined;
      }
    }
    if(projection.settlement)settlements.push(projection.settlement);if(projection.issue)issues.push(projection.issue);
    const retained=await client.query(`INSERT INTO provider_financial_events(user_id,marketplace,event_type,event_identity,source_payload,projection_issue) VALUES($1,'Amazon India',$2,$3,$4::jsonb,$5)
      ON CONFLICT(user_id,marketplace,event_type,event_identity) DO NOTHING RETURNING event_identity`,[owner,type,identity,JSON.stringify(event),projection.issue||null]);
    if(retained.rows.length)await appendFinancialAudit(client,owner,'DOCUMENT',identity,null,{provider:'Amazon India',type,source:event,issue:projection.issue||null},'Original provider financial event retained');
  }
  return {settlements:Array.from(new Map(settlements.map(s=>[s.id,s])).values()),issues:Array.from(new Set(issues)),count};
}
