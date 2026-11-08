const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const ts = require('typescript')
const Module = require('node:module')
const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

const sessionSource = read('src/lib/sessionSummary.ts')
const js = ts.transpileModule(sessionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const compiled = new Module(path.join(root, 'src/lib/sessionSummary.js'))
compiled.filename = path.join(root, 'src/lib/sessionSummary.js')
compiled.paths = Module._nodeModulePaths(root)
compiled._compile(js, compiled.filename)
const { getSessionSummary } = compiled.exports

const cards = [{ id: 'a', correct: 60, incorrect: 50, lastAnswerCorrect: true }, { id: 'b', correct: 12, incorrect: 5, lastAnswerCorrect: false }, { id: 'c', correct: 4, incorrect: 1, lastAnswerCorrect: true }]
const current = { deckId: 'd', queue: ['a','b','c','b'], index: 4, correctCount: 3, wrongCount: 1,
  history: [
    { cardId: 'a', correct: false },
    { cardId: 'b', correct: true },
    { cardId: 'c', correct: true },
    { cardId: 'a', correct: true },
    { cardId: 'b', correct: false }
  ] }

test('set summary follows only the active study session', () => {
  assert.deepEqual(getSessionSummary(cards, null), { correct: 0, toRepeat: 0, unreviewed: 3 })
  assert.deepEqual(getSessionSummary(cards, current), { correct: 2, toRepeat: 1, unreviewed: 0 })
})
test('last grade per card wins and counts cannot exceed number of cards', () => {
  const repeated = { ...current, history: [...current.history, ...Array.from({length: 100}, (_, i) => ({cardId: i % 2 ? 'a' : 'b', correct: i % 2 === 0}))] }
  const result = getSessionSummary(cards, repeated)
  assert.ok(result.correct + result.toRepeat <= cards.length)
  assert.deepEqual(getSessionSummary(cards.slice(0,1), current), { correct: 1, toRepeat: 0, unreviewed: 0 })
})
test('shared menu and navigation use reusable variant-driven interactive row', () => {
  assert.match(read('src/components/Dropdown.tsx'), /<Button[^>]*layout="row"[^>]*color=\{action\.destructive/)
  assert.match(read('src/features/library/Sidebar.tsx'), /<Button layout="row"/)
  assert.match(read('src/features/library/SettingsDialog.tsx'), /<Button layout="row"/)
  const css = read('src/styles/index.css')
  assert.equal((css.match(/--interactive-hover-bg: #[0-9a-f]{6}/g) || []).length, 2)
  assert.match(read('src/components/atoms/Button.tsx'), /border font-semibold/)
  assert.equal(fs.existsSync(path.join(root, 'src/components/atoms/InteractiveRow.tsx')), false)
  assert.match(css, /--danger-active-bg/)
})
test('dialogs have a fixed header/footer and independently scrolling body', () => {
  const modal = read('src/components/Modal.tsx')
  const host = read('src/providers/ModalProvider.tsx')
  assert.match(modal, /footer\?: ReactNode/)
  assert.match(host, /\{entry.content\}/)
  assert.match(host, /\{entry.options.footer\}/)
  for (const f of ['src/features/library/ManageDialog.tsx','src/features/library/CardComposer.tsx','src/features/library/SettingsDialog.tsx','src/features/editor/RichTextEditor.tsx']) {
    assert.match(read(f), /footer=\{</, f)
  }
  const css = read('src/styles/index.css')
  assert.match(host, /overflow-y-auto/)
  assert.match(host, /<footer className=.*border-t/)
})
test('app header and sidebar do not duplicate its brand or slogan', () => {
  assert.doesNotMatch(read('src/features/library/Sidebar.tsx'), /sidebar-brand|brand-subtitle|brand-title/)
  assert.doesNotMatch(read('src/components/Titlebar.tsx'), /window-subtitle|Twoja przestrzeń do nauki/)
  assert.doesNotMatch(read('src/features/library/Sidebar.tsx'), /className="nav-count"/)
})
test('folder view has both compact counters and FOLDER category above title', () => {
  const folder = read('src/features/library/LibraryOverview.tsx')
  assert.match(folder, /aria-label=\{`\$\{folders.length\} folderów`\}/)
  assert.match(folder, />FOLDER/)
  assert.match(folder, /<LibraryTile key=\{item\.id\} kind="folder"/)
  assert.match(folder, /<LibraryTile key=\{item\.id\} kind="deck"/)
  assert.doesNotMatch(folder, /TWOJA PRZESTRZEŃ/)
})
test('unnecessary appearance instructions and global search subtitle were removed', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.doesNotMatch(settings, /Motyw systemowy będzie automatycznie reagował/)
  assert.doesNotMatch(settings, /Wybierz motyw\. Zmiany widzisz od razu/)
  assert.match(settings, /Dostosuj wygląd aplikacji do własnych potrzeb/)
  const search = read('src/features/library/SearchDialog.tsx')
  assert.doesNotMatch(search, /Przeszukaj fiszki, foldery i zestawy bez opuszczania/)
  assert.match(search, /placeholder="Szukaj folderów, zestawów i fiszek…"/)
})
