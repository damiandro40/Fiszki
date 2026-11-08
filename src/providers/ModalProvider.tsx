import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from '../components/atoms/Button'
import { appendOverlay, latestOverlay, removeOverlay } from '../lib/overlayQueue'

const EXIT_DURATION = 190

export interface ModalOptions {
  title?: string
  subtitle?: string
  footer?: ReactNode
  wide?: boolean
  kind?: 'default' | 'settings'
  onClose?: () => void
}

type ModalEntry = { id: number, content: ReactNode, options: ModalOptions }

interface ModalContextValue {
  createModal: (content: ReactNode, options?: ModalOptions) => number
  updateModal: (id: number, content: ReactNode, options: ModalOptions) => void
  closeModal: (id?: number) => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export const useModal = () => {
  const modal = useContext(ModalContext)
  if (!modal) throw new Error('Brak ModalProvider')
  return modal
}

const ModalSurface = ({ entry, isTop, closing, onRequestClose, zIndex }: {
  entry: ModalEntry
  isTop: boolean
  closing: boolean
  onRequestClose: (id: number) => void
  zIndex: number
}) => {
  const panelRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!isTop) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      const initial = panel?.querySelector<HTMLElement>('[data-initial-focus], [autofocus]') ||
        panel?.querySelector<HTMLElement>('input, textarea, select, button')
      ;(initial || panel)?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      if (document.contains(previousFocus.current)) previousFocus.current?.focus()
    }
  }, [isTop])

  const settings = entry.options.kind === 'settings'

  return <div data-closing={closing} aria-hidden={!isTop} style={{ zIndex }}
    className="modal-overlay fixed inset-0 flex items-center justify-center bg-[#050d1bc2] p-4 backdrop-blur-[5px] transition-opacity duration-200 ease-out data-[closing=true]:pointer-events-none motion-reduce:transition-none"
    onMouseDown={event => { if (isTop && event.target === event.currentTarget) onRequestClose(entry.id) }}>
    <section data-closing={closing} ref={panelRef} tabIndex={-1} role="dialog" aria-modal={isTop} aria-label={entry.options.title || 'Okno dialogowe'}
      className={[
        'modal-panel flex min-h-0 flex-col overflow-hidden rounded-[17px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]',
        'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        settings
          ? 'h-[min(670px,calc(100dvh-32px))] w-[min(900px,calc(100vw-32px))] max-h-[calc(100dvh-32px)]'
          : entry.options.wide
            ? 'w-[min(1260px,calc(100vw-32px))] max-h-[min(94dvh,960px)]'
            : 'w-[min(520px,calc(100vw-32px))] max-h-[min(92dvh,960px)]'
      ].join(' ')}
      onKeyDown={event => {
        if (!isTop || event.key !== 'Tab') return
        const elements = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )].filter(item => item.getClientRects().length > 0)
        if (!elements.length) { event.preventDefault(); panelRef.current?.focus(); return }
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      {(entry.options.title || entry.options.subtitle) && <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="min-w-0">
          {entry.options.title && <h2 className="m-0 text-[19px] font-extrabold tracking-tight">{entry.options.title}</h2>}
          {entry.options.subtitle && <p className="mt-1 text-xs text-[var(--muted)]">{entry.options.subtitle}</p>}
        </div>
        <Button.Icon label="Zamknij" tooltip={false} onClick={() => onRequestClose(entry.id)}><X size={19}/></Button.Icon>
      </header>}
      <div className={`min-h-0 min-w-0 flex-1 overscroll-contain ${settings ? 'flex overflow-hidden' : 'overflow-x-hidden overflow-y-auto'}`}>
        {entry.content}
      </div>
      {entry.options.footer && <footer className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-3.5">
        {entry.options.footer}
      </footer>}
    </section>
  </div>
}

const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<ModalEntry[]>([])
  const [closingIds, setClosingIds] = useState<number[]>([])
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const closingRef = useRef(new Set<number>())
  const timers = useRef(new Map<number, number>())
  const nextId = useRef(0)

  const createModal = useCallback((content: ReactNode, options: ModalOptions = {}) => {
    const id = ++nextId.current
    setEntries(previous => appendOverlay(previous, { id, content, options }))
    return id
  }, [])

  const updateModal = useCallback((id: number, content: ReactNode, options: ModalOptions) => {
    setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, content, options } : entry))
  }, [])

  const closeModal = useCallback((id?: number) => {
    const active = entriesRef.current.filter(entry => !closingRef.current.has(entry.id))
    const target = id ?? latestOverlay(active)?.id
    if (target === undefined || closingRef.current.has(target)) return
    if (!entriesRef.current.some(entry => entry.id === target)) {
      // StrictMode may unmount an effect before the first state update commits.
      setEntries(previous => removeOverlay(previous, target))
      return
    }

    closingRef.current.add(target)
    setClosingIds(previous => [...previous, target])
    const timeout = window.setTimeout(() => {
      timers.current.delete(target)
      closingRef.current.delete(target)
      setEntries(previous => removeOverlay(previous, target))
      setClosingIds(previous => previous.filter(item => item !== target))
    }, EXIT_DURATION)
    timers.current.set(target, timeout)
  }, [])

  const requestClose = useCallback((id: number) => {
    if (closingRef.current.has(id)) return
    const entry = entriesRef.current.find(item => item.id === id)
    if (!entry) return
    closeModal(id)
    entry.options.onClose?.()
  }, [closeModal])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])

  useEffect(() => {
    if (!entries.length) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[data-select-popover], .dropdown-panel, .table-picker-popover, .color-palette-popover')) return
      const active = entriesRef.current.filter(item => !closingRef.current.has(item.id))
      const current = latestOverlay(active)
      if (!current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      requestClose(current.id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [entries.length, requestClose])

  const context = useMemo(() => ({ createModal, updateModal, closeModal }), [createModal, updateModal, closeModal])
  const topId = latestOverlay(entries.filter(entry => !closingIds.includes(entry.id)))?.id

  return <ModalContext.Provider value={context}>
    {children}
    {typeof document !== 'undefined' && createPortal(entries.map((entry, index) =>
      <ModalSurface key={entry.id} entry={entry} closing={closingIds.includes(entry.id)} isTop={entry.id === topId}
        onRequestClose={requestClose} zIndex={3000 + index * 2}/>
    ), document.body)}
  </ModalContext.Provider>
}

export default ModalProvider
