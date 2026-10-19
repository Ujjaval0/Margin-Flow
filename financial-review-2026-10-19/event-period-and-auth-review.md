# Read-only remediation design and test review

19 October 2026. No application or test edits. This supplements the independent calculation audit while the root agent implements repairs.

## Minimal event-period projection preserving existing callers

Keep `filterDatasetByDateRange` as a list/cohort filter. Its output cannot also be the complete context for financial event-period totals. Introduce `calculatePeriodProfitability(fullDataset, range)` or an optional scope argument to the existing profitability function. Existing all-time callers retain their signature and behavior until deliberately migrated.

The period implementation needs all historical orders, returns and settlements for the selected owner/channel. Compute cumulative recognized facts as of the end date and as of the day before the start date, and difference **flow amounts**. Expenses and actual bank receipts can be selected independently by their evidenced event dates. Outstanding receivables, unknown unpaid orders and aging are **closing balances**, not differences of period totals. Trend comparisons must compare the same kind of measure.

As-of mode must disable current-status full-return inference and aggregate item.returnedQuantity fallback unless the return has an evidenced event date. Otherwise filtering out a future return causes the core to fabricate a historical return from the present status. An order needs a persisted `recognizedAt`/`fulfilledAt` date. A legacy placement-date approximation must remain explicitly provisional; the historical delivery date cannot be reconstructed by code.

Actual settlement amounts must be selected by settlement/bank event date regardless of order placement date, recognized-sale status or current cancelled status. A cancellation does not erase an actual prior bank receipt. Marketplace finance accrual events are not automatically bank receipts.

### Stable allocation is mandatory before cumulative projection

An additional actual-function reproduction revealed a defect that cumulative differencing alone would preserve:

- One order has two lines of the same SKU, one unit each, costs ₹100 and ₹200.
- With only a damaged return `r1` dated 1 October, its attributed cost is ₹100.
- Add a sellable return `r2` dated 2 October. The same `r1` is now attributed ₹200; `r2` restores only ₹100.
- Current implementation therefore changes the earlier return's historical cost after a later event. Under its initial deterministic attribution, `r1` must remain ₹100 and `r2` must restore ₹200.

Cause: `getOrderFinancialFacts` assigns good quantities before damaged quantities at each line, independent of return event chronology (`src/domain/order-financials.ts:75–94`), then reconstructs return details from those condition budgets (`:112–130`).

Preferred: persist optional order-item identity on each return. For legacy SKU-only records use a documented stable order: return date, return ID, source line order; consume each line's remaining units chronologically. Once a return consumes a line's units, later returns cannot take them. Do not sort merely by condition. Source attribution unknowns still need reconciliation when repeated-SKU lines differ in price/cost.

### Period-specific edge cases

- An actual fee appearing later than the sale must not be silently backdated. If management estimates accrue before actual evidence, show an identified provisional accrual and a dated true-up; the statutory ledger currently excludes estimates.
- Undated legacy manual settlement/recovery/status-only return amounts cannot be safely assigned to a month. Retain amounts as unresolved evidence rather than inventing dates.
- Deduplicate events by owner + source identity, preserve marketplace scope, and retain the full original order for refunds and cost attribution.
- All channel, SKU and monthly projections must use the same event model; a corrected dashboard beside order-date-only reports is not a complete repair.

## Required financial invariants

1. **Actual cash:** account1010 movement reconciles to evidenced bank/cash receipt and payment events. It must not change because an order is cancelled, and must not be re-adjusted by expenses/recoveries already included in a net settlement.
2. **Receivable rollforward:** opening receivable plus recognized invoice amounts/output tax/shipping and recognized claim receivables, less credit notes/refunds, actual fee deductions, statutory withholdings and bank collections equals closing receivable. Positive-clamped aging totals do not replace signed receivables/control-account reconciliation.
3. **Claims:** a specific claim's recovery is attributed once; sum(return allocations) equals order recovery, equals eligible claim recovery facts. Approval, receivable recognition and bank receipt have distinct meanings and dates. Closing a claim cannot silently erase historical receipts.
4. **Salvage:** carrying value is between zero and attributable original cost and is supported by NRV. It restores inventory/reduces the applicable loss; it is not a new sale. Actual disposal proceeds require a dated cash/receivable sale and inventory derecognition. Claim reimbursement is not salvage.
5. **P&L:** total recognized revenue excludes output GST, deducts documented discounts/refunds and includes the separately documented shipping policy. COGS is based on evidenced historical cost; good-return cost reversals and damaged write-offs/salvage do not double count. Contribution and operating totals reconcile across ledger and reports, with any estimated-fee difference explicitly bridged.
6. **Allocation:** all paise and units are conserved; each event has stable attribution; adding a later event cannot rewrite an earlier event's cost or refund. Every scoped allocation sums to the authoritative source event.
7. **Time partition:** sum of adjacent disjoint period flow amounts equals their combined-period flow, for all dated evidence. An event cannot appear in two periods. Closing balance amounts are not summed as flows.
8. **Unknowns:** missing tax basis, cost, fee completeness, bank evidence or event date cannot become an asserted zero. Counts and provisional/unknown amounts must survive aggregation.

