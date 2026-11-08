const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const evaluate = file => {
  const sandbox = { exports: {} }
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js, sandbox)
  return sandbox.exports
}
const cards = evaluate('src/lib/aiCards.ts')
const intent = evaluate('src/lib/aiIntent.ts')

test('AI generation is the default, chat is an explicitly requested exception', () => {
  for (const message of ['Anatomia OUN', 'Opisz podstawy EKG', 'Materiał: Tętnice szyjne', 'Zrób 10 fiszek', 'Wygeneruj pytania z moich notatek']) {
    assert.equal(intent.wantsConversationInsteadOfCards(message), false, message)
  }
  for (const message of ['Wyjaśnij czym jest bariera krew–mózg', 'Tylko odpowiedz bez fiszek', 'Porozmawiaj o nauce', 'Przetłumacz ten fragment']) {
    assert.equal(intent.wantsConversationInsteadOfCards(message), true, message)
  }
  assert.equal(intent.requestedCardCount('Zrób 24 fiszki'), 24)
  assert.equal(intent.requestedCardCount('Z mojego tekstu proszę materiał'), null)
  assert.throws(() => intent.requestedCardCount('Zrób 90 fiszek'))
  const instructions = cards.generationInstructions(null, { name: 'Neuroanatomia', existingCards: [{ front: 'Pytanie', back: 'Odpowiedź' }] })
  assert.match(instructions, /Samodzielnie oszacuj/)
  assert.match(instructions, /Nie duplikuj/)
  assert.match(instructions, /tabel/)
})

test('generated card formatting converts a markdown table to TipTap table nodes', () => {
  const doc = cards.contentToDoc('| Funkcja | Droga |\n| --- | --- |\n| **Pamięć** | [[accent|Hipokamp]] |')
  assert.equal(doc.content[0].type, 'table')
  assert.equal(doc.content[0].content[0].content[0].type, 'tableHeader')
  assert.equal(doc.content[0].content[1].content[0].type, 'tableCell')
  assert.equal(doc.content[0].content[1].content[0].content[0].content[0].marks[0].type, 'bold')
  const formatted = cards.contentToDoc('**ważne** i [[highlight|podświetlone]]')
  assert.equal(formatted.content[0].content[0].marks[0].type, 'bold')
  assert.equal(formatted.content[0].content[2].marks[0].type, 'highlight')
})

test('assistant stores separate local transcripts with bounded IPC validation', () => {
  const main = read('electron/main.ts')
  const studio = read('src/features/ai/AIStudio.tsx')
  const preload = read('electron/preload.ts')
  assert.match(main, /createHash\('sha256'\)/)
  assert.match(main, /aiHistorySchema = z\.array\(aiHistoryMessageSchema\)\.max\(100\)/)
  assert.match(main, /ipcMain\.handle\('ai:history-load'/)
  assert.match(main, /ipcMain\.handle\('ai:history-save'/)
  assert.match(main, /aiAttachmentSchema/)
  assert.match(preload, /aiHistorySave: \(deckId, messages\)/)
  assert.match(studio, /historyKey\(deckId\)/)
  assert.match(studio, /aiHistoryLoad\(deckId\)/)
  assert.match(studio, /aiHistorySave\(deckId,/)
  assert.match(studio, /await onCreateCards\(deckTarget, parsed, model\)/)
  assert.match(studio, /wantsConversationInsteadOfCards\(text\)/)
})

test('chat editor uses TipTap with file previews and only plain-text marks', () => {
  const composer = read('src/features/ai/AIComposer.tsx')
  const message = read('src/features/ai/MessageContent.tsx')
  const transport = read('electron/ai/siwc.ts')
  assert.match(composer, /useEditor\(/)
  assert.match(composer, /bold: false, italic: false, strike: false/)
  assert.match(composer, /handlePaste:/)
  assert.match(composer, /handleDrop:/)
  assert.match(composer, /onRemove\(item\.id\)/)
  assert.match(message, /className="ai-markdown"/)
  assert.doesNotMatch(message, /dangerouslySetInnerHTML|innerHTML/)
  assert.match(transport, /type: 'input_image'/)
  assert.match(transport, /type: 'input_text'/)
})

test('unfinished flashcard drafts persist independently across editing sessions', () => {
  const app = read('src/app/AppDialogs.tsx')
  const composer = read('src/features/library/CardComposer.tsx')
  const workspace = read('src/lib/workspace.ts')
  const persistence = read('electron/main.ts')
  assert.match(app, /cardDrafts.length && !composerDeckId && !workspace.study/)
  assert.match(app, /upsertCardDraft\(getCardDrafts\(previous\)/)
  assert.match(composer, /dirty = JSON\.stringify/)
  assert.match(composer, /Odrzuć zmiany/)
  assert.match(workspace, /reconcileCardDrafts\(saved, data\)/)
  assert.match(persistence, /state.cardDrafts/)
})

test('settings nav uses a stable selected pill; menus and metrics share consistent defaults', () => {
  const css = read('src/styles/index.css')
  assert.match(read('src/features/library/SettingsDialog.tsx'), /selected=\{section === item.id\}/)
  assert.match(read('src/components/atoms/Button.tsx'), /w-full min-w-0 justify-start rounded-lg/)
  assert.match(read('src/components/atoms/Button.tsx'), /intent: 'solid', color: 'primary'/)
  assert.match(read('src/views/library/LibraryOverview.tsx'), /stats-grid mb-8 grid/)
  assert.doesNotThrow(() => postcss.parse(css))
  const menu = read('src/features/library/itemMenus.tsx')
  assert.match(menu, /callbacks\.canResume \? <PlayCircle/)
})
