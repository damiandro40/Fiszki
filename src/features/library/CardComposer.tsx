import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Card, RichDoc, PendingCardDraft } from '../../types/model'
import { emptyDoc } from '../../lib/seed'
import { textFromDoc } from '../../lib/tree'
import Button from '../../components/atoms/Button'
import Modal from '../../components/Modal'
import RichTextEditor from '../editor/RichTextEditor'

interface CardComposerProps {
  initial?: Card | null
  initialDraft?: PendingCardDraft | null
  draftId: string
  onClose: (draft: PendingCardDraft | null) => void
  onSave: (front: RichDoc, back: RichDoc) => void
}

const hasContent = (doc: RichDoc) => textFromDoc(doc).length > 0 || JSON.stringify(doc).includes('"type":"image"') || JSON.stringify(doc).includes('"type":"table"')

const CardComposer = ({ initial, initialDraft, draftId, onClose, onSave }: CardComposerProps) => {
  const [front, setFront] = useState<RichDoc>(initialDraft?.front || initial?.front || emptyDoc())
  const [back, setBack] = useState<RichDoc>(initialDraft?.back || initial?.back || emptyDoc())
  const [error, setError] = useState('')

  const dirty = JSON.stringify(front) !== JSON.stringify(initial?.front || emptyDoc()) ||
    JSON.stringify(back) !== JSON.stringify(initial?.back || emptyDoc())
  const close = (discard = false) => {
    onClose(!discard && dirty ? {
      draftId,
      deckId: initialDraft?.deckId || initial?.deckId || '',
      cardId: initial?.id || initialDraft?.cardId || null,
      front, back, updatedAt: new Date().toISOString()
    } : null)
  }
  const submit = () => {
    if (!hasContent(front) || !hasContent(back)) {
      setError('Przód i tył fiszki muszą zawierać treść.')
      return
    }
    onSave(front, back)
  }

  return <Modal title={initial ? 'Edytuj fiszkę' : 'Nowa fiszka'} onClose={() => close()} wide
    footer={<>{dirty && <Button intent="soft" color="danger" onClick={() => close(true)}>Odrzuć zmiany</Button>}<Button intent="solid" color="primary" icon={<Check size={18} />} onClick={submit}>Zapisz fiszkę</Button></>}>
    <div className="px-6 pb-4 pt-5 max-[600px]:px-4">
      <div className="grid grid-cols-1 items-start gap-5">
        <section className="min-w-0"><h3 className="mb-3 flex items-center justify-between gap-3 text-[13px] font-bold">Przód fiszki <span className="text-[10px] font-extrabold tracking-wider text-[var(--faint)]">PYTANIE / HASŁO</span></h3>
          <RichTextEditor value={front} onChange={setFront} variant="front" />
        </section>
        <section className="min-w-0"><h3 className="mb-3 flex items-center justify-between gap-3 text-[13px] font-bold">Tył fiszki <span className="text-[10px] font-extrabold tracking-wider text-[var(--faint)]">ODPOWIEDŹ / WYJAŚNIENIE</span></h3>
          <RichTextEditor value={back} onChange={setBack} />
        </section>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  </Modal>
}

export default CardComposer
