import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const { databaseConnectionOptions } = load('src/lib/database-connection.ts');

test('Supabase TLS keeps its trusted CA after the real pg connection parser runs', () => {
  for (const hostname of ['aws-0-ap-southeast-2.pooler.supabase.com', 'db.project.supabase.co']) {
    const options = databaseConnectionOptions(`postgresql://runtime:p%40ss@${hostname}:6543/postgres?sslmode=verify-full&application_name=check`);
    const client = new pg.Client(options);
    const config = client.connectionParameters;
    assert.equal(config.host, hostname);
    assert.equal(config.user, 'runtime');
    assert.equal(config.password, 'p@ss');
    assert.equal(config.application_name, 'check');
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.checkServerIdentity, undefined, 'retain Node hostname verification');
    const cert = new X509Certificate(config.ssl.ca);
    assert.equal(cert.ca, true);
    assert.equal(cert.fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
    assert.ok(Date.parse(cert.validTo) > Date.now());
  }
});

test('TLS URL flags cannot overwrite the bundled CA or weaken Supabase verification', () => {
  for (const query of ['sslmode=require', 'sslmode=no-verify', 'sslmode=disable', 'ssl=false', 'sslmode=require&uselibpqcompat=true']) {
    const client = new pg.Client(databaseConnectionOptions(`postgres://u:p@aws-0-region.pooler.supabase.com/db?${query}`));
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.match(client.connectionParameters.ssl.ca, /BEGIN CERTIFICATE/);
  }
});

test('local databases, unrelated hosts, and explicit certificate configurations retain existing settings', () => {
  for (const url of [undefined, 'postgres://u:p@localhost/db', 'postgres://u:p@example.test/db?sslmode=verify-full',
    'postgres://u:p@aws-0-region.pooler.supabase.com.evil.test/db',
    'postgres://u:p@aws-0-region.pooler.supabase.com/db?sslmode=verify-full&sslrootcert=custom.crt']) {
    const options = databaseConnectionOptions(url);
    assert.equal(options.connectionString, url);
    assert.equal(options.ssl, undefined);
  }
});
