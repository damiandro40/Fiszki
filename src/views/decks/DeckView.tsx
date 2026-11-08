import { useEffect, useMemo, useState } from 'react'
import DebouncedSearchInput from '../../components/atoms/DebouncedSearchInput'
import { BookOpenText, ChevronRight, Copy, GraduationCap, Pencil, Plus, Sparkles, Trash2, FolderInput, PlayCircle, BadgeCheck, Sparkle } from 'lucide-react'
import type { Card, Deck, LibraryData, StudySession } from '../../types/model'
import { folderAncestors, textFromDoc } from '../../lib/tree'
import { getSessionSummary } from '../../lib/sessionSummary'
import Button from '../../components/atoms/Button'
import Dropdown from '../../components/Dropdown'
import { useContextMenu } from '../../components/ContextMenu'
import EmptyState from '../../components/EmptyState'
import RichContent from '../../features/editor/RichContent'
import Tooltip from '../../components/atoms/Tooltip'
import { RotateCcw } from 'lucide-react'

interface DeckViewProps {
  deck: Deck
  data: LibraryData
  onNew: () => void
  onEdit: (card: Card) => void
  onDelete: (card: Card) => void
  onDuplicate: (card: Card) => void
  onMove: (card: Card) => void
  onMarkReviewed: (card: Card) => void
  onStudy: () => void
  onRestartStudy: () => void
  savedSessionProgress?: { answered: number, total: number }
  session?: StudySession | null
  onFolder: (id: string | null) => void
}

