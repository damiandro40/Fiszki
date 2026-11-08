const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = file => readFileSync(path.join(root, file), 'utf8')
const load = file => {
  const filename = path.join(root, file)
  const compiled = ts.transpileModule(read(file), {
    fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
  const module = new Module(filename)
  module.filename = filename
  module.paths = Module._nodeModulePaths(path.dirname(filename))
  module._compile(compiled, filename)
  return module.exports
}

const { getSessionCardOutcomes, getStudyProgress } = load('src/lib/studyProgress.ts')
const { getSessionSummary } = load('src/lib/sessionSummary.ts')
const newSession = (outcomes) => {
  const queue = ['a', 'b', 'c', 'd']
  return {
    deckId: 'deck', queue: [...queue, ...outcomes.filter(item => !item.correct).map(item => item.cardId)],
    index: outcomes.length, flipped: false,
    correctCount: outcomes.filter(item => item.correct).length,
    wrongCount: outcomes.filter(item => !item.correct).length,
    history: outcomes.map(item => ({cardId: item.cardId, correct: item.correct}))
  }
}

test('1.0.1: 30 attempts on 4 unique flashcards never produce more than 4 correct + wrong', () => {
  const attempts = Array.from({ length: 30 }, (_, index) => ({
    cardId: ['a', 'b', 'c', 'd'][index % 4], correct: index % 3 === 0
  }))
  const session = newSession(attempts)
  const counts = getSessionCardOutcomes(session)
  assert.equal(counts.correctCount + counts.wrongCount, 4)
  assert.equal(counts.unreviewed, 0)
  const progress = getStudyProgress(session)
  assert.ok(progress.correct + progress.wrong <= 100)
  assert.equal(progress.correctCount + progress.wrongCount, 4)
})

test('1.0.1: a retry changes the outcome of the same flashcard rather than adding another', () => {
  const first = newSession([{cardId:'a', correct:false}, {cardId:'b', correct:true}])
  assert.deepEqual(getSessionCardOutcomes(first), { correctCount:1, wrongCount:1, unreviewed:2 })
  const recovered = newSession([...first.history, {cardId:'a', correct:true}])
  assert.deepEqual(getSessionCardOutcomes(recovered), { correctCount:2, wrongCount:0, unreviewed:2 })
  assert.deepEqual(getSessionCardOutcomes(first), { correctCount:1, wrongCount:1, unreviewed:2 })
})

test('1.0.1: an old session without history is capped at unique-card count', () => {
  const legacy = { deckId:'deck', queue:['a','b','a'], index:3,
    correctCount:12, wrongCount:40, flipped:false }
  assert.deepEqual(getSessionCardOutcomes(legacy), { correctCount:2, wrongCount:0, unreviewed:0 })
})

test('1.0.2: deck summary counts each card only from the current session', () => {
  const cards = [
    { id:'a', correct:50, incorrect:50, lastAnswerCorrect:true },
    { id:'b', correct:10, incorrect:30, lastAnswerCorrect:false },
    { id:'c', correct:0, incorrect:0, lastAnswerCorrect:null }
  ]
  const summary = getSessionSummary(cards)
  assert.deepEqual(summary, { correct:0, toRepeat:0, unreviewed:3 })
  const active = newSession([{cardId:'a', correct:true}, {cardId:'b', correct:false}])
  assert.deepEqual(getSessionSummary(cards, active), { correct:1, toRepeat:1, unreviewed:1 })
})

test('1.0.1: search match color does not impose bold font', () => {
  assert.doesNotMatch(read('src/components/atoms/HighlightedText.tsx'), /font-extrabold|font-bold/)
  const css = read('src/styles/widgets.css').match(/\.search-match\s*\{([^}]*)\}/)?.[1]
  assert.ok(css)
  assert.doesNotMatch(css, /font-weight/)
})

test('1.0.1: both study options have icons and are not independent bordered cards', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.match(settings, /<Shuffle size=\{18\}/)
  assert.match(settings, /<PanelTop size=\{18\}/)
  assert.match(settings, /Nauka w osobnym oknie/)
  assert.doesNotMatch(settings, /mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border/)
})

test('1.0.1: independent-to-inline migration flushes saves and reloads authoritative grades', () => {
  const controller = read('src/app/useAppController.ts')
  assert.match(controller, /await flush\(\)\s*const resumed = await window\.flashcards\.studyWindowClose\(\)/)
  assert.match(controller, /replace\(await window\.flashcards\.load\(\)\)/)
  assert.match(controller, /studyWindowOpen\(activeSession\.deckId, false, activeSession\)/)
  assert.match(controller, /setWorkspace\(previous => exitStudySession\(previous\)\)/)
})

test('1.0.1: study IPC migrations check sender and serialize grades before closing', () => {
  const main = read('electron/main.ts')
  const model = read('src/types/model.ts')
  const preload = read('electron/preload.ts')
  assert.match(main, /ipcMain\.handle\('study:window-close'/)
  assert.match(main, /const session = await enqueue\(async \(\) => \{/)
  assert.match(main, /const continuedSession = continued == null \? null : studySessionSchema\.parse\(continued\)/)
  assert.match(main, /Przenoszona sesja zawiera nieistniejące fiszki/)
  assert.match(model, /studyWindowClose:/)
  assert.match(preload, /studyWindowClose: \(\) => ipcRenderer\.invoke\('study:window-close'\)/)
})

test('1.0.3: no misleading AI usage panel is shown in settings', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  assert.doesNotMatch(settings, /aiUsage|Zużycie AI|Pozostały limit|aiManageUsage\(\)/)
  assert.match(JSON.parse(read('package.json')).version, /^1\.0\.\d+$/)
})
