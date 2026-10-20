// Read-only catalog inventory. No credentials or business rows are included.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';

const fileEnv = fs.existsSync('.env.local') ? parseEnv(fs.readFileSync('.env.local', 'utf8')) : {};
const connectionString = process.env.DATABASE_AUDIT_URL || process.env.DATABASE_URL || fileEnv.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_AUDIT_URL or DATABASE_URL.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 12000, statement_timeout: 15000,
  application_name: 'marginflow-read-only-audit' });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const report = { checkedAt: new Date().toISOString() };
  report.transport = { tls: client.connection.stream.encrypted === true };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || fileEnv.NEXT_PUBLIC_SITE_URL;
  if (supabaseUrl && publicKey) {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const databaseUrl = new URL(connectionString);
    report.configuration = { siteOrigin: siteUrl ? new URL(siteUrl).origin : null,
      databaseMatchesApiProject: databaseUrl.hostname === `db.${projectRef}.supabase.co`
        || decodeURIComponent(databaseUrl.username).endsWith('.' + projectRef) };
    try {
      const response = await fetch(new URL('/auth/v1/settings', supabaseUrl), {
        headers: { apikey: publicKey }, signal: AbortSignal.timeout(10000),
      });
      report.authSettings = { status: response.status };
      if (response.ok) {
        const settings = await response.json();
        Object.assign(report.authSettings, { emailEnabled: settings.external?.email,
          googleEnabled: settings.external?.google, signupDisabled: settings.disable_signup,
          emailAutoConfirm: settings.mailer_autoconfirm });
      }
    } catch { report.authSettings = { reachable: false }; }
  }
  const checks = {
    server: 'SELECT current_database() AS database, current_user, version()',
    schemas: "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY 1",
    tables: `SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v') ORDER BY 1`,
    columns: "SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    constraints: `SELECT c.relname AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY 1,2`,
    policies: "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2,3",
    roles: "SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls FROM pg_roles WHERE rolname IN (current_user,'anon','authenticated','marginflow_runtime')",
    grants: "SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC','marginflow_runtime') ORDER BY 1,2,3",
  };
  for (const [name, sql] of Object.entries(checks)) report[name] = (await client.query(sql)).rows;
  for (const [name, relation, sql] of [
    ['migrations', 'supabase_migrations.schema_migrations', 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'],
    ['appMigrations', 'public.marginflow_schema_migrations', 'SELECT version,checksum FROM public.marginflow_schema_migrations ORDER BY version'],
    ['buckets', 'storage.buckets', 'SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id'],
  ]) {
    if ((await client.query('SELECT to_regclass($1) AS relation', [relation])).rows[0].relation)
      report[name] = (await client.query(sql)).rows;
  }
  report.rowCounts = [];
  for (const table of report.tables.filter(t => ['r', 'p'].includes(t.relkind))) {
    const identifier = '"' + table.relname.replaceAll('"', '""') + '"';
    const result = await client.query('SELECT count(*)::text AS count FROM public.' + identifier);
    report.rowCounts.push({ table: table.relname, count: result.rows[0].count });
  }
  report.ownerFindings = [];
  for (const column of report.columns.filter(c => c.column_name === 'user_id')) {
    const identifier = '"' + column.table_name.replaceAll('"', '""') + '"';
    const result = await client.query(`SELECT count(*) FILTER (WHERE t.user_id IS NULL)::text AS unowned,
      count(*) FILTER (WHERE t.user_id IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM public.user_accounts a WHERE a.id::text=t.user_id::text))::text AS unknown_owner
      FROM public.${identifier} t`);
    report.ownerFindings.push({ table: column.table_name, type: column.data_type, ...result.rows[0] });
  }
  await client.query('ROLLBACK');
  const output = process.argv[2] || 'production-supabase/live-schema-audit.json';
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checkedAt: report.checkedAt, role: report.server[0].current_user,
    tables: report.tables.length, rowCounts: report.rowCounts, migrations: report.migrations || [],
    appMigrations: report.appMigrations || [], buckets: report.buckets || [], ownerFindings: report.ownerFindings,
    transport: report.transport, configuration: report.configuration, authSettings: report.authSettings, output }, null, 2));
} catch (error) {
  // Do not print driver errors that might contain a connection string or data.
  console.error('Read-only audit failed:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
