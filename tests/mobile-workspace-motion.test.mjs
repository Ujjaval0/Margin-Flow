import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');

function hooks() {
  const slots = [], effects = [], layouts = [];
  let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect: (fn, deps) => effects.push({ fn, deps }), useLayoutEffect: (fn, deps) => layouts.push({ fn, deps }),
    useMemo: fn => fn(),
  };
  return { react, effects, layouts, render(fn) { cursor = 0; effects.length = 0; layouts.length = 0; return fn(); } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
  return null;
}

test('viewport subscription hydrates safely and handles orientation changes without resize polling', () => {
  const state = hooks(), listeners = new Map();
  const media = { matches: true, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const { useMobileViewport } = load('src/lib/use-mobile-viewport.ts', { react: state.react }, { window: { matchMedia: query => { assert.equal(query, '(max-width: 767px)'); return media; } } });
  const render = () => state.render(useMobileViewport);
  assert.equal(render(), null);
  const cleanup = state.effects[0].fn();
  assert.equal(render(), true);
  media.matches = false; listeners.get('change')();
  assert.equal(render(), false);
  cleanup(); assert.equal(listeners.size, 0);
});

test('phone navigation keeps the page wrapper stable and avoids synthetic chart resizing', () => {
  const state = hooks(), timers = [], scrolls = [];
  let mobile = true, pathname = '/orders';
  const platform = { returns: [], verifiedOwnerId: null, currentUser: {} };
  const { default: Layout } = load('src/app/(dashboard)/layout.tsx', {
    react: state.react, 'next/dynamic': () => () => null,
    'next/navigation': { usePathname: () => pathname },
    '@/lib/use-mobile-viewport': { useMobileViewport: () => mobile },
    '@/components/layout/sidebar': { Sidebar: 'Sidebar' }, '@/components/layout/navbar': { Navbar: 'Navbar' },
    '@/domain/store': { PlatformProvider: 'Provider', usePlatform: () => platform },
  }, { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {} });
  const shell = Layout({ children: 'orders' }).props.children;
  const render = () => state.render(() => shell.type({ children: pathname }));
  let tree = render();
  const wrapper = node => node.props?.className === 'page-transition min-w-0 w-full';
  const firstKey = find(tree, wrapper).key;
  const resizeEffect = () => state.effects.find(effect => effect.deps?.length === 2 && typeof effect.deps[0] === 'boolean').fn();
  resizeEffect(); assert.equal(timers.length, 0);
  find(tree, node => node.type === 'main').props.ref.current = { scrollTo: value => scrolls.push(value) };
  state.layouts[0].fn();
  assert.equal(scrolls[0].behavior, 'instant');
  find(tree, node => node.type === 'Sidebar').props.onToggle();
  pathname = '/returns'; tree = render();
  assert.equal(find(tree, wrapper).key, firstKey, 'section navigation must not remount the whole mobile page boundary');
  resizeEffect(); assert.equal(timers.length, 0);
  mobile = false; tree = render(); resizeEffect();
  assert.equal(find(tree, wrapper).key, '/returns', 'desktop keeps its established page entrance');
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 320);
});

test('mobile drawer keeps its labels during dismissal and blocks focus when closed', () => {
  const state = hooks(), selected = [], listeners = new Map();
  let mobile = true, toggles = 0;
  const { Sidebar } = load('src/components/layout/sidebar.tsx', {
    react: state.react, 'next/dynamic': () => () => null,
    'next/navigation': { usePathname: () => '/orders' },
    '@/lib/use-mobile-viewport': { useMobileViewport: () => mobile },
    '@/domain/store': { usePlatform: () => ({ currentUser: { name: 'Test User', accountType: 'BRAND_OWNER' } }) },
  }, { window: { innerWidth: 375, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) } });
  const props = { isOpen: true, onToggle: () => toggles++, onSelectModule: id => selected.push(id) };
  const render = () => state.render(() => Sidebar(props));
  let tree = render();
  const openLabels = find(tree, node => node.props?.['data-tour'] === 'orders').props.children;
  state.effects.find(effect => effect.deps?.length === 3).fn();
  listeners.get('keydown')({ key: 'Escape' }); assert.equal(toggles, 1);
  const link = find(tree, node => node.props?.['data-tour'] === 'orders');
  assert.equal(link.props.scroll, false); assert.equal(link.props.prefetch, true);
  link.props.onClick(); assert.deepEqual(selected, ['orders']); assert.equal(toggles, 2);
  props.isOpen = false; tree = render();
  const closed = find(tree, node => node.type === 'aside');
  assert.equal(closed.props.inert, true); assert.equal(closed.props['aria-hidden'], true);
  assert.equal(find(tree, node => node.props?.['data-tour'] === 'orders').props.children[0].props.children[1].type,
    openLabels[0].props.children[1].type, 'the expanded label stays mounted throughout the mobile slide');
  mobile = false; tree = render();
  assert.equal(find(tree, node => node.type === 'aside').props.inert, false, 'desktop collapsed navigation stays available');
});
