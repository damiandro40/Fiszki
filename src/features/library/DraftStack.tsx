import { useMemo, useState } from 'react'
import { FilePenLine } from 'lucide-react'
import type { Deck, PendingCardDraft } from '../../types/model'
import { textFromDoc } from '../../lib/tree'
import Button from '../../components/atoms/Button'

interface DraftStackProps {
  drafts: PendingCardDraft[]
  decks: Deck[]
  onResume: (draftId: string) => void
}

// The drafts are stored independently; this is only a compact hover/focus menu.
const DraftStack = ({ drafts, decks, onResume }: DraftStackProps) => {
  const [pinned, setPinned] = useState(false)
  const deckNames = useMemo(() => new Map(decks.map(deck => [deck.id, deck.name])), [decks])

  return <div className="group fixed bottom-6 right-6 z-[220] max-w-[calc(100vw-32px)] max-[740px]:bottom-4 max-[740px]:right-4"
    onPointerLeave={() => setPinned(false)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPinned(false) }}>
    <div id="draft-popover" role="region" aria-label="Zapisane wersje robocze"
      className={`pointer-events-none invisible absolute bottom-full right-0 w-[min(282px,calc(100vw-32px))] pb-2 opacity-0 transition-[opacity,visibility,transform] duration-150 ease-out translate-y-1 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 ${pinned ? '!pointer-events-auto !visible !translate-y-0 !opacity-100' : ''}`}>
      <div className="max-h-[min(310px,55vh)] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]">
        {drafts.map(draft => {
          const title = textFromDoc(draft.front).trim().replace(/\s+/g, ' ').slice(0, 120) || 'Nowa fiszka'
          return <Button key={draft.draftId} layout="row" size="sm" intent="ghost" color="neutral"
            className="min-h-[43px] w-full min-w-0 justify-start border-0 px-2.5 py-1.5 text-left"
            title={title} onClick={() => { setPinned(false); onResume(draft.draftId) }}>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="w-full truncate text-[12px] font-semibold text-[var(--text)]">{title}</span>
              <span className="w-full truncate text-[10.5px] font-normal text-[var(--faint)]">{deckNames.get(draft.deckId) || 'Zestaw'}</span>
            </span>
          </Button>
        })}
      </div>
    </div>
    <Button intent="solid" color="primary" size="md" icon={<FilePenLine size={16}/>} className="min-h-[42px] rounded-xl px-3.5 shadow-[0_5px_18px_var(--tile-hover-shadow)]"
      aria-expanded={pinned} aria-controls="draft-popover"
      aria-label={`Wersje robocze: ${drafts.length}`}
      onClick={() => setPinned(value => !value)}>
      Wersje robocze <span className="ml-0.5 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{drafts.length}</span>
    </Button>
  </div>
}

export default DraftStack
