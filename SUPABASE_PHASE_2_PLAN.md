# MarginFlow — Supabase Phase 2 Production Architecture Plan

This document outlines the end-to-end, foolproof engineering blueprint for transitioning **MarginFlow** from client-side `localStorage` and serverless polling proxies to a production-ready **Supabase (PostgreSQL + Realtime)** architecture.

---

## 1. Executive Summary & Objective

In **Phase 1**, we resolved the immediate WooCommerce connectivity and order fetching issue via a **Serverless REST API Proxy Sync** (`/api/integrations/woocommerce/sync`) that operates without a database on both local environments and Vercel.

In **Phase 2**, we establish a resilient **Supabase** backend that:
1. **Enables Real-Time Webhooks on Vercel**: Incoming webhooks from WooCommerce, Shopify, and other channels are received by serverless lambdas, verified cryptographically, and persisted immediately into Supabase.
2. **Instant Browser Synchronization (Zero Refresh)**: Utilizes **Supabase Realtime (WebSockets)** to broadcast new orders, returns, and settlements directly to open browser tabs in `< 500ms`.
3. **Idempotency & Replay Defense**: Prevents duplicate financial entries and double-counting of sales or ledger movements using database-enforced unique constraints.
4. **Multi-Store Isolation**: Enforces **Row-Level Security (RLS)** so that merchant credentials, orders, and financial data are cryptographically isolated.

---

## 2. End-to-End System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL CHANNELS & STOREFRONTS                       │
│                                                                             │
│   [ WooCommerce / WordPress ]            [ Shopify / Custom POS ]           │
│   • Webhook: order.created               • Webhook: orders/create           │
│   • REST API: /wp-json/wc/v3             • REST API: Admin GraphQL          │
└──────────────────────┬──────────────────────────────────┬───────────────────┘
                       │ HTTP POST (HMAC-SHA256)          │
                       ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   VERCEL SERVERLESS LAYER (Next.js 15)                      │
│                                                                             │
│   /api/webhooks/woocommerce                  /api/webhooks/shopify          │
│   ├── 1. Fast Ping Check (200 OK)            ├── 1. Size & Replay Guard     │
│   ├── 2. Fetch Store Secret (Supabase)       ├── 2. HMAC-SHA256 Check       │
│   ├── 3. Verify HMAC-SHA256 Signature        ├── 3. Canonical Schema Map    │
│   └── 4. Atomic Database Ingestion           └── 4. Atomic Database Insert  │
└──────────────────────┬──────────────────────────────────┬───────────────────┘
                       │                                  │
                       ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PERSISTENCE LAYER                          │
│                                                                             │
│   [ webhook_events ]  ──►  [ orders ] & [ order_items ]  ──►  [ audit_logs ]│
│   • Raw JSON payload       • Composite Unique Key             • Immutable   │
│   • Delivery status        • ON CONFLICT DO UPDATE            • Financial   │
│   • Verification audit     • Inventory deductions               trail       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ Supabase Realtime (PostgreSQL CDC)
                                       │ `postgres_changes` via WebSockets
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLIENT DASHBOARD (Browser / React)                      │
│                                                                             │
│   PlatformProvider (`store.tsx`)                                            │
│   • WebSocket listener automatically appends new orders to React state      │
│   • Live recalculation of Profitability, COGS, Anomaly Radar, and Ledger    │
│   • Automatic fallback to SWR polling if WebSocket drops                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & Migration Strategy

