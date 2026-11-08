import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImage from './ResizableImage'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'

const ImageWithResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = Number(element.getAttribute('width'))
          return Number.isFinite(raw) && raw > 0 ? raw : null
        },
        renderHTML: (attributes: { width?: number | null }) => attributes.width ? { width: attributes.width } : {}
      }
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage)
  }
}).configure({ inline: false, allowBase64: true })

const CellWithBackground = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
        renderHTML: (attributes: { backgroundColor?: string | null }) => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {}
      }
    }
  }
})

const HeaderWithBackground = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
        renderHTML: (attributes: { backgroundColor?: string | null }) => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {}
      }
    }
  }
})

export const editorExtensions = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  ImageWithResize,
  Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: true }),
  TableRow,
  HeaderWithBackground,
  CellWithBackground,
  Placeholder.configure({ placeholder: 'Zacznij pisać…' })
]
