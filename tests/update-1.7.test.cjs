const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const compile = filename => {
  const js = ts.transpileModule(read(filename), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const sandbox = { exports: {} }
  vm.runInNewContext(js, sandbox)
  return sandbox.exports
}

const keys = compile('src/lib/studyKeys.ts')

test('study keymap has safe defaults for existing libraries', () => {
  assert.equal(keys.normalizeStudyKeys().flip, 'Space')
  assert.equal(keys.normalizeStudyKeys(null).again, 'Digit1')
  assert.equal(keys.normalizeStudyKeys({ known: 'KeyK' }).known, 'KeyK')
  assert.equal(keys.displayStudyKey('Space'), 'Spacja')
  assert.equal(keys.displayStudyKey('Digit5'), '5')
  assert.equal(keys.displayStudyKey('ArrowLeft'), '←')
})

test('unsafe keyboard shortcuts and collisions fall back to valid defaults', () => {
  assert.equal(keys.isAssignableStudyKey('Escape'), false)
  assert.equal(keys.isAssignableStudyKey('Tab'), false)
  assert.equal(keys.isAssignableStudyKey('ControlLeft'), false)
  assert.equal(keys.isAssignableStudyKey('KeyQ'), true)
  assert.equal(keys.isAssignableStudyKey('ArrowRight'), true)
  assert.deepEqual(Object.values(keys.normalizeStudyKeys({ flip: 'KeyQ', again: 'KeyQ', known: 'Digit2' })).join(','), 'KeyQ,Digit1,Digit2,Backspace')
})

test('settings have independent sections, reversible theme preview and keyboard recording', () => {
  const source = read('src/features/library/SettingsDialog.tsx')
  for (const section of ['appearance','study','ai','data']) assert.match(source, new RegExp(`id: '${section}'`))
  assert.match(source, /onPreviewTheme\(item\.value\)/)
  assert.match(source, /onChange\(\{ \.\.\.preferences, theme, shuffle, studyInSeparateWindow, studyKeys: keys \}\)/)
  assert.match(source, /onKeyDown=\{event => captureKey\(event, item\.action\)\}/)
  assert.match(source, /Ten klawisz jest już przypisany/)
  assert.match(source, /intent="ghost" color="neutral" icon=\{<LogOut/)
  assert.match(source, /Połącz z ChatGPT/)
})

test('study interface uses the configured keys in listeners and hint labels', () => {
  const source = read('src/features/study/StudyView.tsx')
  assert.match(source, /event\.code === keymap\.flip/)
  assert.match(source, /event\.code === keymap\.again/)
  assert.match(source, /event\.code === keymap\.known/)
  assert.match(source, /displayStudyKey\(keymap\.flip\)/)
  assert.match(source, /displayStudyKey\(keymap\.again\)/)
  assert.match(source, /displayStudyKey\(keymap\.known\)/)
  assert.match(source, /event\.code === keymap\.undo/)
  assert.match(read('src/App.tsx'), /normalizeStudyKeys\(data\.preferences\.studyKeys\)/)
})

test('optional study key preferences are persisted without breaking old JSON', () => {
  assert.match(read('src/types/model.ts'), /studyKeys\?:/)
  assert.match(read('electron/main.ts'), /studyKeys: z\.object\(/)
  assert.match(read('electron/main.ts'), /undo: z\.string\(\)\.max\(32\)\.optional\(\)/)
})

test('desktop has a single AI opening entry and no redundant export button', () => {
  const source = read('src/App.tsx')
  assert.doesNotMatch(source, /ai-dock-launcher"/)
  assert.doesNotMatch(source, /label="Eksportuj kopię JSON"/)
  assert.match(read('src/app/AppShell.tsx'), /onAI=\{\(\) => void toggleAssistant/)
  assert.match(read('src/features/library/DraftStack.tsx'), /id="draft-popover"/)
})

test('generation is natural-language only and no prefabricated prompt is rendered', () => {
  const source = read('src/features/ai/AIStudio.tsx')
  assert.doesNotMatch(source, /Generuj 20 fiszek z materiału/)
  assert.doesNotMatch(source, /setDraft\(previous => `\/fiszki/)
  const logic = read('src/lib/aiCards.ts')
  assert.doesNotMatch(logic, /GENERATION_COMMAND|\/fiszki 20/)
  const { parseGenerationCommand } = compile('src/lib/aiCards.ts')
  assert.equal(parseGenerationCommand('/fiszki 20'), null)
  assert.equal(parseGenerationCommand('Proszę przygotuj 16 fiszek z anatomii').count, 16)
  assert.equal(parseGenerationCommand('Jak działa móżdżek?'), null)
})

test('buttons do not rise on hover and the shared workspace styling remains', () => {
  const css = read('src/styles/index.css')
  assert.match(css, /Workspace layout, neutral motion and settings navigation/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:hover:/); assert.match(css, /study-card:hover/)
  assert.match(read('src/app/AppDialogs.tsx'), /<DraftStack/)
})

test('updated pure modules pass strict typecheck', () => {
  const program = ts.createProgram([
    path.join(root, 'src/lib/studyKeys.ts'),
    path.join(root, 'src/lib/aiCards.ts'),
    path.join(root, 'src/lib/seed.ts'),
    path.join(root, 'src/types/model.ts')
  ], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], strict: true, noEmit: true, skipLibCheck: true
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
})
