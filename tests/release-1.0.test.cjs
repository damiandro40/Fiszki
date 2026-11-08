const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const loadPureModule = file => {
  const filename = path.join(root, file)
  const output = ts.transpileModule(read(file), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const mod = new Module(filename)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(output, filename)
  return mod.exports
}

const { getSessionSummary } = loadPureModule('src/lib/sessionSummary.ts')

test('1.0.2: resetting a study session clears visible counters without losing card grades', () => {
  const cards = [
    { id: 'a', correct: 3, incorrect: 1, lastAnswerCorrect: true },
    { id: 'b', correct: 1, incorrect: 7, lastAnswerCorrect: false },
    { id: 'c', correct: 0, incorrect: 0, lastAnswerCorrect: null }
  ]
  const earlier = { deckId: 'demo', queue: ['a', 'b'], index: 2,
    history: [{ cardId: 'b', correct: false }, { cardId: 'a', correct: true }] }
  const restarted = { deckId: 'demo', queue: ['a', 'b', 'c'], index: 0, history: [] }
  const expected = { correct: 1, toRepeat: 1, unreviewed: 1 }
  assert.deepEqual(getSessionSummary(cards, earlier), expected)
  assert.deepEqual(getSessionSummary(cards, restarted), { correct: 0, toRepeat: 0, unreviewed: 3 })
  assert.deepEqual(getSessionSummary(cards, null), { correct: 0, toRepeat: 0, unreviewed: 3 })
  assert.deepEqual(cards.map(card => [card.correct, card.incorrect]), [[3, 1], [1, 7], [0, 0]])
})

test('1.0.2: legacy card grades do not pollute the active session progress', () => {
  const cards = [
    { id: 'a', correct: 2, incorrect: 2 },
    { id: 'b', correct: 1, incorrect: 0 },
    { id: 'c', correct: 0, incorrect: 4 },
    { id: 'd', correct: 0, incorrect: 0 }
  ]
  assert.deepEqual(getSessionSummary(cards), { correct: 0, toRepeat: 0, unreviewed: 4 })
  assert.deepEqual(getSessionSummary(cards, {
    deckId:'demo', queue:['a','b','c','d'], index:1, correctCount:1, wrongCount:0,
    history: [{cardId:'a', correct:true}]
  }), { correct: 1, toRepeat: 0, unreviewed: 3 })
})

test('1.0: Button separates intent and color with compoundSlots', () => {
  const button = read('src/components/atoms/Button.tsx')
  assert.match(button, /intent: \{ solid: \{\}, outline: \{\}, soft: \{\}, ghost: \{\} \}/)
  assert.match(button, /color: \{ primary: \{\}, neutral: \{\}, danger: \{\} \}/)
  assert.match(button, /compoundSlots: \[/)
  for (const intent of ['solid', 'outline', 'soft', 'ghost']) {
    for (const color of ['primary', 'neutral', 'danger']) {
      assert.ok(button.includes(`intent: '${intent}', color: '${color}'`), `${intent} / ${color}`)
    }
  }
  assert.doesNotMatch(button, /\bvariant\b|\btone\b/)
})

test('1.0: popup actions are ghost, dialog confirmations solid, disconnect ghost neutral with destructive confirmation', () => {
  assert.match(read('src/components/Dropdown.tsx'), /layout="row" intent="ghost"/)
  assert.match(read('src/features/library/ManageDialog.tsx'), /intent="solid" color=\{/)
  assert.match(read('src/features/library/SettingsDialog.tsx'), /intent="ghost" color="neutral" icon=\{<LogOut/)
})

test('1.0: atomic Input supports icon, prefix, suffix, trailing content, and shared focus ring', () => {
  const input = read('src/components/atoms/Input.tsx')
  assert.match(input, /icon\?: ReactNode/)
  assert.match(input, /prefix\?: ReactNode/)
  assert.match(input, /suffix\?: ReactNode/)
  assert.match(input, /trailing\?: ReactNode/)
  assert.match(input, /focus-within:border-/)
  assert.match(input, /focus-visible:!outline-none/)
  for (const file of ['src/components/atoms/DebouncedSearchInput.tsx','src/features/library/SearchDialog.tsx','src/components/atoms/Select.tsx']) {
    assert.match(read(file), /<Input\b/, file)
  }
})

test('1.0: assistant uses inline attach/send/stop controls in its composer', () => {
  const composer = read('src/features/ai/AIComposer.tsx')
  const studio = read('src/features/ai/AIStudio.tsx')
  assert.match(composer, /<Plus size=\{19\}\/>/)
  assert.match(composer, /<ArrowUp size=\{19\}/)
  assert.match(composer, /<Square size=\{14\}/)
  assert.match(composer, /sendDisabled/)
  assert.match(studio, /sending=\{busy\}/)
  assert.match(studio, /onCancel=\{\(\) => void window\.flashcards\.aiCancel\(\)\}/)
  assert.doesNotMatch(studio, />Wyślij<\/Button>/)
})

test('1.0: standalone study window is sandboxed and has secure, scoped IPC', () => {
  const main = read('electron/main.ts')
  const preload = read('electron/preload.ts')
  for (const channel of ['study:window-open','study:window-info','study:window-save']) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('${channel.replace(/[-]/g,'-')}'`))
  }
  assert.match(main, /nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true/)
  assert.match(main, /event\.sender !== studyWindow\?\.webContents/)
  assert.match(main, /studySessionSchema\.parse\(payload\)/)
  assert.match(preload, /studyWindowOpen:/)
  assert.match(preload, /studyWindowSave:/)
  assert.match(read('src/main.tsx'), /<StudyWindow \/>/)
})

test('1.0: study grades are committed as one serialized main-process operation', () => {
  const main = read('electron/main.ts')
  assert.match(main, /const oldHistory = before\.history \|\| \[\]/)
  assert.match(main, /newHistory\.length === oldHistory\.length \+ 1/)
  assert.match(main, /newHistory\.length === oldHistory\.length - 1/)
  assert.match(main, /await writeDatabase\(validateLibrary\(updated\)\)/)
  assert.match(main, /await atomicWrite\(getWorkspacePath\(\)/)
  assert.match(main, /Preserve authoritative grade fields/)
  assert.match(main, /independent study session/)
})

test('1.0: learning-in-window setting remains optional for old backups', () => {
  assert.match(read('src/types/model.ts'), /studyInSeparateWindow\?: boolean/)
  assert.match(read('electron/storage/schemas.ts'), /studyInSeparateWindow: z\.boolean\(\)\.optional\(\)/)
  assert.match(read('src/features/library/SettingsDialog.tsx'), /checked=\{studyInSeparateWindow\}/)
  assert.match(read('src/app/useAppController.ts'), /data\.preferences\.studyInSeparateWindow/)
  assert.match(read('src/app/useAppController.ts'), /studyWindowOpen\(deckId, restart\)/)
})

test('1.0: duplication resets grade of new independent card', () => {
  const { duplicateCardAfter } = loadPureModule('src/lib/cardOrdering.ts')
  const doc = { type: 'doc', content: [] }
  const card = { id: 'source', deckId: 'd', front: doc, back: doc, correct: 10, incorrect: 2,
    lastAnswerCorrect: false, lastReviewedAt: '2026-10-10' }
  const cards = duplicateCardAfter([card], 'source', 'copy', '2026-11-08')
  assert.equal(cards.length, 2)
  assert.equal(cards[0].id, 'source')
  assert.equal(cards[1].id, 'copy')
  assert.equal(cards[1].lastAnswerCorrect, null)
  assert.equal(cards[1].correct, 0)
  assert.equal(cards[1].incorrect, 0)
  assert.notStrictEqual(cards[1].front, card.front)
})

test('1.0: package bumped without breaking old user data location and model schema', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.match(pkg.version, /^1\.0\.\d+$/)
  assert.equal(pkg.build.appId, 'studio.fiszki.desktop')
  assert.match(read('electron/storage/schemas.ts'), /version: z\.literal\(1\)/)
  assert.match(read('electron/main.ts'), /priorDataDirs/)
})
