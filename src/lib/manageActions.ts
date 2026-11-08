export type ManagedItem = 'folder' | 'deck'
export type ItemOperation = 'rename' | 'move' | 'delete'
export type ManageItemMode = `edit-${ManagedItem}` | `move-${ManagedItem}` | `delete-${ManagedItem}`

export const manageModeForItem = (kind: ManagedItem, operation: ItemOperation): ManageItemMode =>
  `${operation === 'rename' ? 'edit' : operation}-${kind}` as ManageItemMode
