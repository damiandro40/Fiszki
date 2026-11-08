const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('provider owns ReactNode dialogs, supports nested stack and closes the latest', () => {
  const provider = read('src/providers/ModalProvider.tsx')
  assert.match(provider, /createModal: \(content: ReactNode/)
  assert.match(provider, /appendOverlay\(previous, \{ id, content, options \}\)/)
  assert.match(provider, /const current = latestOverlay\(active\)/)
  assert.match(provider, /requestClose\(current\.id\)/)
  assert.match(provider, /aria-modal=\{isTop\}/)
  assert.match(provider, /document\.addEventListener\('keydown', onKeyDown\)/)
  assert.match(read('src/components/Modal.tsx'), /createModal\(children, options\)/)
  assert.match(read('src/main.tsx'), /<ModalProvider>/)
})

test('toast provider queues newest three, pauses on stack hover, supports undo per item', () => {
  const provider = read('src/providers/ToastProvider.tsx')
  assert.match(provider, /enqueueToast\(previous, \{ \.\.\.options, id, message \}, 3\)/)
  assert.match(provider, /const visible = \[\.\.\.items\]\.reverse\(\)/)
  assert.match(provider, /onPointerEnter=\{\(\) => setExpanded\(true\)\}/)
  assert.match(provider, /pausedExternally=\{isExpanded \|\| exiting\}/)
  assert.match(provider, /item\.undo\?\.\(\)/)
  assert.match(read('src/components/Toast.tsx'), /hovered \|\| focused \|\| pausedExternally/)
  assert.match(read('src/app/useAppController.ts'), /addToast\(message, \{/)
})

test('Toast stack has subdued hover expansion and accessible reduced-motion behavior', () => {
  const css = read('src/styles/widgets.css')
  const provider = read('src/providers/ToastProvider.tsx')
  assert.match(provider, /transition-\[opacity,transform\]/)
  assert.match(provider, /translate3d/)
  assert.match(provider, /motion-reduce:transition-none/)
  assert.doesNotThrow(() => postcss.parse(css))
})

test('list align left/right overrides centered default while keeping markers next to content', () => {
  const css = read('src/styles/widgets.css')
  assert.match(css, /:has\(> li p\[style\*="text-align: left"\]\)/)
  assert.match(css, /:has\(> li p\[style\*="text-align: right"\]\)/)
  assert.match(css, /li > p\[style\*="text-align: right"\] \{ text-align: right !important; \}/)
  assert.match(css, /width: max-content/)
})

test('table grid selection starts blank and is cleared on close, including dismiss', () => {
  const picker = read('src/features/editor/TableInsertPicker.tsx')
  assert.match(picker, /useState<\{ rows: number, cols: number \} \| null>\(null\)/)
  assert.match(picker, /const changeOpen = \(next: boolean\)/)
  assert.match(picker, /setHovered\(null\)/)
  assert.match(picker, /onOpenChange: changeOpen/)
  assert.match(picker, /Wybierz rozmiar/)
})

test('new modules have valid TypeScript/TSX syntax', () => {
  for (const file of ['src/providers/ModalProvider.tsx', 'src/providers/ToastProvider.tsx', 'src/components/Modal.tsx', 'src/components/Toast.tsx']) {
    const result = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } })
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file)
  }
})


test('modal LIFO ordering, independent dismissal and bounded notification queue work as pure functions', () => {
  const vm = require('node:vm')
  const file = 'src/lib/overlayQueue.ts'
  const output = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports })
  const { appendOverlay, removeOverlay, latestOverlay, enqueueToast } = module.exports
  const a = { id: 1 }, b = { id: 2 }, c = { id: 3 }, d = { id: 4 }
  let modals = appendOverlay([], a)
  modals = appendOverlay(modals, b)
  assert.equal(latestOverlay(modals).id, 2)
  modals = removeOverlay(modals, 2)
  assert.equal(latestOverlay(modals).id, 1)
  assert.equal(modals.length, 1)
  const messages = [a, b, c].reduce((items, item) => enqueueToast(items, item, 3), [])
  const recent = enqueueToast(messages, d, 3)
  assert.deepEqual(Array.from(recent, item => item.id), [2, 3, 4])
  assert.equal(recent.length, 3)
})
