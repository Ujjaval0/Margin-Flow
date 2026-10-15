# MarginFlow Store Integration — Production Architecture & Execution Plan

> **Status:** Active Execution Blueprint  
> **Security Level:** Zero-Trust / Enterprise Cryptographic Isolation  
> **Objective:** Upgrade store integrations (Amazon, Flipkart, Meesho, Myntra, WooCommerce, Shopify) from prototype simulation to a zero-leak, production-ready architecture with audited financial accuracy.

---

## Architecture Standards & Invariants

1. **Zero Silent Fallbacks**: Under no circumstance may any API failure, network drop, or empty query generate synthetic or sample orders. Errors must return explicit, structured HTTP error envelopes.
2. **Zero Client-Side Master Secrets**: Browser `localStorage` must NEVER store `clientSecret`, `appSecret`, `refreshToken`, or raw API keys. All credentials must be vaulted on the server in PostgreSQL, encrypted at rest using AES-256-GCM.
3. **Session-Bound Multi-Tenancy**: Every integration request must authenticate the merchant's session and restrict data mutations to `WHERE user_id = $1`.
4. **Idempotent Upsert Guarantee**: Synchronization must be idempotent using composite unique constraints (`marketplace` + `channel_order_id`). Re-running sync must never create duplicate financial ledger entries.
5. **No Financial Guesswork**: Never hardcode percentage estimates (e.g. flat 45% COGS or flat 14% commission). Ingest actual fee breakdowns, settlements, and line items from authentic marketplace APIs or official reports.
6. **Preserve Domain Integrity**: The financial calculation engine (`src/domain/profitability-engine.ts`) and ledger invariants must remain strictly untouched.

---

## Detailed Task Checklist & Execution Roadmap

### Phase 1: Purge Silent Mock Fallbacks & Lock Down API Errors
*Objective: Eliminate all synthetic order generation and false handshake verifications.*

- [x] **TASK-1.1: Purge Amazon Mock Fallback**
  - File: `src/app/api/integrations/amazon/sync/route.ts`
  - Remove `sampleProducts.map(...)` fallback block entirely.
  - Return explicit HTTP 502 with code `AMAZON_SYNC_FAILED` on LWA or SP-API failure.
  - Return `{ success: true, orders: [], totalFetched: 0 }` when zero orders exist in the query window.

- [x] **TASK-1.2: Purge Meesho Mock Fallback & Fake Verification**
  - File: `src/app/api/integrations/meesho/sync/route.ts`
  - Remove fake `try/catch` swallow on `supplier.meesho.com`.
  - Return HTTP 501 Not Implemented with code `MEESHO_API_ACCESS_UNAVAILABLE`.
  - Instruct the merchant to upload official Meesho Supplier CSV/XLSX reports.
  - Remove synthetic saree/earphone sample order generator.

- [x] **TASK-1.3: Purge Myntra Mock Fallback & Fake Verification**
  - File: `src/app/api/integrations/myntra/sync/route.ts`
  - Remove fake `try/catch` swallow on `partner.myntra.com`.
  - Return HTTP 501 Not Implemented with code `MYNTRA_PPMP_ACCESS_UNAVAILABLE`.
  - Remove synthetic clothing sample order generator.

- [x] **TASK-1.4: Purge Flipkart Mock Fallbacks & Fix Error Boundaries**
  - File: `src/app/api/integrations/flipkart/sync/route.ts`
  - Remove synthetic fallback orders and hardcoded 45% cost assumptions.
  - Return explicit HTTP 401/502 on invalid App ID / App Secret or network error.

- [x] **TASK-1.5: Enforce Standardized Error Envelope Across All Sync Endpoints**
  - Standardize error schema:
    ```json
    {
      "success": false,
      "code": "MARKETPLACE_ERROR_CODE",
      "error": "Human readable, actionable error message",
      "marketplace": "Amazon India",
      "timestamp": "ISO-8601"
    }
    ```

---

### Phase 2: Zero-Trust Cryptographic Vault & Database Persistence
*Objective: Migrate all credentials out of browser `localStorage` into PostgreSQL encrypted with AES-256-GCM.*

- [x] **TASK-2.1: Database Schema Migration for Marketplace Connections**
  - Create table `marketplace_connections` in PostgreSQL via `src/lib/db.ts`:
    - Columns: `id`, `user_id`, `marketplace`, `seller_id`, `marketplace_id`, `encrypted_credentials`, `auth_type`, `token_expires_at`, `is_active`, `last_sync_status`, `last_sync_cursor`, `last_synced_at`, `error_message`, timestamps.
    - Constraint: `UNIQUE (user_id, marketplace, seller_id)`.
  - Create table `marketplace_sync_logs` for tracking audit history of every sync run.

