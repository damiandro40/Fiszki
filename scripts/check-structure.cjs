const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

const collect = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name)
  return entry.isDirectory() ? collect(file) : /\.(ts|tsx)$/.test(entry.name) ? [file] : []
})
const files = [...collect('src'), ...collect('electron')]
const errors = []
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  for (const match of text.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(root, path.dirname(file), match[1])
    if (!['', '.ts', '.tsx', '.json', '.js'].some(ext => fs.existsSync(target + ext) || fs.existsSync(path.join(target, `index${ext}`)))) {
      errors.push(`${file}: nierozwiązany import ${match[1]}`)
    }
  }
}
const css = fs.readFileSync(path.join(root, 'src/styles/index.css'), 'utf8')
const imported = [...css.matchAll(/@import\s+['"]([^'"]+)['"]/g)]
if (!imported.length) errors.push('Brak warstw CSS')
for (const match of imported) {
  if (!fs.existsSync(path.join(root, 'src/styles', match[1]))) errors.push(`Nie znaleziono warstwy CSS ${match[1]}`)
}
for (const name of ['library/LibraryOverview', 'decks/DeckView', 'study/StudyView', 'ai/AIWindow']) {
  if (!fs.existsSync(path.join(root, `src/views/${name}.tsx`))) errors.push(`Brak widoku ${name}`)
}
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1 }
else console.log(`Architektura: ${files.length} plików TS/TSX, ${imported.length} warstw CSS, wszystkie importy względne poprawne`)
