import { app, screen } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { LibraryData, WorkspaceState } from '../../src/types/model'
import { createSeed } from '../../src/lib/seed'
import { windowStateSchema, workspaceSchema } from './schemas'
import { validateLibrary } from './validation'

export const getWorkspacePath = () => join(app.getPath('userData'), 'workspace.json')
export const getWindowPath = () => join(app.getPath('userData'), 'window.json')
export const initialWorkspace = (): WorkspaceState => ({ version: 1, selected: { type: 'home' }, study: null, lastEditedCardId: null })
export const atomicWrite = async (path: string, data: unknown) => {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  const temp = `${path}.tmp`
  await fs.writeFile(temp, JSON.stringify(data), 'utf8')
  await fs.rename(temp, path)
}

export const loadWorkspace = async (): Promise<WorkspaceState> => {
  try {
    return workspaceSchema.parse(JSON.parse(await fs.readFile(getWorkspacePath(), 'utf8'))) as WorkspaceState
  } catch {
    return initialWorkspace()
  }
}

export const loadWindowState = async () => {
  try {
    const saved = windowStateSchema.parse(JSON.parse(await fs.readFile(getWindowPath(), 'utf8')))
    const bounds = { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
    const visible = screen.getAllDisplays().some(display => {
      const area = display.workArea
      return bounds.x < area.x + area.width - 100 && bounds.x + bounds.width > area.x + 100 &&
        bounds.y < area.y + area.height - 100 && bounds.y + bounds.height > area.y + 100
    })
    return visible ? saved : null
  } catch {
    return null
  }
}

const getStoragePath = () => join(app.getPath('userData'), 'fiszki.json')
let library: LibraryData | null = null
let saveQueue: Promise<unknown> = Promise.resolve()

export const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
  const result = saveQueue.then(task, task)
  saveQueue = result.then(() => undefined, () => undefined)
  return result
}

export const writeDatabase = async (data: LibraryData) => {
  const destination = getStoragePath()
  const tempPath = `${destination}.tmp`
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(tempPath, JSON.stringify(data), 'utf8')
  await fs.rename(tempPath, destination)
  library = data
}

export const loadDatabase = async (): Promise<LibraryData> => {
  if (library) return library

  try {
    const content = await fs.readFile(getStoragePath(), 'utf8')
    library = validateLibrary(JSON.parse(content))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('Nie udało się odczytać fiszek. Oryginalny plik nie został nadpisany. Skorzystaj z opcji „Pokaż folder danych”.')
    }
    await writeDatabase(createSeed())
  }

  return library!
}

