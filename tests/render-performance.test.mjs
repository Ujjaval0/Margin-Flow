import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('development and production use separate generated output directories', async () => {
  const { default: configure } = await import('../next.config.mjs');
  assert.equal(configure('phase-development-server').distDir, '.next-dev');
  assert.equal(configure('phase-production-build').distDir, '.next');
  assert.equal(configure('phase-production-server').distDir, '.next');
});

test('reused formatters preserve currency, date and invalid-date output', () => {
  const { formatINR, formatDate } = load('src/lib/utils.ts');
  for (const amount of [0, -0, 0.005, -1.005, 1234567.89, NaN, Infinity, -Infinity]) {
    assert.equal(formatINR(amount), new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount));
  }
  for (const date of ['2026-10-19', '2026-10-19T23:59:00Z', 'invalid', '']) {
    assert.equal(formatDate(date), new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  }
});

test('indexed table search retains nested depth, direct keys and primitive matching', () => {
  const { createRecordSearch } = load('src/lib/table-search.ts');
  const baseline = (record, query, key) => {
    if (!query) return true;
    if (key && record?.[key] != null && String(record[key]).toLowerCase().includes(query)) return true;
    const search = (value, depth = 0) => {
      if (depth > 2 || value == null) return false;
      if (typeof value === 'string' || typeof value === 'number') return String(value).toLowerCase().includes(query);
      if (Array.isArray(value)) return value.some(item => search(item, depth + 1));
      if (typeof value === 'object') return Object.values(value).some(item => search(item, depth + 1));
      return false;
    };
    return search(record);
  };
  const records = [{ name: 'Alpha', amount: 100.25, nested: { label: 'Beta', deep: { label: 'hidden' } } },
    { name: 'Gamma', tags: ['One', 'Two'], enabled: true }, { name: null, tags: ['Beta', null], date: new Date() },
    ['Alpha', ['Beta']], 'Alpha', 0, null, false];
  for (const key of [undefined, 'name', 'tags', 'enabled']) {
    const matches = createRecordSearch(key);
    for (const query of ['', 'alpha', '100', 'beta', 'hidden', 'one,two', 'true', 'no-match', 'alpha']) {
      for (const row of records) assert.equal(matches(row, query), baseline(row, query, key));
    }
  }
  let reads = 0;
  const row = { get label() { reads++; return 'Alpha'; } };
  const matches = createRecordSearch();
  assert.equal(matches(row, 'alpha'), true);
  assert.equal(matches(row, 'alpha'), true);
  assert.equal(matches(row, 'beta'), false);
  assert.equal(reads, 1, 'searching another column or query must reuse normalized fields');
});

test('idle work waits for the browser and stale callbacks remain cancelled', () => {
  let callback, options, cancelled, calls = 0;
  const idle = load('src/lib/browser-tasks.ts', {}, { window: {
    requestIdleCallback: (fn, config) => { callback = fn; options = config; return 7; },
    cancelIdleCallback: id => { cancelled = id; },
  } });
  const cancel = idle.scheduleIdleTask(() => calls++);
  assert.equal(calls, 0); assert.equal(options.timeout, 2000);
  cancel(); callback();
  assert.equal(cancelled, 7); assert.equal(calls, 0);
  idle.scheduleIdleTask(() => calls++); callback();
  assert.equal(calls, 1);
  const fallback = load('src/lib/browser-tasks.ts', {}, { window: {
    setTimeout: fn => { callback = fn; return 8; }, clearTimeout: id => { cancelled = id; },
  } });
  const stop = fallback.scheduleIdleTask(() => calls++);
  stop(); callback();
  assert.equal(cancelled, 8); assert.equal(calls, 1);
});

function hooks() {
  const slots = [], effects = [], layouts = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect: fn => effects.push(fn), useLayoutEffect: fn => layouts.push(fn),
    useMemo: fn => fn(), useCallback: fn => fn,
  };
  return { react, slots, effects, layouts, render(fn) { cursor = 0; effects.length = 0; layouts.length = 0; return fn(); } };
}

