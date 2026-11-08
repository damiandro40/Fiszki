const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')

test('Tailwind variants use tv, underscore-prefixed slots and only enabled interaction styles', () => {
  for (const file of ['src/components/atoms/Button.tsx']) {
    const component = source(file)
    assert.match(component, /import \{ tv, type VariantProps \} from 'tailwind-variants'/)
    assert.match(component, /const styles = tv\(\{/)
    assert.match(component, /button:/)
    assert.match(component, /enabled:hover:/)
    assert.match(component, /enabled:active:/)
    assert.doesNotMatch(component, /\btva\b|\bhover:bg-(?!\[)/)
  }
  const pkg = JSON.parse(source('package.json'))
  assert.ok(pkg.dependencies['tailwind-variants'])
  assert.ok(pkg.devDependencies.tailwindcss)
})

test('Button.Icon and the normal Button share a single recipe and accept native refs', () => {
  const button = source('src/components/atoms/Button.tsx')
  assert.match(button, /forwardRef<HTMLButtonElement, ButtonProps>/)
  assert.match(button, /forwardRef<HTMLButtonElement, IconProps>/)
  assert.match(button, /Object\.assign\(BaseButton, \{ Icon: IconButton \}\)/)
  assert.match(button, /tooltip === false \|\| disabled/)
  assert.match(source('src/components/Dropdown.tsx'), /<Button\.Icon ref=\{floating\.refs\.setReference\}/)
  assert.match(source('src/features/editor/RichTextEditor.tsx'), /<Button\.Icon/)
  assert.equal(fs.existsSync(path.join(root, 'src/components/IconButton.tsx')), false)
})

test('import confirmation opens as the second modal without dismissing settings', () => {
  const dialogs = source('src/app/AppDialogs.tsx')
  assert.match(dialogs, /onImport=\{\(\) => ask\('import-backup'\)\}/)
  assert.doesNotMatch(dialogs, /onImport=\{\(\) => \{ setSettingsOpen\(false\)/)
  const provider = source('src/providers/ModalProvider.tsx')
  assert.match(provider, /appendOverlay\(previous, \{ id, content, options \}\)/)
  assert.match(provider, /latestOverlay\(active\)/)
  assert.match(provider, /requestClose\(current\.id\)/)
  assert.match(provider, /aria-hidden=\{!isTop\}/)
})

test('toast stack is compact but preserves the last three, undo, focus and hover pause', () => {
  const css = source('src/styles/widgets.css')
  const stack = source('src/providers/ToastProvider.tsx')
  const toast = source('src/components/Toast.tsx')
  assert.match(toast, /min-h-\[58px\].*px-3 py-2\.5/)
  assert.match(stack, /enqueueToast\(previous, \{ \.\.\.options, id, message \}, 3\)/)
  assert.match(stack, /visible\.map\(/)
  assert.match(stack, /pausedExternally=\{isExpanded \|\| exiting\}/)
  assert.match(toast, /onPointerEnter=\{\(\) => setHovered\(true\)\}/)
  assert.match(toast, /onFocusCapture=\{\(\) => setFocused\(true\)\}/)
  assert.match(toast, /onUndo && <Button/)
  assert.match(toast, /<Button\.Icon label="Zamknij powiadomienie"/)
})

test('existing table, rich text and local library storage are preserved', () => {
  assert.match(source('src/features/editor/TableInsertPicker.tsx'), /setHovered\(null\)/)
  assert.match(source('src/features/editor/RichTextEditor.tsx'), /editorExtensions/)
  assert.match(source('src/app/useAppController.ts'), /flush\(\)/)
  const pkg = JSON.parse(source('package.json'))
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
})

test('new TS modules and layered CSS parse without syntax errors', () => {
  for (const file of [
    'src/components/atoms/Button.tsx',
    'src/components/Dropdown.tsx', 'src/providers/ModalProvider.tsx',
    'src/components/Toast.tsx', 'src/providers/ToastProvider.tsx',
    'src/app/AppDialogs.tsx'
  ]) {
    const result = ts.transpileModule(source(file), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext }
    })
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file)
  }
  assert.doesNotThrow(() => postcss.parse(source('src/styles/widgets.css')))
})
