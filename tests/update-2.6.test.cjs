const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const app = read('src/App.tsx')
const overview = read('src/features/library/LibraryOverview.tsx')
const sidebar = read('src/features/library/Sidebar.tsx')
const css = read('src/styles/index.css')

const parseVars = (text, selector) => {
  const start = text.indexOf(selector)
  assert.notEqual(start, -1)
  const block = text.slice(start).match(/\{([^}]+)\}/)[1]
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}
const rgb = value => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16))
const maxDiff = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])))

 test('both themes keep feedback subtle and preserve primary, danger and neutral roles', () => {
  for (const selector of [":root, [data-theme='dark']", "[data-theme='light']"]) {
    const vars = parseVars(css, selector)
    assert.ok(maxDiff(vars['surface'], vars['interactive-hover-bg']) <= 30)
    assert.ok(maxDiff(vars['interactive-hover-bg'], vars['interactive-active-bg']) <= 18)
    assert.ok(maxDiff(vars['red-soft'], vars['danger-hover-bg']) <= 12)
    assert.ok(maxDiff(vars['accent'], vars['accent-hover']) <= 20)
  }
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:hover:bg-\[var\(--interactive-hover-bg\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:hover:bg-\[var\(--danger-hover-bg\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--accent-active\)\]/)
})

test('home stats include every card and every set, with no folder metric', () => {
  assert.match(overview, /value=\{data\.cards\.length\}/)
  assert.match(overview, /value=\{data\.decks\.length\}/)
  assert.doesNotMatch(overview, /label="Folderów"/)
  assert.equal((overview.match(/<LibraryMetric /g) || []).length, 2)
})

test('folder and set tiles occupy one sorted section without category headings', () => {
  assert.match(overview, /\{folders\.map\(folderTile\)\}\{decks\.map\(deckTile\)\}/)
  assert.doesNotMatch(overview, /<h2>Foldery<\/h2>/)
  assert.doesNotMatch(overview, /<h2>Zestawy fiszek<\/h2>/)
  assert.doesNotMatch(overview, /title="Foldery bezpośrednio/)
})

test('sidebar has no library count and no duplicate add menu', () => {
  assert.doesNotMatch(sidebar, /className="nav-count"/)
  assert.doesNotMatch(sidebar, /trigger="add"/)
  assert.match(overview, /trigger="add"/)
})

test('only a resumable study session enables continue and restart', () => {
  assert.match(app, /const resumableSession = resumableStudySession\(workspace, selectedDeck\.id\)/)
  assert.match(app, /session=\{session\}/)
  const deck = read('src/features/library/DeckView.tsx')
  assert.match(deck, /savedSessionProgress \? 'Kontynuuj naukę' : 'Rozpocznij naukę'/)
  assert.match(deck, /\{savedSessionProgress && <Button icon=\{<RotateCcw/)
  assert.doesNotMatch(deck, /onOpenAI/)
})

test('settings nav uses compact icon and title with neutral ChatGPT icon', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.doesNotMatch(settings, /<small>\{item\.detail\}<\/small>/)
  assert.match(settings, /<Icon size=\{18\} \/>/)
  assert.match(settings, /text-\[var\(--muted\)\]/)
})

test('toast pauses its countdown on hover and keyboard focus', () => {
  const toast = read('src/components/Toast.tsx')
  assert.match(read('src/providers/ToastProvider.tsx'), /<Toast message=\{item\.message\}/)
  assert.doesNotMatch(app, /if \(!notification\) return\s+const timer/)
  assert.match(toast, /remaining\.current = Math\.max\(0/)
  assert.match(toast, /onPointerEnter=\{\(\) => setHovered\(true\)\}/)
  assert.match(toast, /onPointerLeave=\{\(\) => setHovered\(false\)\}/)
  assert.match(toast, /onFocusCapture=\{\(\) => setFocused\(true\)\}/)
  assert.match(toast, /if \(paused\) return/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:hover:bg-\[var\(--interactive-hover-bg\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--interactive-active-bg\)\]/)
})

test('scroll thumbs are draggable with muted hover and pressed colors', () => {
  assert.match(css, /::-webkit-scrollbar-thumb \{ cursor: pointer;/)
  assert.match(css, /::-webkit-scrollbar-thumb:hover/)
  assert.match(css, /::-webkit-scrollbar-thumb:active/)
})

test('theme CSS parses and all authored TypeScript files have valid syntax', () => {
  assert.doesNotThrow(() => postcss.parse(css))
  for (const directory of ['src','electron']) {
    const walk = folder => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const target = path.join(folder, entry.name)
        if (entry.isDirectory()) walk(target)
        else if (/\.tsx?$/.test(entry.name)) {
          const source = ts.createSourceFile(target, fs.readFileSync(target, 'utf8'), ts.ScriptTarget.ES2022, true,
            entry.name.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
          assert.equal(source.parseDiagnostics.length, 0, `${target}: ${source.parseDiagnostics.map(d => d.messageText).join('; ')}`)
        }
      }
    }
    walk(path.join(root, directory))
  }
})
