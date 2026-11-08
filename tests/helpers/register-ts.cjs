// Tests run source-level TypeScript helpers without a production build.
// Node's test runner does not provide a .ts CommonJS loader by default.
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  })
  module._compile(compiled.outputText, filename)
}
