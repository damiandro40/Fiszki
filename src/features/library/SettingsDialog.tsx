import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  Download, Monitor, Moon, Sun, Upload, Sparkles,
  LogIn, LogOut, LoaderCircle, Palette, GraduationCap, Database,
  RotateCcw, Keyboard, ShieldCheck, Shuffle, PanelTop, RefreshCw
} from 'lucide-react'
import type { AiAuthPhase, AiSession, Preferences, ThemePreference } from '../../types/model'
import type { StudyAction, StudyKeymap } from '../../lib/studyKeys'
import { DEFAULT_STUDY_KEYS, displayStudyKey, isAssignableStudyKey, normalizeStudyKeys } from '../../lib/studyKeys'
import Button from '../../components/atoms/Button'
import Modal from '../../components/Modal'
import { describeAiError } from '../../lib/aiErrors'
import UpdatePanel from '../../components/UpdatePanel'

interface SettingsDialogProps {
  preferences: Preferences
  onClose: () => void
  onChange: (preferences: Preferences) => void
  onPreviewTheme: (theme: ThemePreference) => void
  onExport: () => void
  onImport: () => void
  aiRevision: number
  onAIConnectionChange: () => void
  onInstallUpdate: () => Promise<void>
}

type SettingsSection = 'appearance' | 'study' | 'ai' | 'data' | 'updates'

const sections = [
  { id: 'appearance', title: 'Wygląd', icon: Palette },
  { id: 'study', title: 'Nauka', icon: GraduationCap },
  { id: 'ai', title: 'Asystent AI', icon: Sparkles },
  { id: 'data', title: 'Dane', icon: Database },
  { id: 'updates', title: 'Aktualizacje', icon: RefreshCw }
] as const

const keyActions: { action: StudyAction, title: string, description: string }[] = [
  { action: 'flip', title: 'Odwróć fiszkę', description: 'Pokaż pytanie lub odpowiedź' },
  { action: 'again', title: 'Nie umiem', description: 'Oznacz jako nieopanowaną i przejdź dalej' },
  { action: 'known', title: 'Umiem', description: 'Oznacz jako opanowaną i przejdź dalej' },
  { action: 'undo', title: 'Cofnij ocenę', description: 'Przywróć poprzednią fiszkę i jej ocenę' }
]

