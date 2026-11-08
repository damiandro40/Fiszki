import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../src/types/model'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

// GitHub Releases feed is embedded in app-update.yml by electron-builder (package.json build.publish).
// Do not set an alternate feed URL at runtime: the packaged app always checks damiandro40/Fiszki.
const describeUpdateError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/404|not found|no published versions|no releases/i.test(message)) {
    return 'Nie znaleziono publicznego wydania lub pliku latest.yml w damiandro40/Fiszki. Opublikuj wydanie w GitHub Releases i spróbuj ponownie.'
  }
  return message || 'Nie udało się sprawdzić aktualizacji.'
}

const supported = () => app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE

let state: UpdateState = {
  phase: supported() ? 'idle' : 'unsupported',
  currentVersion: app.getVersion()
}
let checking: Promise<unknown> | null = null
let downloading: Promise<unknown> | null = null
let initialized = false

const broadcast = () => {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('updater:status', state)
    }
  })
}

const update = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch }
  broadcast()
}

export const getUpdateState = () => state

export const checkForAppUpdates = async () => {
  if (!supported()) return getUpdateState()
  if (checking) { await checking; return getUpdateState() }
  if (downloading || state.phase === 'downloaded') return getUpdateState()

  update({ phase: 'checking', error: undefined, percent: undefined })
  try {
    checking = autoUpdater.checkForUpdates()
    await checking
  } catch (error) {
    update({ phase: 'error', error: describeUpdateError(error) })
  } finally {
    checking = null
  }
  return getUpdateState()
}

export const downloadAppUpdate = async () => {
  if (!supported() || state.phase !== 'available') throw new Error('Nie ma aktualizacji do pobrania.')
  if (downloading) return getUpdateState()
  update({ phase: 'downloading', percent: 0, error: undefined })
  try {
    downloading = autoUpdater.downloadUpdate()
    await downloading
  } catch (error) {
    update({ phase: 'error', error: describeUpdateError(error) })
  } finally {
    downloading = null
  }
  return getUpdateState()
}

export const installAppUpdate = () => {
  if (!supported() || state.phase !== 'downloaded') throw new Error('Aktualizacja nie jest gotowa do instalacji.')
  autoUpdater.quitAndInstall(false, true)
}

export const initializeAppUpdater = () => {
  if (initialized) return
  initialized = true
  if (!supported()) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('update-available', info => update({ phase: 'available', version: info.version, error: undefined, percent: undefined }))
  autoUpdater.on('update-not-available', () => update({ phase: 'current', version: undefined, error: undefined, percent: undefined }))
  autoUpdater.on('download-progress', progress => update({ phase: 'downloading', percent: Math.min(100, Math.max(0, progress.percent)) }))
  autoUpdater.on('update-downloaded', info => update({ phase: 'downloaded', version: info.version, percent: 100, error: undefined }))
  autoUpdater.on('error', error => update({ phase: 'error', error: describeUpdateError(error) }))

  // Check once after the renderer is available, then periodically while running.
  const initial = setTimeout(() => { void checkForAppUpdates() }, 2500)
  const periodic = setInterval(() => { void checkForAppUpdates() }, CHECK_INTERVAL_MS)
  app.once('before-quit', () => { clearTimeout(initial); clearInterval(periodic) })
}
