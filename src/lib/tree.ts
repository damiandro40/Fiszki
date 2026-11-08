import type { LibraryData, Id, RichDoc } from '../types/model'

export const descendantsOf = (data: LibraryData, id: Id): Id[] => {
  const output: Id[] = []
  const visited = new Set([id])
  const stack = [id]

  while (stack.length) {
    const parentId = stack.pop()!
    for (const item of data.folders) {
      if (item.parentId !== parentId || visited.has(item.id)) continue
      visited.add(item.id)
      output.push(item.id)
      stack.push(item.id)
    }
  }

  return output
}

export const folderCanMove = (data: LibraryData, id: Id, nextParentId: Id | null): boolean =>
  data.folders.some(folder => folder.id === id) &&
  (nextParentId === null || data.folders.some(folder => folder.id === nextParentId)) &&
  nextParentId !== id && !descendantsOf(data, id).includes(nextParentId || '')

export const removeFolder = (data: LibraryData, id: Id): LibraryData => {
  const removedFolders = new Set([id, ...descendantsOf(data, id)])
  const removedDecks = new Set(data.decks.filter(deck => deck.folderId && removedFolders.has(deck.folderId)).map(deck => deck.id))

  return {
    ...data,
    folders: data.folders.filter(folder => !removedFolders.has(folder.id)),
    decks: data.decks.filter(deck => !removedDecks.has(deck.id)),
    cards: data.cards.filter(card => !removedDecks.has(card.deckId))
  }
}

export const removeDeck = (data: LibraryData, id: Id): LibraryData => ({
  ...data,
  decks: data.decks.filter(deck => deck.id !== id),
  cards: data.cards.filter(card => card.deckId !== id)
})

export const textFromDoc = (doc: RichDoc | null | undefined): string => {
  if (!doc) return ''
  return [doc.text || '', ...(doc.content || []).map(textFromDoc)].filter(Boolean).join(' ').trim()
}

export const cardCountInFolder = (data: LibraryData, folderId: Id): number => {
  const folders = new Set([folderId, ...descendantsOf(data, folderId)])
  const decks = new Set(data.decks.filter(deck => deck.folderId && folders.has(deck.folderId)).map(deck => deck.id))
  return data.cards.filter(card => decks.has(card.deckId)).length
}

export const folderPath = (data: LibraryData, folderId: Id | null): string => {
  if (!folderId) return 'Biblioteka'
  const parts: string[] = []
  let id: Id | null = folderId
  const visited = new Set<Id>()

  while (id && !visited.has(id)) {
    visited.add(id)
    const found = data.folders.find(folder => folder.id === id)
    if (!found) break
    parts.unshift(found.name)
    id = found.parentId
  }

  return parts.join(' / ')
}

export const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const folderAncestors = (data: LibraryData, folderId: Id | null): { id: Id, name: string }[] => {
  const path: { id: Id, name: string }[] = []
  const visited = new Set<Id>()
  let current = folderId
  while (current && !visited.has(current)) {
    visited.add(current)
    const folder = data.folders.find(item => item.id === current)
    if (!folder) break
    path.unshift({ id: folder.id, name: folder.name })
    current = folder.parentId
  }
  return path
}

/** Count cards in each set, and sets (including empty sets) in each folder subtree. */
export const getLibraryCounts = (data: LibraryData): {
  decks: Map<Id, number>, folders: Map<Id, number>
} => {
  const deckCounts = new Map<Id, number>()
  const folderCounts = new Map<Id, number>()
  const parents = new Map(data.folders.map(folder => [folder.id, folder.parentId]))
  for (const card of data.cards) deckCounts.set(card.deckId, (deckCounts.get(card.deckId) || 0) + 1)
  for (const deck of data.decks) {
    const visited = new Set<Id>()
    let parent = deck.folderId
    while (parent && !visited.has(parent)) {
      visited.add(parent)
      folderCounts.set(parent, (folderCounts.get(parent) || 0) + 1)
      parent = parents.get(parent) || null
    }
  }
  return { decks: deckCounts, folders: folderCounts }
}
