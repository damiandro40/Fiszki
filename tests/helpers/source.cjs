const fs = require('node:fs')
const path = require('node:path')

// Read the implementation, including relocated modules, rather than assuming
// that application state and IPC schemas still live in one monolithic file.
const viewPaths = {
  'src/features/library/LibraryOverview.tsx': 'src/views/library/LibraryOverview.tsx',
  'src/features/library/DeckView.tsx': 'src/views/decks/DeckView.tsx',
  'src/features/study/StudyView.tsx': 'src/views/study/StudyView.tsx',
  'src/features/ai/AIWindow.tsx': 'src/views/ai/AIWindow.tsx'
}
const appParts = ['src/App.tsx', 'src/app/useAppController.ts', 'src/app/AppShell.tsx', 'src/app/CurrentView.tsx', 'src/app/AppDialogs.tsx']
const ipcParts = ['electron/main.ts', 'electron/storage/schemas.ts', 'electron/storage/validation.ts', 'electron/storage/repository.ts', 'electron/ai/contracts.ts']
const cssFiles = ['src/styles/theme.css','src/styles/widgets.css']

const readSource = (root, filename) => {
  if (filename === 'src/App.tsx') return appParts.map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n')
  if (filename === 'electron/ai/siwc.ts') return ['electron/ai/siwc.ts', 'electron/ai/oauth.ts'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n')
  if (filename === 'electron/main.ts') return ipcParts.map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n')
  if (filename === 'src/styles/index.css') return cssFiles
    .map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n')
  const atom = filename.startsWith('src/components/') && !filename.startsWith('src/components/atoms/')
    && ['Button.tsx','Tooltip.tsx','Select.tsx','DebouncedSearchInput.tsx','HighlightedText.tsx'].includes(path.basename(filename))
  if (atom) filename = filename.replace('src/components/', 'src/components/atoms/')
  if (filename.startsWith('src/styles/layers/')) filename = 'src/styles/widgets.css'
  return fs.readFileSync(path.join(root, viewPaths[filename] || filename), 'utf8')
}
module.exports = { readSource }
