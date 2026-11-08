const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = require('../package.json')

test('1.0.6: modal portal is nested within the updater context (regression: blank Updates tab)', () => {
  const app = read('src/main.tsx')
  assert.match(app, /<UpdaterProvider>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<ModalProvider>/)
  assert.match(app, /<ModalProvider>[\s\S]*?<\/ModalProvider>\s*<\/UpdaterProvider>/)
  assert.match(read('src/components/UpdatePanel.tsx'), /useUpdater\(\)/)
  assert.match(read('src/providers/ModalProvider.tsx'), /createPortal\(/)
})

test('1.0.6: both publish destination and packaged update feed reference the exact public repo', () => {
  assert.equal(pkg.version, '1.0.6')
  assert.equal(pkg.repository.url, 'https://github.com/damiandro40/Fiszki.git')
  assert.equal(pkg.build.publish.provider, 'github')
  assert.equal(pkg.build.publish.owner, 'damiandro40')
  assert.equal(pkg.build.publish.repo, 'Fiszki')
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
  assert.equal(pkg.build.win.target[0].target, 'nsis')
  assert.match(read('src/components/UpdatePanel.tsx'), /GitHub Releases · damiandro40\/Fiszki/)
})

test('1.0.6: missing releases or metadata show useful error, and synchronous download failure does not hang', () => {
  const updater = read('electron/updater.ts')
  assert.match(updater, /Nie znaleziono publicznego wydania lub pliku latest\.yml/)
  assert.match(updater, /try\s*\{\s*downloading = autoUpdater\.downloadUpdate\(\)/)
  assert.match(updater, /finally\s*\{\s*downloading = null/)
  assert.match(updater, /state\.phase === 'downloaded'/)
})

test('1.0.6: installable Windows release can be published by a versioned GitHub Actions tag', () => {
  const action = read('.github/workflows/release-windows.yml')
  assert.match(action, /tags:/)
  assert.match(action, /contents: write/)
  assert.match(action, /electron-builder --win nsis --x64 --publish always/)
  const readme = read('README.md')
  assert.match(readme, /latest\.yml/)
  assert.match(readme, /v1\.0\.7/)
})

test('1.0.6: changed TS and TSX files have valid syntax', () => {
  for (const file of ['src/main.tsx', 'src/components/UpdatePanel.tsx', 'electron/updater.ts']) {
    const result = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, file)
  }
})
