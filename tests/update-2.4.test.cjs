const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiszki-24-'))
for (const file of ['tree', 'cardDrafts', 'workspace', 'studySessions', 'seed', 'search']) {
  const source = read(`src/lib/${file}.ts`)
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  fs.writeFileSync(path.join(temp, `${file}.js`), compiled)
}
const { createSeed } = require(path.join(temp, 'seed.js'))
const { getLibraryCounts, removeDeck } = require(path.join(temp, 'tree.js'))
const { defaultWorkspace, reconcileWorkspace } = require(path.join(temp, 'workspace.js'))
const { openStudySession, storeStudySession, exitStudySession, resumableStudySession } = require(path.join(temp, 'studySessions.js'))
const { searchLibrary } = require(path.join(temp, 'search.js'))
const data = createSeed()

test('paused study persists per set, resumes progress and only restarts on explicit request', () => {
  const original = openStudySession(defaultWorkspace(), data, 'demo-szkielet')
  assert.equal(original.study.index, 0)
  const rated = { ...original.study, index: 1, flipped: true, correctCount: 1, history: [] }
  const saved = exitStudySession(storeStudySession(original, rated))
  assert.equal(saved.study, null)
  assert.equal(saved.studySessions['demo-szkielet'].index, 1)
  assert.equal(resumableStudySession(saved, 'demo-szkielet').correctCount, 1)

  const restored = reconcileWorkspace(JSON.parse(JSON.stringify(saved)), data)
  const resumed = openStudySession(restored, data, 'demo-szkielet')
  assert.deepEqual(resumed.study, { ...rated, flipped: false })
  const restarted = openStudySession(restored, data, 'demo-szkielet', true)
  assert.equal(restarted.study.index, 0)
  assert.equal(restarted.study.correctCount, 0)
  assert.equal(restarted.study.flipped, false)
})

test('pausing and changing sets does not discard sessions elsewhere', () => {
  const secondData = { ...data, decks: [...data.decks, { id: 'second', name: 'Drugi zestaw', folderId: null }], cards: [
    ...data.cards,
    { ...data.cards[0], id: 'second-card', deckId: 'second' }
  ] }
  const first = openStudySession(defaultWorkspace(), secondData, 'demo-szkielet')
  const paused = exitStudySession(storeStudySession(first, { ...first.study, index: 1, correctCount: 1 }))
  const other = openStudySession(paused, secondData, 'second')
  const back = openStudySession(exitStudySession(other), secondData, 'demo-szkielet')
  assert.equal(back.study.index, 1)
  assert.ok(back.studySessions.second)
  const afterDelete = reconcileWorkspace(exitStudySession(back), removeDeck(secondData, 'demo-szkielet'))
  assert.equal(afterDelete.studySessions['demo-szkielet'], undefined)
  assert.ok(afterDelete.studySessions.second)
})

test('folder count means sets (including empty ones), sets count cards', () => {
  const collection = {
    folders: [{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }],
    decks: [{ id: 'd1', folderId: 'a' }, { id: 'd2', folderId: 'b' }, { id: 'empty', folderId: 'b' }],
    cards: [{ deckId: 'd1' }, { deckId: 'd1' }, { deckId: 'd2' }]
  }
  const counts = getLibraryCounts(collection)
  assert.equal(counts.folders.get('a'), 3)
  assert.equal(counts.folders.get('b'), 2)
  assert.equal(counts.decks.get('d1'), 2)
  assert.equal(counts.decks.get('d2'), 1)
  assert.equal(counts.decks.get('empty') || 0, 0)
})

test('global search includes matching context in snippets of long cards', () => {
  const long = { ...data.cards[0], id: 'long', front: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${'Wstęp '.repeat(50)} OGONIASTE — powiązanie` }] }] } }
  const results = searchLibrary({ ...data, cards: [long] }, 'ogonia')
  const match = results.find(result => result.id === 'long')
  assert.ok(match)
  assert.match(match.title, /OGONIASTE/i)
})

test('highlighting is limited to text, with safe DOM nodes and no unsafe HTML insertion', () => {
  assert.match(read('src/features/library/SearchDialog.tsx'), /HighlightedText text=\{result.title\} query=\{settledQuery\}/)
  assert.match(read('src/features/library/DeckView.tsx'), /highlightQuery=\{filter\}/)
  const rich = read('src/features/editor/RichContent.tsx')
  assert.match(rich, /DOMPurify\.sanitize/)
  assert.match(rich, /document\.createTextNode/)
  assert.match(rich, /match\.textContent/)
})

test('click-only plus menus have no tooltip and blank sidebar context is scoped to tree', () => {
  assert.doesNotMatch(read('src/components/Dropdown.tsx'), /<Tooltip/)
  const sidebar = read('src/features/library/Sidebar.tsx')
  assert.match(sidebar, /target\.closest\('\.tree-scroll'\)/)
  assert.match(sidebar, /target\.closest\('\.tree-item, button/)
})

test('danger menu items keep red styling on hover, focus and active', () => {
  const css = read('src/styles/index.css')
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:hover:bg-\[var\(--danger-hover-bg\)\]/)
  assert.match(css, /background: var\(--red-soft\)/)
})

test('studySessions validation is included in Electron persistence schema without version migration', () => {
  const main = read('electron/main.ts')
  assert.match(main, /studySessions: z\.record/)
  assert.match(main, /study: studySessionSchema\.nullable\(\)/)
  assert.match(main, /version: z\.literal\(1\)/)
  assert.match(require(path.join(root, 'package.json')).version, /^1\.0\.\d+$/)
})

test('Polish tile counters have proper grammatical forms', () => {
  const source = read('src/lib/plural.ts')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  fs.writeFileSync(path.join(temp, 'plural.js'), output)
  const { polishCount } = require(path.join(temp, 'plural.js'))
  for (const [n, expected] of [[0, '0 zestawów'], [1, '1 zestaw'], [2, '2 zestawy'], [5, '5 zestawów'], [12, '12 zestawów'], [23, '23 zestawy']]) {
    assert.equal(polishCount(n, 'zestaw', 'zestawy', 'zestawów'), expected)
  }
})
