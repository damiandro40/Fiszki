const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

test('dashboard summary is grouped into one understated panel', () => {
  const css = read('src/styles/index.css')
  assert.doesNotMatch(css, /\.stat-box \{ background: var\(--surface-2\); border-color: transparent \}/)
  assert.match(read('src/views/library/LibraryOverview.tsx'), /stats-grid mb-8 grid.*divide-x.*border-\[var\(--border-subtle\)\]/)
  assert.match(read('src/components/LibraryMetric.tsx'), /tabular-nums/)
  assert.doesNotMatch(read('src/components/LibraryMetric.tsx'), /border-r/)
})

test('filled primary buttons keep readable label and companion icon contrast', () => {
  const css = read('src/styles/index.css')
  assert.match(css, /--accent: #[0-9a-f]{6};/g)
  assert.match(css, /--accent-text: #ffffff;/)
  assert.match(read('src/components/atoms/Button.tsx'), /bg-\[var\(--accent\)\] text-\[var\(--accent-text\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /icon:/)
})

test('search has actual space above input, separate headings and preserves keyboard navigation', () => {
  const css = read('src/styles/index.css')
  assert.match(read('src/features/library/SearchDialog.tsx'), /px-5 pb-4 pt-4/)
  assert.match(read('src/features/library/SearchDialog.tsx'), /uppercase tracking-wider/)
  const source = read('src/features/library/SearchDialog.tsx')
  for (const label of ['Foldery', 'Zestawy', 'Fiszki']) assert.match(source, new RegExp(`title: '${label}'`))
  assert.match(source, /<section key=\{group\.kind\}/)
  assert.match(source, /activeIndex === index/)
  assert.match(source, /event\.key === 'ArrowDown'/)
  assert.match(source, /event\.key === 'Enter'/)
})

test('draft stack labels each pending card with name and set, without italics', () => {
  const stack = read('src/features/library/DraftStack.tsx')
  assert.match(stack, /Wersje robocze/)
  assert.match(stack, /textFromDoc\(draft.front\)/)
  assert.match(stack, /deckNames.get\(draft.deckId\)/)
  assert.match(stack, /onResume\(draft.draftId\)/)
  assert.doesNotMatch(stack, /<em>/)
})

test('independent AI window offers native-like minimize and close without overlay', () => {
  const source = read('src/features/ai/AIWindow.tsx')
  assert.match(source, /aria-label="Minimalizuj asystenta"/)
  assert.match(source, /aria-label="Zamknij asystenta"/)
  assert.match(source, /<AIStudio compact/)
  assert.doesNotMatch(read('src/App.tsx'), /className=\{`ai-dock/)
})

test('packaged icon and renderer use one matching graphic asset', () => {
  const a = fs.readFileSync(path.join(root, 'resources/icon.png'))
  const b = fs.readFileSync(path.join(root, 'src/public/icon.png'))
  assert.deepEqual(a, b)
  assert.equal(a.toString('hex', 0, 8), '89504e470d0a1a0a')
  assert.ok(fs.statSync(path.join(root, 'resources/icon.ico')).size > 10000)
  assert.match(read('package.json'), /"version": "1\.0\.\d+"/)
})
