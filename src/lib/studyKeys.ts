export type StudyAction = 'flip' | 'again' | 'known' | 'undo'
export type StudyKeymap = Record<StudyAction, string>

export const DEFAULT_STUDY_KEYS: StudyKeymap = {
  flip: 'Space',
  again: 'Digit1',
  known: 'Digit2',
  undo: 'Backspace'
}

const assignableKey = /^(?:Space|Enter|Backspace|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Key[A-Z]|Digit[0-9]|Numpad[0-9])$/

export const isAssignableStudyKey = (code: string): boolean => assignableKey.test(code)

export const displayStudyKey = (code: string): string => {
  if (code === 'Space') return 'Spacja'
  if (code === 'Enter') return 'Enter'
  if (code === 'Backspace') return 'Backspace'
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
  if (code.startsWith('Key')) return code.slice(3)
  const arrows: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }
  return arrows[code] || code
}

export const normalizeStudyKeys = (value?: Partial<StudyKeymap> | null): StudyKeymap => {
  const result: StudyKeymap = { ...DEFAULT_STUDY_KEYS }
  const used = new Set<string>()

  for (const action of ['flip', 'again', 'known', 'undo'] as const) {
    const proposed = value?.[action]
    if (typeof proposed === 'string' && isAssignableStudyKey(proposed) && !used.has(proposed)) {
      result[action] = proposed
    }
    used.add(result[action])
  }

  // The persisted keymap can come from older or hand-edited JSON. Never return colliding shortcuts.
  if (new Set(Object.values(result)).size !== 4) return { ...DEFAULT_STUDY_KEYS }
  return result
}
