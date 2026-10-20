# MarginFlow store integration audit

Research and verification date: **20 October 2026**.

This document records the **pre-fix investigation** and the documented platform requirements. Implementation has since progressed; see [the reliability plan](STORE_INTEGRATION_RELIABILITY_PLAN.md) and [deployment/onboarding guide](STORE_INTEGRATION_SETUP.md) for the current state. The findings below describe the original code, not the repaired implementation. Live seller authorization has not been performed.

## Findings that explain the reported symptoms

There are several independent problems. Correct credentials alone cannot make every current connection flow work.

| Priority | Finding | Consequence |
| --- | --- | --- |
| Immediate | The effective local environment has no `ENCRYPTION_MASTER_KEY`. | Development uses a temporary key. Credentials saved by one process cannot reliably be decrypted by another process or after restart. Production vault operations require a configured key. |
| Immediate | “Save & Sync Orders” does not save credentials to the server vault in the four implemented API connectors. Only their successful “Test Connection” handlers call the vault helper. | A first sync can work with the submitted credentials and show Active, while reconnecting after reload has no saved credentials. |
| Immediate | Flipkart's OAuth code exchange and refresh requests omit documented HTTP Basic client authentication. The UI does not initiate its existing OAuth connect route. | Correct partner credentials can fail at token exchange; the visible credential form instead selects self-access. |
| Immediate | WooCommerce's actual setup ping is not recognized. | Registering a valid delivery URL can fail with a 401 before real events start. |
| High | Shopify only accepts an already-issued access token. There is no Shopify token acquisition or renewal implementation. | A client ID/secret entered as a token fails immediately; a manually obtained short-lived token eventually expires. |
| High | Amazon's mapper requires prices on every order line, including pending orders. | One legitimate pending order without prices causes the complete import to fail with 502. |
| High | Meesho and Myntra credential forms call routes that deliberately return HTTP 501. | No credentials entered into these forms can establish an API connection in this build. |
| High | Webhook signing secrets are not collected/saved by the normal Shopify/WooCommerce setup. The local fallback environment secrets are absent. | Working REST credentials do not establish working signed webhooks. |
| High | Marketplace sync runs synchronously inside HTTP requests, with no provider retry/backoff or scheduled marketplace worker. | Larger imports, provider throttling, and transient outages can interrupt synchronization. |

The six active channel definitions are **Shopify, WooCommerce, Amazon India, Flipkart, Meesho, and Myntra**. Magento/Adobe Commerce is excluded at the user's request. BigCommerce is another coming-soon entry, outside the active six.

## What was verified in this workspace

- `npm run build` passed, including TypeScript checking, with no build warnings observed.
- The six store-integration phase suites, connector remediation suite, and database-connection suite passed: **102 tests, zero failures**.
- A network-sandbox-independent, read-only connection to the configured PostgreSQL database succeeded.
- The application's complete schema readiness query returned `ready: true`.
- The aggregate query on `marketplace_connections` returned **zero visible rows**. No stored seller credentials or personal records were read. This does not establish what is saved in a separate production deployment/database.
- Initial sandbox DNS failures also affected Amazon and Flipkart. They were an execution sandbox restriction, not evidence of a production database outage.

The tests primarily use mocks or source assertions. They are useful regression checks but do not verify provider approval, actual HTTP auth contracts, production environment variables, or live seller access. The existing [integration plan](<C:/Users/freak/Desktop/Unified platform/STORE_INTEGRATION_PLAN.md:98>) marks Amazon's 2026 migration and live authentication checks complete, while the code still uses Orders v0 and the selected tests do not demonstrate live authentication.

### Effective local configuration

Values were checked privately; secrets are intentionally omitted.