const DeckView = ({ deck, data, onNew, onEdit, onDelete, onDuplicate, onMove, onMarkReviewed, onStudy, onRestartStudy, savedSessionProgress, session, onFolder }: DeckViewProps) => {
  const openContextMenu = useContextMenu()
  // Input keystrokes stay local to DebouncedSearchInput; only settled queries update this view.
  const [filter, setFilter] = useState('')
  const [onlyToReview, setOnlyToReview] = useState(false)
  const cards = useMemo(() => data.cards.filter(card => card.deckId === deck.id), [data.cards, deck.id])
  const pendingReview = useMemo(() => cards.filter(card => card.createdBy === 'ai' && card.needsReview).length, [cards])
  const summary = useMemo(() => getSessionSummary(cards, session), [cards, session])
  useEffect(() => { if (!pendingReview) setOnlyToReview(false) }, [pendingReview])
  const filtered = useMemo(() => cards.filter(card =>
    (!onlyToReview || (card.createdBy === 'ai' && card.needsReview)) &&
    `${textFromDoc(card.front)} ${textFromDoc(card.back)}`.toLocaleLowerCase('pl').includes(filter.trim().toLocaleLowerCase('pl'))
  ), [cards, onlyToReview, filter])

  const cardActions = (card: Card) => [
    { label: 'Edytuj fiszkę', icon: <Pencil size={16} />, onSelect: () => onEdit(card) },
    { label: 'Duplikuj', icon: <Copy size={16} />, onSelect: () => onDuplicate(card) },
    { label: 'Przenieś do zestawu', icon: <FolderInput size={16} />, onSelect: () => onMove(card) },
    ...(card.needsReview ? [{ label: 'Oznacz jako sprawdzoną', icon: <BadgeCheck size={16}/>, onSelect: () => onMarkReviewed(card) }] : []),
    { label: 'Usuń fiszkę', icon: <Trash2 size={16} />, onSelect: () => onDelete(card), destructive: true }
  ]

  const breadcrumbLink = 'rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--interactive-hover-bg)] hover:text-[var(--text)] active:bg-[var(--interactive-active-bg)] focus-visible:outline-offset-2'

  return <div className="mx-auto max-w-[1360px] px-12 pb-20 pt-10 max-[780px]:px-5">
    <nav className="mb-7 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--faint)]" aria-label="Ścieżka zestawu">
      <button type="button" className={breadcrumbLink} onClick={() => onFolder(null)}>Biblioteka</button>
      <ChevronRight size={14} aria-hidden="true" />
      {deck.folderId && folderAncestors(data, deck.folderId).map(folder => <span key={folder.id} className="inline-flex items-center gap-1.5">
        <button type="button" className={breadcrumbLink} onClick={() => onFolder(folder.id)}>{folder.name}</button>
        <ChevronRight size={14} aria-hidden="true" />
      </span>)}
      <span aria-current="page" className="rounded-md px-2 py-1.5 font-bold text-[var(--text)]">{deck.name}</span>
    </nav>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
      <div><div className="mb-2.5 text-[10px] font-extrabold tracking-[1.4px] text-[var(--accent-ink)]">ZESTAW FISZEK</div><h1 className="m-0 text-[clamp(26px,2.4vw,34px)] font-extrabold leading-[1.15] tracking-[-1.1px]">{deck.name}</h1></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5"><Button icon={<Plus size={18} />} onClick={onNew}>Dodaj fiszkę</Button><Button intent="solid" color="primary" icon={savedSessionProgress ? <PlayCircle size={19}/> : <GraduationCap size={19}/>} disabled={!cards.length} onClick={onStudy}>{savedSessionProgress ? 'Kontynuuj naukę' : 'Rozpocznij naukę'}</Button>{savedSessionProgress && <Button icon={<RotateCcw size={16}/>} onClick={onRestartStudy}>Zacznij od nowa</Button>}</div>
    </div>

    <div className="mb-9 flex flex-wrap items-center gap-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5 [&_strong]:block [&_strong]:text-[22px] [&_strong]:font-extrabold [&_span]:mt-1 [&_span]:block [&_span]:text-[11px] [&_span]:text-[var(--muted)]"><div className="grid size-[51px] shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)]"><BookOpenText size={23} /></div><div><strong>{cards.length}</strong><span>{cards.length === 1 ? 'Fiszka w zestawie' : 'Fiszek w zestawie'}</span></div><div className="mx-2 h-10 w-px bg-[var(--border)]" /><div><strong>{summary.correct}</strong><span>Poprawnych odpowiedzi</span></div><div className="mx-2 h-10 w-px bg-[var(--border)]" /><div><strong>{summary.toRepeat}</strong><span>Do powtórzenia</span></div></div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2_span]:ml-1 [&_h2_span]:text-xs [&_h2_span]:text-[var(--faint)]">
      <h2>{onlyToReview ? 'Stworzone przez AI:' : filter.trim() ? 'Wyniki wyszukiwania' : 'Wszystkie fiszki'} <span>{onlyToReview || filter.trim() ? filtered.length : cards.length}</span></h2>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5">
        {pendingReview > 0 && <button type="button" className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs transition-colors enabled:cursor-pointer ${onlyToReview ? 'border-[var(--selected-border)] bg-[var(--accent-soft)] text-[var(--accent-ink)] enabled:hover:bg-[var(--blue-soft)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]'}`} onClick={() => setOnlyToReview(previous => !previous)} aria-pressed={onlyToReview}><BadgeCheck size={15}/> Do weryfikacji ({pendingReview})</button>}
        <div className="w-[234px] max-w-full"><DebouncedSearchInput ariaLabel="Szukaj w zestawie" placeholder="Szukaj w tym zestawie..." onSearchChange={setFilter} /></div>
      </div>
    </div>
    {filtered.length ? <div className="flex flex-col gap-2.5">{filtered.map((card, index) => <article key={card.id} className="group relative flex min-h-[112px] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 transition-colors duration-150 hover:border-[var(--accent-ink)] max-[780px]:gap-2 max-[780px]:px-3" onContextMenu={event => openContextMenu(event, cardActions(card))}>
      <div className="pointer-events-none grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-2 gap-y-2 overflow-hidden">
        <span className="text-[11px] font-extrabold leading-4 tabular-nums text-[var(--faint)]">{String(index + 1).padStart(2, '0')}</span>
        <span className="text-[10px] font-extrabold leading-4 tracking-wider text-[var(--faint)]">PRZÓD</span>
        {card.createdBy === 'ai' && <span className={`pointer-events-auto relative z-20 col-start-1 row-start-2 inline-flex text-[var(--accent-ink)] ${card.needsReview ? 'opacity-100' : 'opacity-60'}`} aria-label={card.needsReview ? 'Wygenerowane przez AI · wymaga sprawdzenia' : 'Wygenerowane przez AI'}><Tooltip label="Wygenerowane przez AI"><Sparkle size={15} /></Tooltip></span>}
        <div className="col-start-2 row-start-2 min-w-0"><RichContent compact content={card.front} highlightQuery={filter} /></div>
      </div>
      <div className="w-px shrink-0 self-stretch bg-[var(--border-subtle)]" />
      <div className="pointer-events-none min-w-0 flex-1 overflow-hidden"><div className="mb-2 text-[10px] font-extrabold leading-4 tracking-wider text-[var(--faint)]">TYŁ</div><RichContent compact content={card.back} highlightQuery={filter} /></div>
      <div className="relative z-20 w-7 shrink-0"><Dropdown actions={cardActions(card)} /></div>
      <button className="absolute inset-0 z-10 rounded-[inherit] border-0 bg-transparent p-0 focus-visible:outline-offset-1" onClick={() => onEdit(card)} aria-label="Edytuj fiszkę" />
    </article>)}</div> : <EmptyState icon={<Sparkles size={29} />}
      title={cards.length ? 'Brak wyników' : 'Twój zestaw czeka na pierwszą fiszkę'}
      description={cards.length ? 'Zmień wyszukiwanie lub filtr weryfikacji.' : 'Dodaj pytanie i odpowiedź, używając bogatego edytora.'}
      actionLabel={cards.length ? undefined : 'Dodaj pierwszą fiszkę'} onAction={cards.length ? undefined : onNew} />}
  </div>
}

export default DeckView
