import { useState } from 'react'
import {
  autoUpdate, flip, FloatingPortal, offset, shift,
  useDismiss, useFloating, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import { ChevronDown, Table2 } from 'lucide-react'
import type { Editor } from '@tiptap/react'

const GRID_SIZE = 8

const TableInsertPicker = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<{ rows: number, cols: number } | null>(null)
  const changeOpen = (next: boolean) => {
    setOpen(next)
    setHovered(null)
  }
  const floating = useFloating({
    open, onOpenChange: changeOpen, transform: false, placement: 'bottom-start', whileElementsMounted: autoUpdate,
    middleware: [offset(7), flip(), shift({ padding: 12 })]
  })
  const dismiss = useDismiss(floating.context)
  const role = useRole(floating.context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])
  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 165, close: 110 }, initial: { opacity: 0, transform: 'translateY(-7px) scale(.97)' }
  })

  return <>
    <button type="button" ref={floating.refs.setReference} className={`inline-flex h-[31px] items-center gap-0.5 rounded-lg border px-1.5 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] ${open ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'border-transparent'}`}
      onClick={() => changeOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label="Wstaw tabelę">
      <Table2 size={17} /><ChevronDown size={12} />
    </button>
    {isMounted && <FloatingPortal>
      <div ref={floating.refs.setFloating} style={{ ...floating.floatingStyles, ...styles }} {...getFloatingProps()}
        className="table-picker-popover z-[6200] w-[242px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-[var(--text)] shadow-[var(--shadow)] outline-none" aria-label="Wybierz rozmiar tabeli">
        <div className="text-xs font-extrabold">Wstaw tabelę</div>
        <div className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">Najedź i kliknij, aby wybrać liczbę wierszy i kolumn.</div>
        <div className="my-3 grid grid-cols-8 gap-[3px]" role="group" aria-label="Rozmiar tabeli">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
            const rows = Math.floor(index / GRID_SIZE) + 1
            const cols = index % GRID_SIZE + 1
            const active = hovered !== null && rows <= hovered.rows && cols <= hovered.cols
            return <button key={index} type="button" aria-label={`${rows} wierszy, ${cols} kolumn`}
              className={`aspect-square min-w-0 rounded-[3px] border p-0 transition-colors duration-100 enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface-2)] enabled:hover:border-[var(--accent)] enabled:hover:bg-[var(--accent-soft)]'}`}
              onMouseEnter={() => setHovered({ rows, cols })}
              onFocus={() => setHovered({ rows, cols })}
              onClick={() => { editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(); changeOpen(false) }} />
          })}
        </div>
        <div className="text-center text-[11px] font-bold text-[var(--accent-ink)]">{hovered ? `${hovered.cols} kolumn × ${hovered.rows} wierszy` : 'Wybierz rozmiar'}</div>
      </div>
    </FloatingPortal>}
  </>
}

export default TableInsertPicker
