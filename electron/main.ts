import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { promises as fs, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ChatGPTConnection } from './ai/siwc'
import { checkForAppUpdates, downloadAppUpdate, getUpdateState, initializeAppUpdater, installAppUpdate } from './updater'

import { publicAiError } from '../src/lib/aiErrors'
import { aiHistorySchema, aiRequestSchema } from './ai/contracts'
import { workspaceSchema } from './storage/schemas'
import { validateLibrary, validateRichDoc } from './storage/validation'
import { getWorkspacePath, getWindowPath, atomicWrite, loadWorkspace, loadWindowState, enqueue, writeDatabase, loadDatabase } from './storage/repository'
import { contentToDoc } from '../src/lib/aiCards'
import { startStudySession } from '../src/lib/workspace'
import { resumableStudySession } from '../src/lib/studySessions'
import { studySessionSchema } from './storage/schemas'
import type { StudySession } from '../src/types/model'
import type { LibraryData } from '../src/types/model'

const getIconPath = () => {
  const name = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), 'resources', name)
}

let mainWindow: BrowserWindow | null = null
let assistantWindow: BrowserWindow | null = null
let assistantDeckId: string | null = null
let studyWindow: BrowserWindow | null = null
let studyDeckId: string | null = null

const informAssistantState = () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai:window-state', !!assistantWindow && !assistantWindow.isDestroyed())
}

const createAssistantWindow = async (deckId: string | null) => {
  assistantDeckId = deckId
  const bounds = mainWindow?.getBounds()
  const assistant = new BrowserWindow({
    width: 520, height: 760, minWidth: 420, minHeight: 540,
    x: bounds ? bounds.x + Math.max(0, bounds.width - 530) : undefined,
    y: bounds ? bounds.y + 52 : undefined,
    title: 'Fiszki · Asystent AI', frame: false, autoHideMenuBar: true,
    backgroundColor: '#111c2b', icon: getIconPath(),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  })
  assistantWindow = assistant
  const sendAssistantMaximized = () => { if (!assistant.isDestroyed()) assistant.webContents.send('window:maximized', assistant.isMaximized()) }
  assistant.on('maximize', sendAssistantMaximized)
  assistant.on('unmaximize', sendAssistantMaximized)
  assistant.webContents.on('did-finish-load', sendAssistantMaximized)
  assistant.on('closed', () => { chatgpt.cancel(); if (assistantWindow === assistant) { assistantWindow = null; assistantDeckId = null; informAssistantState() } })
  assistant.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  assistant.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'ai')
    await assistant.loadURL(url.href)
  } else {
    await assistant.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'ai' } })
  }
  informAssistantState()
}

// A focused, independent study window, using the same sandboxed renderer and IPC bridge.
// Its session is saved in the existing workspace so progress survives window closure.
const createStudyWindow = async (deckId: string, deckName: string) => {
  const bounds = mainWindow?.getBounds()
  const study = new BrowserWindow({
    width: 920, height: 810, minWidth: 540, minHeight: 560,
    x: bounds ? bounds.x + 70 : undefined,
    y: bounds ? bounds.y + 65 : undefined,
    frame: false, title: `Nauka · ${deckName} · Fiszki`, autoHideMenuBar: true,
    backgroundColor: '#101925', icon: getIconPath(),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  })
  studyWindow = study
  studyDeckId = deckId
  const maximized = () => { if (!study.isDestroyed()) study.webContents.send('window:maximized', study.isMaximized()) }
  study.on('maximize', maximized)
  study.on('unmaximize', maximized)
  study.webContents.on('did-finish-load', maximized)
  study.on('closed', () => { if (studyWindow === study) { studyWindow = null; studyDeckId = null } })
  study.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  study.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'study')
    await study.loadURL(url.href)
  } else {
    await study.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'study' } })
  }
}

const chatgpt = new ChatGPTConnection()

const aiHistoryPath = (deckId: string | null) => join(app.getPath('userData'), 'ai-chats', `${createHash('sha256').update(deckId || 'global').digest('hex')}.json`)
const validateConversationKey = (deckId: unknown): string | null => {
  if (deckId === null) return null
  if (typeof deckId !== 'string' || !deckId || deckId.length > 100) throw new Error('Nieprawidłowy zestaw')
  return deckId
}

