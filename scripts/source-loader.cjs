/* eslint-disable @typescript-eslint/no-require-imports -- Standalone source verification harness. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ts=require(path.join(root,'node_modules/typescript'));
const jsx=require(path.join(root,'node_modules/react/jsx-runtime'));
function load(file, mocks = {}, runtime = {}) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const exports = {};
  const context = {
    exports,
    Date,
    Intl,
    FormData,
    Buffer,
    URL,
    URLSearchParams,
    File,
    Blob,
    Request,
    Response,
    Headers,
    AbortSignal,
    crypto: globalThis.crypto,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name === 'react/jsx-runtime') return jsx;
      if (name.startsWith('node:')) return require(name);
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks, runtime);
      return require(path.join(root, 'node_modules', name));
    },
    ...runtime,
  };
  vm.runInNewContext(code, context, { filename });
  return exports;
}


module.exports={load};
