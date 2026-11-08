const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('global search fills parent width; library statistics have no artificial maximum', () => {
  const shell = read('src/app/AppShell.tsx')
  const overview = read('src/views/library/LibraryOverview.tsx')
  assert.match(shell, /className="flex h-10 w-full items-center/)
  assert.doesNotMatch(shell, /max-w-\[710px\]/)
  assert.match(overview, /stats-grid mb-8 grid w-full grid-cols-2/)
  assert.doesNotMatch(overview, /max-w-\[650px\]/)
})

test('review filter is adjacent to deck search and hidden when count is zero', () => {
  const deck = read('src/views/decks/DeckView.tsx')
  assert.match(deck, /justify-end gap-2\.5">\s*\{pendingReview > 0 && <button/)
  assert.match(deck, /onClick=\{\(\) => setOnlyToReview\(previous => !previous\)\}/)
  assert.match(deck, /if \(!pendingReview\) setOnlyToReview\(false\)/)
  assert.match(deck, /w-\[234px\].*<DebouncedSearchInput/)
})

test('flashcard number and front label share a grid row with equal line heights', () => {
  const deck = read('src/views/decks/DeckView.tsx')
  assert.match(deck, /grid-cols-\[2rem_minmax\(0,1fr\)\]/)
  assert.match(deck, /text-\[11px\] font-extrabold leading-4 tabular-nums/)
  assert.match(deck, /text-\[10px\] font-extrabold leading-4 tracking-wider[^\n]+>PRZÓD/)
  assert.match(deck, /col-start-2 row-start-2 min-w-0/)
})

test('breadcrumb links have hover and active states and current entry is emphasized', () => {
  for (const file of ['src/views/decks/DeckView.tsx', 'src/views/library/LibraryOverview.tsx']) {
    const src = read(file)
    assert.match(src, /hover:bg-\[var\(--interactive-hover-bg\)\]/)
    assert.match(src, /active:bg-\[var\(--interactive-active-bg\)\]/)
    assert.match(src, /aria-current="page" className="rounded-md px-2 py-1\.5 font-bold/)
  }
})

test('danger buttons use subdued semantic tokens rather than a bright red resting border', () => {
  const button = read('src/components/atoms/Button.tsx')
  const theme = read('src/styles/theme.css')
  assert.match(button, /intent: 'soft', color: 'danger', class: 'border-transparent bg-\[var\(--danger-rest-bg\)\]/)
  assert.match(button, /intent: 'outline', color: 'danger'/)
  assert.equal((theme.match(/--danger-ink:/g) || []).length, 2)
  assert.equal((theme.match(/--danger-border:/g) || []).length, 2)
})

test('AI composer omits redundant usage hints but retains attachment picker and keyboard handling', () => {
  const composer = read('src/features/ai/AIComposer.tsx')
  const studio = read('src/features/ai/AIStudio.tsx')
  for (const text of ['Enter · wyślij', 'Shift+Enter · nowa linia', 'Obrazy i dokumenty']) assert.doesNotMatch(composer, new RegExp(text))
  assert.doesNotMatch(studio, /Domyślnie: tworzenie fiszek/)
  assert.match(composer, /label="Dodaj załącznik"/); assert.match(composer, /label="Wyślij wiadomość"/)
  assert.match(composer, /event\.key === 'Enter'/)
})

test('AI messages use surface-only differentiation without a bright outline', () => {
  const messages = read('src/features/ai/AIMessageList.tsx')
  assert.match(messages, /rounded-2xl rounded-tr-md bg-/)
  assert.doesNotMatch(messages, /border-\[var\(--accent\)\]\/25 bg-\[var\(--accent-soft\)\]/)
})

test('AI is inaccessible without a deck across sidebar, controller, assistant and main process', () => {
  const sidebar = read('src/features/library/Sidebar.tsx')
  const controller = read('src/app/useAppController.ts')
  const studio = read('src/features/ai/AIStudio.tsx')
  const electron = read('electron/main.ts')
  assert.match(sidebar, /disabled=\{!data\.decks\.length\}/)
  assert.match(controller, /if \(!data\?\.decks\.length\) return/)
  assert.match(studio, /!data\.decks\.length \? <div/)
  assert.match(studio, /\|\| !activeDeck \|\| busy/)
  assert.match(electron, /if \(!library\.decks\.length\) throw new Error/)
})

test('assistant selection contains real decks only, and follows library deletions', () => {
  const studio = read('src/features/ai/AIStudio.tsx')
  const window = read('src/views/ai/AIWindow.tsx')
  assert.match(studio, /options=\{deckOptions\} searchable placeholder="Zestaw fiszek"/)
  assert.doesNotMatch(studio, /label: 'Wybierz zestaw'/)
  assert.match(window, /setDeckId\(data\.decks\[0\]\?\.id \|\| null\)/)
})

test('settings footer remains neutral and light theme remains semantically distinct', () => {
  const sidebar = read('src/features/library/Sidebar.tsx')
  const theme = read('src/styles/theme.css')
  assert.match(sidebar, /<Button layout="row" intent="ghost" icon=\{<Settings size=\{18\} \/>\} color="neutral"/)
  assert.match(theme, /\[data-theme='light'\] \{/)
  assert.match(theme, /--bg: #f2f4f7;/)
  assert.match(theme, /--surface: #fbfcfe;/)
})
