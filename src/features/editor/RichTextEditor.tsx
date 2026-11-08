import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading1, Heading2,
  ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote,
  Strikethrough, Underline as UnderlineIcon, Rows3, Columns3,
  Table2
} from 'lucide-react'
import type { RichDoc } from '../../types/model'
import Modal from '../../components/Modal'
import Button from '../../components/atoms/Button'
import { editorExtensions } from './extensions'
import { compressImage } from './imageUtils'
import ColorPalette from './ColorPalette'
import TableInsertPicker from './TableInsertPicker'
import Dropdown from '../../components/Dropdown'
import { useContextMenu } from '../../components/ContextMenu'
import { getTableActions } from './tableActions'
import useToolbarSelection from './useToolbarSelection'

interface RichTextEditorProps {
  value: RichDoc
  onChange: (value: RichDoc) => void
  placeholder?: string
  variant?: 'front' | 'back'
}

const RichTextEditor = ({ value, onChange, variant = 'back' }: RichTextEditorProps) => {
  const fileInput = useRef<HTMLInputElement>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('https://')
  const openContextMenu = useContextMenu()

  const editor = useEditor({
    extensions: editorExtensions,
    content: value,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    editorProps: {
      attributes: { class: 'tiptap-prose', 'aria-label': 'Edytor treści fiszki' },
      transformPastedHTML: html => html.replace(/<img\b[^>]*>/gi, tag => {
        const src = tag.match(/\bsrc\s*=\s*[\"']([^\"']+)[\"']/i)?.[1]
        return src && /^data:image\/(webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(src) ? tag : ''
      })
    }
  })

  useToolbarSelection(editor)

  const addImage = async (file?: File) => {
    if (!file || !editor) return
    try {
      setImageError(null)
      const url = await compressImage(file)
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    } catch (error) {
      setImageError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void addImage(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      void addImage(file)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const file = [...event.dataTransfer.files].find(item => item.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      void addImage(file)
    }
  }

  const addLink = () => {
    if (!editor) return
    try {
      const url = new URL(linkInput.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Nieprawidłowy adres')
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.href }).run()
      setLinkDialog(false)
    } catch {
      setImageError('Link musi rozpoczynać się od https:// lub http://')
      setLinkDialog(false)
    }
  }

  if (!editor) return <div className="px-4 py-6 text-sm text-[var(--muted)]">Wczytywanie edytora…</div>

  const active = (type: string, attributes?: Record<string, unknown>) => editor.isActive(type, attributes)
  const act = (label: string, icon: ReactNode, onClick: () => void, isActive = false, disabled = false) =>
    <Button.Icon label={label} size="sm" onClick={onClick} active={isActive} disabled={disabled}>{icon}</Button.Icon>

  return <div className={`min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-within:border-[var(--accent)] ${variant === 'front' ? 'rich-editor-front' : ''}`}>
    <div className="editor-toolbar flex flex-wrap items-center justify-center gap-[7px] border-b border-[var(--border)] bg-[var(--surface-2)] p-2" onMouseDown={event => {
      if (!(event.target instanceof Element) || event.target.closest('button, input, [role="slider"]')) return
      event.preventDefault()
      editor.commands.focus()
    }}>
      <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--border)] pr-2 last:border-r-0 last:pr-0">
        {act('Pogrubienie (Ctrl+B)', <Bold size={17} />, () => editor.chain().focus().toggleBold().run(), active('bold'))}
        {act('Kursywa (Ctrl+I)', <Italic size={17} />, () => editor.chain().focus().toggleItalic().run(), active('italic'))}
        {act('Podkreślenie (Ctrl+U)', <UnderlineIcon size={17} />, () => editor.chain().focus().toggleUnderline().run(), active('underline'))}
        {act('Przekreślenie', <Strikethrough size={17} />, () => editor.chain().focus().toggleStrike().run(), active('strike'))}
        {variant === 'back' && act('Kod', <Code2 size={17} />, () => editor.chain().focus().toggleCode().run(), active('code'))}
      </div>
      {variant === 'back' && <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--border)] pr-2 last:border-r-0 last:pr-0">
        {act('Nagłówek H1', <Heading1 size={18} />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active('heading', { level: 1 }))}
        {act('Nagłówek H2', <Heading2 size={18} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active('heading', { level: 2 }))}
        {act('Lista punktowana', <List size={18} />, () => editor.chain().focus().toggleBulletList().run(), active('bulletList'))}
        {act('Lista numerowana', <ListOrdered size={18} />, () => editor.chain().focus().toggleOrderedList().run(), active('orderedList'))}
        {act('Cytat', <Quote size={17} />, () => editor.chain().focus().toggleBlockquote().run(), active('blockquote'))}
      </div>}
      <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--border)] pr-2 last:border-r-0 last:pr-0">
        {variant === 'back' && act('Wyrównaj do lewej', <AlignLeft size={17} />, () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}
        {variant === 'back' && act('Wyśrodkuj', <AlignCenter size={17} />, () => editor.chain().focus().setTextAlign('center').run(), (editor.isActive({ textAlign: 'center' }) || (!editor.isActive({ textAlign: 'left' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }))))}
        {variant === 'back' && act('Wyrównaj do prawej', <AlignRight size={17} />, () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }))}
        <ColorPalette editor={editor} kind="text" />
        <ColorPalette editor={editor} kind="background" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--border)] pr-2 last:border-r-0 last:pr-0">
        {act('Wstaw zdjęcie', <ImagePlus size={17} />, () => fileInput.current?.click())}
        {variant === 'back' && act('Wstaw link', <Link2 size={17} />, () => { setLinkInput(editor.getAttributes('link').href || 'https://'); setLinkDialog(true) }, active('link'))}
        {variant === 'back' && act('Usuń link', <Minus size={16} />, () => editor.chain().focus().unsetLink().run(), false, !active('link'))}
        {variant === 'back' && <TableInsertPicker editor={editor} />}
      </div>
    </div>
    {variant === 'back' && editor.isActive('table') && <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1.5" aria-label="Narzędzia tabeli">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]"><Table2 size={14} /> Tabela</span>
      {act('Dodaj wiersz poniżej', <Rows3 size={16} />, () => editor.chain().focus().addRowAfter().run())}
      {act('Dodaj kolumnę z prawej', <Columns3 size={16} />, () => editor.chain().focus().addColumnAfter().run())}
      <Dropdown label="Więcej opcji tabeli" actions={getTableActions(editor)} />
    </div>}
    <div className="cursor-text px-4 py-3 [&_.tiptap-prose]:max-h-[350px] [&_.tiptap-prose]:min-h-[110px] [&_.tiptap-prose]:overflow-y-auto [&_.tiptap-prose]:break-words [&_.tiptap-prose]:text-[13.5px] [&_.tiptap-prose]:leading-relaxed [&_.tiptap-prose]:outline-none" onPasteCapture={handlePaste} onDropCapture={handleDrop}
      onContextMenu={event => {
        const target = event.target as HTMLElement
        const cell = target.closest('td, th')
        if (!cell || !editor.view.dom.contains(cell)) return
        const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (position && !cell.classList.contains('selectedCell')) {
          editor.chain().focus().setTextSelection(position.pos).run()
        }
        openContextMenu(event, getTableActions(editor))
      }}>

      <EditorContent editor={editor} />
    </div>
    <input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
    {imageError && <div className="mx-3 mb-3 rounded-lg border border-[var(--red)] bg-[var(--red-soft)] px-3 py-2 text-xs text-[var(--red)]" role="alert">{imageError} <button onClick={() => setImageError(null)}>Zamknij</button></div>}
    {linkDialog && <Modal title="Wstaw link" onClose={() => setLinkDialog(false)}
      footer={<><Button onClick={() => setLinkDialog(false)}>Anuluj</Button><Button form="link-dialog-form" type="submit" intent="solid" color="primary">Zapisz link</Button></>}>
      <form id="link-dialog-form" onSubmit={event => { event.preventDefault(); addLink() }} className="p-5">
        <label className="flex flex-col gap-2 text-xs font-semibold">Adres URL<input className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none" autoFocus value={linkInput} onChange={event => setLinkInput(event.target.value)} /></label>
      </form>
    </Modal>}
  </div>
}

export default RichTextEditor
