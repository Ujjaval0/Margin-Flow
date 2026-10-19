const fs=require('fs');
for(const [name,schema,mapper,variable] of [['shopify','ShopifyOrderWebhookSchema','mapShopifyOrderToDomain','raw'],['woocommerce','WooCommerceOrderWebhookSchema','mapWooCommerceOrderToDomain','rawOrder']]) {
  const path=`src/app/api/integrations/${name}/sync/route.ts`;let s=fs.readFileSync(path,'utf8');
  const a=s.indexOf('      const domainOrders = rawOrders.map('),b=s.indexOf('      const dbResult =',a);
  if(a<0||b<0)throw Error(name);
  s=s.slice(0,a)+`      const domainOrders = rawOrders.map((raw:any) => ${mapper}(${schema}.parse(raw)));\n\n`+s.slice(b);fs.writeFileSync(path,s);
}
const path='src/app/api/integrations/generic/sync/route.ts';let s=fs.readFileSync(path,'utf8');
const a=s.indexOf('      const domainOrders'),b=s.indexOf('      const dbResult',a);
if(a<0||b<0)throw Error('generic markers');
s="import { mapGenericSourceOrder } from '@/lib/integrations/generic-order';\n"+s.slice(0,a)+"      const domainOrders = rawOrders.map((source:any)=>mapGenericSourceOrder(source,marketplace));\n\n"+s.slice(b);
fs.writeFileSync(path,s);
