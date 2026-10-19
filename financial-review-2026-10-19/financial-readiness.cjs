// Read-only affected-record inventory. No migration, repair, seed or reset is executed.
const fs=require('node:fs');
const load=require('../tests/helpers/load-app.cjs');
const {parseLedgerSnapshot}=load('src/domain/snapshot-validation.ts');
const {getOrderFinancialFacts,toPaise,sumMoney}=load('src/domain/order-financials.ts');
const {generateGeneralLedger}=load('src/domain/ledger-engine.ts');
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
async function main() {
  if(!args.includes('--owner') || !arg('--owner'))throw Error('An explicit owner is required.');
  const owner=arg('--owner');let data,client,pool;
  try {
    if(args.includes('--database')) {
      if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL without printing it.');
      const {Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:20000});
      client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      data=await load('src/lib/canonical-ledger.ts').readCanonicalLedger(client,owner);
      await client.query('COMMIT');
    } else {
      if(!args.includes('--snapshot'))throw Error('Choose --snapshot <file> or --database.');
      data=parseLedgerSnapshot(fs.readFileSync(arg('--snapshot'),'utf8'),owner);if(!data)throw Error('Invalid snapshot or owner mismatch.');
    }
    const issues=new Map(),add=(code,count=1)=>issues.set(code,(issues.get(code)||0)+count);
    for(const order of data.orders) {
      const facts=getOrderFinancialFacts(order,data.returns,data.settlements,data.claims);
      for(const issue of facts.issues)add(issue);
      if(!order.currency)add('Legacy currency requires evidence');
      if(order.items.some(i=>i.taxAmount>0)&&!order.gstRegistrationType)add('GST registration/tax-collection treatment unverified');
    }
    for(const bill of data.purchases) {
      if(toPaise(sumMoney([bill.lineSubtotal??bill.quantity*bill.unitCost,bill.taxes]))!==toPaise(bill.totalAmount))add('Purchase total mismatch');
      if(bill.paymentStatus==='PARTIAL'&&bill.paidAmount===undefined)add('Partial paid amount unresolved');
      if(bill.taxes>0&&bill.gstCreditStatus!=='INELIGIBLE'&&!(bill.gstCreditStatus==='ELIGIBLE'&&bill.gstEvidenceReference))add('Purchase ITC eligibility unresolved');
    }
    for(const payment of data.supplierPayments||[])if(payment.allocationStatus==='UNRESOLVED')add('Supplier payment allocation unresolved');
    for(const issue of data.financialIssues||[])add(issue);
    const journal=generateGeneralLedger(data.orders,data.returns,data.settlements,data.purchases,data.expenses,data.supplierPayments||[],data.claims);
    for(const entry of journal){if(!entry.isBalanced)add('Unbalanced journal');for(const issue of entry.issues||[])add(issue);}
    console.log(JSON.stringify({readOnly:true,authenticity:'UNVERIFIED: sample amounts do not establish real transactions or statutory eligibility',
      result:issues.size?'REQUIRES_SOURCE_RECONCILIATION':'NO_REPRODUCED_FAILURE_IN_SUPPLIED_SUPPORTED_FACTS',
      counts:Object.fromEntries(Object.entries(data).filter(([,v])=>Array.isArray(v)).map(([key,v])=>[key,v.length])),
      controlTotals:{bankReceiptsPaise:data.settlements.filter(s=>s.evidenceType!=='FINANCIAL_EVENT').reduce((sum,s)=>sum+toPaise(s.netSettlement),0),physicalStockUnits:data.products.reduce((sum,p)=>sum+(p.stockQuantity||0),0)},
      findings:Object.fromEntries(issues)},null,2));
  } finally {if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}if(pool)await pool.end();}
}
main().catch(()=>{console.error('Read-only inventory failed. Check input, ownership and database readiness. No repair or migration was attempted.');process.exitCode=1;});
