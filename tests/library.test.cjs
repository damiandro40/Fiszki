const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiszki-studio-tests-'))
const compile = filename => {
  const source = fs.readFileSync(path.join(root, 'src/lib', filename), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const destination = path.join(temp, filename.replace('.ts', '.cjs'))
  fs.writeFileSync(destination, output)
  return require(destination)
}

const seed = compile('seed.ts')
const utils = compile('tree.ts')
const data = seed.createSeed()

test('demo dataset keeps a valid nested structure', () => {
  assert.equal(data.folders.length, 4)
  assert.equal(data.decks.length, 3)
  assert.equal(data.cards.length, 4)
  assert.deepEqual(utils.descendantsOf(data, 'demo-anatomia').sort(), ['demo-kosci', 'demo-oun'])
})

test('moving folder into itself or any descendant is rejected', () => {
  assert.equal(utils.folderCanMove(data, 'demo-anatomia', 'demo-anatomia'), false)
  assert.equal(utils.folderCanMove(data, 'demo-anatomia', 'demo-kosci'), false)
  assert.equal(utils.folderCanMove(data, 'demo-anatomia', null), true)
  assert.equal(utils.folderCanMove(data, 'demo-oun', 'demo-histologia'), true)
})

test('deleting folder removes descendants, decks and associated cards', () => {
  const next = utils.removeFolder(data, 'demo-anatomia')
  assert.deepEqual(next.folders.map(folder => folder.id), ['demo-histologia'])
  assert.deepEqual(next.decks.map(deck => deck.id), ['demo-tkanki'])
  assert.deepEqual(next.cards.map(card => card.id), ['demo-4'])
})

test('deleting deck preserves other collections', () => {
  const next = utils.removeDeck(data, 'demo-szkielet')
  assert.equal(next.decks.length, 2)
  assert.equal(next.cards.length, 2)
  assert.equal(next.folders.length, data.folders.length)
})

test('plain text retrieval searches nested Tiptap documents', () => {
  assert.equal(utils.textFromDoc(data.cards[0].front).includes('kości'), true)
  assert.equal(utils.cardCountInFolder(data, 'demo-anatomia'), 3)
  assert.equal(utils.folderPath(data, 'demo-kosci'), 'Anatomia / Kości')
})
