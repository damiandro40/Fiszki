const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = require('../package.json')

test('1.0.5: updater publishes a versioned Windows NSIS release to the correct public repository', () => {
  assert.match(pkg.version, /^1\.0\.\d+$/)
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
  assert.equal(pkg.build.publish.owner, 'damiandro40')
  assert.equal(pkg.build.publish.repo, 'Fiszki')
  assert.equal(pkg.build.publish.provider, 'github')
  assert.equal(pkg.build.win.target[0].target, 'nsis')
  assert.equal(pkg.build.nsis.perMachine, false)
  assert.match(pkg.dependencies['electron-updater'], /^\^6\./)
})

test('1.0.5: updates are optional and require an explicit install action', () => {
  const source = read('electron/updater.ts')
  assert.match(source, /autoUpdater\.autoDownload = false/)
  assert.match(source, /autoUpdater\.autoInstallOnAppQuit = false/)
  assert.match(source, /autoUpdater\.allowPrerelease = false/)
  assert.match(source, /autoUpdater\.quitAndInstall\(false, true\)/)
  assert.match(source, /app\.isPackaged && process\.platform === 'win32'/)
  assert.match(source, /CHECK_INTERVAL_MS = 6 \* 60 \* 60 \* 1000/)
})

test('1.0.5: preload exposes narrow IPC capabilities, with no arbitrary remote URL or shell actions', () => {
  const source = read('electron/preload.ts')
  for (const action of ['updaterState','updaterCheck','updaterDownload','updaterInstall','onUpdaterStatus','onUpdaterPrepare']) {
    assert.match(source, new RegExp(`${action}:`))
    assert.match(read('src/types/model.ts'), new RegExp(`${action}:`))
  }
  assert.doesNotMatch(source, /updaterSetFeed|updaterOpenUrl/)
})

test('1.0.5: install drains queued storage writes and obtains secondary window acknowledgements', () => {
  const source = read('electron/main.ts')
  assert.match(source, /event\.sender !== mainWindow\?\.webContents/)
  assert.match(source, /Promise\.all\(secondaryWindows\.map\(prepareWindowForUpdate\)\)/)
  assert.match(source, /await enqueue\(async \(\) => undefined\)/)
  assert.match(source, /if \(closeAfterSave \|\| allowUpdaterQuit\) return/)
  assert.match(read('src/views/study/StudyWindow.tsx'), /await lastSaveRef\.current/)
  assert.match(read('src/features/ai/AIStudio.tsx'), /onUpdaterPrepare/)
  assert.match(read('src/app/useAppController.ts'), /await flush\(\)/)
  assert.match(read('src/app/useAppController.ts'), /await window\.flashcards\.saveWorkspace\(workspaceRef\.current\)/)
})

test('1.0.5: update panel and notification use the same atomized button and status model', () => {
  const panel = read('src/components/UpdatePanel.tsx')
  const notice = read('src/components/UpdateNotice.tsx')
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.match(panel, /useUpdater\(\)/)
  assert.match(panel, /phase === 'downloaded'/)
  assert.match(panel, /aria-label="Postęp pobierania aktualizacji"/)
  assert.match(notice, /Przypomnij później/)
  assert.match(settings, /<UpdatePanel onInstall=\{onInstallUpdate\}/)
  assert.match(settings, /id: 'updates'/)
})

test('1.0.5: drafts open a single top popover on hover and toasts remain neutral', () => {
  const drafts = read('src/features/library/DraftStack.tsx')
  const toast = read('src/components/Toast.tsx')
  assert.match(drafts, /group-hover:pointer-events-auto/)
  assert.match(drafts, /bottom-full/)
  assert.doesNotMatch(drafts, /Layers3|stacked-cards/)
  assert.match(toast, /bg-\[var\(--surface\)\]/)
  assert.doesNotMatch(toast, /bg-\[var\(--green-soft\)\]|bg-\[var\(--red-soft\)\]/)
})

test('1.0.5: GitHub Action builds the app and publishes only when tag matches package version', () => {
  const action = read('.github/workflows/release-windows.yml')
  assert.match(action, /tags:/)
  assert.match(action, /contents: write/)
  assert.match(action, /Validate release version/)
  assert.match(action, /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
  assert.match(action, /electron-builder --win nsis --x64 --publish always/)
})

test('1.0.5: all changed TypeScript files are syntactically valid', () => {
  const files = ['electron/updater.ts','electron/main.ts','electron/preload.ts','src/main.tsx',
    'src/components/Toast.tsx','src/components/UpdatePanel.tsx','src/components/UpdateNotice.tsx',
    'src/features/library/DraftStack.tsx','src/features/library/SettingsDialog.tsx',
    'src/views/study/StudyWindow.tsx','src/features/ai/AIStudio.tsx',
    'src/providers/UpdaterProvider.tsx','src/app/useAppController.ts']
  for (const filename of files) {
    const result = ts.transpileModule(read(filename), { fileName: filename, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, filename)
  }
})
