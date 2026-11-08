const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

const sandbox = { exports: {}, module: { exports: {} } }
const source = ts.transpileModule(read('src/lib/aiCards.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(source, sandbox)
const { parseGeneratedCards, parseGenerationCommand, contentToDoc, generationInstructions } = sandbox.exports

test('natural language generation parses count and material without a slash command', () => {
  const value = parseGenerationCommand('Zrób 25 fiszek z materiału: Uklad krążenia')
  assert.equal(value.count, 25)
  assert.equal(value.material, 'Zrób 25 fiszek z materiału: Uklad krążenia')
  assert.equal(parseGenerationCommand('Wyjaśnij tę definicję'), null)
  assert.equal(parseGenerationCommand('Przygotuj fiszki').count, 12)
  assert.equal(parseGenerationCommand('/fiszki 20'), null)
  assert.throws(() => parseGenerationCommand('Zrób 100 fiszek z tekstu'))
})

test('generation results must be structured and non-empty, accepting fenced JSON', () => {
  const value = parseGeneratedCards('```json\n{"cards":[{"kind":"definition","front":"Neuroglia","back":"Komórki podporowe"}]}\n```')
  assert.equal(value[0].kind, 'definition')
  assert.equal(value[0].front, 'Neuroglia')
  assert.throws(() => parseGeneratedCards('Random answer'))
  assert.throws(() => parseGeneratedCards('{"cards":[{"front":"","back":"OK"}]}'))
})

test('unknown card kind maps to question and no arbitrary HTML enters the document', () => {
  const value = parseGeneratedCards('{"cards":[{"kind":"bad","front":"Czym jest ...?","back":"<script>test</script>"}]}')
  assert.equal(value[0].kind, 'question')
  const doc = contentToDoc(value[0].back)
  assert.equal(doc.type, 'doc')
  assert.equal(doc.content[0].content[0].type, 'text')
  assert.equal(doc.content[0].content[0].text, '<script>test</script>')
})

test('generation creates app-side cards and validates the returned schema', () => {
  const prompt = generationInstructions(18)
  assert.match(prompt, /JSON/)
  assert.match(prompt, /18/)
  assert.match(prompt, /kind/)
  assert.match(read('src/features/ai/AIStudio.tsx'), /await onCreateCards\(deckTarget, parsed, model\)/)
  assert.match(read('electron/main.ts'), /createdBy: 'ai' as const/)
  assert.match(read('electron/main.ts'), /needsReview: true/)
  assert.match(read('electron/main.ts'), /writeDatabase\(next\)/)
})

test('the application remains usable without signing in', () => {
  const app = read('src/App.tsx')
  assert.match(app, /<LibraryOverview/)
  assert.match(app, /<DeckView/)
  assert.match(read('src/features/ai/AIWindow.tsx'), /<AIStudio/)
  assert.doesNotMatch(read('electron/main.ts'), /requireLoginForLibrary/)
})

test('AI requests are limited to the main Electron process and OAuth uses PKCE', () => {
  const main = read('electron/main.ts')
  const preload = read('electron/preload.ts')
  const oauth = read('electron/ai/siwc.ts')
  assert.match(main, /assertMainWindow\(event\)/)
  assert.match(preload, /ipcRenderer.invoke\('ai:send'/)
  assert.match(oauth, /code_challenge_method: 'S256'/)
  assert.match(oauth, /verifyIdToken/)
  assert.match(oauth, /safeStorage.encryptString/)
  assert.match(oauth, /store: false, stream: true/)
  assert.match(oauth, /grantedPlanUsage\(current.scope\)/)
})
