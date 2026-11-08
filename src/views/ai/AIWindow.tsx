import { useEffect, useState } from 'react'
import { Maximize2, Minus, Sparkles, Square, X } from 'lucide-react'
import type { LibraryData, ThemePreference } from '../../types/model'
import AIStudio from '../../features/ai/AIStudio'
import { useTheme } from '../../hooks/useTheme'

const AIWindow = () => {
  const [data, setData] = useState<LibraryData | null>(null)
  const [deckId, setDeckId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [maximized, setMaximized] = useState(false)
  const [error, setError] = useState('')
  useTheme((data?.preferences.theme || 'system') as ThemePreference)

  useEffect(() => window.flashcards.onMaximizeChange(setMaximized), [])

  useEffect(() => {
    let mounted = true
    void window.flashcards.aiWindowInfo().then(info => {
      if (mounted) { setData(info.data); setDeckId(info.deckId || info.data.decks[0]?.id || null) }
    }).catch(() => { if (mounted) setError('Nie udało się otworzyć asystenta.') })
    const unsubscribe = window.flashcards.onAiWindowContext(setDeckId)
    const update = window.flashcards.onLibraryExternalUpdate(() => {
      void window.flashcards.load().then(next => { if (mounted) setData(next) }).catch(() => { if (mounted) setError('Nie udało się odświeżyć biblioteki.') })
    })
    return () => { mounted = false; unsubscribe(); update() }
  }, [])

  useEffect(() => {
    if (!data || data.decks.some(item => item.id === deckId)) return
    setDeckId(data.decks[0]?.id || null)
  }, [data, deckId])

  return <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
    <header className="flex h-[43px] shrink-0 select-none items-center justify-between border-b border-[var(--border)] bg-[var(--sidebar)] [-webkit-app-region:drag]" onDoubleClick={() => void window.flashcards.toggleMaximize()}>
      <div className="flex min-w-0 items-center gap-2.5 pl-4 text-xs [&_svg]:text-[var(--accent-ink)] [&_span]:max-w-[210px] [&_span]:truncate [&_span]:text-[10px] [&_span]:text-[var(--muted)]"><Sparkles size={17}/><strong>Asystent AI</strong><span>{deckId ? data?.decks.find(deck => deck.id === deckId)?.name : 'Fiszki'}</span></div>
      <div className="flex h-full items-stretch [-webkit-app-region:no-drag]" onDoubleClick={event => event.stopPropagation()}>
        <button type="button" className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] [-webkit-app-region:no-drag]" aria-label="Minimalizuj asystenta" onClick={() => void window.flashcards.minimizeWindow()}><Minus size={18}/></button>
        <button type="button" className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--surface-3)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)] [-webkit-app-region:no-drag]" aria-label={maximized ? 'Przywróć okno' : 'Maksymalizuj okno'} onClick={() => void window.flashcards.toggleMaximize()}>{maximized ? <Maximize2 size={14}/> : <Square size={14}/>}</button>
        <button type="button" className="grid h-full w-[47px] place-items-center border-0 bg-transparent p-0 text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:bg-[#d34752] enabled:hover:text-white enabled:active:bg-[#ac3540] [-webkit-app-region:no-drag]" aria-label="Zamknij asystenta" onClick={() => void window.flashcards.closeWindow()}><X size={18}/></button>
      </div>
    </header>
    <main className="ai-window-body flex min-h-0 min-w-0 flex-1 flex-col">
      {data ? <AIStudio compact data={data} deckId={deckId} revision={revision}
        onDeckChange={setDeckId} onConnectionChange={() => setRevision(previous => previous + 1)}
        onBackToDeck={() => { if (deckId) void window.flashcards.aiFocusDeck(deckId) }}
        onCreateCards={async (id, cards, model) => {
          const count = await window.flashcards.aiSaveCards(id, cards, model)
          setData(await window.flashcards.load())
          return count
        }}/>
        : <div className="grid flex-1 place-items-center text-xs text-[var(--muted)]" role="status">{error || 'Wczytywanie asystenta…'}</div>}
    </main>
  </div>
}

export default AIWindow
