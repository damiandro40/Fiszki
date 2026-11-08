import type { Editor } from '@tiptap/react'

// Minimal signature of visible formatting: text edits without formatting changes
// must not force the toolbar to rerender.
export const getToolbarSignature = (editor: Pick<Editor, 'isActive' | 'getAttributes'>): string => {
  const format = [
    'bold', 'italic', 'underline', 'strike', 'code', 'heading', 'bulletList',
    'orderedList', 'blockquote', 'link', 'table'
  ].map(name => editor.isActive(name))

  return JSON.stringify([
    ...format,
    editor.isActive('heading', { level: 1 }),
    editor.isActive('heading', { level: 2 }),
    editor.isActive({ textAlign: 'left' }),
    editor.isActive({ textAlign: 'center' }),
    editor.isActive({ textAlign: 'right' }),
    editor.isActive({ textAlign: 'justify' }),
    editor.getAttributes('textStyle').color ?? null,
    editor.getAttributes('highlight').color ?? null
  ])
}

