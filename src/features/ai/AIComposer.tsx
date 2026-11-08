import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { ArrowUp, FileText, Plus, Square, X } from 'lucide-react'
import Button from '../../components/atoms/Button'
import type { AiAttachment } from '../../types/model'

interface AIComposerProps {
  value: string
  attachments: AiAttachment[]
  disabled: boolean
  sending: boolean
  sendDisabled: boolean
  onCancel: () => void
  onChange: (text: string) => void
  onFiles: (files: File[]) => void
  onRemove: (id: string) => void
  onSubmit: () => void
}

const composerExtensions = [
  StarterKit.configure({
    heading: false, bold: false, italic: false, strike: false, code: false,
    codeBlock: false, blockquote: false, bulletList: false, orderedList: false,
    listItem: false, horizontalRule: false
  }),
  Placeholder.configure({ placeholder: 'Wpisz wiadomość lub dodaj materiał…' })
]

const AIComposer = ({ value, attachments, disabled, sending, sendDisabled, onCancel, onChange, onFiles, onRemove, onSubmit }: AIComposerProps) => {
  const pickerRef = useRef<HTMLInputElement>(null)
  const onFilesRef = useRef(onFiles)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const sendDisabledRef = useRef(sendDisabled)
  sendDisabledRef.current = sendDisabled
  onFilesRef.current = onFiles
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit

  const editor = useEditor({
    extensions: composerExtensions,
    content: '',
    editorProps: {
      attributes: { 'aria-label': 'Wiadomość do asystenta AI', class: 'ai-composer-editable', spellcheck: 'true' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || [])
        if (!files.length) return false
        event.preventDefault()
        onFilesRef.current(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        if (!files.length) return false
        event.preventDefault()
        onFilesRef.current(files)
        return true
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault()
          if (!sendDisabledRef.current) onSubmitRef.current()
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getText({ blockSeparator: '\n' }).slice(0, 79_000))
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  useEffect(() => {
    if (!editor) return
    if (editor.getText({ blockSeparator: '\n' }) !== value) {
      const nodes = value.split('\n').map(line => ({
        type: 'paragraph', content: line ? [{ type: 'text', text: line }] : []
      }))
      editor.commands.setContent({ type: 'doc', content: nodes }, false)
    }
  }, [editor, value])

  return <div className={`overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_20px_#0000000a] transition-[border-color,box-shadow] focus-within:border-[var(--accent-ink)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)] ${disabled ? 'opacity-65' : ''}`}>
    <EditorContent editor={editor} className="max-h-[min(28vh,205px)] overflow-y-auto [&_.ai-composer-editable]:min-h-[66px] [&_.ai-composer-editable]:break-words [&_.ai-composer-editable]:whitespace-pre-wrap [&_.ai-composer-editable]:px-4 [&_.ai-composer-editable]:pt-4 [&_.ai-composer-editable]:pb-2 [&_.ai-composer-editable]:text-[12.5px] [&_.ai-composer-editable]:leading-relaxed [&_.ai-composer-editable]:outline-none" />
    {!!attachments.length && <div className="flex flex-wrap gap-2 px-2.5 pb-2" aria-label="Dodane materiały">
      {attachments.map(item => <div className="relative flex max-w-[160px] min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-6 text-[var(--muted)] [&_img]:size-9 [&_img]:rounded-md [&_img]:object-cover [&_span]:truncate [&_span]:text-[10px]" key={item.id} title={item.name}>
        {item.dataUrl ? <img src={item.dataUrl} alt="Podgląd załącznika" /> : <FileText size={20} />}
        <span>{item.name}</span>
        <Button.Icon label={`Usuń załącznik ${item.name}`} tooltip={false} size="sm" className="!absolute !right-0.5 !top-0.5 !size-6" onClick={() => onRemove(item.id)} disabled={disabled}><X size={13}/></Button.Icon>
      </div>)}
    </div>}
    <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
      <input ref={pickerRef} type="file" hidden multiple accept=".txt,.md,.csv,.json,.pdf,image/png,image/jpeg,image/webp" onChange={event => {
        const files = Array.from(event.target.files || [])
        if (files.length) onFiles(files)
        event.target.value = ''
      }}/>
      <Button.Icon label="Dodaj załącznik" size="sm" intent="ghost" color="neutral" className="!size-9 !rounded-full"
        disabled={disabled || attachments.length >= 4} onClick={() => pickerRef.current?.click()}><Plus size={19}/></Button.Icon>
      <span className="flex-1"/>
      {sending ? <Button.Icon label="Przerwij generowanie" tooltip="Przerwij odpowiedź" size="sm" intent="soft" color="neutral"
        className="!size-9 !rounded-full" onClick={onCancel}><Square size={14} fill="currentColor"/></Button.Icon>
        : <Button.Icon label="Wyślij wiadomość" tooltip="Wyślij wiadomość" size="sm" intent="solid" color="primary"
          className="!size-9 !rounded-full" disabled={sendDisabled} onClick={onSubmit}><ArrowUp size={19} strokeWidth={2.6}/></Button.Icon>}
    </div>
  </div>
}

export default AIComposer
