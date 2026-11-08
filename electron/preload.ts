import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { DesktopAPI } from '../src/types/model'

const api: DesktopAPI = {
  updaterState: () => ipcRenderer.invoke('updater:state'),
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: callback => {
    const handler = (_event: IpcRendererEvent, state: Parameters<typeof callback>[0]) => callback(state)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },
  onUpdaterPrepare: callback => {
    const handler = () => {
      void Promise.resolve().then(callback)
        .then(() => ipcRenderer.send('updater:ready', true))
        .catch(() => ipcRenderer.send('updater:ready', false))
    }
    ipcRenderer.on('updater:prepare', handler)
    return () => ipcRenderer.removeListener('updater:prepare', handler)
  },
  studyWindowOpen: (deckId, restart, continueSession) => ipcRenderer.invoke('study:window-open', deckId, !!restart, continueSession ?? null),
  studyWindowClose: () => ipcRenderer.invoke('study:window-close'),
  studyWindowInfo: () => ipcRenderer.invoke('study:window-info'),
  studyWindowSave: (session, restart) => ipcRenderer.invoke('study:window-save', session, !!restart),
  onStudySessionUpdated: callback => {
    const handler = (_event: IpcRendererEvent, session: Parameters<typeof callback>[0]) => callback(session)
    ipcRenderer.on('study:session-updated', handler)
    return () => ipcRenderer.removeListener('study:session-updated', handler)
  },
  aiStatus: () => ipcRenderer.invoke('ai:status'),
  aiConnect: () => ipcRenderer.invoke('ai:connect'),
  aiDisconnect: () => ipcRenderer.invoke('ai:disconnect'),
  aiModels: () => ipcRenderer.invoke('ai:models'),
  aiManageUsage: () => ipcRenderer.invoke('ai:usage'),
  aiSend: request => ipcRenderer.invoke('ai:send', request),
  aiHistoryLoad: deckId => ipcRenderer.invoke('ai:history-load', deckId),
  aiHistorySave: (deckId, messages) => ipcRenderer.invoke('ai:history-save', deckId, messages),
  aiCancel: () => ipcRenderer.invoke('ai:cancel'),
  aiWindowToggle: (deckId, forceOpen) => ipcRenderer.invoke('ai:window-toggle', deckId, !!forceOpen),
  aiWindowInfo: () => ipcRenderer.invoke('ai:window-info'),
  aiSaveCards: (deckId, cards, model) => ipcRenderer.invoke('ai:save-cards', { deckId, cards, model }),
  aiFocusDeck: deckId => ipcRenderer.invoke('ai:focus-deck', deckId),
  onAiSessionUpdated: callback => {
    const handler = () => callback()
    ipcRenderer.on('ai:session-updated', handler)
    return () => ipcRenderer.removeListener('ai:session-updated', handler)
  },
  onAiWindowState: callback => {
    const handler = (_event: IpcRendererEvent, open: boolean) => callback(open)
    ipcRenderer.on('ai:window-state', handler)
    return () => ipcRenderer.removeListener('ai:window-state', handler)
  },
  onAiWindowContext: callback => {
    const handler = (_event: IpcRendererEvent, deckId: string | null) => callback(deckId)
    ipcRenderer.on('ai:window-context', handler)
    return () => ipcRenderer.removeListener('ai:window-context', handler)
  },
  onLibraryExternalUpdate: callback => {
    const handler = () => callback()
    ipcRenderer.on('library:external-update', handler)
    return () => ipcRenderer.removeListener('library:external-update', handler)
  },
  onAiFocusDeck: callback => {
    const handler = (_event: IpcRendererEvent, deckId: string) => callback(deckId)
    ipcRenderer.on('ai:focus-deck', handler)
    return () => ipcRenderer.removeListener('ai:focus-deck', handler)
  },
  onAiDelta: callback => {
    const handler = (_event: IpcRendererEvent, id: string, delta: string) => callback(id, delta)
    ipcRenderer.on('ai:delta', handler)
    return () => ipcRenderer.removeListener('ai:delta', handler)
  },
  onAiAuthProgress: callback => {
    const handler = (_event: IpcRendererEvent, phase: 'browser' | 'callback' | 'tokens' | 'verified') => callback(phase)
    ipcRenderer.on('ai:auth-progress', handler)
    return () => ipcRenderer.removeListener('ai:auth-progress', handler)
  },
  load: () => ipcRenderer.invoke('library:load'),
  save: data => ipcRenderer.invoke('library:save', data),
  exportBackup: () => ipcRenderer.invoke('library:export'),
  importBackup: () => ipcRenderer.invoke('library:import'),
  openDataFolder: () => ipcRenderer.invoke('library:show-folder'),
  loadWorkspace: () => ipcRenderer.invoke('workspace:load'),
  saveWorkspace: state => ipcRenderer.invoke('workspace:save', state),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onMaximizeChange: callback => {
    let active = true
    const handler = (_event: IpcRendererEvent, maximized: boolean) => { if (active) callback(maximized) }
    ipcRenderer.on('window:maximized', handler)
    void ipcRenderer.invoke('window:is-maximized')
      .then((maximized: boolean) => { if (active) callback(maximized) })
      .catch(() => undefined)
    return () => { active = false; ipcRenderer.removeListener('window:maximized', handler) }
  }
}

contextBridge.exposeInMainWorld('flashcards', api)
