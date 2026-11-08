const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiszki-workspace-tests-'))
for (const filename of ['tree', 'seed', 'cardDrafts', 'workspace']) {
  const source = fs.readFileSync(path.join(root, 'src/lib', `${filename}.ts`), 'utf8')
  fs.writeFileSync(path.join(temp, `${filename}.js`), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText)
}
const { createSeed } = require(path.join(temp, 'seed.js'))
const { defaultWorkspace, startStudySession, reconcileWorkspace } = require(path.join(temp, 'workspace.js'))
const { removeDeck } = require(path.join(temp, 'tree.js'))
const data = createSeed()

test('new workspace starts at the library', () => {
  assert.deepEqual(defaultWorkspace(), { version: 1, selected: { type: 'home' }, study: null, lastEditedCardId: null })
})

test('study resume preserves order, index and counters while returning to question side', () => {
  const started = startStudySession({ ...data, preferences: { ...data.preferences, shuffle: false } }, 'demo-szkielet')
  assert.deepEqual(started.queue, ['demo-1', 'demo-2'])
  const paused = { ...started, flipped: true, index: 1, correctCount: 4, wrongCount: 2, queue: ['demo-1', 'demo-2', 'demo-2'] }
  const restored = reconcileWorkspace({ version: 1, selected: { type: 'home' }, study: paused }, data)
  assert.deepEqual(restored.study, { ...paused, flipped: false })
  assert.deepEqual(restored.selected, { type: 'deck', id: 'demo-szkielet' })
})

test('restoration ignores cards deleted while app was closed', () => {
  const changed = { ...data, cards: data.cards.filter(card => card.id !== 'demo-1') }
  const saved = { version: 1, selected: { type: 'home' }, study: {
    deckId: 'demo-szkielet', queue: ['demo-1', 'demo-2'], index: 1, flipped: false, correctCount: 0, wrongCount: 0
  } }
  const restored = reconcileWorkspace(saved, changed)
  assert.deepEqual(restored.study.queue, ['demo-2'])
  assert.equal(restored.study.index, 0)
})

test('deleted deck does not leave a broken study view', () => {
  const saved = { version: 1, selected: { type: 'deck', id: 'demo-szkielet' }, study: {
    deckId: 'demo-szkielet', queue: ['demo-1'], index: 0, flipped: false, correctCount: 0, wrongCount: 0
  } }
  const restored = reconcileWorkspace(saved, removeDeck(data, 'demo-szkielet'))
  assert.equal(restored.study, null)
  assert.deepEqual(restored.selected, { type: 'home' })
})

test('Windows icon exists and is referenced by electron-builder', () => {
  const pkg = require(path.join(root, 'package.json'))
  assert.equal(pkg.build.win.icon, 'resources/icon.ico')
  const icon = fs.readFileSync(path.join(root, 'resources/icon.ico'))
  assert.equal(icon.readUInt16LE(0), 0)
  assert.equal(icon.readUInt16LE(2), 1)
  assert.ok(icon.readUInt16LE(4) > 1)
})


test('last edited flashcard survives restart even during an active study session', () => {
  const study = startStudySession(data, 'demo-szkielet')
  const restored = reconcileWorkspace({ version: 1, selected: { type: 'home' }, study, lastEditedCardId: 'demo-1' }, data)
  assert.equal(restored.lastEditedCardId, 'demo-1')
  assert.equal(restored.study?.deckId, 'demo-szkielet')
})

test('stale last edited flashcard is cleared safely without erasing the study session', () => {
  const saved = { version: 1, selected: { type: 'home' }, study: null, lastEditedCardId: 'missing-card' }
  const restored = reconcileWorkspace(saved, data)
  assert.equal(restored.lastEditedCardId, null)
  assert.equal(restored.study, null)
})

test('older workspace JSON without lastEditedCardId stays compatible', () => {
  const restored = reconcileWorkspace({ version: 1, selected: { type: 'home' }, study: null }, data)
  assert.equal(restored.lastEditedCardId, null)
})
