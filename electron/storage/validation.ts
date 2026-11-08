import type { LibraryData, RichDoc } from '../../src/types/model'
import { librarySchema } from './schemas'

const safeRichAttrs = (attrs: unknown): boolean => {
  if (attrs === undefined) return true
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return false
  return Object.keys(attrs).every(key => !['__proto__', 'prototype', 'constructor', 'style', 'srcdoc'].includes(key.toLowerCase()) && !/^on[a-z]/i.test(key))
}

const safeRichMark = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const mark = value as Record<string, unknown>
  if (typeof mark.type !== 'string' || mark.type.length > 80 || !safeRichAttrs(mark.attrs)) return false
  const attrs = mark.attrs as Record<string, unknown> | undefined
  if (mark.type === 'link' && attrs?.href !== undefined) {
    if (typeof attrs.href !== 'string' || !/^https?:\/\//i.test(attrs.href)) return false
    try { if (!['https:', 'http:'].includes(new URL(attrs.href).protocol)) return false } catch { return false }
  }
  if ((mark.type === 'highlight' || mark.type === 'textStyle') && attrs?.color !== undefined) {
    const color = attrs.color
    if (typeof color !== 'string' || !(/^(#[0-9a-f]{3,8}|var\(--accent-(ink|soft)\)|rgba?\([\d\s,.%]+\))$/i.test(color))) return false
  }
  return true
}

export const validateRichDoc = (root: unknown): root is RichDoc => {
  let count = 0
  const visit = (value: unknown, depth: number): boolean => {
    count++
    if (depth > 50 || count > 80000 || typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const node = value as Record<string, unknown>
    if (typeof node.type !== 'string' || node.type.length > 80) return false
    if (node.text !== undefined && (typeof node.text !== 'string' || node.text.length > 200000)) return false
    if (!safeRichAttrs(node.attrs)) return false
    if (node.type === 'image') {
      const src = (node.attrs as Record<string, unknown> | undefined)?.src
      if (typeof src !== 'string' || !/^data:image\/(webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(src) || src.length > 12_000_000) return false
    }
    if (node.content !== undefined && (!Array.isArray(node.content) || !node.content.every(child => visit(child, depth + 1)))) return false
    if (node.marks !== undefined && (!Array.isArray(node.marks) || node.marks.length > 40 ||
      !node.marks.every(safeRichMark))) return false
    return true
  }

  return visit(root, 0) && (root as RichDoc).type === 'doc'
}

export const validateLibrary = (payload: unknown): LibraryData => {
  const parsed = librarySchema.parse(payload)
  const folderIds = new Set(parsed.folders.map(item => item.id))
  const deckIds = new Set(parsed.decks.map(item => item.id))
  const cardIds = new Set(parsed.cards.map(item => item.id))

  if (folderIds.size !== parsed.folders.length || deckIds.size !== parsed.decks.length || cardIds.size !== parsed.cards.length) throw new Error('Zduplikowane identyfikatory w bazie')
  if (parsed.folders.some(item => item.parentId !== null && !folderIds.has(item.parentId))) throw new Error('Nieprawidłowa struktura folderów')
  if (parsed.decks.some(item => item.folderId !== null && !folderIds.has(item.folderId))) throw new Error('Nieprawidłowe położenie zestawu')
  if (parsed.cards.some(item => !deckIds.has(item.deckId) || !validateRichDoc(item.front) || !validateRichDoc(item.back))) throw new Error('Nieprawidłowa zawartość fiszek')

  const byId = new Map(parsed.folders.map(folder => [folder.id, folder.parentId]))
  for (const folder of parsed.folders) {
    const seen = new Set<string>()
    let id: string | null = folder.id
    while (id !== null) {
      if (seen.has(id)) throw new Error('Wykryto cykl w strukturze folderów')
      seen.add(id)
      id = byId.get(id) ?? null
    }
  }

  return parsed as LibraryData
}

