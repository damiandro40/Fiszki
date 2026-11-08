import type { LibraryData, PendingCardDraft, WorkspaceState } from '../types/model'

/** A saved card has one draft, while each unfinished new card has its own identity. */
export const editingDraftId = (cardId: string) => `card:${cardId}`
export const newDraftId = () => `new:${crypto.randomUUID()}`

export const getCardDrafts = (workspace: WorkspaceState): PendingCardDraft[] => {
  const saved = workspace.cardDrafts || []
  const legacy = workspace.pendingCardDraft
  if (!legacy) return saved
  const draftId = legacy.cardId ? editingDraftId(legacy.cardId) : `legacy:${legacy.deckId}`
  return saved.some(draft => draft.draftId === draftId) ? saved : [...saved, { ...legacy, draftId }]
}

export const upsertCardDraft = (drafts: PendingCardDraft[], draft: PendingCardDraft): PendingCardDraft[] => {
  // For existing cards, the latest draft replaces older copies of the same card.
  const without = drafts.filter(item => item.draftId !== draft.draftId &&
    !(draft.cardId && item.cardId === draft.cardId))
  return [...without, draft].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const removeCardDraft = (drafts: PendingCardDraft[], draftId: string): PendingCardDraft[] =>
  drafts.filter(item => item.draftId !== draftId)

export const reconcileCardDrafts = (workspace: WorkspaceState, data: LibraryData): PendingCardDraft[] => {
  const decks = new Set(data.decks.map(deck => deck.id))
  const cards = new Map(data.cards.map(card => [card.id, card]))
  const cleaned: PendingCardDraft[] = []
  const seenIds = new Set<string>()
  const seenCards = new Set<string>()
  for (const draft of [...getCardDrafts(workspace)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const editedCard = draft.cardId ? cards.get(draft.cardId) : null
    if (!draft.draftId || (!editedCard && (draft.cardId || !decks.has(draft.deckId))) || seenIds.has(draft.draftId) ||
      (draft.cardId && seenCards.has(draft.cardId))) continue
    seenIds.add(draft.draftId)
    if (draft.cardId) seenCards.add(draft.cardId)
    cleaned.push(editedCard && draft.deckId !== editedCard.deckId ? { ...draft, deckId: editedCard.deckId } : draft)
  }
  return cleaned
}
