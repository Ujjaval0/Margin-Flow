import type { Claim } from './types';
import { sumMoney } from './money';
export function claimRecoveryEvents(claim:Claim) {
  return claim.recoveries?.length?claim.recoveries:claim.amountRecovered && claim.recoveryDate?[{id:'LEGACY-'+claim.id,date:claim.recoveryDate,amount:claim.amountRecovered,cashSettlementId:claim.cashSettlementId}]:[];
}
export function recoveredAt(claim:Claim,asOf?:string) {
  return sumMoney(claimRecoveryEvents(claim).filter(event=>!asOf||event.date.slice(0,10)<=asOf).map(event=>event.amount));
}
