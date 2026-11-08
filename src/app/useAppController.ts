import { useEffect, useRef, useState } from 'react'
import type { Card, LibraryData, Preferences, RichDoc, ThemePreference, WorkspaceState } from '../types/model'
import { useLibrary } from '../hooks/useLibrary'
import { useTheme } from '../hooks/useTheme'
import { folderCanMove, removeDeck, removeFolder } from '../lib/tree'
import { manageModeForItem } from '../lib/manageActions'
import type { Selection, ItemAction } from '../features/library/Sidebar'
import { defaultWorkspace, reconcileWorkspace } from '../lib/workspace'
import type { ManageAction, ManageMode } from '../features/library/ManageDialog'
import { describeLocalError } from '../lib/uiErrors'
import { exitStudySession, openStudySession, storeStudySession } from '../lib/studySessions'
import { applyLibraryUndo, createLibraryUndo, hasLibraryUndo } from '../lib/undoLibrary'
import { duplicateCardAfter } from '../lib/cardOrdering'
import { useToast } from '../providers/ToastProvider'
import { editingDraftId, getCardDrafts, newDraftId, removeCardDraft } from '../lib/cardDrafts'

const errorText = describeLocalError
const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

const useAppController = () => {
  const { data, loadError, load, saveStatus, saveError, commit, flush, replace, retrySave } = useLibrary()
  const [workspace, setWorkspace] = useState(defaultWorkspace)
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const workspaceLoadingRef = useRef(false)
  const selected = workspace.selected
  const [searchOpen, setSearchOpen] = useState(false)
  const [manage, setManage] = useState<ManageAction | null>(null)
  const [composerDeckId, setComposerDeckId] = useState<string | null>(null)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiRevision, setAiRevision] = useState(0)
  const [themePreview, setThemePreview] = useState<ThemePreference | null>(null)
  const { addToast } = useToast()

  useTheme(themePreview ?? data?.preferences.theme ?? 'system')

  useEffect(() => {
    const removeState = window.flashcards.onAiWindowState(setAiOpen)
    const removeSession = window.flashcards.onAiSessionUpdated(() => setAiRevision(previous => previous + 1))
    const removeChange = window.flashcards.onLibraryExternalUpdate(() => {
      void flush().then(load).catch(error => addToast(errorText(error), { error: true }))
    })
    const removeFocus = window.flashcards.onAiFocusDeck(deckId => {
      selectDeckFromAI(deckId)
    })
    const removeStudy = window.flashcards.onStudySessionUpdated(session => {
      setWorkspace(previous => ({ ...previous, studySessions: { ...previous.studySessions, [session.deckId]: session } }))
    })
    return () => { removeState(); removeChange(); removeFocus(); removeSession(); removeStudy() }
  }, [flush, load])

  const selectDeckFromAI = (deckId: string) => setWorkspace(previous => ({ ...exitStudySession(previous), selected: { type: 'deck', id: deckId } }))

  const toggleAssistant = async (deckId: string | null, forceOpen = false) => {
    if (!data?.decks.length) return
    try {
      await flush()
      setAiOpen(await window.flashcards.aiWindowToggle(deckId, forceOpen))
    } catch (error) { addToast(errorText(error), { error: true }) }
  }


  useEffect(() => {
    if (!data || workspaceLoadingRef.current) return
    workspaceLoadingRef.current = true

    void window.flashcards.loadWorkspace()
      .then(saved => setWorkspace(reconcileWorkspace(saved, data)))
      .catch(error => addToast(`Nie udało się przywrócić sesji: ${errorText(error)}`, { error: true }))
      .finally(() => setWorkspaceReady(true))
  }, [data])

  useEffect(() => {
    if (!workspaceReady) return
    void window.flashcards.saveWorkspace(workspace)
      .catch(error => addToast(`Nie udało się zapisać sesji: ${errorText(error)}`, { error: true }))
  }, [workspace, workspaceReady])


  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])


  const showMessage = (message: string, error = false) => addToast(message, { error })

  const commitUndoable = (change: (current: LibraryData) => LibraryData, message: string,
    restoreWorkspace?: WorkspaceState) => {
    // useLibrary.commit applies its updater synchronously to the latest ref.
    const captured: { patch?: ReturnType<typeof createLibraryUndo> } = {}
    commit(previous => {
      const next = change(previous)
      captured.patch = createLibraryUndo(previous, next)
      return next
    })
    const patch = captured.patch
    if (!patch || !hasLibraryUndo(patch)) return
    addToast(message, {
      duration: 9000,
      undo: () => {
        let reverted = 0
        commit(current => {
          const result = applyLibraryUndo(current, patch)
          reverted = result.reverted
          return result.data
        })
        if (reverted) {
          if (restoreWorkspace) {
            setWorkspace(previous => ({
              ...previous,
              // Restore paused sessions for deleted sets without losing newer sessions.
              studySessions: { ...restoreWorkspace.studySessions, ...previous.studySessions },
              selected: previous.selected.type === 'home' && restoreWorkspace.selected.type !== 'home'
                ? restoreWorkspace.selected : previous.selected
            }))
          }
          showMessage('Zmiana została cofnięta.')
        } else {
          showMessage('Nie można cofnąć: element został później zmieniony.', true)
        }
      }
    })
  }

  const selectItem = (value: Selection) => { setWorkspace(previous => ({ ...exitStudySession(previous), selected: value })) }
  const ask = (mode: ManageMode, id?: string, parentId?: string | null) => setManage({ mode, id, parentId })
  const folderActions = (kind: 'folder' | 'deck', id: string, action: ItemAction) =>
    ask(manageModeForItem(kind, action), id)

  const confirmManage = (value?: string, description?: string, destinationId?: string | null) => {
    if (!manage || !data) return
    const { mode, id } = manage
    setManage(null)
    const time = now()

    if (mode === 'import-backup') {
      void (async () => {
        try {
          await flush()
          const imported = await window.flashcards.importBackup()
          if (!imported) return
          replace(imported)
          setWorkspace(defaultWorkspace())
          showMessage('Biblioteka została zaimportowana.')
        } catch (error) { showMessage(`Błąd importu: ${errorText(error)}`, true) }
      })()
      return
    }

    switch (mode) {
      case 'create-folder': {
        const folderId = uuid()
        commit(old => ({ ...old, folders: [...old.folders, { id: folderId, name: value!, parentId: destinationId || null, createdAt: time, updatedAt: time }] }))
        selectItem({ type: 'folder', id: folderId })
        break
      }
      case 'edit-folder':
        commitUndoable(old => ({ ...old, folders: old.folders.map(item => item.id === id ? { ...item, name: value!, updatedAt: time } : item) }), 'Zmieniono nazwę folderu.')
        break
      case 'move-folder':
        if (!folderCanMove(data, id!, value || null)) { showMessage('Nie można przenieść folderu do niego samego lub jego podfolderu.', true); return }
        commitUndoable(old => ({ ...old, folders: old.folders.map(item => item.id === id ? { ...item, parentId: value || null, updatedAt: time } : item) }), 'Przeniesiono folder.')
        break
      case 'delete-folder': {
        const remaining = removeFolder(data, id!)
        commitUndoable(old => removeFolder(old, id!), 'Usunięto folder.', workspace)
        setWorkspace(previous => reconcileWorkspace({
          ...exitStudySession(previous), selected: { type: 'home' }, study: null
        }, remaining))
        break
      }
      case 'create-deck': {
        const deckId = uuid()
        commit(old => ({ ...old, decks: [...old.decks, { id: deckId, name: value!, description: '', folderId: destinationId || null, createdAt: time, updatedAt: time }] }))
        selectItem({ type: 'deck', id: deckId })
        break
      }
      case 'edit-deck':
        commitUndoable(old => ({ ...old, decks: old.decks.map(item => item.id === id ? { ...item, name: value!, updatedAt: time } : item) }), 'Zmieniono nazwę zestawu.')
        break
      case 'move-deck':
        commitUndoable(old => ({ ...old, decks: old.decks.map(item => item.id === id ? { ...item, folderId: value || null, updatedAt: time } : item) }), 'Przeniesiono zestaw.')
        break
      case 'delete-deck': {
        const remaining = removeDeck(data, id!)
        commitUndoable(old => removeDeck(old, id!), 'Usunięto zestaw.', workspace)
        setWorkspace(previous => reconcileWorkspace({
          ...exitStudySession(previous), selected: { type: 'home' }, study: null
        }, remaining))
        break
      }
      case 'move-card':
        commitUndoable(old => ({ ...old, cards: old.cards.map(item => item.id === id ? { ...item, deckId: value!, updatedAt: time } : item) }), 'Przeniesiono fiszkę.')
        break
      case 'delete-card':
        const remaining = { ...data, cards: data.cards.filter(item => item.id !== id) }
        commitUndoable(old => ({ ...old, cards: old.cards.filter(item => item.id !== id) }), 'Usunięto fiszkę.', workspace)
        setWorkspace(previous => reconcileWorkspace(exitStudySession(previous), remaining))
        break
    }
  }

  const saveCard = (front: RichDoc, back: RichDoc) => {
    if (!composerDeckId) return
    const time = now()
    const existing = editingCard
    if (existing) {
      commitUndoable(old => ({ ...old, cards: old.cards.map(card => card.id === existing.id ? { ...card, front, back, updatedAt: time } : card) }), 'Fiszka została zaktualizowana.')
      setWorkspace(previous => ({ ...previous, lastEditedCardId: existing.id }))
    } else {
      const nextCard: Card = { id: uuid(), deckId: composerDeckId, front, back, createdAt: time, updatedAt: time, correct: 0, incorrect: 0, lastReviewedAt: null }
      commit(old => ({ ...old, cards: [...old.cards, nextCard] }))
      setWorkspace(previous => ({ ...previous, lastEditedCardId: nextCard.id }))
    }
    if (activeDraftId) setWorkspace(previous => ({ ...previous,
      cardDrafts: removeCardDraft(getCardDrafts(previous), activeDraftId), pendingCardDraft: null
    }))
    setComposerDeckId(null)
    setEditingCard(null)
    setActiveDraftId(null)
    if (!existing) showMessage('Nowa fiszka została zapisana.')
  }

  const editCard = (card: Card) => {
    setWorkspace(previous => ({ ...previous, lastEditedCardId: card.id }))
    setActiveDraftId(editingDraftId(card.id))
    setEditingCard(card)
    setComposerDeckId(card.deckId)
  }
  const createCard = (deckId: string) => {
    setActiveDraftId(newDraftId())
    setEditingCard(null)
    setComposerDeckId(deckId)
  }
  const duplicateCard = (card: Card) => {
    const time = now()
    commit(old => {
      const cards = duplicateCardAfter(old.cards, card.id, uuid(), time)
      return cards === old.cards ? old : { ...old, cards }
    })
    showMessage('Utworzono kopię fiszki.')
  }

  const exportBackup = () => {
    void (async () => {
      try {
        await flush()
        if (await window.flashcards.exportBackup()) showMessage('Kopia zapasowa została wyeksportowana.')
      } catch (error) { showMessage(`Nie udało się wykonać eksportu: ${errorText(error)}`, true) }
    })()
  }

  const markCardReviewed = (card: Card) => {
    commitUndoable(old => ({ ...old, cards: old.cards.map(item => item.id === card.id ? { ...item, needsReview: false, updatedAt: now() } : item) }), 'Fiszka została oznaczona jako sprawdzona.')
  }

  const cardDrafts = getCardDrafts(workspace).flatMap(draft => {
    const edited = draft.cardId ? data?.cards.find(card => card.id === draft.cardId) : null
    if (draft.cardId && !edited) return []
    const deckId = edited?.deckId || draft.deckId
    if (!data?.decks.some(deck => deck.id === deckId)) return []
    return [{ ...draft, deckId }]
  })
  const resumeDraft = (draftId: string) => {
    const draft = cardDrafts.find(item => item.draftId === draftId)
    if (!draft) return
    setActiveDraftId(draftId)
    setEditingCard(draft.cardId ? data?.cards.find(card => card.id === draft.cardId) ?? null : null)
    setComposerDeckId(draft.deckId)
  }
  const selectedDeck = selected.type === 'deck' ? data?.decks.find(deck => deck.id === selected.id) : undefined
  const currentStudyDeck = workspace.study ? data?.decks.find(deck => deck.id === workspace.study?.deckId) : undefined


  const startStudy = (deckId: string, restart = false) => {
    if (!data) return
    if (data.preferences.studyInSeparateWindow) {
      void flush().then(() => window.flashcards.studyWindowOpen(deckId, restart))
        .catch(error => showMessage(`Nie udało się otworzyć okna nauki: ${errorText(error)}`, true))
      return
    }
    setWorkspace(previous => openStudySession(previous, data, deckId, restart))
  }
  const installUpdate = async () => {
    if (composerDeckId) {
      showMessage('Zapisz lub odłóż do wersji roboczych otwartą fiszkę przed aktualizacją.', true)
      return
    }
    try {
      await flush()
      // Persist the latest workspace, not a snapshot captured before the click.
      await window.flashcards.saveWorkspace(workspaceRef.current)
      await window.flashcards.updaterInstall()
    } catch (error) {
      showMessage(`Instalacja nie została rozpoczęta: ${errorText(error)}`, true)
    }
  }

  const changePreferences = (preferences: Preferences) => {
    const wasSeparate = data?.preferences.studyInSeparateWindow ?? false
    const separate = preferences.studyInSeparateWindow ?? false
    const activeSession = workspace.study

    commit(old => ({ ...old, preferences }))
    if (wasSeparate === separate) return

    if (separate) {
      if (!activeSession) return
      // Immediately restore the deck view in the main window; the session is moved as-is.
      setWorkspace(previous => exitStudySession(previous))
      void (async () => {
        await flush()
        await window.flashcards.studyWindowOpen(activeSession.deckId, false, activeSession)
      })().catch(error => {
        setWorkspace(previous => ({ ...previous, study: activeSession, selected: { type: 'deck', id: activeSession.deckId },
          studySessions: { ...previous.studySessions, [activeSession.deckId]: activeSession } }))
        showMessage(`Nie udało się przenieść nauki: ${errorText(error)}`, true)
      })
    } else {
      // Serialize any in-flight grades, close the independent window and resume inline.
      void (async () => {
        await flush()
        const resumed = await window.flashcards.studyWindowClose()
        if (!resumed) return
        // Reload authoritative grades; do not resume from a stale renderer snapshot.
        replace(await window.flashcards.load())
        setWorkspace(previous => ({ ...previous, selected: { type: 'deck', id: resumed.deckId }, study: resumed.session,
          studySessions: { ...previous.studySessions, [resumed.deckId]: resumed.session } }))
      })().catch(error => showMessage(`Nie udało się przełączyć trybu nauki: ${errorText(error)}`, true))
    }
  }

  const answerStudy = (id: string, correct: boolean) => {
    commit(old => ({ ...old, cards: old.cards.map(card => card.id === id ? {
      ...card, correct: card.correct + Number(correct), incorrect: card.incorrect + Number(!correct), lastReviewedAt: now(), lastAnswerCorrect: correct
    } : card) }))
  }
  const undoStudy = (id: string, correct: boolean, lastReviewedAt: string | null | undefined, lastAnswerCorrect?: boolean | null) => {
    commit(old => ({ ...old, cards: old.cards.map(card => card.id === id ? {
      ...card, correct: Math.max(0, card.correct - Number(correct)), incorrect: Math.max(0, card.incorrect - Number(!correct)), lastReviewedAt: lastReviewedAt ?? null, lastAnswerCorrect: lastAnswerCorrect ?? null
    } : card) }))
  }

  return {
    data, loadError, load, saveStatus, saveError, retrySave, workspaceReady, workspace, setWorkspace,
    selected, searchOpen, setSearchOpen, manage, setManage, composerDeckId, setComposerDeckId,
    editingCard, setEditingCard, activeDraftId, setActiveDraftId, settingsOpen, setSettingsOpen, aiOpen, aiRevision, setAiRevision,
    themePreview, setThemePreview, cardDrafts,
    selectedDeck, currentStudyDeck, selectItem, ask, folderActions, confirmManage, saveCard,
    editCard, createCard, duplicateCard, exportBackup, markCardReviewed, resumeDraft, toggleAssistant,
    startStudy, answerStudy, undoStudy, changePreferences, commit, showMessage, installUpdate
  }
}

export default useAppController
