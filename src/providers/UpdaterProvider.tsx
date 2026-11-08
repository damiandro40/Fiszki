import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { UpdateState } from '../types/model'

interface UpdaterContextValue {
  status: UpdateState
  check: () => Promise<void>
  download: () => Promise<void>
}

const UpdaterContext = createContext<UpdaterContextValue | null>(null)
const initialStatus: UpdateState = { phase: 'idle', currentVersion: '—' }

export const useUpdater = () => {
  const context = useContext(UpdaterContext)
  if (!context) throw new Error('Brak UpdaterProvider')
  return context
}

const UpdaterProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<UpdateState>(initialStatus)

  useEffect(() => {
    let active = true
    const remove = window.flashcards.onUpdaterStatus(next => { if (active) setStatus(next) })
    void window.flashcards.updaterState().then(next => { if (active) setStatus(next) })
      .catch(() => { if (active) setStatus(previous => ({ ...previous, phase: 'error', error: 'Nie można odczytać stanu aktualizacji.' })) })
    return () => { active = false; remove() }
  }, [])

  const value = useMemo<UpdaterContextValue>(() => ({
    status,
    check: async () => { setStatus(await window.flashcards.updaterCheck()) },
    download: async () => { setStatus(await window.flashcards.updaterDownload()) }
  }), [status])

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>
}

export default UpdaterProvider
