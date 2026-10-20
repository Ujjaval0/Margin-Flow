# MarginFlow: Supabase and Vercel deployment

Prepared from a **read-only inspection of the configured hosted database on 20 October 2026**. No remote schema, data, grants, Auth settings, Storage resources or Vercel configuration were changed. You confirmed the existing business records are disposable test data. The final Vercel URL is pending.

## Findings from the actual hosted database

Project: `ylhyoktotwpqkfdpdofu.supabase.co`. The configured database connection uses the `postgres` administrator and the shared session pooler on port 5432. Confirm this is the project you intend to reuse.

- 29 app tables and eight views; two account profiles, two products, three orders with three items, and one expense. The other app tables are empty.
- Existing owner IDs match account IDs, but many columns are nullable text without account foreign keys.
- Ten tables needed by the current code are missing, including fee rules, financial command receipts, payment allocations and provider events. Required financial metadata columns are also missing. The application's schema readiness check cannot pass against this database.
- No Storage buckets and no recorded Supabase migration versions.
- RLS is enabled, but `anon` and `authenticated` retain `TRUNCATE`, `REFERENCES` and `TRIGGER` privileges on `notifications` and `webhook_events`. **RLS does not prevent TRUNCATE.**
- The public Auth settings confirm Email and Google are enabled, signup is allowed and email confirmation is required. This does not verify SMTP delivery or Google's client credentials. The configured app site URL is still localhost.
- The database/API configuration points to the same project, and the inspected database connection uses TLS.

`live-schema-audit.json` contains catalogs, counts and ownership findings, without passwords or business record contents. Repeat the read-only audit from the repository root:

```powershell
node production-supabase/audit.mjs
```

It loads `.env.local` unless `DATABASE_AUDIT_URL` or `DATABASE_URL` is already in the environment. Use an administrator audit connection for a complete inventory. This command never migrates anything.

## 1. Back up and stop writes

Keep the site inaccessible to customers during setup and stop local app writes. Save a backup outside Git. With PostgreSQL client tools, use the administrator's direct/session connection from Supabase **Connect**:

```powershell
# Set DATABASE_BACKUP_URL privately in the terminal first. Do not paste it into chat.
New-Item -ItemType Directory -Force production-supabase/backups
pg_dump --dbname "$env:DATABASE_BACKUP_URL" --schema=public --format=custom --no-owner --no-acl --file production-supabase/backups/before-reset.dump
pg_restore --list production-supabase/backups/before-reset.dump
```

Check the exit code after each command. This backs up the app's public schema; the reset does not touch managed Auth/Storage schemas. Listing checks archive readability; restoring into a separate disposable database verifies recovery. Database dumps do not include Storage object bytes; this project currently has no buckets. Keep the backup private and out of Git.

In the correct project's Supabase SQL Editor, first run `operations/00_lock_down_legacy_tables.sql`. It removes dangerous legacy browser grants without deleting records.

## 2. Reset disposable data and create the current schema

Keep the existing **public** schema: application queries expect these table names there. Do not invent a new schema name without changing the code.

Generate SQL Editor-ready files locally; this makes no database connection:

```powershell
node production-supabase/prepare.mjs
```

Run these files **separately, in order**, in Supabase SQL Editor:

1. `generated/01_reset_test.sql`: replace its one `CHANGE_ME` value with `DELETE MARGINFLOW TEST DATA`, review and run. **Deletes all MarginFlow app tables, profiles, financial records and related schema objects.** Managed `auth`/`storage` schemas, Auth identities, buckets, extensions and the public namespace are preserved. Unknown public relations block the reset; inspect custom dependencies because app objects are dropped with `CASCADE`.
2. `generated/02_create.sql`: creates 39 application tables from all nine migrations through `20261020000100`, with no demo merchant records. Existing app objects block creation. Checksums are recorded in `public.marginflow_schema_migrations`, separate from Supabase CLI history.
3. `operations/20_runtime_role.sql`: provisions the restricted trusted server role and its grants/policies.
4. `operations/30_profile_avatars.sql`: creates the existing profile feature's bucket and owner-only policies, including SELECT needed to replace avatars.

Stop on any SQL error. The creation file contains multiple migration transactions and is **not one atomic transaction**. On disposable data, investigate the error, reset and rebuild; do not repeatedly run creation on a partial schema. Do not also run older consolidated scripts from `database/` or its local numbered migrations.

The new integrity migration converts remaining canonical owner columns to required UUID account foreign keys. Unknown ownership aborts rather than assigning a merchant. Audit and fee snapshots remain append-only; financial deletion uses existing archive/recovery behavior.

If records later become valuable, stop using this reset. A populated deployment requires a separately reviewed upgrade and backup. These scripts are for the disposable-data reset you requested.

## 3. Create the application database login

The runtime role initially has NOLOGIN and no password. Generate a password:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In SQL Editor, execute the following with that generated value. Do not save the real password in repository files:

