import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `Required file missing: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('UI/UX Analyst Verification Test Suite', () => {

  // =========================================================================
  // SUITE 1: NAMING CONVENTION & HEADING CENTRALIZATION
  // =========================================================================
  describe('Suite 1: Naming Convention & Heading Centralization', () => {
    test('1.1 Navigation single-source-of-truth configuration exists and is complete', () => {
      const configContent = readProjectFile('src/lib/navigation-config.ts');
      assert.ok(configContent.includes('export const MODULE_NAVIGATION_CONFIG'), 'MODULE_NAVIGATION_CONFIG must be exported');
      assert.ok(configContent.includes('export function getModuleNavMeta'), 'getModuleNavMeta helper must be exported');

      const expectedModules = [
        'dashboard',
        'orders',
        'returns',
        'claims',
        'products',
        'settlements',
        'suppliers',
        'purchases',
        'expenses',
        'reports',
        'ledger',
        'webhooks',
        'trash',
        'documents'
      ];

      for (const mod of expectedModules) {
        assert.ok(
          configContent.includes(`"${mod}":`) || configContent.includes(`'${mod}':`) || configContent.includes(`${mod}:`),
          `Module config missing entry for: ${mod}`
        );
      }
    });

    test('1.2 Navbar dynamically and consistently resolves titles via navigation-config', () => {
      const navbarContent = readProjectFile('src/components/layout/navbar.tsx');
      assert.ok(
        navbarContent.includes('getModuleNavMeta'),
        'Navbar must import and use getModuleNavMeta for title resolution'
      );
      assert.ok(
        navbarContent.includes('navMeta.navbarTitle'),
        'Navbar must render navMeta.navbarTitle'
      );
    });

    test('1.3 All module views implement standardized, hardcoded H1 titles and subtitles', () => {
      const moduleChecks = [
        {
          file: 'src/components/modules/orders-view.tsx',
          expectedTitle: 'Orders',
          expectedSubtitle: 'Order Lifecycle, Unit Economics & Settlement Status'
        },
        {
          file: 'src/components/modules/dashboard-view.tsx',
          expectedTitle: 'Financial Overview',
          expectedSubtitle: 'Real-Time Multi-Channel Performance & Profit Intelligence'
        },
        {
          file: 'src/components/modules/ai-staging-view.tsx',
          expectedTitle: 'Document Verification & Staging',
          expectedSubtitle: 'Intelligent Document Processing & Multi-Model Ingestion'
        },
        {
          file: 'src/components/modules/expenses-view.tsx',
          expectedTitle: 'Operating Expenses',
          expectedSubtitle: 'Business Overheads, Subscriptions & Operational OPEX Ledger'
        },
        {
          file: 'src/components/modules/returns-view.tsx',
          expectedTitle: 'Returns & Reverse Logistics',
          expectedSubtitle: 'Customer Returns, Courier RTO & Reverse Freight Tolls'
        },
        {
          file: 'src/components/modules/claims-view.tsx',
          expectedTitle: 'Claims & Dispute Recoveries',
          expectedSubtitle: 'Automated SAFE-T Claims, SPF Filing & Capital Recovery'
        },
        {
          file: 'src/components/modules/settlements-view.tsx',
          expectedTitle: 'Marketplace Settlements',
          expectedSubtitle: 'Bank Remittances, UTR Reconciliation & Statutory Withholdings'
        },
        {
          file: 'src/components/modules/purchases-view.tsx',
          expectedTitle: 'Purchases & Inbound Bills',
          expectedSubtitle: 'Inbound Wholesale Invoices, Landed Costs & Inventory Restock'
        },
        {
          file: 'src/components/modules/suppliers-view.tsx',
          expectedTitle: 'Wholesale Suppliers',
          expectedSubtitle: 'Vendor Directory, Cost Trends & Accounts Payable'
        },
        {
          file: 'src/components/modules/reports-view.tsx',
          expectedTitle: 'Analytics & Financial Reports',
          expectedSubtitle: 'Contribution Margin P&L, SKU Breakdown & Growth Trends'
        },
        {
          file: 'src/components/modules/ledger-view.tsx',
          expectedTitle: 'Double-Entry General Ledger',
          expectedSubtitle: 'Immutable Financial Transaction Journal & Trial Balance'
        },
        {
          file: 'src/components/modules/recycle-bin-view.tsx',
          expectedTitle: 'Recycle Bin',
          expectedSubtitle: 'Restorable Archival Ledger & Soft-Deleted Records'
        },
        {
          file: 'src/components/modules/webhook-simulator.tsx',
          expectedTitle: 'Store Integrations',
          expectedSubtitle: 'Marketplace SP-API Connectors, Couriers & Webhooks'
        }
      ];

      for (const check of moduleChecks) {
        const content = readProjectFile(check.file);
        const normalizedContent = content.replace(/&amp;/g, '&');
        assert.ok(
          normalizedContent.includes(check.expectedTitle),
          `Module file ${check.file} must include standardized title: "${check.expectedTitle}"`
        );
        assert.ok(
          normalizedContent.includes(check.expectedSubtitle),
          `Module file ${check.file} must include standardized subtitle: "${check.expectedSubtitle}"`
        );
      }
    });

    test('1.4 Recycle Bin heading has standardized font size hierarchy (not shrunken text-sm)', () => {
      const recycleBinContent = readProjectFile('src/components/modules/recycle-bin-view.tsx');
      assert.ok(
        !recycleBinContent.includes('<h1 className="text-sm'),
        'Recycle bin heading must not be shrunken to text-sm'
      );
      assert.ok(
        recycleBinContent.includes('text-2xl sm:text-3xl font-bold tracking-tight'),
        'Recycle bin heading must follow standardized text-2xl/3xl typography'
      );
    });
  });

  // =========================================================================
  // SUITE 2: CURSOR INVARIANTS & CURSOR GLITCH RESOLUTIONS
  // =========================================================================
  describe('Suite 2: Cursor Invariants & Cursor Glitches', () => {
    test('2.1 Zero occurrences of cursor-crosshair in codebase (prevents blank/corrupted reticle on high-DPI)', () => {
      const srcDir = path.join(ROOT_DIR, 'src');
      function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            assert.ok(
              !content.includes('cursor-crosshair'),
              `File contains forbidden cursor-crosshair which causes cursor blanking: ${path.relative(ROOT_DIR, fullPath)}`
            );
          }
        }
      }
      scanDir(srcDir);
    });

    test('2.2 Disabled button states are not overridden by trailing cursor-pointer', () => {
      const filesWithDisabledButtons = [
        'src/app/login/page.tsx',
        'src/components/modules/dashboard-view.tsx',
        'src/components/modals/csv-import-modal.tsx',
        'src/components/modals/product-bulk-upload-modal.tsx',
        'src/components/modules/ai-staging-view.tsx'
      ];

      for (const relPath of filesWithDisabledButtons) {
        const content = readProjectFile(relPath);
        // Ensure no pattern where disabled:cursor-not-allowed is directly followed by cursor-pointer in the same class string
        const hasConflict = /disabled:cursor-not-allowed\s+cursor-pointer/.test(content);
        assert.ok(
          !hasConflict,
          `File has conflicting cursor precedence (disabled:cursor-not-allowed followed by cursor-pointer): ${relPath}`
        );
      }
    });

    test('2.3 Landing page content sections do not have blanket select-none blocking cursor and text selection', () => {
      const landingSectionFiles = [
        'src/components/landing/marginflow-hero.tsx',
        'src/components/landing/marginflow-workspace-showcase.tsx',
        'src/components/landing/marginflow-route-comparison.tsx',
        'src/components/landing/marginflow-compound-metrics.tsx',
        'src/components/landing/marginflow-flow-machine.tsx',
        'src/components/landing/marginflow-footer.tsx',
        'src/components/landing/marginflow-marquee.tsx',
        'src/app/page.tsx'
      ];

      for (const relPath of landingSectionFiles) {
        const content = readProjectFile(relPath);
        // Check that root <section or <footer does not have select-none
        const rootSectionSelectNone = /<(section|footer)[^>]*class(Name)?="[^"]*\bselect-none\b[^"]*"/.test(content);
        assert.ok(
          !rootSectionSelectNone,
          `Content container in ${relPath} has blanket select-none which disrupts cursor and text selection`
        );
      }
    });
  });

  // =========================================================================
  // SUITE 3: CARD LAYOUT & RESPONSIVE OVERLAP RESOLUTION
  // =========================================================================
  describe('Suite 3: Card Layout & Responsive Overlap Resolution', () => {
    test('3.1 Flow Machine step cards have responsive flex/width constraints and scroll containers', () => {
      const flowMachineContent = readProjectFile('src/components/landing/marginflow-flow-machine.tsx');
      
      // Check that rigid fixed width w-38 shrink-0 is not used
      assert.ok(
        !flowMachineContent.includes('w-38 shrink-0 whitespace-nowrap'),
        'Flow machine must not use rigid w-38 shrink-0 fixed containers that cause overlap/clipping'
      );

      // Check responsive card bounds
      assert.ok(
        flowMachineContent.includes('min-w-[125px]') || flowMachineContent.includes('min-w-'),
        'Flow machine cards must declare minimum width constraints'
      );
      assert.ok(
        flowMachineContent.includes('overflow-x-auto'),
        'Flow machine container must allow smooth horizontal scroll on smaller viewports'
      );
    });

    test('3.2 Hero telemetry cards use responsive grid preventing overlap on narrow screens', () => {
      const heroContent = readProjectFile('src/components/landing/marginflow-hero.tsx');
      assert.ok(
        heroContent.includes('grid-cols-1 sm:grid-cols-3'),
        'Hero telemetry metrics must use responsive grid (grid-cols-1 sm:grid-cols-3) to avoid number collision'
      );
      // Uniform border on buttons to prevent 1px height jitter
      assert.ok(
        heroContent.includes('border-2') && !heroContent.includes('border border-white/10 hover:border-2'),
        'Hero channel selector buttons must use uniform border-2 to prevent layout jitter'
      );
    });

    test('3.3 Route comparison step cards use responsive columns and uniform border widths', () => {
      const routeContent = readProjectFile('src/components/landing/marginflow-route-comparison.tsx');
      assert.ok(
        routeContent.includes('grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'),
        'Route comparison nodes must use responsive multi-breakpoint grid'
      );
      assert.ok(
        !routeContent.includes('border-black/5 hover:border-2'),
        'Route comparison cards must use uniform border-2 to eliminate timer step height jump'
      );
    });
  });

  // =========================================================================
  // SUITE 4: MODAL STANDARDS & INVARIANTS (UI_UX_STANDARDS.md)
  // =========================================================================
  describe('Suite 4: Modal UI/UX Standards & Invariants', () => {
    test('4.1 Modal backdrops adhere strictly to bg-black/30 backdrop-blur-xs with zero heavy blurs', () => {
      const modalDir = path.join(ROOT_DIR, 'src/components/modals');
      const files = fs.readdirSync(modalDir).filter(f => f.endsWith('.tsx'));

      for (const file of files) {
        const content = readProjectFile(`src/components/modals/${file}`);
        
        // Assert no heavy blurs on backdrop
        assert.ok(!content.includes('backdrop-blur-md'), `${file} must not use prohibited backdrop-blur-md on backdrop`);
        assert.ok(!content.includes('backdrop-blur-lg'), `${file} must not use prohibited backdrop-blur-lg on backdrop`);
        assert.ok(!content.includes('backdrop-blur-xl'), `${file} must not use prohibited backdrop-blur-xl on backdrop`);

        // Check adherence to dark tint backdrop-blur-xs
        assert.ok(
          content.includes('backdrop-blur-xs') || content.includes('bg-black/30'),
          `${file} must use standard dark tint backdrop (bg-black/30 backdrop-blur-xs)`
        );

        // Check Escape key dismissal
        assert.ok(
          content.includes('Escape') || content.includes('key === "Escape"'),
          `${file} must support Escape key dismissal`
        );
      }
    });
  });

  // =========================================================================
  // SUITE 5: TYPESCRIPT STATIC TYPE SAFETY VERIFICATION
  // =========================================================================
  describe('Suite 5: TypeScript Static Type Safety', () => {
    test('5.1 Codebase passes TypeScript compilation (npx tsc --noEmit) with zero errors', () => {
      const output = execSync('npx tsc --noEmit', {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      assert.strictEqual(output.trim(), '', 'TypeScript compilation must produce zero errors');
    });
  });

  // =========================================================================
  // SUITE 6: MULTI-DEVICE & RESPONSIVE VIEWPORT OPTIMIZATIONS
  // =========================================================================
  describe('Suite 6: Multi-Device & Responsive Viewport Optimizations', () => {
    test('6.1 Sidebar supports mobile drawer overlay with backdrop and touch-friendly dismissal', () => {
      const sidebarContent = readProjectFile('src/components/layout/sidebar.tsx');
      assert.ok(
        sidebarContent.includes('fixed inset-0 bg-black/30 backdrop-blur-xs z-40 md:hidden'),
        'Sidebar must render a mobile backdrop when open on mobile viewports'
      );
      assert.ok(
        sidebarContent.includes('max-md:fixed max-md:inset-y-0 max-md:left-0'),
        'Sidebar must use fixed overlay drawer positioning on mobile viewports'
      );
      assert.ok(
        sidebarContent.includes('max-md:w-0'),
        'Sidebar must cleanly hide (max-md:w-0) when collapsed on mobile'
      );
    });

    test('6.2 Navbar includes responsive mobile channel dropdown and desktop segmented pill bar', () => {
      const navbarContent = readProjectFile('src/components/layout/navbar.tsx');
      assert.ok(
        navbarContent.includes('sm:hidden relative') && navbarContent.includes('<select'),
        'Navbar must include native accessible select dropdown on mobile viewports (< 640px)'
      );
      assert.ok(
        navbarContent.includes('hidden sm:inline-flex'),
        'Navbar must render segmented pill bar for tablet and desktop viewports (>= 640px)'
      );
      assert.ok(
        navbarContent.includes('truncate max-w-[120px] sm:max-w-none'),
        'Navbar title must truncate on mobile to prevent control displacement'
      );
    });

    test('6.3 Landing navbar action button uses responsive labels avoiding mobile header overflow', () => {
      const landingNavContent = readProjectFile('src/components/landing/marginflow-navbar.tsx');
      assert.ok(
        landingNavContent.includes('sm:hidden') && landingNavContent.includes('Audit Free'),
        'Landing navbar must display compact "Audit Free" label on mobile viewports'
      );
      assert.ok(
        landingNavContent.includes('hidden sm:inline') && landingNavContent.includes('Audit Your Store Free'),
        'Landing navbar must display full "Audit Your Store Free" label on tablet/desktop viewports'
      );
    });

    test('6.4 Core modal dialogs enforce max-h-[90vh] and overflow-y-auto preventing mobile screen cutoff', () => {
      const modalFiles = [
        'src/components/modals/add-purchase-modal.tsx',
        'src/components/modals/card-logic-modal.tsx',
        'src/components/modals/record-return-modal.tsx',
        'src/components/modals/user-profile-modal.tsx',
        'src/components/modals/order-modal.tsx',
        'src/components/modals/supplier-modal.tsx',
        'src/components/modals/csv-import-modal.tsx',
        'src/components/modals/claim-breakdown-modal.tsx'
      ];

      for (const file of modalFiles) {
        const content = readProjectFile(file);
        assert.ok(
          content.includes('max-h-[90vh]') || content.includes('max-h-'),
          `${file} must specify a viewport max-height constraint for mobile devices`
        );
        assert.ok(
          content.includes('overflow-y-auto'),
          `${file} must provide vertical scrollability for smaller viewports and mobile keyboards`
        );
      }
    });

    test('6.5 CFO Copilot drawer optimizes padding (pl-0 sm:pl-10) for full mobile screen width', () => {
      const copilotContent = readProjectFile('src/components/ai/cfo-copilot.tsx');
      assert.ok(
        copilotContent.includes('pl-0 sm:pl-10'),
        'CFO copilot drawer must remove left padding on mobile (pl-0 sm:pl-10) for comfortable thumb usage'
      );
    });
  });
});
