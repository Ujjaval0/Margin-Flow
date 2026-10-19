import type { Order,Product,Marketplace } from './types';
import { processDocumentOCR } from './ocr-engine';
import { createRecordId } from './record-id';
import { orderSchema } from './snapshot-validation';
import { sumMoney,toPaise,money } from './money';

export interface InvoiceSource {
  orderId?:string;invoiceNumber?:string;orderDate?:string;marketplace?:string;currency?:string;pricesIncludeTax?:boolean;
  customerName?:string;customerCity?:string;customerState?:string;productName?:string;sku?:string;quantity?:number;
  unitPrice?:number;taxRate?:number;taxAmount?:number;totalAmount?:number;shippingFee?:number;shippingTaxAmount?:number;discount?:number;
  lineItems?:{id?:string;sku:string;productName?:string;quantity:number;unitPrice:number;lineSubtotal?:number;discount:number;taxAmount:number}[];
}
/** Extraction is a proposal. Every source line and the printed total must agree before import. */
export function invoiceToOrder(input:{text:string;parsedData?:InvoiceSource},fileName:string,products:Product[]):Order {
  let source=input.parsedData;
  if(!source) {
    const doc=processDocumentOCR(fileName,input.text,'INVOICE'),v=doc.extractedData;
    if(!doc.arithmeticValidation.passed)throw Error('Invoice extraction is incomplete. Review the document in staging before posting.');
    source={orderId:v.orderId?.value,invoiceNumber:v.invoiceNumber?.value,orderDate:v.orderDate?.value,marketplace:v.marketplace?.value,currency:doc.currency,pricesIncludeTax:doc.pricesIncludeTax,
      sku:v.sku?.value,productName:v.productName?.value,quantity:v.quantity?.value,unitPrice:v.unitPrice?.value,discount:v.discount?.value,taxAmount:v.taxAmount?.value,totalAmount:v.totalAmount?.value};
  }
  if(source.currency!=='INR')throw Error('Invoice must explicitly identify INR; review missing or unsupported currency in staging.');
  if(!source.orderId&&!source.invoiceNumber || !source.orderDate)throw Error('Printed invoice reference and date are required.');
  const lines=source.lineItems?.length?source.lineItems:[{sku:source.sku||'',productName:source.productName,quantity:source.quantity!,unitPrice:source.unitPrice!,discount:source.discount??0,taxAmount:source.taxAmount!}];
  if(lines.some(line=>!line.sku || !Number.isSafeInteger(line.quantity)||line.quantity<=0 || !Number.isFinite(line.unitPrice)||!Number.isFinite(line.taxAmount)))throw Error('Every invoice line requires an evidenced SKU, quantity, unit price and tax amount.');
  const tax=sumMoney(lines.map(line=>line.taxAmount));
  if(tax>0 && source.pricesIncludeTax===undefined)throw Error('Invoice tax-inclusive/exclusive price basis must be verified in staging.');
  const items=lines.map((line,index)=>{
    const matched=products.filter(p=>p.active && [p.sku,p.mfn,p.mfn1].some(alias=>alias && alias.toLowerCase()===line.sku.toLowerCase()));
    if(matched.length!==1)throw Error('Invoice SKU must match one catalog product before posting.');
    return {id:line.id||`LINE-${index+1}`,sku:matched[0].sku,productName:line.productName||matched[0].name,quantity:line.quantity,sellingPrice:line.unitPrice,lineSubtotal:line.lineSubtotal,
      discount:line.discount,taxAmount:line.taxAmount,snapshotUnitCost:0,costEvidence:'UNKNOWN' as const,returnedQuantity:0};
  });
  const calculated=sumMoney([...items.map(line=>sumMoney([line.lineSubtotal??line.quantity*line.sellingPrice,-line.discount,source!.pricesIncludeTax?0:line.taxAmount])),source.shippingFee||0]);
  if(source.totalAmount===undefined || toPaise(calculated)!==toPaise(source.totalAmount))throw Error('All invoice lines, discount, tax and shipping must equal the printed invoice total.');
  const order:Order={id:createRecordId('ORD-INV'),channelOrderId:source.orderId||source.invoiceNumber!,marketplace:(source.marketplace||'Other') as Marketplace,currency:'INR',orderDate:source.orderDate,taxInvoiceDate:source.orderDate,
    status:'CONFIRMED',customerName:source.customerName||'',customerCity:source.customerCity||'',customerState:source.customerState||'',items,
    pricesIncludeTax:source.pricesIncludeTax,shippingFeeCharged:source.shippingFee||0,shippingTaxAmount:source.shippingTaxAmount,marketplaceChargesEstimate:0,feeEstimateStatus:'NOT_CONFIGURED',sourceTotal:money(source.totalAmount),notes:`Invoice source: ${fileName}`};
  if(!orderSchema.safeParse(order).success)throw Error('Invoice contains invalid dates, precision or financial fields.');
  return order;
}
