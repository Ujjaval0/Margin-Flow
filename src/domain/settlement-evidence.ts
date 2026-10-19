import type { Settlement } from './types';
import { sumMoney,toPaise } from './money';
import { getSettlementWithholding } from './accounting-policy';
/** A bank statement may repeat accrual deductions. Explicit source links clear them once. */
export function settlementMovement(row:Settlement,all:Settlement[]):Settlement {
  const referenced=(row.financialEventIds||[]).map(id=>all.find(event=>event.id===id && event.evidenceType==='FINANCIAL_EVENT' && event.marketplace===row.marketplace && event.orderId===row.orderId)).filter((s):s is Settlement=>!!s);
  if(!referenced.length)return row;
  const reversal=referenced.flatMap(s=>s.deductions).map(d=>({...d,amount:-d.amount,gstAmount:d.gstAmount===undefined?undefined:-d.gstAmount,eligibleGstAmount:d.eligibleGstAmount===undefined?undefined:-d.eligibleGstAmount,name:'Previously recognized: '+d.name}));
  const separate=row.tcsTax!==undefined&&row.tdsTax!==undefined&&referenced.every(s=>s.tcsTax!==undefined&&s.tdsTax!==undefined);
  return {...row,deductions:[...row.deductions,...reversal],
    tcsTax:separate?sumMoney([row.tcsTax||0,...referenced.map(s=>-(s.tcsTax||0))]):undefined,
    tdsTax:separate?sumMoney([row.tdsTax||0,...referenced.map(s=>-(s.tdsTax||0))]):undefined,
    tcsTdsTax:sumMoney([getSettlementWithholding(row),...referenced.map(s=>-getSettlementWithholding(s))])};
}

export function validateSettlementLinkage(row:Settlement,all:Settlement[]) {
  const ids=row.financialEventIds||[];
  if(!ids.length)return;
  if(row.evidenceType==='FINANCIAL_EVENT' || new Set(ids).size!==ids.length)throw Error('Only a bank receipt may clear distinct prior financial events.');
  const events=ids.map(id=>all.find(s=>s.id===id&&s.evidenceType==='FINANCIAL_EVENT'&&s.orderId===row.orderId&&s.marketplace===row.marketplace));
  if(events.some(s=>!s || s.settlementDate.slice(0,10)>row.settlementDate.slice(0,10)))throw Error('Linked source events must belong to this order and precede its bank receipt.');
  const sources=events as Settlement[];
  const covers=(actual:number,prior:number)=>prior===0 || Math.sign(actual)===Math.sign(prior)&&Math.abs(toPaise(actual))>=Math.abs(toPaise(prior));
  for(const category of new Set(sources.flatMap(s=>s.deductions.map(d=>d.category)))) {
    if(category==='TAX_TCS'||category==='TAX_TDS')continue;
    const prior=sumMoney(sources.flatMap(s=>s.deductions.filter(d=>d.category===category).map(d=>d.amount)));
    const actual=sumMoney(row.deductions.filter(d=>d.category===category).map(d=>d.amount));
    if(!covers(actual,prior))throw Error('Bank evidence does not cover the referenced deduction category.');
    const priorTax=sumMoney(sources.flatMap(s=>s.deductions.filter(d=>d.category===category).map(d=>d.gstAmount||0)));
    const actualTax=sumMoney(row.deductions.filter(d=>d.category===category).map(d=>d.gstAmount||0));
    if(!covers(actualTax,priorTax))throw Error('Bank fee GST does not cover the referenced source tax.');
  }
  if(!covers(getSettlementWithholding(row),sumMoney(sources.map(getSettlementWithholding))))throw Error('Bank withholding does not cover the referenced source credits.');
  if(row.tcsTax!==undefined && sources.every(s=>s.tcsTax!==undefined) && !covers(row.tcsTax,sumMoney(sources.map(s=>s.tcsTax!))))throw Error('Bank TCS does not cover source credits.');
  if(row.tdsTax!==undefined && sources.every(s=>s.tdsTax!==undefined) && !covers(row.tdsTax,sumMoney(sources.map(s=>s.tdsTax!))))throw Error('Bank TDS does not cover source credits.');
  if(all.some(s=>s.id!==row.id&&(s.financialEventIds||[]).some(id=>ids.includes(id))))throw Error('A financial event has already been cleared by another receipt.');
}
