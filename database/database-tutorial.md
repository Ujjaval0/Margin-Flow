# MarginFlow: Complete PostgreSQL Setup & Connection Guide

This tutorial provides a complete, step-by-step guide for setting up the MarginFlow PostgreSQL database from scratch, running the master setup script, and connecting the database to the Next.js web application.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Part 1: Installing & Opening PostgreSQL / pgAdmin 4](#part-1-installing--opening-postgresql--pgadmin-4)
3. [Part 2: Creating the Database](#part-2-creating-the-database)
4. [Part 3: Executing the Master Setup Script](#part-3-executing-the-master-setup-script)
5. [Part 4: Verifying the Tables & Views](#part-4-verifying-the-tables--views)
6. [Part 5: Connecting the Database to the Website](#part-5-connecting-the-database-to-the-website)
7. [Part 6: Verifying Real-Time Connectivity](#part-6-verifying-real-time-connectivity)
8. [Troubleshooting & Common Questions](#troubleshooting--common-questions)
9. [Quick Reference SQL Queries](#quick-reference-sql-queries)

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

| Component | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **PostgreSQL** | Version 14, 15, 16, 17, or 18 | Relational database engine |
| **pgAdmin 4** | Version 7 or newer | Visual database management interface |
| **Node.js** | Version 18.x or 20.x+ | Next.js website runtime |
| **MarginFlow Codebase** | Latest repo | Application source code & SQL scripts |

---

## Part 1: Installing & Opening PostgreSQL / pgAdmin 4

If you already have PostgreSQL and pgAdmin 4 installed, skip to [Part 2](#part-2-creating-the-database).

1. **Download PostgreSQL**:
   - Visit the official download page: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
   - Select your Operating System (Windows, macOS, or Linux) and download the installer by EDB.

2. **Run the Installer**:
   - Check all default components:
     - PostgreSQL Server
     - pgAdmin 4
     - Command Line Tools
   - **Master Password**: When prompted for a password for the `postgres` superuser account, enter a secure password (for example: `marginflow123`) and **remember it**.
   - **Port**: Keep the default port `5432`.
   - **Locale**: Keep default `[Default locale]`.
   - Complete the installation.

3. **Open pgAdmin 4**:
   - Search for **pgAdmin 4** in your system start menu / applications and launch it.
   - Enter your master password when prompted.

---

## Part 2: Creating the Database

1. In pgAdmin 4, look at the left sidebar (**Object Explorer**).
2. Expand **Servers** ➔ click on **PostgreSQL (Local)**.
3. Right-click on **Databases** ➔ select **Create** ➔ click **Database...**.

```text
Object Explorer
 └── Servers
      └── PostgreSQL 18
           └── Databases  <--- [Right-Click -> Create -> Database...]
```

4. In the dialog box:
   - **Database**: `marginflow_dev`
   - **Owner**: `postgres`
5. Click **Save**.

Your new database `marginflow_dev` will now appear in the list under Databases.

---

## Part 3: Executing the Master Setup Script

MarginFlow provides a single, self-contained master setup script:
`database/marginflow_complete_setup.sql`.

This script automatically creates:
- The `pgcrypto` extension (for UUID generation)
- 16 custom PostgreSQL ENUM types
- 22 normalized database tables with foreign keys and check constraints
- 50+ optimized performance indexes
- 6 automated triggers (immutable cost locking, audit log protection, price-window closing)
- 8 real-time computed views (Order Profitability, SKU Profitability, Aging, Recycle Bin, Notifications)
- Complete deterministic seed data matching the mock store

### Step-by-Step Execution:

1. In pgAdmin's left panel, expand `Databases` ➔ right-click on `marginflow_dev` ➔ select **Query Tool**.
2. A new Query Tool tab titled `marginflow_dev/postgres@...` will open.
3. Click the **Open File (Folder Icon)** in the Query Tool toolbar (or press `Ctrl + O`).
4. Browse to your project folder and select:
   ```text
   database/marginflow_complete_setup.sql
   ```
   *(Alternatively, you can open the file in VS Code / Notepad, copy all lines, and paste them directly into pgAdmin's Query Tool).*

5. **CRITICAL STEP — Select All Before Executing**:
   - Click anywhere inside the SQL code editor in pgAdmin.
   - Press **`Ctrl + A`** on your keyboard so all 1,400+ lines are highlighted in blue.
   - Press **`F5`** on your keyboard (or click the **first single Play button ▶** in the toolbar).

> [!WARNING]
> Do **NOT** click the secondary play button with a line (`▶|` - *Execute current line/statement*). If you click that button, pgAdmin will only execute a single line of code instead of the entire script! Always press `Ctrl + A` followed by `F5`.

### What to Expect During Execution:

- **Harmless Notices**: You may see multiple lines in the Messages tab saying:
  `NOTICE: table "orders" does not exist, skipping`
  This is 100% normal. The script begins with clean `DROP ... IF EXISTS CASCADE` commands so it can be re-run safely anytime.
- **Execution Time**: The script typically takes **1 to 3 seconds** to create everything and populate seed records.

---

## Part 4: Verifying the Tables & Views

When the script finishes running, look at the **Data Output** tab at the bottom of pgAdmin. You will see the verification result:

| status | total_tables | total_views | total_products | total_orders | total_returns | total_claims | total_settlements | total_suppliers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Setup Complete!** | **22** | **8** | **4** | **16** | **5** | **2** | **3** | **2** |

### Refreshing the Object Explorer Tree:

1. In the left panel, navigate to:
   `Servers` ➔ `PostgreSQL` ➔ `Databases` ➔ `marginflow_dev` ➔ `Schemas` ➔ `public`.
2. Right-click on **Tables** ➔ select **Refresh**.
3. Click the arrow (`>`) next to Tables. You will see all 22 tables:
   - `user_accounts`
   - `suppliers`, `supplier_payments`, `purchase_bills`
   - `products`, `product_cost_history`, `product_channel_aliases`
   - `orders`, `order_items`
   - `return_records`, `claims`, `claim_documents`
   - `settlements`, `settlement_deductions`
   - `expenses`
   - `ai_staged_documents`, `ai_staged_fields`
   - `financial_audit_logs`, `customer_complaints`
   - `webhook_events`, `notifications`, `background_jobs`

4. Right-click on **Views** ➔ select **Refresh**. You will see all 8 computed views:
   - `v_order_profitability`
   - `v_sku_profitability`
   - `v_marketplace_profitability`
   - `v_settlement_aging`
   - `v_inventory_metrics`
   - `v_claims_summary`
   - `v_unread_notification_count`
   - `v_recycle_bin`

---

## Part 5: Connecting the Database to the Website

In Next.js, the web browser cannot connect directly to PostgreSQL. Instead, the Next.js server acts as the secure bridge:

```
[ Browser / Frontend ]
          │
          ▼ (HTTP / API Fetch)
[ Next.js Server (src/app/api/...) ]
          │
          ▼ (PostgreSQL Connection Pool - Port 5432)
[ PostgreSQL Database (marginflow_dev) ]
```

### Step 1: Configure Environment Variables (`.env.local`)

In the root of your project directory (`c:\Users\freak\Desktop\Unified platform\`), locate or create a file named `.env.local`.

Add your database connection string:

```env
# MarginFlow PostgreSQL Database Configuration
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/marginflow_dev"

# Google Gemini AI Key (For Document OCR & CFO Copilot)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GOOGLE_GENERATIVE_AI_API_KEY="YOUR_GEMINI_API_KEY"
```

> [!NOTE]
> Replace `YOUR_PASSWORD` with the password you set for the `postgres` user in pgAdmin.  
> If you set `marginflow123`, the connection string is:
> `DATABASE_URL="postgresql://postgres:marginflow123@localhost:5432/marginflow_dev"`

#### What if I forgot my pgAdmin password?
Because pgAdmin is already open, you can reset the password in 5 seconds without knowing the old one:
1. In pgAdmin's Query Tool, run:
   ```sql
   ALTER USER postgres WITH PASSWORD 'marginflow123';
   ```
2. Press `F5`. You will see `ALTER ROLE`. Now update `.env.local` with `marginflow123`.

---

### Step 2: Database Client & Connection Pooling (`src/lib/db.ts`)

The project uses `pg` (`node-postgres`) configured with singleton connection pooling to prevent connection leaks during Next.js Hot Module Reloading (HMR).

This is already created for you at [src/lib/db.ts](file:///c:/Users/freak/Desktop/Unified%20platform/src/lib/db.ts):

```typescript
import { Pool, QueryResult, QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/marginflow_dev';

const pool =
  global._postgresPool ||
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresPool = pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;
```

---

## Part 6: Verifying Real-Time Connectivity

### 1. Start the Website

Open your terminal in the project directory and run:

```bash
npm run dev
```

### 2. Check the Health Endpoint

Open your browser and navigate to:
[http://localhost:3000/api/health/db](http://localhost:3000/api/health/db)

You should see a live JSON response:

```json
{
  "status": "healthy",
  "database": "marginflow_dev",
  "connected": true,
  "latencyMs": 14,
  "tables": 22,
  "views": 8,
  "seededOrders": 16,
  "sampleProfitability": [
    {
      "display_id": "ORD-1013",
      "marketplace": "Amazon India",
      "gross_sales": "2299.00",
      "total_cogs": "840.00",
      "contribution_profit": "884.25"
    }
  ]
}
```

If you see `"connected": true` and `"tables": 22`, your website is successfully connected to your PostgreSQL database!

---

## Troubleshooting & Common Questions

### Q1: `password authentication failed for user "postgres"` (Error code: 28P01)
- **Cause**: The password in `.env.local` does not match the PostgreSQL user password.
- **Fix**: Open pgAdmin 4 Query Tool, run `ALTER USER postgres WITH PASSWORD 'marginflow123';`, then update `DATABASE_URL` in `.env.local` to use `marginflow123`.

### Q2: `connection refused on localhost:5432` (Error: ECONNREFUSED)
- **Cause**: PostgreSQL background service is stopped.
- **Fix (Windows)**: Press `Win + R`, type `services.msc`, locate `postgresql-x64-18` (or your version), right-click and click **Start**.

### Q3: `column "marketplace" is of type marketplace_enum but expression is of type text`
- **Cause**: Trying to insert raw text into a custom PostgreSQL ENUM without explicit type casting.
- **Fix**: The master script `marginflow_complete_setup.sql` already has explicit enum casts (e.g. `'Amazon India'::marketplace_enum`). Make sure you run the latest version of this file.

### Q4: Only comments ran, or pgAdmin says "No data output" in 65 milliseconds
- **Cause**: Only one line or a comment block was executed.
- **Fix**: Click inside the Query Tool, press **`Ctrl + A`** to highlight everything, and press **`F5`**.

---

## Quick Reference SQL Queries

Run these queries anytime in pgAdmin's Query Tool to inspect your store data:

### 1. View live order profitability calculated on-the-fly:
```sql
SELECT 
  display_id, 
  marketplace, 
  status, 
  gross_sales, 
  total_cogs, 
  settled_amount, 
  contribution_profit 
FROM v_order_profitability 
ORDER BY order_date DESC;
```

### 2. View profit margin by marketplace:
```sql
SELECT * FROM v_marketplace_profitability;
```

### 3. View soft-deleted records in the Recycle Bin:
```sql
SELECT * FROM v_recycle_bin;
```

### 4. Check active unread notifications count:
```sql
SELECT * FROM v_unread_notification_count;
```

### 5. Reset the entire database back to pristine initial state:
Just re-run the entire [database/marginflow_complete_setup.sql](file:///c:/Users/freak/Desktop/Unified%20platform/database/marginflow_complete_setup.sql) script in pgAdmin using `Ctrl + A` and `F5`. It will automatically drop all old tables and recreate clean seed data.
