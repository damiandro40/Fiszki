import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryData } from '../types/model'
import { describeLocalError } from '../lib/uiErrors'

type SaveStatus = 'saved' | 'saving' | 'error'

export const useLibrary = () => {
  const [data, setData] = useState<LibraryData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const dataRef = useRef<LibraryData | null>(null)
  const errorRef = useRef<string | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const mountedRef = useRef(false)
  const loadIdRef = useRef(0)
  const saveIdRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++loadIdRef.current
    if (mountedRef.current) setLoadError(null)
    try {
      const result = await window.flashcards.load()
      if (!mountedRef.current || id !== loadIdRef.current) return
      dataRef.current = result
      setData(result)
    } catch (error) {
      if (mountedRef.current && id === loadIdRef.current) setLoadError(describeLocalError(error))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => { mountedRef.current = false; loadIdRef.current++ }
  }, [load])

  const enqueueSave = useCallback((next: LibraryData) => {
    const id = ++saveIdRef.current
    setSaveStatus('saving')
    setSaveError(null)
    errorRef.current = null

    // Send the IPC immediately. The main process serializes and atomically writes
    // requests in arrival order, including when Electron begins to close.
    const operation = window.flashcards.save(next)
    const tracked = operation.then(() => {
      if (id === saveIdRef.current) {
        if (!mountedRef.current) { errorRef.current = null; return }
        setSaveStatus('saved')
        setSaveError(null)
        errorRef.current = null
      }
    }, error => {
      const message = describeLocalError(error)
      if (id !== saveIdRef.current) return
      errorRef.current = message
      if (mountedRef.current) { setSaveStatus('error'); setSaveError(message) }
    })
    queueRef.current = Promise.all([queueRef.current, tracked]).then(() => undefined)
  }, [])

  const commit = useCallback((change: (current: LibraryData) => LibraryData) => {
    if (!dataRef.current) return
    const next = change(dataRef.current)
    if (next === dataRef.current) return
    dataRef.current = next
    setData(next)
    enqueueSave(next)
  }, [enqueueSave])

  const flush = useCallback(async () => {
    await queueRef.current
    if (errorRef.current) throw new Error(errorRef.current)
  }, [])

  const replace = useCallback((next: LibraryData) => {
    dataRef.current = next
    setData(next)
    setSaveStatus('saved')
    setSaveError(null)
    errorRef.current = null
  }, [])

  const retrySave = useCallback(() => {
    if (!dataRef.current) return
    enqueueSave(dataRef.current)
  }, [enqueueSave])

  return { data, loadError, load, saveStatus, saveError, commit, flush, replace, retrySave }
}
