const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8')
const { getSessionSummary } = require('../src/lib/sessionSummary.ts')
const { getStudyProgress } = require('../src/lib/studyProgress.ts')

const cards = ['a', 'b', 'c', 'd'].map(id => ({
  id, correct: 35, incorrect: 18, lastAnswerCorrect: true
}))
const session = (history, rest = {}) => ({
  deckId: 'deck', queue: ['a', 'b', 'c', 'd', ...history.filter(entry => !entry.correct).map(entry => entry.cardId)],
  index: history.length, correctCount: history.filter(entry => entry.correct).length,
  wrongCount: history.filter(entry => !entry.correct).length, flipped: false, history, ...rest
})

test('1.0.2: deck counters equal the study progress bar for the very same session', () => {
  const ongoing = session([{ cardId: 'a', correct: true }, { cardId: 'b', correct: false }])
  const summary = getSessionSummary(cards, ongoing)
  const progress = getStudyProgress(ongoing)
  assert.equal(summary.correct, progress.correctCount)
  assert.equal(summary.toRepeat, progress.wrongCount)
  assert.deepEqual(summary, { correct: 1, toRepeat: 1, unreviewed: 2 })
})

test('1.0.2: new study and no study reset visible counters to 0/0 regardless of lifetime grades', () => {
  const restarted = session([])
  assert.deepEqual(getSessionSummary(cards, restarted), { correct: 0, toRepeat: 0, unreviewed: 4 })
  assert.deepEqual(getSessionSummary(cards, null), { correct: 0, toRepeat: 0, unreviewed: 4 })
  assert.deepEqual(getStudyProgress(restarted), {
    progress: 0, correct: 0, wrong: 0, pending: 4,
    correctCount: 0, wrongCount: 0, unreviewed: 4
  })
})

test('1.0.2: retry changes the card category and deleted cards do not inflate deck metrics', () => {
  const ongoing = session([
    {cardId:'a', correct:false}, {cardId:'b', correct:true}, {cardId:'a', correct:true}
  ])
  assert.deepEqual(getSessionSummary(cards, ongoing), { correct: 2, toRepeat: 0, unreviewed: 2 })
  assert.deepEqual(getSessionSummary(cards.filter(card => card.id !== 'a'), ongoing), { correct: 1, toRepeat: 0, unreviewed: 2 })
})

test('1.0.2: deck view uses completed or reset saved session, not just resumable sessions', () => {
  const current = read('src/app/CurrentView.tsx')
  const deck = read('src/views/decks/DeckView.tsx')
  assert.match(current, /workspace\.studySessions\?\.\[selectedDeck\.id\]/)
  assert.match(current, /const resumableSession = resumableStudySession/)
  assert.match(deck, /Stworzone przez AI:/)
  assert.match(deck, /onlyToReview \|\| filter\.trim\(\) \? filtered\.length/)
  assert.match(deck, /card\.createdBy === 'ai' && card\.needsReview/)
})

test('1.0.2: standalone restart cannot be misread as undoing the sole grade', () => {
  const study = read('src/views/study/StudyView.tsx')
  const standalone = read('src/views/study/StudyWindow.tsx')
  const preload = read('electron/preload.ts')
  const main = read('electron/main.ts')
  assert.match(study, /}, 'restart'\)/)
  assert.match(standalone, /action !== 'restart' && newHistory\.length === oldHistory\.length - 1/)
  assert.match(standalone, /studyWindowSave\(next, action === 'restart'\)/)
  assert.match(preload, /studyWindowSave: \(session, restart\)/)
  assert.match(main, /if \(restart === true\) \{/)
  assert.match(main, /Nieprawidłowy restart nauki/)
})

test('1.0.3: the removed AI usage panel has no active IPC or streaming collector', () => {
  const settings = read('src/features/library/SettingsDialog.tsx')
  const preload = read('electron/preload.ts')
  const main = read('electron/main.ts')
  const ai = read('electron/ai/siwc.ts')
  assert.doesNotMatch(settings, /aiUsage|Zużycie AI/)
  assert.doesNotMatch(preload, /aiUsageSummary/)
  assert.doesNotMatch(main, /ai:usage-summary|recordAiUsage/)
  assert.match(ai, /payload.type === 'response.completed'/)
  assert.doesNotMatch(ai, /responseTokens|parseAiResponseUsage/)
  assert.match(JSON.parse(read('package.json')).version, /^1\.0\.\d+$/)
})
