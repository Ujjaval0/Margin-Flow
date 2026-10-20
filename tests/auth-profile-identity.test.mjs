import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url)('./helpers/load-app.cjs');
const settle = () => new Promise(resolve => setImmediate(resolve));
const googleUser = { id: 'merchant-google', name: 'Google Person', email: 'google@example.test', companyName: 'Google Brand', accountType: 'BRAND_OWNER', authenticatedAt: '' };
const passwordUser = { id: 'merchant-password', name: 'Password Person', email: 'password@example.test', companyName: 'Password Brand', phone: '9999999999', avatarUrl: 'https://example.test/old.png', onboardingPreferences: { role: 'OTHER', roleLabel: 'Old Role' } };

// Runs actual component handlers and effects with explicit dependency boundaries.
function hooks() {
  const slots = [], pending = [];
  let cursor = 0, dirty = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) {
        const slot = slots[index] = { deps, cleanup: previous?.cleanup };
        pending.push(() => { slot.cleanup?.(); slot.cleanup = fn(); });
      }
    },
  };
  const renderOnce = fn => { cursor = 0; dirty = false; return fn(); };
  return {
    react, renderOnce,
    render(fn) {
      let result;
      for (let iteration = 0; iteration < 20; iteration++) {
        result = renderOnce(fn);
        while (pending.length) pending.shift()();
        if (!dirty) return result;
      }
      throw Error('Unstable component effects');
    },
  };
}
function storage(initial) {
  const values = new Map(initial ? [['marginflow_session', JSON.stringify(initial)]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function button(tree, label) { return nodes(tree).find(node => node.type === 'button' && node.props.children === label); }
function modalHarness(fetch) {
  const h = hooks(), cache = storage(passwordUser), updates = [], listeners = new Map();
  let currentUser = googleUser;
  const { UserProfileModal } = load('src/components/modals/user-profile-modal.tsx', {
    react: h.react, 'react-dom': { createPortal: jsx => jsx },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/domain/store': { usePlatform: () => ({ currentUser, setCurrentUser: user => { updates.push(user); currentUser = user; } }) },
    '@/lib/supabase/browser': { createSupabaseBrowserClient: () => assert.fail('No photo upload expected') },
  }, { fetch, localStorage: cache, document: { body: {} }, setTimeout: () => 1,
    window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) } });
  const component = () => UserProfileModal({ isOpen: true, onClose() {} });
  return { cache, updates, render: () => h.render(component), immediate: () => h.renderOnce(component), switchTo: user => { currentUser = user; } };
}
function editCompany(app, companyName = 'Edited Brand') {
  button(app.render(), 'Edit Profile').props.onClick();
  nodes(app.render()).find(node => node.props?.['aria-label'] === 'Company or brand name').props.onChange({ target: { value: companyName } });
  return button(app.render(), 'Save Changes').props.onClick();
}

test('profile ignores a previous password account cache after Google login', () => {
  const app = modalHarness(() => assert.fail('Opening profile does not need a separate identity source'));
  let view = JSON.stringify(app.render());
  assert.match(view, /Google Person/); assert.match(view, /google@example.test/); assert.match(view, /Google Brand/);
  assert.doesNotMatch(view, /Password Person|password@example.test|Old Role|9999999999|old.png/);
  app.switchTo(passwordUser);
  assert.equal(app.immediate(), null, 'old form is hidden before the new owner initialization effect');
  view = JSON.stringify(app.render());
  assert.match(view, /Password Person/); assert.match(view, /password@example.test/); assert.match(view, /Old Role/);
  app.switchTo(googleUser);
  assert.equal(app.immediate(), null);
  view = JSON.stringify(app.render());
  assert.doesNotMatch(view, /Password Person|password@example.test|Old Role|9999999999|old.png/);
});

test('an account switch discards an earlier profile save response', async () => {
  let finishSave;
  const requests = [];
  const app = modalHarness((url, init) => {
    requests.push({ url, init });
    if (url === '/api/auth/me') return Promise.resolve(Response.json({ user: googleUser }));
    return new Promise(resolve => { finishSave = resolve; });
  });
  const pending = editCompany(app);
  await settle();
  assert.equal(JSON.parse(requests[1].init.body).expectedAccountId, googleUser.id);
  app.switchTo(passwordUser); app.render();
  finishSave(Response.json({ success: true, user: { ...googleUser, companyName: 'Edited Brand' } }));
  await pending;
  assert.equal(app.updates.length, 0);
  assert.equal(JSON.parse(app.cache.getItem('marginflow_session')).id, passwordUser.id);
  assert.match(JSON.stringify(app.render()), /Password Person/);
});

test('profile preflight refuses a cookie session for another account before writing', async () => {
  let calls = 0;
  const app = modalHarness(async url => {
    calls++; assert.equal(url, '/api/auth/me');
    return Response.json({ user: passwordUser });
  });
  await editCompany(app);
  assert.equal(calls, 1); assert.equal(app.updates.length, 0);
  assert.match(JSON.stringify(app.render()), /Your account changed/);
});

test('successful profile save replaces the stale mirror without retaining foreign fields', async () => {
  const app = modalHarness(async url => url === '/api/auth/me'
    ? Response.json({ user: googleUser })
    : Response.json({ success: true, user: { ...googleUser, companyName: 'Edited Brand' } }));
  await editCompany(app);
  const saved = JSON.parse(app.cache.getItem('marginflow_session'));
  assert.equal(saved.id, googleUser.id); assert.equal(saved.companyName, 'Edited Brand');
  assert.equal(saved.phone, undefined); assert.equal(saved.onboardingPreferences, undefined);
  assert.equal(app.updates.length, 1);
});

test('platform refresh replaces old display fields, mirrors verified identity and clears revoked sessions', async () => {
  const h = hooks(), cache = storage(passwordUser), listeners = new Map();
  let user = passwordUser, status = 200;
  const backend = load.makeLedgerBackend();
  const { PlatformProvider } = load('src/domain/store.tsx', { react: h.react }, {
    localStorage: cache, setTimeout: () => 1, clearTimeout() {},
    window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    fetch: async (url, init) => url === '/api/auth/me' ? Response.json({ user }, { status }) : backend.fetch(url, init),
  });
  const render = () => h.render(() => PlatformProvider({ children: null })).props.value;
  const initial = render();
  assert.equal(initial.currentUser.id, ''); assert.equal(initial.currentUser.email, '');
  await settle();
  assert.equal(render().currentUser.id, passwordUser.id);
  user = googleUser;
  await render().refreshFromDatabase();
  const current = render().currentUser;
  assert.equal(current.id, googleUser.id); assert.equal(current.email, googleUser.email);
  assert.equal(current.phone, undefined); assert.equal(current.avatarUrl, undefined); assert.equal(current.onboardingPreferences, undefined);
  assert.equal(JSON.parse(cache.getItem('marginflow_session')).email, googleUser.email);
  const stableProfile = current;
  await render().refreshFromDatabase();
  assert.equal(render().currentUser, stableProfile, 'unchanged focus checks must not reset an open edit form');
  listeners.get('marginflow:session-changed')();
  assert.equal(render().currentUser.id, '', 'an explicit sign-out/change clears the old profile immediately');
  await settle();
  status = 401;
  await render().refreshFromDatabase();
  assert.equal(render().verifiedOwnerId, null); assert.equal(render().currentUser.id, '');
  assert.equal(cache.getItem('marginflow_session'), null);
});

const authUser = { id: 'auth-google', email: 'google@example.test', email_confirmed_at: '2026-10-20T00:00:00Z', user_metadata: {} };
function mappingHarness(results) {
  const calls = [];
  const { ensureMarginFlowAccount } = load('src/lib/auth/supabase-account.ts', { '@/lib/db': { query: async (sql, params) => {
    calls.push({ sql, params });
    assert.ok(results.length, 'Unexpected mapping query');
    return { rows: results.shift() };
  } } });
  return { ensureMarginFlowAccount, calls };
}
test('Google and password identities already linked by Supabase keep the same custom profile', async () => {
  const account = { id: googleUser.id, auth_user_id: authUser.id, email: authUser.email, name: 'Custom Saved Name' };
  const app = mappingHarness([[account]]);
  const result = await app.ensureMarginFlowAccount({ ...authUser, user_metadata: { full_name: 'Provider Name' } });
  assert.equal(result.account.name, 'Custom Saved Name'); assert.equal(result.isNewUser, false);
  assert.equal(app.calls.length, 1);
});
test('verified email alone cannot reassign an account bound to a different Auth user', async () => {
  const app = mappingHarness([[], [{ id: 'other', auth_user_id: 'auth-password' }]]);
  await assert.rejects(app.ensureMarginFlowAccount(authUser), /different verified identity/);
  assert.equal(app.calls.length, 2); assert.ok(app.calls.every(call => !/UPDATE|INSERT/.test(call.sql)));
});
test('unbound legacy account linking is conditional and refuses a concurrent identity claim', async () => {
  const account = { id: googleUser.id, auth_user_id: authUser.id };
  const app = mappingHarness([[], [{ id: account.id, auth_user_id: null }], [account]]);
  assert.equal((await app.ensureMarginFlowAccount(authUser)).account.id, account.id);
  assert.match(app.calls[2].sql, /auth_user_id IS NULL OR auth_user_id = \$1/);
  assert.match(app.calls[2].sql, /LOWER\(email\) = LOWER\(\$3\)/);
  const raced = mappingHarness([[], [{ id: account.id, auth_user_id: null }], []]);
  await assert.rejects(raced.ensureMarginFlowAccount(authUser), /identity changed/);
  assert.equal(raced.calls.length, 3, 'failed link must not fall through to create another account');
});
test('ambiguous legacy emails and unverified or missing identities fail closed', async () => {
  const ambiguous = mappingHarness([[], [{ id: 'one' }, { id: 'two' }]]);
  await assert.rejects(ambiguous.ensureMarginFlowAccount(authUser), /different verified identity/);
  const app = mappingHarness([]);
  await assert.rejects(app.ensureMarginFlowAccount({ ...authUser, id: '' }), /confirmed Supabase email/);
  await assert.rejects(app.ensureMarginFlowAccount({ ...authUser, email_confirmed_at: null }), /confirmed Supabase email/);
  assert.equal(app.calls.length, 0);
});

function profileRoute({ session = { sub: googleUser.id, sid: authUser.id }, liveUser = authUser } = {}) {
  const queries = [], updates = [];
  const route = load('src/app/api/auth/profile/route.ts', {
    '@/lib/security/session': { getSessionUser: async () => session },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: {
      getUser: async () => ({ data: { user: liveUser }, error: null }),
      updateUser: async data => { updates.push(data); return { error: null }; },
    } }) },
    '@/lib/db': { query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [{ id: session.sub, name: params[0], company_name: params[1], phone: params[2], email: liveUser.email }] };
    } },
  });
  const post = (extra = {}) => route.POST(new Request('https://app.example/api/auth/profile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedAccountId: googleUser.id, name: 'Edited Name', companyName: 'Edited Brand', phone: '', businessRole: 'FOUNDER', ...extra }),
  }));
  return { queries, updates, post };
}
test('profile API refuses stale forms and a session switch during request processing', async () => {
  const app = profileRoute();
  assert.equal((await app.post({ expectedAccountId: passwordUser.id })).status, 409);
  assert.equal((await app.post({ expectedAccountId: undefined })).status, 409);
  assert.equal(app.queries.length, 0); assert.equal(app.updates.length, 0);
  const switched = profileRoute({ liveUser: { ...authUser, id: 'auth-password' } });
  assert.equal((await switched.post()).status, 401);
  assert.equal(switched.queries.length, 0); assert.equal(switched.updates.length, 0);
});
test('profile database update binds both the merchant and Supabase identity', async () => {
  const app = profileRoute();
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, googleUser.id);
  assert.match(app.queries[0].sql, /WHERE id = \$4 AND auth_user_id = \$5/);
  assert.deepEqual(Array.from(app.queries[0].params.slice(3)), [googleUser.id, authUser.id]);
});
test('verified session and /me expose only the current user display preferences', async () => {
  const user = { ...authUser, last_sign_in_at: '2026-10-20T01:00:00Z', user_metadata: {
    onboardingPreferences: { role: 'STUDENT', roleLabel: 'Student', channels: ['AMAZON', 123], volume: 'small', secret: 'do-not-project' },
  } };
  const session = load('src/lib/security/session.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    '@/lib/db': { query: async (sql, params) => {
      assert.equal(params[0], authUser.id);
      return { rows: [{ id: googleUser.id, name: googleUser.name, email: googleUser.email, account_type: 'BRAND_OWNER' }] };
    } },
  });
  const verified = await session.getSessionUser(new Request('https://app.example'));
  const route = load('src/app/api/auth/me/route.ts', {
    '@/lib/security/session': { getSessionUser: async () => verified },
    '@/lib/db': { query: () => assert.fail('Normal /me must use the verified session') },
  });
  const response = await route.GET(new Request('https://app.example/api/auth/me'));
  const profile = (await response.json()).user;
  assert.equal(profile.id, googleUser.id); assert.equal(profile.email, googleUser.email);
  assert.equal(profile.onboardingPreferences.role, 'STUDENT');
  assert.deepEqual(profile.onboardingPreferences.channels, ['AMAZON']);
  assert.equal(profile.onboardingPreferences.secret, undefined);
  assert.equal(profile.authenticatedAt, user.last_sign_in_at);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
