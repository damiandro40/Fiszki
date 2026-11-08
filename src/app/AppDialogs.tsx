import { AlertCircle } from 'lucide-react'
import type useAppController from './useAppController'
import Button from '../components/atoms/Button'
import SearchDialog from '../features/library/SearchDialog'
import ManageDialog from '../features/library/ManageDialog'
import CardComposer from '../features/library/CardComposer'
import SettingsDialog from '../features/library/SettingsDialog'
import DraftStack from '../features/library/DraftStack'
import { getCardDrafts, removeCardDraft, upsertCardDraft } from '../lib/cardDrafts'

type Controller = ReturnType<typeof useAppController>

const AppDialogs = ({ controller }: { controller: Controller }) => {
  const {
    data, workspace, cardDrafts, composerDeckId, editingCard, activeDraftId, setActiveDraftId, resumeDraft,
    saveStatus, saveError, retrySave,
    searchOpen, setSearchOpen, editCard, selectItem,
    manage, setManage, confirmManage, setComposerDeckId, setEditingCard,
    setWorkspace, settingsOpen, setSettingsOpen, aiRevision, setAiRevision,
    setThemePreview, exportBackup, ask, changePreferences, saveCard, installUpdate
  } = controller

  if (!data) return null

  return <>
    {!!cardDrafts.length && !composerDeckId && !workspace.study && (
      <DraftStack drafts={cardDrafts} decks={data.decks} onResume={resumeDraft}/>
    )}

    {saveStatus === 'error' && <div className="save-alert">
      <AlertCircle size={18}/>
      <span>{saveError || 'Nie udało się zapisać danych.'}</span>
      <Button intent="soft" color="danger" size="sm" onClick={retrySave}>Ponów</Button>
    </div>}

    {searchOpen && <SearchDialog
      data={data}
      onClose={() => setSearchOpen(false)}
      onSelect={selectItem}
      onEditCard={editCard}
    />}

    {manage && <ManageDialog
      key={`${manage.mode}-${manage.id || ''}`}
      action={manage}
      data={data}
      onClose={() => setManage(null)}
      onConfirm={confirmManage}
    />}

    {composerDeckId && activeDraftId && <CardComposer
      key={activeDraftId}
      draftId={activeDraftId}
      initial={editingCard}
      initialDraft={cardDrafts.find(draft => draft.draftId === activeDraftId) || null}
      onClose={draft => {
        setWorkspace(previous => ({ ...previous, pendingCardDraft: null,
          cardDrafts: draft
            ? upsertCardDraft(getCardDrafts(previous), { ...draft, deckId: composerDeckId })
            : removeCardDraft(getCardDrafts(previous), activeDraftId)
        }))
        setComposerDeckId(null)
        setEditingCard(null)
        setActiveDraftId(null)
      }}
      onSave={saveCard}
    />}

    {settingsOpen && <SettingsDialog
      aiRevision={aiRevision}
      onAIConnectionChange={() => setAiRevision(previous => previous + 1)}
      preferences={data.preferences}
      onClose={() => { setSettingsOpen(false); setThemePreview(null) }}
      onPreviewTheme={setThemePreview}
      onChange={changePreferences}
      onExport={exportBackup}
      onImport={() => ask('import-backup')}
      onInstallUpdate={installUpdate}
    />}
  </>
}

export default AppDialogs
