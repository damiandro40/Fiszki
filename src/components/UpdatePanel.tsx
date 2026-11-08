import { CheckCircle2, Download, LoaderCircle, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import Button from './atoms/Button'
import { useUpdater } from '../providers/UpdaterProvider'

interface UpdatePanelProps {
  onInstall: () => Promise<void>
}

const UpdatePanel = ({ onInstall }: UpdatePanelProps) => {
  const { status, check, download } = useUpdater()
  const pending = status.phase === 'checking' || status.phase === 'downloading'
  const available = status.phase === 'available' || status.phase === 'downloading' || status.phase === 'downloaded'
  const description = status.phase === 'unsupported'
    ? 'Aktualizacje sprawdza wyłącznie zainstalowana wersja Windows (NSIS). W trybie developerskim sprawdzanie jest wyłączone.'
    : status.phase === 'checking' ? 'Sprawdzanie wydań GitHub…'
    : status.phase === 'available' ? `Dostępna jest wersja ${status.version}.`
    : status.phase === 'downloading' ? 'Pobieranie aktualizacji…'
    : status.phase === 'downloaded' ? 'Aktualizacja jest pobrana. Możesz ją teraz zainstalować.'
    : status.phase === 'current' ? 'Masz najnowszą dostępną wersję.'
    : status.phase === 'error' ? 'Nie udało się zakończyć operacji. Sprawdź połączenie i spróbuj ponownie.'
    : 'Sprawdź, czy udostępniono nową wersję.'

  return <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--accent-ink)]">
        {pending ? <LoaderCircle className="spinning" size={20}/> : available ? <Download size={20}/> : <ShieldCheck size={20}/>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Fiszki {status.currentVersion}</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{description}</p>
      </div>
      {status.phase === 'current' && <CheckCircle2 className="shrink-0 text-[var(--green)]" size={18}/>}
    </div>
    {status.phase === 'downloading' && <div className="space-y-2" role="status" aria-label="Postęp pobierania aktualizacji">
      <div className="flex justify-between text-[11px] text-[var(--muted)]"><span>Pobieranie</span><span className="tabular-nums">{Math.round(status.percent || 0)}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${status.percent || 0}%` }}/></div>
    </div>}
    {status.phase === 'error' && status.error && <div role="alert" className="rounded-lg bg-[var(--red-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--red)]">{status.error}</div>}
    <div className="flex flex-wrap gap-2">
      {(status.phase === 'idle' || status.phase === 'current' || status.phase === 'error') &&
        <Button size="sm" intent="outline" color="neutral" disabled={pending} icon={<RefreshCw size={15}/>} onClick={() => void check().catch(() => undefined)}>Sprawdź aktualizacje</Button>}
      {status.phase === 'available' &&
        <Button size="sm" intent="solid" color="primary" icon={<Download size={15}/>} onClick={() => void download().catch(() => undefined)}>Pobierz aktualizację</Button>}
      {status.phase === 'downloaded' &&
        <Button size="sm" intent="solid" color="primary" icon={<RotateCcw size={15}/>} onClick={() => void onInstall()}>Zainstaluj i uruchom ponownie</Button>}
    </div>
    <p className="text-[11px] leading-relaxed text-[var(--muted)]">
      Źródło aktualizacji: <span className="font-medium text-[var(--text)]">GitHub Releases · damiandro40/Fiszki</span>
    </p>
  </div>
}

export default UpdatePanel
