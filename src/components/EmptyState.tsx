import type { ReactNode } from 'react'
import Button from './atoms/Button'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

const EmptyState = ({ icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="empty-state mx-auto my-16 flex max-w-[540px] flex-col items-center text-center">
    <div className="mb-5 grid size-[78px] place-items-center rounded-[21px] bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</div>
    <h3 className="mb-2 text-[22px] font-bold tracking-tight">{title}</h3><p className="mb-5 max-w-[380px] text-[13px] leading-7 text-[var(--muted)]">{description}</p>
    {actionLabel && onAction && <Button intent="solid" color="primary" onClick={onAction}>{actionLabel}</Button>}
  </div>
)

export default EmptyState
