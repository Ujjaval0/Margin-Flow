# MarginFlow store onboarding and operations

Updated 20 October 2026. Covers Amazon India, Flipkart, Shopify, WooCommerce, Meesho and Myntra. Magento/Adobe Commerce is excluded.

## What each connection needs

| Platform | Merchant setup | Server/app setup | Current implementation |
| --- | --- | --- | --- |
| Amazon India | Seller authorizes the SP-API app; alternatively save the seller's LWA client ID, client secret and refresh token. Seller ID is an account identifier, not a password. | Approved SP-API app, LWA credentials, application ID and registered HTTPS redirect. Orders/financial roles as applicable. | Seller consent callback and manual own-account setup; EU endpoint / India marketplace; Orders 2026-01-01 with proceeds and fulfillment; separate existing Finances operation. No AWS access key or IAM secret requested. |
| Flipkart | Seller approves a partner app. Own-seller self-access can use Application ID and Application Secret. | Partner app ID/secret and exact registered callback for customer onboarding. | HTTP Basic token exchange, bearer API requests, expiry-aware renewal with database serialization, persisted rotated tokens, shipment pagination. Self-access credentials must belong to that seller. |
| Shopify | Enter the canonical `.myshopify.com` domain and authorize. Existing valid Admin tokens remain supported. An own-organization app can instead use its client ID/secret after installation. | Approved app, client ID/secret, exact callback, `read_orders`; additional approved `read_all_orders` access is needed for orders older than Shopify's default 60-day access. | Standalone OAuth, expiring offline-token renewal and own-organization client-credentials acquisition; GraphQL Admin 2026-10; paginated orders and line items. Client credentials alone do not authorize arbitrary customer stores. |
| WooCommerce | Canonical HTTPS store URL, REST Consumer Key and Consumer Secret from an API user with order read permission. | Publicly reachable HTTPS WordPress store, working `/wp-json/wc/v3/orders`, suitable permalinks, Authorization header preserved by hosting/proxy. | Server-side Basic auth over HTTPS, DNS/redirect protection, full numbered pagination, modified-date windows. A separate callback app is unnecessary for this manual REST-key flow. |
| Meesho | Official supplier reports, or approved API/OMS activation for the seller. | Account-issued integration contract or an approved OMS's own authorized API/export contract. | Report import available. Direct API entry is disabled until its real authentication, endpoint, lifecycle and merchant binding contract is available. |
| Myntra | Official reports, or seller/partner onboarding for the relevant PPMP/Omni model. | MMIP partner approval, actual authentication contract and seller callback requirements. | Report import available. Direct order integration is not implemented from a generic partner-ID/API-key guess. |

An app being registered does not establish that it has been approved, installed on the seller account, granted order permissions, or configured with the deployed callback URL. Connection verification now makes an actual order-read request before replacing saved credentials.

## Using the store screen

1. Open the store's existing configuration dialog. Authorize Amazon, Flipkart or Shopify when the server app is configured, or enter the supported own-store credentials. WooCommerce uses its REST-key fields.
2. Test Connection verifies access and saves encrypted credentials. Save & Sync also verifies and saves before creating a durable server job.
3. Later visits retrieve only connection metadata. Sync and verification use an owner-scoped connection ID; saved secrets are never returned to populate fields.
4. Use **Update credentials** to replace secrets. Blank secret fields retain saved values. A failed verification preserves the working saved connection. A different store/account requires disconnecting the existing connection first.
5. Disconnect deactivates the connection and clears its saved credential ciphertext. Provider-side app revocation is separate and can also be performed in the provider's portal.

API tokens can expire or be revoked. The database has no scheduled credential deletion: the stable encrypted authorization remains until replacement/disconnection, and renewable tokens are updated server-side according to platform rules. Back up the encryption key securely with the database; losing it makes existing ciphertext unrecoverable. Never change it as a routine deployment step.

## Webhook setup

- Save and verify the API connection first. Copy its generated connection-specific webhook URL from the existing webhook tab.
- Save the actual signing secret there. Shopify OAuth uses the app secret for app-created subscriptions. A manually created Shopify Admin notification webhook may use a different signing secret shown in that store's notification settings; save that exact secret instead.
- Register order-created and order-updated subscriptions in the relevant provider configuration. Endpoint reachability verification does not prove a valid signed delivery; send a real provider test/order event for acceptance.
- WooCommerce's native unsigned `webhook_id` form probe is accepted as reachability only. Unsigned order JSON is rejected. With a blank WooCommerce webhook Secret, WooCommerce uses the API user's consumer secret; a custom secret must match the per-connection saved secret.
- Shopify deliveries must match the saved shop domain and pass HMAC verification. Both providers require a delivery identifier. Verified deliveries are encrypted in PostgreSQL before acknowledgement; workers post orders and receipts atomically, deduplicate retries, then clear the queued payload.

## Deployment

The additive migrations `20261020000300_store_connection_reliability.sql` and `20261020000400_store_task_cascade.sql` in `production-supabase/migrations/` were tested in disposable PostgreSQL and applied to the configured database. They add `integration_tasks`, `provider_deferred_orders`, owner-binding foreign keys and protected server access, while preserving existing account/connection deletion behavior. No merchant records were reset or deleted. Both migration receipts are recorded. Fresh environments use all ordered migrations and the runtime-role operation; **never run the generated reset/bootstrap on a populated database**.

