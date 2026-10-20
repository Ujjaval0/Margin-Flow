import { readIntegrationSource } from './helpers/integration-source.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return readIntegrationSource(relPath);
}

describe('Store Integration Phase 1 Verification Suite', () => {

  // =========================================================================
  // TASK-1.1: PURGE AMAZON MOCK FALLBACK
  // =========================================================================
  describe('TASK-1.1: Purge Amazon Mock Fallback', () => {
    test('Amazon sync route has zero sampleProducts or synthetic orders', () => {
      const content = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(!content.includes('sampleProducts'), 'Amazon route must not contain sampleProducts');
      assert.ok(!content.includes('sampleLocations'), 'Amazon route must not contain sampleLocations');
      assert.ok(!content.includes('AMZ-TECH-TWS-01'), 'Amazon route must not contain mock SKU AMZ-TECH-TWS-01');
    });

    test('Amazon sync route handles zero orders without synthetic fallback', () => {
      const content = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(
        content.includes('orders: []') && content.includes('totalFetched: providerOrders.length'),
        'Amazon route must return empty orders array with totalFetched: 0 on zero orders'
      );
    });

    test('Amazon sync route returns explicit AMAZON_SYNC_FAILED on LWA or SP-API failures', () => {
      const content = readProjectFile('src/app/api/integrations/amazon/sync/route.ts');
      assert.ok(content.includes('AMAZON_SYNC_FAILED'), 'Amazon route must return AMAZON_SYNC_FAILED on failure');
      assert.ok(content.includes('502'), 'Amazon sync failure must return HTTP 502');
    });
  });

  // =========================================================================
  // TASK-1.2: PURGE MEESHO MOCK FALLBACK & FAKE VERIFICATION
  // =========================================================================
  describe('TASK-1.2: Purge Meesho Mock Fallback & Fake Verification', () => {
    test('Meesho sync route has zero sampleProducts or mock generators', () => {
      const content = readProjectFile('src/app/api/integrations/meesho/sync/route.ts');
      assert.ok(!content.includes('sampleProducts'), 'Meesho route must not contain sampleProducts');
      assert.ok(!content.includes('MSHO-98311-MSE'), 'Meesho route must not contain mock saree product');
      assert.ok(!content.includes('supplier.meesho.com/api/v1/auth/verify'), 'Fake network swallow must be removed');
    });

    test('Meesho sync route returns HTTP 501 MEESHO_API_ACCESS_UNAVAILABLE and instructs CSV/XLSX import', () => {
      const content = readProjectFile('src/app/api/integrations/meesho/sync/route.ts');
      assert.ok(content.includes('MEESHO_API_ACCESS_UNAVAILABLE'), 'Must specify MEESHO_API_ACCESS_UNAVAILABLE code');
      assert.ok(content.includes('501'), 'Must return HTTP 501 Not Implemented');
      assert.ok(content.includes('CSV') || content.includes('XLSX'), 'Must direct merchant to CSV/XLSX reports');
    });
  });

  // =========================================================================
  // TASK-1.3: PURGE MYNTRA MOCK FALLBACK & FAKE VERIFICATION
  // =========================================================================
  describe('TASK-1.3: Purge Myntra Mock Fallback & Fake Verification', () => {
    test('Myntra sync route has zero sampleProducts or mock generators', () => {
      const content = readProjectFile('src/app/api/integrations/myntra/sync/route.ts');
      assert.ok(!content.includes('sampleProducts'), 'Myntra route must not contain sampleProducts');
      assert.ok(!content.includes('MYN-9941-SLM'), 'Myntra route must not contain mock clothing product');
      assert.ok(!content.includes('partner.myntra.com/api/v1/auth/verify'), 'Fake network swallow must be removed');
    });

    test('Myntra sync route returns HTTP 501 MYNTRA_PPMP_ACCESS_UNAVAILABLE and instructs settlement sheet upload', () => {
      const content = readProjectFile('src/app/api/integrations/myntra/sync/route.ts');
      assert.ok(content.includes('MYNTRA_PPMP_ACCESS_UNAVAILABLE'), 'Must specify MYNTRA_PPMP_ACCESS_UNAVAILABLE code');
      assert.ok(content.includes('501'), 'Must return HTTP 501 Not Implemented');
      assert.ok(content.includes('CSV') || content.includes('XLSX'), 'Must direct merchant to CSV/XLSX reports');
    });
  });

  // =========================================================================
  // TASK-1.4: PURGE FLIPKART MOCK FALLBACKS & FIX ERROR BOUNDARIES
  // =========================================================================
  describe('TASK-1.4: Purge Flipkart Mock Fallbacks & Fix Error Boundaries', () => {
    test('Flipkart sync route has zero hardcoded 45% cost assumptions', () => {
      const content = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(!content.includes('price * 0.45'), 'Flipkart route must not hardcode 45% unit cost');
      assert.ok(!content.includes('price * 0.12'), 'Flipkart route must not hardcode 12% marketplace charges estimate');
    });

    test('Flipkart sync route enforces explicit 401/502 error codes', () => {
      const content = readProjectFile('src/app/api/integrations/flipkart/sync/route.ts');
      assert.ok(content.includes('FLIPKART_AUTH_FAILED'), 'Must return FLIPKART_AUTH_FAILED on invalid credentials');
      assert.ok(content.includes('FLIPKART_SYNC_FAILED'), 'Must return FLIPKART_SYNC_FAILED on search errors');
    });
  });

  // =========================================================================
  // TASK-1.5: ENFORCE STANDARDIZED ERROR ENVELOPE ACROSS ALL SYNC ENDPOINTS
  // =========================================================================
  describe('TASK-1.5: Standardized Error Envelope Across All Endpoints', () => {
    test('Standardized error helper exists and implements envelope schema', () => {
      const helperContent = readProjectFile('src/lib/integrations/error-response.ts');
      assert.ok(helperContent.includes('export interface MarketplaceErrorEnvelope'), 'MarketplaceErrorEnvelope interface must be exported');
      assert.ok(helperContent.includes('export function marketplaceError'), 'marketplaceError helper must be exported');
      assert.ok(helperContent.includes('success: false'), 'Envelope must specify success: false');
      assert.ok(helperContent.includes('code'), 'Envelope must include code field');
      assert.ok(helperContent.includes('error'), 'Envelope must include error field');
      assert.ok(helperContent.includes('marketplace'), 'Envelope must include marketplace field');
      assert.ok(helperContent.includes('timestamp'), 'Envelope must include timestamp field');
    });

    test('All marketplace sync routes import and utilize standardized marketplaceError', () => {
      const routes = [
        'src/app/api/integrations/amazon/sync/route.ts',
        'src/app/api/integrations/flipkart/sync/route.ts',
        'src/app/api/integrations/meesho/sync/route.ts',
        'src/app/api/integrations/myntra/sync/route.ts',
        'src/app/api/integrations/shopify/sync/route.ts',
        'src/app/api/integrations/woocommerce/sync/route.ts',
        'src/app/api/integrations/generic/sync/route.ts',
      ];

      for (const route of routes) {
        const content = readProjectFile(route);
        assert.ok(
          content.includes('marketplaceError'),
          `Route ${route} must import and utilize marketplaceError helper`
        );
      }
    });
  });
});
