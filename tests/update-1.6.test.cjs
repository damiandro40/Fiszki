const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const read = file => readSource(root, file)

const compile = (filename, dependencies = {}) => {
  const js = ts.transpileModule(read(filename), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const sandbox = { exports: {}, require: name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`Unmapped local import: ${name}`)
  }}
  vm.runInNewContext(js, sandbox)
  return sandbox.exports
}

const { getStudyProgress } = compile('src/lib/studyProgress.ts')
const tree = compile('src/lib/tree.ts')
const { searchLibrary } = compile('src/lib/search.ts', { './tree': tree })

const session = (queue, index, correctCount, wrongCount) => ({
  deckId: 'deck', queue, index, flipped: false, correctCount, wrongCount
})

test('segmented progress counts distinct cards while tracking pending attempts', () => {
  const empty = getStudyProgress(session(['1', '2', '3'], 0, 0, 0))
  assert.equal(empty.progress, 0)
  assert.equal(empty.correct, 0)
  assert.equal(empty.wrong, 0)
  assert.equal(empty.pending, 3)

  const wrong = getStudyProgress(session(['1', '2', '3', '1'], 1, 0, 1))
  assert.equal(wrong.progress, 25)
  assert.ok(Math.abs(wrong.wrong - 100 / 3) < 0.001)
  assert.equal(wrong.pending, 3)

  const mixed = getStudyProgress(session(['1', '2', '3', '1'], 2, 1, 1))
  assert.equal(mixed.progress, 50)
  assert.ok(Math.abs(mixed.correct - 100 / 3) < 0.001)
  assert.ok(Math.abs(mixed.wrong - 100 / 3) < 0.001)
  assert.equal(mixed.pending, 2)
})

test('progress clamps damaged values without showing more than 100 percent', () => {
  const broken = getStudyProgress(session(['1', '2'], 4, 50, 30))
  assert.equal(broken.progress, 100)
  assert.equal(broken.correct, 100)
  assert.equal(broken.wrong, 0)
  assert.equal(broken.pending, 0)
})

const card = (id, deckId, front, back) => ({
  id, deckId, front: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: front }] }] },
  back: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: back }] }] }
})
const data = {
  folders: [{ id: 'f1', name: 'Anatomia', parentId: null }],
  decks: [{ id: 'd1', name: 'OUN', description: 'Neuroanatomia', folderId: 'f1' }],
  cards: [card('c1', 'd1', 'Móżdżek', 'Koordynacja ruchów')]
}

test('modal search finds folders, decks, questions and answers without navigation', () => {
  assert.equal(searchLibrary(data, 'anatomia')[0].kind, 'folder')
  assert.equal(searchLibrary(data, 'OUN')[0].kind, 'deck')
  assert.equal(searchLibrary(data, 'móżdżek').at(-1).id, 'c1')
  assert.equal(searchLibrary(data, 'KOORDYNACJA').at(-1).id, 'c1')
  assert.equal(searchLibrary(data, '').length, 0)
})

test('opening search or AI no longer replaces the study view or resets the workspace', () => {
  const app = read('src/App.tsx')
  assert.match(app, /\{searchOpen && <SearchDialog/)
  assert.match(read('src/features/ai/AIWindow.tsx'), /<AIStudio compact/)
  assert.match(app, /if \(currentStudyDeck\) \{[\s\S]*?return <StudyView/)
  assert.doesNotMatch(app, /normalizedSearch \? <div/)
  assert.doesNotMatch(app, /display: aiOpen \? 'none' : 'contents'/)
  assert.match(app, /onAI=\{\(\) => void toggleAssistant\(selectedDeck\?\.id \?\? null\)\}/)
})

test('chat stores messages per deck and remains mounted when minimized', () => {
  const ai = read('src/features/ai/AIStudio.tsx')
  const app = read('src/App.tsx')
  assert.match(ai, /historyKey\(deckId\)/)
  assert.match(read('src/features/ai/AIWindow.tsx'), /flex h-screen w-screen/)
  assert.match(read('src/views/ai/AIWindow.tsx'), /ai-window-body/)
  assert.match(read('src/styles/index.css'), /\.study-progress-segments/)
})

test('strict TypeScript checks newly added pure data modules', () => {
  const program = ts.createProgram(['src/lib/search.ts','src/lib/studyProgress.ts','src/lib/tree.ts','src/types/model.ts'], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], strict: true, noEmit: true, skipLibCheck: true
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')), [])
})
