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
const evaluate = (file, dependencies = {}) => {
  const sandbox = { exports: {}, require: id => dependencies[id] || (() => { throw new Error(`Unexpected import ${id}`) })() }
  const output = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(output, sandbox)
  return sandbox.exports
}
const cards = evaluate('src/lib/aiCards.ts')
const sessions = evaluate('src/lib/studySessions.ts', {
  './workspace': { startStudySession: (_data, deckId) => ({ deckId, queue: ['a', 'b', 'c'], index: 0, flipped: false, correctCount: 0, wrongCount: 0, history: [] }) }
})
const css = read('src/styles/index.css')
const vars = selector => {
  const start = css.indexOf(selector)
  assert.ok(start >= 0, selector)
  return Object.fromEntries([...css.slice(start).match(/\{([^}]+)\}/)[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}
const maxDelta = (a, b) => Math.max(...[1,3,5].map(i => Math.abs(parseInt(a.slice(i,i+2),16) - parseInt(b.slice(i,i+2),16))))

test('Polish natural requests create structured cards without requiring slash commands', () => {
  const requests = [
    ['Zrób 25 fiszek na podstawie moich notatek',25],
    ['Stwórz 10 fiszek z tekstu',10],
    ['Przygotuj fiszki z materiału',12],
    ['Ułóż 18 pytań do nauki',18],
    ['Poproszę 7 kart do powtórki',7],
    ['Przerób notatki na 12 fiszek',12],
  ]
  for (const [input, count] of requests) assert.equal(cards.parseGenerationCommand(input)?.count, count, input)
  for (const input of ['Wyjaśnij definicję amnezji', 'Co to są fiszki?', 'Rozmawiajmy o kartach do nauki']) {
    assert.equal(cards.parseGenerationCommand(input), null, input)
  }
  assert.throws(() => cards.parseGenerationCommand('Stwórz 99 fiszek'))
})

test('generated structured response is transformed to Tiptap-safe content and saved by the assistant', () => {
  const parsed = cards.parseGeneratedCards(JSON.stringify({ cards: [{ front: '**Termin**', back: 'Wartość [[highlight|ważna]]', kind: 'definition' }] }))
  assert.equal(parsed.length, 1)
  const result = cards.contentToDoc(parsed[0].back)
  assert.equal(result.type, 'doc')
  assert.equal(result.content[0].content[1].marks[0].type, 'highlight')
  const studio = read('src/features/ai/AIStudio.tsx')
  assert.match(studio, /const conversationOnly = wantsConversationInsteadOfCards\(text\)/)
  assert.match(studio, /await onCreateCards\(deckTarget, parsed, model\)/)
  assert.match(studio, /generationInstructions\(count, context\)/)
  assert.match(studio, /setLastCreated\(\{ deckId: deckTarget, cards: parsed \}\)/)
})

test('zero-rated sessions do not offer resume; rated sessions persist and resume', () => {
  const empty = { selected: { type: 'home' }, study: null, studySessions: {} }
  const started = sessions.openStudySession(empty, {}, 'deck')
  assert.equal(sessions.resumableStudySession(started,'deck'), null)
  const afterOne = { ...started.study, index: 1, correctCount: 1 }
  const paused = sessions.exitStudySession(sessions.storeStudySession(started, afterOne))
  assert.equal(sessions.resumableStudySession(paused,'deck').index, 1)
  assert.equal(sessions.openStudySession(paused, {}, 'deck').study.index, 1)
  assert.equal(sessions.openStudySession(paused, {}, 'deck', true).study.index, 0)
})

test('every set menu starts with a primary study action and checks for a saved session', () => {
  const menu = read('src/features/library/itemMenus.tsx')
  assert.match(menu, /label: callbacks\.canResume \? 'Kontynuuj naukę' : 'Rozpocznij naukę'/)
  assert.match(menu, /primary: true/)
  assert.match(menu, /disabled: callbacks\.hasCards === false/)
  const sidebar = read('src/features/library/Sidebar.tsx')
  const overview = read('src/features/library/LibraryOverview.tsx')
  assert.match(sidebar, /onStudy: \(\) => onStudy\(deck\.id\)/)
  assert.match(overview, /onStudy: \(\) => onStudy\(item\.id\)/)
  assert.match(read('src/App.tsx'), /onStudy=\{deckId => startStudy\(deckId\)\}/)
})

test('drag threshold and color ramp require deliberate movement', () => {
  const view = read('src/features/study/StudyView.tsx')
  assert.match(view, /Math\.min\(175, Math\.max\(130, width \* 0\.28\)\)/)
  assert.match(view, /Math\.abs\(distance\) >= acceptanceThreshold/)
  assert.match(view, /Math\.abs\(dragX\) - 34\) \/ 230/)
})

test('both themes use subtle role-preserving hover/active colors', () => {
  for (const sel of [":root, [data-theme='dark']", "[data-theme='light']"]) {
    const t = vars(sel)
    assert.ok(maxDelta(t['accent'],t['accent-hover']) >= 8)
    assert.ok(maxDelta(t['accent'],t['accent-hover']) <= 20)
    assert.ok(maxDelta(t['accent'],t['accent-active']) <= 20)
    assert.ok(maxDelta(t['interactive-hover-bg'],t['interactive-active-bg']) <= 18)
  }
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--interactive-active-bg\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--blue-soft\)\]/)
  assert.match(read('src/components/atoms/Button.tsx'), /enabled:active:bg-\[var\(--danger-active-bg\)\]/)
  assert.doesNotThrow(() => postcss.parse(css))
})

test('AI loading covers its own window until status and models load', () => {
  const studio = read('src/features/ai/AIStudio.tsx')
  assert.match(studio, /\[initializing, setInitializing\] = useState\(true\)/)
  assert.match(studio, /finally \{ if \(alive\) setInitializing\(false\) \}/)
  assert.match(studio, /initializing/)
  assert.match(studio, /absolute inset-0/)
  assert.match(studio, /relative/)
})
