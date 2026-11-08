import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

import { getToolbarSignature } from './toolbarState'

const useToolbarSelection = (editor: Editor | null) => {
  const [, rerender] = useState(0)

  useEffect(() => {
    if (!editor) return
    let signature = getToolbarSignature(editor)

    const synchronize = () => {
      const next = getToolbarSignature(editor)
      if (next === signature) return
      signature = next
      rerender(previous => previous + 1)
    }

    editor.on('transaction', synchronize)
    editor.on('selectionUpdate', synchronize)
    return () => {
      editor.off('transaction', synchronize)
      editor.off('selectionUpdate', synchronize)
    }
  }, [editor])
}

export default useToolbarSelection