```sql
ALTER ROLE marginflow_runtime WITH LOGIN PASSWORD 'PASTE_GENERATED_PASSWORD_HERE';
```

This role cannot bypass RLS, administer roles/databases, create public-schema objects or access managed Auth/Storage tables. It can insert/read audit and fee snapshots, but cannot update/delete them. Legacy complaints and global event/notification tables stay inaccessible. The obsolete public `auth_sessions` table is read-only for the schema readiness query; live login uses Supabase Auth.

**Authorization boundary:** this is a trusted server role with access across accounts. Its RLS policies allow server operations; verified account filters in the application enforce tenant isolation. Never expose this credential to browsers or customers. Tests verify those owner-scoped queries under the role, not a database-enforced per-tenant login.

For Vercel, copy **Connect → Transaction pooler** and use:

```dotenv
DATABASE_URL=postgresql://marginflow_runtime.PROJECT_REF:RUNTIME_PASSWORD@POOLER_HOST:6543/postgres?sslmode=verify-full
```

Use `marginflow_runtime.<project-ref>` as the shared-pooler username and the new role's password. The audited host is `aws-0-ap-southeast-2.pooler.supabase.com`; copy the current host from Connect. Backup/migration tools use the administrator's direct/session connection instead. Percent-encode reserved password characters; hexadecimal passwords avoid this issue.

Keep certificate verification enabled. If the project's certificate chain needs a custom root, download it from Supabase Database settings and configure `sslrootcert` with a real deployed certificate path. Do not disable verification to bypass an error. The app uses `pg` without named prepared statements. On Vercel its local pool is now limited to one connection per instance.

