const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const code = file => readSource(root, file)

test('shared folder and deck menu builders use icons and location-specific labels', () => {
  const source = code('src/features/library/itemMenus.tsx')
  assert.match(source, /label: 'Nowy folder w:', contextValue: folder.name/)
  assert.match(source, /label: 'Nowy zestaw w:', contextValue: folder.name/)
  assert.match(source, /icon: <Pencil/)
  assert.match(source, /icon: <Trash2/)
  assert.match(code('src/features/library/Sidebar.tsx'), /folderMenuActions\(folder/)
  assert.match(code('src/features/library/LibraryOverview.tsx'), /folderMenuActions\(item/)
})

test('sidebar selects and expands a folder; the library page handles creation', () => {
  const source = code('src/features/library/Sidebar.tsx')
  assert.match(source, /isActive && !closed/)
  assert.match(source, /if \(!isActive\) onSelect/)
  assert.match(source, /ancestors.forEach\(id => next.delete\(id\)\)/)
  assert.doesNotMatch(source, /trigger="add"/)
  assert.match(code('src/features/library/LibraryOverview.tsx'), /onAddFolder\(folderId\)/)
  assert.match(code('src/features/library/LibraryOverview.tsx'), /onAddDeck\(folderId\)/)
  assert.match(source, /onContextMenu=\{event =>/)
})

test('image editor only has the delete action and drag-to-resize handle', () => {
  const source = code('src/features/editor/ResizableImage.tsx')
  assert.match(source, /image-remove/)
  assert.match(source, /image-resize-handle/)
  assert.doesNotMatch(source, /image-size-actions|Oryginalna szerokość|>S<|>M<|>L</)
})

test('settings preview is temporary and save commits preferences', () => {
  const source = code('src/App.tsx')
  assert.match(source, /useTheme\(themePreview \?\? data\?\.preferences.theme/)
  assert.match(source, /setThemePreview\(null\)/)
  assert.match(source, /onPreviewTheme=\{setThemePreview\}/)
  assert.match(code('src/features/library/SettingsDialog.tsx'), /onPreviewTheme\(item.value\)/)
  assert.match(code('src/features/library/SettingsDialog.tsx'), /onChange\(\{ \.\.\.preferences, theme, shuffle, studyInSeparateWindow, studyKeys: keys \}\)/)
})

test('quick editor keeps last used card ID in the Electron workspace schema', () => {
  assert.match(code('electron/main.ts'), /lastEditedCardId: z.string\(\)/)
  assert.match(code('src/app/AppDialogs.tsx'), /cardDrafts.length && !composerDeckId/)
  assert.match(code('src/app/useAppController.ts'), /lastEditedCardId: card.id/)
  assert.match(code('src/lib/workspace.ts'), /lastEditedCardId/)
})
