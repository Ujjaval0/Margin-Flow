import { Order, OrderItem, Settlement, SettlementDeduction } from "@/domain/types";
import { query, ensureMarketplaceTables, pool } from "@/lib/db";
import crypto from "crypto";
import type { PoolClient } from "pg";
import { buildFeeOrderLineInputs, calculateMarketplaceFeeEstimate, decimalRupeesToPaise, type MarketplaceFeeRule } from "@/domain/marketplace-fees";

export interface OrderPersistenceResult {
  inserted: number;
  updated: number;
  orderIds: string[];
  insertedOrderIds: string[];
  feeEstimates: Array<{ status: "CONFIGURED" | "NOT_CONFIGURED"; totalPaise: number | null }>;
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
    return { inserted: 0, updated: 0, orderIds: [], insertedOrderIds: [], feeEstimates: [] };
  }

  await ensureMarketplaceTables();

  let inserted = 0;
  let updated = 0;
  const orderIds: string[] = [];
  const insertedOrderIds: string[] = [];
  const feeEstimates: OrderPersistenceResult["feeEstimates"] = [];

  if (orders.length > 1000 || orders.some(order => !order || !Array.isArray(order.items))) {
    throw new Error("Invalid order batch.");
  }
  const client = transactionClient || await pool.connect().catch((error) => {
    throw new Error("Order persistence failed.", { cause: error });
  });
  try {
  if (!transactionClient) await client.query("BEGIN");
  const feeRuleRows = await client.query(`SELECT r.id, r.marketplace, r.sku, r.product_category, r.fulfilment_mode,
      r.min_unit_price_paise, r.max_unit_price_paise, r.effective_from, r.effective_to, r.version, r.status,
      c.id AS component_id, c.name AS component_name, c.component_type, c.calculation_method,
      c.rate_bps, c.amount_paise, c.calculation_base, c.tax_treatment, c.tax_rate_bps, c.sequence
    FROM marketplace_fee_rules r LEFT JOIN marketplace_fee_rule_components c
      ON c.user_id = r.user_id AND c.rule_id = r.id AND c.enabled = TRUE
    WHERE r.user_id = $1 AND r.status = 'ACTIVE' ORDER BY r.created_at, c.sequence, c.id`, [userId]);
  const ruleGroups = new Map<string, MarketplaceFeeRule>();
  for (const row of feeRuleRows.rows) {
    let rule = ruleGroups.get(row.id);
    if (!rule) {
      rule = { id: row.id, version: Number(row.version), marketplace: row.marketplace,
        sku: row.sku, productCategory: row.product_category, fulfilmentMode: row.fulfilment_mode,
        minUnitPricePaise: row.min_unit_price_paise === null ? null : Number(row.min_unit_price_paise),
        maxUnitPricePaise: row.max_unit_price_paise === null ? null : Number(row.max_unit_price_paise),
        effectiveFrom: row.effective_from.toISOString?.().slice(0, 10) || String(row.effective_from).slice(0, 10),
        effectiveTo: row.effective_to ? row.effective_to.toISOString?.().slice(0, 10) || String(row.effective_to).slice(0, 10) : null,
        status: row.status, components: [] };
      ruleGroups.set(row.id, rule);
    }
    if (row.component_id) rule.components.push({ id: row.component_id, name: row.component_name, componentType: row.component_type,
      method: row.calculation_method, rateBps: row.rate_bps === null ? undefined : Number(row.rate_bps),
      amountPaise: row.amount_paise === null ? undefined : Number(row.amount_paise), calculationBase: row.calculation_base || undefined,
      taxTreatment: row.tax_treatment, taxRateBps: row.tax_rate_bps === null ? undefined : Number(row.tax_rate_bps), sequence: Number(row.sequence) });
  }
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
    const notes = order.notes || `SP-API Synced | ${channelOrderId}`;

    const q = (text: string, params?: any[]) => client.query(text, params);
    const existingOrder = await q(`SELECT id, display_id, quick_fee_rate_bps FROM orders
      WHERE user_id = $1 AND (display_id = $2 OR (channel_order_id = $3 AND marketplace = $4)) AND deleted_at IS NULL
      ORDER BY CASE WHEN display_id = $2 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`, [userId, displayId, channelOrderId, marketplace]);
    const quickFeeRateBps = order.quickFeeRateBps === undefined
      ? existingOrder.rows[0]?.quick_fee_rate_bps == null ? null : Number(existingOrder.rows[0].quick_fee_rate_bps)
      : order.quickFeeRateBps;
    const productCategories = await q("SELECT sku, category FROM products WHERE user_id = $1 AND sku = ANY($2::text[])", [userId, order.items.map(item => item.sku)]);
    const categoryBySku = new Map(productCategories.rows.map((row: any) => [row.sku, row.category]));
    const feeInputLines = buildFeeOrderLineInputs(order.items, categoryBySku, order.fulfilmentMode);
    const estimate = calculateMarketplaceFeeEstimate([...ruleGroups.values()].filter(rule => rule.components.length > 0), feeInputLines,
      marketplace, orderDate.slice(0, 10), quickFeeRateBps);
    const calculatedFeeAmount = estimate.status === "CONFIGURED" ? (estimate.totalPaise / 100).toFixed(2) : null;

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
          settlement_amount,
          fulfilment_mode,
          quick_fee_rate_bps,
          fee_estimate_status,
          notes,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          CASE WHEN $15 THEN $16::numeric ELSE 0::numeric END, $11, $12, $13, $14, $17, NOW(), NOW()
        )
        ON CONFLICT (user_id, channel_order_id, marketplace)
        DO UPDATE SET
          status = EXCLUDED.status,
          customer_name = EXCLUDED.customer_name,
          customer_city = EXCLUDED.customer_city,
          customer_state = EXCLUDED.customer_state,
          shipping_fee_charged = EXCLUDED.shipping_fee_charged,
          marketplace_charges_estimate = CASE WHEN $15 THEN EXCLUDED.marketplace_charges_estimate ELSE orders.marketplace_charges_estimate END,
          settlement_amount = COALESCE(EXCLUDED.settlement_amount, orders.settlement_amount),
          fulfilment_mode = COALESCE(EXCLUDED.fulfilment_mode, orders.fulfilment_mode),
          quick_fee_rate_bps = EXCLUDED.quick_fee_rate_bps,
          fee_estimate_status = EXCLUDED.fee_estimate_status,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        WHERE orders.deleted_at IS NULL
        RETURNING id, display_id, (xmax = 0) AS is_insert;
      `;

      const orderValues = [
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
        order.settlementAmount ?? null,
        order.fulfilmentMode ?? null,
        quickFeeRateBps,
        estimate.status,
        estimate.status === "CONFIGURED",
        calculatedFeeAmount,
        notes,
      ];
      const orderRes = existingOrder.rows.length
        ? await q(`UPDATE orders SET
            channel_order_id = $1, marketplace = $2, order_date = $3, status = $4, customer_name = $5,
            customer_city = $6, customer_state = $7, shipping_fee_charged = $8,
            marketplace_charges_estimate = CASE WHEN $13 THEN $14 ELSE marketplace_charges_estimate END,
            settlement_amount = COALESCE($9, settlement_amount), fulfilment_mode = COALESCE($10, fulfilment_mode),
            quick_fee_rate_bps = $11, fee_estimate_status = $12, notes = $15, updated_at = NOW()
          WHERE user_id = $16 AND id = $17 AND deleted_at IS NULL
          RETURNING id, display_id, FALSE AS is_insert`, [
            channelOrderId, marketplace, orderDate, status, customerName, customerCity, customerState,
            shippingFeeCharged, order.settlementAmount ?? null, order.fulfilmentMode ?? null, quickFeeRateBps, estimate.status,
            estimate.status === "CONFIGURED", calculatedFeeAmount, notes, userId, existingOrder.rows[0].id,
          ])
        : await q(orderUpsertSql, orderValues);

      const dbOrder = orderRes.rows[0];
      if (!dbOrder) throw new Error("Archived order must be restored before synchronization.");
      const dbOrderId = dbOrder?.id;
      const isInsert = dbOrder?.is_insert;

      const estimateRow = await q(`INSERT INTO order_fee_estimates (
        user_id, order_id, status, total_paise, calculation_version, input_snapshot
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [userId, dbOrderId, estimate.status,
        estimate.status === "CONFIGURED" ? estimate.totalPaise : null,
        estimate.status === "CONFIGURED" ? estimate.calculationVersion : 1,
        JSON.stringify({ marketplace, orderDate: orderDate.slice(0, 10), fulfilmentMode: order.fulfilmentMode || null, quickFeeRateBps,
          grossPaise: feeInputLines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0),
          discountPaise: feeInputLines.reduce((sum, line) => sum + line.discountPaise, 0),
          taxPaise: feeInputLines.reduce((sum, line) => sum + line.taxPaise, 0),
          shippingFeePaise: decimalRupeesToPaise(shippingFeeCharged), lines: feeInputLines })]);
      feeEstimates.push({ status: estimate.status, totalPaise: estimate.status === "CONFIGURED" ? estimate.totalPaise : null });
      if (estimate.status === "CONFIGURED") {
        for (const [sequence, component] of estimate.components.entries()) {
          await q(`INSERT INTO order_fee_estimate_components (
            user_id, estimate_id, rule_id, rule_version, rule_component_id, line_sku, component_name, component_type,
            calculation_method, calculation_base_paise, rate_bps, amount_paise, tax_treatment, tax_rate_bps,
            tax_paise, quantity, sequence
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [
            userId, estimateRow.rows[0].id, component.ruleId, component.ruleVersion, component.componentId, component.lineSku,
            component.componentName, component.componentType, component.method, component.basePaise, component.rateBps ?? null,
            component.amountPaise, component.taxTreatment, component.taxRateBps, component.taxPaise, component.quantity, sequence,
          ]);
        }
      }


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
               SET product_name = $1, quantity = $2, selling_price = $3, discount = $4, tax_amount = $5, returned_quantity = $6, sku = $7
               WHERE order_id = $8 AND display_id = $9;`,
              [productName, quantity, sellingPrice, discount, taxAmount, returnedQuantity, sku, dbOrderId, itemDisplayId]
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
           id, display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason, user_id
         ) VALUES (
           gen_random_uuid(), $1, NOW(), 'ORDER', $2, 'order_upsert', 'PREVIOUS', $3, 'Authenticated Order API', $4, $5
         );`,
        [
          auditDisplayId,
          displayId,
          status,
          `Channel order ${channelOrderId} persisted (IsInsert: ${isInsert})`,
          userId,
        ]
      );
      await q(`INSERT INTO financial_audit_logs (
        id, display_id, timestamp, entity_type, entity_id, field_name, old_value, new_value, modified_by, reason, user_id
      ) VALUES (gen_random_uuid(), $1, NOW(), 'ORDER', $2, 'fee_estimate_snapshot', 'PREVIOUS', $3, 'Authenticated Order API', $4, $5)`, [
        `AUD-FEE-${crypto.randomUUID()}`, displayId,
        JSON.stringify({ status: estimate.status, totalPaise: estimate.status === "CONFIGURED" ? estimate.totalPaise : null,
          calculationVersion: estimate.status === "CONFIGURED" ? estimate.calculationVersion : 1 }),
        "Immutable marketplace fee estimate snapshot stored.", userId,
      ]);

      if (isInsert) { inserted++; insertedOrderIds.push(dbOrder.display_id || displayId); } else updated++;
      orderIds.push(dbOrder.display_id || displayId);
  }
  if (!transactionClient) await client.query("COMMIT");
  return { inserted, updated, orderIds, insertedOrderIds, feeEstimates };
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
