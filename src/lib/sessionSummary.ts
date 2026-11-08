import type { Card, StudySession } from '../types/model'
import { getSessionCardOutcomes } from './studyProgress'

/** Deck figures always reflect the current study session's progress legend.
 * Lifetime grades remain on the cards for historical purposes only.
 */
export const getSessionSummary = (
  cards: Pick<Card, 'id'>[],
  session?: StudySession | null
) => {
  if (!session) return { correct: 0, toRepeat: 0, unreviewed: cards.length }

  const available = new Set(cards.map(card => card.id))
  const { correctCount, wrongCount } = getSessionCardOutcomes(session, available)
  return {
    correct: correctCount,
    toRepeat: wrongCount,
    unreviewed: Math.max(0, cards.length - correctCount - wrongCount)
  }
}
