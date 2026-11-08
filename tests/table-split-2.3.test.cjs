const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/features/editor/splitTableCell.ts'), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

const cellType = {
  spec: { tableRole: 'cell' },
  create: (attrs, content, marks) => ({ type: cellType, attrs, content, marks, nodeSize: 6 }),
  createAndFill: attrs => ({ type: cellType, attrs, content: { size: 2 }, nodeSize: 6 })
}
const tableType = { spec: { tableRole: 'table' } }
const rowType = { spec: { tableRole: 'row' } }

const runSplit = (selectedSpan = 1, wholeCellSelected = false) => {
  const positions = [1, 7, 13, 19]
  const cells = new Map(positions.map(pos => [pos, { type: cellType, attrs: { colspan: pos === 1 ? selectedSpan : 1, rowspan: 1, colwidth: null }, nodeSize: 6, content: { size: 2 }, marks: [] }]))
  const table = { type: tableType, nodeAt: pos => cells.get(pos) }
  const from = { depth: 3, node: depth => depth === 3 ? cells.get(1) : depth === 2 ? { type: rowType } : table, start: () => 100, before: () => 101 }
  const operations = []
  const tr = {
    replaceWith: (a, b, nodes) => operations.push({ name: 'replace', a, b, nodes }),
    setNodeMarkup: (pos, unused, attrs) => operations.push({ name: 'set', pos, attrs })
  }
  let result
  const anchor = { depth: 2, pos: 101, node: depth => depth === 2 ? { type: rowType } : table, start: () => 100 }
  const state = { selection: { $from: from, ...(wholeCellSelected ? { $anchorCell: anchor } : {}) } }
  const editor = { chain: () => ({
    focus() { return this },
    command(fn) { result = fn({ state, tr }); return this },
    run() { return result }
  }) }
  const mod = { exports: {} }
  vm.runInNewContext(javascript, { module: mod, exports: mod.exports, require: name => {
    if (name === '@tiptap/pm/tables') return { TableMap: { get: () => ({ width: 2, height: 2, map: [1, 7, 13, 19] }) } }
    throw new Error(`Unexpected import: ${name}`)
  } })
  const ok = mod.exports.default(editor)
  return { ok, operations }
}

test('splitting a normal table cell creates a second cell while preserving other row width through colspan', () => {
  const { ok, operations } = runSplit()
  assert.equal(ok, true)
  const insert = operations.find(op => op.name === 'replace')
  assert.ok(insert)
  assert.equal(insert.nodes.length, 2)
  assert.equal(insert.nodes[0].attrs.colspan, 1)
  assert.equal(insert.nodes[1].attrs.colspan, 1)
  const expanded = operations.find(op => op.name === 'set')
  assert.equal(expanded.pos, 113)
  assert.equal(expanded.attrs.colspan, 2)
})

test('splitting a previously merged cell divides its colspan without expanding other rows', () => {
  const { ok, operations } = runSplit(2)
  assert.equal(ok, true)
  assert.equal(operations.length, 1)
  assert.equal(operations[0].name, 'replace')
  assert.equal(operations[0].nodes.length, 2)
  assert.equal(operations[0].nodes[0].attrs.colspan + operations[0].nodes[1].attrs.colspan, 2)
})

test('splitting an explicitly selected table cell also works from CellSelection anchor', () => {
  const { ok, operations } = runSplit(1, true)
  assert.equal(ok, true)
  assert.equal(operations.find(op => op.name === 'replace').nodes.length, 2)
})
