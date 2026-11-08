import type { Card, LibraryData } from '../types/model'
import { folderPath, textFromDoc } from './tree'

export type SearchResult =
  | { kind: 'card', id: string, title: string, detail: string, location: string, card: Card }
  | { kind: 'deck' | 'folder', id: string, title: string, detail: string, location: string }

const normalize = (value: string) => value.toLocaleLowerCase('pl').trim()

/** Show matching text instead of an unrelated beginning of a long answer. */
const excerpt = (text: string, needle: string, limit = 160): string => {
  if (text.length <= limit) return text
  const match = normalize(text).indexOf(needle)
  const from = match < 0 ? 0 : Math.max(0, Math.min(match - 30, text.length - limit))
  return `${from ? '…' : ''}${text.slice(from, from + limit)}${from + limit < text.length ? '…' : ''}`
}

export const searchLibrary = (data: LibraryData, query: string): SearchResult[] => {
  const needle = normalize(query)
  if (!needle) return []

  const folders: SearchResult[] = data.folders
    .filter(folder => normalize(folder.name).includes(needle))
    .map(folder => ({ kind: 'folder', id: folder.id, title: folder.name, detail: 'Folder', location: folderPath(data, folder.parentId) || 'Biblioteka' }))

  const decks: SearchResult[] = data.decks
    .filter(deck => normalize(deck.name).includes(needle))
    .map(deck => ({ kind: 'deck', id: deck.id, title: deck.name, detail: 'Zestaw', location: folderPath(data, deck.folderId) || 'Biblioteka' }))

  const deckById = new Map(data.decks.map(deck => [deck.id, deck]))
  const cards: SearchResult[] = []
  for (const card of data.cards) {
    if (folders.length + decks.length + cards.length >= 60) break
    const front = textFromDoc(card.front)
    const back = textFromDoc(card.back)
    const deckName = deckById.get(card.deckId)?.name || 'Zestaw'
    if (!normalize(`${front} ${back} ${deckName}`).includes(needle)) continue
    cards.push({
      kind: 'card', id: card.id, card,
      title: excerpt(front, needle) || 'Fiszka z obrazem lub tabelą',
      detail: excerpt(back, needle),
      location: deckName
    })
  }

  return [...folders, ...decks, ...cards].slice(0, 60)
}

