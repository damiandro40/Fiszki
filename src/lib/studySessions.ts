import type { LibraryData, StudySession, WorkspaceState } from '../types/model'
import { startStudySession } from './workspace'

/** Remember each session without destroying progress in other sets. */
export const storeStudySession = (workspace: WorkspaceState, session: StudySession): WorkspaceState => ({
  ...workspace,
  study: session,
  studySessions: { ...workspace.studySessions, [session.deckId]: session }
})

export const exitStudySession = (workspace: WorkspaceState): WorkspaceState => ({
  ...workspace,
  studySessions: workspace.study
    ? { ...workspace.studySessions, [workspace.study.deckId]: workspace.study }
    : workspace.studySessions,
  study: null
})

/** A session is resumable only after at least one actual grade. Merely opening
 * a deck must not create a visible "Continue" or "Restart" button. */
export const hasStudyProgress = (session: StudySession | null | undefined): boolean =>
  !!session && (session.correctCount > 0 || session.wrongCount > 0 || (session.history?.length ?? 0) > 0)

/** A completed or never-graded session is not resumable. */
export const resumableStudySession = (workspace: WorkspaceState, deckId: string): StudySession | null => {
  const session = workspace.studySessions?.[deckId]
  return session && hasStudyProgress(session) && session.queue.length > 0 && session.index < session.queue.length ? { ...session, flipped: false } : null
}

export const openStudySession = (workspace: WorkspaceState, data: LibraryData, deckId: string, restart = false): WorkspaceState => {
  const session = !restart && resumableStudySession(workspace, deckId) || startStudySession(data, deckId)
  return {
    ...workspace,
    selected: { type: 'deck', id: deckId },
    study: session,
    studySessions: { ...workspace.studySessions, [deckId]: session }
  }
}
