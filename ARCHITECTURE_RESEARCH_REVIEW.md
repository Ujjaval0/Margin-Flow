> Remediation follow-up (19 October 2026): this document preserves the original audit snapshot. Current implementation, verified fixes, guarded unsupported inputs and live release gates are recorded in [FINANCIAL_REPAIR_PROGRESS.md](./FINANCIAL_REPAIR_PROGRESS.md).

# MarginFlow independent architecture and ingestion research review

Reviewed 19 October 2026, against the actual dirty checkout in this workspace. This review made no application or test changes, opened no database or secrets, and did not rely on the previous calculation audit. Synthetic probes execute actual application modules through the repository's `tests/helpers/load-app.cjs`, substituting database, authentication, provider HTTP and React hook boundaries. Mocked probes establish application behavior; they do not certify a deployed database, external API authorization, or actual merchant records.

## Conclusion

The application cannot currently be certified as fully accurate accounting software. There are confirmed financial data-loss, ingestion, and reporting defects. Tenant-scoped APIs, database transactions, immutable cost triggers and webhook deduplication provide useful foundations, but these controls do not make incomplete or incorrectly mapped financial evidence accurate.

P1 means a normal supported workflow can materially misstate or lose financial information; P2 means a narrower correctness/control gap. These are engineering risk priorities, not legal findings. Statutory suitability depends on the merchant's entity type, registration, books and external retention arrangements; this report does not infer them.

## Confirmed findings

### A1 — P1: Most operating books remain browser-only, and authoritative refresh reverses inventory/status edits

`src/domain/store.tsx:303–316` fetches and replaces orders, settlements and products only. Ordinary returns (`840`), claims, expenses (`1352`), supplier bills (`1382`), suppliers (`1398`) and supplier payments (`1448–1489`) mutate React collections. Their ordinary persistence is the debounced browser snapshot at `354–398`; no corresponding server write occurs. The recycle recovery endpoint only restores selected previously archived records (`src/lib/recovered-records.ts:48` onwards), not complete CRUD synchronization.

`updateOrderStatus` at `741–762`, product cost changes at `1213–1253`, and inventory mutations for sales (`675–687`), purchases (`1391–1393`) and returns (`876–883`) likewise have no durable stock/cost/status transaction. Refresh replaces these values with older database records. A different browser has no local books. Browser storage failure logs to console after the UI has already accepted the record. `importLedgerSnapshot` at `1740–1758` also replaces client data without importing it into the authoritative database; subsequent refresh replaces its orders/products/settlements.

**Actual provider probe:** authoritative stock 5; `addOrder` quantity 2 produces stock 3 and just one POST to `/api/orders`; `refreshFromDatabase` restores stock 5. `updateOrderStatus('o','CANCELLED')` issues zero requests and changes the display; refresh restores DELIVERED. Thus these are concrete regressions in supported functionality, not merely missing enterprise features. A durable owner-scoped posting transaction must save the document, inventory movement and audit evidence together before acknowledging success.

**Additional actual provider probe:** stock10 with two distinct order lines for the same SKU, quantities2 and3, becomes8 instead of5. The sale mutation at `678` uses `.find`, subtracting only the first line. This is an immediate quantity error even before the persistence/refresh issue.

### A2 — P1: Supplier actions make the saved snapshot fail its own validation

`store.tsx:1403`, `1421`, `1437` writes audit `entityType: 'SUPPLIER' as any`; `1481` writes `'SUPPLIER_PAYOUT' as any`. The audit enum in `snapshot-validation.ts` accepts neither. `tenant-cache.ts:15–16` passes the complete cache through `parseLedgerSnapshot`, which rejects the entire ledger if one audit entry is invalid. This compounds A1: ordinary supplier creation/payment can make browser-only books ineligible for rehydration on the next session.

**Actual provider probe:** `addSupplier` → `exportLedgerSnapshot` → `parseLedgerSnapshot(snapshot,'A')` returns `null`, with audit types `[SUPPLIER, ORDER, ORDER]`. Align the real producers and schema and provide explicit recoverable handling for already-written incompatible snapshots.

