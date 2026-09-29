# MarginFlow — Database Explained in Plain English

> **Who this is for:** Anyone who wants to understand what this database stores, why, and how every part of the system works — without reading a single line of SQL.

---

## The Big Idea

Think of the database as the **permanent memory** of MarginFlow. Every time you add an order, record a return, log a supplier payment, or upload a bill — that information lives in the database. When you close the browser and come back tomorrow, everything is still there exactly as you left it.

The database does NOT store things that can be instantly recalculated — like your total profit, your return rate, or your gross sales. Those numbers are calculated fresh every time you open the dashboard from the raw data that IS stored. This keeps the database lean and always accurate.

---

## Part 1 — What We Store (And Why)

### 1. Your Users & Accounts

**What we store:**
- Your name, email address, and the type of account you have (Brand Owner, Supplier, or Wholesaler)
- Your company name and GSTIN (if provided)
- Your phone number (optional)
- When your account was created

**What we do NOT store:**
- Your password (Supabase Auth handles this securely — we never see it)
- Your AI API keys (Google Gemini, Groq, OpenAI, etc.) — these stay only in your browser and never touch our server or database. This is a hard security rule.

**Why:** Every piece of data in the system belongs to a logged-in user. The user account ties everything together.

---

### 2. Suppliers

**What we store:**
- Supplier name, contact person, email, phone
- Their GSTIN and address
- Payment terms (e.g., "Net 30 days")
- Bank account number and UPI ID (for making payments)
- Opening balance (what you owed them when you started using the app)
- A running total of how much you have paid them so far

**Why:** You need to track who you buy from, how much you owe them, and how to pay them. Every product and every purchase bill links back to a supplier.

---

### 3. Products (Your Catalog)

**What we store:**
- SKU (your internal product code — the master identifier)
- MFN numbers (manufacturer numbers, if applicable)
- Product name, category, and brand
- Current cost price (what you pay the supplier per unit right now)
- Which supplier makes/sells it
- How many units are physically in your warehouse right now
- Whether the product is still active or discontinued

**Cost Price History (very important):**
Every time the cost price changes, we store the full history — the old price, the date it was valid from, and the date it was replaced. This is critical because if you sold a product in January at ₹380 cost and the price went up to ₹420 in June, your profit reports for January must still use ₹380. We never go back and change old numbers.

**Marketplace Aliases:**
Each product can have a different SKU name on each marketplace. For example, your master SKU might be `ELEC-WEM-01` but on Amazon it's listed as `B08WEM01-IND` and on Flipkart it's `FLIP-MOUSE-WEM`. We store this mapping so the system can match orders coming from any marketplace back to your master product.

---

### 4. Orders

**What we store:**
- Our internal order ID (e.g., ORD-1001) and the marketplace's own order ID (e.g., 402-8392182-1928301)
- Which marketplace the order came from
- Order date and current status (Pending, Shipped, Delivered, Returned, etc.)
- Customer name, city, and state
- How much shipping was charged to the customer
- An estimate of what the marketplace will deduct in fees

**Order Line Items (what was inside the order):**
- Which product was ordered (SKU)
- How many units
- The selling price per unit
- Any discount applied
- Tax amount
- **The cost price of the product AT THE TIME of this order** — this number is locked permanently and can never be changed. This is how the system always knows the exact profit for any order, even years later.
- How many units from this order have been returned

**Why so much detail?** Every profitability calculation, every settlement match, every return, and every claim traces back to an order. It is the central record.

---

### 5. Returns & RTOs

**What we store:**
- Which order it links to
- The date it was sent back and the date it physically arrived at your warehouse
- The courier tracking number (AWB)
- Why it was returned (customer complaint, refused delivery, etc.)
- Whether it was a Customer Return, RTO (Return to Origin), Damaged Return, or Lost Return
- What condition the product came back in (Sellable, Damaged, Missing, etc.)
- Whether it has been restocked, written off, or is still pending inspection
- The claim deadline — the last date by which you can file a claim with the marketplace
- All the costs involved: return shipping cost, the marketplace's return processing fee, other costs
- Scrap/salvage value (if the item is damaged but still worth something)
- The total loss amount for this return

