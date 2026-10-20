import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Source-wiring checks follow the extracted route boundary and provider implementation.
// Behavioral tests exercise these modules separately with explicit I/O fixtures.
export function readIntegrationSource(relative) {
  const files = [relative];
  const match = relative.match(/^src\/app\/api\/integrations\/(amazon|flipkart|shopify|woocommerce)\/(sync|finances)\/route.ts$/);
  if (match) {
    files.push(`src/lib/integrations/providers/${match[1]}-${match[2]}.ts`,
      'src/lib/integrations/integration-route.ts', 'src/lib/integrations/provider-pagination.ts', 'src/lib/integrations/provider-http.ts');
    if (match[1] === 'shopify' || match[1] === 'flipkart') files.push('src/lib/integrations/provider-auth.ts');
    if (match[1] === 'shopify') files.push('src/lib/integrations/shopify-orders.ts');
  }
  if (/integrations\/(amazon|flipkart|shopify)\/(connect|callback)\/route.ts$/.test(relative)) files.push('src/lib/integrations/oauth-routes.ts', 'src/lib/integrations/provider-auth.ts');
  return files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}
