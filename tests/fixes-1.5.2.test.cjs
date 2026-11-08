const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

const compiled = ts.transpileModule(read('src/lib/aiErrors.ts'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText
const sandbox = { exports: {} }
vm.runInNewContext(compiled, sandbox)
const { describeAiError, publicAiError } = sandbox.exports

test('limit errors are categorized and provider internals are hidden from the UI', () => {
  const details = 'The ChatGPT user has reached their Subscription Sharing usage limit. request_id=private123'
  const error = describeAiError(new Error(details))
  assert.equal(error.code, 'LIMIT')
  assert.equal(error.usageLimited, true)
  assert.match(error.message, /limit/i)
  assert.doesNotMatch(error.message, /Subscription Sharing|private123|request_id/)
  const transport = publicAiError(new Error(details))
  assert.equal(transport.message, 'FS_AI_ERROR:LIMIT')
  assert.equal(describeAiError(new Error(`Error invoking remote method 'ai:send': Error: ${transport.message}`)).usageLimited, true)
})

test('network, authentication, rate and unknown errors expose only user-friendly messages', () => {
  for (const [raw, expected] of [
    ['fetch failed ENOTFOUND api.openai.com', 'NETWORK'],
    ['OpenAI HTTP 401: invalid_token', 'AUTH'],
    ['OpenAI HTTP 429: rate_limit_exceeded', 'RATE_LIMIT'],
    ['OpenAI HTTP 503: internal failure', 'UNAVAILABLE'],
    ['Connection aborted due to timeout', 'TIMEOUT'],
    ['db_password=extremely_sensitive_information', 'UNKNOWN']
  ]) {
    const result = describeAiError(new Error(raw))
    assert.equal(result.code, expected)
    assert.ok(result.message.length > 15)
    assert.doesNotMatch(result.message, /db_password|api.openai.com|invalid_token|internal failure/)
  }
})

test('OAuth callback cleanup cannot wait indefinitely for a persistent browser connection', () => {
  const source = read('electron/ai/siwc.ts')
  assert.match(source, /Connection: 'close'/)
  assert.match(source, /server\.closeIdleConnections\(\)/)
  assert.match(source, /server\.closeAllConnections\(\)/)
  assert.match(source, /setTimeout\(\(\) => \{\s*server\.closeAllConnections\(\)/)
})

test('study view defaults to left aligned rich content without overriding explicit TipTap styles', () => {
  const styles = read('src/styles/index.css')
  const study = styles.match(/\.study-card-content\s*\{([^}]+)\}/)
  assert.ok(study)
  assert.match(study[1], /text-align:\s*left/)
  assert.doesNotMatch(study[1], /text-align:\s*center/)
  assert.match(styles, /\.study-card-content \.rich-content\s*\{[^}]*text-align:\s*left/)
  assert.doesNotMatch(study[1], /!important/)
})

test('original reported TypeScript mistakes do not recur', () => {
  const select = read('src/components/atoms/Select.tsx')
  assert.match(select, /triggerRef\.current\?\.focus\(\)/)
  assert.doesNotMatch(select, /domReference\.current\?\.focus\(\)/)
  const cards = read('src/lib/aiCards.ts')
  assert.match(cards, /const countMatch = input\.match/)
  assert.doesNotMatch(cards, /!slash && input\.match/)
  const workspace = read('src/lib/workspace.ts')
  assert.match(workspace, /const folderId = selected\.id/)
  assert.match(workspace, /const deckId = selected\.id/)
})

test('TypeScript strict-checks standalone data logic without relying on UI dependency stubs', () => {
  const files = [
    'src/lib/aiCards.ts', 'src/lib/workspace.ts', 'src/lib/aiErrors.ts',
    'src/lib/tree.ts', 'src/types/model.ts'
  ].map(filename => path.join(root, filename))
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    skipLibCheck: true,
    strict: true,
    noEmit: true
  })
  const errors = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')), [])
})

test('local storage failures no longer show private paths or raw filesystem errors', () => {
  const source = ts.transpileModule(read('src/lib/uiErrors.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const sandbox = { exports: {} }
  vm.runInNewContext(source, sandbox)
  const error = sandbox.exports.describeLocalError(new Error('EACCES: access denied C:\\Users\\Private\\tokens.txt'))
  assert.match(error, /uprawnieni/i)
  assert.doesNotMatch(error, /C:\\Users|Private|tokens.txt/)
  assert.match(read('src/hooks/useLibrary.ts'), /describeLocalError/)
  assert.match(read('src/App.tsx'), /describeLocalError/)
})
