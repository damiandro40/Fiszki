import {
  autoUpdate, flip, FloatingPortal, offset, shift,
  useDismiss, useFloating, useFocus, useHover, useInteractions, useRole, useTransitionStyles
} from '@floating-ui/react'
import { useState } from 'react'
import type { ReactNode } from 'react'

interface TooltipProps {
  label: ReactNode
  children: ReactNode
  placement?: 'top' | 'bottom' | 'right'
}

const Tooltip = ({ label, children, placement = 'top' }: TooltipProps) => {
  const [open, setOpen] = useState(false)
  const floating = useFloating({
    open, onOpenChange: setOpen, transform: false, placement, whileElementsMounted: autoUpdate,
    middleware: [offset(9), flip(), shift({ padding: 8 })]
  })
  const hover = useHover(floating.context, { delay: { open: 450, close: 70 } })
  const focus = useFocus(floating.context)
  const dismiss = useDismiss(floating.context)
  const role = useRole(floating.context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  const { isMounted, styles } = useTransitionStyles(floating.context, {
    duration: { open: 165, close: 100 },
    initial: { opacity: 0, transform: 'translateY(4px) scale(.98)' }
  })

  return <>
    <span ref={floating.refs.setReference} {...getReferenceProps()} className="inline-flex max-w-full">{children}</span>
    {isMounted && <FloatingPortal>
      <div ref={floating.refs.setFloating} style={{ ...floating.floatingStyles, ...styles }} {...getFloatingProps()} className="pointer-events-none relative z-[7000] w-max max-w-[250px] rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-[11px] font-medium text-[var(--text)] shadow-[var(--shadow)]">
        {label}
      </div>
    </FloatingPortal>}
  </>
}

export default Tooltip
