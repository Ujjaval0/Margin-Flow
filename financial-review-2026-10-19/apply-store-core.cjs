const fs=require('fs'),file='src/domain/store.tsx';let s=fs.readFileSync(file,'utf8');
function replace(name,next,body){const a=s.indexOf('  const '+name+' = useCallback'),b=s.indexOf('  const '+next,a+1);if(a<0||b<0)throw Error(name);s=s.slice(0,a)+body+'\n\n'+s.slice(b);}
replace('addOrder','syncExternalOrders',`  const addOrder = useCallback(async (order:Order) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    if(liveLedger.current.orders.some(o=>o.marketplace===order.marketplace&&o.channelOrderId===order.channelOrderId))throw Error('Source order already exists; edit its existing record.');
    const normalized={...order,currency:'INR',physicalDispatchRecorded:['SHIPPED','DELIVERED','PARTIALLY_RETURNED','RETURNED','CUSTOMER_RETURN','DAMAGED_RETURN','RTO'].includes(order.status)};
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orders:[normalized]})});
    const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Order could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    const saved=liveLedger.current.orders.find(o=>o.marketplace===order.marketplace&&o.channelOrderId===order.channelOrderId);if(!saved)throw Error('Order saved but refresh failed; reload before retrying.');return saved;
  },[refreshFromDatabase]);`);
replace('updateOrder','deleteOrder',`  const updateOrder = useCallback(async (order:Order) => {
    const owner=verifiedOwner.current;if(!owner)throw Error('Authentication required.');
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orders:[order]})});
    const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Order could not be saved.');
    if(verifiedOwner.current!==owner)throw Error('Account changed.');await refreshFromDatabase();
    return liveLedger.current.orders.find(o=>o.id===order.id)||order;
  },[refreshFromDatabase]);`);
const a=s.indexOf('  const marketplaceBreakdown = useMemo'),b=s.indexOf('  const settlementAging = useMemo',a);
s=s.slice(0,a)+`  const marketplaceBreakdown = useMemo(()=>periodMarketplace(financialContext,datePreset==='ALL'?undefined:dateRanges.current),[financialContext,datePreset,dateRanges]);
  const skuBreakdown = useMemo(()=>periodSku(financialContext,datePreset==='ALL'?undefined:dateRanges.current),[financialContext,datePreset,dateRanges]);

`+s.slice(b);
s=s.replace('reportDataset: currentDataset,',"reportDataset: {...currentDataset,financialContext,reportRange:datePreset==='ALL'?undefined:dateRanges.current},");
s=s.replace('calculateSettlementAging(currentDataset.orders, settlements, effectiveAnchorDate, returns, claims)','calculateSettlementAging(financialContext.orders, settlements, effectiveAnchorDate, returns, claims)');
fs.writeFileSync(file,s);
