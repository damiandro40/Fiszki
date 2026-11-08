const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

test('ellipsis menu has no tooltip and uses click-time fixed anchor', () => {
  const dropdown = read('src/components/Dropdown.tsx')
  assert.match(dropdown, /strategy: 'fixed'/)
  assert.match(dropdown, /setPositionReference\(\{ getBoundingClientRect: \(\) => rect \}\)/)
  assert.match(dropdown, /\{button\}/)
  assert.doesNotMatch(dropdown, /<Tooltip/)
  assert.match(dropdown, /role="menuitem"/)
})

test('modal close control has accessible name without tooltip', () => {
  assert.match(read('src/providers/ModalProvider.tsx'), /<Button.Icon label="Zamknij" tooltip=\{false\}/)
  assert.match(read('src/components/atoms/Button.tsx'), /tooltip === false/)
})

test('search modal strips redundant hints and focuses search field', () => {
  const dialog = read('src/features/library/SearchDialog.tsx')
  assert.match(dialog, /inputRef\.current\?\.focus\(\)/)
  assert.match(dialog, /autoFocus data-initial-focus/)
  assert.match(dialog, /Tutaj pojawią się wyniki wyszukiwania/)
  for (const unwanted of ['Rozpocznij wpisywanie', 'Wyszukiwanie nie przerywa', 'search-dialog-footer', 'search-dialog-shortcut']) {
    assert.ok(!dialog.includes(unwanted), `Unexpected text: ${unwanted}`)
  }
})

test('create dialogs focus the name input on mount', () => {
  const manage = read('src/features/library/ManageDialog.tsx')
  const modal = read('src/components/Modal.tsx')
  assert.match(manage, /requestAnimationFrame\(\(\) => nameRef\.current\?\.focus\(\)\)/)
  assert.match(manage, /ref=\{nameRef\} data-initial-focus autoFocus/)
  assert.match(read('src/providers/ModalProvider.tsx'), /\[data-initial-focus\]/)
})

test('cards editor is vertical and allows images on both faces', () => {
  const editor = read('src/features/editor/RichTextEditor.tsx')
  const composer = read('src/features/library/CardComposer.tsx')
  const css = read('src/styles/index.css')
  assert.ok(composer.indexOf('Przód fiszki') < composer.indexOf('Tył fiszki'))
  assert.match(read('src/features/library/CardComposer.tsx'), /grid-cols-1/)
  assert.match(editor, /act\('Wstaw zdjęcie'/)
  assert.ok(!editor.includes("if (variant === 'back') void addImage(file)"))
  assert.match(editor, /variant === 'back' && <TableInsertPicker/)
})

test('folder contents have blank-area context menu and no decoration chevrons', () => {
  const overview = read('src/features/library/LibraryOverview.tsx')
  assert.match(overview, /onContextMenu=\{event => \{/)
  assert.match(overview, /openContextMenu\(event, emptyAreaActions\)/)
  assert.match(overview, /onAddFolder\(folderId\)/)
  assert.match(overview, /onAddDeck\(folderId\)/)
  assert.ok(!overview.includes('className="tile-chevron"'))
})

test('standalone AI window provides uniform titlebar and maximize control', () => {
  const win = read('src/features/ai/AIWindow.tsx')
  const main = read('electron/main.ts')
  assert.match(win, /onMaximizeChange\(setMaximized\)/)
  assert.match(win, /aria-label="Zamknij asystenta"/)
  assert.match(win, /toggleMaximize\(\)/)
  assert.match(win, /onDeckChange=\{setDeckId\}/)
  assert.match(main, /sendAssistantMaximized/)
})

test('AI chat selects active deck without account and disconnect controls in compact view', () => {
  const studio = read('src/features/ai/AIStudio.tsx')
  assert.match(studio, /compact &&/)
  assert.match(studio, /onChange=\{id => onDeckChange\?\.\(id \|\| null\)\}/)
  assert.match(studio, /!compact &&/)
  assert.match(studio, /const destination = compact \? deckId \|\| ''/)
})

test('dragging flashcards preserves exit origin and removes central feedback labels', () => {
  const study = read('src/features/study/StudyView.tsx')
  const css = read('src/styles/index.css')
  assert.match(study, /createPortal\(/)
  assert.match(study, /study-flight-ghost/)
  assert.match(css, /study-flight-ghost/)
  assert.match(study, /translateX\(\$\{flight\.to \?\? flight\.x\}px\)/)
  assert.match(read('src/views/study/StudyView.tsx'), /study-page/)
  assert.match(css, /--drag-color/)
  assert.ok(!study.includes('study-drag-feedback'))
})

test('existing local data schema and build IDs remain compatible', () => {
  const pkg = JSON.parse(read('package.json'))
  const main = read('electron/main.ts')
  assert.match(pkg.version, /^1\.0\.\d+$/)
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
  assert.match(main, /const getStoragePath = \(\) => join\(app\.getPath\('userData'\), 'fiszki\.json'\)/)
})