**Why:** Returns are where most e-commerce businesses bleed money without realising it. Every return must be tracked down to the rupee — what it cost, what was recovered, and whether a claim was filed before the deadline.

---

### 6. Settlements

**What we store:**
- The marketplace's settlement/payout record for each order
- The settlement batch ID (marketplaces pay in batches, not one-by-one)
- The date the money was transferred
- The gross amount before deductions
- All the deductions line by line: commission, logistics, fixed fees, collection fees, return shipping, penalties, TCS/TDS tax
- The final net amount that actually landed in your bank
- Whether this settlement matches what was expected (Reconciled, Mismatch Flagged, or Pending)
- Your bank transaction reference (to cross-check with your bank statement)

**Why:** Marketplaces routinely make small errors in settlements. The system compares what you expected to receive with what you actually received and flags mismatches automatically.

---

### 7. Claims

**What we store:**
- Which order (and which return) this claim is for
- The type of claim: Lost in Transit, Damaged Item, Wrong Return, Fee Dispute
- The date the claim was filed
- The amount you claimed
- The amount actually recovered
- Current status: Not Filed, Filed, Under Review, Approved, Partially Recovered, Rejected, or Closed
- When the money was recovered (if approved)
- Any notes or reference numbers

**Why:** Marketplace claims are essentially free money you are owed. Without tracking them, you lose this money forever. The system auto-creates a claim when a damaged or lost return is recorded, so you never miss a filing.

---

### 8. Suppliers & Payments

**What we store (Payment Ledger):**
Every individual payment made to a supplier gets its own record:
- How much was paid
- How it was paid (bank transfer, UPI, credit card, cash)
- The transaction/reference number
- When it was paid

**Why:** Instead of just storing a single "total paid" number, we keep a full history of every payment. This means you can see exactly when each payment was made, match it to purchase invoices, and have a proper accounts payable ledger.

---

### 9. Purchase Bills (Inventory Purchases)

**What we store:**
- The supplier invoice number and date
- Which product was purchased (SKU)
- How many units
- Cost per unit
- Taxes on the purchase
- Total invoice amount
- Payment status: Paid, Pending, or Partial
- A reference to the invoice document (just the filename/link — not the file itself)

**Why:** When you buy stock, two things happen automatically: (1) the product cost history is updated with the new cost, and (2) the supplier's payment ledger is updated. Everything connects.

---

### 10. Operating Expenses

**What we store:**
- Date of the expense
- Category (Advertising, Salaries, Rent, Software, Packaging, etc.)
- Description of what it was
- Amount spent
- Who it was paid to (vendor)
- How it was paid
- Whether it repeats monthly (recurring)
- Optionally: which marketplace this expense was for (e.g., Amazon PPC ads)
- Optionally: which product/SKU this was specifically for (e.g., ads run for earbuds only)

**Why:** Operating expenses are what separates gross profit from your actual take-home (net operating profit). Attributing expenses to specific marketplaces and SKUs helps you know if a channel is actually profitable after ad spend.

---

### 11. Customer Complaints & Support Tickets

**What we store:**
- Ticket number and customer contact details (name, email, phone)
- Which order or marketplace the complaint is about
- Category: Wrong Item, Damaged Product, Delivery Delay, Missing Quantity, etc.
- Priority: Low, Medium, High, Urgent
- Status: Open, In Progress, Resolved, Closed
- The complaint subject and full description
- Resolution notes and when it was resolved

**Why:** Customer complaints often signal systemic problems. If 10 complaints say "wrong item received" in one week, something is wrong in packing. Tracking these helps catch issues before they become large-scale.

---

### 12. Financial Audit Log

**What we store:**
- Every single change ever made to any record in the system
- What was changed, what the old value was, what the new value is
- Who made the change and when
- Why it was changed

**This log can NEVER be edited or deleted.** It is permanent. Even if you delete an order, the audit log keeps a record that the order existed and was deleted.

