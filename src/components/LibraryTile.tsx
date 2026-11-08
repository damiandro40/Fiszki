import type { MouseEvent, ReactNode } from 'react'
import type { DropdownAction } from './Dropdown'
import Dropdown from './Dropdown'

interface LibraryTileProps {
  kind: 'folder' | 'deck'
  name: string
  detail: string
  icon: ReactNode
  actions: DropdownAction[]
  onOpen: () => void
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void
}

const LibraryTile = ({ kind, name, detail, icon, actions, onOpen, onContextMenu }: LibraryTileProps) => (
  <div className="library-tile group relative flex min-h-[95px] min-w-0 items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-[18px] transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-[var(--tile-hover-border)] hover:bg-[var(--tile-hover-bg)] hover:shadow-[0_3px_14px_var(--tile-hover-shadow)] active:bg-[var(--interactive-active-bg)]" onContextMenu={onContextMenu}>
    <button className="absolute inset-0 z-10 rounded-[inherit] border-0 bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent-ink)]" type="button" onClick={onOpen} aria-label={`${kind === 'folder' ? 'Otwórz folder' : 'Otwórz zestaw'} ${name}`} />
    <div className={`grid size-[46px] shrink-0 place-items-center rounded-xl ${kind === 'folder' ? 'bg-[var(--blue-soft)] text-[var(--accent-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'}`}>{icon}</div>
    <div className="pointer-events-none min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-bold tracking-[.7px] text-[var(--faint)]">{kind === 'folder' ? 'FOLDER' : 'ZESTAW FISZEK'}</div>
      <h3 className="mb-1 truncate text-[13.5px] font-semibold">{name}</h3>
      <p className="m-0 text-[11.5px] text-[var(--muted)]">{detail}</p>
    </div>
    <div className="relative z-20"><Dropdown actions={actions}/></div>
  </div>
)

export default LibraryTile
