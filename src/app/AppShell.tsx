import { AlertCircle, Command, GraduationCap, LoaderCircle, Search } from 'lucide-react'
import type useAppController from './useAppController'
import { resumableStudySession } from '../lib/studySessions'
import Sidebar from '../features/library/Sidebar'
import Titlebar from '../components/Titlebar'
import Button from '../components/atoms/Button'
import CurrentView from './CurrentView'
import AppDialogs from './AppDialogs'
import UpdateNotice from '../components/UpdateNotice'

type Controller = ReturnType<typeof useAppController>

const AppShell = ({ controller }: { controller: Controller }) => {
  const {
    data, loadError, load, workspaceReady, workspace, selected, selectedDeck,
    setSearchOpen, aiOpen, toggleAssistant, ask, folderActions,
    selectItem, setSettingsOpen, startStudy
  } = controller

  if (!data || !workspaceReady) {
    return <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)]">
      <Titlebar />
      <div className="bootstrap-screen">
        <div className="bootstrap-logo"><GraduationCap size={38}/></div>
        <h1>Fiszki</h1>
        {loadError ? <div className="bootstrap-error">
          <AlertCircle size={22}/>
          <p>{loadError}</p>
          <div className="bootstrap-actions">
            <Button onClick={() => void load()}>Spróbuj ponownie</Button>
            <Button intent="solid" color="primary" onClick={() => void window.flashcards.openDataFolder()}>Pokaż folder danych</Button>
          </div>
        </div> : <>
          <LoaderCircle className="spinning" size={22}/>
          <p>Otwieranie Twojej biblioteki…</p>
        </>}
      </div>
    </div>
  }

  return <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)]">
    <Titlebar />
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-[var(--bg)]">
      <Sidebar
        data={data}
        selected={selected}
        onSelect={selectItem}
        aiActive={aiOpen}
        onAI={() => void toggleAssistant(selectedDeck?.id ?? null)}
        onAddFolder={parent => ask('create-folder', undefined, parent)}
        onAddDeck={folder => ask('create-deck', undefined, folder)}
        onAction={folderActions}
        onStudy={deckId => startStudy(deckId)}
        hasStudyProgress={id => !!resumableStudySession(workspace, id)}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[70px] shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--bg)] px-8 max-[720px]:px-4">
          <button
            type="button"
            className="flex h-10 w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-[var(--muted)] transition-colors enabled:cursor-pointer enabled:hover:border-[var(--scroll-hover)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
            onClick={() => setSearchOpen(true)}
            aria-label="Otwórz wyszukiwanie (Ctrl+K)"
          >
            <Search size={18}/>
            <span className="min-w-0 flex-1 truncate text-xs">Szukaj fiszek, folderów, zestawów…</span>
            <kbd className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px]"><Command size={12}/> K</kbd>
          </button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--bg)]"><CurrentView controller={controller}/></main>
      </div>
      <AppDialogs controller={controller}/>
      <UpdateNotice onInstall={controller.installUpdate}/>
    </div>
  </div>
}

export default AppShell
