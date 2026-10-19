const fs=require('fs'),file='src/domain/order-financials.ts';let s=fs.readFileSync(file,'utf8');
s=s.replace('claims: Claim[]) {','claims: Claim[], asOf?: string) {');
s=s.replace('const linkedReturns = unique(returns.filter(matches));',"const linkedReturns = unique(returns.filter(record=>matches(record) && (!asOf || record.returnDate.slice(0,10)<=asOf))).sort((a,b)=>a.returnDate.localeCompare(b.returnDate)||a.id.localeCompare(b.id));");
s=s.replace('const linkedSettlements = unique(settlements.filter(matches));',"const linkedSettlements = unique(settlements.filter(record=>matches(record) && (!asOf || record.settlementDate.slice(0,10)<=asOf)));");
s=s.replace('const linkedClaims = unique(claims.filter(matches));',"const linkedClaims = unique(claims.filter(record=>matches(record) && (!asOf || (record.recoveryDate||record.claimDate).slice(0,10)<=asOf)));");
s=s.replace('const revenueRecognised = active && recognised.has(order.status);',"const revenueRecognised = (active && recognised.has(order.status) || !!order.revenueRecognisedDate) && (!asOf || (order.revenueRecognisedDate||order.orderDate).slice(0,10)<=asOf);");
const start=s.indexOf('  const budgets = new Map'),end=s.indexOf('  const sum = (key:',start);
if(start<0||end<0)throw Error('allocation markers');
s=s.slice(0,start)+`  const remaining=order.items.map(item=>revenueRecognised?item.quantity:0);
  const attributedUnits:number[][]=linkedReturns.map(record=>{
    let count=Math.max(0,record.quantity);
    return order.items.map((item,index)=>{
      if(item.sku!==record.sku || record.orderItemId && record.orderItemId!==item.id)return 0;
      const quantity=Math.min(count,remaining[index]);count-=quantity;remaining[index]-=quantity;return quantity;
    });
  });
  const lines = order.items.map((item,index) => {
    const quantity=revenueRecognised?item.quantity:0;
    const inferred=!asOf && !linkedReturns.length ? Math.min(quantity,item.returnedQuantity|| (fullReturn?quantity:0)) : 0;
    const returnedUnits=inferred+attributedUnits.reduce((sum,units)=>sum+units[index],0);
    const goodUnits=linkedReturns.reduce((sum,record,r)=>sum+(record.condition==='SELLABLE' && record.restockStatus==='RESTOCKED' && !isDamagedReturn(record) && (!asOf || !!record.receivedDate && record.receivedDate.slice(0,10)<=asOf)?attributedUnits[r][index]:0),0);
    const damagedUnits=linkedReturns.reduce((sum,record,r)=>sum+(isDamagedReturn(record)?attributedUnits[r][index]:0),0)+(order.status==='DAMAGED_RETURN'?inferred:0);
    const rtoUnits=linkedReturns.reduce((sum,record,r)=>sum+(record.returnType==='RTO'?attributedUnits[r][index]:0),0)+(order.status==='RTO'?inferred:0);
    const gross=quantity?(item.lineSubtotal!==undefined?money(item.lineSubtotal):prorateMoney(item.sellingPrice,quantity,1)):0;
    const discount=quantity?money(Math.min(gross,Math.max(0,item.discount||0))):0;
    const refunded=quantity?prorateMoney(sumMoney([gross,-discount]),returnedUnits,quantity):0;
    const totalTax=quantity?money(item.taxAmount||0):0;
    const refundedTax=quantity?prorateMoney(totalTax,returnedUnits,quantity):0;
    const retainedTax=sumMoney([totalTax,-refundedTax]);
    return {sku:item.sku,productName:item.productName,quantity,gross,discount,refunded,
      netSales:sumMoney([gross,-discount,-refunded,order.pricesIncludeTax===true?-retainedTax:0]),
      returnedUnits,goodUnits,damagedUnits,rtoUnits,retainedTax,refundedTax,totalTax,
      unitCost:item.snapshotUnitCost,dispatchedCogs:prorateMoney(item.snapshotUnitCost,quantity,1),
      cogs:prorateMoney(item.snapshotUnitCost,quantity-goodUnits,1),damageLoss:prorateMoney(item.snapshotUnitCost,damagedUnits,1)};
  });
`+s.slice(end);
const a=s.indexOf('  const remainingLines = lines.map'),b=s.indexOf('  lines.forEach((line, lineIndex)',a);
if(a<0||b<0)throw Error('detail markers');
s=s.slice(0,a)+`  const returnDetails=linkedReturns.map((record,index)=>{
    const productCost=sumMoney(attributedUnits[index].map((units,i)=>prorateMoney(lines[i].unitCost,units,1)));
    const coveredUnits=attributedUnits[index].reduce((sum,units)=>sum+units,0);
    const costFacts=getReturnCostFacts(coveredUnits?record:{...record,inventoryRecoveryValue:0},productCost,settlementHasReturnShipping);
    const restocked=record.condition==='SELLABLE' && record.restockStatus==='RESTOCKED' && !costFacts.isDamaged && (!asOf || !!record.receivedDate && record.receivedDate.slice(0,10)<=asOf);
    return {record,...costFacts,returnedUnits:coveredUnits,restockedCost:restocked?productCost:0,damagedCost:costFacts.isDamaged?productCost:0,refundedRevenue:0,refundedTax:0};
  });
`+s.slice(b);
// Never infer confirmed credit from an estimate.
s=s.replace('order.gstRegistrationType === "REGULAR" && feeStatus === "ESTIMATE" ? money(order.estimatedFeeTaxAmount || 0) : 0','0');
// A recovered claim already included in an identified settlement is revenue, but not another cash receipt.
const location='  const taxBasisKnown =';
s=s.replace(location,`  const issues:string[]=[];
  if(revenueRecognised && order.items.some(item=>item.costEvidence==='UNKNOWN'))issues.push('Historical cost unresolved');
  if(revenueRecognised && !order.revenueRecognisedDate)issues.push('Recognition date unverified');
  if(order.settlementAmount!==undefined && !linkedSettlements.length)issues.push('Legacy receipt has no dated payment evidence');
  if(linkedSettlements.some(s=>s.deductions.length && s.feeCoverage!=='COMPLETE'))issues.push('Actual fee coverage incomplete');
${location}`);
s=s.replace('  return { active, revenueRecognised, lines,','  return { issues, isComplete:issues.length===0 && taxBasisKnown && feeStatus!=="UNKNOWN", active, revenueRecognised, lines,');
fs.writeFileSync(file,s);
