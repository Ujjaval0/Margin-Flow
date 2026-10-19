import type { PoolClient } from 'pg';
import type { Product } from '@/domain/types';
import { ledgerDataSchema } from '@/domain/snapshot-validation';
import { appendFinancialAudit } from './ledger-records';

/** Catalog edits cannot silently reset inventory or replace dated cost evidence. */
export async function persistCatalog(client:PoolClient,owner:string,products:Product[]) {
  if(!products.length || products.length>1000 || new Set(products.map(p=>p.sku)).size!==products.length || new Set(products.map(p=>p.id)).size!==products.length)throw Error('Invalid catalog identities.');
  let inserted=0,updated=0;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner]);
  for(const candidate of products) {
    const parsed=ledgerDataSchema.shape.products.element.safeParse(candidate);if(!parsed.success)throw Error('Invalid catalog record.');
    const p=parsed.data as Product;
    const existing=await client.query('SELECT * FROM products WHERE user_id=$1 AND (sku=$2 OR display_id=$3) FOR UPDATE',[owner,p.sku,p.id]);
    if(existing.rows.length>1 || existing.rows.some(row=>row.deleted_at || row.sku!==p.sku || row.display_id!==p.id))throw Error('Catalog identity conflicts with an existing or archived product.');
    const old=existing.rows[0];
    if(old && (Number(old.stock_quantity)!==(p.stockQuantity||0) || Number(old.current_cost_price)!==p.currentCostPrice))throw Error('Use stock movements and dated cost corrections to change an existing product.');
    const supplier=p.supplierId?await client.query('SELECT id FROM suppliers WHERE user_id=$1 AND display_id=$2 AND deleted_at IS NULL',[owner,p.supplierId]):{rows:[]};
    if(p.supplierId && supplier.rows.length!==1)throw Error('Owned supplier not found.');
    let productId=old?.id;
    const values=[owner,p.id,p.sku,p.name,p.category,p.brand,p.currentCostPrice,p.stockQuantity||0,p.active,p.mfn||null,p.mfn1||null,p.weightGrams||null,supplier.rows[0]?.id||null];
    if(old) {
      await client.query('UPDATE products SET name=$4,category=$5,brand=$6,active=$7,mfn=$8,mfn1=$9,weight_grams=$10,supplier_id=$11,updated_at=NOW() WHERE user_id=$1 AND display_id=$2 AND sku=$3',[owner,p.id,p.sku,p.name,p.category,p.brand,p.active,p.mfn||null,p.mfn1||null,p.weightGrams||null,supplier.rows[0]?.id||null]);updated++;
    } else {
      const created=await client.query('INSERT INTO products(user_id,display_id,sku,name,category,brand,current_cost_price,stock_quantity,active,mfn,mfn1,weight_grams,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',values);
      productId=created.rows[0].id;inserted++;
      const windows=[...p.costHistory].sort((a,b)=>a.validFrom.localeCompare(b.validFrom));
      for(let i=0;i<windows.length;i++) {
        const h=windows[i];if(h.validTo && h.validTo<h.validFrom || i && (!windows[i-1].validTo || windows[i-1].validTo!>=h.validFrom))throw Error('Cost windows overlap or are invalid.');
        await client.query('INSERT INTO product_cost_history(product_id,sku,valid_from,valid_to,cost_price,notes) VALUES($1,$2,$3,$4,$5,$6)',[productId,p.sku,h.validFrom,h.validTo||null,h.costPrice,h.notes||null]);
      }
    }
    await client.query('DELETE FROM product_channel_aliases WHERE product_id=$1',[productId]);
    for(const [marketplace,alias] of Object.entries(p.channelAliases))if(alias)await client.query('INSERT INTO product_channel_aliases(product_id,marketplace,alias_sku) VALUES($1,$2,$3)',[productId,marketplace,alias]);
    await appendFinancialAudit(client,owner,'PRODUCT_COST',p.id,old||null,p,'Catalog and source cost evidence saved');
  }
  return {inserted,updated};
}
