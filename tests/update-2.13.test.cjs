const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const compile = filename => {
  const { outputText } = ts.transpileModule(read(filename), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports })
  return module.exports
}

test('basic reusable controls are atoms and expose inferred variant types', () => {
  for (const name of ['Button', 'Input']) {
    const file = `src/components/atoms/${name}.tsx`
    const source = read(file)
    assert.match(source, /import \{ tv, type VariantProps \} from 'tailwind-variants'/)
    assert.match(source, /const styles = tv\(\{[\s\S]*slots:/)
    assert.match(source, /button:|field:/)
    assert.match(source, /VariantProps<typeof styles>/)
    assert.doesNotMatch(source, /\btva\b/)
    assert.match(source, /enabled:hover:|hover:border-/)
    assert.doesNotMatch(source, /(?<!enabled:)hover:bg-/)
  }
  assert.match(read('src/components/atoms/Button.tsx'), /Object\.assign\(BaseButton, \{ Icon: IconButton \}\)/)
})

test('theme palettes remain in CSS while view structure uses utility classes', () => {
  const files = fs.readdirSync(path.join(root, 'src/styles')).sort()
  assert.deepEqual(files, ['index.css', 'theme.css', 'widgets.css'])
  assert.ok(!fs.existsSync(path.join(root, 'src/styles/layers')))
  for (const file of files) assert.doesNotThrow(() => postcss.parse(read(`src/styles/${file}`)))
  const theme = read('src/styles/theme.css')
  assert.match(theme, /@tailwind utilities;/)
  assert.match(theme, /\[data-theme='dark'\]/)
  assert.match(theme, /\[data-theme='light'\]/)
  assert.match(read('src/views/decks/DeckView.tsx'), /flex min-h-\[112px\] items-start gap-3/)
  assert.match(read('src/features/library/SettingsDialog.tsx'), /grid h-full min-h-0 w-full/)
})

test('settings dialog has stable responsive dimensions independent of selected section', () => {
  const modal = read('src/providers/ModalProvider.tsx')
  assert.match(modal, /kind === 'settings'/)
  assert.match(modal, /h-\[min\(670px,calc\(100dvh-32px\)\)\]/)
  assert.match(modal, /w-\[min\(900px,calc\(100vw-32px\)\)\]/)
  assert.match(modal, /min-h-0 min-w-0 flex-1 overscroll-contain/)
  assert.match(read('src/features/library/SettingsDialog.tsx'), /overflow-y-auto p-6/)
})

test('closing modals and toast notifications animate before unmount', () => {
  const modal = read('src/providers/ModalProvider.tsx')
  const toast = read('src/providers/ToastProvider.tsx')
  for (const source of [modal, toast]) {
    assert.match(source, /setTimeout\(/)
    assert.match(source, /closingIds/)
    assert.match(source, /transition-\[opacity,transform\]|transition-opacity/)
    assert.match(source, /motion-reduce:transition-none/)
    assert.match(source, /clearTimeout/)
  }
  assert.match(toast, /enqueueToast\(previous, \{ \.\.\.options, id, message \}, 3\)/)
})

test('keyboard binding capture is canceled by clicking its active button or changing sections', () => {
  const code = read('src/features/library/SettingsDialog.tsx')
  assert.match(code, /event\.key === 'Escape'/)
  assert.match(code, /setCapturing\(capturing === item\.action \? null : item\.action\)/)
  assert.doesNotMatch(code, /onBlur=\{\(\) => \{ if \(capturing === item\.action\)/)
  assert.match(code, /if \(event\.key === 'Escape'\) return/)
  assert.match(code, /Kliknij, aby anulować/)
  assert.match(code, /setSection\(item\.id\); setCapturing\(null\)/)
})

test('card index and front/back captions share a compact predictable row', () => {
  const code = read('src/views/decks/DeckView.tsx')
  assert.match(code, /grid-cols-\[2rem_minmax\(0,1fr\)\]/)
  assert.match(code, /col-start-2 row-start-2 min-w-0/)
  assert.match(code, />PRZÓD<\/span>/)
  assert.match(code, />TYŁ<\/div>/)
  assert.doesNotMatch(code, /grid-template-columns:\s*(70px|90px|100px)/)
})

test('TipTap toolbar signature changes with formatting, alignment and colors', () => {
  const { getToolbarSignature } = compile('src/features/editor/toolbarState.ts')
  let marks = new Set()
  let alignment = 'left'
  let textColor = null
  const editor = {
    isActive: (name, attrs) => {
      if (typeof name === 'object') return name.textAlign === alignment
      if (name === 'heading') return marks.has(`heading:${attrs?.level}`)
      return marks.has(name)
    },
    getAttributes: kind => kind === 'textStyle' ? { color: textColor } : { color: null }
  }
  const first = getToolbarSignature(editor)
  marks = new Set(['bold', 'italic'])
  const bold = getToolbarSignature(editor)
  assert.notEqual(first, bold)
  assert.equal(bold, getToolbarSignature(editor), 'ordinary text insertion should not change toolbar status')
  alignment = 'center'
  assert.notEqual(getToolbarSignature(editor), bold)
  textColor = '#ef4a33'
  assert.notEqual(getToolbarSignature(editor), bold)
})

test('TipTap toolbar updates on transaction and selection changes and cleans up subscriptions', () => {
  const hook = read('src/features/editor/useToolbarSelection.ts')
  assert.match(hook, /editor\.on\('transaction', synchronize\)/)
  assert.match(hook, /editor\.on\('selectionUpdate', synchronize\)/)
  assert.match(hook, /editor\.off\('transaction', synchronize\)/)
  assert.match(hook, /editor\.off\('selectionUpdate', synchronize\)/)
  assert.match(hook, /if \(next === signature\) return/)
  const editor = read('src/features/editor/RichTextEditor.tsx')
  assert.match(editor, /useToolbarSelection\(editor\)/)
  assert.match(editor, /active\('bold'\)/)
  assert.match(read('src/components/atoms/Button.tsx'), /aria-pressed=\{active \|\| undefined\}/)
})
