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
      Buffer, URL, URLSearchParams, Request, Response, Headers, FormData, ReadableStream, TextDecoder, TextEncoder,
      AbortSignal, AbortController, performance, setTimeout, clearTimeout, setInterval, clearInterval,
      process: { env: { NODE_ENV: 'test' } }, ...globals };
    vm.runInNewContext(source, context, { filename: file });
    return module.exports;
  }
  return load(path.resolve(root, entry));
};
