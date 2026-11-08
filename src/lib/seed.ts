import type { LibraryData, RichDoc } from '../types/model'

export const emptyDoc = (): RichDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] })
export const docFromText = (value: string): RichDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }]
})

export const createSeed = (): LibraryData => {
  const time = new Date().toISOString()
  const folder = (id: string, name: string, parentId: string | null) => ({ id, name, parentId, createdAt: time, updatedAt: time })
  const deck = (id: string, name: string, folderId: string) => ({ id, name, folderId, description: '', createdAt: time, updatedAt: time })
  const card = (id: string, deckId: string, front: string, back: string) => ({
    id, deckId, front: docFromText(front), back: docFromText(back), createdAt: time, updatedAt: time,
    correct: 0, incorrect: 0, lastReviewedAt: null
  })

  return {
    version: 1,
    folders: [
      folder('demo-anatomia', 'Anatomia', null),
      folder('demo-kosci', 'Kości', 'demo-anatomia'),
      folder('demo-oun', 'OUN', 'demo-anatomia'),
      folder('demo-histologia', 'Histologia', null)
    ],
    decks: [
      deck('demo-szkielet', 'Układ szkieletowy', 'demo-kosci'),
      deck('demo-neuro', 'Neuroanatomia', 'demo-oun'),
      deck('demo-tkanki', 'Tkanki', 'demo-histologia')
    ],
    cards: [
      card('demo-1', 'demo-szkielet', 'Ile kości ma typowo szkielet dorosłego człowieka?', '206'),
      card('demo-2', 'demo-szkielet', 'Która kość jest najdłuższa w ciele człowieka?', 'Kość udowa'),
      card('demo-3', 'demo-neuro', 'Jakie struktury tworzą ośrodkowy układ nerwowy?', 'Mózgowie i rdzeń kręgowy'),
      card('demo-4', 'demo-tkanki', 'Jakie są cztery podstawowe rodzaje tkanek?', 'Nabłonkowa, łączna, mięśniowa i nerwowa')
    ],
    preferences: { theme: 'system', shuffle: true, studyKeys: { flip: 'Space', again: 'Digit1', known: 'Digit2' } }
  }
}
