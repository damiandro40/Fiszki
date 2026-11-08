import { createElement } from 'react'
import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, Combine, Heading, Split, Trash2 } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import type { DropdownAction } from '../../components/Dropdown'
import splitTableCell from './splitTableCell'

export const getTableActions = (editor: Editor): DropdownAction[] => [
  { label: 'Wstaw wiersz powyżej', icon: createElement(ArrowUpToLine, { size: 16 }), onSelect: () => editor.chain().focus().addRowBefore().run() },
  { label: 'Wstaw wiersz poniżej', icon: createElement(ArrowDownToLine, { size: 16 }), onSelect: () => editor.chain().focus().addRowAfter().run() },
  { label: 'Wstaw kolumnę z lewej', icon: createElement(ArrowLeftToLine, { size: 16 }), onSelect: () => editor.chain().focus().addColumnBefore().run() },
  { label: 'Wstaw kolumnę z prawej', icon: createElement(ArrowRightToLine, { size: 16 }), onSelect: () => editor.chain().focus().addColumnAfter().run() },
  { label: 'Scal zaznaczone komórki', icon: createElement(Combine, { size: 16 }), onSelect: () => editor.chain().focus().mergeCells().run(), disabled: !editor.can().mergeCells() },
  { label: 'Podziel komórkę', icon: createElement(Split, { size: 16 }), onSelect: () => { splitTableCell(editor) } },
  { label: 'Ustaw komórkę / komórki nagłówkowe', icon: createElement(Heading, { size: 16 }), onSelect: () => editor.chain().focus().toggleHeaderCell().run() },
  { label: 'Usuń wiersz', icon: createElement(Trash2, { size: 16 }), onSelect: () => editor.chain().focus().deleteRow().run(), destructive: true },
  { label: 'Usuń kolumnę', icon: createElement(Trash2, { size: 16 }), onSelect: () => editor.chain().focus().deleteColumn().run(), destructive: true },
  { label: 'Usuń całą tabelę', icon: createElement(Trash2, { size: 16 }), onSelect: () => editor.chain().focus().deleteTable().run(), destructive: true }
]
