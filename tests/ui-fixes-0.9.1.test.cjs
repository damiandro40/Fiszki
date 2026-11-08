const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const source = filename => fs.readFileSync(path.join(root, filename), 'utf8')
const loadHelper = filename => {
  const compiled = ts.transpileModule(source(filename), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const mod = new Module(path.join(root, filename))
  mod.filename = path.join(root, filename)
  mod.paths = Module._nodeModulePaths(root)
  mod._compile(compiled, mod.filename)
  return mod.exports
}

const card = (id, deckId = 'deck') => ({
  id, deckId,
  front: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }] },
  back: { type: 'doc', content: [] },
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
  correct: 8, incorrect: 4, lastReviewedAt: '2026-02-01'
})

test('duplicating a card inserts it immediately after its source, not at deck end', () => {
  const { duplicateCardAfter } = loadHelper('src/lib/cardOrdering.ts')
  const before = [card('a'), card('b'), card('c', 'other'), card('d')]
  const result = duplicateCardAfter(before, 'b', 'copy', '2026-03-01')
  assert.deepEqual(result.map(item => item.id), ['a', 'b', 'copy', 'c', 'd'])
  assert.equal(result[2].deckId, 'deck')
  assert.equal(result[2].correct, 0)
  assert.equal(result[2].incorrect, 0)
  assert.equal(result[2].lastReviewedAt, null)
  assert.equal(result[2].createdAt, '2026-03-01')
  assert.notStrictEqual(result[2].front, before[1].front, 'a copy must not share mutable editor content')
  assert.deepEqual(before.map(item => item.id), ['a', 'b', 'c', 'd'], 'the source remains untouched')
  assert.strictEqual(duplicateCardAfter(before, 'not-found', 'copy', '2026-03-01'), before)
  assert.match(source('src/app/useAppController.ts'), /duplicateCardAfter\(old\.cards, card\.id/)
})

test('all study grading controls have the same button size and animation frames are cleared', () => {
  const view = source('src/views/study/StudyView.tsx')
  assert.match(view, /const undoControl = <Button size="md"/)
  assert.match(view, /<Button disabled=\{!!departure\} className="rating-wrong"/)
  assert.match(view, /<Button disabled=\{!!departure\} className="rating-correct"/)
  assert.match(view, /animationFrames\.current = \[\]/)
  assert.match(view, /animationFrames\.current\.forEach\(cancelAnimationFrame\)/)
})

test('card editor headings align baseline and put bold descriptors at opposite edge', () => {
  const editor = source('src/features/library/CardComposer.tsx')
  assert.equal((editor.match(/mb-3 flex items-center justify-between gap-3/g) || []).length, 2)
  assert.equal((editor.match(/font-extrabold tracking-wider/g) || []).length, 2)
})

test('search highlighting is independent of hover and has distinct high-contrast tokens', () => {
  const highlight = source('src/components/atoms/HighlightedText.tsx')
  const search = source('src/features/library/SearchDialog.tsx')
  const theme = source('src/styles/theme.css')
  assert.match(highlight, /bg-\[var\(--search-match-bg\)\]/)
  assert.match(highlight, /text-\[var\(--search-match-ink\)\]/)
  assert.match(search, /layout="row" intent="ghost" selected=\{activeIndex === index\}/)
  assert.equal((theme.match(/--search-match-bg:/g) || []).length, 2)
  assert.equal((theme.match(/--search-match-ink:/g) || []).length, 2)
  assert.notEqual(theme.match(/--search-match-bg: (#[0-9a-f]{6});/)[1], theme.match(/--accent-soft: (#[0-9a-f]{6});/)[1])
})

test('one atomic Button drives menus, settings and sidebar without InteractiveRow', () => {
  const button = source('src/components/atoms/Button.tsx')
  assert.match(button, /row:\s*\{/)
  assert.match(button, /selected:\s*\{/)
  assert.match(button, /color:\s*\{/); assert.match(button, /compoundSlots:/)
  assert.match(button, /fullWidth:/)
  assert.match(button, /iconPosition\?: 'start' \| 'end'/)
  assert.match(source('src/components/Dropdown.tsx'), /<Button[^>]*layout="row"/)
  assert.match(source('src/features/library/SettingsDialog.tsx'), /<Button layout="row"/)
  assert.match(source('src/features/library/Sidebar.tsx'), /<Button layout="row"/)
  assert.equal(fs.existsSync(path.join(root, 'src/components/atoms/InteractiveRow.tsx')), false)
  assert.doesNotMatch(button, /danger: \{ _button: '[^']*border-\[var\(--danger-border\)/)
  assert.match(source('src/features/library/SettingsDialog.tsx'), /<Button intent="ghost" color="neutral" icon=\{<LogOut/)
})

test('each list item shrinks to its own text; native bullets and numbering are retained', () => {
  const css = source('src/styles/widgets.css')
  assert.match(css, /:is\(ol, ul\) > li \{[\s\S]*?width: fit-content;/)
  assert.match(css, /list-style-position: outside;/)
  assert.doesNotMatch(css, /list-style:\s*none/)
  assert.doesNotThrow(() => postcss.parse(css))
})

test('AI async callbacks ignore unmounted UI and delta updates stay within a deck', () => {
  const assistant = source('src/features/ai/AIStudio.tsx')
  assert.match(assistant, /mountedRef\.current = false/)
  assert.match(assistant, /if \(!mountedRef\.current \|\| currentRequest\.current !== requestId\) return/)
  assert.match(assistant, /const deck = currentRequestDeck\.current/)
  assert.match(assistant, /\[deck\]: messages\.map/)
  assert.match(assistant, /if \(currentRequest\.current\) void window\.flashcards\.aiCancel\(\)/)
})
