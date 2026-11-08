import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  flip, FloatingFocusManager, FloatingPortal, offset, shift,
  useDismiss, useFloating, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import type { DropdownAction } from './Dropdown'
import { MenuItems } from './Dropdown'

interface MenuRequest {
  actions: DropdownAction[]
}

type OpenMenu = (event: MouseEvent<HTMLElement>, actions: DropdownAction[]) => void

const MenuContext = createContext<OpenMenu | null>(null)

export const useContextMenu = () => {
  const open = useContext(MenuContext)
  if (!open) throw new Error('Brak ContextMenuProvider')
  return open
}

const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [menu, setMenu] = useState<MenuRequest | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const floating = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    strategy: 'fixed',
    transform: false,
    placement: 'bottom-start',
    middleware: [offset(3), flip(), shift({ padding: 9 })]
  })
  const dismiss = useDismiss(floating.context, { outsidePressEvent: 'pointerdown' })
  const role = useRole(floating.context, { role: 'menu' })
  const { getFloatingProps } = useInteractions([dismiss, role])

  const open = useCallback<OpenMenu>((event, actions) => {
    if (!actions.length) return
    event.preventDefault()
    event.stopPropagation()
    const x = event.clientX
    const y = event.clientY
    floating.refs.setPositionReference({ getBoundingClientRect: () => new DOMRect(x, y, 0, 0) })
    setMenu({ actions })
    setIsOpen(true)
  }, [floating.refs.setPositionReference])

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    window.addEventListener('blur', close)
    document.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('blur', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [isOpen])

  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 160, close: 110 },
    initial: { opacity: 0, transform: 'translateY(-5px) scale(.975)' }
  })

  return <MenuContext.Provider value={open}>
    {children}
    {isMounted && menu && <FloatingPortal>
      <FloatingFocusManager context={floating.context} modal={false} returnFocus={false}>
        <div ref={floating.refs.setFloating} style={{ ...floating.floatingStyles, ...styles }} {...getFloatingProps()}
          className="dropdown-panel context-menu-panel z-[5000] flex w-max min-w-[215px] max-w-[min(360px,calc(100vw-20px))] flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[var(--text)] shadow-[var(--shadow)] outline-none" onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
              const current = items.indexOf(document.activeElement as HTMLButtonElement)
              items[current === -1 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
            }
          }}>
          <MenuItems actions={menu.actions} onSelect={() => setIsOpen(false)} />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>}
  </MenuContext.Provider>
}

export default ContextMenuProvider
