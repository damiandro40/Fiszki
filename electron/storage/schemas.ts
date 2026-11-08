import { z } from 'zod'

export const nameSchema = z.string().trim().min(1).max(160)
export const timestampSchema = z.string().max(80)
export const folderSchema = z.object({
  id: z.string().min(1).max(100), name: nameSchema, parentId: z.string().nullable(),
  createdAt: timestampSchema, updatedAt: timestampSchema
})
export const deckSchema = z.object({
  id: z.string().min(1).max(100), name: nameSchema, description: z.string().max(2000),
  folderId: z.string().nullable(), createdAt: timestampSchema, updatedAt: timestampSchema
})
export const cardSchema = z.object({
  id: z.string().min(1).max(100), deckId: z.string().min(1).max(100), kind: z.enum(['question', 'definition', 'cloze']).optional(),
  createdBy: z.literal('ai').optional(), needsReview: z.boolean().optional(), aiModel: z.string().max(140).optional(), front: z.unknown(), back: z.unknown(),
  createdAt: timestampSchema, updatedAt: timestampSchema, correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(), lastReviewedAt: timestampSchema.nullable(),
  lastAnswerCorrect: z.boolean().nullable().optional()
})
export const librarySchema = z.object({
  version: z.literal(1), folders: z.array(folderSchema).max(15000),
  decks: z.array(deckSchema).max(50000), cards: z.array(cardSchema).max(250000),
  preferences: z.object({ theme: z.enum(['system', 'light', 'dark']), shuffle: z.boolean(), studyInSeparateWindow: z.boolean().optional(), studyKeys: z.object({ flip: z.string().max(32), again: z.string().max(32), known: z.string().max(32), undo: z.string().max(32).optional() }).optional() })
})

export const studySessionSchema = z.object({
    deckId: z.string().min(1).max(100),
    queue: z.array(z.string().min(1).max(100)).max(250000),
    index: z.number().int().min(0).max(250000),
    flipped: z.boolean(),
    correctCount: z.number().int().min(0),
    wrongCount: z.number().int().min(0),
    history: z.array(z.object({
      cardId: z.string().min(1).max(100), correct: z.boolean(),
      previousIndex: z.number().int().nonnegative(), previousFlipped: z.boolean(),
      previousCorrectCount: z.number().int().nonnegative(), previousWrongCount: z.number().int().nonnegative(),
      previousLastReviewedAt: timestampSchema.nullable().optional(),
      previousLastAnswerCorrect: z.boolean().nullable().optional()
    })).max(250000).optional()
})

const cardDraftSchema = z.object({
  draftId: z.string().min(1).max(120),
  deckId: z.string().min(1).max(100), cardId: z.string().min(1).max(100).nullable(),
  front: z.unknown(), back: z.unknown(), updatedAt: timestampSchema
})

export const workspaceSchema = z.object({
  version: z.literal(1),
  // Accept pre-1.0.3 workspaces; reconcileWorkspace migrates this to cardDrafts.
  pendingCardDraft: cardDraftSchema.omit({ draftId: true }).nullable().optional(),
  cardDrafts: z.array(cardDraftSchema).max(1000).optional(),
  lastEditedCardId: z.string().min(1).max(100).nullable().optional(),
  selected: z.discriminatedUnion('type', [
    z.object({ type: z.literal('home') }),
    z.object({ type: z.literal('folder'), id: z.string().min(1).max(100) }),
    z.object({ type: z.literal('deck'), id: z.string().min(1).max(100) })
  ]),
  study: studySessionSchema.nullable(),
  studySessions: z.record(z.string().min(1).max(100), studySessionSchema)
    .refine(sessions => Object.keys(sessions).length <= 2000, 'Zbyt wiele zapisanych sesji')
    .optional()
})

export const windowStateSchema = z.object({
  x: z.number().int(), y: z.number().int(),
  width: z.number().int().min(940), height: z.number().int().min(650),
  maximized: z.boolean()
})

