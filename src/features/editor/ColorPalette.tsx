import { useEffect, useState } from 'react'
import type { PointerEvent } from 'react'
import {
  autoUpdate, flip, FloatingPortal, offset, shift, useDismiss,
  useFloating, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import { Check, ChevronDown, Highlighter, Pencil, Plus, Trash2, Type, X } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useContextMenu } from '../../components/ContextMenu'
import { addPaletteColor, normalizePalette, removePaletteColor, replacePaletteColor } from '../../lib/palette'
import type { PaletteKind } from '../../lib/palette'
import { hexToHsv, hsvToHex, isHexColor } from '../../lib/colorMath'

const loadPalette = (kind: PaletteKind): string[] => {
  try {
    const raw = localStorage.getItem(`fiszki.palette.${kind}`)
    return normalizePalette(raw === null ? undefined : JSON.parse(raw), kind)
  } catch {
    return normalizePalette(undefined, kind)
  }
}

type ColorPaletteProps = { editor: Editor, kind: PaletteKind }

const ColorPalette = ({ editor, kind }: ColorPaletteProps) => {
  const isText = kind === 'text'
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState<string[]>(() => loadPalette(kind))
  const [editing, setEditing] = useState<number | null | undefined>(undefined)
  const [hsv, setHsv] = useState({ h: 205, s: 75, v: 95 })
  const [hex, setHex] = useState('#318cdb')
  const openContextMenu = useContextMenu()
  const current: string | undefined = isText ? editor.getAttributes('textStyle').color : editor.getAttributes('highlight').color
  const preview = hsvToHex(hsv)

  const floating = useFloating({
    open, onOpenChange: next => { setOpen(next); if (!next) setEditing(undefined) },
    placement: 'bottom-start', transform: false, whileElementsMounted: autoUpdate,
    middleware: [offset(7), flip(), shift({ padding: 9 })]
  })
  const dismiss = useDismiss(floating.context, {
    outsidePress: event => !(event.target instanceof Element && event.target.closest('.context-menu-panel'))
  })
  const role = useRole(floating.context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])
  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 160, close: 95 }, initial: { opacity: 0, transform: 'translateY(-6px) scale(.98)' }
  })

  useEffect(() => {
    try { localStorage.setItem(`fiszki.palette.${kind}`, JSON.stringify(palette)) } catch { /* Noncritical preference */ }
  }, [palette, kind])

  const apply = (color: string) => {
    if (isText) editor.chain().focus().setColor(color).run()
    else editor.chain().focus().setHighlight({ color }).run()
    setOpen(false)
    setEditing(undefined)
  }

  const clear = () => {
    if (isText) editor.chain().focus().unsetColor().run()
    else editor.chain().focus().unsetHighlight().run()
    setOpen(false)
    setEditing(undefined)
  }

  const edit = (index: number | null) => {
    const color = index !== null ? palette[index] : palette[0] || '#318cdb'
    const next = isHexColor(color) ? color : '#318cdb'
    setHex(next)
    setHsv(hexToHsv(next))
    setEditing(index)
  }

  const setColor = (next: { h: number, s: number, v: number }) => {
    setHsv(next)
    setHex(hsvToHex(next))
  }

  const setSV = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const s = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))
    const v = Math.max(0, Math.min(100, (1 - (event.clientY - rect.top) / rect.height) * 100))
    setColor({ ...hsv, s, v })
  }

  const commit = () => {
    if (!isHexColor(hex)) return
    const color = hex.toLowerCase()
    if (editing === null) {
      setPalette(previous => addPaletteColor(previous, color))
      setEditing(undefined)
    } else if (editing !== undefined) {
      setPalette(previous => replacePaletteColor(previous, editing, color))
      setEditing(undefined)
    }
  }

  return <>
    <button type="button" ref={floating.refs.setReference} className={`relative flex h-[31px] items-center gap-0.5 rounded-lg border px-1.5 pb-2 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] ${open ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'border-transparent'}`}
      aria-label={isText ? 'Paleta kolorów tekstu' : 'Paleta podświetleń'} aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { setEditing(undefined); setOpen(previous => !previous) }}>
      {isText ? <Type size={17}/> : <Highlighter size={17}/>}
      <span className="absolute bottom-1 left-[7px] h-[3px] w-[15px] rounded-sm" style={{ backgroundColor: current || palette[0] || 'var(--muted)' }}/>
      <ChevronDown size={11}/>
    </button>
    {isMounted && <FloatingPortal>
      <div ref={floating.refs.setFloating} style={{ ...floating.floatingStyles, ...styles }} {...getFloatingProps()}
        className="color-palette-popover z-[6200] w-[260px] max-w-[calc(100vw-28px)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-[var(--text)] shadow-[var(--shadow)] outline-none" aria-label={isText ? 'Paleta tekstu' : 'Paleta podświetlenia'}>
        <>
          <div className="flex items-center gap-2 text-xs font-extrabold">{isText ? 'Kolor tekstu' : 'Kolor podświetlenia'}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="grid size-[31px] shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--red-soft)] enabled:hover:text-[var(--red)]" onClick={clear} aria-label="Bez koloru"><X size={17}/></button>
            {palette.map((color, index) => <button type="button" key={`${color}-${index}`}
              className={`grid size-[31px] shrink-0 place-items-center rounded-full border-2 border-[var(--surface)] p-0 text-[#232336] shadow-sm outline outline-1 outline-[var(--border)] transition-[transform,outline-color] duration-150 enabled:cursor-pointer enabled:hover:-translate-y-0.5 enabled:hover:scale-105 enabled:hover:outline-[var(--accent)] ${current?.toLowerCase() === color.toLowerCase() ? 'outline-2 !outline-[var(--accent)] outline-offset-2' : ''} ${editing === index ? 'ring-[5px] ring-[var(--accent-soft)] !outline-2 !outline-[var(--accent-ink)] outline-offset-[3px]' : ''}`}
              style={{ backgroundColor: color }} aria-label={`Zastosuj ${color}. Prawy przycisk: edytuj lub usuń`}
              onClick={() => apply(color)}
              onContextMenu={event => openContextMenu(event, [
                { label: 'Zmień ten kolor', icon: <Pencil size={15}/>, onSelect: () => edit(index) },
                { label: 'Usuń z palety', icon: <Trash2 size={15}/>, destructive: true, onSelect: () => { setPalette(previous => removePaletteColor(previous, index)); setEditing(undefined) } }
              ])}>{current?.toLowerCase() === color.toLowerCase() && <Check size={15}/>}</button>)}
            <button type="button" className={`grid size-[31px] shrink-0 place-items-center rounded-full border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] p-0 text-[var(--accent-ink)] transition-transform enabled:cursor-pointer enabled:hover:-translate-y-0.5 ${editing === null ? 'ring-[5px] ring-[var(--accent-soft)] outline outline-2 outline-[var(--accent-ink)] outline-offset-2' : ''}`} aria-label="Dodaj własny kolor" onClick={() => edit(null)}><Plus size={17}/></button>
          </div>
          {editing !== undefined && <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--border-subtle)] pt-3">
          <div className="mb-0 flex items-center justify-between gap-3 text-xs"><strong>{editing === null ? 'Nowy kolor' : 'Edytuj zaznaczony kolor'}</strong><button type="button" aria-label="Zamknij edycję koloru" onClick={() => setEditing(undefined)}><X size={15}/></button></div>
          <div className="relative h-[148px] touch-none cursor-crosshair overflow-hidden rounded-lg border border-[var(--border)]" style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 100, v: 100 }) }}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setSV(event) }}
            onPointerMove={event => { if (event.buttons & 1) setSV(event) }} role="slider" tabIndex={0}
            aria-label="Nasycenie i jasność" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s)}
            onKeyDown={event => {
              if (event.key.startsWith('Arrow')) event.preventDefault()
              if (event.key === 'ArrowRight') setColor({ ...hsv, s: Math.min(100, hsv.s + 2) })
              if (event.key === 'ArrowLeft') setColor({ ...hsv, s: Math.max(0, hsv.s - 2) })
              if (event.key === 'ArrowUp') setColor({ ...hsv, v: Math.min(100, hsv.v + 2) })
              if (event.key === 'ArrowDown') setColor({ ...hsv, v: Math.max(0, hsv.v - 2) })
            }}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#fff,transparent)]"/><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#000,transparent)]"/>
            <span className="pointer-events-none absolute size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#000b]" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}/>
          </div>
          <input className="color-picker-hue my-3.5 h-3 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]" aria-label="Odcień" type="range" min={0} max={360} value={hsv.h}
            onChange={event => setColor({ ...hsv, h: Number(event.target.value) })}/>
          <div className="flex items-center gap-2"><span className="block size-8 shrink-0 rounded-lg border border-[var(--border)]" style={{ backgroundColor: preview }}/>
            <label htmlFor="picker-hex" className="sr-only">Kod HEX</label>
            <input id="picker-hex" className="h-8 w-20 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--accent-ink)] focus:outline-none" spellCheck={false} maxLength={7} value={hex}
              onChange={event => {
                const value = event.target.value
                setHex(value)
                if (isHexColor(value)) setHsv(hexToHsv(value))
              }}/>
            <button type="button" className="h-8 rounded-lg border-0 bg-[var(--accent)] px-2.5 text-[11px] font-semibold text-[var(--accent-text)] enabled:cursor-pointer enabled:hover:bg-[var(--accent-hover)] enabled:active:bg-[var(--accent-active)] disabled:opacity-45" disabled={!isHexColor(hex)} onClick={commit}>{editing === null ? 'Dodaj' : 'Zapisz'}</button>
          </div>
          </div>}
        </>
      </div>
    </FloatingPortal>}
  </>
}

export default ColorPalette
