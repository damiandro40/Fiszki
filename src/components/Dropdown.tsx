import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  autoUpdate, flip, FloatingFocusManager, FloatingPortal, offset, shift,
  useDismiss, useFloating, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import { Ellipsis, Plus } from 'lucide-react'
import Button from './atoms/Button'

export interface DropdownAction {
  label: string
  contextValue?: string
  icon?: ReactNode
  onSelect: () => void
  destructive?: boolean
  primary?: boolean
  disabled?: boolean
}

interface DropdownProps {
  actions: DropdownAction[]
  label?: string
  trigger?: 'more' | 'add'
}

export const MenuItems = ({ actions, onSelect }: { actions: DropdownAction[], onSelect: () => void }) => <>
  {actions.map((action, index) => <Button key={`${action.label}-${index}`} layout="row" intent="ghost" role="menuitem"
    color={action.destructive ? 'danger' : action.primary ? 'primary' : 'neutral'} icon={action.icon} disabled={action.disabled} className="min-h-[39px] gap-2.5 px-3 py-2 text-[12px]"
    onClick={event => {
      event.stopPropagation()
      if (action.disabled) return
      onSelect()
      action.onSelect()
    }}>
    <span className="min-w-0 flex-1 truncate">{action.label}{action.contextValue && <> <span className="font-normal not-italic text-[var(--faint)]">{action.contextValue}</span></>}</span>
  </Button>)}
</>

const Dropdown = ({ actions, label = 'Więcej opcji', trigger = 'more' }: DropdownProps) => {
  const [open, setOpen] = useState(false)
  const floating = useFloating({
    open, onOpenChange: setOpen, transform: false, strategy: 'fixed', placement: 'bottom-end', whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 10 })]
  })
  const dismiss = useDismiss(floating.context)
  const role = useRole(floating.context, { role: 'menu' })
  const { getFloatingProps } = useInteractions([dismiss, role])

  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 170, close: 115 },
    initial: { opacity: 0, transform: 'translateY(-7px) scale(.97)' }
  })

  const button = <Button.Icon ref={floating.refs.setReference} type="button" label={label} tooltip={false} intent={trigger === 'add' ? 'solid' : 'ghost'} color={trigger === 'add' ? 'primary' : 'neutral'} aria-haspopup="menu" aria-expanded={open}
    className={trigger === 'add' ? '!size-10' : '!size-7'} onClick={event => {
      event.stopPropagation()
      if (!open) {
        // Pin to the click-time rectangle: hover/selection re-renders must not move the menu.
        const rect = event.currentTarget.getBoundingClientRect()
        floating.refs.setPositionReference({ getBoundingClientRect: () => rect })
      }
      setOpen(previous => !previous)
    }}>
    {trigger === 'add' ? <Plus size={18} /> : <Ellipsis size={18} />}
  </Button.Icon>

  return <>
    {button}
    {isMounted && <FloatingPortal>
      <FloatingFocusManager context={floating.context} modal={false} returnFocus={false}>
        <div ref={floating.refs.setFloating} style={{ ...floating.floatingStyles, ...styles }} className="dropdown-panel z-[5000] flex w-max min-w-[215px] max-w-[min(360px,calc(100vw-20px))] flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[var(--text)] shadow-[var(--shadow)] outline-none" {...getFloatingProps()}
          onClick={event => event.stopPropagation()} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
              const current = items.indexOf(document.activeElement as HTMLButtonElement)
              items[current === -1 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
            }
          }}>
          <MenuItems actions={actions} onSelect={() => setOpen(false)} />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>}
  </>
}

export default Dropdown
