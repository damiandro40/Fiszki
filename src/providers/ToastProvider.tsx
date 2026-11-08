import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Toast from '../components/Toast'
import { enqueueToast, removeOverlay } from '../lib/overlayQueue'

const EXIT_DURATION = 180

export interface ToastOptions {
  error?: boolean
  undo?: () => void
  duration?: number
}

interface ToastEntry extends ToastOptions {
  id: number
  message: string
}

interface ToastContextValue {
  addToast: (message: string, options?: ToastOptions) => number
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('Brak ToastProvider')
  return context
}

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastEntry[]>([])
  const [closingIds, setClosingIds] = useState<number[]>([])
  const [expanded, setExpanded] = useState(false)
  const nextId = useRef(0)
  const closing = useRef(new Set<number>())
  const timers = useRef(new Map<number, number>())

  const dismissToast = useCallback((id: number) => {
    if (closing.current.has(id)) return
    closing.current.add(id)
    setClosingIds(previous => [...previous, id])
    const timeout = window.setTimeout(() => {
      timers.current.delete(id)
      closing.current.delete(id)
      setItems(previous => removeOverlay(previous, id))
      setClosingIds(previous => previous.filter(item => item !== id))
    }, EXIT_DURATION)
    timers.current.set(id, timeout)
  }, [])

  const addToast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++nextId.current
    setItems(previous => enqueueToast(previous, { ...options, id, message }, 3))
    return id
  }, [])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])

  const api = useMemo(() => ({ addToast, dismissToast }), [addToast, dismissToast])
  const visible = [...items].reverse()
  const isExpanded = expanded && visible.length > 1

  return <ToastContext.Provider value={api}>
    {children}
    {visible.length > 0 && <div
      className={`pointer-events-none fixed top-[60px] right-[22px] z-[5200] w-[min(335px,calc(100vw-24px))] transition-[height] duration-[250ms] motion-reduce:transition-none max-[540px]:top-12 max-[540px]:right-3 ${isExpanded ? 'pointer-events-auto' : ''}`}
      style={{ height: isExpanded ? `${64 + (visible.length - 1) * 72}px` : '64px' }}
      role="region" aria-label="Powiadomienia" onPointerEnter={() => setExpanded(true)} onPointerLeave={() => setExpanded(false)}>
      {visible.map((item, index) => {
        const exiting = closingIds.includes(item.id)
        return <div key={item.id}
          className={`pointer-events-auto absolute inset-x-0 top-0 origin-top transition-[opacity,transform] duration-[250ms] ease-out motion-reduce:transition-none ${exiting ? '!pointer-events-none' : ''}`}
          style={{
            zIndex: 4 - index,
            transform: exiting
              ? 'translate3d(32px, 0, 0) scale(.95)'
              : isExpanded
                ? `translate3d(0, ${index * 72}px, 0) scale(1)`
                : `translate3d(0, ${index * 6}px, 0) scale(${1 - index * .025})`,
            opacity: exiting ? 0 : isExpanded ? 1 : 1 - index * .16
          }}>
          <div className="toast-reveal">
            <Toast message={item.message} error={item.error} duration={item.duration}
              pausedExternally={isExpanded || exiting} onClose={() => dismissToast(item.id)}
              onUndo={item.undo ? () => { dismissToast(item.id); item.undo?.() } : undefined}/>
          </div>
        </div>
      })}
    </div>}
  </ToastContext.Provider>
}

export default ToastProvider
