import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import Button from './atoms/Button'

interface ToastProps {
  message: string
  error?: boolean
  onUndo?: () => void
  onClose: () => void
  duration?: number
  pausedExternally?: boolean
}

// Neutral notification surface with a small status accent; hover/focus pauses dismissal.
const Toast = ({ message, error = false, onUndo, onClose, duration = 5200, pausedExternally = false }: ToastProps) => {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused || pausedExternally
  const remaining = useRef(duration)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (paused) return
    const started = performance.now()
    const timeout = window.setTimeout(() => closeRef.current(), remaining.current)
    return () => {
      window.clearTimeout(timeout)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [paused])

  return <div className="relative flex min-h-[58px] w-full items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] shadow-[0_9px_28px_var(--tile-hover-shadow)]"
    role={error ? 'alert' : 'status'}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
    }}>
    <span className={`grid size-6 shrink-0 place-items-center ${error ? 'text-[var(--red)]' : 'text-[var(--green)]'}`} aria-hidden="true">
      {error ? <AlertCircle size={19} strokeWidth={2}/> : <CheckCircle2 size={19} strokeWidth={2}/>}
    </span>
    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis text-[12px] font-medium leading-[1.45] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{message}</span>
    {onUndo && <Button size="sm" intent="ghost" color="primary" className="!min-h-7 shrink-0 !px-1.5" onClick={onUndo}>Cofnij</Button>}
    <Button.Icon label="Zamknij powiadomienie" tooltip={false} size="sm" className="!size-6 !min-h-0 !p-0 text-[var(--faint)]" onClick={onClose}><X size={15}/></Button.Icon>
  </div>
}

export default Toast