**Why:** Financial records need to be tamper-proof. If there is ever a dispute with a marketplace, a supplier, or a tax authority, the audit log proves exactly what happened and when. It is also required for basic accounting hygiene.

---

## Part 2 — File Uploads: PDFs, CSVs, Images, Text Files

### The Core Principle: Extract the Data, Discard the File

When a user uploads a PDF invoice, a CSV settlement report, or an image of a supplier bill — **the file itself is not what we care about**. What we care about is the information inside it.

Here is exactly what happens, step by step:

---

**Step 1: User selects a file**
The user drags and drops (or selects) a file — it could be a PDF, a JPG/PNG photo of a bill, a CSV, or a plain text file.

**Step 2: AI reads the file**
The system's OCR (Optical Character Recognition) engine reads through the file and tries to find specific pieces of information:

| Information looked for | Example |
|---|---|
| Marketplace name | "Amazon India", "Flipkart" |
| Order ID | "402-8392182-1928301" |
| Invoice number | "APEX-INV-2026-001" |
| Date | "2026-09-04" |
| Product name or SKU | "65W GaN Charger" or "ELEC-USBC-65W" |
| Quantity | "2 units" |
| Price per unit | "₹420" |
| Discount | "₹50" |
| Tax amount | "₹182.90" |
| Total amount | "₹1,199" |

For each piece of information, the AI also notes:
- How confident it is (e.g., 92% sure this is the correct number)
- Exactly where on the page it found it (the bounding box coordinates, used to highlight it in the review screen)
- Whether it was extracted by AI, typed manually, or manually corrected

**Step 3: The system checks the math**
Before showing the document to the user, the system automatically checks: does `quantity × price − discount + tax = total amount`? If not, it flags the document with a red warning.

**Step 4: Human review (HITL — Human In The Loop)**
The document goes into a "Needs Review" queue. The user sees the extracted fields alongside the original document preview. They can:
- Confirm the fields are correct
- Correct any wrong value
- Reject the document entirely if it's irrelevant

**Step 5: Approve → Data enters the main ledger**
When the user clicks Approve:
- If it was a **supplier bill** → a new Purchase Bill record is created with all the extracted data, and the product's cost price history is updated
- If it was an **invoice** → a new Order record is created
- If it was a **settlement report** → settlement records are created

**Step 6: The file itself**
After extraction and approval, **you do not need to store the original PDF/CSV/image** in the database. The data has been captured. The file can be:
- **Discarded immediately** (simplest approach) — the file is only needed for reading, not storing
- **Kept temporarily** (e.g., 24–48 hours in temporary storage) in case the user wants to re-process or re-check it
- **Kept permanently** in a separate file storage system (like Supabase Storage) if legal compliance requires it — for example, in India, GST regulations require keeping supplier invoices for 7 years

> **My recommendation:** For supplier invoices and settlement reports specifically, keep the file in storage permanently (they are small files). This protects you during a GST audit. For order invoices and screenshots, discard after extraction.

**What actually gets stored in the database from a file upload:**

| Field | Stored in DB? |
|---|---|
| File name | ✅ Yes (for reference and audit trail) |
| The actual file bytes | ❌ No — stored in file storage (not DB) OR discarded |
| Extracted marketplace | ✅ Yes |
| Extracted order ID | ✅ Yes |
| Extracted amounts | ✅ Yes |
| AI confidence score per field | ✅ Yes |
| Bounding box coordinates | ✅ Yes (for review UI highlighting) |
| Whether math check passed | ✅ Yes |
| Whether a human reviewed it | ✅ Yes (via status field) |
| Who approved it and when | ✅ Yes (via audit log) |

---

## Part 3 — User Authentication Flow

### How Login Works

MarginFlow uses **Supabase Auth**, which is a fully managed authentication system. Here is the complete user journey:

---

**New User — First Time**

1. The user opens MarginFlow and lands on the login/signup screen
2. They enter their email and a password, or sign in with Google (if enabled)
3. Supabase sends a confirmation email with a link — the user clicks it to verify their email
4. Once verified, Supabase creates a secure session for them
5. Automatically and instantly, the database creates a user profile row with their name, email, and account type (defaulting to Brand Owner)
6. The user is taken to their dashboard

