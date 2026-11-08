export type PaletteKind = 'text' | 'background'

export const DEFAULT_PALETTES: Record<PaletteKind, string[]> = {
  text: ['#228dd4', '#e36d86', '#299b82', '#e2a441'],
  background: ['#d7eaf7', '#fce187', '#ffc3cb', '#b9eacb']
}

export const PALETTE_LIMIT = 5
const validColor = (color: unknown): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)

export const normalizePalette = (value: unknown, kind: PaletteKind): string[] => {
  if (!Array.isArray(value) || value.length > PALETTE_LIMIT || !value.every(validColor)) return [...DEFAULT_PALETTES[kind]]
  return [...new Set(value.map(color => color.toLowerCase()))]
}

export const addPaletteColor = (palette: string[], color: string): string[] => {
  if (!validColor(color)) return palette
  const normalized = color.toLowerCase()
  const existing = palette.filter(value => value.toLowerCase() !== normalized)
  // With five saved colors, the newest one replaces the oldest (last) slot.
  return [...existing.slice(0, PALETTE_LIMIT - 1), normalized]
}

export const replacePaletteColor = (palette: string[], index: number, color: string): string[] => {
  if (!validColor(color) || index < 0 || index >= palette.length) return palette
  const normalized = color.toLowerCase()
  return palette.map((value, position) => position === index ? normalized : value)
    .filter((value, position, values) => values.indexOf(value) === position)
}

export const removePaletteColor = (palette: string[], index: number): string[] =>
  index >= 0 && index < palette.length ? palette.filter((_, position) => position !== index) : palette
