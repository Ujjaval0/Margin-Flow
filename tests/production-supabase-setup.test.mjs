import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const sql = file => fs.readFileSync('production-supabase/' + file, 'utf8');

test('production SQL Editor package, runtime role and reset execute on disposable PostgreSQL', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const client = { query: (q, p) => db.query(q, p), release() {} };
  t.afterEach(async () => { await db.exec('ROLLBACK; RESET ROLE'); });
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage,auth TO authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;`);
    await db.exec(sql('generated/02_create.sql'));
    await db.exec(sql('operations/20_runtime_role.sql'));
    await db.exec(sql('operations/30_profile_avatars.sql'));
    const users = (await db.query(`WITH a AS (INSERT INTO auth.users VALUES(gen_random_uuid()),(gen_random_uuid()) RETURNING id)
      INSERT INTO user_accounts(auth_user_id,name,email) SELECT id,'Verification',id::text||'@example.test' FROM a RETURNING id,auth_user_id`)).rows;
    const [owner, other] = users.map(u => u.id);
    const loginIdentity = (await db.query('INSERT INTO auth.users VALUES(gen_random_uuid()) RETURNING id')).rows[0].id;
    await t.test('all owner columns are UUID account foreign keys', async () => {
      const findings = await db.query(`SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='user_id'
        AND (c.data_type<>'uuid' OR c.is_nullable<>'NO' OR NOT EXISTS(SELECT 1 FROM pg_constraint k
          JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey)
          WHERE k.conrelid=('public.'||c.table_name)::regclass AND k.contype='f' AND a.attname='user_id'
            AND k.confrelid='public.user_accounts'::regclass))`);
      assert.deepEqual(findings.rows, []);
      await db.exec(sql('verification/001_read_only_schema_check.sql'));
      await db.exec(sql('verification/002_financial_readiness.sql'));
      await db.exec('GRANT TRUNCATE,REFERENCES,TRIGGER ON notifications,webhook_events TO anon,authenticated');
      await db.exec(sql('operations/00_lock_down_legacy_tables.sql'));
      assert.equal((await db.query("SELECT has_table_privilege('anon','notifications','TRUNCATE') AS permitted")).rows[0].permitted, false);
      assert.equal((await db.query("SELECT has_table_privilege('authenticated','webhook_events','TRUNCATE') AS permitted")).rows[0].permitted, false);
    });
    await t.test('runtime SQL CRUD probe rolls back its fixture', async () => {
      await db.exec(sql('verification/003_runtime_crud.sql'));
      assert.equal(Number((await db.query('SELECT count(*) FROM products')).rows[0].count), 0);
      assert.equal(Number((await db.query('SELECT count(*) FROM financial_audit_logs')).rows[0].count), 0);
    });
    await t.test('canonical writes, supplier payment triggers and complete hydration work under runtime role', async () => {
      await db.exec('SET ROLE marginflow_runtime');
      const mocks = { '@/lib/db': { query: client.query, pool: { connect: async () => client }, ensureMarketplaceTables: async () => {} } };
      const identity = load('src/lib/auth/supabase-account.ts', mocks);
      const mapped = await identity.ensureMarginFlowAccount({ id: loginIdentity, email: 'runtime@example.test',
        email_confirmed_at: '2026-10-20T00:00:00Z', user_metadata: { full_name: 'Runtime login' } });
      assert.equal(mapped.isNewUser, true, 'runtime role must create account mappings and run seed triggers');
      assert.equal((await identity.ensureMarginFlowAccount({ id: loginIdentity, email: 'runtime@example.test',
        email_confirmed_at: '2026-10-20T00:00:00Z', user_metadata: {} })).isNewUser, false);
      const service = load('src/lib/ledger-records.ts', mocks);
      const command = async (id, body, who = owner) => {
        await db.exec('BEGIN');
        try { const value = await service.executeLedgerCommand(client, who, id, body); await db.exec('COMMIT'); return value; }
        catch (error) { await db.exec('ROLLBACK'); throw error; }
      };
      const supplier = { id: 'SUP-CHECK', name: 'Verification', contactPerson: '', email: '', phone: '', address: '' };
      await command('supplier', { action: 'save', collection: 'suppliers', record: supplier });
      await command('supplier', { action: 'save', collection: 'suppliers', record: supplier }, other);
      await db.query(`INSERT INTO products(user_id,display_id,sku,name,category,brand,current_cost_price,stock_quantity)
        VALUES($1,'P','SKU','Verification','Other','Verification',10,2)`, [owner]);
      await command('purchase', { action: 'save', collection: 'purchases', record: { id: 'PUR', supplierId: supplier.id,
        supplierName: supplier.name, invoiceNumber: 'INV', invoiceDate: '2026-10-20', sku: 'SKU', quantity: 1, unitCost: 10,
        taxes: 0, totalAmount: 10, paymentStatus: 'PENDING', paidAmount: 0 } });
      let data = await command('payment', { action: 'paySupplier', id: 'PAY', supplierId: supplier.id, date: '2026-10-20', amount: 5, paymentMethod: 'UPI', reference: 'check' });
      assert.equal(data.purchases[0].paidAmount, 5);
      assert.equal(data.suppliers[0].totalPaid, 5);
      assert.equal(data.products[0].stockQuantity, 3);
      data = await command('payment', { action: 'paySupplier', id: 'PAY', supplierId: supplier.id, date: '2026-10-20', amount: 5, paymentMethod: 'UPI', reference: 'check' });
      assert.equal(data.suppliers[0].totalPaid, 5, 'retry must not pay twice');
      const otherData = await load('src/lib/canonical-ledger.ts', mocks).readCanonicalLedger(client, other);
      assert.equal(otherData.purchases.length, 0);
      assert.equal(otherData.products.length, 0);
      // Run the actual readiness check, including visibility of legacy session columns.
      const source = fs.readFileSync('src/lib/db.ts', 'utf8');
      const queryText = source.match(/query<\{ ready: boolean \}>\("([^"]+)"\)/)[1];
      assert.equal((await db.query(queryText)).rows[0].ready, true);
      await assert.rejects(db.query(`INSERT INTO financial_commands(user_id,request_id,request_hash) VALUES($1,'orphan','x')`, ['00000000-0000-4000-8000-000000000000']), /foreign key/i);
      await db.exec('RESET ROLE');
    });
    await t.test('complaint CRUD survives hydration, isolates owners, and rejects stale edits', async () => {
      await db.exec('SET ROLE marginflow_runtime');
      const mocks = { '@/lib/db': { query: client.query, pool: { connect: async () => client }, ensureMarketplaceTables: async () => {} } };
      const service = load('src/lib/ledger-records.ts', mocks);
      const command = async (who, request, body) => {
        await db.exec('BEGIN');
        try { const result=await service.executeLedgerCommand(client,who,request,body);await db.exec('COMMIT');return result; }
        catch(error){await db.exec('ROLLBACK');throw error;}
      };
      const record={id:'TICKET',ticketNumber:'TICKET',customerName:'Synthetic',customerEmail:'buyer@example.test',
        category:'OTHER',priority:'MEDIUM',status:'OPEN',subject:'Check',description:'Persist this complaint',createdAt:'2026-10-20T00:00:00.000Z'};
      let data=await command(owner,'complaint-create',{action:'save',collection:'complaints',record});
      assert.equal(data.complaints[0].subject,'Check');
      await command(other,'complaint-create',{action:'save',collection:'complaints',record:{...record,subject:'Other account'}});
      const before=data.complaints[0], revision=data.financialRevision;
      data=await command(owner,'complaint-update',{action:'save',collection:'complaints',expected:before,
        record:{...before,status:'RESOLVED',resolutionNotes:'Verified',resolvedAt:'2026-10-20T01:00:00.000Z'}});
      assert.equal(data.complaints[0].status,'RESOLVED');
      assert.ok(data.financialRevision>revision);
      await assert.rejects(command(owner,'stale-complaint',{action:'save',collection:'complaints',expected:before,record:{...before,subject:'Stale'}}),/changed/i);
      await assert.rejects(command(owner,'foreign-complaint-order',{action:'save',collection:'complaints',record:{...record,id:'FORGED',ticketNumber:'FORGED',orderId:'OTHER-ORDER'}}),/owned complaint order/i);
      data=await command(owner,'complaint-delete',{action:'deleteComplaint',id:'TICKET'});
      assert.equal(data.complaints.length,0);
      const foreign=await load('src/lib/canonical-ledger.ts',mocks).readCanonicalLedger(client,other);
      assert.equal(foreign.complaints[0].subject,'Other account');
      await db.exec('RESET ROLE');
    });
    await t.test('avatar replacement allows only the authenticated user path', async () => {
      await db.exec('BEGIN; SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [users[0].auth_user_id]);
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('profile-avatars',$1)", [users[0].auth_user_id + '/avatar']);
      assert.equal((await db.query('SELECT name FROM storage.objects')).rows.length, 1);
      await db.exec('SAVEPOINT bad_avatar');
      await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('profile-avatars',$1)", [users[1].auth_user_id + '/avatar']), /row-level security/i);
      await db.exec('ROLLBACK TO SAVEPOINT bad_avatar; ROLLBACK');
    });
    await t.test('reset requires the exact phrase and preserves managed schemas and Auth identities', async () => {
      const reset = sql('generated/01_reset_test.sql');
      await assert.rejects(db.exec(reset), /Reset is locked/);
      await db.exec('ROLLBACK');
      await db.exec(reset.replace("confirmation text := 'CHANGE_ME'", "confirmation text := 'DELETE MARGINFLOW TEST DATA'"));
      assert.equal((await db.query("SELECT to_regclass('public.user_accounts') AS name")).rows[0].name, null);
      assert.equal(Number((await db.query('SELECT count(*) FROM auth.users')).rows[0].count), 3);
      assert.equal(Number((await db.query('SELECT count(*) FROM storage.buckets')).rows[0].count), 2);
      await db.exec(sql('generated/02_create.sql'));
      assert.equal(Number((await db.query('SELECT count(*) FROM orders')).rows[0].count), 0);
    });
  } finally { await db.close(); }
});

test('Auth callback verifies email token hashes and preserves the OAuth code flow', async () => {
  const calls = [];
  const user = { id: 'auth-user', user_metadata: {} };
  const supabase = { auth: {
    verifyOtp: async value => { calls.push(['verify', value]); return { data: { user }, error: null }; },
    exchangeCodeForSession: async value => { calls.push(['code', value]); return { data: { user }, error: null }; },
    signOut: async () => { calls.push(['logout']); return { error: null }; },
  } };
  const route = load('src/app/auth/callback/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => supabase },
    '@/lib/auth/supabase-account': { ensureMarginFlowAccount: async () => ({ isNewUser: false }) },
  });
  let response = await route.GET(new Request('https://example.test/auth/callback?token_hash=token&type=email&next=%2Flogin%3Fverified%3D1'));
  assert.equal(response.headers.get('location'), 'https://example.test/login?verified=1');
  assert.equal(calls[0][0], 'verify');
  assert.equal(calls[0][1].type, 'email');
  assert.equal(calls[1][0], 'logout');
  response = await route.GET(new Request('https://example.test/auth/callback?code=oauth&next=https://evil.test'));
  assert.equal(calls[2][0], 'code');
  assert.equal(response.headers.get('location'), 'https://example.test/dashboard');
  const count = calls.length;
  await route.GET(new Request('https://example.test/auth/callback?token_hash=token&type=recovery'));
  assert.equal(calls.length, count, 'unimplemented OTP types are rejected');
});
