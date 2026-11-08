const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)
const runtime = { exports: {}, module: { exports: {} } }
vm.runInNewContext(ts.transpileModule(read('src/lib/aiCards.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, runtime)
const { parseGenerationCommand, generationInstructions, chatInstructions, parseGeneratedCards } = runtime.exports

test('natural language generates flashcards without slash commands', () => {
  assert.equal(parseGenerationCommand('Zrób 25 fiszek na podstawie tego tekstu: neurony przekazują sygnał.').count, 25)
  assert.equal(parseGenerationCommand('Stwórz 10 fiszek z notatek').count, 10)
  assert.equal(parseGenerationCommand('Przygotuj fiszki z tego materiału').count, 12)
  assert.equal(parseGenerationCommand('/fiszki 7\nBłona śluzowa'), null)
  assert.equal(parseGenerationCommand('Wyjaśnij budowę błony śluzowej'), null)
  assert.throws(() => parseGenerationCommand('Zrób 81 fiszek z tekstu'))
})

test('model sees target set title and three card formats without obsolete description', () => {
  const context = { name: 'OUN', description: 'Neuroanatomia i fizjologia' }
  const instruction = generationInstructions(20, context)
  assert.match(instruction, /OUN/)
  assert.doesNotMatch(instruction, /Neuroanatomia/)
  assert.match(instruction, /question/)
  assert.match(instruction, /definition/)
  assert.match(instruction, /cloze/)
  assert.match(chatInstructions(context), /OUN/)
})

test('generated cards are parsed and saved without manual JSON import', () => {
  const cards = parseGeneratedCards(JSON.stringify({ cards: [
    { front: 'Mózgowie', back: 'Część ośrodkowego układu nerwowego', kind: 'definition' }
  ] }))
  assert.equal(cards.length, 1)
  assert.match(read('src/features/ai/AIStudio.tsx'), /await onCreateCards\(deckTarget, parsed, model\)/)
  assert.doesNotMatch(read('src/features/ai/AIStudio.tsx'), /Zapisz \{cards.length\} fiszek/)
  assert.match(read('src/App.tsx'), /await flush\(\)/)
})

test('AI provenance survives validated local JSON and can be reviewed', () => {
  assert.match(read('src/types/model.ts'), /createdBy\?: 'ai'/)
  assert.match(read('electron/main.ts'), /createdBy: z.literal\('ai'\).optional\(\)/)
  assert.match(read('electron/main.ts'), /needsReview: true/)
  assert.match(read('src/features/library/DeckView.tsx'), /Oznacz jako sprawdzoną/)
  assert.match(read('src/features/library/DeckView.tsx'), /Do weryfikacji/)
})

test('AI thread is scoped to the selected deck and overlays the active library view', () => {
  assert.match(read('src/App.tsx'), /toggleAssistant\(selectedDeck\?\.id \?\? null\)/)
  assert.match(read('src/features/ai/AIStudio.tsx'), /deckId: string \| null/)
  assert.match(read('src/features/ai/AIStudio.tsx'), /historyKey\(deckId\)/)
  assert.match(read('src/features/ai/AIWindow.tsx'), /<AIStudio compact/)
  assert.match(read('src/features/library/Sidebar.tsx'), /selected.type === 'home'/)
})

test('OAuth phase signals are delivered across isolated preload bridge', () => {
  assert.match(read('electron/ai/siwc.ts'), /onProgress\('callback'\)/)
  assert.match(read('electron/main.ts'), /'ai:auth-progress'/)
  assert.match(read('electron/preload.ts'), /onAiAuthProgress:/)
})

test('UI uses set terminology, menu location formatting and one primary add button', () => {
  assert.match(read('src/features/library/LibraryOverview.tsx'), /trigger="add"/)
  assert.match(read('src/components/Dropdown.tsx'), /action.contextValue &&/)
  assert.match(read('src/components/Dropdown.tsx'), /<span className="font-normal not-italic text-\[var\(--faint\)\]"/)
  assert.match(read('src/features/library/ManageDialog.tsx'), /Nowy zestaw/)
})
