import type { Editor } from '@tiptap/react'
import { TableMap } from '@tiptap/pm/tables'

/**
 * Splits the selected cell into two horizontal cells, even if it was not merged.
 * Other rows keep their visual layout by extending the cell covering that column.
 * The table remains a rectangular ProseMirror grid; no nested tables are created.
 */
export const splitTableCell = (editor: Editor) => editor.chain().focus().command(({ state, tr }) => {
  // A CellSelection resolves directly before its anchor cell, while a text
  // selection resolves inside the cell. Support both without losing selection.
  const selection = state.selection as typeof state.selection & { $anchorCell?: typeof state.selection.$from }
  const $pos = selection.$anchorCell || selection.$from
  let cellDepth = $pos.depth
  while (cellDepth > 0 && !['cell', 'header_cell'].includes($pos.node(cellDepth).type.spec.tableRole || '')) cellDepth--
  let tableDepth = $pos.depth
  while (tableDepth > 0 && $pos.node(tableDepth).type.spec.tableRole !== 'table') tableDepth--
  if (tableDepth === 0) return false

  const table = $pos.node(tableDepth)
  const start = $pos.start(tableDepth)
  const relativeCellPos = (cellDepth > tableDepth ? $pos.before(cellDepth) : $pos.pos) - start
  const cell = table.nodeAt(relativeCellPos)
  if (!cell) return false

  const map = TableMap.get(table)
  const index = map.map.indexOf(relativeCellPos)
  if (index < 0) return false
  const column = index % map.width
  const span = Number(cell.attrs.colspan || 1)
  const oldWidths = Array.isArray(cell.attrs.colwidth) ? cell.attrs.colwidth as number[] : null

  if (span > 1) {
    const left = cell.type.create({ ...cell.attrs, colspan: 1, colwidth: oldWidths?.slice(0, 1) || null }, cell.content, cell.marks)
    const right = cell.type.createAndFill({ ...cell.attrs, colspan: span - 1, colwidth: oldWidths?.slice(1) || null })
    if (!right) return false
    tr.replaceWith(start + relativeCellPos, start + relativeCellPos + cell.nodeSize, [left, right])
    return true
  }

  const right = cell.type.createAndFill({ ...cell.attrs, colspan: 1, colwidth: null })
  if (!right) return false
  const left = cell.type.create({ ...cell.attrs, colspan: 1, colwidth: null }, cell.content, cell.marks)
  const cellPositions = new Set<number>()
  for (let row = 0; row < map.height; row++) {
    const pos = map.map[row * map.width + column]
    if (pos !== relativeCellPos) cellPositions.add(pos)
  }
  const operations = [...cellPositions, relativeCellPos].sort((a, b) => b - a)
  for (const pos of operations) {
    if (pos === relativeCellPos) {
      tr.replaceWith(start + pos, start + pos + cell.nodeSize, [left, right])
      continue
    }
    const other = table.nodeAt(pos)
    if (!other) return false
    const width = Number(other.attrs.colspan || 1)
    const old = Array.isArray(other.attrs.colwidth) ? other.attrs.colwidth as number[] : null
    const rowIndex = map.map.indexOf(pos)
    const firstColumn = rowIndex % map.width
    const offset = Math.max(0, Math.min(column - firstColumn + 1, width))
    const newWidths = old?.length === width
      ? [...old.slice(0, offset), old[Math.max(0, offset - 1)], ...old.slice(offset)]
      : null
    tr.setNodeMarkup(start + pos, undefined, { ...other.attrs, colspan: width + 1, colwidth: newWidths })
  }
  return true
}).run()

export default splitTableCell
