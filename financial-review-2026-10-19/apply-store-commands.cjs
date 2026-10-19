const fs=require('fs');
const file='src/domain/store.tsx';let s=fs.readFileSync(file,'utf8');
function replace(name,next,body){const a=s.indexOf('  const '+name+' = useCallback'),b=s.indexOf('  const '+next,a+1);if(a<0||b<0)throw Error(name);s=s.slice(0,a)+body+'\n\n'+s.slice(b);}
const marker='  // Actions\n';
if(!s.includes('const commitFinancialCommand ='))s=s.replace(marker,`  const commitFinancialCommand = useCallback(async (command: LedgerCommand) => {
    const owner=verifiedOwner.current;
    if(!owner) throw Error('Authentication required to save financial records.');
    const requestId=command.action==='save' && command.expected===undefined ? 'CREATE-'+command.collection+'-'+command.record.id
      : command.action==='paySupplier' ? command.id : createRecordId('CMD');
    const response=await fetch('/api/ledger-records',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({requestId,command})});
    const saved=await response.json();
    if(!response.ok || saved.success!==true) throw Error(saved.error||'Financial record could not be saved.');
    if(verifiedOwner.current!==owner) throw Error('Account changed while saving.');
    applyLedgerChange(saved.data);
  },[applyLedgerChange]);
  const saveOperatingRecord = useCallback(async (collection: OperatingCollection,record: any,edit=false) => {
    const expected=edit?(liveLedger.current[collection] as any[]).find(row=>row.id===record.id):undefined;
    if(edit && !expected) throw Error('Record no longer exists.');
    await commitFinancialCommand({action:'save',collection,record,expected});
  },[commitFinancialCommand]);

${marker}`);
replace('updateOrderStatus','updateOrder',`  const updateOrderStatus = useCallback(async (orderId: string,status: Order['status']) => {
    await commitFinancialCommand({action:'orderStatus',ids:[orderId],status,date:businessDate()});
  },[commitFinancialCommand]);`);
replace('bulkUpdateOrderStatus','calculateClaimDeadline',`  const bulkUpdateOrderStatus = useCallback(async (ids:string[],status:Order['status']) => {
    await commitFinancialCommand({action:'orderStatus',ids,status,date:businessDate()});
  },[commitFinancialCommand]);`);
replace('addReturn','updateReturn',`  const addReturn = useCallback(async (record:ReturnRecord) => {
    await saveOperatingRecord('returns',record);
  },[saveOperatingRecord]);`);
replace('updateReturn','restockReturn',`  const updateReturn = useCallback(async (record:ReturnRecord) => {
    await saveOperatingRecord('returns',record,true);
  },[saveOperatingRecord]);`);
replace('restockReturn','deleteReturn',`  const restockReturn = useCallback(async (id:string) => {
    await commitFinancialCommand({action:'restock',id});
  },[commitFinancialCommand]);`);
replace('addClaim','updateClaim',`  const addClaim = useCallback(async (claim:Claim) => { await saveOperatingRecord('claims',claim); },[saveOperatingRecord]);`);
replace('updateClaim','deleteClaim',`  const updateClaim = useCallback(async (id:string,amountRecovered:number,status:Claim['status']) => {
    const claim=liveLedger.current.claims.find(c=>c.id===id); if(!claim) throw Error('Claim not found.');
    await saveOperatingRecord('claims',{...claim,amountRecovered,status,recoveryDate:amountRecovered>0?businessDate():claim.recoveryDate},true);
  },[saveOperatingRecord]);`);
replace('editClaim','deleteClaims',`  const editClaim = useCallback(async (id:string,updates:Partial<Pick<Claim,'claimType'|'claimDate'|'amountClaimed'|'amountRecovered'|'status'|'notes'|'marketplace'>>) => {
    const claim=liveLedger.current.claims.find(c=>c.id===id);if(!claim)throw Error('Claim not found.');
    await saveOperatingRecord('claims',{...claim,...updates},true);
  },[saveOperatingRecord]);`);
replace('updateProductCost','addProduct',`  const updateProductCost = useCallback(async (sku:string,cost:number,reason:string) => {
    await commitFinancialCommand({action:'productCost',sku,cost,reason,date:businessDate()});
  },[commitFinancialCommand]);`);