### A3 — P1: API connectors permanently freeze zero cost even when a matching catalog exists

Shopify and WooCommerce mappers accept an optional `catalogCostLookup`, but sync and webhook callers never supply it. Amazon sets `snapshotUnitCost: 0` at `amazon/sync/route.ts:324`; Flipkart does the same at `flipkart/sync/route.ts:375`; generic sync does the same. Persistence reads only `SELECT sku, category` at `order-persistence.ts:104`, then inserts the supplied cost (`243`, `277`). It never resolves a historical catalog cost. Subsequent updates deliberately preserve the zero snapshot (`253–259`); the SQL cost immutability trigger enforces that choice. The financial facts engine treats numeric zero as real COGS, with no unknown-cost status.

**Actual persistence probe:** a synthetic matching SKU with cost 225 available at the mocked catalog boundary still inserts cost 0; there are zero queries for `product_cost_history` or `current_cost_price`. A delivered line of 100 maps to COGS 0 and contribution profit 100 in the actual facts function. Resolve authenticated tenant SKU aliases and historical cost before posting; distinguish unknown evidence from legitimate free inventory; repair existing errors through a documented correction process.

### A4 — P1: Shopify order discounts, cancellations and refunds are not faithfully imported

`shopify-schema.ts` accepts `total_discount` but strips `discount_allocations`, `cancelled_at`, `refunds`, source `updated_at` and current quantities/totals. `mapShopifyOrderToDomain` sets only DELIVERED versus CONFIRMED based on fulfillment status; `financial_status` is just notes. Every line has `returnedQuantity: 0`. A refunded or cancelled fulfilled order can therefore retain recognized sale revenue. The mapper uses array-position line IDs (`ITEM-SHP-${payload.id}-${idx+1}`), rather than source line IDs, which can attach an immutable historical cost to a different product after an edit/reorder.

**Actual schema→mapper→facts probe:** quantity 2, unit price 50, `total_discount: 0`, `discount_allocations: [{amount:'20'}]`, `total_price:'80'`, fulfilled + partially_refunded + refund evidence → mapped discount 0, returned quantity 0, net sales 100. The mapper never checks its reconstructed total against 80. Shopify's official REST Order documentation identifies allocation data, and Refund documentation defines separate refund line/tax/shipping evidence. [Order](https://shopify.dev/docs/api/admin-rest/2026-07/resources/order), [Refund](https://shopify.dev/docs/api/admin-rest/latest/resources/refund).

### A5 — P1: WooCommerce fees and partial refunds disappear

`woocommerce-schema.ts` strips `fee_lines`, `refunds` and currency. It maps item subtotal/discount/tax and shipping, but does not include customer-paid fees or read refund details. Completed partially refunded orders remain DELIVERED with zero returned quantities. Fully refunded status changes to RETURNED, but no actual refund date/quantity/shipping amount or condition enters a return record; status alone is insufficient to establish recovery of inventory.

