import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { BookOpenText, CornerDownLeft, FileText, FolderClosed, Search } from 'lucide-react'
import type { Card, LibraryData, LibrarySelection } from '../../types/model'
import { searchLibrary } from '../../lib/search'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import type { SearchResult } from '../../lib/search'
import Modal from '../../components/Modal'
import HighlightedText from '../../components/atoms/HighlightedText'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'

interface SearchDialogProps {
  data: LibraryData
  onClose: () => void
  onSelect: (selection: LibrarySelection) => void
  onEditCard: (card: Card) => void
}

const SearchDialog = ({ data, onClose, onSelect, onEditCard }: SearchDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const settledQuery = useDebouncedValue(query, 180)
  const results = useMemo(() => searchLibrary(data, settledQuery), [data, settledQuery])
  const groups = [
    { kind: 'folder', title: 'Foldery', Icon: FolderClosed },
    { kind: 'deck', title: 'Zestawy', Icon: BookOpenText },
    { kind: 'card', title: 'Fiszki', Icon: FileText }
  ] as const

  useEffect(() => { setActiveIndex(0) }, [settledQuery])
  useEffect(() => { const id = requestAnimationFrame(() => inputRef.current?.focus()); return () => cancelAnimationFrame(id) }, [])

  const choose = (result: SearchResult) => {
    onClose()
    if (result.kind === 'card') {
      onSelect({ type: 'deck', id: result.card.deckId })
      onEditCard(result.card)
    } else {
      onSelect(result.kind === 'deck' ? { type: 'deck', id: result.id } : { type: 'folder', id: result.id })
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setActiveIndex(previous => (previous + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setActiveIndex(previous => (previous - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      // Enter immediately after typing should use the current input, not stale debounced results.
      const currentResults = settledQuery === query ? results : searchLibrary(data, query)
      const result = currentResults[settledQuery === query ? activeIndex : 0]
      if (!result) return
      event.preventDefault()
      choose(result)
    }
  }

  return <Modal title="Wyszukiwanie" onClose={onClose} wide>
    <div className="flex min-h-[280px] flex-col gap-1 px-5 pb-4 pt-4" data-study-shortcuts-block>
      <Input ref={inputRef} size="lg" containerClassName="rounded-xl" icon={<Search size={21}/>}
        autoFocus data-initial-focus type="search" value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={handleKeyDown} placeholder="Szukaj folderów, zestawów i fiszek…"
        aria-label="Szukaj w bibliotece" aria-controls="search-dialog-results"/>
      {settledQuery.trim() && <div className="mt-2 px-1 text-[11px] text-[var(--muted)]">{results.length === 60 ? 'Co najmniej 60' : results.length} wyników</div>}
      <div className="mt-3 min-h-0 overflow-y-auto" id="search-dialog-results">
        {groups.map(group => {
          const items = results.map((result, index) => ({ result, index })).filter(({ result }) => result.kind === group.kind)
          if (!items.length) return null
          return <section key={group.kind} className="mb-3" aria-label={group.title}>
            <div className="mb-1 flex items-center justify-between px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--faint)] [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5"><span><group.Icon size={14}/>{group.title}</span><span className="text-[var(--muted)]">{items.length}</span></div>
            {items.map(({ result, index }) => <Button key={`${result.kind}-${result.id}`} layout="row" intent="ghost" selected={activeIndex === index} className="gap-3 rounded-lg px-3 py-2.5 text-xs" icon={<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-3)] text-[var(--muted)]">{result.kind === 'card' ? <FileText size={17}/> : result.kind === 'folder' ? <FolderClosed size={17}/> : <BookOpenText size={17}/>}</span>} onClick={() => choose(result)} onMouseEnter={() => setActiveIndex(index)}>
              <span className="flex min-w-0 flex-1 flex-col gap-1 [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-bold [&_small]:truncate [&_small]:text-[11px] [&_small]:text-[var(--muted)]"><strong><HighlightedText text={result.title} query={settledQuery}/></strong><small><HighlightedText text={result.detail} query={settledQuery}/></small></span>
              <span className="max-w-[180px] truncate text-right text-[10px] text-[var(--faint)] max-[700px]:hidden"><HighlightedText text={result.location} query={settledQuery}/></span>
              {activeIndex === index && <CornerDownLeft className="shrink-0 text-[var(--accent-ink)]" size={15}/>}
            </Button>)}
          </section>
        })}
        {settledQuery.trim() && results.length === 0 && <div className="px-4 py-10 text-center text-xs text-[var(--muted)]">Nie znaleziono pasujących fiszek ani folderów.</div>}
        {!settledQuery.trim() && <div className="px-4 py-10 text-center text-xs text-[var(--muted)]">Tutaj pojawią się wyniki wyszukiwania.</div>}
      </div>
    </div>
  </Modal>
}

export default SearchDialog