Set these privately in the deployment environment; use `.env.example` for variable names:

- A stable `ENCRYPTION_MASTER_KEY` (32 random bytes as 64 hexadecimal characters), `DATABASE_URL` with verified TLS and the restricted server runtime role, and a separate random `CRON_SECRET`.
- `APP_ORIGIN` and `NEXT_PUBLIC_SITE_URL` set to the final canonical HTTPS origin.
- Amazon: `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_APPLICATION_ID`, `AMAZON_REDIRECT_URI`; enable `AMAZON_APP_BETA=1` only for draft-app testing.
- Flipkart: `FLIPKART_APP_ID`, `FLIPKART_APP_SECRET`, `FLIPKART_REDIRECT_URI`.
- Shopify: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_REDIRECT_URI`, approved `SHOPIFY_SCOPES`.

Register the exact callback paths `/api/integrations/amazon/callback`, `/api/integrations/flipkart/callback`, and `/api/integrations/shopify/callback`. The final production domain and deployment secrets have not been supplied or configured by this task. A private stable encryption key and scheduler secret were generated in the ignored local environment; local configuration does not configure hosting.

For processing, choose the existing deployment model:

- Vercel: `MARGINFLOW_JOB_WORKER=0`; requests use `after()` and the authenticated `/api/jobs/process` cron recovers queued work. `vercel.json` now requests a one-minute schedule, which requires a plan supporting that frequency. Vercel Hobby's daily-only cron is insufficient; use a suitable hosting plan or an external authenticated scheduler. No plan purchase or scheduler deployment has been performed.
- Persistent Node host: `MARGINFLOW_JOB_WORKER=1` enables the durable processing loop in instrumentation. Keep the process supervised and the database reachable.

Jobs claim work with database leases and `SKIP LOCKED`, recover leases after five minutes, and retry up to five attempts with backoff. Safe provider reads retry transient failures; authorization-code/rotating-token exchanges are not replayed automatically. Dense windows divide before posting batches beyond 1,000 orders. Normal order polling runs every 15 minutes after catch-up, with an initial 30-day window and 48-hour overlap. Flipkart additionally reconciles the last 180 days by creation date once daily; older lifecycle changes need an official report or an expanded, deliberately operated reconciliation strategy. Webhooks supplement polling for Shopify/WooCommerce.

The cron currently processes one integration task per invocation; a persistent worker processes continuously. Initial catch-up time therefore depends on volume, platform rate limits and worker capacity. Database persistence survives browser/process restarts; processing still requires a running worker or functioning scheduler.

## Financial evidence and release acceptance

Amazon pending orders without monetary evidence are encrypted as deferred source records. Shopify/WooCommerce orders requiring refund reconciliation are also retained separately; valid unaffected orders can complete with a partial result. These deferred records are not sales or refund ledger entries. The existing accounting checks still reject unsupported currencies, inconsistent totals and missing required source evidence. Dated refund/return reconciliation is not automated by this connection repair.

Before calling the deployment production-ready, verify with an authorized seller on each enabled provider: consent/callback, order permission, paginated multi-line import, second sync without duplicates, reload/restart reuse, token expiry, revoked access, credential replacement, real signed webhooks, scheduler recovery and database backup/key recovery. No live seller credentials or live OAuth authorization were supplied, so these checks remain outstanding.

## Meesho and Myntra: the documented way forward

Myntra's official [MMIP workflow](https://mmip.myntrainfo.com/documentation) describes seller-facing order/status callbacks and PPMP/Omni business models. Obtain the appropriate partner package through its [developer centre](https://mmip.myntrainfo.com/) and [partner dashboard](https://securemmip.myntrainfo.com/). Public workflow documentation alone does not supply the account's full authentication contract.

An alternative is an approved OMS bridge. Unicommerce publishes [Meesho API activation/migration instructions](https://support.unicommerce.com/index.php/knowledge-base/meesho-migration-steps-for-uc-sellers/) and lists marketplace integrations in its [official integration catalogue](https://support.unicommerce.com/index.php/article-categories/integrations/). Myntra's [seller onboarding material](https://myntrascmuistatic.myntassets.com/partner-assets/partners/Sell_V1.pdf) also describes third-party OMS integrations. This establishes an onboarding path, not universal direct API access for MarginFlow. An OMS account, applicable subscription and approved export/API access would be needed before implementing that bridge. No third-party account was created or purchased.

Use official report import immediately while obtaining direct partner approval or OMS access. Browser session tokens, seller-panel scraping and undocumented endpoints do not provide a reliable authorized connector.

## Primary technical sources

- [Amazon searchOrders 2026-01-01](https://developer-docs.amazon/sp-api/lang-en_us/reference/searchorders), [seller authorization](https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications).
- [Flipkart authentication, app setup and shipment contract](https://seller.flipkart.com/api-docs/FMSAPI.html).
- [Shopify authentication](https://shopify.dev/docs/apps/build/authentication-authorization), [own-organization grant](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant), [standalone OAuth](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps), [Order permissions/schema](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order).
- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/), [webhook setup](https://woocommerce.com/document/webhooks/).
- [Vercel cron scheduling limits](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
