# Financial release checklist

Local acceptance is complete. This file lists the remaining environment/evidence gates; it does not assert that a production release has occurred.

## 1. Protect current books

- Export the tenant's server books and any preserved local recovery snapshot. Retain original marketplace/invoice/bank evidence.
- Take an encrypted database and private-document backup. Restore it into an isolated target and compare tenant counts/control totals before touching production.
- Establish whether records are examples, genuine transactions or unverified. Do not correct sample amounts or infer tax registration from account metadata.

## 2. Review and apply schema on staging

Use the deployment's supported migration runner and existing applied-migration history. Never run a fresh baseline/bootstrap over an existing schema.

The additive financial migrations are, in order:

1. 20261019000100_calculation_evidence.sql
2. 20261019000200_financial_record_identity.sql
3. 20261019000300_canonical_financial_books.sql
4. 20261019000400_retire_legacy_financial_views.sql

The earlier production migrations remain prerequisites, including supplier payment allocations. The local fresh bootstrap has matching files22–25 and was verified separately. These chains were executed against disposable PostgreSQL; neither has been applied to a hosted target during this task.

Review duplicate/unowned legacy rows before applying unique indexes. Review dependencies on retired financial views; do not use CASCADE or destroy transactions to force a migration. Apply migrations before routing traffic to the new canonical adapters. The schema readiness check fails closed until required objects exist and the legacy profitability view is retired.

Run verification/001_read_only_schema_check.sql and verification/002_financial_readiness.sql against staging. Verify the actual runtime role has only required server permissions; anon/authenticated direct business-table access remains denied. Do not use a superuser or unrestricted Supabase postgres role as runtime credentials.

## 3. Inventory affected records without writing

From the repository root, with development verification dependencies installed:

```powershell
node financial-review-2026-10-19/financial-readiness.cjs --snapshot <owned-snapshot.json> --owner <account-id>
```

For a deliberately selected staging database, configure DATABASE_URL outside logs and use:

```powershell
node financial-review-2026-10-19/financial-readiness.cjs --database --owner <account-id>
```

The database mode opens a repeatable-read READ ONLY transaction. It prints counts, control totals and unresolved finding categories; it runs no migration, seed, financial correction or reset. Source authenticity remains unverified even when no reproduced calculation failure is found.

Resolve historical unknown costs/dates, partial supplier allocations, old aggregate Amazon settlement records, unresolved parents, partial fee coverage and ambiguous bank/event overlap from original statements. Existing immutable snapshots must not be silently replaced by current catalog cost. Nonempty books refuse opening-snapshot overwrite. Repeating an accepted opening import uses its command receipt and does not replay stock movements.

## 4. Verify deployed boundaries

- Configure actual Supabase Auth/callback origins and verify live logout revocation, expired sessions and deleted-account denial.
- Verify two real accounts/browsers cannot read, overwrite or hydrate one another's books or local snapshots.
- Verify private documents cannot be downloaded by a different account; provision and test the actual runtime role, storage service and credential encryption key.
- Use permitted provider staging/sandbox connections. Compare controlled orders, all source lines/taxes/discounts, signed financial events, bank receipts, partial supplier payments and returns/recoveries against source statements.
- Confirm network failure leaves drafts recoverable, retry does not duplicate cash/stock, and later events appear in their own accounting periods.
- Confirm mixed-state/refund-bearing unsupported payloads reject atomically; account-level/unmapped Amazon records remain visible as incomplete, without fake bank reconciliation.
- Confirm repeated bank fees/withholding link to prior financial events exactly once; do not import both as unrelated expenses/credits.

## 5. Accounting scope and release sign-off

MarginFlow supplies operational profitability and evidenced movement projections. Complete statutory opening balances, valuation-policy elections, tax return filing/matching/utilization, entity-specific retention and period locking are not certified by this repair.

Obtain actual GST registration, invoice price basis, classification, ITC and withholding-applicability evidence before presenting statutory results as final. Credit-card liabilities, pending GST, unallocated payments and unknown fee/cost amounts remain explicitly provisional where facts are missing. A balanced journal does not establish completeness.

Release only after staging migrations, target backup restoration, authentic-source reconciliation and deployed smoke checks pass. Preserve a rollback build and migration history; prefer a reviewed forward correction to destructive down-migrations over financial data.

Local evidence: FINANCIAL_REPAIR_PROGRESS.md; final-full-tests.log (354/354), production-build-release.log (58/58 pages), production-dependency-audit.json (zero known production vulnerabilities).
