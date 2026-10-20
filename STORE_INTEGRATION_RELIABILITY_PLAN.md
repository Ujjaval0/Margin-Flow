# Store integration reliability implementation

Scope: Amazon India, Flipkart, Shopify, WooCommerce, Meesho, and Myntra. Magento/Adobe Commerce is excluded.

## Current behavior and required behavior

| Area | Current behavior | Required behavior |
| --- | --- | --- |
| Credential storage | Encrypted database vault exists, but development can use a temporary encryption key; Save & Sync can skip saving | Stable server encryption key; verified credentials committed before synchronization; survive reloads/restarts |
| Credential changes | Raw fields exist without a distinct saved/update flow | Existing connection can be updated explicitly; blank fields retain saved secrets; failed verification preserves the working credentials |
| Access boundary | Some routes accept arbitrary credential dictionaries and expose exception messages | Owner-scoped connection identity, allowlisted fields, same-origin mutations, bounded inputs, safe error responses |
| Provider onboarding | Token-only Shopify and self-access Flipkart forms; no Amazon consent flow | Server-configured provider apps and seller consent; usable legacy own-store credentials retained where supported |
| Token lifecycle | Shopify has no renewal; Flipkart refresh differs from documented auth | Server-side acquisition, expiry-aware renewal, persisted rotated tokens, explicit reauthorization state |
| Webhooks | WooCommerce native setup ping fails; signing-secret and routed endpoint setup are inconsistent | Native setup handshake, registered delivery URLs, stored signing secrets, signature verification and durable deduplication |
| Synchronization | Long HTTP requests, no marketplace scheduling/recovery | Bounded durable background execution, retry/backoff, per-connection isolation and recovery |
| Provider data | Amazon v0 and pending-price failures | Current provider contract; incomplete financial data deferred without invented amounts |
| Unsupported direct APIs | Meesho/Myntra API forms always fail | Honest report-import workflow until approved partner contracts are available |

## Execution order

- [x] 1. Secure persistent vault and verified connection create/update API; configure a private stable local encryption key.
- [x] 2. Existing connection UI: safe metadata, explicit credential update, saved-secret reuse, durable Save & Sync, report-only capability corrections; remove excluded Magento listing.
- [x] 3. Provider authentication and authorization: documented Flipkart exchange/refresh, Shopify OAuth/renewal and GraphQL, Amazon seller consent and current Orders API.
- [x] 4. Webhook handshake, signing-secret persistence, durable processing and endpoint verification.
- [x] 5. Retry/backoff, durable marketplace scheduling and recovery with connection-scoped execution.
- [x] 6. Regression/security tests, production build, deployment runbook and outstanding live acceptance requirements.

These checks record implementation completion, not live provider/deployment acceptance. The additive database upgrade was applied without resetting merchant records; schema readiness, RLS and browser-role denial were verified. The full 403-test suite and production build passed; an additional Amazon pending-price/window regression and its provider suite also passed. Tests exercise real application code with synthetic provider fixtures and disposable PostgreSQL; they do not prove live seller credentials or app approval.

Use [STORE_INTEGRATION_SETUP.md](STORE_INTEGRATION_SETUP.md) for the exact credential matrix, secure deployment configuration, worker requirements, Meesho/Myntra partner/OMS routes and the remaining seller-account acceptance checks. Direct Meesho/Myntra connectors and an OMS bridge remain unimplemented until the appropriate account-issued API access is available. The final HTTPS domain, hosted app secrets, deployed scheduler and real seller authorization remain deployment work.

## Acceptance requirements

- Browser receives metadata only; saved API credentials and refresh tokens never appear in GET responses, browser storage, job payloads, or diagnostics.
- Verified saved credentials remain usable across independent server processes with the same encryption key.
- Updating credentials preserves connection identity and routing; rejected replacement credentials do not destroy the existing connection.
- Tenant A cannot read, update, synchronize, or disconnect tenant B's connection.
- Save & Sync saves before fetching; subsequent requests use the connection ID rather than resubmitting secrets.
- Native WooCommerce registration and signed order events work; invalid signatures cannot ingest data.
- Renewal persists returned token pairs and respects expiration; revoked consent requires reauthorization.
- Provider retries are bounded and do not bypass host/URL protections or fabricate records.
- Existing ledger, cost, accounting, and idempotency invariants remain covered by regression tests.
- Build and relevant tests pass. Live app approvals, deployment secrets, HTTPS callbacks, and seller-account acceptance are recorded separately from mocked tests.

## Deployment boundary

Provider app approvals and production hosting settings cannot be inferred from local files. Implementations must fail clearly when registration/configuration is missing. Platform-issued credentials can expire or be revoked; durable storage preserves authorization material, while renewal/re-authorization follows the platform's rules. Secrets belong in private environment settings and the encrypted database, never this plan.
