import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, CornerUpLeft, Shuffle, Sparkles, X } from 'lucide-react'
import type { Card, Deck, StudySession } from '../../types/model'
import { shuffled } from '../../lib/tree'
import Button from '../../components/atoms/Button'
import RichContent from '../../features/editor/RichContent'
import { getStudyProgress } from '../../lib/studyProgress'
import { displayStudyKey } from '../../lib/studyKeys'
import type { StudyKeymap } from '../../lib/studyKeys'

interface StudyViewProps {
  deck: Deck
  cards: Card[]
  shuffle: boolean
  standalone?: boolean
  keymap: StudyKeymap
  session: StudySession
  onSessionChange: (next: StudySession, action?: 'restart') => void
  onExit: () => void
  onAnswer: (id: string, correct: boolean) => void
  onUndo: (id: string, correct: boolean, lastReviewedAt: string | null, previousGrade?: boolean | null) => void
}

type Flight = {
  rect: { left: number, top: number, width: number, height: number }
  x: number
  to?: number
}

const StudyView = ({ deck, cards, shuffle, standalone = false, keymap, session, onSessionChange, onExit, onAnswer, onUndo }: StudyViewProps) => {
  const { queue, index, flipped } = session
  const [flight, setFlight] = useState<Flight | null>(null)
  const [departure, setDeparture] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLButtonElement>(null)
  const pointer = useRef<{ id: number, start: number } | null>(null)
  const lastDrag = useRef(0)
  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationFrames = useRef<number[]>([])
  const departureLock = useRef(false)

  useEffect(() => () => {
    if (departureTimer.current) clearTimeout(departureTimer.current)
    animationFrames.current.forEach(cancelAnimationFrame)
  }, [])

  const cardsById = useMemo(() => new Map(cards.map(item => [item.id, item] as const)), [cards])
  const currentId = queue[index]
  const card = cardsById.get(currentId)
  const done = !currentId || !card
  const history = session.history || []

  const flip = () => {
    if (!done && !departureLock.current && !pointer.current && Date.now() - lastDrag.current > 350) {
      onSessionChange({ ...session, flipped: !session.flipped })
    }
  }

  const cardBounds = () => {
    const rect = cardRef.current?.getBoundingClientRect()
    return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
  }

  const answer = (correct: boolean) => {
    if (!card || departureLock.current) return
    departureLock.current = true
    const previousSession = session
    const answerId = card.id
    const previousLastReviewedAt = card.lastReviewedAt
    const finish = () => {
      animationFrames.current.forEach(cancelAnimationFrame)
      animationFrames.current = []
      pointer.current = null
      onAnswer(answerId, correct)
      onSessionChange({
        ...previousSession,
        queue: correct ? previousSession.queue : [...previousSession.queue, answerId],
        index: previousSession.index + 1,
        flipped: false,
        correctCount: previousSession.correctCount + Number(correct),
        wrongCount: previousSession.wrongCount + Number(!correct),
        history: [...(previousSession.history || []), {
          cardId: answerId, correct,
          previousIndex: previousSession.index, previousFlipped: previousSession.flipped,
          previousCorrectCount: previousSession.correctCount, previousWrongCount: previousSession.wrongCount,
          previousLastReviewedAt, previousLastAnswerCorrect: card.lastAnswerCorrect ?? null
        }]
      })
      setFlight(null)
      setDeparture(null)
      departureTimer.current = null
      departureLock.current = false
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }

    const rect = flight?.rect || cardBounds()
    if (!rect) { finish(); return }
    const startX = flight?.x || 0
    // Fixed viewport overlay: never clipped by the study area or its scroll container.
    // The destination is beyond the actual window edge, not the central card column.
    const endX = correct ? window.innerWidth - rect.left + 40 : -(rect.left + rect.width + 40)
    setFlight({ rect, x: startX })
    setDeparture(correct ? 'right' : 'left')
    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => setFlight(previous => previous ? { ...previous, to: endX } : null))
      animationFrames.current.push(secondFrame)
    })
    animationFrames.current.push(firstFrame)
    departureTimer.current = setTimeout(finish, 400)
  }

  const undo = () => {
    if (departureLock.current || !history.length) return
    const previous = history.at(-1)!
    onUndo(previous.cardId, previous.correct, previous.previousLastReviewedAt ?? null, previous.previousLastAnswerCorrect)
    onSessionChange({
      ...session,
      queue: previous.correct ? session.queue : session.queue.slice(0, -1),
      index: previous.previousIndex,
      // Undo always returns to the question, regardless of the earlier face.
      flipped: false,
      correctCount: previous.previousCorrectCount, wrongCount: previous.previousWrongCount,
      history: history.slice(0, -1)
    })
    setFlight(null)
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('[data-study-shortcuts-block]'))) ||
        document.querySelector('[role="dialog"]')) return
      if (event.code === keymap.undo) { event.preventDefault(); undo() }
      else if (event.code === keymap.flip) { event.preventDefault(); flip() }
      else if (event.code === keymap.again) { event.preventDefault(); answer(false) }
      else if (event.code === keymap.known) { event.preventDefault(); answer(true) }
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [session, card, keymap, onExit, onAnswer, onUndo, onSessionChange, departure, flight])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (done || departureLock.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointer.current = { id: event.pointerId, start: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const distance = event.clientX - pointer.current.start
    if (Math.abs(distance) < 6 && !flight) return
    lastDrag.current = Date.now()
    const rect = flight?.rect || cardBounds()
    if (rect) setFlight({ rect, x: distance })
  }
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const distance = event.clientX - pointer.current.start
    pointer.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    // Require deliberate travel, proportional to the visible card's width.
    const width = cardRef.current?.getBoundingClientRect().width ?? 500
    const acceptanceThreshold = Math.min(175, Math.max(130, width * 0.28))
    if (Math.abs(distance) >= acceptanceThreshold) { lastDrag.current = Date.now(); answer(distance > 0) }
    else if (!departureLock.current) { if (Math.abs(distance) >= 6) lastDrag.current = Date.now(); setFlight(null) }
  }

  const progress = useMemo(() => getStudyProgress(session),
    [session.queue, session.history, session.index, session.correctCount, session.wrongCount])
  const dragX = flight?.to ?? flight?.x ?? 0
  const dragTone = Math.min(Math.max((Math.abs(dragX) - 34) / 230, 0), 1)
  const dragColors = {
    '--drag-color': dragX > 0 ? 'var(--green-soft)' : 'var(--red-soft)',
    '--drag-border': dragX > 0 ? 'var(--green)' : 'var(--red)',
    '--drag-weight': `${Math.round(dragTone * 54)}%`
  } as CSSProperties

  const renderCardFaces = () => <div className="study-card-inner">
    <div className="study-card-face study-card-front" aria-hidden={flipped}>
      <span className="study-card-eyebrow">PYTANIE</span>
      <span className="study-card-content"><RichContent content={card!.front}/></span>
    </div>
    <div className="study-card-face study-card-back" aria-hidden={!flipped}>
      <span className="study-card-eyebrow">ODPOWIEDŹ</span>
      <span className="study-card-content"><RichContent content={card!.back}/></span>
    </div>
  </div>

  const restart = () => onSessionChange({
    deckId: deck.id,
    queue: shuffle ? shuffled(cards.map(item => item.id)) : cards.map(item => item.id),
    index: 0, correctCount: 0, wrongCount: 0, flipped: false, history: []
  }, 'restart')
  const undoControl = <Button size="md" disabled={!history.length || !!departure} icon={<CornerUpLeft size={17} />} onClick={undo}>
    Cofnij <kbd>{displayStudyKey(keymap.undo)}</kbd>
  </Button>

  return <div className="study-page">
    {!standalone && <div className="study-topbar"><button className="back-button" onClick={onExit}><ArrowLeft size={18} /> Wróć do zestawu</button><div className="study-deck-title">{deck.name}</div><div className="study-topbar-count">{Math.min(index + 1, queue.length)} / {queue.length}</div></div>}
    {!done ? <div className="study-container">
      <div className="study-progress">
        <div className="study-progress-label"><span>Postęp sesji</span><strong>{progress.progress}%</strong></div>
        <div className="progress-track study-progress-segments" role="progressbar" aria-label="Postęp nauki" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progress}>
          <div className="progress-segment progress-correct" style={{ width: `${progress.correct}%` }}/>
          <div className="progress-segment progress-wrong" style={{ width: `${progress.wrong}%` }}/>
        </div>
        <div className="study-progress-legend"><span className="study-legend-correct"><i/> Umiem <strong>{progress.correctCount}</strong></span><span className="study-legend-wrong"><i/> Nie umiem <strong>{progress.wrongCount}</strong></span><span className="study-legend-pending"><i/> Pozostało <strong>{progress.pending}</strong></span></div>
      </div>
      <button ref={cardRef} key={card!.id} type="button" className={`study-card ${flipped ? 'is-flipped' : ''} ${flight ? 'is-flight-source' : ''}`}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointer.current = null; if (!departureLock.current) setFlight(null) }}
        onClick={flip} aria-disabled={departure !== null} aria-label={flipped ? 'Pokaż pytanie' : 'Pokaż odpowiedź'}>
        {renderCardFaces()}
      </button>
      {flight && createPortal(<button type="button" aria-hidden="true" tabIndex={-1}
        className={`study-card study-flight-ghost ${flipped ? 'is-flipped' : ''}`}
        style={{ ...dragColors, left: flight.rect.left, top: flight.rect.top, width: flight.rect.width, height: flight.rect.height,
          transform: `translateX(${flight.to ?? flight.x}px) rotate(${Math.max(-16, Math.min(16, (flight.to ?? flight.x) / 28))}deg)`,
          transition: flight.to === undefined ? 'none' : 'transform 350ms cubic-bezier(.2,.7,.25,1), opacity 90ms linear 260ms',
          opacity: flight.to === undefined ? 1 : 0 }}>
        {renderCardFaces()}
      </button>, document.body)}
      <div className="study-rating">
        {undoControl}
        <Button disabled={!!departure} className="rating-wrong" icon={<X size={19} />} onClick={() => answer(false)}>Nie umiem <kbd>{displayStudyKey(keymap.again)}</kbd></Button>
        <Button disabled={!!departure} className="rating-correct" icon={<Check size={20} />} onClick={() => answer(true)}>Umiem <kbd>{displayStudyKey(keymap.known)}</kbd></Button>
      </div>
      <div className="study-keyboard-hint" aria-label="Skróty nauki">
        <span><kbd>{displayStudyKey(keymap.flip)}</kbd> Obróć fiszkę</span>
        <span><kbd>{displayStudyKey(keymap.again)}</kbd> Nie umiem</span>
        <span><kbd>{displayStudyKey(keymap.known)}</kbd> Umiem</span>
        <span><kbd>{displayStudyKey(keymap.undo)}</kbd> Cofnij</span>
      </div>
      {standalone && <div className="mt-4 text-center text-[11px] font-semibold tabular-nums text-[var(--muted)]" aria-label="Numer bieżącej fiszki">Fiszka {Math.min(index + 1, queue.length)} z {queue.length}</div>}
    </div> : <div className="study-finished"><div className="finished-icon"><Sparkles size={38} /></div><h1>Sesja ukończona!</h1><p>Wynik został zachowany. Możesz wrócić do zestawu lub rozpocząć nową powtórkę.</p><div className="finish-stats"><div><strong>{progress.correctCount}</strong><span>Opanowane fiszki</span></div><div><strong>{progress.wrongCount}</strong><span>Do powtórzenia</span></div></div><div className="finish-buttons">{undoControl}<Button icon={<ArrowLeft size={17} />} onClick={onExit}>{standalone ? 'Zamknij okno' : 'Powrót do zestawu'}</Button><Button intent="solid" color="primary" icon={<Shuffle size={17} />} onClick={restart}>Ucz się ponownie</Button></div></div>}
  </div>
}

export default StudyView
