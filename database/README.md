# MarginFlow Database Setup Guide

## Local PostgreSQL (Testing Phase)

### Prerequisites
- PostgreSQL 15+ installed and running locally
- `psql` available in your terminal

### Step 1: Create the database
```bash
psql -U postgres -c "CREATE DATABASE marginflow_dev;"
```

### Step 2: Run the full schema
```bash
# Navigate to the database folder
cd "c:\Users\freak\Desktop\Unified platform\database"

# Run everything in one command
psql -U postgres -d marginflow_dev -f 00_run_all.sql
```

### Step 3: Verify
```bash
# Connect and check tables
psql -U postgres -d marginflow_dev -c "\dt"

# Check a view works
psql -U postgres -d marginflow_dev -c "SELECT * FROM v_inventory_metrics;"

# Check seed data loaded
psql -U postgres -d marginflow_dev -c "SELECT display_id, marketplace, status FROM orders ORDER BY order_date;"
```

---

## File Execution Order

| File | Contents | Notes |
|------|----------|-------|
| `01_enums.sql` | All PostgreSQL enum types | Run first |
| `02_tables.sql` | 20 core tables with FK constraints | Requires enums |
| `03_indexes.sql` | ~45 performance indexes | Requires tables |
| `04_triggers.sql` | 6 invariant-enforcement triggers | Requires tables |
| `05_views.sql` | 6 computed SQL views | Requires tables |
| `06_seed.sql` | Mock data from `mock-data.ts` | Requires all above |
| `07_rls_supabase.sql` | Supabase RLS policies | **Supabase only** |

---

## Key Invariants Enforced by Triggers

| Trigger | Rule |
|---------|------|
| `trg_audit_log_immutable` | `financial_audit_logs` is append-only — no UPDATE or DELETE |
| `trg_snapshot_cost_immutable` | `order_items.snapshot_unit_cost` can never be changed after creation |
| `trg_supplier_payment_sync` | `suppliers.total_paid` auto-updates when a payment is inserted/deleted |
| `trg_close_cost_window` | Only one active cost window (valid_to IS NULL) per product |
| `trg_sync_current_cost` | `products.current_cost_price` syncs automatically with new cost history |
| `trg_*_updated_at` | All `updated_at` columns auto-set on any UPDATE |

---

## What is NEVER stored in the DB

- AI API keys (`marginflow_ai_vault_v1` stays in browser localStorage only)
- Computed metrics: `grossProfit`, `contributionProfit`, `ROAS`, `POAS`, dashboard totals
- UI filter state: `selectedMarketplace`, `datePreset`
- Guardrail diagnostic results (computed on demand)

Use the SQL **Views** (`v_order_profitability`, `v_sku_profitability`, etc.) instead.

---

## Next Steps: Connecting to Next.js

```bash
# Install the PostgreSQL client
npm install pg @types/pg

# Or for Supabase
npm install @supabase/supabase-js
```

Add to `.env.local`:
```
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/marginflow_dev

# Supabase (production)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
