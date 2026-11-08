import { useEffect, useState } from 'react'
import { Maximize2, Minus, Square, X } from 'lucide-react'

interface TitlebarProps { title?: string; subtitle?: string; closeLabel?: string }

const Titlebar = ({ title = 'Fiszki', subtitle, closeLabel = 'Zamknij aplikację' }: TitlebarProps) => {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.flashcards.onMaximizeChange(setMaximized), [])

  return <header className="flex h-[43px] shrink-0 select-none items-center justify-between border-b border-[var(--border)] bg-[var(--sidebar)] [-webkit-app-region:drag]" onDoubleClick={() => void window.flashcards.toggleMaximize()}>
    <div className="flex items-center gap-2.5 pl-3.5 text-xs text-[var(--text)] [&_strong]:font-extrabold"><img className="size-[25px] rounded-lg object-cover" src="./icon.png" alt="" /><strong>{title}</strong>{subtitle && <span className="ml-1 max-w-[45vw] truncate text-[var(--muted)]">{subtitle}</span>}</div>
    <div className="flex h-full items-stretch [-webkit-app-region:no-drag]" onDoubleClick={event => event.stopPropagation()}>
      <button type="button" aria-label="Minimalizuj okno" className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] [-webkit-app-region:no-drag]" onClick={() => void window.flashcards.minimizeWindow()}><Minus size={18} strokeWidth={1.9} /></button>
      <button type="button" aria-label={maximized ? 'Przywróć okno' : 'Maksymalizuj okno'} className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] [-webkit-app-region:no-drag]" onClick={() => void window.flashcards.toggleMaximize()}>{maximized ? <Maximize2 size={14} /> : <Square size={14} />}</button>
      <button type="button" aria-label={closeLabel} className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[#d34752] enabled:hover:text-white enabled:active:bg-[#ac3540] [-webkit-app-region:no-drag]" onClick={() => void window.flashcards.closeWindow()}><X size={18} /></button>
    </div>
  </header>
}

export default Titlebar
