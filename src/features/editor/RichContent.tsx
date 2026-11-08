import { useMemo } from 'react'
import { generateHTML } from '@tiptap/core'
import DOMPurify from 'dompurify'
import type { RichDoc } from '../../types/model'
import { editorExtensions } from './extensions'

interface RichContentProps {
  content: RichDoc
  compact?: boolean
  highlightQuery?: string
}

const RichContent = ({ content, compact = false, highlightQuery = '' }: RichContentProps) => {
  const safeMarkup = useMemo(() => {
    try {
      const html = DOMPurify.sanitize(generateHTML(content, editorExtensions))
      const needle = highlightQuery.trim().toLocaleLowerCase('pl')
      if (!needle || typeof document === 'undefined') return html

      // Operate only on text nodes of already-sanitized HTML. No HTML from the query.
      const container = document.createElement('div')
      container.innerHTML = html
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        if (!node.parentElement?.closest('script, style')) nodes.push(node)
      }
      for (const node of nodes) {
        const value = node.textContent || ''
        const folded = value.toLocaleLowerCase('pl')
        const fragment = document.createDocumentFragment()
        let offset = 0
        let index = folded.indexOf(needle, offset)
        if (index < 0) continue
        while (index >= 0) {
          fragment.appendChild(document.createTextNode(value.slice(offset, index)))
          const match = document.createElement('mark')
          match.className = 'search-match'
          match.textContent = value.slice(index, index + needle.length)
          fragment.appendChild(match)
          offset = index + needle.length
          index = folded.indexOf(needle, offset)
        }
        fragment.appendChild(document.createTextNode(value.slice(offset)))
        node.parentNode?.replaceChild(fragment, node)
      }
      return container.innerHTML
    } catch {
      return '<p>Nie można wyświetlić treści tej fiszki.</p>'
    }
  }, [content, highlightQuery])

  return <div className={`rich-content ${compact ? 'rich-compact' : ''}`} dangerouslySetInnerHTML={{ __html: safeMarkup }} />
}

export default RichContent
