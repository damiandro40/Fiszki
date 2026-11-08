import { useCallback, useEffect, useRef, useState } from 'react'
import type { LibraryData, StudySession } from '../../types/model'
import { useTheme } from '../../hooks/useTheme'
import { normalizeStudyKeys } from '../../lib/studyKeys'
import StudyView from './StudyView'
import Titlebar from '../../components/Titlebar'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import Button from '../../components/atoms/Button'

const StudyWindow = () => {
  const [data, setData] = useState<LibraryData | null>(null)
  const [deckId, setDeckId] = useState('')
  const [session, setSession] = useState<StudySession | null>(null)
  const [error, setError] = useState('')
  const sessionRef = useRef<StudySession | null>(null)
  const mounted = useRef(true)
  const latestSaveId = useRef(0)
  const lastSaveRef = useRef<Promise<void>>(Promise.resolve())
  useTheme(data?.preferences.theme ?? 'system')

  const refresh = useCallback(async () => {
    try {
      const info = await window.flashcards.studyWindowInfo()
      if (!mounted.current) return
      setData(info.data)
      setDeckId(info.deckId)
      sessionRef.current = info.session
      setSession(info.session)
      setError('')
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Nie udało się odczytać sesji')
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => { mounted.current = false }
  }, [refresh])

  useEffect(() => window.flashcards.onUpdaterPrepare(async () => {
    await lastSaveRef.current
    if (sessionRef.current) await window.flashcards.studyWindowSave(sessionRef.current)
  }), [])

  const saveSession = (next: StudySession, action?: 'restart') => {
    const before = sessionRef.current
    sessionRef.current = next
    setSession(next)
    const oldHistory = before?.history || []
    const newHistory = next.history || []
    if (action !== 'restart' && newHistory.length === oldHistory.length + 1) {
      const grade = newHistory.at(-1)!
      setData(current => current && ({ ...current, cards: current.cards.map(card => card.id === grade.cardId ? {
        ...card, correct: card.correct + Number(grade.correct), incorrect: card.incorrect + Number(!grade.correct),
        lastAnswerCorrect: grade.correct, lastReviewedAt: new Date().toISOString()
      } : card) }))
    } else if (action !== 'restart' && newHistory.length === oldHistory.length - 1) {
      const undone = oldHistory.at(-1)!
      setData(current => current && ({ ...current, cards: current.cards.map(card => card.id === undone.cardId ? {
        ...card, correct: Math.max(0, card.correct - Number(undone.correct)),
        incorrect: Math.max(0, card.incorrect - Number(!undone.correct)),
        lastAnswerCorrect: undone.previousLastAnswerCorrect ?? null,
        lastReviewedAt: undone.previousLastReviewedAt ?? null
      } : card) }))
    }
    const saveId = ++latestSaveId.current
    const task = window.flashcards.studyWindowSave(next, action === 'restart')
    lastSaveRef.current = task
    void task.catch(cause => {
      if (!mounted.current || saveId !== latestSaveId.current) return
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać sesji')
      // Read the authoritative persisted state. Never silently continue from an unsaved grade.
      void refresh()
    })
  }

  const deck = data?.decks.find(item => item.id === deckId)
  return <div className="study-window flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-[var(--bg)]">
    <Titlebar title="Fiszki" subtitle={deck?.name} closeLabel="Zamknij okno nauki"/>
    {error && <div className="flex shrink-0 items-center gap-2 border-b border-[var(--danger-border)] bg-[var(--red-soft)] px-5 py-3 text-xs text-[var(--red)]" role="alert"><AlertCircle size={16}/><span className="flex-1">{error}</span><Button size="sm" color="danger" intent="ghost" onClick={() => void refresh()}>Ponów</Button></div>}
    <main className="min-h-0 flex-1 overflow-y-auto">
      {data && deck && session ? <StudyView key={deckId} standalone deck={deck}
        cards={data.cards.filter(card => card.deckId === deckId)}
        shuffle={data.preferences.shuffle} keymap={normalizeStudyKeys(data.preferences.studyKeys)}
        session={session} onSessionChange={saveSession} onExit={() => void window.flashcards.closeWindow()}
        onAnswer={() => { /* the authoritative process commits the grade with the session */ }}
        onUndo={() => { /* the authoritative process restores the previous grade */ }}/>
        : <div className="flex h-full items-center justify-center gap-3 text-xs text-[var(--muted)]" role="status"><LoaderCircle size={19} className="spinning"/> Wczytywanie nauki…</div>}
    </main>
  </div>
}

export default StudyWindow
