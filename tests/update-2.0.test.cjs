const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const moduleFrom = file => {
  const source = ts.transpileModule(read(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const context = { exports: {}, module: { exports: {} }, require, crypto }
  vm.runInNewContext(source, context, { filename: file })
  return context.exports
}

test('app is rebranded without renaming the existing data schema or app id', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.build.productName, 'Fiszki')
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
  assert.match(pkg.version, /^1\.0\.\d+$/)
  assert.match(read('electron/main.ts'), /priorDataDirs/)
  assert.doesNotMatch(read('src/features/library/Sidebar.tsx'), /sidebar-brand|brand-title|brand-subtitle/)
  assert.match(read('src/components/Titlebar.tsx'), /<strong>\{title\}<\/strong>/)
  assert.ok(fs.existsSync(path.join(root, 'resources/icon.svg')))
  assert.deepEqual(fs.readFileSync(path.join(root, 'src/public/icon.png')), fs.readFileSync(path.join(root, 'resources/icon.png')))
})

test('sidebar blank context menu targets root, but add button belongs to library view', () => {
  const sidebar = read('src/features/library/Sidebar.tsx')
  const overview = read('src/features/library/LibraryOverview.tsx')
  assert.match(sidebar, /const blankActions = \[/)
  assert.match(sidebar, /contextValue: 'Biblioteka'/)
  assert.match(sidebar, /onAddFolder\(null\)/)
  assert.doesNotMatch(sidebar, /trigger="add"/)
  assert.match(sidebar, /openContextMenu\(event, blankActions\)/)
  assert.match(overview, /onAddFolder\(folderId\)/)
  assert.match(overview, /onAddDeck\(folderId\)/)
  assert.match(overview, /trigger="add"/)
})

test('folder ancestry respects the hierarchy and counts propagate to ancestors', () => {
  const { folderAncestors, getLibraryCounts } = moduleFrom('src/lib/tree.ts')
  const data = {
    folders: [
      { id: 'A', parentId: null, name: 'Anatomia' },
      { id: 'B', parentId: 'A', name: 'OUN' },
      { id: 'C', parentId: 'B', name: 'Mózg' }
    ],
    decks: [{ id: 'D', folderId: 'C' }, { id: 'E', folderId: 'A' }],
    cards: [{ deckId: 'D' }, { deckId: 'D' }, { deckId: 'E' }]
  }
  assert.deepEqual(Array.from(folderAncestors(data, 'C'), item => item.name), ['Anatomia', 'OUN', 'Mózg'])
  const counts = getLibraryCounts(data)
  assert.equal(counts.decks.get('D'), 2)
  assert.equal(counts.folders.get('A'), 2)
  assert.equal(counts.folders.get('B'), 1)
  assert.equal(counts.folders.get('C'), 1)
})

test('AI emphasis and colors produce safe TipTap marks and a proper bullet list', () => {
  const { contentToDoc, generationInstructions } = moduleFrom('src/lib/aiCards.ts')
  const doc = contentToDoc('**Jądro ogoniaste**\n- [[accent|głowa]]\n- *ogon*\n[[highlight|ważne]]')
  assert.equal(doc.type, 'doc')
  assert.equal(doc.content[0].content[0].marks[0].type, 'bold')
  assert.equal(doc.content[1].type, 'bulletList')
  assert.equal(doc.content[1].content[0].content[0].content[0].marks[0].type, 'textStyle')
  assert.equal(doc.content[1].content[0].content[0].content[0].marks[0].attrs.color, 'var(--accent-ink)')
  assert.equal(doc.content[1].content[1].content[0].content[0].marks[0].type, 'italic')
  assert.equal(doc.content[2].content[0].marks[0].type, 'highlight')
  assert.match(generationInstructions(12), /bezpiecznego formatowania/)
  assert.doesNotMatch(JSON.stringify(doc), /<script|<img|onerror=/i)
})

test('custom color math is reversible and rejects invalid hex input', () => {
  const { hexToHsv, hsvToHex, isHexColor } = moduleFrom('src/lib/colorMath.ts')
  for (const hex of ['#000000', '#ffffff', '#2277dd', '#dd5533', '#00ff99']) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex)
  }
  assert.equal(isHexColor('#000000'), true)
  assert.equal(isHexColor('red; background:url(x)'), false)
})

test('color picker uses a bounded in-panel editor instead of native OS picker', () => {
  const code = read('src/features/editor/ColorPalette.tsx')
  assert.doesNotMatch(code, /showPicker\(|type="color"/)
  assert.match(code, /role="slider"/)
  assert.match(code, /isHexColor\(hex\)/)
  assert.match(code, /onContextMenu=\{event => openContextMenu/)
})

test('study view has two 3D faces, swipe grading and reduced-motion fallback', () => {
  const code = read('src/features/study/StudyView.tsx')
  const css = read('src/styles/index.css')
  assert.match(code, /createPortal\(/)
  assert.match(code, /study-card-front/)
  assert.match(code, /study-card-back/)
  assert.match(code, /prefers-reduced-motion: reduce/)
  assert.match(css, /rotateY\(180deg\)/)
  assert.match(css, /study-flight-ghost/)
  assert.match(code, /window\.innerWidth - rect\.left/)
})

test('folder view has clickable breadcrumb and no redundant instruction', () => {
  const code = read('src/features/library/LibraryOverview.tsx')
  assert.match(code, /folderAncestors\(data, folderId\)/)
  assert.match(code, /aria-label="Ścieżka folderu"/)
  assert.doesNotMatch(code, /Zorganizuj swoje materiały w folderach i zestawach/)
})

test('AI badge is an icon with restrained tooltip', () => {
  const code = read('src/features/library/DeckView.tsx')
  assert.match(code, /Wygenerowane przez AI/)
  assert.match(code, /label="Wygenerowane przez AI"/)
  assert.doesNotMatch(code, /AI · sprawdź/)
})

test('IPC data and window actions verify sender, editor defaults to center', () => {
  const main = read('electron/main.ts')
  for (const event of ['library:load', 'library:save', 'library:export', 'library:import', 'window:close']) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('${event.replace(':', ':')}'`))
  }
  assert.match(main, /assertMainWindow\(event\); return enqueue\(loadDatabase\)/)
  assert.match(read('src/features/editor/RichTextEditor.tsx'), /editor\.isActive\(\{ textAlign: 'center' \}\)/)
})
