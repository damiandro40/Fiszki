import type { LibraryData, StudySession, WorkspaceState } from '../types/model'
import { shuffled } from './tree'
import { reconcileCardDrafts } from './cardDrafts'

export const defaultWorkspace = (): WorkspaceState => ({
  version: 1,
  selected: { type: 'home' },
  lastEditedCardId: null,
  study: null
})

export const startStudySession = (data: LibraryData, deckId: string): StudySession => {
  const ids = data.cards.filter(card => card.deckId === deckId).map(card => card.id)
  return {
    deckId,
    queue: data.preferences.shuffle ? shuffled(ids) : ids,
    index: 0,
    flipped: false,
    correctCount: 0,
    wrongCount: 0
  }
}

/** Remove deleted cards and unavailable sets from persisted sessions. */
export const reconcileStudySession = (session: StudySession, data: LibraryData): StudySession | null => {
  if (!data.decks.some(deck => deck.id === session.deckId)) return null
  const validCards = new Set(data.cards.filter(card => card.deckId === session.deckId).map(card => card.id))
  const queue = session.queue.filter(id => validCards.has(id))
  const index = Math.min(session.queue.slice(0, session.index).filter(id => validCards.has(id)).length, queue.length)
  return {
    ...session, queue, index, flipped: false,
    ...(session.history ? { history: queue.length === session.queue.length ? session.history.filter(item => validCards.has(item.cardId)) : [] } : {})
  }
}

export const reconcileWorkspace = (saved: WorkspaceState, data: LibraryData): WorkspaceState => {
  let selected = saved.selected
  if (selected.type === 'folder') {
    const folderId = selected.id
    if (!data.folders.some(folder => folder.id === folderId)) selected = { type: 'home' }
  }
  if (selected.type === 'deck') {
    const deckId = selected.id
    if (!data.decks.some(deck => deck.id === deckId)) selected = { type: 'home' }
  }
  const cardDrafts = reconcileCardDrafts(saved, data)
  const lastEditedCardId = saved.lastEditedCardId && data.cards.some(card => card.id === saved.lastEditedCardId) ? saved.lastEditedCardId : null
  const study = saved.study ? reconcileStudySession(saved.study, data) : null
  const studySessions: Record<string, StudySession> = {}
  for (const entry of Object.values(saved.studySessions || {})) {
    if (!entry || !Array.isArray(entry.queue)) continue
    const restored = reconcileStudySession(entry, data)
    if (restored && restored.queue.length) studySessions[restored.deckId] = restored
  }
  if (study && study.queue.length) studySessions[study.deckId] = study
  return {
    version: 1, lastEditedCardId, cardDrafts,
    selected: study ? { type: 'deck', id: study.deckId } : selected,
    study,
    ...(Object.keys(studySessions).length ? { studySessions } : {})
  }
}
