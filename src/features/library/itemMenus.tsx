import { BookPlus, FolderInput, FolderPlus, GraduationCap, PlayCircle, Pencil, Trash2 } from 'lucide-react'
import type { Deck, Folder } from '../../types/model'
import type { DropdownAction } from '../../components/Dropdown'
import type { ItemAction } from './Sidebar'

interface MenuCallbacks {
  onAddFolder: (parentId: string | null) => void
  onAddDeck: (parentId: string | null) => void
  onAction: (kind: 'folder' | 'deck', id: string, action: ItemAction) => void
}

export const folderMenuActions = (folder: Folder, callbacks: MenuCallbacks): DropdownAction[] => [
  { label: 'Nowy folder w:', contextValue: folder.name, icon: <FolderPlus size={16} />, onSelect: () => callbacks.onAddFolder(folder.id) },
  { label: 'Nowy zestaw w:', contextValue: folder.name, icon: <BookPlus size={16} />, onSelect: () => callbacks.onAddDeck(folder.id) },
  { label: 'Zmień nazwę', icon: <Pencil size={16} />, onSelect: () => callbacks.onAction('folder', folder.id, 'rename') },
  { label: 'Przenieś folder', icon: <FolderInput size={16} />, onSelect: () => callbacks.onAction('folder', folder.id, 'move') },
  { label: 'Usuń folder', icon: <Trash2 size={16} />, destructive: true, onSelect: () => callbacks.onAction('folder', folder.id, 'delete') }
]

export const deckMenuActions = (deck: Deck, callbacks: Pick<MenuCallbacks, 'onAction'> & {
  onStudy?: () => void
  canResume?: boolean
  hasCards?: boolean
}): DropdownAction[] => [
  ...(callbacks.onStudy ? [{
    label: callbacks.canResume ? 'Kontynuuj naukę' : 'Rozpocznij naukę',
    icon: callbacks.canResume ? <PlayCircle size={16}/> : <GraduationCap size={16} />,
    primary: true,
    disabled: callbacks.hasCards === false,
    onSelect: callbacks.onStudy!
  }] : []),
  { label: 'Zmień nazwę', icon: <Pencil size={16} />, onSelect: () => callbacks.onAction('deck', deck.id, 'rename') },
  { label: 'Przenieś zestaw', icon: <FolderInput size={16} />, onSelect: () => callbacks.onAction('deck', deck.id, 'move') },
  { label: 'Usuń zestaw', icon: <Trash2 size={16} />, destructive: true, onSelect: () => callbacks.onAction('deck', deck.id, 'delete') }
]
