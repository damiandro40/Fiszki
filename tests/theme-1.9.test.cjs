const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const { readSource } = require('./helpers/source.cjs')
const css = readSource(root, 'src/styles/index.css')
const themeHook = fs.readFileSync(path.join(root, 'src/hooks/useTheme.ts'), 'utf8')
const main = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const vars = source => Object.fromEntries(
  [...source.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6}|#[0-9a-f]{8});/g)].map(([,key,value]) => [key, value])
)

const dark = css.match(/:root, \[data-theme='dark'\] \{([^}]+)\}/)
const light = css.match(/\[data-theme='light'\] \{([^}]+)\}/)

const luminance = hex => {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = channels.map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
}

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((a, b) => a - b)
  return (y + .05) / (x + .05)
}

test('each theme has one complete palette with a blue accent', () => {
  assert.equal((css.match(/:root, \[data-theme='dark'\] \{/g) || []).length, 1)
  assert.equal((css.match(/\[data-theme='light'\] \{/g) || []).length, 1)
  assert.ok(dark && light)
  for (const block of [dark[1], light[1]]) {
    const palette = vars(block)
    for (const key of ['bg', 'surface', 'surface-2', 'surface-3', 'sidebar', 'border', 'text', 'muted', 'accent', 'accent-hover', 'accent-ink', 'accent-text', 'accent-soft', 'green', 'red']) {
      assert.ok(palette[key], `missing ${key}`)
    }
    const [red, green, blue] = [1, 3, 5].map(index => parseInt(palette.accent.slice(index, index + 2), 16))
    assert.ok(blue > green && green > red * 2, 'primary action should remain a cool blue')
  }
})

test('primary button text and selected navigation text are legible in both themes', () => {
  for (const block of [dark[1], light[1]]) {
    const palette = vars(block)
    assert.ok(contrast(palette.accent, palette['accent-text']) >= 4.5, 'primary action needs at least 4.5:1 contrast')
    assert.ok(contrast(palette['accent-soft'], palette['accent-ink']) >= 4.5, 'active navigation needs at least 4.5:1 contrast')
    assert.ok(contrast(palette.surface, palette.text) >= 7, 'reading surface needs high contrast')
  }
})

test('controls, search, editor and study re-use one shared blue design system', () => {
  const button = fs.readFileSync(path.join(root, 'src/components/atoms/Button.tsx'), 'utf8')
  const select = fs.readFileSync(path.join(root, 'src/features/library/SearchDialog.tsx'), 'utf8')
  const tile = fs.readFileSync(path.join(root, 'src/components/LibraryTile.tsx'), 'utf8')
  assert.match(button, /bg-\[var\(--accent\)\]/)
  assert.match(fs.readFileSync(path.join(root, 'src/components/atoms/Input.tsx'), 'utf8'), /focus-within:border-\[var\(--accent\)\]/)
  assert.match(tile, /hover:border-\[var\(--tile-hover-border\)\]/)
  assert.match(css, /\.study-card\.is-flipped/)
  assert.match(css, /\.progress-correct/)
  assert.match(css, /\.progress-wrong/)
})

test('system theme continues to follow operating system preference', () => {
  assert.match(themeHook, /matchMedia\('\(prefers-color-scheme: dark\)'\)/)
  assert.match(themeHook, /preference === 'system'/)
  assert.match(themeHook, /media\.addEventListener\('change', apply\)/)
})

test('no persistence protocol change is required by the theme update', () => {
  assert.match(main.version, /^1\.0\.\d+$/)
  assert.equal(main.main, './out/main/index.js')
  assert.ok(main.dependencies.react)
  assert.ok(main.dependencies['@tiptap/react'])
  assert.ok(main.devDependencies['electron-vite'])
  assert.ok(fs.existsSync(path.join(root, 'src/types/model.ts')))
  assert.ok(fs.existsSync(path.join(root, 'electron/main.ts')))
})
