const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')
const compiled = file => {
  const sandbox = { exports: {}, module: { exports: {} } }
  const output = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  vm.runInNewContext(output, sandbox)
  return sandbox.exports
}
const undo = compiled('src/lib/undoLibrary.ts')
const folder = (id, parentId = null) => ({ id, parentId, name: id, createdAt: '0', updatedAt: '0' })
const deck = (id, folderId = null) => ({ id, folderId, name: id, description: '', createdAt: '0', updatedAt: '0' })
const card = (id, deckId) => ({ id, deckId, front: { type: 'doc' }, back: { type: 'doc' }, correct: 0, incorrect: 0, lastReviewedAt: null, createdAt: '0', updatedAt: '0' })
const library = () => ({
  version: 1,
  folders: [folder('a'), folder('b', 'a')],
  decks: [deck('d1', 'b'), deck('d2')],
  cards: [card('c1', 'd1'), card('c2', 'd2')],
  preferences: { theme: 'system', shuffle: true }
})

test('undo restores deleted nested folders, sets and cards with original order', () => {
  const before = library()
  const after = { ...before, folders: [], decks: [before.decks[1]], cards: [before.cards[1]] }
  const patch = undo.createLibraryUndo(before, after)
  assert.ok(undo.hasLibraryUndo(patch))
  const result = undo.applyLibraryUndo(after, patch)
  assert.equal(result.reverted, 4)
  assert.deepEqual(Array.from(result.data.folders, item => item.id), ['a', 'b'])
  assert.deepEqual(Array.from(result.data.decks, item => item.id), ['d1', 'd2'])
  assert.deepEqual(Array.from(result.data.cards, item => item.id), ['c1', 'c2'])
})

test('undo a rename preserves unrelated later edits and original metadata', () => {
  const before = library()
  const after = { ...before, folders: [{ ...before.folders[0], name: 'Renamed', updatedAt: '1' }, before.folders[1]] }
  const patch = undo.createLibraryUndo(before, after)
  const subsequent = { ...after, decks: [...after.decks, deck('d3')] }
  const reverted = undo.applyLibraryUndo(subsequent, patch)
  assert.equal(reverted.reverted, 1)
  assert.equal(reverted.data.folders[0].name, 'a')
  assert.equal(reverted.data.folders[0].updatedAt, '0')
  assert.equal(reverted.data.decks.length, 3)
})

test('undo does not overwrite later edits to the same entity', () => {
  const before = library()
  const after = { ...before, decks: [before.decks[0], { ...before.decks[1], name: 'changed' }] }
  const patch = undo.createLibraryUndo(before, after)
  const latest = { ...after, decks: [before.decks[0], { ...after.decks[1], name: 'more recent' }] }
  const reverted = undo.applyLibraryUndo(latest, patch)
  assert.equal(reverted.reverted, 0)
  assert.equal(reverted.data, latest)
})

test('undo deleted hierarchy is atomic if any target has since changed', () => {
  const before = library()
  const after = { ...before, folders: [], decks: [before.decks[1]], cards: [before.cards[1]] }
  const patch = undo.createLibraryUndo(before, after)
  const latest = { ...after, decks: [...after.decks, deck('d1')] }
  const reverted = undo.applyLibraryUndo(latest, patch)
  assert.equal(reverted.reverted, 0)
  assert.equal(reverted.data, latest)
})

test('no-op changes have no undo action', () => {
  const data = library()
  assert.equal(undo.hasLibraryUndo(undo.createLibraryUndo(data, data)), false)
})

test('toast exposes Undo for mutations and keeps pauseable countdown', () => {
  const controller = source('src/app/useAppController.ts')
  const toast = source('src/components/Toast.tsx')
  assert.match(controller, /commitUndoable/)
  for (const action of ['delete-folder', 'delete-deck', 'delete-card', 'edit-folder', 'edit-deck', 'move-card']) {
    assert.ok(controller.includes(`case '${action}'`))
  }
  assert.match(controller, /duration: 9000/)
  assert.match(toast, /onUndo && <Button/)
  assert.match(toast, />Cofnij<\/Button>/)
  assert.match(toast, /remaining\.current/)
})

test('both search surfaces debounce expensive filtering without delaying input', () => {
  const hook = source('src/hooks/useDebouncedValue.ts')
  assert.match(hook, /setTimeout\(\(\) => setSettled\(value\), delay\)/)
  assert.match(hook, /clearTimeout\(timeout\)/)
  const global = source('src/features/library/SearchDialog.tsx')
  const field = source('src/components/atoms/DebouncedSearchInput.tsx')
  assert.match(global, /useDebouncedValue\(query, 180\)/)
  assert.match(field, /useDebouncedValue\(value, delay\)/)
  assert.match(source('src/views/decks/DeckView.tsx'), /<DebouncedSearchInput/)
  assert.match(source('src/features/library/SearchDialog.tsx'), /searchLibrary\(data, query\)/)
})

test('settings nav and account email have stable neutral visual states', () => {
  const css = source('src/styles/widgets.css')
  assert.doesNotMatch(css, /border-left-color: var\(--accent-ink\)/)
  assert.match(source('src/styles/theme.css'), /box-sizing: border-box/)
  assert.match(source('src/components/atoms/Button.tsx'), /transition-\[background-color,border-color,color,box-shadow\] duration-150/)
  assert.match(source('src/features/library/SettingsDialog.tsx'), /font-bold text-\[var\(--muted\)\]/)
  assert.doesNotThrow(() => postcss.parse(css))
})

test('center-aligned card and editor lists keep their markers with the text', () => {
  const css = source('src/styles/widgets.css')
  assert.match(css, /width: max-content/)
  assert.match(css, /margin: \.65em auto/)
  assert.match(css, /list-style-position: outside/)
  assert.match(css, /text-align: left/)
  assert.match(css, /study-card-face \.study-card-content \.rich-content/)
  const editor = source('src/features/editor/RichTextEditor.tsx')
  assert.match(editor, /editor\.isActive\(\{ textAlign: 'center' \}\)/)
})
