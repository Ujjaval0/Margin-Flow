import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const sessionName = '@/lib/security/session', supabaseName = '@/lib/supabase/server';
const request = () => new Request('https://app.example/api/auth/workspace-tour', { method: 'POST' });

function backend(metadata = {}) {
  const updates = [];
  let signedIn = true, authId = 'auth-A', saveFails = false;
  const auth = {
    getUser: async () => ({ data: { user: { id: authId, user_metadata: metadata } }, error: null }),
    updateUser: async ({ data }) => { updates.push(data); if (saveFails) return { error: Error('private detail') }; Object.assign(metadata, data); return { error: null }; },
  };
  const mocks = {
    [sessionName]: { getSessionUser: async () => signedIn ? { sid: 'auth-A', sub: 'account-A' } : null },
    [supabaseName]: { createSupabaseServerClient: async () => ({ auth }) },
  };
  return { mocks, updates, metadata, signedIn: value => { signedIn = value; }, authId: value => { authId = value; }, saveFails: value => { saveFails = value; } };
}

test('tour claim is authenticated, identity-bound and saved once on the account', async () => {
  const app = backend({ workspaceTourPending: true });
  const route = load('src/app/api/auth/workspace-tour/route.ts', app.mocks);
  app.signedIn(false);
  assert.equal((await route.POST(request())).status, 401);
  app.signedIn(true); app.authId('auth-B');
  assert.equal((await route.POST(request())).status, 401);
  assert.equal(app.updates.length, 0);
  app.authId('auth-A');
  const first = await route.POST(request());
  assert.equal(first.headers.get('Cache-Control'), 'no-store');
  assert.equal((await first.json()).showTour, true);
  assert.equal((await (await route.POST(request())).json()).showTour, false);
  assert.equal(app.updates.length, 1);
  assert.equal(app.metadata.workspaceTourSeen, true);
  assert.equal(app.metadata.workspaceTourPending, false);
});

test('existing users never get queued implicitly and failed saves do not claim success', async () => {
  for (const metadata of [{}, { workspaceTourPending: false }, { workspaceTourPending: true, workspaceTourSeen: true }]) {
    const app = backend(metadata), route = load('src/app/api/auth/workspace-tour/route.ts', app.mocks);
    assert.equal((await (await route.POST(request())).json()).showTour, false);
    assert.equal(app.updates.length, 0);
  }
  const app = backend({ workspaceTourPending: true }), route = load('src/app/api/auth/workspace-tour/route.ts', app.mocks);
  app.saveFails(true);
  const response = await route.POST(request());
  assert.equal(response.status, 503);
  assert.equal(app.metadata.workspaceTourPending, true);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private detail/);
});

test('only first completed onboarding queues the tour, with no financial writes added', async () => {
  for (const metadata of [{}, { onboardingCompleted: true }, { workspaceTourSeen: true }]) {
    const expectedPending = metadata.onboardingCompleted !== true && metadata.workspaceTourSeen !== true;
    const app = backend(metadata), queries = [];
    const route = load('src/app/api/auth/onboarding/route.ts', {
      ...app.mocks, '@/lib/db': { query: async (...args) => { queries.push(args); return { rowCount: 1 }; } },
    });
    const response = await route.POST(new Request('https://app.example/api/auth/onboarding', {
      method: 'POST', body: JSON.stringify({ brandName: 'Test Brand', phone: '9876543210', businessRole: 'FOUNDER', orderVolume: 'STARTER' }),
    }));
    assert.equal(response.status, 200);
    assert.equal(queries.length, 1);
    assert.match(queries[0][0], /UPDATE user_accounts/);
    assert.equal(app.updates[0].workspaceTourPending === true, expectedPending);
  }
});

test('browser claims deduplicate mounts and isolate first-time state by account', async () => {
  const storage = new Map(), calls = [];
  const tour = load('src/lib/workspace-tour.ts', {}, {
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ showTour: true }); },
  });
  const first = tour.claimWorkspaceTour('A');
  assert.equal(tour.claimWorkspaceTour('A'), first);
  assert.equal(await first, true);
  assert.equal(calls.length, 1);
  tour.markWorkspaceTourShown('A');
  assert.equal(await tour.claimWorkspaceTour('A'), false);
  assert.equal(await tour.claimWorkspaceTour('B'), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.credentials, 'same-origin');
});

