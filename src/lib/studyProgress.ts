import type { StudySession } from '../types/model'

/** One latest outcome per unique card, even when a wrong answer adds a retry. */
export const getSessionCardOutcomes = (session: StudySession, validCards?: ReadonlySet<string>) => {
  const available = new Set(session.queue.filter(id => !validCards || validCards.has(id)))
  const total = available.size

  if (!session.history?.length) {
    // Legacy sessions may not have a grade history; retain bounded counts.
    const correctCount = Math.min(Math.max(0, session.correctCount ?? 0), total)
    const wrongCount = Math.min(Math.max(0, session.wrongCount ?? 0), total - correctCount)
    return { correctCount, wrongCount, unreviewed: total - correctCount - wrongCount }
  }

  const lastGrade = new Map<string, boolean>()
  for (const entry of session.history) {
    if (available.has(entry.cardId)) lastGrade.set(entry.cardId, entry.correct)
  }
  let correctCount = 0
  let wrongCount = 0
  for (const correct of lastGrade.values()) {
    if (correct) correctCount++
    else wrongCount++
  }
  return { correctCount, wrongCount, unreviewed: total - correctCount - wrongCount }
}

/** Attempt progress can include retries; the legend always counts distinct cards. */
export const getStudyProgress = (session: StudySession) => {
  const total = session.queue.length
  const answered = Math.min(Math.max(0, session.index), total)
  const outcomes = getSessionCardOutcomes(session)
  const denominator = new Set(session.queue).size

  return {
    progress: total ? Math.round((answered / total) * 100) : 100,
    correct: denominator ? (outcomes.correctCount / denominator) * 100 : 0,
    wrong: denominator ? (outcomes.wrongCount / denominator) * 100 : 0,
    pending: Math.max(0, total - answered),
    ...outcomes
  }
}