const safeAiCall = async <T,>(task: () => Promise<T>): Promise<T> => {
  try {
    return await task()
  } catch (error) {
    throw publicAiError(error)
  }
}

// A release is installed only after secondary windows acknowledge that local writes have finished.
// A timeout/cancel leaves the current app running instead of risking unsaved study answers.
const updateApprovals = new Map<number, { resolve: (ready: boolean) => void, timer: ReturnType<typeof setTimeout> }>()
const prepareWindowForUpdate = (window: BrowserWindow): Promise<boolean> => {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve(true)
  return new Promise(resolve => {
    const id = window.webContents.id
    const timer = setTimeout(() => {
      updateApprovals.delete(id)
      resolve(false)
    }, 10000)
    updateApprovals.set(id, { resolve, timer })
    window.webContents.send('updater:prepare')
  })
}

let installingUpdate = false
let allowUpdaterQuit = false

const registerIPC = () => {
  const assertMainWindow = (event: IpcMainInvokeEvent) => {
    if (!BrowserWindow.getAllWindows().some(window => window.webContents === event.sender && event.senderFrame === event.sender.mainFrame)) {
      throw new Error('Niedozwolone wywołanie IPC')
    }
  }
  ipcMain.on('updater:ready', (event, ready: unknown) => {
    const pending = updateApprovals.get(event.sender.id)
    if (!pending) return
    clearTimeout(pending.timer)
    updateApprovals.delete(event.sender.id)
    pending.resolve(ready === true)
  })
  ipcMain.handle('updater:state', event => { assertMainWindow(event); return getUpdateState() })
  ipcMain.handle('updater:check', event => { assertMainWindow(event); return checkForAppUpdates() })
  ipcMain.handle('updater:download', event => {
    assertMainWindow(event)
    if (event.sender !== mainWindow?.webContents) throw new Error('Aktualizację można pobrać w oknie głównym.')
    return downloadAppUpdate()
  })
  ipcMain.handle('updater:install', async event => {
    assertMainWindow(event)
    if (event.sender !== mainWindow?.webContents) throw new Error('Instalację można rozpocząć tylko z okna głównego.')
    if (installingUpdate) throw new Error('Instalacja już się rozpoczęła.')
    if (getUpdateState().phase !== 'downloaded') throw new Error('Aktualizacja nie jest jeszcze pobrana.')
    installingUpdate = true
    try {
      const secondaryWindows = [studyWindow, assistantWindow].filter((window): window is BrowserWindow => !!window && !window.isDestroyed())
      const ready = await Promise.all(secondaryWindows.map(prepareWindowForUpdate))
      if (ready.some(ack => !ack)) throw new Error('Nie udało się zapisać sesji w innym oknie. Zamknij dodatkowe okno i spróbuj ponownie.')
      await enqueue(async () => undefined)
      allowUpdaterQuit = true
      try { installAppUpdate() }
      catch (error) { allowUpdaterQuit = false; throw error }
    } finally {
      installingUpdate = false
    }
  })
  ipcMain.handle('ai:status', event => {
    assertMainWindow(event)
    return safeAiCall(() => chatgpt.status())
  })
  ipcMain.handle('ai:connect', async event => {
    assertMainWindow(event)
    const result = await safeAiCall(() => chatgpt.signIn(phase => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:auth-progress', phase)
    }))
    mainWindow?.webContents.send('ai:session-updated')
    return result
  })
  ipcMain.handle('ai:disconnect', async event => {
    assertMainWindow(event)
    const result = await safeAiCall(() => chatgpt.disconnect())
    mainWindow?.webContents.send('ai:session-updated')
    return result
  })
  ipcMain.handle('ai:models', event => {
    assertMainWindow(event)
    return safeAiCall(() => chatgpt.models())
  })
  ipcMain.handle('ai:usage', event => {
    assertMainWindow(event)
    return safeAiCall(() => shell.openExternal('https://chatgpt.com/settings/usage'))
  })
  ipcMain.handle('ai:send', (event, payload: unknown) => {
    assertMainWindow(event)
    return safeAiCall(async () => {
      const request = aiRequestSchema.parse(payload)
      return chatgpt.send(request, delta => {
        if (!event.sender.isDestroyed()) event.sender.send('ai:delta', request.id, delta)
      })
    })
  })
  ipcMain.handle('ai:history-load', async (event, deckId: unknown) => {
    assertMainWindow(event)
    const file = aiHistoryPath(validateConversationKey(deckId))
    try {
      const stats = await fs.stat(file)
      if (stats.size > 40_000_000) throw new Error('Historia rozmowy przekracza dopuszczalny rozmiar')
      return aiHistorySchema.parse(JSON.parse(await fs.readFile(file, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new Error('Nie udało się wczytać historii rozmowy. Plik nie został zmieniony.')
    }
  })
  ipcMain.handle('ai:history-save', (event, deckId: unknown, messages: unknown) => {
    assertMainWindow(event)
    const key = validateConversationKey(deckId)
    const validated = aiHistorySchema.parse(messages)
    if (JSON.stringify(validated).length > 40_000_000) throw new Error('Historia rozmowy jest zbyt duża')
    return enqueue(async () => {
      const file = aiHistoryPath(key)
      await fs.mkdir(join(app.getPath('userData'), 'ai-chats'), { recursive: true })
      await atomicWrite(file, validated)
    })
  })
  ipcMain.handle('ai:cancel', event => {
    assertMainWindow(event)
    chatgpt.cancel()
  })

  ipcMain.handle('ai:window-toggle', async (event, deckId: string | null, forceOpen: boolean) => {
    assertMainWindow(event)
    if (event.sender !== mainWindow?.webContents) throw new Error('Niedozwolone okno')
    if (deckId !== null && (typeof deckId !== 'string' || deckId.length > 100)) throw new Error('Nieprawidłowy zestaw')
    if (assistantWindow && !assistantWindow.isDestroyed() && !forceOpen) {
      assistantWindow.close()
      return false
    }
    const library = await enqueue(loadDatabase)
    if (!library.decks.length) throw new Error('Najpierw utwórz zestaw fiszek.')
    const activeDeckId = library.decks.some(item => item.id === deckId) ? deckId : library.decks[0].id
    if (assistantWindow && !assistantWindow.isDestroyed()) {
      assistantDeckId = activeDeckId
      assistantWindow.webContents.send('ai:window-context', activeDeckId)
      if (assistantWindow.isMinimized()) assistantWindow.restore()
      assistantWindow.focus()
      return true
    }
    await createAssistantWindow(activeDeckId)
    return true
  })
  ipcMain.handle('ai:window-info', async event => {
    assertMainWindow(event)
    if (event.sender !== assistantWindow?.webContents) throw new Error('Niedozwolone okno')
    return { deckId: assistantDeckId, data: await enqueue(loadDatabase) }
  })
  ipcMain.handle('ai:focus-deck', (event, deckId: string) => {
    assertMainWindow(event)
    if (event.sender !== assistantWindow?.webContents || typeof deckId !== 'string' || deckId.length > 100) throw new Error('Niedozwolona operacja')
    mainWindow?.webContents.send('ai:focus-deck', deckId)
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })
  ipcMain.handle('ai:save-cards', (event, payload: unknown) => {
    assertMainWindow(event)
    if (event.sender !== assistantWindow?.webContents) throw new Error('Niedozwolone okno')
    return enqueue(async () => {
      const request = z.object({
        deckId: z.string().min(1).max(100), model: z.string().max(140),
        cards: z.array(z.object({ front: z.string().min(1).max(12000), back: z.string().min(1).max(24000), kind: z.enum(['question','definition','cloze']) })).min(1).max(80)
      }).parse(payload)
      const data = await loadDatabase()
      if (!data.decks.some(deck => deck.id === request.deckId)) throw new Error('Wybrany zestaw nie istnieje')
      const time = new Date().toISOString()
      const cards = request.cards.map(item => ({
        id: crypto.randomUUID(), deckId: request.deckId, kind: item.kind,
        createdBy: 'ai' as const, needsReview: true, aiModel: request.model,
        front: contentToDoc(item.front), back: contentToDoc(item.back),
        createdAt: time, updatedAt: time, correct: 0, incorrect: 0, lastReviewedAt: null
      }))
      const next = validateLibrary({ ...data, cards: [...data.cards, ...cards] })
      await writeDatabase(next)
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:external-update')
      return cards.length
    })
  })

  ipcMain.handle('study:window-open', async (event, deckId: unknown, restart: unknown, continued: unknown) => {
    assertMainWindow(event)
    if (event.sender !== mainWindow?.webContents) throw new Error('Niedozwolone okno')
    if (typeof deckId !== 'string' || !deckId || deckId.length > 100 || typeof restart !== 'boolean') throw new Error('Nieprawidłowy zestaw')
    // The active in-app session can move to a new window without losing its flip, queue or history.
    const continuedSession = continued == null ? null : studySessionSchema.parse(continued)
    if (continuedSession && (continuedSession.deckId !== deckId || restart)) throw new Error('Nieprawidłowa przenoszona sesja')
    const deck = await enqueue(async () => {
      const data = await loadDatabase()
      const found = data.decks.find(item => item.id === deckId)
      if (!found) throw new Error('Zestaw nie istnieje')
      const cardIds = new Set(data.cards.filter(card => card.deckId === deckId).map(card => card.id))
      if (!cardIds.size) throw new Error('Zestaw nie zawiera fiszek')
      if (continuedSession && (continuedSession.queue.some(id => !cardIds.has(id)) || continuedSession.index > continuedSession.queue.length ||
        continuedSession.history?.some(grade => !cardIds.has(grade.cardId)))) throw new Error('Przenoszona sesja zawiera nieistniejące fiszki')
      if (studyWindow && !studyWindow.isDestroyed() && studyDeckId === deckId && !restart) return found
      const workspace = await loadWorkspace()
      const session = continuedSession || (!restart && resumableStudySession(workspace, deckId)) || startStudySession(data, deckId)
      await atomicWrite(getWorkspacePath(), {
        ...workspace,
        study: workspace.study?.deckId === deckId ? null : workspace.study,
        studySessions: { ...workspace.studySessions, [deckId]: session }
      })
      mainWindow?.webContents.send('study:session-updated', session)
      return found
    })
    if (studyWindow && !studyWindow.isDestroyed()) {
      if (studyDeckId === deckId && !restart) {
        if (studyWindow.isMinimized()) studyWindow.restore()
        studyWindow.focus()
        return
      }
      studyWindow.close()
    }
    await createStudyWindow(deckId, deck.name)
  })
  ipcMain.handle('study:window-close', async event => {
    assertMainWindow(event)
    if (event.sender !== mainWindow?.webContents) throw new Error('Niedozwolone okno')
    if (!studyWindow || studyWindow.isDestroyed() || !studyDeckId) return null
    const deckId = studyDeckId
    // Wait for previously queued window grades before handing the live session to the main view.
    const session = await enqueue(async () => {
      const workspace = await loadWorkspace()
      return workspace.studySessions?.[deckId] ?? null
    })
    studyWindow?.close()
    return session ? { deckId, session } : null
  })

  ipcMain.handle('study:window-info', event => {
    assertMainWindow(event)
    if (event.sender !== studyWindow?.webContents || !studyDeckId) throw new Error('Niedozwolone okno')
    const deckId = studyDeckId
    return enqueue(async () => {
      const data = await loadDatabase()
      const workspace = await loadWorkspace()
      const session = workspace.studySessions?.[deckId]
      if (!session || !data.decks.some(deck => deck.id === deckId)) throw new Error('Nie znaleziono sesji nauki')
      return { data, deckId, session }
    })
  })
  ipcMain.handle('study:window-save', (event, payload: unknown, restart: unknown) => {
    assertMainWindow(event)
    if (event.sender !== studyWindow?.webContents || !studyDeckId) throw new Error('Niedozwolone okno')
    const deckId = studyDeckId
    const next = studySessionSchema.parse(payload)
    if (next.deckId !== deckId) throw new Error('Nieprawidłowa sesja')
    return enqueue(async () => {
      const data = await loadDatabase()
      const workspace = await loadWorkspace()
      const before = workspace.studySessions?.[deckId]
      if (!before) throw new Error('Sesja nauki nie istnieje')
      const ids = new Set(data.cards.filter(card => card.deckId === deckId).map(card => card.id))
      if (next.queue.some(id => !ids.has(id))) throw new Error('Sesja zawiera nieistniejące fiszki')
      if (next.index > next.queue.length || next.history?.some(entry => !ids.has(entry.cardId))) throw new Error('Nieprawidłowy postęp sesji')
      const oldHistory = before.history || []
      const newHistory = next.history || []
      let updated = data
      if (restart === true) {
        if (next.index !== 0 || next.correctCount !== 0 || next.wrongCount !== 0 || newHistory.length !== 0) {
          throw new Error('Nieprawidłowy restart nauki')
        }
        // Restart resets session progress, not lifetime card grades.
      } else if (newHistory.length === oldHistory.length + 1) {
        const grade = newHistory.at(-1)!
        if (grade.cardId !== before.queue[before.index] || next.index !== before.index + 1 ||
            grade.previousIndex !== before.index || grade.previousCorrectCount !== before.correctCount || grade.previousWrongCount !== before.wrongCount ||
            next.correctCount !== before.correctCount + Number(grade.correct) || next.wrongCount !== before.wrongCount + Number(!grade.correct)) {
          throw new Error('Niespójna ocena fiszki')
        }
        updated = { ...data, cards: data.cards.map(card => card.id === grade.cardId ? {
          ...card, correct: card.correct + Number(grade.correct), incorrect: card.incorrect + Number(!grade.correct),
          lastReviewedAt: new Date().toISOString(), lastAnswerCorrect: grade.correct
        } : card) }
      } else if (newHistory.length === oldHistory.length - 1) {
        const undone = oldHistory.at(-1)!
        if (next.index !== undone.previousIndex || next.correctCount !== undone.previousCorrectCount || next.wrongCount !== undone.previousWrongCount) {
          throw new Error('Niespójne cofnięcie fiszki')
        }
        updated = { ...data, cards: data.cards.map(card => card.id === undone.cardId ? {
          ...card, correct: Math.max(0, card.correct - Number(undone.correct)),
          incorrect: Math.max(0, card.incorrect - Number(!undone.correct)),
          lastReviewedAt: undone.previousLastReviewedAt ?? null,
          lastAnswerCorrect: undone.previousLastAnswerCorrect ?? null
        } : card) }
      } else if (newHistory.length !== oldHistory.length && newHistory.length !== 0) {
        throw new Error('Nieprawidłowa zmiana historii sesji')
      }
      // Session restart resets only this session, never the lifetime card grades.
      if (updated !== data) await writeDatabase(validateLibrary(updated))
      await atomicWrite(getWorkspacePath(), {
        ...workspace, studySessions: { ...workspace.studySessions, [deckId]: next }
      })
      mainWindow?.webContents.send('study:session-updated', next)
      if (updated !== data) {
        mainWindow?.webContents.send('library:external-update')
        assistantWindow?.webContents.send('library:external-update')
      }
    })
  })

  ipcMain.handle('library:load', event => { assertMainWindow(event); return enqueue(loadDatabase) })

  ipcMain.handle('library:save', (event, payload: unknown) => { assertMainWindow(event); return enqueue(async () => {
    let data = validateLibrary(payload)
    // The main renderer may still hold a snapshot from before a grade in the
    // independent study window. Preserve authoritative grade fields while it is open.
    if (studyWindow && !studyWindow.isDestroyed() && studyDeckId) {
      const current = await loadDatabase()
      const latest = new Map(current.cards.filter(card => card.deckId === studyDeckId).map(card => [card.id, card]))
      data = { ...data, cards: data.cards.map(card => {
        const graded = latest.get(card.id)
        return graded ? { ...card, correct: graded.correct, incorrect: graded.incorrect,
          lastReviewedAt: graded.lastReviewedAt, lastAnswerCorrect: graded.lastAnswerCorrect } : card
      }) }
    }
    await writeDatabase(data)
    if (studyWindow && !studyWindow.isDestroyed() && studyDeckId && !data.decks.some(deck => deck.id === studyDeckId)) studyWindow.close()
    if (assistantWindow && !assistantWindow.isDestroyed()) assistantWindow.webContents.send('library:external-update')
  }) })

  ipcMain.handle('library:export', event => { assertMainWindow(event); return enqueue(async () => {
    const data = await loadDatabase()
    const result = await dialog.showSaveDialog({
      title: 'Eksportuj kopię zapasową', defaultPath: 'fiszki-kopia.json',
      filters: [{ name: 'Kopia zapasowa JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8')
    return true
  }) })

  ipcMain.handle('library:import', event => { assertMainWindow(event); return enqueue(async () => {
    const result = await dialog.showOpenDialog({
      title: 'Wybierz kopię zapasową', properties: ['openFile'],
      filters: [{ name: 'Kopia zapasowa JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const stats = await fs.stat(result.filePaths[0])
    if (stats.size > 150 * 1024 * 1024) throw new Error('Plik kopii przekracza 150 MB')
    const text = await fs.readFile(result.filePaths[0], 'utf8')
    const data = validateLibrary(JSON.parse(text))
    await writeDatabase(data)
    if (studyWindow && !studyWindow.isDestroyed()) studyWindow.close()
    if (assistantWindow && !assistantWindow.isDestroyed()) assistantWindow.webContents.send('library:external-update')
    return data
  }) })

  ipcMain.handle('library:show-folder', async event => { assertMainWindow(event)
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('workspace:load', event => { assertMainWindow(event); return enqueue(loadWorkspace) })
  ipcMain.handle('workspace:save', (event, payload: unknown) => { assertMainWindow(event); return enqueue(async () => {
    const state = workspaceSchema.parse(payload)
    if ([...(state.cardDrafts || []), ...(state.pendingCardDraft ? [state.pendingCardDraft] : [])].some(draft => !validateRichDoc(draft.front) || !validateRichDoc(draft.back))) throw new Error('Nieprawidłowa wersja robocza fiszki')
    // A main-window navigation/preferences change must not overwrite the active
    // independent study session with a stale workspace snapshot.
    const latest = studyWindow && !studyWindow.isDestroyed() && studyDeckId
      ? await loadWorkspace() : null
    const merged = latest && studyDeckId && latest.studySessions?.[studyDeckId]
      ? { ...state, studySessions: { ...state.studySessions, [studyDeckId]: latest.studySessions[studyDeckId] } }
      : state
    await atomicWrite(getWorkspacePath(), merged)
  }) })

  const senderWindow = (event: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)
  ipcMain.handle('window:minimize', event => { assertMainWindow(event); senderWindow(event)?.minimize() })
  ipcMain.handle('window:is-maximized', event => { assertMainWindow(event); return senderWindow(event)?.isMaximized() ?? false })
  ipcMain.handle('window:toggle-maximize', event => { assertMainWindow(event)
    const window = senderWindow(event)
    if (!window) return false
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return window.isMaximized()
  })
  ipcMain.handle('window:close', event => { assertMainWindow(event); senderWindow(event)?.close() })
}

const createWindow = async () => {
  const saved = await loadWindowState()
  const window = new BrowserWindow({
    width: saved?.width ?? 1440,
    height: saved?.height ?? 900,
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 940, minHeight: 650,
    frame: false,
    backgroundColor: '#10131c',
    icon: getIconPath(),
    title: 'Fiszki',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow = window
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; if (assistantWindow && !assistantWindow.isDestroyed()) assistantWindow.close(); if (studyWindow && !studyWindow.isDestroyed()) studyWindow.close() })

  const sendMaximized = () => {
    if (!window.isDestroyed()) window.webContents.send('window:maximized', window.isMaximized())
  }

  window.on('maximize', sendMaximized)
  window.on('unmaximize', sendMaximized)
  window.webContents.on('did-finish-load', sendMaximized)

  let closeAfterSave = false
  window.on('close', event => {
    if (closeAfterSave || allowUpdaterQuit) return
    event.preventDefault()
    const bounds = window.getNormalBounds()
    const state = { ...bounds, maximized: window.isMaximized() }

    void enqueue(() => atomicWrite(getWindowPath(), state)).finally(() => {
      closeAfterSave = true
      if (!window.isDestroyed()) window.close()
    })
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())

  if (saved?.maximized) window.maximize()

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Keep the previous user data directory when changing the displayed app name.
// Never move or delete an existing library while switching versions.
const currentDataDir = app.getPath('userData')
const priorDataDirs = ['Fiszki Studio', 'fiszki-studio'].map(name => join(app.getPath('appData'), name))
if (!existsSync(join(currentDataDir, 'fiszki.json'))) {
  const previous = priorDataDirs.find(directory => existsSync(join(directory, 'fiszki.json')))
  if (previous) app.setPath('userData', previous)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('studio.fiszki.desktop')
  registerIPC()
  void createWindow()
  initializeAppUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
