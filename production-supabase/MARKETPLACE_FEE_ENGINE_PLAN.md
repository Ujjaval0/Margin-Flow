# Marketplace fee engine: production implementation plan

## Objective

Replace guessed, hard-coded channel commission percentages with seller-configured, product-aware fee rules. Calculate estimates deterministically, preserve the exact rule and inputs used for each order, persist order edits durably, and reconcile estimates against actual settlement deductions without rewriting history.

“Accurate” means mathematically reproducible from configured rules and source data. The application must not claim a marketplace charge is exact when the seller has not configured a rule or provided an actual settlement record. Marketplace rate cards vary by seller, product/category, price, fulfilment and time; there is no universal percentage the application can safely invent.

## Findings this work must address

- Marketplace dropdown defaults are hard-coded, including Amazon, Flipkart, Myntra, Meesho, WooCommerce and Personal Website.
- A new order starts at 20% regardless of selected channel until the channel is selected again.
- The order form models the entire difference between gross sales and expected settlement as commission. This can incorrectly combine commission with shipping, collection, fixed, tax-on-fee, return or other deductions.
- Fee benchmarks in anomaly detection disagree with the dropdown defaults. Invoice-created orders also use a fixed 15% assumption.
- The order persistence upsert does not currently save all fee and settlement fields collected by the form. Manual order edits are state/local-cache mutations and are not acknowledged by the durable order API.
- Existing `orders.marketplace_charges_estimate`, commission/settlement fields and settlement deduction rows contain historical information and must not be dropped or silently reinterpreted.

## Product and accounting contract

1. **No configured rate means unknown, not zero.** Show the estimate as not configured and do not fabricate a payout or fee-creep result from a missing fee rule.
2. **Actual settlement data is authoritative.** Imported or entered settlement deductions remain actual values. Estimates are forecasts only and must be labeled as such.
3. **Rates belong to a seller and have explicit scope.** A rule can be scoped by marketplace and optionally SKU, product category, fulfilment mode, and inclusive/exclusive price range. More specific matching rules take precedence over broader channel rules. Equal-specificity overlapping active rules are rejected; do not resolve ambiguity by arbitrary row order.
4. **Rules are time-bounded and versioned.** Changes apply prospectively. Each order keeps an immutable snapshot of the rule version, calculation inputs, calculated components and rounding result used when the estimate was made.
5. **Fee components stay separate.** Support configured percentage, fixed-per-order, per-unit and shipping/other charge components where the seller has a known rule. Persist each component and its tax treatment separately. Do not assume all platform charges are commission or infer tax treatment from a channel name.
6. **Rule configuration states its calculation base.** Percentage rules must specify the base (for example, item value before discount, after discount, or excluding item tax). The app must not choose a marketplace-specific base without verified seller configuration.
7. **Money calculations use integer paise and integer rate units.** Define the allowed rate precision, amount rounding mode, component rounding order, negative/return handling and quantity semantics once in a shared domain calculator. Persist/display INR to two decimals. Avoid binary floating-point arithmetic in fee calculations.
8. **Every mutation is server-acknowledged.** Create and edit operations write order fields, rule snapshot/estimate components, settlement rows and audit history transactionally where applicable. UI success is shown only after the backend confirms persistence.
9. **Legacy data is retained.** Existing fields and values remain readable during migration. Do not backfill unknown fee components with invented commission. Mark legacy estimates as legacy/unverified where necessary and preserve source IDs/audit traces.

## Target data model (confirm against current production migrations before coding)

- `marketplace_fee_rules`: tenant owner, marketplace, optional SKU/category/fulfilment scope, optional amount bands, active/effective dates, version/status and audit timestamps. Enforce tenant ownership, valid ranges and no ambiguous active overlaps at the chosen specificity.
- `marketplace_fee_rule_components`: rule ID, stable component type/name, calculation method (`PERCENT`, `FIXED_ORDER`, `PER_UNIT`), integer rate or paise amount, calculation base, explicit tax metadata where applicable, sequence and enabled state.
- `order_fee_estimates`: order ID, rule/version reference, calculation timestamp, currency, gross/discount/tax base snapshot, estimated total, calculation version and `CONFIGURED`/`NOT_CONFIGURED`/`LEGACY` status.
- `order_fee_estimate_components`: estimate ID, component/rule reference and immutable input/base/rate/quantity/amount snapshot in paise.
- Existing `settlement_deductions` remains the actual source of settled fee components; add source/import references only if the audit finds the current schema cannot preserve them. Reconcile totals and per-component variances without overwriting either actuals or estimates.
- Preserve existing order columns while application/API readers migrate. Add constraints, tenant-scoped keys, indexes, RLS/grants and rollback notes using the repository’s production-Supabase migration conventions.

