import type { ReactNode } from 'react'

interface HighlightedTextProps {
  text: string
  query: string
}

/** String-only, case-insensitive highlighting; never inject user-controlled HTML or regex. */
const HighlightedText = ({ text, query }: HighlightedTextProps): ReactNode => {
  const needle = query.trim().toLocaleLowerCase('pl')
  if (!needle) return text
  const folded = text.toLocaleLowerCase('pl')
  const result: ReactNode[] = []
  let from = 0
  while (from < text.length) {
    const index = folded.indexOf(needle, from)
    if (index < 0) break
    if (index > from) result.push(text.slice(from, index))
    result.push(<mark className="rounded-[3px] bg-[var(--search-match-bg)] px-0.5 text-[var(--search-match-ink)]" key={index}>{text.slice(index, index + needle.length)}</mark>)
    from = index + needle.length
  }
  result.push(text.slice(from))
  return <>{result}</>
}

export default HighlightedText
