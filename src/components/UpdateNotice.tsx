import { useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import Button from './atoms/Button'
import { useUpdater } from '../providers/UpdaterProvider'

const UpdateNotice = ({ onInstall }: { onInstall: () => Promise<void> }) => {
  const { status, download } = useUpdater()
  const [dismissed, setDismissed] = useState<string | null>(null)
  const phase = status.phase
  const noticeId = `${phase}:${status.version || ''}`
  if ((phase !== 'available' && phase !== 'downloaded') || dismissed === noticeId) return null

  return <aside className="fixed bottom-5 left-[266px] z-[5300] w-[min(340px,calc(100vw-36px))] max-[760px]:left-4 animate-[rise-in_.2s_ease-out_both] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]" aria-label="Dostępna aktualizacja">
    <div className="flex items-start gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Download size={17}/></div>
      <div className="min-w-0 flex-1"><strong className="text-[12px]">{phase === 'downloaded' ? 'Aktualizacja gotowa' : `Nowa wersja ${status.version}`}</strong>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{phase === 'downloaded' ? 'Zapisz pracę i uruchom ponownie, aby zainstalować.' : 'Pobierz nową wersję Fiszek bez wychodzenia z aplikacji.'}</p></div>
      <Button.Icon label="Przypomnij później" tooltip={false} size="sm" className="!size-6 !min-h-0" onClick={() => setDismissed(noticeId)}><X size={15}/></Button.Icon>
    </div>
    <div className="mt-3 flex justify-end gap-2">
      <Button size="sm" intent="ghost" color="neutral" onClick={() => setDismissed(noticeId)}>Później</Button>
      {phase === 'available'
        ? <Button size="sm" intent="solid" color="primary" onClick={() => void download().catch(() => undefined)}>Pobierz</Button>
        : <Button size="sm" intent="solid" color="primary" icon={<RefreshCw size={14}/>} onClick={() => void onInstall()}>Zainstaluj</Button>}
    </div>
  </aside>
}

export default UpdateNotice