## The 22 failing tests

The independent fresh suite run completed at **309 tests / 287 pass / 22 fail**. A prior root run recorded 308/286/22; a newly added passing test explains the count difference. The following are the 22 failed **leaf tests**, excluding failed parent suites.

| File / group | Count | Failure cause | Behavioral replacement |
| --- | ---: | --- | --- |
| `phase1-security.test.mjs` 1.1, 1.3, 1.4 | 3 | Requires local HMAC calls, local verification and removed signSessionToken export | Exercise actual getSessionUser with mocked Supabase getClaims success/error/null/malformed sub and mocked owner-account query; unsigned headers/legacy cookies must not grant access |
| `phase1-security.test.mjs` 4.1, 4.2, 4.3 | 3 | Requires removed local password/session issuance and deleted Google-token endpoint | Exercise signInWithPassword, signUp confirmation/session branches, PKCE callback exchangeCodeForSession and confirmed account mapping; ensure failures do not report success |
| `remediation-release.test.mjs` first ten F15 cases | 10 | Removed signer/issuer/revoker/registry contracts; login503 test mocks old DB/password backend and never mocks current Supabase boundary | Preserve each security intent through Supabase-boundary tests: invalid claims deny, owner mapping is scoped, missing account/DB outage deny, logout failure/cross-origin denied, session revocation verified where required, configured provider mandatory |
| `remediation-security.test.mjs` OAuth-only login and both Google tests | 3 | Password-login test mocks old account/password_hash DB; Google route no longer exists | Mock Supabase password authentication to fail and verify401/no account write; mock callback code exchange failure and verified confirmed-user account mapping |
| `remediation-persistence.test.mjs` missing account / identity outage | 1 | Mocks verifier as already successful, then expects /auth/me to repeat verification which current verifier performs itself | Load actual session verifier plus Supabase boundary; supply valid verified subject but no owner row/DB exception; assert actual route denies. Current verifier returns null for either condition; choose401 or a documented typed503 contract |
| `store-integration-phase2.test.mjs` ensureMarketplaceTables | 1 | Matches exact `export async function` spelling and expects request-time DDL | Behaviorally assert readiness is read-only, missing required column/table rejects, successful check is cached, failed check retries, no DDL issued |
| `store-integration-phase6.test.mjs` Point10 | 1 | Requires old `marginflow_session` string in session implementation | Exercise verified Supabase subject-to-owner mapping and connection queries bound to that owner; malformed/unsigned client identities deny |

All22 failures are obsolete test **contracts**. This does not prove all associated security **behavior** is correct. Do not restore the local HMAC APIs merely to satisfy old tests, and do not replace meaningful security assertions with source-name checks.

### A genuine revocation behavior gap must be retained as an acceptance requirement

Current `src/lib/security/session.ts` verifies `supabase.auth.getClaims()` and finds a MarginFlow account, without checking that the JWT's session is still live. `src/app/api/auth/logout/route.ts` calls Supabase signOut. The old F15 assertion that a copied still-unexpired session immediately stops authorizing access cannot be assumed to hold after this transition.

Official [Supabase advanced SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) explains that claims verification checks signature/expiry and does not itself detect a revoked session. [Supabase sessions documentation](https://supabase.com/docs/guides/auth/sessions) identifies JWT session_id and the associated auth.sessions row, removed when the relevant session is signed out. Normal stateless JWT validity and immediate revocation are different contracts.

If immediate logout revocation remains the intended requirement, the protected verifier must check suitable authoritative session liveness (or an appropriate current-user/session verification design), and a replacement regression must keep a valid signature/expiry while changing only authoritative liveness to prove denial after logout. Provider error and account DB outage must still fail closed. A test that only mocks getClaims to fail after logout does not demonstrate that the application implements revocation.

### Test boundaries

Mock `@/lib/supabase/server` and `@/lib/auth/supabase-account` where appropriate, not removed local session methods. Mock DB only when exercising the actual session/account mapper. Avoid live provider/network dependencies in the suite. Test HTTP behavior, query ownership and cookie-adapter calls; external provider token cryptography itself belongs to the provider library/integration tests rather than an alternative implementation in the test.