const SettingsDialog = ({ preferences, onClose, onChange, onPreviewTheme, onExport, onImport, aiRevision, onAIConnectionChange, onInstallUpdate }: SettingsDialogProps) => {
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [theme, setTheme] = useState<ThemePreference>(preferences.theme)
  const [shuffle, setShuffle] = useState(preferences.shuffle)
  const [studyInSeparateWindow, setStudyInSeparateWindow] = useState(preferences.studyInSeparateWindow ?? false)
  const [keys, setKeys] = useState<StudyKeymap>(() => normalizeStudyKeys(preferences.studyKeys))
  const [capturing, setCapturing] = useState<StudyAction | null>(null)
  const [keyError, setKeyError] = useState('')
  const [aiSession, setAiSession] = useState<AiSession | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [aiError, setAiError] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [authPhase, setAuthPhase] = useState<AiAuthPhase>('browser')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => window.flashcards.onAiAuthProgress(setAuthPhase), [])

  useEffect(() => {
    let active = true
    void window.flashcards.aiStatus()
      .then(session => { if (active) setAiSession(session) })
      .catch(error => { if (active) setAiError(describeAiError(error).message) })
    return () => { active = false }
  }, [aiRevision])

  const captureKey = (event: KeyboardEvent<HTMLButtonElement>, action: StudyAction) => {
    if (capturing !== action) return
    event.preventDefault()
    event.stopPropagation()
    // Escape is intentionally not an assignment or a cancel shortcut.
    // Consume it here so it cannot dismiss the settings modal while capturing.
    if (event.key === 'Escape') return
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !isAssignableStudyKey(event.code)) {
      setKeyError('Wybierz pojedynczą literę, cyfrę, strzałkę, Spację lub Enter.')
      return
    }
    if (Object.entries(keys).some(([name, value]) => name !== action && value === event.code)) {
      setKeyError('Ten klawisz jest już przypisany do innej akcji.')
      return
    }
    setKeys(previous => ({ ...previous, [action]: event.code }))
    setCapturing(null)
    setKeyError('')
  }

  const connectChatGPT = async () => {
    setAiError('')
    setAuthPhase('browser')
    setConnecting(true)
    try {
      const session = await window.flashcards.aiConnect()
      if (mountedRef.current) { setAiSession(session); onAIConnectionChange() }
    } catch (error) {
      if (mountedRef.current) setAiError(describeAiError(error).message)
    } finally {
      if (mountedRef.current) setConnecting(false)
    }
  }

  const disconnectChatGPT = async () => {
    if (disconnecting) return
    setAiError('')
    setDisconnecting(true)
    try {
      await window.flashcards.aiDisconnect()
      if (mountedRef.current) setAiSession({ connected: false, sharing: false, email: null, name: null })
      onAIConnectionChange()
    } catch (error) {
      if (mountedRef.current) setAiError(describeAiError(error).message)
    } finally {
      if (mountedRef.current) {
        setDisconnecting(false)
        setConfirmDisconnect(false)
      }
    }
  }

  const save = () => {
    onChange({ ...preferences, theme, shuffle, studyInSeparateWindow, studyKeys: keys })
    onClose()
  }

  return <><Modal title="Ustawienia" onClose={onClose} wide kind="settings"
    footer={<><Button onClick={onClose}>Anuluj</Button><Button intent="solid" color="primary" onClick={save}>Zapisz ustawienia</Button></>}>
    <div className="grid h-full min-h-0 w-full flex-1 grid-cols-[200px_minmax(0,1fr)] overflow-hidden max-[700px]:grid-cols-[150px_minmax(0,1fr)]" data-study-shortcuts-block>
      <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--sidebar)] p-3 max-[700px]:p-2" aria-label="Sekcje ustawień">
        {sections.map(item => {
          const Icon = item.icon
          return <Button layout="row" intent="ghost" icon={<Icon size={18} />} key={item.id} aria-current={section === item.id ? 'page' : undefined} selected={section === item.id}
            className="min-h-[42px] gap-3 px-3 py-2.5 text-[12.5px]"
            onClick={() => { setSection(item.id); setCapturing(null); setKeyError('') }}>
            <span><strong>{item.title}</strong></span>
          </Button>
        })}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 max-[700px]:p-4">
          {section === 'appearance' && <section aria-label="Wygląd">
            <h3 className="mb-2 text-xl font-bold tracking-tight">Wygląd</h3>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Dostosuj wygląd aplikacji do własnych potrzeb.</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'light', label: 'Jasny', icon: <Sun size={20} /> },
                { value: 'dark', label: 'Ciemny', icon: <Moon size={20} /> },
                { value: 'system', label: 'Systemowy', icon: <Monitor size={20} /> }
              ] as const).map(item => <button key={item.value} type="button" className={`flex min-h-[83px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors enabled:cursor-pointer ${theme === item.value ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)] enabled:hover:bg-[var(--blue-soft)] enabled:active:bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]'}`}
                aria-pressed={theme === item.value} onClick={() => { setTheme(item.value); onPreviewTheme(item.value) }}>
                {item.icon}<span>{item.label}</span>
              </button>)}
            </div>
          </section>}
          {section === 'study' && <section aria-label="Nauka">
            <h3 className="mb-2 text-xl font-bold tracking-tight">Nauka</h3>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Ustaw sposób powtarzania kart i klawisze, których używasz podczas sesji.</p>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-2"><div className="flex min-w-0 items-start gap-3"><Shuffle size={18} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden="true"/><div className="min-w-0"><strong className="block text-xs">Losowa kolejność fiszek</strong><span className="mt-1 block text-[11px] text-[var(--muted)]">Wymieszaj karty na początku każdej nowej sesji.</span></div></div><input type="checkbox" className="relative h-[23px] w-[41px] shrink-0 cursor-pointer appearance-none rounded-full border border-[var(--border)] bg-[var(--surface-3)] before:absolute before:left-[3px] before:top-[3px] before:size-[15px] before:rounded-full before:bg-[var(--muted)] before:transition-transform checked:border-[var(--accent)] checked:bg-[var(--accent)] checked:before:translate-x-[18px] checked:before:bg-white" checked={shuffle} onChange={event => setShuffle(event.target.checked)} /></label>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 py-2">
              <div className="flex min-w-0 items-start gap-3"><PanelTop size={18} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden="true"/><div className="min-w-0"><strong className="block text-xs">Nauka w osobnym oknie</strong><span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted)]">Oddzielne, minimalistyczne okno bez biblioteki i nawigacji. Możesz przełączać się między oknami podczas nauki.</span></div></div>
              <input type="checkbox" aria-label="Nauka w osobnym oknie" className="relative h-[23px] w-[41px] shrink-0 cursor-pointer appearance-none rounded-full border border-[var(--border)] bg-[var(--surface-3)] before:absolute before:left-[3px] before:top-[3px] before:size-[15px] before:rounded-full before:bg-[var(--muted)] before:transition-transform checked:border-[var(--accent)] checked:bg-[var(--accent)] checked:before:translate-x-[18px] checked:before:bg-white" checked={studyInSeparateWindow} onChange={event => setStudyInSeparateWindow(event.target.checked)}/>
            </label>
            <div className="mb-2 mt-6 flex items-center gap-2 text-xs text-[var(--text)]"><Keyboard size={17}/><strong>Skróty klawiaturowe</strong></div>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Kliknij wybrany skrót i naciśnij nowy klawisz. Akcje „Umiem” i „Nie umiem” przechodzą do kolejnej fiszki.</p>
            <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)]">
              {keyActions.map(item => <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] p-3 last:border-0" key={item.action}>
                <div className="flex min-w-0 flex-col gap-1"><strong className="text-xs">{item.title}</strong><small className="text-[11px] text-[var(--muted)]">{item.description}</small></div>
                <button type="button" className={`min-h-[37px] min-w-[110px] max-w-[175px] shrink-0 rounded-lg border px-3 py-1 text-[11px] transition-colors enabled:cursor-pointer ${capturing === item.action ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)] enabled:hover:bg-[var(--blue-soft)]' : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]'}`}
                  aria-label={`Przypisz klawisz: ${item.title}`} aria-pressed={capturing === item.action}
                  onClick={() => { setCapturing(capturing === item.action ? null : item.action); setKeyError('') }}
                  onKeyDown={event => captureKey(event, item.action)}>
                  {capturing === item.action ? 'Kliknij, aby anulować' : <kbd className="border-0 bg-transparent px-1 font-bold text-inherit">{displayStudyKey(keys[item.action])}</kbd>}
                </button>
              </div>)}
            </div>
            {keyError && <p className="mt-2 text-[11px] text-[var(--red)]" role="alert">{keyError}</p>}
            <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-md px-1 py-1 text-[11px] text-[var(--muted)] transition-colors enabled:hover:text-[var(--text)] enabled:active:text-[var(--accent-ink)]" onClick={() => { setKeys({ ...DEFAULT_STUDY_KEYS }); setCapturing(null); setKeyError('') }}><RotateCcw size={15}/> Przywróć domyślne klawisze</button>
          </section>}
          {section === 'ai' && <section aria-label="Asystent AI">
            <h3 className="mb-2 text-xl font-bold tracking-tight">Asystent AI</h3>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Połączenie konta ChatGPT jest opcjonalne. Bez niego możesz nadal korzystać ze wszystkich funkcji offline.</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
              <div className="min-w-0"><strong className="mb-2 flex items-center gap-2 text-xs"><Sparkles size={17}/> ChatGPT</strong>
                <span className="block break-words text-xs text-[var(--muted)]">{aiSession?.connected ? <><b className="font-bold text-[var(--muted)]">{aiSession.email || 'Konto ChatGPT'}</b> · {aiSession.sharing ? <span className="font-normal text-[var(--green)]">Połączono z kontem</span> : 'Brak zgody na użycie planu'}</> : 'Nie połączono konta'}</span></div>
              {aiSession?.connected
                ? <Button intent="ghost" color="neutral" icon={<LogOut size={15}/>} disabled={disconnecting} onClick={() => setConfirmDisconnect(true)}>Rozłącz</Button>
                : <Button intent="solid" color="primary" icon={connecting ? <LoaderCircle className="spinning" size={16}/> : <LogIn size={16}/>} disabled={connecting} onClick={() => void connectChatGPT()}>{connecting ? 'Łączenie…' : 'Połącz z ChatGPT'}</Button>}
            </div>
            {connecting && <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">{authPhase === 'browser' ? 'Potwierdź logowanie w przeglądarce…' : authPhase === 'callback' ? 'Odebrano autoryzację z przeglądarki…' : authPhase === 'tokens' ? 'Sprawdzanie uprawnień konta…' : 'Weryfikacja zakończona, zapisywanie sesji…'}</div>}
            {aiError && <div className="mt-3 rounded-lg border border-[var(--red)] bg-[var(--red-soft)] p-3 text-xs text-[var(--red)]" role="alert">{aiError}</div>}
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-[11px] leading-relaxed text-[var(--muted)]"><ShieldCheck size={17}/> Materiały wysyłane do asystenta trafiają do OpenAI. Zwykłe fiszki pozostają zapisane lokalnie.</div>
          </section>}
          {section === 'updates' && <section aria-label="Aktualizacje">
            <h3 className="mb-2 text-xl font-bold tracking-tight">Aktualizacje</h3>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Fiszki sprawdzają nowe wydania automatycznie. Instalacja odbywa się po Twojej zgodzie.</p>
            <UpdatePanel onInstall={onInstallUpdate}/>
          </section>}
          {section === 'data' && <section aria-label="Dane">
            <h3 className="mb-2 text-xl font-bold tracking-tight">Twoje dane</h3>
            <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">Twórz kopie zapasowe biblioteki, oraz przywracaj zapisane zestawy i fiszki.</p>
            <div className="flex flex-col items-stretch gap-2 [&_button]:w-full [&_button]:justify-start">
              <Button icon={<Download size={17}/>} onClick={onExport}>Pobierz kopię danych</Button>
              <Button icon={<Upload size={17}/>} onClick={onImport}>Załaduj dane</Button>
            </div>
          </section>}
        </div>
      </div>
    </div>
  </Modal>
    {confirmDisconnect && <Modal title="Rozłączyć ChatGPT?" onClose={() => setConfirmDisconnect(false)}
      footer={<>
        <Button intent="outline" color="neutral" disabled={disconnecting} data-initial-focus onClick={() => setConfirmDisconnect(false)}>Anuluj</Button>
        <Button intent="solid" color="danger" disabled={disconnecting} icon={disconnecting ? <LoaderCircle className="spinning" size={16}/> : <LogOut size={16}/>} onClick={() => void disconnectChatGPT()}>
          {disconnecting ? 'Rozłączanie…' : 'Rozłącz konto'}
        </Button>
      </>}>
      <div className="px-6 py-5 text-[13px] leading-relaxed text-[var(--muted)]">
        Asystent AI straci dostęp do połączonego konta. Zapisane fiszki i zestawy pozostaną bez zmian.
      </div>
    </Modal>}
  </>
}

export default SettingsDialog
