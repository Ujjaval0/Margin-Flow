import type { PoolClient } from "pg";
import type { LedgerData } from "@/domain/snapshot-validation";
import { query } from "@/lib/db";

/** Recover browser-origin records into the canonical tables, on the archive transaction. */
export async function recoverMissingRecords(client: PoolClient, owner: string, data: LedgerData) {
  const orderId = async (record: { orderId: string; marketplace: string }) => {
    const result = await client.query("SELECT id FROM orders WHERE user_id = $1 AND marketplace = $2 AND (display_id = $3 OR channel_order_id = $3) AND deleted_at IS NULL", [owner, record.marketplace, record.orderId]);
    if (result.rows.length !== 1) throw Error("Recovery requires an unambiguous active parent order.");
    return result.rows[0].id;
  };
  for (const record of data.returns) {
    const parent = await orderId(record);
    const existing = await client.query("SELECT id FROM return_records WHERE order_id = $1 AND display_id = $2", [parent, record.id]);
    if (!existing.rows.length) await client.query(`INSERT INTO return_records (display_id,order_id,channel_order_id,marketplace,return_date,received_date,awb_number,return_type,return_reason,sku,product_name,quantity,condition,restock_status,claim_deadline,return_shipping_cost,customer_return_fee,other_return_costs,inventory_recovery_value,loss_amount,notes,recovered_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())`, [record.id,parent,record.channelOrderId,record.marketplace,record.returnDate,record.receivedDate || null,record.awbNumber || null,record.returnType,record.returnReason,record.sku,record.productName || null,record.quantity,record.condition,record.restockStatus || null,record.claimDeadline || null,record.returnShippingCost,record.customerReturnFee,record.otherReturnCosts,record.inventoryRecoveryValue,record.lossAmount,record.notes || null]);
    await client.query("UPDATE return_records SET recovered_at = NOW() WHERE order_id = $1 AND display_id = $2", [parent, record.id]);
  }
  for (const record of data.claims) {
    const parent = await orderId(record);
    const existing = await client.query("SELECT id FROM claims WHERE order_id = $1 AND display_id = $2", [parent, record.id]);
    let returnedId: string | null = null;
    if (record.returnId) {
      const returned = await client.query("SELECT id FROM return_records WHERE order_id = $1 AND display_id = $2 AND deleted_at IS NULL", [parent, record.returnId]);
      if (returned.rows.length !== 1) throw Error("Linked return must be restored first.");
      returnedId = returned.rows[0].id;
    }
    if (!existing.rows.length) await client.query(`INSERT INTO claims (display_id,order_id,return_id,marketplace,claim_type,claim_date,amount_claimed,amount_recovered,status,recovery_date,notes,recovered_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`, [record.id,parent,returnedId,record.marketplace,record.claimType,record.claimDate,record.amountClaimed,record.amountRecovered,record.status,record.recoveryDate || null,record.notes || null]);
    await client.query("UPDATE claims SET recovered_at = NOW() WHERE order_id = $1 AND display_id = $2", [parent, record.id]);
    for (const document of record.supportingDocuments || []) await client.query("INSERT INTO claim_documents (claim_id, document_url) SELECT c.id, $3 FROM claims c WHERE c.order_id = $1 AND c.display_id = $2 AND NOT EXISTS (SELECT 1 FROM claim_documents d WHERE d.claim_id = c.id AND d.document_url = $3)", [parent, record.id, document]);
  }
  for (const record of data.returns) if (record.claimId) {
    const parent = await orderId(record);
    await client.query("UPDATE return_records r SET claim_id = c.id FROM claims c WHERE r.order_id = $1 AND r.display_id = $2 AND c.order_id = $1 AND c.display_id = $3", [parent, record.id, record.claimId]);
  }
  for (const record of data.expenses) await client.query(`INSERT INTO expenses (user_id,display_id,expense_date,category,description,amount,vendor,payment_method,is_recurring,marketplace,attributed_sku,supporting_document,notes,recovered_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()) ON CONFLICT (user_id,display_id) DO UPDATE SET recovered_at = NOW()`, [owner,record.id,record.date,record.category,record.description,record.amount,record.vendor,record.paymentMethod,record.isRecurring,record.marketplace || null,record.attributedSku || null,record.supportingDocument || null,record.notes || null]);
  for (const record of data.settlements) {
    const parent = await orderId(record);
    const existing = await client.query("SELECT id FROM settlements WHERE user_id = $1 AND display_id = $2", [owner, record.id]);
    if (existing.rows.length) continue;
    const inserted = await client.query(`INSERT INTO settlements (user_id,display_id,settlement_batch_id,marketplace,settlement_date,order_id,gross_amount,tcs_tds_tax,net_settlement,reconciliation_status,discrepancy_amount,bank_tx_ref,source_document)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [owner,record.id,record.settlementBatchId,record.marketplace,record.settlementDate,parent,record.grossAmount,record.tcsTdsTax,record.netSettlement,record.reconciliationStatus,record.discrepancyAmount ?? null,record.bankTxRef || null,record.sourceDocument || null]);
    for (const deduction of record.deductions) await client.query("INSERT INTO settlement_deductions (settlement_id,category,name,amount) VALUES ($1,$2,$3,$4)", [inserted.rows[0].id,deduction.category,deduction.name,deduction.amount]);
  }
}

/** Read only recovered records; Phase 2 still owns migration of unrelated browser-only CRUD. */
export async function getRecoveredRecords(owner: string) {
  const [returns, claims, expenses] = await Promise.all([
    query(`SELECT r.*, o.display_id AS order_display_id, c.display_id AS claim_display_id FROM return_records r JOIN orders o ON o.id = r.order_id LEFT JOIN claims c ON c.id = r.claim_id AND c.deleted_at IS NULL WHERE o.user_id = $1 AND o.deleted_at IS NULL AND r.deleted_at IS NULL AND r.recovered_at IS NOT NULL`, [owner]),
    query(`SELECT c.*, o.display_id AS order_display_id, r.display_id AS return_display_id, ARRAY(SELECT document_url FROM claim_documents d WHERE d.claim_id = c.id) AS supporting_documents FROM claims c JOIN orders o ON o.id = c.order_id LEFT JOIN return_records r ON r.id = c.return_id AND r.deleted_at IS NULL WHERE o.user_id = $1 AND o.deleted_at IS NULL AND c.deleted_at IS NULL AND c.recovered_at IS NOT NULL`, [owner]),
    query("SELECT * FROM expenses WHERE user_id = $1 AND deleted_at IS NULL AND recovered_at IS NOT NULL", [owner]),
  ]);
  const date = (value: unknown) => value ? new Date(value as string).toISOString().slice(0, 10) : undefined;
  const convert = (row: Record<string, any>) => {
    const record: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) if (value !== null) record[key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
    record.id = row.display_id;
    for (const key of ["quantity", "returnShippingCost", "customerReturnFee", "otherReturnCosts", "inventoryRecoveryValue", "lossAmount", "amountClaimed", "amountRecovered", "amount"]) if (record[key] !== undefined) record[key] = Number(record[key]);
    for (const key of ["returnDate", "receivedDate", "claimDeadline", "claimDate", "recoveryDate"]) if (record[key]) record[key] = date(record[key]);
    if (row.order_display_id) record.orderId = row.order_display_id;
    if (row.claim_display_id) record.claimId = row.claim_display_id; else delete record.claimId;
    if (row.return_display_id) record.returnId = row.return_display_id; else delete record.returnId;
    if (row.expense_date) record.date = date(row.expense_date);
    return record;
  };
  return { returns: returns.rows.map(convert), claims: claims.rows.map(convert), expenses: expenses.rows.map(convert) };
}
