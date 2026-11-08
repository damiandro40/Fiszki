import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BookOpenText, BookPlus, ChevronDown, ChevronRight, FolderClosed, FolderOpen,
  FolderPlus, Library, Settings, Sparkles
} from 'lucide-react'
import type { LibraryData, LibrarySelection } from '../../types/model'
import { getLibraryCounts } from '../../lib/tree'
import Button from '../../components/atoms/Button'
import Dropdown from '../../components/Dropdown'
import { useContextMenu } from '../../components/ContextMenu'
import { folderMenuActions, deckMenuActions } from './itemMenus'

export type Selection = LibrarySelection
export type ItemAction = 'rename' | 'move' | 'delete'

interface SidebarProps {
  data: LibraryData
  selected: Selection
  onSelect: (item: Selection) => void
  onAddFolder: (parentId: string | null) => void
  onAddDeck: (folderId: string | null) => void
  onAction: (kind: 'folder' | 'deck', id: string, action: ItemAction) => void
  onStudy: (deckId: string) => void
  hasStudyProgress: (deckId: string) => boolean
  onSettings: () => void
  aiActive: boolean
  onAI: () => void
}

const Sidebar = ({ data, selected, onSelect, onAddFolder, onAddDeck, onAction, onSettings, onStudy, hasStudyProgress, aiActive, onAI }: SidebarProps) => {
  const openContextMenu = useContextMenu()
  const counts = useMemo(() => getLibraryCounts(data), [data.folders, data.decks, data.cards])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const foldersByParent = useMemo(() => {
    const dictionary = new Map<string | null, typeof data.folders>()
    for (const folder of data.folders) {
      const items = dictionary.get(folder.parentId) || []
      items.push(folder)
      dictionary.set(folder.parentId, items)
    }
    for (const items of dictionary.values()) items.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    return dictionary
  }, [data.folders])

  const decksByParent = useMemo(() => {
    const dictionary = new Map<string | null, typeof data.decks>()
    for (const deck of data.decks) {
      const items = dictionary.get(deck.folderId) || []
      items.push(deck)
      dictionary.set(deck.folderId, items)
    }
    for (const items of dictionary.values()) items.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    return dictionary
  }, [data.decks])

  const toggle = (id: string) => {
    setCollapsed(old => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedFolderId = selected.type === 'folder'
    ? selected.id
    : selected.type === 'deck' ? data.decks.find(deck => deck.id === selected.id)?.folderId || null : null

  useEffect(() => {
    if (!selectedFolderId) return
    const ancestors: string[] = []
    let parent: string | null = selected.type === 'folder'
      ? data.folders.find(folder => folder.id === selectedFolderId)?.parentId ?? null
      : selectedFolderId
    const visited = new Set<string>()
    while (parent && !visited.has(parent)) {
      ancestors.push(parent)
      visited.add(parent)
      parent = data.folders.find(folder => folder.id === parent)?.parentId || null
    }
    setCollapsed(previous => {
      if (!ancestors.some(id => previous.has(id))) return previous
      const next = new Set(previous)
      ancestors.forEach(id => next.delete(id))
      return next
    })
  }, [selectedFolderId, data.folders])


  const blankActions = [
    { label: 'Nowy folder w:', contextValue: 'Biblioteka', icon: <FolderPlus size={16} />, onSelect: () => onAddFolder(null) },
    { label: 'Nowy zestaw w:', contextValue: 'Biblioteka', icon: <BookPlus size={16} />, onSelect: () => onAddDeck(null) }
  ]

  const renderChildren = (parentId: string | null, depth = 0): ReactNode => <div className="flex flex-col gap-1">
    {(foldersByParent.get(parentId) || []).map(folder => {
      const closed = collapsed.has(folder.id)
      const isActive = selected.type === 'folder' && selected.id === folder.id
      const actions = folderMenuActions(folder, { onAddFolder, onAddDeck, onAction })
      return <div key={folder.id} className="flex flex-col gap-1">
        <div className={`tree-item group relative flex min-h-[40px] items-center rounded-lg border border-transparent text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--interactive-hover-bg)] hover:text-[var(--text)] ${isActive ? 'selected !border-[var(--selected-border)] !bg-[var(--accent-soft)] !text-[var(--accent-ink)] hover:!bg-[var(--blue-soft)] active:!bg-[var(--accent-soft)]' : ''}`} style={{ paddingLeft: `${11 + depth * 16}px` }} onContextMenu={event => openContextMenu(event, actions)}>
          <button className="grid h-7 w-4 shrink-0 place-items-center border-0 bg-transparent p-0 text-[var(--faint)] enabled:cursor-pointer enabled:hover:text-[var(--text)]" onClick={() => toggle(folder.id)} aria-label={closed ? 'Rozwiń folder' : 'Zwiń folder'}>
            {closed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <button className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent py-1.5 text-left text-[12.5px] font-semibold text-inherit enabled:cursor-pointer" onClick={() => {
              if (isActive && !closed) { toggle(folder.id); return }
              if (closed) toggle(folder.id)
              if (!isActive) onSelect({ type: 'folder', id: folder.id })
            }}>
            {isActive ? <FolderOpen size={16} /> : <FolderClosed size={16} />}
            <span className="min-w-0 truncate">{folder.name}</span>
          </button>
          <span className="tree-count ml-0.5 shrink-0 text-[10px] text-[var(--faint)] group-hover:hidden [.selected_&]:hidden" title="Zestawy w folderze i podfolderach">{counts.folders.get(folder.id) || 0}</span>
          <div className="tree-more relative z-20 hidden group-hover:block group-focus-within:block [.selected_&]:block"><Dropdown actions={actions} /></div>
        </div>
        {!closed && renderChildren(folder.id, depth + 1)}
      </div>
    })}
    {(decksByParent.get(parentId) || []).map(deck => {
      const active = selected.type === 'deck' && selected.id === deck.id
      const actions = deckMenuActions(deck, { onAction, onStudy: () => onStudy(deck.id), canResume: hasStudyProgress(deck.id), hasCards: (counts.decks.get(deck.id) || 0) > 0 })
      return <div key={deck.id} onContextMenu={event => openContextMenu(event, actions)} className={`tree-item group relative flex min-h-[40px] items-center rounded-lg border border-transparent text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--interactive-hover-bg)] hover:text-[var(--text)] ${active ? 'selected !border-[var(--selected-border)] !bg-[var(--accent-soft)] !text-[var(--accent-ink)] hover:!bg-[var(--blue-soft)] active:!bg-[var(--accent-soft)]' : ''}`} style={{ paddingLeft: `${29 + depth * 16}px` }}>
        <button className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent py-1.5 text-left text-[12.5px] font-semibold text-inherit enabled:cursor-pointer" onClick={() => onSelect({ type: 'deck', id: deck.id })}>
          <BookOpenText size={16} /><span className="min-w-0 truncate">{deck.name}</span>
        </button>
        <span className="tree-count ml-0.5 shrink-0 text-[10px] text-[var(--faint)] group-hover:hidden [.selected_&]:hidden" title="Fiszki w zestawie">{counts.decks.get(deck.id) || 0}</span>
        <div className="tree-more relative z-20 hidden group-hover:block group-focus-within:block [.selected_&]:block"><Dropdown actions={actions} /></div>
      </div>
    })}
  </div>


  return <aside className="flex w-[273px] shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--sidebar)] max-[800px]:w-[225px]" onContextMenu={event => {
    const target = event.target as HTMLElement
    if (!target.closest('.tree-scroll') || target.closest('.tree-item, button, a, input, textarea, [role="menu"], [role="button"]')) return
    openContextMenu(event, blankActions)
  }}>
    <div className="flex shrink-0 flex-col gap-2 px-3 pb-4 pt-4">
      <Button layout="row" intent="ghost" icon={<Library size={18} />} className="min-h-[42px] gap-3 rounded-lg px-3 text-[13px] font-semibold" selected={selected.type === 'home'} aria-current={selected.type === 'home' ? 'page' : undefined} onClick={() => onSelect({ type: 'home' })}>
        <span>Moja biblioteka</span>
      </Button>
      <Button layout="row" intent="ghost" icon={<Sparkles size={18} />} className="min-h-[42px] gap-3 rounded-lg px-3 text-[13px] font-semibold" selected={aiActive && data.decks.length > 0} disabled={!data.decks.length} title={!data.decks.length ? 'Najpierw utwórz zestaw fiszek' : undefined} onClick={onAI} aria-expanded={aiActive}>
        <span>Asystent AI</span>
      </Button>
    </div>
    <div className="shrink-0 px-5 pb-3 pt-2 text-[10px] font-extrabold tracking-[1.1px] text-[var(--faint)]">
      <span>FOLDERY I ZESTAWY</span>

    </div>
    <nav className="tree-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-6" aria-label="Drzewo biblioteki">{renderChildren(null)}</nav>
    <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 pb-4 pt-4">
      <Button layout="row" intent="ghost" icon={<Settings size={18} />} color="neutral" className="min-h-[42px] gap-3 rounded-lg px-3 text-[13px] font-semibold !text-[var(--muted)] enabled:hover:!text-[var(--text)]" onClick={onSettings}>Ustawienia</Button>
    </div>
  </aside>
}

export default Sidebar