The migration utilizes the prepared SQL assets in [`database/`](file:///c:/Users/freak/Desktop/Unified%20platform/database) with the addition of the `channel_integrations` table.

### 3.1 Migration Execution Order
1. [`01_enums.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/01_enums.sql): `marketplace_enum`, `order_status_enum`, `claim_status_enum`, `user_role_enum`.
2. [`02_tables.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/02_tables.sql): Core financial entities (`orders`, `order_items`, `products`, `settlements`, `claims`, `expenses`).
3. [`03_indexes.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/03_indexes.sql): Performance and composite query indexes.
4. [`04_triggers.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/04_triggers.sql): Automated timestamps and balance guards.
5. [`05_views.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/05_views.sql): Canonical financial calculation views (`v_order_profitability`, `v_settlement_reconciliation`).
6. [`07_rls_supabase.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/07_rls_supabase.sql): Row Level Security policies.
7. [`08_webhooks_notifications_softdelete.sql`](file:///c:/Users/freak/Desktop/Unified%20platform/database/08_webhooks_notifications_softdelete.sql): Ingestion pipeline audit tables (`webhook_events`, `notifications`).

### 3.2 The New Table: `channel_integrations`
This table securely stores merchant connection settings, API credentials, and webhook secrets:

```sql
CREATE TABLE channel_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  marketplace           marketplace_enum NOT NULL,
  store_name            TEXT NOT NULL,
  store_url             TEXT,
  
  -- Encrypted credentials (AES-256-GCM)
  api_key_encrypted     TEXT,
  api_secret_encrypted  TEXT,
  webhook_secret        TEXT NOT NULL,
  
  status                TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'ERROR'
  last_health_check_at  TIMESTAMPTZ,
  last_synced_at        TIMESTAMPTZ,
  total_orders_synced   INTEGER DEFAULT 0,
  last_error_message    TEXT,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_user_marketplace_store UNIQUE (user_id, marketplace, store_url)
);

CREATE INDEX idx_channel_integrations_lookup 
  ON channel_integrations (marketplace, store_url);
```

### 3.3 Idempotency Invariants on `orders`
To prevent duplicate orders from recurring webhook deliveries or manual sync overlaps:

```sql
-- Enforce composite uniqueness
ALTER TABLE orders 
  ADD CONSTRAINT uq_orders_marketplace_channel_id 
  UNIQUE (marketplace, channel_order_id);
```

---

## 4. Webhook Ingestion Pipeline (Production Hardening)

### 4.1 WordPress Ping Handling
When creating a webhook in WordPress WooCommerce (`Settings > Advanced > Webhooks`), WooCommerce issues an immediate test ping (`topic: action.woocommerce_webhook_ping`, body `{"webhook_id": 123}`).
* **Rule**: The route must immediately return `200 OK` without requiring order schema parsing or line items.
* **Result**: WordPress marks the webhook delivery status as **Active** rather than **Disabled**.

### 4.2 Dynamic HMAC-SHA256 Verification
* The webhook endpoint queries Supabase for the merchant's `webhook_secret` matching the request source domain (`X-WC-Webhook-Source`).
* If no custom secret is stored, it falls back to the environment variable `WOOCOMMERCE_WEBHOOK_SECRET`.
* Performs constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.

### 4.3 Atomic Database Ingestion Transaction
When an order arrives via webhook:
1. **Idempotency Check**: Check `webhook_events` for `idempotency_key = 'WOOCOMMERCE:order.created:<id>'`. If present, return `{ deduplicated: true }` (HTTP 200).
2. **Log Raw Event**: Insert raw JSON payload into `webhook_events` with status `PENDING`.
3. **Atomic Upsert**:
   ```sql
   INSERT INTO orders (
     id, channel_order_id, marketplace, order_date, status, 
     customer_name, customer_city, customer_state, shipping_fee_charged, 
     marketplace_charges_estimate, notes
   ) VALUES ($1, $2, 'WooCommerce', $3, $4, $5, $6, $7, $8, $9, $10)
   ON CONFLICT (marketplace, channel_order_id) DO UPDATE SET
     status = EXCLUDED.status,
     notes = EXCLUDED.notes,
     updated_at = now()
   RETURNING id;
   ```
4. **Order Items Upsert**: Insert or update associated line items in `order_items`.
5. **Update Event Status**: Update `webhook_events` to `PROCESSED`.

---

## 5. Client Real-Time Synchronization (Supabase Realtime)

### 5.1 Supabase Client Architecture
* **`src/lib/supabase/client.ts`**: Browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
* **`src/lib/supabase/server.ts`**: Server-only client using `SUPABASE_SERVICE_ROLE_KEY` (strictly isolated from client bundles).

### 5.2 Realtime Subscription in `store.tsx`
When the merchant opens MarginFlow in their browser:
```typescript
useEffect(() => {
  if (!supabaseClient) return;

  const channel = supabaseClient
    .channel("realtime:orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => {
        if (payload.eventType === "INSERT") {
          // Prepend new order to state
          syncExternalOrders([mapDbOrderToDomain(payload.new)]);
        } else if (payload.eventType === "UPDATE") {
          // Update status in state
          updateOrder(mapDbOrderToDomain(payload.new));
        }
      }
    )
    .subscribe();

  return () => {
    supabaseClient.removeChannel(channel);
  };
}, [supabaseClient]);
```

### 5.3 Resilient Fallback Strategy
* **Heartbeat & Reconnect**: If WebSockets drop (e.g. laptop sleep or network switch), the client runs a lightweight catch-up query:
  `GET /api/orders?since=<last_synced_timestamp>`
* Seamless reconciliation guarantees zero lost orders during temporary disconnections.

---

## 6. Security, Encryption & Environment Configuration

### 6.1 Required Environment Variables
Add to `.env.local` and Vercel Project Settings:

```env
# Supabase Connectivity
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require"

# Webhook Secrets
WOOCOMMERCE_WEBHOOK_SECRET="your-secure-wc-webhook-secret"
SHOPIFY_WEBHOOK_SECRET="your-secure-shopify-secret"
GENERIC_WEBHOOK_SECRET="your-secure-generic-secret"

# Credential Encryption Key (32-byte hex string for AES-256)
CREDENTIAL_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

### 6.2 Zero-Trust Boundaries
* `SUPABASE_SERVICE_ROLE_KEY` and `CREDENTIAL_ENCRYPTION_KEY` **must never** be exposed to browser bundles.
* Row-Level Security (RLS) is enabled on all tables in Supabase. Authenticated users can only read records belonging to their `tenant_id` or `user_id`.

---

## 7. Phase 2 Implementation Steps

| Step | Task | Target Files |
| :--- | :--- | :--- |
| **2.1** | **Supabase Project Setup**<br>Execute SQL migrations in Supabase SQL Editor. Enable Realtime on `orders` and `notifications` tables. | `database/00_run_all.sql`<br>`database/08_webhooks_notifications_softdelete.sql` |
| **2.2** | **Supabase Client SDK Integration**<br>Install `@supabase/supabase-js`. Create server and client Supabase factories. | `src/lib/supabase/client.ts`<br>`src/lib/supabase/server.ts` |
| **2.3** | **Database-Driven Webhook Handler**<br>Update WooCommerce webhook endpoint to write directly to Supabase (`webhook_events` & `orders`). | `src/app/api/webhooks/woocommerce/route.ts` |
| **2.4** | **Hybrid Store Hydration**<br>Update `store.tsx` to hydrate initial ledger from Supabase on mount, falling back to local snapshot if offline. | `src/domain/store.tsx` |
| **2.5** | **Realtime WebSocket Connection**<br>Attach live listener in `PlatformProvider` for order insertions and status updates. | `src/domain/store.tsx` |
| **2.6** | **Credential Vault Migration**<br>Migrate credentials from `localStorage` into the encrypted `channel_integrations` table. | `src/app/api/integrations/woocommerce/sync/route.ts` |
| **2.7** | **End-to-End Verification**<br>Trigger live test order from WooCommerce. Verify DB persistence and instantaneous UI display. | End-to-end verification suite |

---

## 8. Verification Checklist for Phase 2 Deployment

- [ ] **WordPress Ping**: Saving webhook in WooCommerce responds HTTP 200 and stays "Active".
- [ ] **Cryptographic Auth**: Tampered or incorrect HMAC signatures return HTTP 401. Valid signatures pass.
- [ ] **Replay Defense**: Submitting the same webhook ID twice returns HTTP 200 with `{ deduplicated: true }`.
- [ ] **Database Integrity**: An incoming order creates rows in both `orders` and `order_items` tables with verified foreign key constraints.
- [ ] **Realtime Propagation**: A new order placed on WooCommerce appears in the MarginFlow Orders list within 500ms without manual page refresh.
- [ ] **Calculations**: Profitability, COGS, tax, and contribution margins update automatically upon order arrival.
- [ ] **Build Quality**: `npm run build` compiles with zero TypeScript errors and zero warnings.
