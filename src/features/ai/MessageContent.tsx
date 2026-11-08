import { Fragment } from 'react'
import type { ReactNode } from 'react'

/** Safe, read-only Markdown subset. All user/model text is rendered through React
 * text nodes; this component never injects raw HTML or follows remote images. */
const inline = (value: string) => value
  .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[\[(?:accent|highlight)\|[^\]\n]+\]\])/g)
  .filter(Boolean).map((chunk, i) => {
    const key = `${i}-${chunk.length}`
    if (chunk.startsWith('**') && chunk.endsWith('**')) return <strong key={key}>{chunk.slice(2, -2)}</strong>
    if (chunk.startsWith('*') && chunk.endsWith('*')) return <em key={key}>{chunk.slice(1, -1)}</em>
    if (chunk.startsWith('`') && chunk.endsWith('`')) return <code key={key}>{chunk.slice(1, -1)}</code>
    if (chunk.startsWith('[[accent|')) return <span key={key} className="ai-md-accent">{chunk.slice(9, -2)}</span>
    if (chunk.startsWith('[[highlight|')) return <mark key={key}>{chunk.slice(12, -2)}</mark>
    return <Fragment key={key}>{chunk}</Fragment>
  })

const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(text => text.trim())
const tableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

const MessageContent = ({ content }: { content: string }) => {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(<pre key={i}><code>{code.join('\n')}</code></pre>)
      continue
    }
    if (!line.trim()) { i++; continue }
    if (i + 1 < lines.length && line.includes('|') && tableSeparator(lines[i + 1])) {
      const header = tableCells(line).slice(0, 8)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(tableCells(lines[i++]).slice(0, 8))
      blocks.push(<div key={i} className="ai-md-table-scroll"><table><thead><tr>{header.map((cell, col) => <th key={col}>{inline(cell)}</th>)}</tr></thead><tbody>
        {rows.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, col) => <td key={col}>{inline(row[col] || '')}</td>)}</tr>)}
      </tbody></table></div>)
      continue
    }
    const heading = /^(#{1,3})\s+(.+)/.exec(line)
    if (heading) { blocks.push(<h3 key={i} className="ai-md-heading">{inline(heading[2])}</h3>); i++; continue }
    const bullet = /^\s*[-*+]\s+/.test(line)
    const numbered = /^\s*\d+[.)]\s+/.test(line)
    if (bullet || numbered) {
      const items: string[] = []
      while (i < lines.length && (bullet ? /^\s*[-*+]\s+/.test(lines[i]) : /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(lines[i++].replace(bullet ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/, ''))
      }
      const children = items.map((item, index) => <li key={index}>{inline(item)}</li>)
      blocks.push(bullet ? <ul key={i}>{children}</ul> : <ol key={i}>{children}</ol>)
      continue
    }
    const paragraph: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^\s*(?:#{1,3}\s+|[-*+]\s+|\d+[.)]\s+|```)/.test(lines[i])) paragraph.push(lines[i++])
    blocks.push(<p key={i}>{paragraph.map((text, j) => <Fragment key={j}>{j > 0 && <span>{' '}</span>}{inline(text)}</Fragment>)}</p>)
  }
  return <div className="ai-markdown">{blocks}</div>
}

export default MessageContent