test('tour callouts fit phone, tablet, desktop and short viewports', () => {
  const { positionTourCard } = load('src/lib/workspace-tour.ts');
  for (const width of [320, 375, 768, 1024, 1440]) {
    for (const height of [320, 667, 900]) {
      for (const rect of [{ left: 12, right: 240, top: 180, bottom: 220 }, { left: width - 60, right: width - 12, top: 12, bottom: 48 }]) {
        const position = positionTourCard(rect, width, height, 240);
        assert.ok(position.left >= 12 && position.left + position.width <= width - 12);
        assert.ok(position.top >= 12 && position.top + 240 <= height - 12);
      }
    }
  }
});

function hookHarness() {
  const slots = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useEffect(fn) { effects.push(fn); }, useLayoutEffect() {}, useCallback: fn => fn, useMemo: fn => fn(),
  };
  return { react, effects, render(fn) { cursor = 0; effects.length = 0; return fn(); } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
  return null;
}

test('tour advances through four steps, traps focus, and dismisses with Escape or outside tap', async () => {
  const hooks = hookHarness(), listeners = new Map(), sidebar = [], shown = [];
  const previousFocus = { focus() { this.focused = true; } };
  const document = { body: {}, activeElement: previousFocus };
  const app = load('src/components/layout/workspace-tour.tsx', {
    react: hooks.react, 'react-dom': { createPortal: child => child },
    '@/lib/workspace-tour': { claimWorkspaceTour: async () => true, markWorkspaceTourShown: id => shown.push(id) },
  }, { document, HTMLElement: Object, window: { innerWidth: 375, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) } });
  const props = { ownerId: 'A', accountType: 'BRAND', isSidebarOpen: false, onSidebarChange: open => sidebar.push(open) };
  const render = () => hooks.render(() => app.WorkspaceTour(props));
  assert.equal(render(), null);
  hooks.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shown, ['A']);
  for (let step = 0; step < 4; step++) {
    const tree = render();
    assert.equal(find(tree, node => node.props?.role === 'dialog').props['aria-modal'], 'true');
    hooks.effects[1](); hooks.effects[3]();
    assert.equal(sidebar.at(-1), step < 3);
    assert.ok(find(tree, node => node.props?.id === 'workspace-tour-title'));
    const next = find(tree, node => node.type === 'button' && node.props.children === (step === 3 ? 'Got it' : 'Next'));
    const firstButton = { focus() { document.activeElement = firstButton; } };
    const lastButton = { focus() { document.activeElement = lastButton; } };
    find(tree, node => node.props?.role === 'dialog').props.ref.current = { querySelectorAll: () => [firstButton, lastButton] };
    document.activeElement = lastButton;
    listeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() {} });
    assert.equal(document.activeElement, firstButton);
    listeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() {} });
    assert.equal(document.activeElement, lastButton);
    if (step < 3) next.props.onClick();
  }
  let prevented = false;
  listeners.get('keydown')({ key: 'Escape', preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, true); assert.equal(render(), null);
  assert.equal(sidebar.at(-1), false); assert.equal(previousFocus.focused, true);

  // Outside clicks invoke the same close path as the circular X and Skip controls.
  hooks.effects[0](); await new Promise(resolve => setImmediate(resolve));
  const reopened = render();
  reopened.props.onClick();
  assert.equal(render(), null);
});

test('AI setup notice stays readable until dismissed and does not replay for the same account', () => {
  const hooks = hookHarness(), storage = new Map();
  const settings = { activeProvider: 'gemini', keys: {}, model: 'recommended' };
  const app = load('src/components/ai/ai-settings-modal.tsx', {
    react: hooks.react, 'react-dom': { createPortal: child => child },
    '@/lib/security/ai-vault': {
      loadAISettings: () => settings, getCachedModels: () => [],
      PROVIDER_REGISTRY: { gemini: { name: 'Test Provider', defaultModel: 'recommended', recommendedModels: ['recommended'] } },
    },
  }, { document: { body: {} }, window: { addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: () => { throw Error('Setup advice must not auto-dismiss.'); },
  });
  const props = { isOpen: true, ownerId: 'A', onClose() {} };
  const render = () => hooks.render(() => app.AISettingsModal(props));
  render();
  hooks.effects[0](); hooks.effects[2]();
  render(); hooks.effects[3]();
  const note = find(render(), node => node.type?.name === 'AISetupNotice');
  assert.ok(note);
  note.props.onDismiss();
  assert.equal(find(render(), node => node.type?.name === 'AISetupNotice'), null);
  hooks.effects[2]();
  assert.equal(find(render(), node => node.type?.name === 'AISetupNotice'), null);
  props.ownerId = 'B'; render(); hooks.effects[2]();
  assert.ok(find(render(), node => node.type?.name === 'AISetupNotice'));
});
