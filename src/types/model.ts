
export type Id = string
export type ThemePreference = 'light' | 'dark' | 'system'

export interface RichDoc {
  type?: string
  attrs?: Record<string, unknown>
  content?: RichDoc[]
  marks?: { type: string, attrs?: Record<string, unknown> }[]
  text?: string
}

export interface Folder {
  id: Id
  name: string
  parentId: Id | null
  createdAt: string
  updatedAt: string
}

export interface Deck {
  id: Id
  name: string
  description: string
  folderId: Id | null
  createdAt: string
  updatedAt: string
}

export interface Card {
  id: Id
  deckId: Id
  kind?: 'question' | 'definition' | 'cloze'
  createdBy?: 'ai'
  needsReview?: boolean
  aiModel?: string
  front: RichDoc
  back: RichDoc
  createdAt: string
  updatedAt: string
  correct: number
  incorrect: number
  lastReviewedAt: string | null
  /** Most recent grade, independent of the current learning session. */
  lastAnswerCorrect?: boolean | null
}

export interface Preferences {
  theme: ThemePreference
  shuffle: boolean
  studyInSeparateWindow?: boolean
  studyKeys?: { flip: string, again: string, known: string, undo?: string }
}

export interface LibraryData {
  version: 1
  folders: Folder[]
  decks: Deck[]
  cards: Card[]
  preferences: Preferences
}

export type AiAuthPhase = 'browser' | 'callback' | 'tokens' | 'verified'

export interface AiSession {
  connected: boolean
  sharing: boolean
  email: string | null
  name: string | null
}

export interface AiModel {
  id: string
  name: string
}

export interface AiAttachment {
  id: string
  name: string
  mime: string
  /** Local-only image data; never accepted from untrusted remote URLs. */
  dataUrl?: string
  /** Base64 PDF attachment, kept locally with the chat history. */
  fileData?: string
  /** Locally extracted text for TXT/MD/CSV/JSON attachments. */
  text?: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: AiAttachment[]
}

export interface AiHistoryMessage extends AiMessage {
  id: string
  createdAt: string
}


export interface AiRequest {
  id: string
  model: string
  instructions: string
  messages: AiMessage[]
}

export interface GeneratedCard {
  front: string
  back: string
  kind: 'question' | 'definition' | 'cloze'
}

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'current' | 'error' | 'unsupported'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  version?: string
  percent?: number
  error?: string
}

export interface DesktopAPI {
  updaterState: () => Promise<UpdateState>
  updaterCheck: () => Promise<UpdateState>
  updaterDownload: () => Promise<UpdateState>
  updaterInstall: () => Promise<void>
  onUpdaterStatus: (callback: (status: UpdateState) => void) => () => void
  onUpdaterPrepare: (callback: () => Promise<void>) => () => void
  aiStatus: () => Promise<AiSession>
  aiConnect: () => Promise<AiSession>
  aiDisconnect: () => Promise<void>
  aiModels: () => Promise<AiModel[]>
  aiManageUsage: () => Promise<void>
  aiSend: (request: AiRequest) => Promise<string>
  aiHistoryLoad: (deckId: string | null) => Promise<AiHistoryMessage[]>
  aiHistorySave: (deckId: string | null, messages: AiHistoryMessage[]) => Promise<void>
  aiCancel: () => Promise<void>
  aiWindowToggle: (deckId: string | null, forceOpen?: boolean) => Promise<boolean>
  aiWindowInfo: () => Promise<{ deckId: string | null, data: LibraryData }>
  aiSaveCards: (deckId: string, cards: GeneratedCard[], model: string) => Promise<number>
  studyWindowOpen: (deckId: string, restart?: boolean, continueSession?: StudySession) => Promise<void>
  studyWindowClose: () => Promise<{ deckId: string, session: StudySession } | null>
  studyWindowInfo: () => Promise<{ data: LibraryData, deckId: string, session: StudySession }>
  studyWindowSave: (session: StudySession, restart?: boolean) => Promise<void>
  onStudySessionUpdated: (callback: (session: StudySession) => void) => () => void
  onAiWindowState: (callback: (open: boolean) => void) => () => void
  onAiWindowContext: (callback: (deckId: string | null) => void) => () => void
  onAiSessionUpdated: (callback: () => void) => () => void
  onLibraryExternalUpdate: (callback: () => void) => () => void
  onAiFocusDeck: (callback: (deckId: string) => void) => () => void
  aiFocusDeck: (deckId: string) => Promise<void>
  onAiDelta: (callback: (id: string, delta: string) => void) => () => void
  onAiAuthProgress: (callback: (phase: AiAuthPhase) => void) => () => void
  load: () => Promise<LibraryData>
  save: (data: LibraryData) => Promise<void>
  exportBackup: () => Promise<boolean>
  importBackup: () => Promise<LibraryData | null>
  openDataFolder: () => Promise<void>
  loadWorkspace: () => Promise<WorkspaceState>
  saveWorkspace: (state: WorkspaceState) => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
}

export type LibrarySelection = { type: 'home' } | { type: 'folder', id: string } | { type: 'deck', id: string }

export interface StudySession {
  deckId: string
  queue: string[]
  index: number
  flipped: boolean
  correctCount: number
  wrongCount: number
  history?: StudyHistoryEntry[]
}

export interface StudyHistoryEntry {
  cardId: string
  correct: boolean
  previousIndex: number
  previousFlipped: boolean
  previousCorrectCount: number
  previousWrongCount: number
  previousLastReviewedAt?: string | null
  previousLastAnswerCorrect?: boolean | null
}

export interface PendingCardDraft {
  draftId: string
  deckId: string
  cardId: string | null
  front: RichDoc
  back: RichDoc
  updatedAt: string
}

export interface WorkspaceState {
  /** Legacy (1.0.2) single draft, read only during migration. */
  pendingCardDraft?: Omit<PendingCardDraft, 'draftId'> | null
  cardDrafts?: PendingCardDraft[]
  lastEditedCardId?: string | null
  version: 1
  selected: LibrarySelection
  study: StudySession | null
  /** Paused/active learning sessions, independently persisted for each set. */
  studySessions?: Record<string, StudySession>
}
