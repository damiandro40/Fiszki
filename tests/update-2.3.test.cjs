const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

test('flashcard ratings and drag gesture work on either side', () => {
  const study = read('src/features/study/StudyView.tsx')
  assert.match(study, /answer\(distance > 0\)/)
  assert.match(study, /<Button disabled=\{!!departure\} className="rating-wrong"/)
  assert.match(study, /<Button disabled=\{!!departure\} className="rating-correct"/)
  assert.doesNotMatch(study, /if \(!card \|\| !flipped/)
  assert.doesNotMatch(study, /Pokaż odpowiedź <kbd>/)
  assert.doesNotMatch(study, /study-card-flip/)
})

test('flight effect is viewport fixed and can exit beyond the actual window edge', () => {
  const study = read('src/features/study/StudyView.tsx')
  const css = read('src/styles/index.css')
  assert.match(study, /createPortal\(/)
  assert.match(study, /document\.body/)
  assert.match(study, /window\.innerWidth - rect\.left \+ 40/)
  assert.match(study, /-\(rect\.left \+ rect\.width \+ 40\)/)
  assert.match(study, /flight\.to === undefined \? 'none'/)
  assert.match(css, /\.study-card\.study-flight-ghost \{/)
  assert.match(css, /position: fixed !important/)
  assert.match(css, /\.study-card\.is-flight-source \{ opacity: 0/)
})

test('study guide displays explicit keyboard glyphs instead of ambiguous dash strings', () => {
  const study = read('src/features/study/StudyView.tsx')
  assert.match(study, /className="study-keyboard-hint"/)
  assert.match(study, /<kbd>\{displayStudyKey\(keymap\.flip\)\}<\/kbd>/)
  assert.match(study, /<kbd>\{displayStudyKey\(keymap\.undo\)\}<\/kbd>/)
  assert.match(study, /flipped: false,\s+correctCount: previous\.previousCorrectCount/)
})

test('set description is removed from editor, view and AI instructions while legacy schema survives', () => {
  assert.doesNotMatch(read('src/features/library/ManageDialog.tsx'), /Opis zestawu/)
  assert.doesNotMatch(read('src/features/library/DeckView.tsx'), /deck\.description/)
  assert.doesNotMatch(read('src/lib/aiCards.ts'), /context\.description/)
  assert.match(read('src/types/model.ts'), /description: string/)
})

test('editor has compact height, centered toolbar, and keyboard-only undo and redo', () => {
  const editor = read('src/features/editor/RichTextEditor.tsx')
  const css = read('src/styles/index.css')
  assert.doesNotMatch(editor, /Cofnij \(Ctrl\+Z\)/)
  assert.doesNotMatch(editor, /Ponów \(Ctrl\+Y\)/)
  assert.match(editor, /editor\.commands\.focus\(\)/)
  assert.match(editor, /editor-toolbar flex flex-wrap items-center justify-center/)
  assert.match(editor, /\[&_.tiptap-prose\]:max-h-\[350px\]/)
})

test('tables split regular cells and toggle selected cell headers', () => {
  const menu = read('src/features/editor/tableActions.ts')
  const command = read('src/features/editor/splitTableCell.ts')
  assert.match(menu, /Podziel komórkę/)
  assert.match(menu, /splitTableCell\(editor\)/)
  assert.match(menu, /toggleHeaderCell\(\)/)
  assert.doesNotMatch(menu, /toggleHeaderRow\(\)|toggleHeaderColumn\(\)/)
  assert.match(command, /TableMap\.get\(table\)/)
  assert.match(command, /tr\.replaceWith/)
  assert.match(command, /colspan: width \+ 1/)
})

test('library statistics and folder empty area have matching layout', () => {
  const css = read('src/styles/index.css')
  const overview = read('src/features/library/LibraryOverview.tsx')
  assert.doesNotMatch(read('src/components/LibraryMetric.tsx'), /border-right/)
  assert.match(overview, /min-h-full/)
  assert.match(overview, /className="library-overview-page/)
})

test('AI success status is green but email is plain text; obsolete alert removed', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  const css = read('src/styles/index.css')
  assert.match(settings, /Połączono z kontem/)
  assert.doesNotMatch(settings, /Kopia JSON zawiera zapisane fiszki/)
  assert.match(settings, /text-\[var\(--muted\)\]/)
  assert.match(settings, /text-\[var\(--green\)\]/)
})

test('danger styles retain danger intent for hover and active states', () => {
  const css = read('src/styles/index.css')
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--danger-active-bg\)\]/)
  assert.match(css, /\.study-rating \.rating-wrong:hover:not\(:disabled\)/)
  assert.match(css, /\.study-rating \.rating-correct:active:not\(:disabled\)/)
})

test('obsolete set descriptions do not appear in global search', () => {
  const search = read('src/lib/search.ts')
  assert.doesNotMatch(search, /deck\.description/)
  assert.match(search, /detail: 'Zestaw'/)
})
