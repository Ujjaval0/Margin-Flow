import type {Claim,Order,ReturnRecord} from './types';
import {allocateMoney} from './order-financials';
import {claimRecoveryEvents} from './claim-recovery';
import {sumMoney} from './money';
export function returnClaimAllocations(order:Order|undefined,returns:ReturnRecord[],claims:Claim[],asOf?:string) {
  const output=new Map<string,{claim:Claim;claimed:number;recovered:number}[]>();
  for(const claim of Array.from(new Map(claims.map(c=>[c.id,c])).values())) {
    if(asOf && claim.claimDate.slice(0,10)>asOf)continue;
    const matching=Array.from(new Map(returns.filter(r=>r.quantity>0 && r.marketplace===claim.marketplace &&
      (!asOf || r.returnDate.slice(0,10)<=asOf) && (order?order.marketplace===claim.marketplace &&
      [order.id,order.channelOrderId].includes(claim.orderId) && ([order.id,order.channelOrderId].includes(r.orderId) || !!r.channelOrderId && r.channelOrderId===order.channelOrderId):r.orderId===claim.orderId)).map(r=>[r.id,r])).values());
    // An explicit return link is authoritative. Order-wide claims use only returns
    // known at filing, so later returns cannot redistribute an earlier recovery.
    let eligible=claim.returnId?matching.filter(r=>r.id===claim.returnId):matching.some(r=>r.claimId===claim.id)?matching.filter(r=>r.claimId===claim.id):matching.filter(r=>r.returnDate.slice(0,10)<=claim.claimDate.slice(0,10));
    eligible=eligible.sort((a,b)=>a.returnDate.localeCompare(b.returnDate)||a.id.localeCompare(b.id));
    const weights=eligible.map(r=>r.quantity),claimed=allocateMoney(claim.amountClaimed,weights),recovered=eligible.map(()=>0);
    for(const event of claimRecoveryEvents(claim).filter(event=>!asOf || event.date.slice(0,10)<=asOf))
      allocateMoney(event.amount,weights).forEach((share,index)=>recovered[index]=sumMoney([recovered[index],share]));
    eligible.forEach((r,i)=>output.set(r.id,[...(output.get(r.id)||[]),{claim,claimed:claimed[i],recovered:recovered[i]}]));
  }
  return output;
}
