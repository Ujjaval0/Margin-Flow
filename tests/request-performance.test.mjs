import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const settle = () => new Promise(resolve => setImmediate(resolve));

function providerHarness() {
  const slots = [], effects = [], listeners = new Map(), requests = [], identities = [];
  let cursor = 0, firstRender = true, owner = 'A';
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn) { if (firstRender) effects.push(fn); },
  };
  const storage = { getItem: () => null };
  const backend = load.makeLedgerBackend({}, { owner: () => owner });
  const window = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
  };
  const provider = load('src/domain/store.tsx', { react }, {
    window, localStorage: storage,
    fetch: (url, init) => {
      requests.push(url);
      if (url === '/api/auth/me') return new Promise(resolve => identities.push(resolve));
      return backend.fetch(url, init);
    },
  });
  const render = () => {
    cursor = 0;
    const value = provider.PlatformProvider({ children: null }).props.value;
    firstRender = false;
    return value;
  };
  render();
  const cleanup = effects[0]();
  return {
    render, requests, identities, listeners, cleanup,
    event: (name, event = {}) => listeners.get(name)?.(event),
    storage: key => listeners.get('storage')?.({ key, storageArea: storage }),
    identity: (index, id, status = 200) => { owner = id; identities[index](Response.json({ user: { id } }, { status })); },
  };
}

test('background events share pending hydration and ignore unrelated storage changes', async () => {
  const app = providerHarness();
  assert.equal(app.identities.length, 1);
  app.event('focus'); app.event('pageshow', { persisted: false });
  app.storage('marginflow_theme'); app.storage('marginflow_sidebar_open'); app.storage('marginflow_ai_vault_v1');
  assert.equal(app.identities.length, 1);
  app.identity(0, 'A'); await settle();
  assert.deepEqual(app.requests, ['/api/auth/me', '/api/ledger-records']);
  app.event('pageshow', { persisted: false });
  assert.equal(app.identities.length, 1, 'initial pageshow must not repeat mount hydration');
  app.event('pageshow', { persisted: true }); app.event('focus');
  assert.equal(app.identities.length, 2, 'a restored page still verifies the live session');
  app.identity(1, 'A'); await settle();
  app.storage('MARGINFLOW_PERSISTENT_LEDGER_V3:B');
  assert.equal(app.identities.length, 2, 'another tenant cache must not trigger hydration');
  app.storage('MARGINFLOW_PERSISTENT_LEDGER_V3:A');
  assert.equal(app.identities.length, 3);
  app.identity(2, 'A'); await settle();
  app.cleanup();
  assert.equal(app.listeners.size, 0);
});

test('session changes supersede pending reads and immediately clear revoked identities', async () => {
  const app = providerHarness();
  app.event('marginflow:session-changed');
  assert.equal(app.identities.length, 2, 'account changes must bypass background sharing');
  app.identity(1, 'B'); await settle();
  assert.equal(app.render().verifiedOwnerId, 'B');
  app.identity(0, 'A'); await settle();
  assert.equal(app.render().verifiedOwnerId, 'B', 'the older account read cannot replace the newer identity');
  app.storage('sb-project-auth-token.0');
  assert.equal(app.identities.length, 3);
  app.identity(2, 'B', 401); await settle();
  assert.equal(app.render().verifiedOwnerId, null);
  assert.equal(app.render().orders.length, 0);
  app.storage(null);
  assert.equal(app.identities.length, 4, 'clearing local storage must still revalidate identity');
  app.identity(3, 'B', 401); await settle();
  app.cleanup();
});
