const assert = require('node:assert/strict')
const { test } = require('node:test')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiszki-ui-tests-'))
const compile = name => {
  const source = fs.readFileSync(path.join(root, 'src/lib', `${name}.ts`), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const location = path.join(tmp, `${name}.cjs`)
  fs.writeFileSync(location, output)
  return require(location)
}

const actions = compile('manageActions')
const palette = compile('palette')
const { readSource } = require('./helpers/source.cjs')
const read = name => readSource(root, `src/${name}`)

test('rename actions map to supported edit dialogs for folders and decks', () => {
  assert.equal(actions.manageModeForItem('deck', 'rename'), 'edit-deck')
  assert.equal(actions.manageModeForItem('folder', 'rename'), 'edit-folder')
  assert.equal(actions.manageModeForItem('deck', 'move'), 'move-deck')
  assert.equal(actions.manageModeForItem('folder', 'delete'), 'delete-folder')
  assert.match(read('App.tsx'), /ask\(manageModeForItem\(kind, action\), id\)/)
})

test('palette add, replace and remove maintain a maximum of five saved colors', () => {
  const defaults = palette.normalizePalette(undefined, 'text')
  assert.equal(defaults.length, 4)
  const five = palette.addPaletteColor(defaults, '#abcdef')
  assert.equal(five.length, 5)
  const replaced = palette.replacePaletteColor(five, 2, '#112233')
  assert.equal(replaced[2], '#112233')
  const removed = palette.removePaletteColor(replaced, 2)
  assert.equal(removed.length, 4)
  assert.equal(removed.includes('#112233'), false)
  assert.deepEqual(palette.normalizePalette([], 'background'), [])
})

test('duplicate palette colors are collapsed and invalid inputs ignored', () => {
  assert.deepEqual(palette.normalizePalette(['#ABCDEF', '#abcdef'], 'text'), ['#abcdef'])
  assert.deepEqual(palette.addPaletteColor(['#abcdef'], 'bad'), ['#abcdef'])
  assert.deepEqual(palette.replacePaletteColor(['#abcdef'], 99, '#112233'), ['#abcdef'])
})

test('animated floating surfaces use layout positioning instead of transform positioning', () => {
  for (const location of [
    'components/Dropdown.tsx', 'components/ContextMenu.tsx',
    'components/Tooltip.tsx', 'components/Select.tsx',
    'features/editor/ColorPalette.tsx', 'features/editor/TableInsertPicker.tsx'
  ]) {
    assert.match(read(location), /transform:\s*false/, `${location} must not combine position and animation transforms`)
    assert.match(read(location), /useTransitionStyles/, `${location} must retain animations`)
  }
})

test('table popups omit noisy instructions and canned cell background colors', () => {
  assert.doesNotMatch(read('features/editor/tableActions.ts'), /Tło komórki:|Usuń tło komórki/)
  assert.doesNotMatch(read('features/editor/RichTextEditor.tsx'), /PPM na komórce/)
  assert.match(read('features/editor/tableActions.ts'), /Podziel komórkę/)
})

test('offline and local-save success indicators are hidden while errors stay visible', () => {
  assert.doesNotMatch(read('features/library/Sidebar.tsx'), /Działa w 100% offline/)
  assert.doesNotMatch(read('App.tsx'), /Zapisano lokalnie/)
  assert.match(read('App.tsx'), /saveStatus === 'error'/)
  assert.doesNotMatch(read('App.tsx'), /save-indicator/)
})
