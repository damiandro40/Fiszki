import type { Card } from '../types/model'

/** Inserts a new independent copy immediately after its source, retaining all deck order. */
export const duplicateCardAfter = (cards: Card[], cardId: string, newId: string, timestamp: string): Card[] => {
  const index = cards.findIndex(card => card.id === cardId)
  if (index === -1) return cards

  const copy: Card = {
    ...structuredClone(cards[index]),
    id: newId,
    createdAt: timestamp,
    updatedAt: timestamp,
    correct: 0,
    incorrect: 0,
    lastReviewedAt: null,
    lastAnswerCorrect: null
  }

  return [...cards.slice(0, index + 1), copy, ...cards.slice(index + 1)]
}
