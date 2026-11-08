import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  autoUpdate, flip, FloatingPortal, offset, shift, size,
  useDismiss, useFloating, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import { Check, ChevronDown, Search } from 'lucide-react'
import Input from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  ariaLabel?: string
  searchable?: boolean
  disabled?: boolean
}

const Select = ({ value, onChange, options, placeholder = 'Wybierz…', ariaLabel = 'Wybierz opcję', searchable = false, disabled }: SelectProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionsRef = useRef<Array<HTMLButtonElement | null>>([])
  const listId = useId()
  const selected = options.find(option => option.value === value)
  const filtered = options.filter(option => !searchable || option.label.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')))

  const floating = useFloating({
    open, onOpenChange: setOpen, transform: false, placement: 'bottom-start', whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 }), size({
      apply({ rects, elements, availableHeight }) {
        Object.assign(elements.floating.style, {
          width: `${rects.reference.width}px`,
          maxHeight: `${Math.max(130, Math.min(320, availableHeight))}px`
        })
      }
    })]
  })
  const dismiss = useDismiss(floating.context)
  const role = useRole(floating.context, { role: 'listbox' })
  const { getFloatingProps } = useInteractions([dismiss, role])
  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 160, close: 110 },
    initial: { opacity: 0, transform: 'translateY(-6px) scale(.98)' }
  })

  useEffect(() => {
    if (!open) { setQuery(''); return }
    setActive(Math.max(0, filtered.findIndex(option => option.value === value)))
    if (searchable) inputRef.current?.focus()
  }, [open])

  const selectOption = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (disabled) return
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      let next = active
      for (let i = 0; i < filtered.length; i++) {
        next = (next + direction + filtered.length) % filtered.length
        if (!filtered[next].disabled) { setActive(next); optionsRef.current[next]?.scrollIntoView({ block: 'nearest' }); break }
      }
    }
    if (event.key === 'Enter' && filtered[active]) { event.preventDefault(); selectOption(filtered[active]) }
  }

  return <>
    <button type="button" ref={element => { floating.refs.setReference(element); triggerRef.current = element }} disabled={disabled} className={`flex min-h-[43px] w-full items-center gap-3 rounded-[10px] border bg-[var(--surface-2)] px-3 py-2 text-left text-xs text-[var(--text)] transition-colors duration-150 enabled:cursor-pointer enabled:hover:border-[var(--scroll-hover)] enabled:active:bg-[var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-45 ${open ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]' : 'border-[var(--border)]'}`}
      role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-expanded={open}
      onClick={() => setOpen(previous => !previous)} onKeyDown={handleKeyDown}>
      <span className={`min-w-0 flex-1 truncate ${!selected ? 'text-[var(--muted)]' : ''}`}>{selected?.label || placeholder}</span>
      <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {isMounted && <FloatingPortal>
      <div ref={floating.refs.setFloating} {...getFloatingProps({ onKeyDown: handleKeyDown })}
        style={{ ...floating.floatingStyles, ...styles }} data-select-popover className="relative z-[6100] flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 outline-none" id={listId}>
        {searchable && <Input ref={inputRef} type="search" size="sm" containerClassName="sticky top-0 z-10 mb-1 shrink-0" icon={<Search size={15}/>}
          value={query} onChange={event => { setQuery(event.target.value); setActive(0) }}
          placeholder="Szukaj folderu…" aria-label="Filtruj opcje"/>}
        <div className="min-h-0 overflow-y-auto p-0.5" role="presentation">
          {filtered.map((option, index) => <button key={option.value} ref={element => { optionsRef.current[index] = element }} type="button"
            role="option" aria-selected={option.value === value} disabled={option.disabled}
            className={`my-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${option.value === value ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]' : index === active ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--muted)] enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)]'}`}
            onMouseEnter={() => setActive(index)} onClick={() => selectOption(option)}>
            <span className="min-w-0 flex-1 break-words">{option.label}</span>{option.value === value && <Check size={15} />}
          </button>)}
          {!filtered.length && <div className="p-4 text-center text-xs text-[var(--muted)]">Nie znaleziono wyników</div>}
        </div>
      </div>
    </FloatingPortal>}
  </>
}

export default Select
