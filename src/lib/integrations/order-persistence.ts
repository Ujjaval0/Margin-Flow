import { Order, OrderItem, Settlement, SettlementDeduction } from "@/domain/types";
import { query, ensureMarketplaceTables, pool } from "@/lib/db";
import crypto from "crypto";
import type { PoolClient } from "pg";

export interface OrderPersistenceResult {
  inserted: number;
  updated: number;
  orderIds: string[];
  insertedOrderIds: string[];
}

export interface SettlementPersistenceResult {
  inserted: number;
  updated: number;
  settlementIds: string[];
}

/**
 * Atomically upserts an array of orders and their line items into PostgreSQL within ACID transactions.
 * Satisfies TASK-3.5:
 * - Runs inside client.query("BEGIN...COMMIT/ROLLBACK") transactions
 * - ON CONFLICT (user_id, channel_order_id, marketplace) DO UPDATE
 * - Respects immutable snapshot_unit_cost invariant on order_items
 * - Appends immutable records to financial_audit_logs
 */
export async function upsertOrders(
  userId: string,
  orders: Order[],
  transactionClient?: PoolClient
): Promise<OrderPersistenceResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Multi-tenant invariant violation: userId is required for order persistence.");
  }

  if (!orders || orders.length === 0) {
    return { inserted: 0, updated: 0, orderIds: [], insertedOrderIds: [] };
  }

  await ensureMarketplaceTables();

  let inserted = 0;
  let updated = 0;
  const orderIds: string[] = [];
  const insertedOrderIds: string[] = [];

  if (orders.length > 1000 || orders.some(order => !order || !Array.isArray(order.items))) {
    throw new Error("Invalid order batch.");
  }
  const client = transactionClient || await pool.connect().catch((error) => {
    throw new Error("Order persistence failed.", { cause: error });
  });
  try {
  if (!transactionClient) await client.query("BEGIN");
  for (const order of orders) {
    const displayId = order.id || `ORD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const channelOrderId = order.channelOrderId || displayId;
    const marketplace = order.marketplace;
    const orderDate = order.orderDate || new Date().toISOString().split("T")[0];
    const status = order.status || "CONFIRMED";
    const customerName = order.customerName || "Customer";
    const customerCity = order.customerCity || "City";
    const customerState = order.customerState || "State";
    const shippingFeeCharged = order.shippingFeeCharged || 0;
    const marketplaceChargesEstimate = order.marketplaceChargesEstimate || 0;
    const notes = order.notes || `SP-API Synced | ${channelOrderId}`;

    const q = (text: string, params?: any[]) => client.query(text, params);

      // 1. Upsert Order Header with Tenant Isolation
      const orderUpsertSql = `
        INSERT INTO orders (
          id,
          user_id,
          display_id,
          channel_order_id,
          marketplace,
          order_date,
          status,
          customer_name,
          customer_city,
          customer_state,
          shipping_fee_charged,
          marketplace_charges_estimate,
          notes,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
        ON CONFLICT (user_id, channel_order_id, marketplace)
        DO UPDATE SET
          status = EXCLUDED.status,
          customer_name = EXCLUDED.customer_name,
          customer_city = EXCLUDED.customer_city,
          customer_state = EXCLUDED.customer_state,
          shipping_fee_charged = EXCLUDED.shipping_fee_charged,
          marketplace_charges_estimate = EXCLUDED.marketplace_charges_estimate,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        WHERE orders.deleted_at IS NULL
        RETURNING id, display_id, (xmax = 0) AS is_insert;
      `;

      const orderRes = await q(orderUpsertSql, [
        userId,
        displayId,
        channelOrderId,
        marketplace,
        orderDate,
        status,
        customerName,
        customerCity,
        customerState,
        shippingFeeCharged,
        marketplaceChargesEstimate,
        notes,
      ]);

      const dbOrder = orderRes.rows[0];
      if (!dbOrder) throw new Error("Archived order must be restored before synchronization.");
      const dbOrderId = dbOrder?.id;
      const isInsert = dbOrder?.is_insert;


      // 2. Upsert Order Items
      if (dbOrderId && Array.isArray(order.items)) {
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          const itemDisplayId = item.id || `ITEM-${displayId}-${i + 1}`;
          const sku = item.sku || "UNKNOWN-SKU";
          const productName = item.productName || "Product";
          const quantity = Math.max(1, item.quantity || 1);
          const sellingPrice = item.sellingPrice || 0;
          const discount = item.discount || 0;
          const taxAmount = item.taxAmount || 0;
          const snapshotUnitCost = item.snapshotUnitCost || 0;
          const returnedQuantity = item.returnedQuantity || 0;

          // Check if order_item exists
          const existingItemRes = await q(
            `SELECT id, snapshot_unit_cost FROM order_items WHERE order_id = $1 AND display_id = $2 LIMIT 1;`,
            [dbOrderId, itemDisplayId]
          );

          if (existingItemRes.rows.length > 0) {
            // Update non-cost fields. CRITICAL: snapshot_unit_cost is never modified (Trigger 2 invariant)
            await q(
              `UPDATE order_items 
               SET product_name = $1, quantity = $2, selling_price = $3, discount = $4, tax_amount = $5, returned_quantity = $6
               WHERE order_id = $7 AND display_id = $8;`,
              [productName, quantity, sellingPrice, discount, taxAmount, returnedQuantity, dbOrderId, itemDisplayId]
            );
          } else {
            // Insert fresh item with locked snapshotUnitCost
            await q(
              `INSERT INTO order_items (
                 id, display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity, created_at
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
               );`,
              [
                itemDisplayId,
                dbOrderId,
                sku,
                productName,
                quantity,
                sellingPrice,
                discount,
                taxAmount,
                snapshotUnitCost,
                returnedQuantity,
              ]
            );
          }
        }
      }

      if (dbOrderId && Array.isArray(order.items)) {
        const lineIds = order.items.map((item, index) => item.id || "ITEM-" + displayId + "-" + (index + 1));
        await q("DELETE FROM order_items WHERE order_id = $1 AND NOT (display_id = ANY($2::text[]))", [dbOrderId, lineIds]);
      }

      // 3. Append-only write to financial_audit_logs (Trigger 1 immutable log)
      const auditDisplayId = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await q(
        `INSERT INTO financial_audit_logs (
           id, display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason
         ) VALUES (
           gen_random_uuid(), $1, NOW(), 'ORDER', $2, 'sync_status', 'PREVIOUS', $3, 'Amazon SP-API Integration', $4
         );`,
        [
          auditDisplayId,
          displayId,
          status,
          `Channel order ${channelOrderId} synchronized (IsInsert: ${isInsert})`,
        ]
      );

      if (isInsert) { inserted++; insertedOrderIds.push(dbOrder.display_id || displayId); } else updated++;
      orderIds.push(dbOrder.display_id || displayId);
  }
  if (!transactionClient) await client.query("COMMIT");
  return { inserted, updated, orderIds, insertedOrderIds };
  } catch (err) {
    if (!transactionClient) await client.query("ROLLBACK").catch(() => {});
    throw new Error("Order persistence failed.", { cause: err });
  } finally {
    if (!transactionClient) client.release();
  }
}

/**
 * Atomically upserts an array of settlements and deduction line items into PostgreSQL.
 * Satisfies TASK-3.4 / 3.5:
 * - Upserts settlements table with settlement_batch_id and order_id
 * - Appends deduction breakdown lines into settlement_deductions
 * - Writes immutable financial_audit_logs
 */
export async function upsertSettlements(
  userId: string,
  settlements: Settlement[]
): Promise<SettlementPersistenceResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Multi-tenant invariant violation: userId is required for settlement persistence.");
  }

  if (!settlements || settlements.length === 0) {
    return { inserted: 0, updated: 0, settlementIds: [] };
  }

  await ensureMarketplaceTables();

  let inserted = 0;
  let updated = 0;
  const settlementIds: string[] = [];

  for (const s of settlements) {
    const displayId = s.id || `SET-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const batchId = s.settlementBatchId || `BATCH-${Date.now()}`;
    const marketplace = s.marketplace;
    const settlementDate = s.settlementDate || new Date().toISOString().split("T")[0];
    const orderLookup = s.orderId;
    const grossAmount = s.grossAmount || 0;
    const tcsTdsTax = s.tcsTdsTax || 0;
    const netSettlement = s.netSettlement || 0;
    const reconStatus = s.reconciliationStatus || "RECONCILED";
    const bankTxRef = s.bankTxRef || null;

    let client: any = null;
    let settlementWasInserted = false;
    let persistedSettlementId: string | null = null;
    try {
      client = await pool.connect();
      if (client) {
        await client.query("BEGIN");
      }
      const q = client ? (text: string, params?: any[]) => client.query(text, params) : query;

      // Look up target internal order UUID scoped to the authenticated merchant
      let targetOrderUuid: string | null = null;
      const orderSearch = await q(
        `SELECT id FROM orders WHERE user_id = $1 AND (display_id = $2 OR channel_order_id = $2) AND marketplace = $3 AND deleted_at IS NULL LIMIT 1;`,
        [userId, orderLookup, marketplace]
      );

      if (orderSearch.rows.length > 0) {
        targetOrderUuid = orderSearch.rows[0].id;
      }

      if (!targetOrderUuid) {
        // If order does not exist in DB yet, create a tenant-scoped shell order record to satisfy foreign key
        const shellOrderRes = await q(
          `INSERT INTO orders (
             id, user_id, display_id, channel_order_id, marketplace, order_date, status, customer_name, customer_city, customer_state, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $2, $3, $4, 'DELIVERED', 'Customer', 'India', 'India', NOW(), NOW()
           )
           ON CONFLICT (user_id, channel_order_id, marketplace) DO UPDATE SET updated_at = NOW() WHERE orders.deleted_at IS NULL
           RETURNING id;`,
          [userId, orderLookup, marketplace, settlementDate]
        );
        targetOrderUuid = shellOrderRes.rows[0]?.id;
      }

      if (!targetOrderUuid) throw new Error("Archived or missing order cannot receive a settlement.");
      if (targetOrderUuid) {
        // Upsert settlement with tenant user_id
        const settlementSql = `
          INSERT INTO settlements (
            id, user_id, display_id, settlement_batch_id, marketplace, settlement_date, order_id,
            gross_amount, tcs_tds_tax, net_settlement, reconciliation_status, bank_tx_ref,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
          )
          ON CONFLICT (user_id, settlement_batch_id, order_id)
          DO UPDATE SET
            gross_amount = EXCLUDED.gross_amount,
            tcs_tds_tax = EXCLUDED.tcs_tds_tax,
            net_settlement = EXCLUDED.net_settlement,
            reconciliation_status = EXCLUDED.reconciliation_status,
            bank_tx_ref = EXCLUDED.bank_tx_ref,
            updated_at = NOW()
          WHERE settlements.deleted_at IS NULL
          RETURNING id, display_id, (xmax = 0) AS is_insert;
        `;

        const settlementRes = await q(settlementSql, [
          userId,
          displayId,
          batchId,
          marketplace,
          settlementDate,
          targetOrderUuid,
          grossAmount,
          tcsTdsTax,
          netSettlement,
          reconStatus,
          bankTxRef,
        ]);

        const dbSettlement = settlementRes.rows[0];
        if (!dbSettlement) throw new Error("Archived settlement must be restored before synchronization.");
        const dbSettlementId = dbSettlement?.id;
        const isInsert = dbSettlement?.is_insert;

        settlementWasInserted = Boolean(isInsert);
        persistedSettlementId = dbSettlement.display_id || displayId;

        // Re-insert deduction items
        if (dbSettlementId && Array.isArray(s.deductions)) {
          await q(`DELETE FROM settlement_deductions WHERE settlement_id = $1;`, [dbSettlementId]);
          for (const d of s.deductions) {
            await q(
              `INSERT INTO settlement_deductions (
                 id, settlement_id, category, name, amount, created_at
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4, NOW()
               );`,
              [dbSettlementId, d.category, d.name, d.amount]
            );
          }
        }

        // Financial audit log
        const auditDisplayId = `AUD-SET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await q(
          `INSERT INTO financial_audit_logs (
             id, display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason
           ) VALUES (
             gen_random_uuid(), $1, NOW(), 'SETTLEMENT', $2, 'net_settlement', '0', $3, 'Amazon SP-API Finances Integration', $4
           );`,
          [
            auditDisplayId,
            displayId,
            String(netSettlement),
            `Settlement batch ${batchId} for order ${orderLookup} recorded.`,
          ]
        );
      }

      if (client) {
        await client.query("COMMIT");
      }
      if (!persistedSettlementId) throw new Error("Settlement was not persisted.");
      if (settlementWasInserted) inserted++; else updated++;
      settlementIds.push(persistedSettlementId);
    } catch (err: any) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {}
      }
      throw new Error("Settlement persistence failed.", { cause: err });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  return { inserted, updated, settlementIds };
}