- [x] **TASK-2.2: Implement Server-Side AES-256-GCM Encryption Vault**
  - File: `src/lib/security/encryption.ts`
  - Implement `encryptPayload(data: Record<string, any>): string` using `crypto.createCipheriv("aes-256-gcm")`.
  - Implement `decryptPayload<T>(encryptedBlob: string): T` verifying the 128-bit authentication tag.
  - Guard: Add client-side bundle barrier (`typeof window !== "undefined"` throws fatal error).

- [x] **TASK-2.3: Purge Secrets from Browser `localStorage`**
  - File: `src/components/modules/webhook-simulator.tsx`
  - Remove `localStorage.setItem(STORAGE_CHANNELS_KEY)` for sensitive tokens.
  - The client UI holds only `{ id, marketplace, isConnected, lastSyncedAt, sellerId }`.
  - Secrets are submitted once to the server vault and never returned back to the browser.

- [x] **TASK-2.4: Build Server-Side Connection Management Routes**
  - Create `src/app/api/integrations/connections/route.ts`:
    - `GET`: Returns list of connected channels for the authenticated user (metadata only, no secrets).
    - `POST`: Stores new connection (validates, encrypts credentials with AES-256-GCM, saves to DB).
    - `DELETE`: Disconnects channel and securely revokes/removes vaulted tokens.

- [x] **TASK-2.5: Multi-Tenant Query Isolation**
  - Ensure every SQL query filters strictly by `WHERE user_id = $1` extracted from verified server session cookies.

---

### Phase 3: Amazon SP-API Modernization (Production Ready)
*Objective: Build an authentic Amazon India SP-API connector using current API versions.*

- [x] **TASK-3.1: Upgrade to Current Orders SP-API `v2026-01-01`**
  - File: `src/app/api/integrations/amazon/sync/route.ts`
  - Targets `sellingpartnerapi-eu.amazon.com` regional endpoint for India.
  - Queries with `MarketplaceIds=A21TJRUUN4KGV` and resolves line items from SP-API.

- [x] **TASK-3.2: Map Authentic Multi-Line Order Items**
  - Fetches genuine line items (`orderItems`) from the API (`/orders/v0/orders/{orderId}/orderItems` or embedded response).
  - Preserves authentic `SellerSKU`, `OrderItemId`, quantities, item prices, and item tax.
  - Locks `snapshotUnitCost: 0` (zero financial guesswork; cost is resolved strictly via catalog/purchase bills).

- [x] **TASK-3.3: Implement Cursor-Based Pagination & Overlap Window**
  - Handles Amazon's `NextToken` / `paginationToken`.
  - Stores the synchronization cursor and timestamp in `marketplace_connections` (`last_sync_cursor`, `last_synced_at`).
  - Implements a 48-hour bounded overlap window on `LastUpdatedAfter` to safely catch order status transitions.

- [x] **TASK-3.4: Build Separate Amazon Finances Ingestion**
  - File: `src/app/api/integrations/amazon/finances/route.ts`:
    - Ingests authentic referral fees, closing fees, weight handling fees, TCS GST, and TDS 194-O from SP-API Finances API (`/finances/v0/financialEvents`).
    - Produces canonical `Settlement` and `SettlementDeduction` records without arbitrary percentages.
    - Exposes `syncExternalSettlements` in `src/domain/store.tsx` for seamless frontend store ingestion.

- [x] **TASK-3.5: Atomic Database Upsert for Ingested Amazon Orders**
  - Created migration `database/10_orders_idempotency.sql` with unique indexes on `(channel_order_id, marketplace)` and `(settlement_batch_id, order_id)`.
  - Implemented `src/lib/integrations/order-persistence.ts` with `upsertOrders` and `upsertSettlements`.
  - Enforces `ON CONFLICT (channel_order_id, marketplace) DO UPDATE` and respects Trigger 2 invariant (immutable `snapshot_unit_cost`).
  - Writes immutable audit log entries into `financial_audit_logs`.

---

### Phase 4: Flipkart Two-Track Authentication & Real Sync
*Objective: Separate internal developer self-access from multi-tenant merchant OAuth.*

- [x] **TASK-4.1: Retain Self-Access for Internal Developer Staging**
  - Maintained `grant_type=client_credentials` strictly for internal staging testing.
  - Stored with `auth_type = 'SELF_ACCESS'` so it cannot be mistakenly used by external merchants.

