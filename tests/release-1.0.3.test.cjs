const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const { getCardDrafts, editingDraftId, upsertCardDraft, removeCardDraft, reconcileCardDrafts } = require('../src/lib/cardDrafts.ts')
const { createSeed } = require('../src/lib/seed.ts')
const { resumableStudySession } = require('../src/lib/studySessions.ts')
const { reconcileWorkspace } = require('../src/lib/workspace.ts')
const data = createSeed()
const original = data.cards[0]
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const makeDraft = (draftId, cardId, front = 'a', updatedAt = '2026-11-08T12:00:00Z', deckId = 'demo-szkielet') => ({
  draftId, cardId, deckId, updatedAt, front: doc(front), back: doc('response')
})

test('1.0.3: two new unsaved cards in one set have distinct persisted drafts', () => {
  const first = makeDraft('new:first', null, 'pierwsza')
  const second = makeDraft('new:second', null, 'druga')
  const both = upsertCardDraft(upsertCardDraft([], first), second)
  assert.equal(both.length, 2)
  assert.deepEqual(both.map(draft => draft.draftId).sort(), ['new:first', 'new:second'])
  const persisted = reconcileWorkspace({ version: 1, selected: { type: 'home' }, study: null, cardDrafts: both }, data)
  assert.equal(persisted.cardDrafts.length, 2)
})

test('1.0.3: re-editing the same existing card overwrites only its draft', () => {
  const id = editingDraftId(original.id)
  const a = makeDraft(id, original.id, 'old', '2026-11-08T12:01:00Z', original.deckId)
  const b = makeDraft('new:new-card', null, 'different')
  const newer = makeDraft(id, original.id, 'new', '2026-11-08T12:02:00Z', original.deckId)
  const drafts = upsertCardDraft(upsertCardDraft(upsertCardDraft([], a), b), newer)
  assert.equal(drafts.length, 2)
  assert.equal(drafts.find(draft => draft.draftId === id).front.content[0].content[0].text, 'new')
  assert.equal(drafts.find(draft => draft.draftId === b.draftId).front.content[0].content[0].text, 'different')
})

test('1.0.3: saving or discarding one draft does not touch other drafts', () => {
  const a = makeDraft('new:a', null)
  const b = makeDraft('new:b', null)
  assert.deepEqual(removeCardDraft([a, b], 'new:a'), [b])
  assert.deepEqual(removeCardDraft([a, b], 'absent'), [a, b])
})

test('1.0.3: existing workspace with one legacy draft migrates without losing content', () => {
  const legacy = makeDraft('unused', original.id, 'important', undefined, original.deckId)
  const { draftId: _unused, ...oldFormat } = legacy
  const saved = { version: 1, selected: { type: 'home' }, study: null, pendingCardDraft: oldFormat }
  const restored = reconcileWorkspace(saved, data)
  assert.equal(restored.cardDrafts.length, 1)
  assert.equal(restored.cardDrafts[0].draftId, editingDraftId(original.id))
  assert.equal(restored.cardDrafts[0].front.content[0].content[0].text, 'important')
  assert.equal(restored.pendingCardDraft, undefined)
})

test('1.0.3: moved existing card keeps its draft in its new set, deleted card loses only its stale draft', () => {
  const moved = { ...data, decks: [...data.decks, { ...data.decks[0], id:'new-deck' }], cards: data.cards.map(card =>
    card.id === original.id ? { ...card, deckId: 'new-deck' } : card) }
  const originalDraft = makeDraft(editingDraftId(original.id), original.id, 'important', '2026-11-08T12:00:00Z', original.deckId)
  const fresh = makeDraft('new:different', null)
  const restored = reconcileCardDrafts({ version: 1, selected: { type: 'home' }, study: null, cardDrafts:[originalDraft, fresh] }, moved)
  assert.equal(restored.length, 2)
  assert.equal(restored.find(draft => draft.cardId === original.id).deckId, 'new-deck')
  const deleted = { ...data, cards: data.cards.filter(card => card.id !== original.id) }
  const cleaned = reconcileCardDrafts({ version:1, selected:{ type:'home' }, study:null, cardDrafts:[originalDraft,fresh] }, deleted)
  assert.deepEqual(cleaned.map(draft => draft.draftId), ['new:different'])
})

test('1.0.3: resume opens the question side while preserving index and grade counts', () => {
  const session = { deckId: 'demo-szkielet', queue: [original.id, data.cards[1].id], index: 1,
    correctCount: 1, wrongCount: 0, flipped: true }
  const workspace = { version:1, selected:{type:'home'},study:null, studySessions:{'demo-szkielet':session} }
  const resumed = resumableStudySession(workspace, 'demo-szkielet')
  assert.equal(resumed.flipped, false)
  assert.equal(resumed.index, 1)
  assert.equal(resumed.correctCount, 1)
  assert.equal(session.flipped, true)
})

test('1.0.3: windowed study header and counter are isolated from inline study UI', () => {
  const study = read('src/views/study/StudyView.tsx')
  assert.match(study, /\{!standalone && <div className="study-topbar"/)
  assert.match(study, /\{standalone && <div className="mt-4 text-center/)
  assert.match(study, /aria-label="Numer bieżącej fiszki"/)
  assert.match(read('src/views/study/StudyWindow.tsx'), /<Titlebar title="Fiszki" subtitle=\{deck\?\.name\}/)
})

test('1.0.3: muted metadata, action context, and button icons share restrained styles', () => {
  assert.match(read('src/views/library/LibraryOverview.tsx'), /strokeWidth=\{2\.5\} className=\"shrink-0 text-\[var\(--accent-ink\)\]\"/)
  assert.match(read('src/components/Dropdown.tsx'), /font-normal not-italic text-\[var\(--faint\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /icon: .*opacity-75.*group-hover:opacity-100/)
  assert.match(read('src/features/library/DraftStack.tsx'), /intent="solid" color="primary" size="md"/)
  assert.doesNotMatch(read('src/features/library/SettingsDialog.tsx'), /Zużycie AI w tej aplikacji/)
  assert.doesNotMatch(read('src/features/library/CardComposer.tsx'), /Zamknij<\/Button>/)
  assert.match(require('../package.json').version, /^1\.0\.\d+$/)
})
