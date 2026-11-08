const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const moduleFrom = file => {
  const sandbox = { exports: {}, module: { exports: {} } }
  const transpiled = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(transpiled, sandbox)
  return sandbox.exports
}

test('the root only composes an app controller and shell; views have feature boundaries', () => {
  const app = read('src/App.tsx')
  assert.match(app, /useAppController\(\)/)
  assert.match(app, /<AppShell controller=\{controller\}/)
  assert.doesNotMatch(app, /commit\(|ipcRenderer|window\.flashcards/)
  for (const name of ['library/LibraryOverview', 'decks/DeckView', 'study/StudyView', 'ai/AIWindow']) {
    assert.ok(fs.existsSync(path.join(root, `src/views/${name}.tsx`)))
  }
  assert.match(read('src/app/useAppController.ts'), /const saveCard =/)
  assert.match(read('src/app/AppDialogs.tsx'), /<CardComposer/)
})

test('Electron keeps storage contracts, validation and disk writes separate from IPC', () => {
  const main = read('electron/main.ts')
  assert.match(main, /from '.\/storage\/repository'/)
  assert.doesNotMatch(main, /const validateRichDoc =|const writeDatabase =/)
  assert.match(read('electron/storage/validation.ts'), /export const validateRichDoc/)
  assert.match(read('electron/storage/repository.ts'), /export const enqueue =/)
  assert.match(read('electron/ai/contracts.ts'), /export const aiHistorySchema =/)
  assert.match(read('electron/ai/oauth.ts'), /export const verifyIdToken =/)
  assert.match(read('electron/ai/siwc.ts'), /safeStorage.encryptString/)
})

test('assistant displays safe rich messages and resource cleanup is registered', () => {
  const assistant = read('src/features/ai/AIStudio.tsx')
  const messages = read('src/features/ai/AIMessageList.tsx')
  assert.match(assistant, /<AIMessageList/)
  assert.match(messages, /<MessageContent/)
  assert.match(messages, /!messages\.length/)
  assert.match(assistant, /if \(currentRequest\.current\) void window\.flashcards\.aiCancel\(\)/)
  assert.match(read('src/views/ai/AIWindow.tsx'), /\.catch\(\(\) => \{ if \(mounted\) setError/)
})

test('raw provider errors are mapped to opaque, user-friendly categories', () => {
  const ai = moduleFrom('src/lib/aiErrors.ts')
  const local = moduleFrom('src/lib/uiErrors.ts')
  const secret = 'https://private.example/api?token=secret-xyz user@email.test'
  const classified = ai.describeAiError(new Error(`HTTP 429: ${secret}`))
  assert.equal(classified.code, 'RATE_LIMIT')
  assert.ok(!classified.message.includes(secret))
  assert.equal(ai.publicAiError(new Error(`HTTP 401: ${secret}`)).message, 'FS_AI_ERROR:AUTH')
  assert.ok(!local.describeLocalError(new Error(`EACCES /Users/alice/data/${secret}`)).includes(secret))
})

test('editor has no meaningless panel numbering and settings use a full-width selected pill', () => {
  const composer = read('src/features/library/CardComposer.tsx')
  assert.doesNotMatch(composer, /side-number|>01<|>02</)
  assert.match(composer, /Przód fiszki/)
  assert.match(composer, /Tył fiszki/)
  const css = ['theme.css', 'widgets.css'].map(name => read(`src/styles/${name}`)).join('\n')
  assert.doesNotThrow(() => postcss.parse(css))
  assert.match(read('src/components/atoms/Button.tsx'), /row: \{/)
  assert.match(read('src/components/atoms/Button.tsx'), /selected:/)
  assert.equal(fs.existsSync(path.join(root, 'src/components/atoms/InteractiveRow.tsx')), false)
})

test('project has no missing relative imports and CSS layers resolve', () => {
  const result = execFileSync(process.execPath, ['scripts/check-structure.cjs'], { cwd: root, encoding: 'utf8' })
  assert.match(result, /wszystkie importy względne poprawne/)
})