test('open dropdowns measure at most once per frame and release pending scroll work', () => {
  const harness = hooks(), frames = new Map(), listeners = new Map(), documentListeners = new Map();
  let frameId = 0, measurements = 0;
  const window = {
    innerWidth: 375, innerHeight: 667,
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    addEventListener: (name, fn, options) => listeners.set(name, { fn, options }),
    removeEventListener: name => listeners.delete(name),
  };
  const document = { addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: name => documentListeners.delete(name) };
  const dropdown = load('src/components/ui/marketplace-dropdown.tsx', {
    react: harness.react,
    '@/lib/marketplace-config': { MARKETPLACE_CONFIGS: { 'Amazon India': { icon: 'icon', label: 'Amazon', colorClass: '' } } },
  }, { window, document });
  const render = () => harness.render(() => dropdown.FormMarketplaceDropdown({ selected: 'Amazon India', onChange() {} }));
  const closed = render();
  harness.effects[0]();
  assert.equal(documentListeners.size, 0, 'closed controls must not listen to every document click');
  closed.props.children[0].props.onClick();
  const opened = render();
  opened.props.children[0].props.ref.current = { getBoundingClientRect() { measurements++; return { right: 350, top: 100, bottom: 134 }; } };
  const cleanup = harness.layouts[0]();
  const initialPosition = harness.slots[1];
  assert.equal(measurements, 1);
  for (let i = 0; i < 20; i++) listeners.get('scroll').fn();
  assert.equal(frames.size, 1); assert.equal(listeners.get('scroll').options.passive, true);
  const frame = frames.values().next().value; frames.clear(); frame();
  assert.equal(measurements, 2); assert.equal(harness.slots[1], initialPosition, 'unchanged geometry must not cause another render');
  assert.ok(initialPosition.left >= 8 && initialPosition.left + initialPosition.width <= window.innerWidth - 8);
  for (const width of [320, 768, 1024, 1440]) {
    window.innerWidth = width;
    listeners.get('resize').fn();
    const resize = frames.values().next().value; frames.clear(); resize();
    const position = harness.slots[1];
    assert.ok(position.left >= 8 && position.left + position.width <= width - 8, 'menu stays inside viewport at ' + width + 'px');
  }
  listeners.get('resize').fn(); cleanup();
  assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
});

test('decorative hero motion pauses offscreen and in hidden tabs, then resumes', () => {
  const harness = hooks(), listeners = new Map();
  let observed, visibility, disconnected = false;
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  class IntersectionObserver {
    constructor(callback) { visibility = callback; }
    observe(element) { observed = element; }
    disconnect() { disconnected = true; }
  }
  const { MarginFlowHero } = load('src/components/landing/marginflow-hero.tsx', { react: harness.react }, { document, IntersectionObserver });
  const hero = harness.render(() => MarginFlowHero({ onSignIn() {}, isAuthenticating: false }));
  hero.props.ref.current = { dataset: {} };
  const cleanup = harness.effects[0]();
  assert.equal(observed.dataset.motionPaused, 'false');
  visibility([{ isIntersecting: false }]); assert.equal(observed.dataset.motionPaused, 'true');
  visibility([{ isIntersecting: true }]); assert.equal(observed.dataset.motionPaused, 'false');
  document.hidden = true; listeners.get('visibilitychange')(); assert.equal(observed.dataset.motionPaused, 'true');
  document.hidden = false; listeners.get('visibilitychange')(); assert.equal(observed.dataset.motionPaused, 'false');
  cleanup(); assert.equal(disconnected, true); assert.equal(listeners.size, 0);
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

test('assistant batches stream paints without losing split Unicode or final action chips', async () => {
  const harness = hooks(), frames = new Map(), reads = [];
  let frameId = 0, anomalyCalls = 0;
  const chip = { id: 'final-action', label: 'Orders', type: 'NAVIGATE', payload: { route: '/orders' } };
  const copilot = load('src/components/ai/cfo-copilot.tsx', {
    react: harness.react, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/domain/store': { usePlatform: () => ({ verifiedOwnerId: 'A' }) },
    '@/lib/security/ai-vault': { loadAISettings: () => ({ activeProvider: 'openai', keys: {}, model: 'test' }), PROVIDER_REGISTRY: {} },
    '@/domain/ai-context': { serializeFinancialContext: () => ({}) },
    '@/domain/anomaly-radar': { computeAnomalyRadar() { anomalyCalls++; return { totalAnomaliesCount: 0 }; } },
    '@/domain/deterministic-analyst': { parseResponseAndChips: text => ({ answer: text, chips: [chip] }) },
  }, {
    window: { requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id) },
    fetch: async () => ({ headers: new Headers({ 'content-type': 'text/plain' }), body: { getReader: () => ({ read: () => new Promise(resolve => reads.push(resolve)) }) } }),
  });
  const render = () => harness.render(() => copilot.CfoCopilot());
  render(); harness.slots[0] = true;
  find(render(), node => node.type === 'input').props.onChange({ target: { value: 'Show sales' } });
  find(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await settle();
  assert.equal(anomalyCalls, 0, 'normal rendering and chat must not scan the anomaly radar');
  const bytes = new TextEncoder().encode('₹100 total');
  reads.shift()({ done: false, value: bytes.slice(0, 1) }); await settle();
  reads.shift()({ done: false, value: bytes.slice(1, 5) }); await settle();
  assert.equal(frames.size, 1, 'several network chunks share one animation frame');
  reads.shift()({ done: false, value: bytes.slice(5) }); await settle();
  reads.shift()({ done: true }); await settle();
  assert.equal(frames.size, 0, 'a late partial paint cannot overwrite the completed response');
  const messages = harness.slots.find(value => Array.isArray(value) && value.some(message => message.sender === 'assistant'));
  assert.equal(messages.at(-1).text, '₹100 total');
  assert.equal(messages.at(-1).chips[0].id, chip.id);
});