| Setting | Observation | Relevance |
| --- | --- | --- |
| `DATABASE_URL` | Present; remote host; TLS specified; port 5432; read-only check succeeded | Current database connectivity works from the unrestricted diagnostic process. |
| Supabase URL and public auth key | Present | Presence does not establish a valid signed-in user session. |
| `NEXT_PUBLIC_SITE_URL` | Present | Its production deployment and registered callback URLs still need comparison. |
| `ENCRYPTION_MASTER_KEY` | Missing | Confirmed vault persistence problem under process restarts; production vault blocker. |
| `FLIPKART_APP_ID`, `FLIPKART_APP_SECRET`, `FLIPKART_REDIRECT_URI` | Missing | Existing Flipkart OAuth connect/callback flow cannot run locally as configured. |
| `SHOPIFY_WEBHOOK_SECRET`, `WOOCOMMERCE_WEBHOOK_SECRET`, `GENERIC_WEBHOOK_SECRET` | Missing | Development substitutes test secrets. Production signed events need real matching secrets or per-connection secrets. |
| `APP_ORIGIN` | Missing | Production canonical-origin setting should be checked; absence alone does not prove the reported failure. |
| `CRON_SECRET` | Missing | Existing queue recovery endpoint cannot be authenticated as intended. It currently does not schedule store sync anyway. |
| `SUPABASE_SECRET_KEY` | Missing | Relevant to private document storage, not a missing Amazon/Shopify API key. |

## Credentials and connection method by platform

| Platform | Current fields | Required connection model | Verdict |
| --- | --- | --- | --- |
| Amazon India | LWA client ID, client secret, refresh token, optional seller ID | Private own-store app: self-authorization and LWA refresh. Customer stores: approved public app and seller OAuth consent; app credentials belong to MarginFlow's backend. | The three auth fields are appropriate for an authorized private integration. Public merchant onboarding is missing. |
| Flipkart | Application ID and application secret | Own-store application: client credentials. Aggregator/customer stores: registered partner app plus seller authorization-code flow and refresh tokens. | Current form routes merchants through the wrong model for a third-party SaaS. |
| Shopify | `.myshopify.com` domain and Admin API access token | Customer-store app installation/OAuth; own-organization app may use client credentials. Backend obtains and renews the appropriate token. | Token consumption exists; current token lifecycle/onboarding does not. |
| WooCommerce | Store URL, consumer key, consumer secret | HTTPS REST API Basic authentication; Read permissions for order ingestion. Webhooks need a separately matched signing secret. | Core REST credential set is correct. Webhook setup and durability have defects. |
| Meesho | Supplier ID and “API Key / Panel Session Token” | No verified public self-service seller API contract was established in this research. Obtain an approved integration contract from Meesho before defining auth fields. | Current API form has no functioning backend. Official report upload is the implemented path. |
| Myntra | Partner/vendor ID and API key/partner secret | Approved MMIP/PPMP/Omni integration with its actual inbound/outbound API contract. | Generic fields are insufficient to describe the integration; backend is unimplemented. |

### Amazon India

**Current code.** The route exchanges the submitted refresh token at Amazon's LWA endpoint, then requests orders from `sellingpartnerapi-eu.amazon.com`. The India marketplace ID is `A21TJRUUN4KGV`. Both selections are correct according to Amazon's [regional endpoints](https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints) and [marketplace identifiers](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids).

**Own-store setup.** Register the appropriate SP-API developer/application, obtain the necessary role approvals, self-authorize the private application, and retain the resulting refresh token. Public applications instead require seller authorization and Amazon's applicable distribution approval. These are separate onboarding models. See [Amazon onboarding](https://developer-docs.amazon.com/sp-api/docs/onboarding-overview).

The runtime auth inputs are the app's LWA client ID, client secret, and seller-authorized refresh token. Exchange them server-side using `grant_type=refresh_token`; use the resulting access token in `x-amz-access-token`. It lasts approximately one hour. Seller ID identifies an account; it is not an authentication substitute. Ordinary seller login credentials are not these API credentials. Current connection instructions do not call for collecting AWS access keys for this flow. See [Connect to SP-API](https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api).

**Customer-store setup.** MarginFlow needs its own registered app and registered redirect URI. Send the seller through Amazon consent; validate state on return; receive `selling_partner_id` and `spapi_oauth_code`; exchange the code within five minutes; encrypt the seller's refresh token. App client credentials remain on the server. There are no Amazon connect/callback routes implementing this in the current repository. See [website authorization](https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow).

