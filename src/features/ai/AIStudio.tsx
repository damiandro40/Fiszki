import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpenText, CheckCircle2, LoaderCircle, LogIn, MessageSquareText,  Sparkles, X } from 'lucide-react'
import type { AiAttachment, AiAuthPhase, AiHistoryMessage, AiMessage, AiModel, AiSession, GeneratedCard, LibraryData } from '../../types/model'
import { chatInstructions, contentToDoc, generationInstructions, parseGeneratedCards } from '../../lib/aiCards'
import { requestedCardCount, wantsConversationInsteadOfCards } from '../../lib/aiIntent'
import { textFromDoc } from '../../lib/tree'
import { describeAiError } from '../../lib/aiErrors'
import Button from '../../components/atoms/Button'
import Select from '../../components/atoms/Select'
import AIComposer from './AIComposer'
import AIMessageList from './AIMessageList'
import RichContent from '../editor/RichContent'
import { convertFile } from './attachments'

interface AIStudioProps {
  compact?: boolean
  data: LibraryData
  revision: number
  deckId: string | null
  onBackToDeck: () => void
  onDeckChange?: (deckId: string | null) => void
  onConnectionChange: () => void
  onCreateCards: (deckId: string, cards: GeneratedCard[], model: string) => Promise<number>
}

type Message = AiHistoryMessage
const historyKey = (deckId: string | null) => deckId || '__library__'
const MAX_COMPOSER_ATTACHMENTS = 4
const authMessages: Record<AiAuthPhase, string> = {
  browser: 'Potwierdź logowanie w przeglądarce…',
  callback: 'Przeglądarka przekazała autoryzację. Łączenie konta…',
  tokens: 'Weryfikowanie uprawnień ChatGPT…',
  verified: 'Tożsamość zweryfikowana. Zapisywanie połączenia…'
}

