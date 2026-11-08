export interface HSV { h: number, s: number, v: number }
export const isHexColor = (hex: string) => /^#[\da-f]{6}$/i.test(hex)
export const hexToHsv = (hex: string): HSV => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
  let h = 0
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
  }
  return { h: (h + 360) % 360, s: max ? delta / max * 100 : 0, v: max * 100 }
}
export const hsvToHex = ({ h, s, v }: HSV): string => {
  const sat = Math.max(0, Math.min(100, s)) / 100
  const val = Math.max(0, Math.min(100, v)) / 100
  const c = val * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = val - c
  const sector = ((Math.floor(h / 60) % 6) + 6) % 6
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector]
  return '#' + rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')
}
