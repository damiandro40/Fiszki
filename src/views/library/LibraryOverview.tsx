import { useMemo } from 'react'
import { BookCopy, BookOpenText, ChevronRight, FolderClosed, Sparkles } from 'lucide-react'
import type { LibraryData, Deck, Folder } from '../../types/model'
import { getLibraryCounts, folderAncestors } from '../../lib/tree'
import { polishCount } from '../../lib/plural'
import Dropdown from '../../components/Dropdown'
import LibraryTile from '../../components/LibraryTile'
import LibraryMetric from '../../components/LibraryMetric'
import { useContextMenu } from '../../components/ContextMenu'
import EmptyState from '../../components/EmptyState'
import type { ItemAction, Selection } from '../../features/library/Sidebar'
import { folderMenuActions, deckMenuActions } from '../../features/library/itemMenus'

interface LibraryOverviewProps {
  data: LibraryData
  folderId: string | null
  onSelect: (item: Selection) => void
  onAddFolder: (parentId: string | null) => void
  onAddDeck: (folderId: string | null) => void
  onAction: (kind: 'folder' | 'deck', id: string, action: ItemAction) => void
  onStudy: (deckId: string) => void
  hasStudyProgress: (deckId: string) => boolean
}

const LibraryOverview = ({ data, folderId, onSelect, onAddFolder, onAddDeck, onAction, onStudy, hasStudyProgress }: LibraryOverviewProps) => {
  const openContextMenu = useContextMenu()
  const counts = useMemo(() => getLibraryCounts(data), [data.folders, data.decks, data.cards])
  const isHome = folderId === null
  const folder = data.folders.find(item => item.id === folderId)
  const folders = data.folders.filter(item => item.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  const decks = data.decks.filter(item => item.folderId === folderId).sort((a, b) => a.name.localeCompare(b.name, 'pl'))

  const folderActions = (item: Folder) => folderMenuActions(item, { onAddFolder, onAddDeck, onAction })
  const deckActions = (item: Deck) => deckMenuActions(item, { onAction, onStudy: () => onStudy(item.id), canResume: hasStudyProgress(item.id), hasCards: (counts.decks.get(item.id) || 0) > 0 })
  const emptyAreaActions = [
    { label: 'Nowy folder w:', contextValue: folder?.name || 'Biblioteka', icon: <FolderClosed size={16}/>, onSelect: () => onAddFolder(folderId) },
    { label: 'Nowy zestaw w:', contextValue: folder?.name || 'Biblioteka', icon: <BookOpenText size={16}/>, onSelect: () => onAddDeck(folderId) }
  ]

  const folderTile = (item: Folder) => <LibraryTile key={item.id} kind="folder" name={item.name}
    detail={polishCount(counts.folders.get(item.id) || 0, 'zestaw', 'zestawy', 'zestawów')}
    icon={<FolderClosed size={23}/>} actions={folderActions(item)}
    onOpen={() => onSelect({ type: 'folder', id: item.id })}
    onContextMenu={event => openContextMenu(event, folderActions(item))}/>

  const deckTile = (item: Deck) => <LibraryTile key={item.id} kind="deck" name={item.name}
    detail={polishCount(counts.decks.get(item.id) || 0, 'fiszka', 'fiszki', 'fiszek')}
    icon={<BookOpenText size={23}/>} actions={deckActions(item)}
    onOpen={() => onSelect({ type: 'deck', id: item.id })}
    onContextMenu={event => openContextMenu(event, deckActions(item))}/>

  const breadcrumbLink = 'rounded-md px-2 py-1.5 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--interactive-hover-bg)] hover:text-[var(--text)] active:bg-[var(--interactive-active-bg)] focus-visible:outline-offset-2'

  return <div className="library-overview-page mx-auto flex min-h-full max-w-[1360px] flex-col px-12 pb-20 pt-10 max-[780px]:px-5" onContextMenu={event => {
    const target = event.target as HTMLElement
    if (target.closest('button, a, .library-tile, .breadcrumbs, .page-heading-row, .page-eyebrow, .stats-grid, .section-label, .empty-state, input, textarea, select, [role="menu"], [role="button"]')) return
    openContextMenu(event, emptyAreaActions)
  }}>
    {!isHome && <nav className="mb-7 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--faint)]" aria-label="Ścieżka folderu">
      <button type="button" className={breadcrumbLink} onClick={() => onSelect({ type: 'home' })}>Biblioteka</button>
      <ChevronRight size={14} aria-hidden="true" />
      {folderAncestors(data, folderId).map((ancestor, index, list) => <span key={ancestor.id} className="inline-flex items-center gap-1.5">
        {index === list.length - 1
          ? <span aria-current="page" className="rounded-md px-2 py-1.5 font-bold text-[var(--text)]">{ancestor.name}</span>
          : <><button type="button" className={breadcrumbLink} onClick={() => onSelect({ type: 'folder', id: ancestor.id })}>{ancestor.name}</button><ChevronRight size={14} aria-hidden="true" /></>}
      </span>)}
    </nav>}
    <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
      <div>{!isHome && <div className="mb-2.5 text-[10px] font-extrabold tracking-[1.4px] text-[var(--accent-ink)]">FOLDER</div>}<h1 className="m-0 text-[clamp(26px,2.4vw,34px)] font-extrabold leading-[1.15] tracking-[-1.1px]">{isHome ? 'Moja biblioteka' : folder?.name || 'Folder'}</h1>{!isHome && <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5" aria-label={`${folders.length} folderów`}><FolderClosed size={16} strokeWidth={2.5} className="shrink-0 text-[var(--accent-ink)]" aria-hidden="true"/><strong className="font-semibold tabular-nums">{folders.length}</strong></span>
        <span className="inline-flex items-center gap-1.5" aria-label={`${decks.length} zestawów`}><BookOpenText size={16} strokeWidth={2.5} className="shrink-0 text-[var(--accent-ink)]" aria-hidden="true"/><strong className="font-semibold tabular-nums">{decks.length}</strong></span>
      </div>}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5"><Dropdown trigger="add" label="Utwórz folder lub zestaw" actions={[
        { label: 'Nowy folder w:', contextValue: folder?.name || 'Biblioteka', icon: <FolderClosed size={16}/>, onSelect: () => onAddFolder(folderId) },
        { label: 'Nowy zestaw w:', contextValue: folder?.name || 'Biblioteka', icon: <BookOpenText size={16}/>, onSelect: () => onAddDeck(folderId) }
      ]} /></div>
    </div>
    {isHome && <section className="stats-grid mb-8 grid w-full grid-cols-2 divide-x divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] max-[460px]:grid-cols-1 max-[460px]:divide-x-0 max-[460px]:divide-y" aria-label="Podsumowanie biblioteki">
      <LibraryMetric tone="purple" icon={<BookCopy size={20}/>} value={data.cards.length} label="Wszystkich fiszek"/>
      <LibraryMetric tone="blue" icon={<BookOpenText size={19}/>} value={data.decks.length} label="Wszystkich zestawów"/>
    </section>}
    {(folders.length > 0 || decks.length > 0) && <section className="mt-4 flex-1"><div className="grid grid-cols-[repeat(auto-fill,minmax(min(275px,100%),1fr))] gap-3.5">{folders.map(folderTile)}{decks.map(deckTile)}</div></section>}
    {!folders.length && !decks.length && <EmptyState icon={<Sparkles size={30} />} title="Tutaj zaczyna się nauka" description="Dodaj folder, by uporządkować materiały, lub utwórz pierwszy zestaw fiszek." actionLabel="Utwórz zestaw" onAction={() => onAddDeck(folderId)} />}
  </div>
}

export default LibraryOverview
