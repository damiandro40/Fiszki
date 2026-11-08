import { useMemo } from 'react'
import type useAppController from './useAppController'
import { normalizeStudyKeys } from '../lib/studyKeys'
import { exitStudySession, resumableStudySession, storeStudySession } from '../lib/studySessions'
import LibraryOverview from '../views/library/LibraryOverview'
import DeckView from '../views/decks/DeckView'
import StudyView from '../views/study/StudyView'

type Controller = ReturnType<typeof useAppController>

const CurrentView = ({ controller }: { controller: Controller }) => {
  const {
    data, workspace, setWorkspace, selected, selectedDeck, currentStudyDeck,
    createCard, ask, folderActions, selectItem,
    editCard, duplicateCard, markCardReviewed, startStudy, answerStudy, undoStudy
  } = controller

  const studyCards = useMemo(() => data?.cards.filter(card => card.deckId === currentStudyDeck?.id) ?? [], [data?.cards, currentStudyDeck?.id])

  if (!data) return null

  if (currentStudyDeck) {
    return <StudyView
      key={currentStudyDeck.id}
      deck={currentStudyDeck}
      cards={studyCards}
      shuffle={data.preferences.shuffle}
      keymap={normalizeStudyKeys(data.preferences.studyKeys)}
      session={workspace.study!}
      onSessionChange={next => setWorkspace(previous => storeStudySession(previous, next))}
      onUndo={undoStudy}
      onExit={() => setWorkspace(exitStudySession)}
      onAnswer={answerStudy}
    />
  }

  if (selectedDeck) {
    const session = workspace.study?.deckId === selectedDeck.id
      ? workspace.study
      : workspace.studySessions?.[selectedDeck.id] ?? null
    const resumableSession = resumableStudySession(workspace, selectedDeck.id)
    return <DeckView
      key={selectedDeck.id}
      deck={selectedDeck}
      data={data}
      onNew={() => createCard(selectedDeck.id)}
      onEdit={editCard}
      onDelete={card => ask('delete-card', card.id)}
      onDuplicate={duplicateCard}
      onMove={card => ask('move-card', card.id)}
      onMarkReviewed={markCardReviewed}
      onStudy={() => startStudy(selectedDeck.id)}
      onRestartStudy={() => startStudy(selectedDeck.id, true)}
      savedSessionProgress={resumableSession ? { answered: resumableSession.index, total: resumableSession.queue.length } : undefined}
      session={session}
      onFolder={id => selectItem(id ? { type: 'folder', id } : { type: 'home' })}
    />
  }

  const folderId = selected.type === 'folder' && data.folders.some(folder => folder.id === selected.id)
    ? selected.id : null

  return <LibraryOverview
    data={data}
    folderId={folderId}
    onSelect={selectItem}
    onAddFolder={parent => ask('create-folder', undefined, parent)}
    onAddDeck={parent => ask('create-deck', undefined, parent)}
    onAction={folderActions}
    onStudy={deckId => startStudy(deckId)}
    hasStudyProgress={id => !!resumableStudySession(workspace, id)}
  />
}

export default CurrentView