Reference: [Supabase connections, custom roles, pooling and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 4. Configure authentication

Email/password signup, login, logout, Google sign-in, SSR cookies, `/auth/callback`, and `user_accounts.auth_user_id → auth.users.id` already exist. Do not add another password table or insert passwords through SQL.

In Supabase Authentication:

1. Enable Email and keep email confirmation enabled.
2. Configure custom SMTP, verify its sender domain and test delivery outside the Supabase team. The default mail service is restricted and unsuitable for production customer signup. See [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
3. When your new Vercel project supplies a stable URL, set **URL Configuration → Site URL** to the exact canonical HTTPS origin.
4. Add `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/auth/callback?next=%2Flogin%3Fverified%3D1` as allowed redirect URLs. Keep localhost on the development project and avoid broad production wildcards.
5. In **Email Templates → Confirm signup**, use this link:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=email&amp;next=%2Flogin%3Fverified%3D1">Confirm your email</a>
```

The callback now supports email token hashes as well as OAuth codes, including confirmation in a different browser. Use this template for Confirm signup only; password recovery/invitation flows are not implemented by this callback.

For the existing Google button, configure **Providers → Google** with a Google OAuth client ID/secret. In Google Cloud register the callback shown by Supabase, normally `https://PROJECT_REF.supabase.co/auth/v1/callback`, and configure production consent/test-user restrictions. The app redirect remains `https://YOUR_DOMAIN/auth/callback`. Google secrets belong in Supabase's provider settings.

The reset deletes app profiles but keeps Auth identities. Existing confirmed users can sign in and get fresh app profiles. Remove disposable test identities separately in Supabase's Auth dashboard if you want a clean customer user list; the SQL here never deletes managed identities. Use two new synthetic users and normal onboarding for acceptance.

References: [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [SSR email confirmation](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs), [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 5. Create the new Vercel project

Push the reviewed code and import its Git repository as a new Vercel project using the Next.js preset, supported Node.js 22 runtime and `npm run build`. Place functions near the database region where possible. Never commit `.env.local`.

After Vercel assigns the stable domain, set these **Production** environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Restricted-role transaction-pooler URI from step 3, with TLS |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS API URL of the same Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key; the existing variable name accepts either format |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical HTTPS origin, no trailing slash |
| `APP_ORIGIN` | Same canonical origin, no trailing slash; used by request-origin checks |
| `ENCRYPTION_MASTER_KEY` | A second, independent random 32-byte hex value |
| `MARGINFLOW_JOB_WORKER` | `0` on Vercel |
| `GEMINI_API_KEY` | Valid server key if using Gemini document/OCR features |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Same Gemini key where that SDK path is used |

Keep the encryption key stable across deployments or existing marketplace credentials become unreadable. Leave `INTERNAL_SERVICE_KEY` unset unless intentionally configuring an internal caller. The current app needs no Supabase service-role key for Auth or avatars. No administrator URI, encryption key or service-role key belongs in `NEXT_PUBLIC_*`.

Configure only integrations you use. Flipkart OAuth also needs `FLIPKART_APP_ID`, `FLIPKART_APP_SECRET`, and an exactly registered HTTPS `FLIPKART_REDIRECT_URI`. Supabase variables do not provision provider scopes, webhook secrets or AI credits.

Use a separate Supabase project with matching variables and Auth URLs for Preview/Development. Do not give preview deployments production database credentials. If using a custom domain, make it canonical and redirect the old Vercel hostname so origin checks and email links agree.

**Redeploy after setting variables**, especially `NEXT_PUBLIC_*` values embedded at build time. Update Supabase Site URL/redirects to the same hostname. The first domain-provisioning build is not the final configured release. See [Vercel environment setup](https://vercel.com/docs/environment-variables/manage-across-environments).

## 6. Verify before accepting customer data

Run `verification/001_read_only_schema_check.sql` and `verification/002_financial_readiness.sql` as administrator. Required objects/columns and all nine package versions must be present; owner/FK, missing-index/version and browser-grant findings must be empty; old financial views must be retired. The full tables listing is informational. Inspect runtime attributes/grants with the audit too.

Open `https://YOUR_DOMAIN/api/health/db`: expect HTTP 200 and `{"status":"healthy","connected":true}`. **That endpoint tests connectivity only.** Then:

1. Sign up user A, confirm email, sign in and complete onboarding. Check profile persistence and avatar upload/replacement. Test Google if enabled.
2. Run `verification/003_runtime_crud.sql` in SQL Editor. Expect a PASS notice. It switches to the restricted role and tests product create/read/update/delete, audit insert/mutation denial and browser restrictions, then rolls back row changes. Identity sequences can still advance. On error run `ROLLBACK;` before retrying.
3. Rerun `audit.mjs` using an administrator audit connection. Expect 39 app tables plus the package-receipt table, both buckets, no browser business grants and zero ownership findings. The deployed app must continue using the runtime credential.
4. Complete the browser matrix below with synthetic data. Refresh after every mutation and check from a second session/device; success toasts alone do not prove persistence.

| Workflow | Required acceptance |
| --- | --- |
| Products | Create, refresh, edit, archive/restore; verify stock and cost history |
| Suppliers/purchases/payments | Create supplier/purchase, pay partially/fully, refresh; verify allocations, stock, balance and duplicate-submit behavior |
| Orders | Create/import, update a supported status, refresh; verify line identity and historical cost |
| Settlements | Import multiple records in one batch/order, retry; no duplicate receipts/deductions |
| Returns/claims | Return, restock once, partial recovery, refresh, archive/restore; verify inventory and recovered amounts |
| Expenses | Create, edit, archive/restore; refreshed totals agree |
| Fee settings | Save versioned rules/quick rates; verify missing-configuration behavior and stored snapshots |
| Two-user isolation | B cannot see A's data; B's requests with A's known record IDs cannot read/mutate them |
| Logout | Unauthenticated protected API calls fail; sign back in and confirm persistence |
| External integrations | Real authorization, scopes, pagination, signed webhooks, duplicate deliveries and retries for each enabled provider |

Local regression commands:

```powershell
node --test tests/production-supabase-setup.test.mjs tests/financial-canonical-postgres.test.mjs
npm test
npm run build
```

Local acceptance on 20 October 2026: **384 tests passed**, including the new production setup checks, and `npm run build` passed with TypeScript validation and no reported build warnings. Disposable PostgreSQL tests cover schema execution, runtime privileges, triggers, financial workflows, rollback and owner-filtered queries. They do not test hosted Auth, Storage HTTP, Supavisor, SMTP, Google consent, Vercel or marketplace accounts. Hosted acceptance remains necessary.

## 7. Features still blocking a complete production launch

These are current code findings, not problems SQL setup can solve:

- **Private documents are not Vercel-ready.** Upload writes to `process.cwd()/data/secure-vault`; streaming reads that disk. The private Supabase bucket is created but no app Storage adapter uses it. Move bytes to durable private Storage with verified-account authorization before accepting customer documents. Metadata alone does not preserve files.
- **Large uploads need direct-to-storage handling.** The app accepts 10 MB files and batches, while Vercel Functions limit request/response bodies to 4.5 MB. Increasing application limits cannot fix it. Profile avatars already use a separate direct Supabase Storage path.
- **Background jobs do not work on this Vercel-only setup.** Keep the worker flag at `0`. The queue API currently requires that same flag to enqueue, so adding a worker host alone is insufficient: producer/worker configuration must be separated and tested with a persistent supervised worker. CSV/report processors exist; batch IDP and reconciliation processors do not.
- **Customer complaints remain browser-local.** `addComplaint` updates client state without durable server CRUD; the table's existence does not make this feature persistent.
- Providers need real sandbox/live validation and operational monitoring. Configure shared ingress limits for multiple instances; existing process-local rate limits are supplemental.

Do not certify **all** functionality until the applicable blockers and hosted matrix pass. Database-backed financial workflows can be validated independently, but the complete feature set is not production-ready today.

References: [Vercel Function limits](https://vercel.com/docs/functions/limitations), [private Storage access](https://supabase.com/docs/guides/storage/security/access-control).
