import type { AIStagedDocument } from './types';
import { sumMoney,toPaise } from './money';
export function documentArithmetic(doc:AIStagedDocument):AIStagedDocument['arithmeticValidation'] {
  const fields=doc.extractedData;
  const lines=doc.lineItems?.length?doc.lineItems:[{quantity:fields.quantity?.value,unitPrice:fields.unitPrice?.value,discount:fields.discount?.value??0,taxAmount:fields.taxAmount?.value}];
  const declared=fields.totalAmount?.value;
  const valid=declared!==undefined && lines.every(line=>Number.isSafeInteger(line.quantity)&&line.quantity!>0&&Number.isFinite(line.unitPrice)&&line.unitPrice!>=0&&Number.isFinite(line.discount)&&line.discount>=0&&Number.isFinite(line.taxAmount)&&line.taxAmount!>=0);
  let calculated=0;
  if(valid)calculated=sumMoney(lines.map(line=>sumMoney([('lineSubtotal' in line?line.lineSubtotal:undefined)??line.quantity!*line.unitPrice!,-line.discount,doc.pricesIncludeTax?0:line.taxAmount!])));
  const basisKnown=lines.every(line=>!line.taxAmount)||doc.pricesIncludeTax!==undefined;
  const difference=declared===undefined?0:sumMoney([calculated,-declared]);
  const passed=valid&&basisKnown&&toPaise(difference)===0;
  return {passed,calculatedTotal:calculated,declaredTotal:declared??0,difference:Math.abs(difference),message:passed?'All source lines reconcile to the printed total.':!valid?'Incomplete source line fields.':!basisKnown?'Price tax basis requires confirmation.':'Source lines disagree with the printed total.'};
}
