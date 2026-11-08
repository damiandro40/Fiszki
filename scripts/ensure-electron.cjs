// The electron npm package is only a JavaScript wrapper until its native binary is installed.
// electron-vite needs both node_modules/electron/dist/electron.exe and path.txt.
const { existsSync, readFileSync } = require('node:fs')
const { dirname, join } = require('node:path')
const { spawnSync } = require('node:child_process')

const electronDir = dirname(require.resolve('electron'))
const pathFile = join(electronDir, 'path.txt')
const executable = () => {
    if (!existsSync(pathFile)) return null
    const relative = readFileSync(pathFile, 'utf8').trim()
    return relative ? join(electronDir, 'dist', relative) : null
}

if (executable() && existsSync(executable())) {
    console.log('[Fiszki] Electron: OK')
    process.exit(0)
}

console.log('[Fiszki] Electron nie ma binarium/path.txt - naprawiam instalacje...')

const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', join(__dirname, 'repair-electron.ps1')
    ], {
        stdio: 'inherit',
        env: { ...process.env, ELECTRON_ARCH: process.arch }
    })
    : spawnSync(process.execPath, [join(electronDir, 'install.js')], { stdio: 'inherit' })

if (result.error || result.status !== 0 || !executable() || !existsSync(executable())) {
    console.error('[Fiszki] Nie mozna uruchomic Electrona.')
    if (result.error) console.error(result.error.message)
    console.error('Windows: uruchom fix-electron.cmd, aby zobaczyc szczegoly.')
    process.exit(1)
}

console.log('[Fiszki] Electron: naprawiony. Startuje aplikacja.')
