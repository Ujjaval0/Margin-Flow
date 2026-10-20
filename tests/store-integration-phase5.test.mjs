import { createRequire } from "node:module";
const loadApp = createRequire(import.meta.url)("./helpers/load-app.cjs");
const loadIsolated = (file) => loadApp(file.replace("../", ""), { "@/lib/db": { ensureMarketplaceTables: async () => {}, query: async () => { throw new Error("Isolated test database unavailable"); } } });
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Store Integration Phase 5 Verification Suite', () => {

  // =========================================================================
  // TASK-5.1: WIRE MEESHO DIRECTLY TO OFFICIAL REPORT IMPORT
  // =========================================================================
  describe('TASK-5.1: Wire Meesho Directly to Official Report Import', () => {
    test('src/domain/csv-auto-mapper.ts includes MEESHO_SETTLEMENT and MEESHO_GST presets', () => {
      const mapper = readProjectFile('src/domain/csv-auto-mapper.ts');
      assert.ok(
        mapper.includes('"MEESHO_SETTLEMENT"'),
        'Must define MEESHO_SETTLEMENT format'
      );
      assert.ok(
        mapper.includes('"MEESHO_GST"'),
        'Must define MEESHO_GST format'
      );
      assert.ok(
        mapper.includes('sub_order_no') && mapper.includes('supplier_discounted_price'),
        'Must map Meesho specific sub_order_no and supplier_discounted_price aliases'
      );
      assert.ok(
        mapper.includes('meesho_commission'),
        'Must map meesho_commission to marketplaceChargesEstimate'
      );
    });

    test('WebhookSimulator sets Meesho defaultTab to "csv" with official supplier report description', () => {
      const simulator = readProjectFile('src/components/modules/webhook-simulator.tsx');
      assert.ok(
        simulator.includes('id: "meesho"') &&
        simulator.includes('defaultTab: "csv"'),
        'Meesho channel config must have defaultTab set to "csv"'
      );
      assert.ok(
        simulator.includes('Upload Official Supplier Report (Payment Settlement & GST Tax Invoice)'),
        'Meesho catalog platform description must indicate official supplier report upload'
      );
    });
  });

  // =========================================================================
  // TASK-5.2: WIRE MYNTRA TO VENDOR REPORT INGESTION
  // =========================================================================
  describe('TASK-5.2: Wire Myntra to Vendor Report Ingestion', () => {
    test('src/domain/csv-auto-mapper.ts includes MYNTRA_SETTLEMENT and MYNTRA_ORDERS presets', () => {
      const mapper = readProjectFile('src/domain/csv-auto-mapper.ts');
      assert.ok(
        mapper.includes('"MYNTRA_SETTLEMENT"'),
        'Must define MYNTRA_SETTLEMENT format'
      );
      assert.ok(
        mapper.includes('"MYNTRA_ORDERS"'),
        'Must define MYNTRA_ORDERS format'
      );
      assert.ok(
        mapper.includes('style_id'),
        'Must map source SKU identity'
      );
      const { detectAndMapCsv } = loadIsolated('../src/domain/csv-auto-mapper.ts');
      const payout = detectAndMapCsv('order_id,order_date,style_id,quantity,net_payable,myntra_commission\nx,2026-10-01,SKU,1,80,10', []);
      assert.equal(payout.orders.length, 0, 'Net payouts must never be imported as order unit prices');
      assert.ok(payout.errors.length, 'Ambiguous settlement files must fail visibly');

      assert.ok(
        mapper.includes('forward_delivery_charge') && mapper.includes('myntra_commission'),
        'Must map Myntra commission and delivery charge aliases'
      );
    });

    test('WebhookSimulator sets Myntra defaultTab to "csv" with vendor settlement sheet description', () => {
      const simulator = readProjectFile('src/components/modules/webhook-simulator.tsx');
      assert.ok(
        simulator.includes('id: "myntra"') &&
        simulator.includes('defaultTab: "csv"'),
        'Myntra channel config must have defaultTab set to "csv"'
      );
      assert.ok(
        simulator.includes('Upload Vendor Settlement Sheet (PPMP/Omni API available)'),
        'Myntra catalog description must highlight settlement sheet with API readiness'
      );
    });

    test('Myntra sync route explicitly reports the unavailable direct connector', () => {
      const syncRoute = readProjectFile('src/app/api/integrations/myntra/sync/route.ts');
      assert.ok(
        syncRoute.includes('export async function POST'),
        'Myntra sync route must export POST handler'
      );
      assert.ok(
        syncRoute.includes('MYNTRA_PPMP_ACCESS_UNAVAILABLE') && syncRoute.includes('501'),
        'Myntra must reject direct synchronization until a supported contract is configured'
      );
    });
  });

  // =========================================================================
  // TASK-5.3: RETAIN FULL FILE AUDIT METADATA & ZERO FINANCIAL GUESSWORK
  // =========================================================================
  describe('TASK-5.3: Retain Full File Audit Metadata & Zero Financial Guesswork', () => {
    test('database/12_file_import_audit.sql defines file_import_logs table with required columns', () => {
      const ddl = readProjectFile('database/12_file_import_audit.sql');
      assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS file_import_logs'), 'Must create file_import_logs table');
      assert.ok(ddl.includes('file_hash'), 'Must include file_hash column');
      assert.ok(ddl.includes('file_name'), 'Must include file_name column');
      assert.ok(ddl.includes('uploaded_at'), 'Must include uploaded_at timestamp');
      assert.ok(ddl.includes('seller_id'), 'Must include seller_id column');
      assert.ok(ddl.includes('sheet_format'), 'Must include sheet_format column');
    });

    test('explicit bootstrap includes the file import migration', () => {
      const dbContent = readProjectFile('database/00_run_all.sql');
      assert.ok(
        dbContent.includes('12_file_import_audit.sql'),
        'Bootstrap must include the explicit file import migration'
      );
    });

    test('src/lib/integrations/file-audit.ts exports calculateFileHash and audit persistence functions', async () => {
      const auditModule = loadIsolated('../src/lib/integrations/file-audit.ts');
      assert.equal(typeof auditModule.calculateFileHash, 'function', 'Must export calculateFileHash');
      assert.equal(typeof auditModule.recordFileImportAudit, 'function', 'Must export recordFileImportAudit');
      assert.equal(typeof auditModule.getFileImportHistory, 'function', 'Must export getFileImportHistory');

      // Test SHA-256 calculation
      const sampleContent = 'order_id,sku,amount\n101,SKU-A,500';
      const expectedHash = crypto.createHash('sha256').update(sampleContent).digest('hex');
      const computedHash = auditModule.calculateFileHash(sampleContent);
      assert.equal(computedHash, expectedHash, 'calculateFileHash must produce exact SHA-256 hex digest');
    });

    test('src/app/api/integrations/reports/upload/route.ts handles upload audit and persists to database', () => {
      const routeContent = readProjectFile('src/app/api/integrations/reports/upload/route.ts');
      assert.ok(
        routeContent.includes('export async function POST'),
        'Upload route must export POST handler'
      );
      assert.ok(
        routeContent.includes('export async function GET'),
        'Upload route must export GET handler for file import history'
      );
      assert.ok(
        routeContent.includes('recordFileImportAudit'),
        'Must call recordFileImportAudit to persist file metadata'
      );
      assert.ok(
        routeContent.includes('upsertOrders'),
        'Must persist parsed orders to order ledger via upsertOrders'
      );
    });

    test('CsvImportModal dispatches file audit to /api/integrations/reports/upload on import confirmation', () => {
      const modalContent = readProjectFile('src/components/modals/csv-import-modal.tsx');
      assert.ok(
        modalContent.includes('/api/integrations/reports/upload'),
        'CsvImportModal must call /api/integrations/reports/upload with file metadata'
      );
      assert.ok(
        modalContent.includes('uploadDocumentFiles(files)') && modalContent.includes('JSON.stringify({ documents })'),
        'CsvImportModal must upload original bytes to Storage and send owned references for server hashing'
      );
    });

    test('Zero financial guesswork invariant: csv-auto-mapper sets snapshotUnitCost to 0 if unknown (no flat 40%)', () => {
      const mapper = readProjectFile('src/domain/csv-auto-mapper.ts');
      assert.ok(
        mapper.includes('snapshotUnitCost = historicalCost?.costPrice ?? 0'),
        'snapshotUnitCost must use the dated historical catalog cost or 0, never a synthetic percentage'
      );
      assert.ok(
        !mapper.includes('Math.round(sellingPrice * 0.4)'),
        'Must not contain flat 40% selling price COGS fallback'
      );
    });

    test('Zero fee guesswork invariant: csv-auto-mapper does not synthesize 15% or 22% fee percentages', () => {
      const mapper = readProjectFile('src/domain/csv-auto-mapper.ts');
      assert.ok(
        !mapper.includes('marketplace === "Myntra" ? 0.22'),
        'Must not contain hardcoded 22% fee estimation'
      );
      assert.ok(
        !mapper.includes('marketplace === "Amazon India" ? 0.15'),
        'Must not contain hardcoded 15% fee estimation'
      );
    });
  });
});