- [x] **TASK-4.2: Implement Flipkart OAuth 2.0 Connect Route**
  - Created `src/app/api/integrations/flipkart/connect/route.ts`:
    - Generates cryptographically secure random `state` nonce via `createOAuthState`.
    - Caches state in DB / vault with a 10-minute expiry bound to merchant's `user_id`.
    - Redirects merchant to Flipkart Seller Hub authorization portal (`https://api.flipkart.net/oauth-service/oauth/authorize`).

- [x] **TASK-4.3: Implement Flipkart OAuth 2.0 Callback Route**
  - Created `src/app/api/integrations/flipkart/callback/route.ts`:
    - Verifies and consumes `state` nonce to prevent CSRF and replay attacks.
    - Exchanges authorization code for access & refresh tokens via server-to-server POST.
    - Encrypts tokens with AES-256-GCM and saves to `marketplace_connections` with `auth_type = 'OAUTH2'`.

- [x] **TASK-4.4: Upgrade Flipkart Sync Mapping**
  - File: `src/app/api/integrations/flipkart/sync/route.ts`
  - Reads vaulted tokens from DB, supporting both OAuth2 and Developer Self-Access.
  - Maps genuine `orderItems`, `fsn`, `sku`, and real `priceComponents` (selling price, discount, tax).
  - Strictly locks `snapshotUnitCost: 0` (zero financial guesswork; cost is resolved strictly through catalog COGS).
  - Atomically upserts orders into PostgreSQL and writes append-only audit entries to `financial_audit_logs`.

---

### Phase 5: Meesho & Myntra Enterprise File Import Integration
*Objective: Connect non-API marketplaces to high-performance CSV/XLSX settlement parsing.*

- [x] **TASK-5.1: Wire Meesho Directly to Official Report Import**
  - In `src/components/modules/webhook-simulator.tsx`, set Meesho's default mode to "Upload Official Supplier Report".
  - Wire to `CsvImportModal` using `csv-auto-mapper.ts` Meesho preset.
  - Support: Meesho GST Tax Invoice Report & Payment Settlement Report.

- [x] **TASK-5.2: Wire Myntra to Vendor Report Ingestion**
  - Set Myntra's default mode to "Upload Vendor Settlement Sheet".
  - Keep PPMP/Omni API integration ready for activation once partner API access keys are issued.

- [x] **TASK-5.3: Retain Full File Audit Metadata**
  - Persist original filename, file hash, upload timestamp, and seller account ID for every processed spreadsheet.
  - Implemented `file_import_logs` DDL & automated schema migration in `src/lib/db.ts`.
  - Dispatches full audit metadata (SHA-256 hash, rows, settlements) to `financial_audit_logs`.
  - Zero financial guesswork enforced (`snapshotUnitCost: 0`, no synthetic fee percentage estimations).

---

### Phase 6: Unified Contract & 10-Point "Definition of Done" Verification
*Objective: Standardize all connector outputs and verify production readiness.*

- [x] **TASK-6.1: Enforce Unified `MarketplaceSyncResult` Contract**
  - All sync routes must return:
    ```ts
    export interface MarketplaceSyncResult {
      marketplace: Marketplace;
      status: "pending" | "running" | "succeeded" | "partial" | "failed";
      fetchedCount: number;
      importedCount: number;
      updatedCount: number;
      skippedCount: number;
      lastSyncedAt: string;
      nextCursor?: string;
      errors: Array<{ code: string; message: string }>;
    }
    ```

- [x] **TASK-6.2: Verify the 10-Point Production Checklist**
  - [x] 1. Real authentication works with live credentials.
  - [x] 2. Invalid credentials & missing permissions produce explicit errors.
  - [x] 3. No API failure ever generates sample orders.
  - [x] 4. Multiple items in one order are mapped correctly.
  - [x] 5. Pagination retrieves the complete intended window.
  - [x] 6. Re-running sync is idempotent (no duplicate orders or duplicate audit logs).
  - [x] 7. Return and financial data are imported from authentic reports/APIs.
  - [x] 8. Records persist in PostgreSQL across server restarts and browser reloads.
  - [x] 9. Sync status, counts, and last sync timestamp are visible in the UI.
  - [x] 10. Strict multi-tenant isolation prevents cross-merchant data access.

- [x] **TASK-6.3: Production Build & TypeScript Verification**
  - Run `npm run build` with 0 TypeScript errors and 0 runtime warnings.
