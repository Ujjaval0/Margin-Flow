const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

// Executes actual application functions with explicit dependency boundaries; never opens a DB.
module.exports = function loadApp(entry, mocks = {}, globals = {}) {
  const cache = new Map();
  const isolatedGlobal = {};
  function load(file) {
    if (file === path.join(root, 'src/lib/db.ts') && mocks['@/lib/db']) return mocks['@/lib/db'];
    if (cache.has(file)) return cache.get(file).exports;
    if (file === path.join(root, 'src/lib/db.ts')) throw new Error('Tests must mock database access.');
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: file,
    }).outputText;
    function localRequire(name) {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) :
        name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
      if (!base) return require(name);
      const target = [base, base + '.ts', base + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target) throw new Error('Unresolved application module: ' + name);
      return load(target);
    }
    const context = { module, exports: module.exports, require: localRequire, console, global: isolatedGlobal,
      Buffer, URL, URLSearchParams, Request, Response, Headers, FormData, ReadableStream, TextDecoder, TextEncoder, structuredClone, crypto: require('node:crypto').webcrypto,
      AbortSignal, AbortController, performance, setTimeout, clearTimeout, setInterval, clearInterval,
      process: { env: { NODE_ENV: 'test' } }, ...globals };
    vm.runInNewContext(source, context, { filename: file });
    return module.exports;
  }
  return load(path.resolve(root, entry));
};

// Models acknowledged HTTP storage while executing the real financial command rules.
// SQL persistence is covered separately by the disposable PostgreSQL integration suite.
module.exports.makeLedgerBackend = function makeLedgerBackend(initial = {}, options = {}) {
  const load = module.exports;
  const { emptyLedger, archiveRecords, applyArchivePatch } = load('src/domain/recycle-bin.ts', {}, { structuredClone });
  const { applyLedgerCommand, canonicalJson } = load('src/domain/ledger-command.ts', {}, { structuredClone });
  const { parseLedgerSnapshot } = load('src/domain/snapshot-validation.ts');
  let data = { ...emptyLedger(), ...structuredClone(initial), financialRevision: 1 };
  let reject = false;
  const commands = new Map(), requests = [];
  const owner = () => typeof options.owner === 'function' ? options.owner() : options.owner || 'tenant-A';
  const fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === '/api/auth/me') return Response.json({ user: { id: owner() } });
    if (init.method === 'POST' && reject) return Response.json({ success: false, error: 'Financial record could not be saved. Product could not be saved.' }, { status: 503 });
    if (url === '/api/ledger-records') {
      if (init.method === 'POST') {
        const { requestId, command } = JSON.parse(init.body);
        const fingerprint = canonicalJson(command);
        if (commands.has(requestId) && commands.get(requestId) !== fingerprint) return Response.json({ success: false, error: 'Request identity reused' }, { status: 409 });
        if (!commands.has(requestId)) {
          try {
            if (command.action === 'importSnapshot') {
              const parsed = parseLedgerSnapshot(command.snapshot, owner());
              if (!parsed) throw Error('Invalid snapshot');
              data = { ...parsed, financialRevision: data.financialRevision };
            } else data = applyLedgerCommand(data, command);
            data.suppliers = data.suppliers.map(supplier => ({ ...supplier, totalPaid: (data.supplierPayments || []).filter(payment => payment.supplierId === supplier.id).reduce((total, payment) => total + payment.amount, 0) }));
            data.financialRevision = (data.financialRevision || 0) + 1;
            commands.set(requestId, fingerprint);
          } catch (error) { return Response.json({ success: false, error: error.message }, { status: 409 }); }
        }
      }
      return Response.json({ success: true, data });
    }
    if (url === '/api/recycle-bin' && init.method === 'POST') {
      try {
        const body = JSON.parse(init.body);
        data = applyArchivePatch(data, archiveRecords(data, body.type, body.ids));
        data.financialRevision++;
        return Response.json({ success: true });
      } catch (error) { return Response.json({ success: false, error: error.message }, { status: 409 }); }
    }
    for (const collection of ['products', 'orders', 'settlements']) if (url.startsWith('/api/' + collection)) {
      if (init.method === 'POST') {
        const body = JSON.parse(init.body);
        const incoming = collection === 'products' && body.product ? [body.product] : body[collection];
        const ids = [];
        for (const row of incoming) {
          const previous = data[collection].find(existing => collection === 'products' ? existing.sku === row.sku : collection === 'orders' ? existing.marketplace === row.marketplace && existing.channelOrderId === row.channelOrderId : existing.id === row.id);
          const id = previous?.id || (collection === 'products' ? row.id : data[collection].some(existing => existing.id === 'canonical') ? 'canonical-' + row.id : 'canonical');
          const saved = { ...row, id };
          data[collection] = [saved, ...data[collection].filter(existing => existing.id !== id)];
          ids.push(id);
        }
        data.financialRevision++;
        return Response.json({ success: true, inserted: ids.length, updated: 0, [collection === 'orders' ? 'orderIds' : collection === 'products' ? 'productIds' : 'settlementIds']: ids });
      }
      return Response.json({ [collection]: data[collection] });
    }
    return Response.json({ success: true, recovered: { returns: [], claims: [], expenses: [] } });
  };
  return { fetch, requests, reject(value) { reject = value; }, get data() { return structuredClone(data); } };
};
