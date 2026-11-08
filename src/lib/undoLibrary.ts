import type { Card, Deck, Folder, LibraryData } from '../types/model'

type EntityKey = 'folders' | 'decks' | 'cards'
type Entity = Card | Deck | Folder

interface RowChange {
  id: string
  before: Entity | null
  after: Entity | null
  beforeIndex: number
}

export interface LibraryUndoPatch {
  changes: Record<EntityKey, RowChange[]>
}

const same = (left: Entity, right: Entity) => left === right || JSON.stringify(left) === JSON.stringify(right)

const changedRows = <T extends Entity>(before: T[], after: T[]): RowChange[] => {
  const oldById = new Map(before.map((item, index) => [item.id, { item, index }] as const))
  const newById = new Map(after.map(item => [item.id, item]))
  const ids = new Set([...oldById.keys(), ...newById.keys()])
  const changes: RowChange[] = []
  for (const id of ids) {
    const previous = oldById.get(id)
    const next = newById.get(id)
    if (previous?.item && next && same(previous.item, next)) continue
    changes.push({ id, before: previous?.item ?? null, after: next ?? null, beforeIndex: previous?.index ?? before.length })
  }
  return changes
}

/** A small inverse change set, not a snapshot of the entire library.
 * This avoids erasing unrelated edits performed while the toast was visible. */
export const createLibraryUndo = (before: LibraryData, after: LibraryData): LibraryUndoPatch => ({
  changes: {
    folders: changedRows(before.folders, after.folders),
    decks: changedRows(before.decks, after.decks),
    cards: changedRows(before.cards, after.cards)
  }
})

export const hasLibraryUndo = (patch: LibraryUndoPatch): boolean =>
  Object.values(patch.changes).some(changes => changes.length > 0)

const revertRows = <T extends Entity>(current: T[], changes: RowChange[]): { rows: T[], count: number } => {
  if (!changes.length) return { rows: current, count: 0 }
  const rows = [...current]
  let count = 0

  // Restore deletions in original order; never replace records modified later.
  for (const change of [...changes].sort((a, b) => a.beforeIndex - b.beforeIndex)) {
    const index = rows.findIndex(item => item.id === change.id)
    if (change.after && (index < 0 || !same(rows[index], change.after))) continue
    if (!change.after && index >= 0) continue

    if (!change.before) {
      if (index >= 0) rows.splice(index, 1)
    } else if (index >= 0) {
      rows[index] = change.before as T
    } else {
      rows.splice(Math.min(change.beforeIndex, rows.length), 0, change.before as T)
    }
    count++
  }
  return { rows: count ? rows : current, count }
}

export const applyLibraryUndo = (current: LibraryData, patch: LibraryUndoPatch): { data: LibraryData, reverted: number } => {
  const folders = revertRows(current.folders, patch.changes.folders)
  const decks = revertRows(current.decks, patch.changes.decks)
  const cards = revertRows(current.cards, patch.changes.cards)
  const reverted = folders.count + decks.count + cards.count
  const expected = Object.values(patch.changes).reduce((sum, changes) => sum + changes.length, 0)
  // Undo is atomic: if another edit touched a target, never partially restore a deleted hierarchy.
  if (reverted !== expected) return { data: current, reverted: 0 }
  return {
    data: reverted ? { ...current, folders: folders.rows, decks: decks.rows, cards: cards.rows } : current,
    reverted
  }
}