## Ordered implementation tasks

### Task 1 — Contract and migration design

- Trace all fee reads/writes: manual order creation/edit, imports, invoice parsing, external sync, settlement ingestion, profitability, reports and anomaly detection.
- Confirm product/category and fulfilment fields available in both application and production schema; do not invent dependencies on absent fields.
- Specify matching precedence, conflicts, bases, precision, rounding, returns/refunds and estimate/actual semantics in domain types and migration comments.
- Produce an additive migration and data-retention/backfill map. No production database execution or destructive migration without an explicitly identified disposable/staging target.

### Task 2 — Deterministic calculation domain

- Implement one pure, shared fee-rule resolver and fee calculator used by all order-entry paths.
- Use paise/rate integer arithmetic, validate input bounds, apply the documented rounding rule component-by-component, and return a typed `NOT_CONFIGURED` result instead of a made-up rate.
- Add property/boundary tests for discounts, tax bases, quantity, price-band boundaries, rule precedence, overlap rejection, rounding, returns, zero-value lines, and exact component-sum invariants.

### Task 3 — Durable rule configuration

- Add tenant-scoped read/create/update/archive API paths and repository persistence for rules/components.
- Validate ownership and reject invalid/ambiguous rules server-side; do not trust client-supplied totals or resolved rules.
- Preserve version history so updating a rule does not mutate prior orders.

### Task 4 — Order estimate integration

- Remove code-level hard-coded commission defaults, anomaly commission benchmarks and the invoice-parser 15% assumption. Quick-rate shortcuts are persisted per merchant and marketplace; they are only applied after the user selects one and never substitute automatically for a configured rule.
- Resolve rules from selected seller, marketplace, product/category, fulfilment and price. Recalculate when any of those inputs changes.
- Make missing configuration explicit. Keep product selection/order entry usable, but mark estimate/payout as unavailable until a rule or actual settlement exists.
- Persist an immutable estimate snapshot with order create/edit and make both paths server-acknowledged and transaction-safe.

### Task 5 — Settlement reconciliation and reporting

- Keep actual settlement deduction components distinct from estimates and persist imported actuals idempotently.
- Reconcile by order and component where mapping exists; otherwise show total-level variance with an explicit unmatched status.
- Update profitability/dashboard calculations to use actuals when available, estimates only when clearly labeled, and never count an estimated fee and actual deduction twice.
- Disable or adapt fee-creep anomaly detection unless it has a configured expected rule and comparable actual fee components.

### Task 6 — Migration, acceptance and release

- Verify additive migrations on a disposable Supabase/PostgreSQL instance, including RLS, tenant isolation, constraints, rollback and populated legacy fixtures.
- Test two-tenant isolation; rule version snapshots after rule changes; create/edit/reload durability; imports and settlements; audit trail; and no-config behaviour.
- Reconcile hand-calculated golden fixtures (including paise rounding) against calculator output and order/report totals.
- Run focused tests, full test suite, TypeScript/build and relevant authenticated browser flows. Record commands/results and any remaining environmental blockers.
- Do not label production-ready until all acceptance checks pass and a reviewed staging migration/data reconciliation has been completed.

## Mathematical acceptance invariants

- All money inputs and outputs are whole paise internally and valid INR decimal values at API boundaries.
- A percentage component amount equals the configured integer-rate calculation on its explicitly configured base, rounded once using the shared rounding rule.
- Fixed-order and per-unit components apply exactly once and by quantity respectively; component order and rounding are deterministic.
- The sum of persisted estimate component paise equals the persisted estimate total paise.
- Actual settlement net is reconciled using the explicitly modeled gross, deductions, tax and credits; unexplained differences remain visible as variance and are never forced into commission.
- Re-running the same calculation with identical rule version and input snapshot yields byte-for-byte identical component values.
- Updating or archiving a rule never changes a historical order estimate or actual settlement.
- Missing/ambiguous rules never fall back to a hard-coded fee percentage or silently become zero.

## Out of scope until separately authorized

- Fetching or guaranteeing live fee rates from marketplace APIs. Seller-authenticated API access and supported fee-estimation endpoints must be researched and separately approved; user-configured rules and actual settlement imports are the initial source of truth.
- Guessing legal/tax treatment or marketplace formulae from generic public rate cards.
- Applying this migration to a production database before staging, backups and migration approval.
