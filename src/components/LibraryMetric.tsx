import type { ReactNode } from 'react'

interface LibraryMetricProps {
  value: number
  label: string
  icon: ReactNode
  tone: 'purple' | 'blue' | 'gold'
}

const LibraryMetric = ({ value, label, icon, tone }: LibraryMetricProps) => (
  <div className="flex min-w-0 items-center justify-center gap-3.5 px-5 py-4 max-[620px]:gap-3 max-[620px]:px-3.5 max-[460px]:px-4">
    <span className={`grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] ${tone === 'gold' ? 'bg-[var(--gold-soft)] text-[var(--muted)]' : tone === 'purple' ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-[var(--blue-soft)] text-[var(--accent-ink)]'}`} aria-hidden="true">
      {icon}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <strong className="text-[27px] font-bold leading-[1.1] tracking-[-.7px] text-[var(--text)] tabular-nums">{value.toLocaleString('pl-PL')}</strong>
      <span className="text-[11.5px] leading-snug text-[var(--muted)]">{label}</span>
    </span>
  </div>
)

export default LibraryMetric