**Returning User**

1. User enters email + password (or clicks Google Sign In)
2. Supabase verifies the credentials
3. A session token is issued and stored in the browser (automatically handled)
4. The user is taken directly to their dashboard
5. Their session stays active for a configurable period (e.g., 7 days) — they don't need to log in again unless the session expires or they manually log out

**Session Security**
- The session token lives in the browser
- All API calls to the database carry this token
- The database checks the token on every single request and only returns data belonging to that user
- If the token is missing or expired, access is denied

---

### Account Types and What Each Can Do

There are three account roles in the system:

| Role | Who it's for | What they see |
|---|---|---|
| **Brand Owner** | The business owner | Everything — all orders, all financials, all suppliers, all reports |
| **Supplier** | Your product supplier | Only information about their own products, their invoices, their payment status |
| **Wholesaler** | B2B buyers | Their own orders and returns only |

When a Supplier logs in, the system automatically filters all data to show only what relates to their supplier ID. They cannot see your overall profit margins, other suppliers' data, or your operating expenses.

---

### What Gets Saved to the Database at Login

When a user logs in, **nothing is written to the database** — Supabase manages the session entirely. The database only gets written when:
- A new user signs up for the first time (creates their profile)
- The user updates their profile (changes their name or company name)

The session itself, the login timestamp, and the active browser state are all managed by Supabase Auth — not by our database tables.

---

## Part 4 — The AI Chatbot (CFO Copilot)

### What It Is

The chatbot (called the CFO Copilot) is an AI assistant that can answer questions about your business. You can ask it things like:
- "What is my profit margin this month?"
- "Which SKU has the highest return rate?"
- "Are there any claims about to expire?"
- "Why did my profit drop last week?"

The AI has access to your live financial data to answer these questions in real time.

### How It Works

Every time you send a message, the system:
1. Packages up a snapshot of your key financial metrics (profit, return rate, settlement aging, top SKUs, anomalies) — **not your raw data, just the summaries**
2. Sends your question + the financial snapshot to the AI provider (Google Gemini, Groq, etc.)
3. Gets back a response
4. Displays it in the chat panel

### Chat Storage — Your Decision: Do Not Store

**Your decision is correct and I agree with it.** Chat history does NOT need to be stored in the database. Here is why this is the right call:

- The chatbot answers questions about your data. The answers are derived from the data that is already stored. Storing the chat itself is just storing a copy of an analysis, not the analysis itself.
- If you reload the page, the chat resets. This is fine — it keeps the system simple.
- Storing chat history would mean storing your questions and the AI's responses permanently. This raises privacy questions (the AI's answers sometimes contain your financial figures).
- The AI is a read-only assistant. It cannot change any records, so there is no audit trail requirement for chat.

**One exception to consider:** If the chatbot ever gains the ability to *take actions* (like automatically filing a claim or updating a cost price), you would want an audit log of what the AI did and why. For now, since it only answers questions, no storage is needed.

> **My recommendation:** Keep the current approach — chat is session-only, lives in the browser, and disappears on page reload. This is correct, secure, and keeps the database focused on actual financial records.

---

## Part 5 — Things I Think You Should Decide

These are important questions that will affect how you build the database and the product. I want your input on each one.

---

### Question 1: Will multiple team members use the same account?

Right now the system is built for one person (or one company). But in a real business, you might have:
- An operations manager who enters orders
- A warehouse staff member who records returns
- A finance person who handles settlements and claims
- The owner who views reports

**If yes:** We need to add a `team_members` table, user roles with different permissions, and every record needs to track "created by which team member."

**If no (single user only):** The current setup is fine.

---

### Question 2: Is everything in Indian Rupees (₹) only?

The entire current codebase assumes INR. All amounts are stored as plain numbers without a currency code.

**If you plan to ever sell internationally or accept USD/EUR payments:** We need to add a `currency` column to orders and settlements, and a way to convert currencies for reporting.

**If INR only forever:** Current setup is fine.

---

### Question 3: Do you need email/SMS alerts?