const AIStudio = ({ compact = false, data, revision, deckId, onBackToDeck, onDeckChange, onConnectionChange, onCreateCards }: AIStudioProps) => {
  const [session, setSession] = useState<AiSession>({ connected: false, sharing: false, email: null, name: null })
  const [models, setModels] = useState<AiModel[]>([])
  const [model, setModel] = useState('')
  const [messagesByDeck, setMessagesByDeck] = useState<Record<string, Message[]>>({})
  const [historyLoaded, setHistoryLoaded] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<AiAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [authPhase, setAuthPhase] = useState<AiAuthPhase>('browser')
  const [modelsLoading, setModelsLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [usageLimitReached, setUsageLimitReached] = useState(false)
  const [lastCreated, setLastCreated] = useState<{ deckId: string, cards: GeneratedCard[] } | null>(null)
  const [targetDeck, setTargetDeck] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentRequest = useRef<string | null>(null)
  const currentRequestDeck = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const generatingRef = useRef(false)
  const key = historyKey(deckId)
  const visibleMessages = messagesByDeck[key] || []
  const visibleRef = useRef(visibleMessages)
  visibleRef.current = visibleMessages

  const destination = compact ? deckId || '' : deckId || targetDeck
  const activeDeck = data.decks.find(item => item.id === destination)
  const deckOptions = useMemo(() => data.decks.map(item => ({
    value: item.id, label: `${data.folders.find(folder => folder.id === item.folderId)?.name || 'Biblioteka'} / ${item.name}`
  })), [data.decks, data.folders])

  const context = useMemo(() => activeDeck ? {
    name: activeDeck.name,
    existingCards: data.cards.filter(card => card.deckId === activeDeck.id).slice(-24).map(card => ({
      front: textFromDoc(card.front).slice(0, 150), back: textFromDoc(card.back).slice(0, 230)
    }))
  } : undefined, [activeDeck, data.cards])

  useEffect(() => {
    if (!targetDeck || !data.decks.some(item => item.id === targetDeck)) setTargetDeck(data.decks[0]?.id || '')
  }, [data.decks, targetDeck])

  useEffect(() => {
    let alive = true
    setInitializing(true)
    const update = async () => {
      try {
        const status = await window.flashcards.aiStatus()
        if (!alive) return
        setSession(status)
        if (status.sharing) {
          setModelsLoading(true)
          try {
            const available = await window.flashcards.aiModels()
            if (alive) {
              setModels(available)
              setModel(previous => available.some(item => item.id === previous) ? previous : available[0]?.id || '')
            }
          } finally { if (alive) setModelsLoading(false) }
        } else { setModels([]); setModel('') }
      } catch (cause) { if (alive) setError(describeAiError(cause).message) }
      finally { if (alive) setInitializing(false) }
    }
    void update()
    return () => { alive = false }
  }, [revision])

  useEffect(() => window.flashcards.onAiAuthProgress(setAuthPhase), [])

  // Closing the assistant cancels streaming and invalidates unfinished async results.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (currentRequest.current) void window.flashcards.aiCancel()
    }
  }, [])

  // Read the transcript only on first visit. Switching sets never merges their histories.
  useEffect(() => {
    if (!data.decks.some(item => item.id === deckId) || historyLoaded[key]) return
    let cancelled = false
    void window.flashcards.aiHistoryLoad(deckId).then(saved => {
      if (cancelled) return
      setMessagesByDeck(previous => ({ ...previous, [key]: saved }))
      setHistoryLoaded(previous => ({ ...previous, [key]: true }))
    }).catch(() => { if (!cancelled) setError('Nie udało się wczytać historii rozmowy. Nie nadpisano poprzedniego zapisu.') })
    return () => { cancelled = true }
  }, [key, deckId, historyLoaded])

  useEffect(() => window.flashcards.onUpdaterPrepare(async () => {
    if (generatingRef.current) throw new Error('Zakończ generowanie odpowiedzi przed aktualizacją.')
    if (data.decks.some(item => item.id === deckId) && historyLoaded[key]) {
      await window.flashcards.aiHistorySave(deckId, visibleRef.current.filter(message => message.content.trim() || message.attachments?.length).slice(-100))
    }
  }), [data.decks, deckId, historyLoaded, key])

  // Debounced local persistence. History is not included in the library backup or OpenAI token store.
  useEffect(() => {
    if (!data.decks.some(item => item.id === deckId) || !historyLoaded[key]) return
    let active = true
    const timeout = window.setTimeout(() => {
      void window.flashcards.aiHistorySave(deckId, visibleMessages.filter(message => message.content.trim() || message.attachments?.length).slice(-100)).catch(() => {
        if (active) setError('Nie udało się zapisać rozmowy na urządzeniu.')
      })
    }, 450)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [deckId, key, visibleMessages, historyLoaded])

  // Update only the active transcript instead of remapping every saved conversation on each token.
  useEffect(() => window.flashcards.onAiDelta((id, delta) => {
    const deck = currentRequestDeck.current
    if (id !== currentRequest.current || !deck || generatingRef.current) return
    setMessagesByDeck(previous => {
      const messages = previous[deck]
      if (!messages) return previous
      return { ...previous, [deck]: messages.map(message => message.id === id ? { ...message, content: message.content + delta } : message) }
    })
  }), [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [visibleMessages, busy, deckId])

  const appendTo = (deck: string, message: Message) => setMessagesByDeck(previous => ({ ...previous,
    [deck]: [...(previous[deck] || []), message].slice(-100)
  }))
  const updateResponse = (deck: string, id: string, content: string) => setMessagesByDeck(previous => ({ ...previous,
    [deck]: (previous[deck] || []).map(message => message.id === id ? { ...message, content } : message)
  }))

  const connect = async () => {
    setError(''); setUsageLimitReached(false); setAuthPhase('browser'); setConnecting(true)
    try {
      const connected = await window.flashcards.aiConnect()
      if (mountedRef.current) { setSession(connected); onConnectionChange() }
    } catch (cause) {
      if (mountedRef.current) setError(describeAiError(cause).message)
    } finally {
      if (mountedRef.current) setConnecting(false)
    }
  }

  const addFiles = async (files: File[]) => {
    if (attachments.length + files.length > MAX_COMPOSER_ATTACHMENTS) { setError('Możesz dodać maksymalnie cztery załączniki do wiadomości.'); return }
    try {
      const converted = await Promise.all(files.map(convertFile))
      if (!mountedRef.current) return
      setAttachments(previous => previous.length + converted.length <= MAX_COMPOSER_ATTACHMENTS ? [...previous, ...converted] : previous)
      setError('')
    } catch (cause) { if (mountedRef.current) setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać pliku.') }
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if ((!text && !attachments.length) || !activeDeck || busy || currentRequest.current || !session.sharing || !model || usageLimitReached || !historyLoaded[key]) return
    const conversationOnly = wantsConversationInsteadOfCards(text)
    let count: number | null = null
    try { if (!conversationOnly) count = requestedCardCount(text) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Niepoprawna liczba fiszek.'); return }
    if (!conversationOnly && (!destination || !data.decks.some(item => item.id === destination))) {
      setError('Wybierz zestaw, do którego zapisać fiszki.'); return
    }

    const deckKey = key
    const deckTarget = destination
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text, attachments, createdAt: new Date().toISOString() }
    const requestId = crypto.randomUUID()
    const assistant: Message = { id: requestId, role: 'assistant', content: '', createdAt: new Date().toISOString() }
    const recent = visibleRef.current.filter(message => message.content.trim() || message.attachments?.length).slice(-12)
    // Keep older turns as text context; avoid repeatedly uploading large attachments.
    const conversation: AiMessage[] = recent.map(({ role, content, attachments }, index) => ({
      role, content, attachments: index >= recent.length - 3 ? attachments : undefined
    }))
    conversation.push({ role: 'user', content: text, attachments })
    const instructions = conversationOnly ? chatInstructions(context) : generationInstructions(count, context)

    appendTo(deckKey, userMessage)
    appendTo(deckKey, assistant)
    setDraft(''); setAttachments([])
    setBusy(true); setError(''); setUsageLimitReached(false)
    currentRequest.current = requestId
    currentRequestDeck.current = deckKey
    generatingRef.current = !conversationOnly
    try {
      const result = await window.flashcards.aiSend({ id: requestId, model, messages: conversation, instructions })
      if (!mountedRef.current || currentRequest.current !== requestId) return
      if (!conversationOnly) {
        let parsed: GeneratedCard[]
        try { parsed = parseGeneratedCards(result) }
        catch {
          // Some models accidentally return an explanation. Make one structured retry.
          const retry = await window.flashcards.aiSend({ id: crypto.randomUUID(), model,
            messages: [...conversation, { role: 'assistant', content: result.slice(0, 4000) },
              { role: 'user', content: 'Poprzednia odpowiedź nie była poprawnym JSON. Zwróć wyłącznie kompletny obiekt {"cards":[...]} z fiszkami do zapisania.' }],
            instructions })
          if (!mountedRef.current || currentRequest.current !== requestId) return
          parsed = parseGeneratedCards(retry)
        }
        const savedCount = await onCreateCards(deckTarget, parsed, model)
        if (!mountedRef.current) return
        setLastCreated({ deckId: deckTarget, cards: parsed })
        updateResponse(deckKey, requestId, `**Zapisano ${savedCount} fiszek** w zestawie „${data.decks.find(item => item.id === deckTarget)?.name || 'wybranym'}”.\n\nKarty zostały oznaczone jako wygenerowane przez AI i oczekują na weryfikację.`)
      } else updateResponse(deckKey, requestId, result)
    } catch (cause) {
      if (!mountedRef.current) return
      const failure = describeAiError(cause)
      setError(failure.message)
      setUsageLimitReached(failure.usageLimited)
      setDraft(previous => previous.trim() ? previous : text)
      setAttachments(previous => previous.length ? previous : userMessage.attachments || [])
      // A failed request is restored to the composer, not added twice to future context.
      setMessagesByDeck(previous => ({ ...previous,
        [deckKey]: (previous[deckKey] || []).filter(message => message.id !== requestId && message.id !== userMessage.id)
      }))
    } finally {
      if (mountedRef.current) setBusy(false)
      if (currentRequest.current === requestId) {
        currentRequest.current = null
        currentRequestDeck.current = null
      }
      generatingRef.current = false
    }
  }

  return <div className={`ai-page relative isolate flex h-full min-h-0 flex-col ${compact ? 'flex-1 !gap-0 !p-0' : 'gap-5 px-7 py-6'}`}>
    <div className={`absolute inset-0 z-40 grid place-items-center bg-[var(--surface)] transition-[opacity,visibility] duration-200 ${initializing || modelsLoading ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'}`} aria-hidden={!(initializing || modelsLoading)}>
      <div className="flex flex-col items-center gap-3 text-center text-xs text-[var(--muted)] [&_svg]:text-[var(--accent-ink)] [&_strong]:text-[15px] [&_strong]:text-[var(--text)]" role={initializing || modelsLoading ? 'status' : undefined}>
        <LoaderCircle className="spinning" size={28}/><strong>Przygotowuję Asystenta AI</strong><span>Sprawdzam połączenie i modele…</span>
      </div>
    </div>
    {!compact && <div className="flex shrink-0 items-center justify-between gap-5"><div className="flex items-center gap-4 [&_h1]:m-0 [&_h1]:text-[28px] [&_h1]:font-extrabold [&_h1]:tracking-tight [&_p]:mt-1.5 [&_p]:text-xs [&_p]:text-[var(--muted)]"><div className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Sparkles size={24}/></div><div>
      <h1>Asystent AI</h1><p>Twórz fiszki bezpośrednio w swoich zestawach.</p>
    </div></div></div>}
    {!data.decks.length ? <div className="m-auto flex max-w-[400px] flex-col items-center justify-center gap-3.5 px-6 py-10 text-center">
      <div className="grid size-[66px] place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--muted)]"><BookOpenText size={29}/></div>
      <h2 className="text-lg font-bold">Utwórz pierwszy zestaw</h2>
      <p className="text-xs leading-relaxed text-[var(--muted)]">Asystent AI działa w kontekście zestawu fiszek. Utwórz zestaw w bibliotece, aby rozpocząć rozmowę.</p>
    </div> : !session.sharing ? <div className="m-auto flex max-w-[620px] flex-col items-center justify-center gap-4 px-5 py-10 text-center [&_h2]:m-0 [&_h2]:text-2xl [&_h2]:font-extrabold [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-[var(--muted)]"><div className="grid size-[76px] place-items-center rounded-[22px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Sparkles size={38}/></div>
      <h2>{session.connected ? 'Brak dostępu do planu' : 'Połącz ChatGPT'}</h2>
      <p>{session.connected ? 'Konto nie udzieliło wymaganego uprawnienia.' : 'Połączenie jest dobrowolne. Zwykłe fiszki działają bez internetu.'}</p>
      <Button intent="solid" color="primary" disabled={connecting} icon={connecting ? <LoaderCircle className="spinning" size={18}/> : <LogIn size={18}/>} onClick={() => void connect()}>{connecting ? 'Trwa autoryzacja…' : 'Połącz z ChatGPT'}</Button>
      {connecting && <div role="status" className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs">{authMessages[authPhase]}</div>}
    </div> : <div className={`min-h-0 flex-1 gap-4 ${compact ? 'flex min-w-0 flex-col overflow-hidden' : 'grid grid-cols-[minmax(350px,1fr)_minmax(270px,350px)]'}`}>
      <section className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface)] ${compact ? 'flex-1' : 'rounded-xl border border-[var(--border)]'}`}>
        <div className="flex min-h-[65px] items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3"><div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] [&_small]:ml-6 [&_small]:block [&_small]:w-full [&_small]:truncate [&_small]:text-[10px] [&_small]:text-[var(--faint)] [&_svg]:text-[var(--accent-ink)]"><MessageSquareText size={16}/><strong>Rozmowa</strong><small>{activeDeck?.name || 'Brak zestawu'}</small></div>
          <div className="w-[190px] max-w-[46%] shrink-0 text-[11px]"><Select value={model} onChange={setModel} disabled={busy || modelsLoading} options={models.map(item => ({ value: item.id, label: item.name }))} placeholder="Model ChatGPT" ariaLabel="Model ChatGPT"/></div>
        </div>
        {compact && <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-2.5 [&_label]:w-[115px] [&_label]:shrink-0 [&_label]:text-[10px] [&_label]:text-[var(--muted)] [&>div]:min-w-0 [&>div]:flex-1"><label>Pracujesz nad zestawem</label><Select value={deckId || data.decks[0]?.id || ''} disabled={busy} onChange={id => onDeckChange?.(id || null)} options={deckOptions} searchable placeholder="Zestaw fiszek" ariaLabel="Kontekst zestawu dla asystenta"/></div>}
        {compact && lastCreated && lastCreated.deckId === deckId && <div className="flex shrink-0 items-center gap-2 border-b border-[var(--green)]/25 bg-[var(--green-soft)] px-3 py-2 text-[10px] text-[var(--green)]"><CheckCircle2 size={16}/><span>Zapisano {lastCreated.cards.length} fiszek · do weryfikacji</span></div>}
        <AIMessageList scrollRef={scrollRef} loaded={!!historyLoaded[key]} messages={visibleMessages}/>
        <div className="shrink-0 px-3.5 pb-3.5 pt-2"><AIComposer value={draft} attachments={attachments}
          disabled={busy || !activeDeck} sending={busy}
          sendDisabled={!activeDeck || (!draft.trim() && !attachments.length) || !model || usageLimitReached || !historyLoaded[key]}
          onChange={setDraft} onFiles={files => void addFiles(files)}
          onRemove={id => setAttachments(previous => previous.filter(item => item.id !== id))}
          onSubmit={() => void sendMessage()} onCancel={() => void window.flashcards.aiCancel()}/>
        </div>
      </section>
      <aside className={`min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] ${compact ? 'hidden' : 'flex'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-4 [&_strong]:text-[13px] [&_p]:mt-1 [&_p]:text-[11px] [&_p]:text-[var(--muted)]"><div><strong>Fiszki w zestawie</strong><p>Nowe karty zapisują się automatycznie.</p></div></div>
        {!activeDeck && !compact && <div className="border-t border-[var(--border-subtle)] p-4 text-xs text-[var(--muted)]">Brak aktywnego zestawu.</div>}
        {lastCreated && (lastCreated.deckId === deckId || deckId === null) ? <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3 text-xs text-[var(--accent-ink)] [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_span]:text-[10px] [&_span]:text-[var(--muted)]"><CheckCircle2 size={19}/><div><strong>Zapisano {lastCreated.cards.length} fiszek</strong><span>Do weryfikacji</span></div></div>
          {lastCreated.cards.map((card, index) => <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3" key={`${index}-${card.front.slice(0, 15)}`}><div className="flex items-center justify-between gap-2 text-[9px] font-extrabold tracking-wider text-[var(--faint)] [&_span:last-child]:rounded [&_span:last-child]:bg-[var(--accent-soft)] [&_span:last-child]:px-1.5 [&_span:last-child]:py-0.5 [&_span:last-child]:text-[var(--accent-ink)]"><span>FISZKA {index + 1}</span><span>{card.kind === 'cloze' ? 'Luka' : card.kind === 'definition' ? 'Definicja' : 'Pytanie'}</span></div>
            <RichContent compact content={contentToDoc(card.front)}/><RichContent compact content={contentToDoc(card.back)}/>
          </div>)}
          {activeDeck && <Button size="sm" onClick={onBackToDeck} icon={<ArrowLeft size={15}/>}>Sprawdź fiszki</Button>}
        </div> : <div className="m-auto flex max-w-[255px] flex-col items-center gap-3.5 px-6 py-8 text-center text-xs leading-relaxed text-[var(--faint)] [&_svg]:text-[var(--accent-ink)]"><CheckCircle2 size={28}/><p>{activeDeck ? `Fiszki trafią do zestawu „${activeDeck.name}”.` : 'Wybierz zestaw do zapisu fiszek.'}</p></div>}
      </aside>
    </div>}
    {error && <div className={`fixed bottom-6 right-6 z-[10000] flex max-w-[min(520px,calc(100vw-32px))] flex-wrap items-start gap-2.5 rounded-xl border border-[var(--red)] bg-[var(--red-soft)] p-3 text-xs text-[var(--red)] shadow-[var(--shadow)] [&>span]:min-w-0 [&>span]:flex-1 ${usageLimitReached ? 'ai-usage-error' : ''}`} role="alert"><AlertCircle size={17}/><span>{error}</span>
      {usageLimitReached && <button className="inline-flex items-center rounded-lg border border-current bg-transparent px-2 py-1.5 text-[11px] font-semibold transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--danger-hover-bg)] enabled:active:bg-[var(--danger-active-bg)]" onClick={() => void window.flashcards.aiManageUsage()}>Zarządzaj limitami</button>}
      <button className="ml-auto grid size-6 place-items-center rounded-md text-inherit transition-colors enabled:cursor-pointer enabled:hover:bg-[var(--danger-hover-bg)] enabled:active:bg-[var(--danger-active-bg)]" aria-label="Zamknij błąd" onClick={() => { setError(''); setUsageLimitReached(false) }}><X size={16}/></button>
    </div>}
  </div>
}

export default AIStudio
