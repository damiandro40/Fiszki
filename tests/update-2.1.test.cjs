const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const compile = (file, imports = {}) => {
  const source = ts.transpileModule(read(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const exports = {}
  const context = { exports, module: { exports }, require: name => imports[name] || {} }
  vm.runInNewContext(source, context, { filename: file })
  return exports
}

test('keyboard navigation supports Backspace undo without breaking previous shortcuts', () => {
  const { normalizeStudyKeys, displayStudyKey, isAssignableStudyKey } = compile('src/lib/studyKeys.ts')
  const standard = normalizeStudyKeys(null)
  assert.equal(standard.flip, 'Space')
  assert.equal(standard.again, 'Digit1')
  assert.equal(standard.known, 'Digit2')
  assert.equal(standard.undo, 'Backspace')
  assert.equal(displayStudyKey(standard.undo), 'Backspace')
  assert.equal(isAssignableStudyKey('Backspace'), true)
  const custom = normalizeStudyKeys({ flip: 'KeyF', again: 'KeyA', known: 'KeyD', undo: 'KeyZ' })
  assert.equal(custom.undo, 'KeyZ')
  assert.equal(normalizeStudyKeys({ undo: 'Space' }).undo, 'Backspace')
})

test('study sessions persist a bounded history record without copying whole queues', () => {
  const model = read('src/types/model.ts')
  const main = read('electron/main.ts')
  const view = read('src/features/study/StudyView.tsx')
  assert.match(model, /history\?: StudyHistoryEntry\[\]/)
  assert.match(main, /history: z\.array/)
  assert.match(view, /history: \[\.\.\.\(previousSession\.history \|\| \[\]\)/)
  assert.doesNotMatch(view, /previousQueue: \[\.\.\.previousSession\.queue\]/)
  assert.match(view, /queue: previous\.correct \? session\.queue : session\.queue\.slice\(0, -1\)/)
  assert.match(view, /onUndo\(previous\.cardId, previous\.correct/)
  assert.match(read('src/App.tsx'), /Math\.max\(0, card\.incorrect - Number\(!correct\)\)/)
})

test('drag right marks known; drag left marks unknown; flip remains separate', () => {
  const view = read('src/features/study/StudyView.tsx')
  assert.match(view, /onPointerDown=\{handlePointerDown\}/)
  assert.match(view, /onPointerMove=\{handlePointerMove\}/)
  assert.match(view, /onPointerUp=\{handlePointerUp\}/)
  assert.match(view, /Math\.abs\(distance\) >= acceptanceThreshold/)
  assert.match(view, /answer\(distance > 0\)/)
  assert.match(view, /lastDrag\.current/)
  assert.match(view, /Nie umiem/)
  assert.doesNotMatch(view, /Jeszcze raz/)
})

test('front editor is restricted and defaults to centered; back retains advanced controls', () => {
  const composer = read('src/features/library/CardComposer.tsx')
  const editor = read('src/features/editor/RichTextEditor.tsx')
  const css = read('src/styles/index.css')
  assert.match(composer, /variant="front"/)
  assert.match(editor, /variant === 'back' && <TableInsertPicker editor=\{editor\}/)
  assert.match(editor, /act\('Nagłówek H1'/)
  assert.match(editor, /<ColorPalette editor=\{editor\} kind="text"/)
  assert.doesNotMatch(editor, /Usuń formatowanie/)
  assert.match(css, /\.rich-editor-front \.tiptap-prose \{ text-align: center/)
  assert.match(css, /\.study-card-front \.study-card-content, \.study-card-front \.rich-content \{ text-align: center/)
  assert.doesNotMatch(composer, /Obrazy są zmniejszane do WebP/)
})

test('palette editing stays below swatches and identifies target color', () => {
  const palette = read('src/features/editor/ColorPalette.tsx')
  assert.match(palette, /editing !== undefined/)
  assert.match(palette, /editing === index/)
  assert.match(palette, /setEditing\(undefined\)/)
  assert.doesNotMatch(palette, /Kliknij, aby zastosować/)
})

test('assistant runs in a separate secure Electron window and saves cards centrally', () => {
  const main = read('electron/main.ts')
  const companion = read('src/features/ai/AIWindow.tsx')
  const preload = read('electron/preload.ts')
  assert.match(main, /const createAssistantWindow = async/)
  assert.match(main, /nodeIntegration: false, contextIsolation: true, sandbox: true/)
  assert.match(main, /ipcMain\.handle\('ai:save-cards'/)
  assert.match(main, /validateLibrary\(\{ \.\.\.data, cards: \[\.\.\.data\.cards, \.\.\.cards\] \}\)/)
  assert.match(main, /library:external-update/)
  assert.match(companion, /<AIStudio compact/)
  assert.match(companion, /Minimalizuj asystenta/)
  assert.match(companion, /Zamknij asystenta/)
  assert.match(preload, /onAiWindowContext:/)
})

test('taskbar icon is packaged and rest of learning screen is distraction-free', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.build.win.icon, 'resources/icon.ico')
  assert.ok(pkg.build.extraResources.some(item => item.to === 'icon.ico'))
  assert.match(read('electron/main.ts'), /process\.platform === 'win32' \? 'icon\.ico' : 'icon\.png'/)
  const app = read('src/app/AppDialogs.tsx')
  assert.match(app, /!workspace\.study && \(/)
  assert.match(read('src/features/library/DraftStack.tsx'), /id="draft-popover"/)
  assert.doesNotMatch(read('src/components/Titlebar.tsx'), /<Tooltip/)
})

test('data preferences and accessibility polish remain consistent', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.match(settings, /Pobierz kopię danych/)
  assert.match(settings, /Załaduj dane/)
  assert.doesNotMatch(settings, /Otwórz folder danych/)
  assert.match(settings, /aiSession.email/)
  const css = read('src/styles/index.css')
  assert.match(read('src/components/atoms/Button.tsx'), /text-\[var\(--danger-ink\)\]/)
  assert.match(settings, /min-h-\[83px\]/)
  assert.match(read('src/features/ai/AIComposer.tsx'), /EditorContent editor=\{editor\}/)
  assert.match(read('src/features/library/ManageDialog.tsx'), /data-initial-focus autoFocus/)
  assert.match(read('src/features/library/SearchDialog.tsx'), /autoFocus data-initial-focus/)
})