For example:
- "You have 3 returns whose claim deadline is in 2 days"
- "A settlement payment is overdue by 15 days"
- "Your inventory for ELEC-WEM-01 is below 10 units"

**If yes:** We need a `notifications` table and a background job that checks these conditions daily and sends alerts. This is moderately complex to build.

**If no:** The dashboard already shows these warnings visually. That may be enough.

---

### Question 4: What happens when you receive a Shopify or WooCommerce webhook?

The codebase has a webhook simulator and webhook schemas for Shopify and WooCommerce. This means orders can come in automatically from your website rather than being entered manually.

**Should webhook events be logged?** If Shopify sends an order at 2 AM and something goes wrong, you would want a log of exactly what data was received.

**My recommendation:** Yes, add a `webhook_events` table that logs every incoming webhook (marketplace, event type, payload, timestamp, processing status). This is a small table but invaluable for debugging.

---

### Question 5: Do you want to keep uploaded invoice files permanently?

As discussed in Part 2 — for legal and tax compliance in India, supplier invoices should be kept for 7 years. The question is:

- **Option A:** Store the file in Supabase Storage permanently, link the URL to the purchase bill record. Never auto-delete.
- **Option B:** Extract the data, then delete the file. Save storage costs but lose the original document.

**My recommendation:** Option A for supplier bills and settlement reports (legal documents). Option B for casual uploads like screenshots or informal notes.

---

### Question 6: What happens if a user deletes an order by mistake?

Currently the code deletes orders for real. The audit log records that it was deleted, but the data itself is gone.

**Do you want a "recycle bin" / undo feature?** This is called a "soft delete" — the record is hidden but not actually removed. A user could recover it within, say, 30 days.

**My recommendation:** Yes, implement soft deletes for orders, returns, and claims (these are financial records). The database files already have `deleted_at` columns for this purpose — we just need to decide the recovery window.

---

### Question 7: Will Suppliers log in to view their own data?

The account types include "Supplier" but right now there is no separate portal for suppliers. The question is:

- Will your suppliers actually log in to the system to check their invoice status and payment history?
- Or is this role just for internal use (you switching into a "supplier view" to see what they see)?

**If real supplier login:** We need to make sure the data isolation (each supplier only sees their own data) is airtight and thoroughly tested.

---

### Question 8: Do you need financial year / GST period reporting?

In India, financial reporting runs April to March. GST returns are filed monthly or quarterly.

**Do you need:** 
- A way to mark a financial year as "closed" so its records cannot be edited?
- Automatic GST-ready reports (GSTR-1, GSTR-3B summaries)?
- A way to export data for your CA/accountant?

These would significantly affect what extra data fields and tables we need.

---

## Summary: The "Store vs. Don't Store" Decision Table

| Thing | Store? | Where | Reason |
|---|---|---|---|
| Orders, items, returns, settlements | ✅ Yes | Database | Core financial records |
| Products, suppliers, expenses | ✅ Yes | Database | Master data |
| Cost price history | ✅ Yes | Database | Required for accurate P&L |
| Audit log of every change | ✅ Yes | Database (permanent) | Tamper-proof trail |
| Extracted data from uploaded files | ✅ Yes | Database | This is the point of uploading |
| Supplier invoices (PDFs) | ✅ Yes | File Storage (not DB) | Legal/tax requirement |
| Settlement report files (CSV/PDF) | ✅ Yes | File Storage (not DB) | Audit evidence |
| Casual screenshots or test uploads | ❌ No | Discard after extraction | Not needed |
| AI chatbot conversations | ❌ No | Browser only, clears on reload | No audit requirement |
| User passwords | ❌ No | Supabase Auth only | Security — we never touch passwords |
| AI API keys (Gemini, Groq, etc.) | ❌ No | Browser localStorage only | Hard security rule |
| Computed metrics (profit, margins) | ❌ No | Calculated live from raw data | Storing would create stale-data bugs |
| Dashboard filter state (date range, etc.) | ❌ No | Browser session only | UI preference, not business data |
| User session / login tokens | ❌ No | Supabase Auth only | Automatically managed |
