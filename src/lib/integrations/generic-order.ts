import type {Marketplace,Order} from '@/domain/types';
import {orderSchema} from '@/domain/snapshot-validation';
import {money,sumMoney,toPaise} from '@/domain/money';
export function mapGenericSourceOrder(source:any,marketplace:Marketplace):Order {
  if(source.currency!=='INR')throw Error('Generic orders require explicit INR currency.');
  const channel=String(source.channelOrderId||source.orderId||source.id||''),date=String(source.orderDate||source.date||'').slice(0,10);
  if(!channel||!date)throw Error('Generic orders require stable source identity and date.');
  const lines=Array.isArray(source.items)?source.items:[source];
  const items:Order["items"]=lines.map((line:any,index:number)=>{
    const quantity=Number(line.quantity||line.qty),sku=String(line.sku||'');
    const unit=line.sellingPrice??line.unitPrice;
    const lineSubtotal=unit===undefined?Number(line.total??line.amount):line.lineSubtotal;
    if(!sku||!Number.isSafeInteger(quantity)||quantity<=0 || unit===undefined && !Number.isFinite(lineSubtotal))throw Error('Generic line requires SKU, quantity and explicit unit or extended amount.');
    return {id:String(line.lineItemId||line.id||`${channel}:${index}`),sku,productName:String(line.productName||sku),quantity,sellingPrice:unit===undefined?money(lineSubtotal/quantity):Number(unit),lineSubtotal,
      discount:Number(line.discount||0),taxAmount:Number(line.taxAmount||0),snapshotUnitCost:0,costEvidence:'UNKNOWN' as const,returnedQuantity:0};
  });
  const order={id:'ORD-GEN-'+channel,channelOrderId:channel,marketplace,currency:'INR' as const,orderDate:date,status:String(source.status||'CONFIRMED').toUpperCase(),revenueRecognisedDate:source.revenueRecognisedDate,
    pricesIncludeTax:source.pricesIncludeTax,sourceUpdatedAt:source.updatedAt,customerName:String(source.customerName||''),customerCity:String(source.customerCity||''),customerState:String(source.customerState||''),shippingFeeCharged:Number(source.shippingFeeCharged||0),marketplaceChargesEstimate:0,items};
  if(source.refunds?.length || ['RETURNED','PARTIALLY_RETURNED','CUSTOMER_RETURN','DAMAGED_RETURN','RTO'].includes(order.status))throw Error('Generic refunds require dated commercial/physical-return reconciliation before import.');
  const sourceTotal=source.totalAmount??(Array.isArray(source.items)?source.total:undefined);
  if(sourceTotal!==undefined) {
    if(items.some(i=>i.taxAmount>0)&&source.pricesIncludeTax===undefined)throw Error('Generic source tax basis is required to reconcile its total.');
    const calculated=sumMoney([...items.map(i=>sumMoney([i.lineSubtotal??i.quantity*i.sellingPrice,-i.discount,source.pricesIncludeTax?0:i.taxAmount])),order.shippingFeeCharged]);
    if(toPaise(calculated)!==toPaise(Number(sourceTotal)))throw Error('Generic source line amounts do not reconcile to its document total.');
  }
  const parsed=orderSchema.safeParse({...order,sourceTotal:sourceTotal===undefined?undefined:Number(sourceTotal)});if(!parsed.success)throw Error('Generic source order violates canonical financial input requirements.');return parsed.data as Order;
}
