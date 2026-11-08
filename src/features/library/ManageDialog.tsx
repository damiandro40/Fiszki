import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { LibraryData } from '../../types/model'
import { cardCountInFolder, descendantsOf, folderPath } from '../../lib/tree'
import Button from '../../components/atoms/Button'
import Modal from '../../components/Modal'
import Select from '../../components/atoms/Select'
import Input from '../../components/atoms/Input'

export type ManageMode =
  | 'create-folder' | 'edit-folder' | 'move-folder' | 'delete-folder'
  | 'create-deck' | 'edit-deck' | 'move-deck' | 'delete-deck'
  | 'move-card' | 'delete-card' | 'import-backup'

export interface ManageAction {
  mode: ManageMode
  id?: string
  parentId?: string | null
}

interface ManageDialogProps {
  action: ManageAction
  data: LibraryData
  onClose: () => void
  onConfirm: (value?: string, description?: string, parentId?: string | null) => void
}

const ManageDialog = ({ action, data, onClose, onConfirm }: ManageDialogProps) => {
  const folder = data.folders.find(item => item.id === action.id)
  const deck = data.decks.find(item => item.id === action.id)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!action.mode.startsWith('create-')) return
    const id = requestAnimationFrame(() => nameRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [action.mode])
  const [name, setName] = useState(folder?.name || deck?.name || '')
  const [destination, setDestination] = useState(action.mode === 'move-folder' ? folder?.parentId || '' :
    action.mode === 'move-deck' ? deck?.folderId || '' :
      action.mode === 'move-card' ? data.cards.find(item => item.id === action.id)?.deckId || '' :
        action.mode.startsWith('create-') ? action.parentId || '' : '')
  const [error, setError] = useState('')
  const isCreate = action.mode.startsWith('create-')
  const isEdit = action.mode.startsWith('edit-')
  const isMove = action.mode.startsWith('move-')
  const isDelete = action.mode.startsWith('delete-')
  const entity = action.mode.includes('folder') ? 'folder' : action.mode.includes('deck') ? 'zestaw' : 'fiszkę'
  const titles: Record<ManageMode, string> = {
    'create-folder': 'Nowy folder', 'edit-folder': 'Zmień nazwę folderu', 'move-folder': 'Przenieś folder', 'delete-folder': 'Usuń folder',
    'create-deck': 'Nowy zestaw', 'edit-deck': 'Edytuj zestaw', 'move-deck': 'Przenieś zestaw', 'delete-deck': 'Usuń zestaw',
    'move-card': 'Przenieś fiszkę', 'delete-card': 'Usuń fiszkę', 'import-backup': 'Importuj kopię zapasową'
  }
  const forbidden = action.mode === 'move-folder' && action.id ? new Set([action.id, ...descendantsOf(data, action.id)]) : new Set<string>()
  const folderOptions = data.folders.filter(item => !forbidden.has(item.id)).sort((a, b) => folderPath(data, a.id).localeCompare(folderPath(data, b.id), 'pl'))
  const deleteCount = action.mode === 'delete-folder' && folder ? cardCountInFolder(data, folder.id) :
    action.mode === 'delete-deck' && deck ? data.cards.filter(item => item.deckId === deck.id).length : 0

  const submit = () => {
    if (isCreate || isEdit) {
      const normalized = name.trim()
      if (!normalized) { setError('Podaj nazwę.'); return }
      if (normalized.length > 160) { setError('Nazwa może mieć maksymalnie 160 znaków.'); return }
      onConfirm(normalized, undefined, isCreate ? destination || null : undefined)
      return
    }
    if (isMove && action.mode === 'move-card' && !destination) { setError('Wybierz zestaw docelowy.'); return }
    onConfirm(isMove ? destination || '' : undefined)
  }

  return <Modal title={titles[action.mode]} subtitle={isDelete ? 'Zmianę można cofnąć w powiadomieniu po usunięciu.' : undefined} onClose={onClose}
    footer={<><Button onClick={onClose}>Anuluj</Button><Button type="submit" form="manage-dialog-form" intent="solid" color={isDelete || action.mode === 'import-backup' ? 'danger' : 'primary'}>{isDelete ? 'Usuń na stałe' : isMove ? 'Przenieś' : action.mode === 'import-backup' ? 'Wybierz plik JSON' : 'Zapisz'}</Button></>}>
    <form id="manage-dialog-form" className="modal-body" onSubmit={event => { event.preventDefault(); submit() }}>
      {(isCreate || isEdit) && <label className="field-label">{entity === 'folder' ? 'Nazwa folderu' : 'Nazwa zestawu'}
        <Input ref={nameRef} data-initial-focus autoFocus value={name} maxLength={160} placeholder={entity === 'folder' ? 'Np. Anatomia' : 'Np. Kości czaszki'} onChange={event => setName(event.target.value)} />
      </label>}
      {isCreate && <div className="field-label folder-picker-label">Folder nadrzędny
        <Select ariaLabel="Folder nadrzędny" searchable value={destination} onChange={setDestination}
          options={[{ value: '', label: 'Biblioteka (poziom główny)' }, ...folderOptions.map(item => ({ value: item.id, label: folderPath(data, item.id) }))]} />
        <span className="field-note">Nowy element zostanie zapisany w: {folderPath(data, destination || null)}</span>
      </div>}
      {isMove && <div className="field-label">{action.mode === 'move-card' ? 'Zestaw docelowy' : 'Folder docelowy'}
        <Select searchable ariaLabel="Miejsce docelowe" value={destination} onChange={setDestination}
          options={action.mode === 'move-card'
            ? data.decks.map(item => ({ value: item.id, label: `${folderPath(data, item.folderId)} / ${item.name}` }))
            : [{ value: '', label: 'Biblioteka (poziom główny)' }, ...folderOptions.map(item => ({ value: item.id, label: folderPath(data, item.id) }))]} />
      </div>}
      {isDelete && <div className="delete-warning"><AlertTriangle size={20} /><div>
        <strong>{action.mode === 'delete-folder' ? `Usunąć „${folder?.name}” wraz z podfolderami?` : action.mode === 'delete-deck' ? `Usunąć zestaw „${deck?.name}”?` : 'Usunąć tę fiszkę?'}</strong>
        <p>{deleteCount > 0 ? `Usuniętych zostanie również ${deleteCount} fiszek.` : 'Element zostanie usunięty z biblioteki lokalnej.'}</p>
      </div></div>}
      {action.mode === 'import-backup' && <div className="delete-warning"><AlertTriangle size={20} /><div><strong>Import zastępuje obecną bibliotekę.</strong><p>Przed importem zalecamy wyeksportować aktualną kopię zapasową. Anulowanie wyboru pliku nie zmienia danych.</p></div></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </form>
  </Modal>
}

export default ManageDialog