replace('addExpense','updateExpense',`  const addExpense = useCallback(async (record:Expense) => {await saveOperatingRecord('expenses',record);},[saveOperatingRecord]);`);
replace('updateExpense','deleteExpense',`  const updateExpense = useCallback(async (record:Expense) => {await saveOperatingRecord('expenses',record,true);},[saveOperatingRecord]);`);
replace('addPurchase','addSupplier',`  const addPurchase = useCallback(async (record:PurchaseBill) => {await saveOperatingRecord('purchases',record);},[saveOperatingRecord]);`);
replace('addSupplier','updateSupplier',`  const addSupplier = useCallback(async (record:Supplier) => {await saveOperatingRecord('suppliers',record);},[saveOperatingRecord]);`);
replace('updateSupplier','deleteSupplier',`  const updateSupplier = useCallback(async (record:Supplier) => {await saveOperatingRecord('suppliers',record,true);},[saveOperatingRecord]);`);
replace('deleteSupplier','recordSupplierPayment',`  const deleteSupplier = useCallback(async (id:string) => {await commitFinancialCommand({action:'deleteSupplier',id});},[commitFinancialCommand]);`);
replace('recordSupplierPayment','updateStagedDocumentField',`  const recordSupplierPayment = useCallback(async (supplierId:string,amount:number,paymentMethod:string,reference:string,notes?:string) => {
    await commitFinancialCommand({action:'paySupplier',id:createRecordId('PAY'),supplierId,amount,paymentMethod,reference,notes,date:businessDate()});
  },[commitFinancialCommand]);`);
replace('updateStagedDocumentField','addStagedDocument',`  const updateStagedDocumentField = useCallback(async (id:string,field:keyof AIStagedDocument['extractedData'],value:any) => {
    const doc=liveLedger.current.aiDocuments.find(d=>d.id===id);if(!doc)throw Error('Document not found.');
    const extractedData={...doc.extractedData,[field]:{...doc.extractedData[field],value,confidence:1,provenance:'MANUALLY_MODIFIED' as const}};
    const v=(key:keyof AIStagedDocument['extractedData'])=>Number(extractedData[key]?.value||0);
    await saveOperatingRecord('aiDocuments',{...doc,extractedData,arithmeticValidation:validateDocumentArithmetic(v('quantity'),v('unitPrice'),v('discount'),v('taxAmount'),v('totalAmount'))},true);
  },[saveOperatingRecord]);`);
replace('addStagedDocument','addStagedDocuments',`  const addStagedDocument = useCallback(async (doc:AIStagedDocument) => {
    if(liveLedger.current.aiDocuments.some(d=>d.id===doc.id))return;
    await saveOperatingRecord('aiDocuments',doc);
  },[saveOperatingRecord]);`);
replace('addStagedDocuments','approveStagedDocument',`  const addStagedDocuments = useCallback(async (docs:AIStagedDocument[]) => {for(const doc of docs)await addStagedDocument(doc);},[addStagedDocument]);`);
replace('approveStagedDocument','rejectStagedDocument',`  const approveStagedDocument = useCallback(async (id:string) => {await commitFinancialCommand({action:'approveDocument',id});},[commitFinancialCommand]);`);
replace('rejectStagedDocument','batchApproveStagedDocuments',`  const rejectStagedDocument = useCallback(async (id:string) => {
    const doc=liveLedger.current.aiDocuments.find(d=>d.id===id);if(!doc)throw Error('Document not found.');
    await saveOperatingRecord('aiDocuments',{...doc,status:'REJECTED'},true);
  },[saveOperatingRecord]);`);
replace('deleteStagedDocument','resetLedgerToDefaults',`  const deleteStagedDocument = useCallback(async (id:string) => {await rejectStagedDocument(id);},[rejectStagedDocument]);`);
// Local time suffixes must not become primary financial identities.
s=s.replace(/`AUD-\$\{Date\.now\(\)\}`/g,'createRecordId("AUD")');
// Remove recovered-only merge: canonical reads already include recovered and ordinary records.
const a=s.indexOf('      const recoveredResponse = await fetch('),b=s.indexOf('\n    } catch {',a);
if(a>=0&&b>=0)s=s.slice(0,a)+s.slice(b);
fs.writeFileSync(file,s);
