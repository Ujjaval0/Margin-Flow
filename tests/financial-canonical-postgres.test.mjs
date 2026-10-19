import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const load=createRequire(import.meta.url)('./helpers/load-app.cjs');
const pg=new PGlite({extensions:{pgcrypto}});
const client={query:(sql,params)=>pg.query(sql,params),release(){}};
let owner,other,service,persistence;
after(async()=>pg.close());
test('production migrations and canonical financial workflows execute against disposable PostgreSQL',async()=>{
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for(const file of fs.readdirSync('production-supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) {
    try{await pg.exec(fs.readFileSync('production-supabase/migrations/'+file,'utf8'));}
    catch(error){throw Error('Migration '+file+': '+error.message);}
  }
  const users=(await pg.query(`WITH a AS(INSERT INTO auth.users(id) VALUES(gen_random_uuid()),(gen_random_uuid()) RETURNING id)
    INSERT INTO user_accounts(id,auth_user_id,name,email,account_type) SELECT gen_random_uuid(),id,'Fixture',id::text||'@example.test','BRAND_OWNER' FROM a RETURNING id`)).rows;
  [owner,other]=users.map(u=>u.id);
  const mocks={'@/lib/db':{ensureMarketplaceTables:async()=>{},pool:{connect:async()=>client},query:client.query}};
  service=load('src/lib/ledger-records.ts',mocks);
  persistence=load('src/lib/integrations/order-persistence.ts',mocks);
  const command=async(id,body,who=owner)=>{await pg.exec('BEGIN');try{const data=await service.executeLedgerCommand(client,who,id,body);await pg.exec('COMMIT');return data;}catch(error){await pg.exec('ROLLBACK');throw error;}};
  const supplier={id:'SUP-SAME',name:'Fixture supplier',contactPerson:'',email:'',phone:'',address:''};
  await command('supplier',{action:'save',collection:'suppliers',record:supplier});
  await command('supplier',{action:'save',collection:'suppliers',record:supplier},other);
  await pg.query(`INSERT INTO products(user_id,display_id,sku,name,category,brand,current_cost_price,stock_quantity,active)
    VALUES($1,'P','SKU','Fixture','Other','Fixture',40,20,true)`,[owner]);
  await pg.query(`INSERT INTO product_cost_history(product_id,sku,valid_from,cost_price) SELECT id,sku,'2026-01-01',40 FROM products WHERE user_id=$1`,[owner]);
  const bill={id:'PUR',supplierId:supplier.id,supplierName:supplier.name,invoiceNumber:'INV',invoiceDate:'2026-10-01',sku:'SKU',quantity:2,unitCost:40,taxes:14.4,totalAmount:94.4,paymentStatus:'PENDING',paidAmount:0};
  let data=await command('purchase',{action:'save',collection:'purchases',record:bill});
  assert.equal(data.products[0].stockQuantity,22);
  data=await command('purchase',{action:'save',collection:'purchases',record:bill});
  assert.equal(data.products[0].stockQuantity,22);
  data=await command('pay',{action:'paySupplier',id:'PAY',supplierId:supplier.id,date:'2026-10-02',amount:50,paymentMethod:'UPI',reference:'real-ref'});
  assert.equal(data.purchases[0].paidAmount,50);assert.equal(data.purchases[0].paymentStatus,'PARTIAL');assert.equal(data.suppliers[0].totalPaid,50);
  assert.equal(data.supplierPayments[0].allocations[0].amount,50);
  data=await command('cost',{action:'productCost',sku:'SKU',cost:45,date:'2026-10-03',reason:'Source invoice'});
  assert.equal(data.products[0].currentCostPrice,45);assert.equal(data.products[0].costHistory.length,2);
  const order={id:'ORD',channelOrderId:'EXTERNAL',marketplace:'WooCommerce',currency:'INR',orderDate:'2026-10-01',revenueRecognisedDate:'2026-10-01',status:'DELIVERED',customerName:'',customerCity:'',customerState:'',shippingFeeCharged:0,marketplaceChargesEstimate:0,
    items:[{id:'L1',sku:'SKU',productName:'Fixture',quantity:1,sellingPrice:100,discount:0,taxAmount:0,snapshotUnitCost:0,costEvidence:'UNKNOWN',returnedQuantity:0},{id:'L2',sku:'SKU',productName:'Fixture',quantity:1,sellingPrice:100,discount:0,taxAmount:0,snapshotUnitCost:0,costEvidence:'UNKNOWN',returnedQuantity:0}]};
  await persistence.upsertOrders(owner,[order]);
  data=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  assert.equal(data.orders[0].items[0].snapshotUnitCost,40);assert.equal(data.orders[0].items[0].costEvidence,'RECORDED');
  const returned={id:'RET',orderId:'ORD',channelOrderId:'EXTERNAL',marketplace:'WooCommerce',returnDate:'2026-10-04',returnType:'CUSTOMER_RETURN',returnReason:'',sku:'SKU',quantity:1,condition:'SELLABLE',restockStatus:'PENDING_RESTOCK',returnShippingCost:0,customerReturnFee:5,otherReturnCosts:0,inventoryRecoveryValue:0,lossAmount:0};
  data=await command('return',{action:'save',collection:'returns',record:returned});assert.equal(data.products[0].stockQuantity,22);
  data=await command('restock',{action:'restock',id:'RET',date:'2026-10-05'});assert.equal(data.products[0].stockQuantity,23);
  data=await command('restock',{action:'restock',id:'RET',date:'2026-10-05'});assert.equal(data.products[0].stockQuantity,23);
  assert.equal(data.orders[0].items.reduce((sum,item)=>sum+item.returnedQuantity,0),1);
  assert.equal(data.auditLogs.some(log=>log.newValue.includes('PENDING_RESTOCK')),true);
  await assert.rejects(command('bad',{action:'save',collection:'returns',record:{...returned,id:'WRONG',quantity:3}}));
  await assert.rejects(command('supplier-delete',{action:'deleteSupplier',id:supplier.id}));
  const claim={id:'CLAIM',orderId:'ORD',marketplace:'WooCommerce',claimType:'FEE_DISPUTE',claimDate:'2026-10-04',amountClaimed:80,amountRecovered:30,status:'PARTIALLY_RECOVERED',recoveryDate:'2026-10-05',recoveries:[{id:'REC-1',date:'2026-10-05',amount:30}]};
  data=await command('claim',{action:'save',collection:'claims',record:claim});
  const oldClaim=data.claims[0];
  data=await command('claim-more',{action:'save',collection:'claims',expected:oldClaim,record:{...oldClaim,amountRecovered:50,status:'CLOSED',recoveryDate:'2026-11-03',recoveries:[...oldClaim.recoveries,{id:'REC-2',date:'2026-11-03',amount:20}]}});
  const {getOrderFinancialFacts}=load('src/domain/order-financials.ts');
  assert.equal(getOrderFinancialFacts(data.orders[0],data.returns,[],data.claims,'2026-10-31').claimRecovery,30);
  assert.equal(getOrderFinancialFacts(data.orders[0],data.returns,[],data.claims,'2026-11-30').claimRecovery,50);
  assert.equal(data.orders[0].status,'PARTIALLY_RETURNED','closing a fee claim preserves fulfillment');
  await assert.rejects(command('erase-recovery',{action:'save',collection:'claims',expected:data.claims[0],record:{...data.claims[0],amountRecovered:10,recoveries:[{id:'REC-X',date:'2026-11-03',amount:10}]}}));
  const receipt={id:'BANK-1',orderId:'ORD',marketplace:'WooCommerce',settlementDate:'2026-10-07',settlementBatchId:'BANK',grossAmount:200,deductions:[],tcsTdsTax:0,netSettlement:200,evidenceType:'BANK_RECEIPT',reconciliationStatus:'PENDING_RECON'};
  await persistence.upsertSettlements(owner,[receipt]);
  await assert.rejects(persistence.upsertSettlements(owner,[{...receipt,id:'MUST-ROLLBACK'},{...receipt,settlementBatchId:'DIFFERENT'}]));
  assert.equal(Number((await pg.query("SELECT count(*) FROM settlements WHERE user_id=$1 AND display_id='MUST-ROLLBACK'",[owner])).rows[0].count),0);
  const {archiveRecords,applyArchivePatch}=load('src/domain/recycle-bin.ts');
  const {persistArchivePatch}=load('src/lib/recycle-persistence.ts',mocks);
  data=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  const patch=archiveRecords(data,'returns',['RET']);
  await pg.exec('BEGIN');await persistArchivePatch(client,owner,patch,false);await pg.exec('COMMIT');
  let archived=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  assert.equal(archived.returns.length,0);assert.equal(archived.products[0].stockQuantity,22);
  applyArchivePatch(archived,patch,true);
  await pg.exec('BEGIN');await persistArchivePatch(client,owner,patch,true);await pg.exec('COMMIT');
  data=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  assert.equal(data.returns.length,1);assert.equal(data.products[0].stockQuantity,23);
  const catalog=load('src/lib/catalog-persistence.ts',mocks);
  const product={id:'P-ALIAS',sku:'MASTER',name:'Alias fixture',category:'Other',brand:'Fixture',currentCostPrice:0,stockQuantity:4,active:true,supplierId:supplier.id,channelAliases:{WooCommerce:'CHANNEL-SKU'},costHistory:[{validFrom:'2026-01-01',costPrice:0,notes:'Evidenced free stock'}]};
  await pg.exec('BEGIN');await catalog.persistCatalog(client,owner,[product]);await pg.exec('COMMIT');
  await pg.exec('BEGIN');await catalog.persistCatalog(client,owner,[{...product,name:'Updated alias fixture'}]);await pg.exec('COMMIT');
  assert.equal((await pg.query("SELECT name FROM products WHERE user_id=$1 AND sku='MASTER'",[owner])).rows[0].name,'Updated alias fixture');
  await persistence.upsertOrders(owner,[{...order,id:'ORD-ALIAS',channelOrderId:'EXTERNAL-ALIAS',items:[{...order.items[0],sku:'CHANNEL-SKU'}]}]);
  data=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  const alias=data.orders.find(o=>o.id==='ORD-ALIAS').items[0];assert.equal(alias.sku,'MASTER');assert.equal(alias.snapshotUnitCost,0);assert.equal(alias.costEvidence,'RECORDED');
  const financial={...receipt,id:'FEE-EVENT',orderId:'ORD-ALIAS',grossAmount:100,netSettlement:88,settlementDate:'2026-10-06',evidenceType:'FINANCIAL_EVENT',feeCoverage:'PARTIAL',deductions:[{category:'COMMISSION',name:'Source referral',amount:10,gstAmount:0}],tcsTax:1,tdsTax:1,tcsTdsTax:2};
  await persistence.upsertSettlements(owner,[financial]);
  const clearing={...financial,id:'BANK-CLEAR',evidenceType:'BANK_RECEIPT',feeCoverage:'COMPLETE',settlementDate:'2026-10-07'};
  await assert.rejects(persistence.upsertSettlements(owner,[clearing]),'unlinked repeated fees must not post twice');
  await persistence.upsertSettlements(owner,[{...clearing,financialEventIds:[financial.id]}]);
  await assert.rejects(persistence.upsertSettlements(owner,[{...clearing,id:'DUP-CLEAR',financialEventIds:[financial.id]}]));
  data=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  const cleared=getOrderFinancialFacts(data.orders.find(o=>o.id==='ORD-ALIAS'),data.returns,data.settlements,data.claims);
  assert.equal(cleared.cash,88);assert.equal(cleared.fees,10);assert.equal(cleared.expectedPayout,90);assert.equal(cleared.outstanding,0);
  const doc={id:'DOC-MULTI',fileName:'fixture.txt',fileType:'INVOICE',uploadDate:'2026-10-07',status:'STAGED_NEEDS_REVIEW',currency:'INR',pricesIncludeTax:false,rawTextPreview:'Source fixture',
    extractedData:{orderId:{value:'INVOICE-MULTI',confidence:1,provenance:'MANUALLY_ENTERED'},orderDate:{value:'2026-10-01',confidence:1,provenance:'MANUALLY_ENTERED'},totalAmount:{value:354,confidence:1,provenance:'MANUALLY_ENTERED'}},
    lineItems:[{id:'LINE-A',sku:'SKU',productName:'First',quantity:1,unitPrice:100,discount:0,taxAmount:18},{id:'LINE-B',sku:'SKU',productName:'Second',quantity:1,unitPrice:200,discount:0,taxAmount:36}],arithmeticValidation:{passed:true,calculatedTotal:354,declaredTotal:354,difference:0,message:'Fixture'},catalogValidation:{skuMatched:true}};
  await command('document',{action:'save',collection:'aiDocuments',record:doc});
  data=await command('approve',{action:'approveDocument',id:doc.id});
  assert.equal(data.orders.find(o=>o.channelOrderId==='INVOICE-MULTI').items.length,2);
  const importer=(await pg.query(`WITH a AS(INSERT INTO auth.users VALUES(gen_random_uuid()) RETURNING id) INSERT INTO user_accounts(id,auth_user_id,name,email,account_type) SELECT gen_random_uuid(),id,'Import fixture',id::text||'@example.test','BRAND_OWNER' FROM a RETURNING id`)).rows[0].id;
  const snapshot=JSON.stringify({version:1,ownerId:importer,data});
  let imported=await command('opening',{action:'importSnapshot',snapshot},importer);
  assert.equal(imported.products.find(p=>p.sku==='SKU').stockQuantity,23,'opening stock must not replay old purchase/restock movements');
  assert.equal(imported.supplierPayments[0].allocations[0].amount,50);assert.equal(imported.suppliers[0].totalPaid,50,'opening paid balance and allocations count once');
  imported=await command('opening',{action:'importSnapshot',snapshot},importer);assert.equal(imported.orders.length,data.orders.length);
  await assert.rejects(command('other-import',{action:'importSnapshot',snapshot:JSON.stringify({version:1,ownerId:other,data})},other));
  await pg.query(`INSERT INTO orders(user_id,display_id,channel_order_id,marketplace,order_date,status,customer_name,customer_city,customer_state) SELECT $1,'PAGE-'||i,'PAGE-'||i,'Other','2026-10-01','PENDING','','','' FROM generate_series(1,2001) i`,[owner]);
  const complete=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,owner);
  assert.equal(complete.orders.length,data.orders.length+2001,'canonical projection has no 2000-row ceiling');
  assert.equal((await pg.query("SELECT to_regclass('v_order_profitability') AS legacy")).rows[0].legacy,null);
  await pg.exec(fs.readFileSync('production-supabase/verification/002_financial_readiness.sql','utf8'));
  const otherData=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,other);
  assert.equal(otherData.purchases.length,0);assert.equal(otherData.orders.length,0);assert.equal(otherData.suppliers.length,1);
});

test('documented fresh local bootstrap executes without demo seeds or stale financial views',async()=>{
  const local=new PGlite({extensions:{pgcrypto}});
  try {
    await local.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    const files=[...fs.readFileSync('database/00_run_all.sql','utf8').matchAll(/^\\ir (.+)$/gm)].map(m=>m[1].trim());
    assert.ok(files.includes('24_canonical_financial_books.sql'));assert.ok(files.includes('25_retire_legacy_financial_views.sql'));
    for(const file of files)try{await local.exec(fs.readFileSync('database/'+file,'utf8'));}catch(error){throw Error(file+': '+error.message);}
    assert.equal(Number((await local.query('SELECT count(*) AS count FROM orders')).rows[0].count),0);
    assert.equal((await local.query("SELECT to_regclass('v_order_profitability') AS legacy")).rows[0].legacy,null);
    assert.equal((await local.query("SELECT to_regclass('supplier_payment_allocations') AS allocations")).rows[0].allocations,'supplier_payment_allocations');
  }finally{await local.close();}
});
