const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = location => fs.readFileSync(path.join(root, location), 'utf8')

test('both modal entry and exit are animated before unmount', () => {
  const provider = read('src/providers/ModalProvider.tsx')
  const styles = read('src/styles/widgets.css')
  assert.match(provider, /modal-overlay/)
  assert.match(provider, /modal-panel/)
  assert.match(provider, /data-closing=\{closing\}/)
  assert.match(styles, /\.modal-overlay\[data-closing='false'\]\s*\{\s*animation:\s*veil-in/)
  assert.match(styles, /\.modal-overlay\[data-closing='true'\]\s*\{\s*animation:\s*veil-out/)
  assert.match(styles, /\.modal-panel\[data-closing='false'\]\s*\{\s*animation:\s*dialog-in/)
  assert.match(styles, /\.modal-panel\[data-closing='true'\]\s*\{\s*animation:\s*dialog-out/)
})

test('new toasts have a separate entrance animation from their stack position', () => {
  assert.match(read('src/providers/ToastProvider.tsx'), /className="toast-reveal"/)
  assert.match(read('src/styles/widgets.css'), /\.toast-reveal\s*\{\s*animation:\s*toast-in/)
  assert.match(read('src/providers/ToastProvider.tsx'), /transition-\[opacity,transform\]/)
})

test('tiles stay in place on hover, while menus and tree items have spacing', () => {
  assert.doesNotMatch(read('src/components/LibraryTile.tsx'), /hover:-translate-y-/)
  assert.match(read('src/components/LibraryTile.tsx'), /hover:border-\[var\(--tile-hover-border\)\]/)
  assert.match(read('src/components/ContextMenu.tsx'), /flex-col gap-1\.5/)
  assert.match(read('src/components/Dropdown.tsx'), /flex-col gap-1\.5/)
  assert.match(read('src/features/library/Sidebar.tsx'), /renderChildren = \(parentId: string \| null, depth = 0\): ReactNode => <div className="flex flex-col gap-1">/)
})

test('summary metrics are grouped and both themes define tile interaction colors', () => {
  assert.match(read('src/views/library/LibraryOverview.tsx'), /stats-grid.*grid-cols-2.*divide-x/)
  assert.match(read('src/components/LibraryMetric.tsx'), /tabular-nums/)
  const theme = read('src/styles/theme.css')
  assert.equal((theme.match(/--tile-hover-bg:/g) || []).length, 2)
  assert.equal((theme.match(/--selected-border:/g) || []).length, 2)
})

test('current version is recorded and outdated markdown artifacts have been removed', () => {
  assert.match(JSON.parse(read('package.json')).version, /^1\.0\.\d+$/)
  assert.deepEqual(fs.readdirSync(root).filter(name => name.endsWith('.md')), ['README.md'])
  assert.equal(fs.existsSync(path.join(root, 'docs')), false)
})