Verify operation access separately: order operations require an appropriate order role, and the India finances workflow requires Finance and Accounting access. A valid LWA token alone does not establish either. Restricted personal data has additional requirements. See [operation role mappings](https://developer-docs.amazon.com/sp-api/docs/role-mappings).

**Required code corrections.**

1. [The order sync route](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/amazon/sync/route.ts:180>) still calls `/orders/v0/orders`; it has not migrated to Orders `v2026-01-01`. Amazon documents v0 as deprecated. Migrate requests, response fields, statuses, and pagination together. The replacement supports `searchOrders` and included financial/item data; changing the URL alone will break mapping. Deprecation is a migration requirement, not evidence that every v0 call already fails. See [Orders migration guide](https://developer-docs.amazon.com/sp-api/docs/orders-api-migration-guide).
2. [Line mapping](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/amazon/sync/route.ts:302>) throws when `ItemPrice` is missing. Amazon explicitly omits pricing/tax/shipping information for pending items. Defer incomplete financial projection and retry after authorization, or retain a pending source record; preserve the no-invented-money invariant. See [getOrderItems](https://developer-docs.amazon.com/sp-api/reference/getorderitems).
3. The connection test checks order access but does not validate order-item mapping or finances. Keep capability-specific verification so “Orders connected” does not imply settlements are available.
4. [The shared Amazon request helper](<C:/Users/freak/Desktop/Unified platform/src/lib/integrations/provider-pagination.ts:44>) only explicitly supplies access-token and Accept headers. Add the documented application User-Agent and request date in SP-API calls. The custom User-Agent currently appears on LWA requests, not these order requests. See [SP-API request headers](https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api).
5. Add provider-aware pacing, retries, and resumable execution. Current v0 item requests run serially without backoff. Amazon documents a default getOrderItems rate of 0.5 requests/second with burst capacity, so a larger initial import can encounter 429s. [Item operation reference](https://developer-docs.amazon.com/sp-api/reference/getorderitems), [rate-limit handling](https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits).

### Flipkart

Official setup distinguishes seller self-access from partner/aggregator access. For customer stores, register a verified partner app with an HTTPS redirect URL; sellers approve access through `https://api.flipkart.net/oauth-service/oauth/authorize` using client ID, redirect URI, `response_type=code`, `scope=Seller_Api`, and state. Exchange the returned code and subsequently refresh tokens using the documented token endpoint and HTTP Basic client authentication. Bearer tokens authorize seller API calls. Use returned expiry values and track refresh-token expiry/re-authorization as well as access-token expiry. Flipkart expressly limits self-access credentials to the seller's own use. See [Flipkart's authentication and application setup](https://seller.flipkart.com/api-docs/FMSAPI.html).

**Current discrepancies.**

- [OAuth callback](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/flipkart/callback/route.ts:80>) and [refresh](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/flipkart/sync/route.ts:70>) send form POST requests without an Authorization header; client credentials are placed in the body. The documented examples use token URL parameters with Basic authentication, including state in the code exchange. Align with that published contract rather than assuming alternative OAuth forms are accepted.
- [The existing connect route](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/flipkart/connect/route.ts:30>) is not called by the connection screen. Its required server environment variables are absent locally and undocumented in `.env.example`.
- The UI's App ID/Secret flow invokes client-credentials self-access. It labels this “Staging,” although it calls the production gateway. The code should select the actual approved integration model; a label does not constrain production access.
- Rotated access/refresh tokens are already saved after refresh, which is good. However, the code refreshes on every test/sync instead of using the stored access-token expiry, and does not retain `refresh_token_expires_in`.
- Order sync's incremental window filters **order creation date**, not update date. A much older order delivered or cancelled today can be missed after that creation window moves forward. Implement a documented status reconciliation strategy rather than treating `lastSyncedAt` as an updated-orders query.

The current shipment filter, separate NORMAL/SELF requests, and page-size 20 agree with the documented shipment API. That endpoint excludes Flipkart Advantage orders, so successful access does not mean every fulfillment program is covered. See [shipment search contract](https://seller.flipkart.com/api-docs/order-api-docs/v3/PostShipmentSearch.html).

### Shopify

Since **1 January 2026**, new legacy custom apps cannot be created in Shopify Admin; existing ones continue working. New setup uses the Dev Dashboard. The existing instructions to create/copy an Admin token from the old Admin flow are therefore unsuitable for new merchants. See [Shopify's change notice](https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026).

**Customer-store setup.** Create a suitably distributed app, configure its URLs/scopes, install it through merchant consent, validate state and callback HMAC, and exchange the code server-side. MarginFlow is currently an external app, so authorization-code flow fits its current shape. New public apps using GraphQL require expiring offline access tokens and renewal. See [standalone app authentication](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).

**Own-organization setup.** An installed app and store in the same Shopify organization may use the client-credentials grant at the shop's `/admin/oauth/access_token` endpoint. Backend inputs are shop domain, app client ID, and client secret. These tokens last about 24 hours and are renewed by repeating that grant. This is not an authorization mechanism for arbitrary customer stores. See [client-credentials guide](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant).

**Lifecycle detail.** Token mode matters: expiring offline access tokens currently have a one-hour lifetime and refresh tokens; online tokens are user-session-bound; legacy/custom non-expiring tokens have different rules. Existing public apps must migrate GraphQL access to expiring offline tokens by **1 January 2027**; the stated public-app deadline does not apply to custom/merchant-created apps. Persist the response metadata and implement the applicable renewal behavior. See [current token rules](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens).

**Current code changes needed.**

- [Shopify sync](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/shopify/sync/route.ts:36>) accepts only a domain/token pair. It neither obtains nor refreshes tokens. Pasting a client ID or client secret into the token field cannot work.
- It uses REST `2026-10`. The version is current at this audit date; the issue is that REST is legacy and new public apps must use GraphQL. Build the new connector on GraphQL rather than presenting the API version itself as broken. See [REST status](https://shopify.dev/docs/api/admin-rest).
- Use `read_orders` for the order workflow; request approved `read_all_orders` if history beyond the standard 60-day window is necessary. `read_products` is not automatically required just to list orders. Confirm protected customer-data access only for fields the mapper actually needs. See [access scopes](https://shopify.dev/docs/api/usage/access-scopes).
- Store the correct webhook signing secret for the chosen subscription mechanism. App-managed HTTPS webhooks use the app client secret, not the Admin access token. The UI currently saves neither signing secret nor app credentials. See [webhook verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries).

### WooCommerce

**Current REST credentials are correct:** canonical HTTPS store URL, consumer key, and consumer secret. Generate them under WooCommerce → Settings → Advanced → REST API for a user allowed to read orders; Read access is sufficient for ingestion. MarginFlow correctly sends key/secret as HTTP Basic auth to `/wp-json/wc/v3/orders`. Pretty permalinks are required; “Post name” is one possible configuration, not the only valid one. A proxy stripping Authorization can cause valid credentials to fail. See [WooCommerce REST authentication](https://woocommerce.github.io/woocommerce-rest-api-docs/).

Use the final canonical URL, including any WordPress installation subdirectory. The current outbound guard rejects redirects, so an HTTP URL, wrong www/non-www hostname, or redirecting host can produce a reachability error with valid keys. Fix URL/hosting configuration; do not indiscriminately follow redirects carrying credentials. Local/private addresses are also intentionally restricted.

**Webhook setup is independently broken.**

1. The native initial ping posts a body such as `webhook_id=123`; it does not use the synthetic ping topic sent by our UI. The receiver instead falls through to HMAC validation and returns 401. This was reproduced with the real handler and a mocked registered connection. Handle this narrow setup probe after connection-routing validation, without treating it as an order or proving live event access. See [WooCommerce's implementation of deliver_ping](https://raw.githubusercontent.com/woocommerce/woocommerce/trunk/plugins/woocommerce/includes/class-wc-webhook.php).
2. [Verify Endpoint](<C:/Users/freak/Desktop/Unified platform/src/components/modules/webhook-simulator.tsx:735>) posts to the bare route, omitting the required connection ID/routing key. It cannot test the copied registered endpoint correctly.
3. A real delivery uses the webhook's configured secret, which must match the receiver. [Our API setup](<C:/Users/freak/Desktop/Unified platform/src/components/modules/webhook-simulator.tsx:785>) saves the consumer secret but not `webhookSecret`; the resolver does not fall back to `consumerSecret`. Add an explicit, securely saved webhook signing secret. Do not assume the variable named `webhookSecret` in React is doing this: it is actually submitted as `consumerSecret`.
4. Replace the hard-coded development-secret guidance. Configure order-created and order-updated delivery as needed. WooCommerce can disable a webhook after repeated delivery failures, so inspect its delivery logs after correcting setup. See [webhook configuration and troubleshooting](https://woocommerce.com/document/webhooks/).

### Meesho

[The route](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/meesho/sync/route.ts:10>) unconditionally returns 501. The UI nevertheless asks for Supplier ID and “API Key / Panel Session Token” and points to a developer menu. Those instructions have no implemented API contract behind them.

Research did not establish an authoritative, public self-service seller auth specification or a universally available API-key menu. This is an evidence limitation, not proof that Meesho has no private partner integrations. Publicly indexed API templates and third-party descriptions are insufficient to define a supported connector.

For current functionality, use the application's official-report import. For a future direct connection, get Meesho's approved partner onboarding package: permitted endpoints, auth/signature specification, merchant binding, credential lifecycle, supported data, and callback requirements. Only then define required credential fields. Do not ask sellers for a browser panel session token as a substitute for a documented integration credential. Start through the [official supplier portal](https://supplier.meesho.com/); its public page could not be retrieved by the research browser during this audit.

### Myntra

Myntra has an official MMIP developer center with Omni/PPMP documentation, including order and return interaction flows. The published PPMP v4 flow includes seller-side endpoints receiving Myntra-created orders and status/return updates; it is more than a generic “fetch orders using an API key” connector. See [Myntra Developer Centre](https://mmip.myntrainfo.com/) and [PPMP v4 workflow](https://mmip.myntrainfo.com/documentation/myntra-ppmp-api-v4).

[Our route](<C:/Users/freak/Desktop/Unified platform/src/app/api/integrations/myntra/sync/route.ts:15>) always returns 501. Its blanket VPN/whitelisted-gateway explanation was not established as a universal rule by the public docs inspected. Treat network approval requirements as account/contract-specific until Myntra confirms them.

Obtain the seller's approved model, tenant/merchant identifiers, production/test endpoints, authentication and token contract, warehouse/store mapping, and inbound callback specifications. Build the adapter for that contract. A listing-management token specification must not be assumed to authorize order/return operations. Current generic partner-ID/secret fields cannot complete this onboarding. Report import remains the currently implemented option.

## Shared corrections needed to keep connections working

1. **Configure stable vault encryption before saving real credentials.** Use one secure server-only key shared by all instances that must read the same vault. Do not regenerate it per deployment. Existing ciphertext made with a lost temporary key requires reconnecting, not guessing another key. [Encryption implementation](<C:/Users/freak/Desktop/Unified platform/src/lib/security/encryption.ts:25>).
2. **Make Save & Sync durable.** Verify the submitted provider credentials, save them server-side, then synchronize using the saved connection identity. Report save failure distinctly. This is a correction to existing behavior, not a request for another button. [Current handlers](<C:/Users/freak/Desktop/Unified platform/src/components/modules/webhook-simulator.tsx:820>).
3. **Separate saved configuration from verified health.** `saveConnection` sets `is_active=true` for any nonempty credential dictionary. Reload maps `isActive` directly to Active, without rechecking provider access or expiry. Store verification/reauthorization state and capability results; avoid making “saved” mean “healthy.” [Vault save](<C:/Users/freak/Desktop/Unified platform/src/lib/security/marketplace-vault.ts:81>), [reload status](<C:/Users/freak/Desktop/Unified platform/src/components/modules/webhook-simulator.tsx:256>).
4. **Use explicit connection identity end to end.** The database can store multiple accounts, but client state is keyed only by platform. Amazon/Flipkart reject multiple active connections; Shopify/WooCommerce vault lookup also rejects ambiguity. `sellerId` alone is not consistently passed through the full sync path. Do not silently select or overwrite a different store. [Credential selection](<C:/Users/freak/Desktop/Unified platform/src/lib/security/marketplace-vault.ts:156>).
5. **Run reliable background sync.** Current `fetch_orders` requests fetch all pages and map everything before persistence. The queue has no marketplace sync processor; the cron only processes already-enqueued supported jobs. Add bounded provider jobs with per-connection checkpoints, retry/backoff, refresh handling, and recovery. Increasing an HTTP timeout alone does not provide continuity. [Job processors](<C:/Users/freak/Desktop/Unified platform/src/lib/queue/job-processors.ts:14>).
6. **Use durable webhook ingestion.** Existing handlers wait for complete ledger persistence before responding. Shopify expects an entire response within five seconds, so database delays can trigger retries. Acknowledge after verified durable receipt, then process asynchronously with deduplication. See [Shopify HTTPS delivery requirements](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries).
7. **Keep useful upstream diagnostics.** `collectPages` reduces provider failures to `Provider request failed (HTTP N)`. Preserve sanitized provider error code/message, request ID, operation, retryability, and connection identity. Record failures consistently; do not expose credentials. [Pagination helper](<C:/Users/freak/Desktop/Unified platform/src/lib/integrations/provider-pagination.ts:17>).

A store integration does not normally need one permanently open socket to the marketplace. Persistent authorization, durable encrypted credentials, renewable tokens, scheduled requests, and reachable webhook endpoints provide continuity. Closing the browser should not be the mechanism that stops ingestion.

## Recommended implementation order

| Step | Work | Acceptance evidence |
| --- | --- | --- |
| 1 | Stable encryption and effective deployment configuration; correct Save & Sync persistence | Save, reload, restart server, and successfully sync the same store without entering secrets again. |
| 2 | WooCommerce native ping, registered endpoint testing, correct signing-secret storage | Native webhook registration succeeds; signed created/updated deliveries persist once; invalid signatures fail. |
| 3 | Flipkart partner OAuth UI wiring and documented token/refresh requests | Seller consent, code exchange, order-access probe, expiry-driven refresh, reauthorization after refresh expiry. |
| 4 | Shopify installation/token lifecycle and GraphQL connector | New merchant can connect without copying an ad hoc token; scheduled sync still works after token expiry. |
| 5 | Amazon pending-order handling, modern Orders mapping, rate-aware execution, public onboarding as required | Authorized India account imports mixed pending/shipped orders without fabricated financials; order and finance permissions reported separately. |
| 6 | Make Meesho/Myntra capability text match implementation; obtain approved partner contracts | Report-only stores are not offered a nonfunctional API credential workflow; approved contracts define any later direct connector. |

## Reproduced failures and verification limits

Four ad hoc, in-memory probes executed actual application functions with synthetic secrets and mocked dependency boundaries. They made no provider writes and no database writes:

| Probe | Observed result |
| --- | --- |
| Encrypt with one isolated module instance and decrypt with another, without a configured master key | Decryption failed, reproducing restart/instance incompatibility. |
| Amazon order with `Pending` status and line identity/SKU/quantity but no item price | HTTP 502: `Amazon order line identity, SKU and INR price are required.` No order writes. |
| Flipkart callback against a simulated token endpoint requiring documented Basic client auth | Request had method POST, no Basic Authorization, no exchange state; HTTP 502 after simulated 401. This proves request shape and local handling, not an observed live Flipkart rejection. |
| WooCommerce native form-style `webhook_id=123` ping with a registered connection | HTTP 401 HMAC error. No order writes. |

The exact cause of a particular production merchant's last failure still requires its sanitized error code/request ID, deployed environment checks, and an authorized live provider read. This audit establishes several reproducible implementation/configuration gaps independently of whether that merchant's credentials are correct.