**Actual schema→mapper→facts probe:** line subtotal/total 100, customer handling fee 20, source total 120, with refund evidence → facts net sales 100 and refunded units 0. Use the documented fee and refund fields/endpoints, keep fulfillment/payment/return evidence distinct, and reconcile source totals. [Official WooCommerce orders API](https://developer.woocommerce.com/docs/apis/rest-api/v3/orders/), [official refund model](https://woocommerce.github.io/woocommerce-rest-api-docs/#order-refunds).

### A6 — P1: Currency is silently discarded

Shopify schema accepts currency but the domain output omits it. WooCommerce drops it at schema parsing. IDP extraction accepts currency but the staged/posting model omits it. Order/ledger types have no currency or exchange-rate evidence, and UI consumers display rupees. A valid USD 100 order becomes a numeric 100 in INR reporting without rejection or conversion. **Actual mapper probe:** `currency:'USD'` is accepted and produces the same domain numbers as INR. An INR-only product can simply validate/reject incompatible currency; adding a full FX system is not necessary to correct silent mislabeling.

### A7 — P1: Amazon financial events are mislabeled as reconciled cash settlements and lose event evidence

`amazon/finances/route.ts:220` processes only `ShipmentEventList`; refunds, adjustments, chargebacks, reimbursements and service-fee event collections are ignored. Within shipments, only Principal/ShippingCharge contribute to gross (`242`); tax charge and promotion collections, shipment/order-level fees, and signed credits do not have complete mappings. Fees are converted with `Math.abs` (`250`) and net is clamped to zero (`291`). The route computes net from the same incomplete inputs and labels it `RECONCILED`, discrepancy 0 (`306–307`) without any payout/bank comparison. A shipment posting is evidence of a marketplace transaction, not evidence of a bank transfer on PostedDate.

**Actual route probe:** two shipment events and a refund plus adjustment yield only the two shipments, each `RECONCILED`, with principal 100/50, net 90/45; tax charge 18, refund and adjustment are absent. Amazon's official model defines distinct collections and financial groups carry transfer status/date/reference separately. [Official Amazon Finances v0 model](https://raw.githubusercontent.com/amzn/selling-partner-api-models/main/models/finances-api-model/financesV0.json), [official group retrieval workflow](https://developer-docs.amazon/sp-api/docs/retrieve-financial-events-in-group). Import signed immutable financial events first; establish actual payout/receipt and reconciliation from independently sourced evidence.

### A8 — P1: Amazon settlement keys overwrite split events and reject separate dates

The same route creates `id: SET-AMZ-${channelOrderId}` (`297`), `batch: FIN-AMZ-${postedDate}` (`228`) and order identity (`301`) for every shipment event. Persistence has conflict key `(user_id, settlement_batch_id, order_id)` (`order-persistence.ts:415`), replacing amounts/deductions, not summing events. The production schema also has tenant-unique display ID (`initial_schema.sql:1707`).

**Actual route probe:** same-order same-date shipment 100 less 10 and another 50 less 5 produces two records with identical keys. The second SQL upsert replaces the first, leaving net 45 rather than combined 135. Events on different dates have distinct batch keys but the same display ID and can conflict with the unique display index. Preserve stable provider event identity; aggregate only intentionally at a separate reporting boundary.

### A9 — P1: Background financial reports still execute the obsolete 75% payout SQL model

`src/lib/queue/job-processors.ts:43–57` reads `v_order_profitability` directly for `GENERATE_FINANCIAL_REPORT`. The production view at `20261017000100_initial_schema.sql:1014–1068` multiplies rounded unit prices, ignores tax/shipping/line subtotal in gross, treats any RTO as profit 0, and uses `gross_sales * 0.75 - total_cogs` without receipts. It aggregates settlements without `deleted_at` filtering (`1020–1025`). Later migrations do not redefine this view. The browser now uses different financial facts.

**Reproducible SQL reading:** an unsettled delivered order gross 100, COGS 20 produces report profit 55 under the view's explicit fallback. Facts for the same order with unknown fees show expected payout null, profit 80 before unknown fees; with a known actual fee 10 they yield profit 70. Archived settlements remain in this view's sum while API/UI filters them out. This finding is static SQL + actual report query wiring, not a claim that this schema was deployed or SQL executed. Use one verified accounting model for both reports and interactive views; retain explicit unknowns.

### A10 — P1: Invoice approval invents financial facts and collapses multiple lines

IDP (`idp-pipeline.ts:89–151`) validates a full line-item extraction, then retains just the first item's quantity/price/SKU while assigning the entire document discount/tax/grand total to that single staged item. The type cannot retain all lines. Approval at `store.tsx:1587–1596` posts one item, fallback SKU `ELEC-WEM-01`, and a hard-coded unit cost 380. Supplier approval instead uses supplier `SUP-001` / `Apex Components Ltd` and assumes PAID (`1622–1631`), bypasses `addPurchase`'s quantity/catalog checks and inventory mutation, and updates cost at approval time instead of invoice effective date. Approval has no direct passed-arithmetic/catalog/status check; guarding a UI button is not an invariant at this posting function.

**Concrete source trace:** invoice with A quantity1 price100 and B quantity1 price200, document tax54 and total354 stages A only, quantity1 price100, tax54 and total354; sales approval posts gross154 including tax instead of354 and invents cost380. Unpaid supplier bill is posted PAID. Preserve all extracted lines and source currency, require explicit mapped SKU/vendor/payment evidence, and verify complete totals at the actual commit boundary.

### A11 — P1: Generic sync treats an order total as a unit price

`integrations/generic/sync/route.ts:187–216` resolves `total = parseFloat(o.total || o.amount || o.sellingPrice || '0')` then assigns it to one item's `sellingPrice` while also preserving quantity. It also ignores an input item list/status, invents fallback identifiers/SKU, and does not run the canonical order schema before persistence.

**Actual route probe:** `{id:'g',total:'200',quantity:2,sku:'SKU'}` is accepted, persists unit price200 and extended gross400. Define a source contract with explicit total versus unit-price semantics and reject ambiguous data.

### A12 — P1: Flipkart source discounts/statuses are not represented correctly

`flipkart/sync/route.ts:346–350` reads `customerDiscount`/`discount` but never the documented `promotionDiscount` or customerPrice. Official shipment price components describe customerPrice in relation to sellingPrice and promotionDiscount; code can overstate a promoted sale. `RETURN_REQUESTED` and `PICKUP_COMPLETE` fall into CONFIRMED (`353–366`); mixed per-item statuses collapse to the first order's status when grouping (`398–402`). A first returned/cancelled line can classify otherwise delivered lines incorrectly at order level, and array-returned quantities are unavailable independently by date. Verify invoice tax-inclusive basis against real evidence rather than inferring it from these shipment price fields. [Official Flipkart Order Management reference](https://seller.flipkart.com/api-docs/order-api-docs/OMAPIRef.html). These are confirmed mapping omissions from source and official contract; no live Flipkart acceptance was tested.

### A13 — P2: Durable upserts do not retain a complete financial edit history

`order-persistence.ts:255–259` overwrites quantity/price/discount/tax/returned quantity/SKU and `288` deletes removed lines, while its audit stores old value `'PREVIOUS'` and only new status (`294–305`). The extra fee snapshot logs estimate inputs, not immutable original line costs or a complete before/after order. Settlement deduction rows are deleted/reinserted (`456–469`), and audit old value is always `'0'`, with no owner included in that insert (`475–486`). It does not preserve previous deduction evidence. Product creation/upsert accepts supplied costHistory/aliases but writes neither (`api/products/route.ts:124–174`), so those fields disappear after hydration and later historical CSV imports can resolve cost0.

Changing a line ID allows a delete/new insert to bypass the purpose of the snapshot UPDATE trigger, and index-derived Shopify/Woo line IDs can attach existing cost to a different source line. Reproduction of actual SQL traces confirms no history/alias insert and a generic status-only audit. Append-only audit rows are useful, but do not establish an edit log of every accounting transaction. Preserve complete source identity and revision/correction evidence; do not present current controls as statutory audit-trail compliance.

### A14 — P2: Read pagination silently truncates authoritative books

Store hydration always requests `limit=2000` with no next-page loop (`store.tsx:303–304`); orders and settlements APIs cap reads at 2000 and return only the number of rows in the page. At 2001 orders the oldest order and possibly its settlement disappear from the arrays driving totals, replacing a previously fuller local cache. This is a deterministic boundary defect in an accounting application, not a speculative scale enhancement. Paginate to exhaustion or calculate complete totals on the server with explicit scope.

### A15 — P2: Settlement save can appear successful without persistence; API batch failure can leave partial financial effects

Manual `addSettlement` updates state before fetch, does not inspect HTTP status or JSON (`store.tsx:1294–1312`), and logs only rejected network promises. An HTTP 400/500/503 silently leaves an apparent receipt until refresh. `/api/settlements` accepts arbitrary nonempty arrays without the canonical settlement schema, money precision checks or batch limit (`route.ts:197–217`). `upsertSettlements` opens/commits a separate transaction for each row (`order-persistence.ts:354`, `374`, `490`), so a later invalid record throws while earlier receipts are committed; the API responds failure for the request. Wait for acknowledged validated writes and communicate/implement batch atomicity explicitly.

### A16 — P2: Webhook replay prevention does not prevent stale event regression

Webhook receipts atomically deduplicate identical `(connection,eventId)` and reject conflicting contents. However, provider schemas strip updated timestamps and persistence unconditionally overwrites latest status/financial fields. A delayed older event with a different delivery ID is accepted and replaces newer data. Shopify documents that delivery order is not guaranteed and recommends source timestamps. [Official webhook ordering guidance](https://shopify.dev/docs/apps/build/webhooks#ordering-event-data). Retain source revision/timestamp and implement an authoritative stale-event policy in the same transaction.

### A17 — P1: A colliding display ID can replace a different external order

`order-persistence.ts:98–100` resolves an existing order by `(display_id = supplied id) OR (channel_order_id + marketplace)` and prioritizes the display-ID match. It does not require that the matched record's external identity agree. The UPDATE at `184–194` then replaces `channel_order_id`, marketplace and order fields; `288` deletes old lines absent from the incoming record. Consequently a display-ID collision is treated as permission to replace a different order rather than rejected as an identity conflict.

**Actual persistence probe:** existing database row UUID `original-uuid`, display `ORD-1234`, channel `INV-A`; incoming order display `ORD-1234`, channel `INV-B`, new line `line-new`. Result: `inserted:0, updated:1`, original UUID now has channel `INV-B`, zero order INSERTs, and the DELETE for absent old lines executes. Tenant scope remains intact; this is corruption within one merchant's books.

The invoice approval path directly generates `ORD-${Date.now().toString().slice(-4)}` (`store.tsx:1573`), a namespace that repeats every10 seconds, and posts without the store's create-order duplicate suffix check. This gives a concrete supported producer of such collisions between distinct invoice numbers. Manual OrderModal actually uses a six-digit time suffix (`order-modal.tsx:442`), not four; its order/reference input is required (`629–639`), so ordinary browser submission normally uses the entered reference. `addOrder` protects against IDs already present in the current client arrays (`store.tsx:657–660`), but that is not a server identity invariant and cannot cover another session or an older record omitted by the 2000-row hydration cap. Return/claim four-digit IDs create separate duplicate-ID risks, but this probe does not establish an order overwrite from those paths. Use collision-resistant IDs and explicit create/update semantics with server-side external-identity conflict checks.

## Controls that are present and worth preserving

- Orders API and persistence derive a verified session owner; owner predicates scope order/header/product reads and writes. Child item reads use the parent IDs selected under that owner. Settlement lookup includes owner and marketplace. No cross-tenant leak was established by this review.
- `upsertOrders` uses a single transaction for a batch and can participate in a caller transaction. Webhook receipt and order mutation commit together under a per-delivery advisory lock. Failed receipt ingestion remains retryable.
- File upload parses original bytes server-side, validates rows, consolidates stable order/line identities, and commits import audit and order writes together. Settlement-format files are rejected as sales rather than converted to fabricated orders. Historical CSV cost lookup uses the order date when durable history exists.
- Provider pagination rejects unsafe origin/path changes, cycles and its page bound instead of silently importing a partial result. Application synchronization can nevertheless fail for a complete provider dataset over the 1000-order persistence bound; this is an availability limit, not silent truncation in that connector path.
- Queue claim uses PostgreSQL `SKIP LOCKED`, lease tokens, owner-scoped reads and completion coupled to processor effects through the same transaction client. The report calculations queried by that processor still require A9 correction.
- Production SQL enables/restricts direct client access through RLS/revocations and has append-only audit and snapshot-cost UPDATE triggers. No claim is made about deployed grants, database role privileges or a DBA's ability to bypass triggers.

## Scope not certified

No actual GST registration, legal entity, invoice/credit-note series, inventory valuation policy, payout statement, bank reconciliation, GSTR/26AS credit matching, daily backup restore, deployment migration state, API partner approval or provider webhook subscription inventory was available. Their compliance cannot be inferred from code or fabricated by web research. Exact legal retention/audit-trail applicability needs the entity/recordkeeping review in the parent report; the confirmed data-loss/edit-history issues here prevent declaring this application adequate as the sole statutory record system today.
