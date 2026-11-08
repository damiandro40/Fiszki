import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Trash2 } from 'lucide-react'

const clampWidth = (value: number) => Math.max(100, Math.min(1100, Math.round(value)))

const ResizableImage = ({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const savedWidth = typeof node.attrs.width === 'number' ? node.attrs.width : null
  const width = dragWidth ?? savedWidth

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const element = wrapperRef.current
    if (!element) return
    const startX = event.clientX
    const startWidth = element.getBoundingClientRect().width
    const pointerId = event.pointerId
    const handle = event.currentTarget
    handle.setPointerCapture(pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      setDragWidth(clampWidth(startWidth + moveEvent.clientX - startX))
    }
    const onEnd = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      const finalWidth = clampWidth(startWidth + upEvent.clientX - startX)
      updateAttributes({ width: finalWidth })
      setDragWidth(null)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onCancel)
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
    }
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return
      setDragWidth(null)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onCancel)
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onCancel)
  }

  return <NodeViewWrapper className={`resizable-image-node ${selected ? 'is-selected' : ''}`} contentEditable={false}>
    <div ref={wrapperRef} className="resizable-image-frame" style={{ width: width ? `${width}px` : 'min(100%, 460px)' }}>
      <img src={node.attrs.src as string} alt={(node.attrs.alt as string) || ''} draggable={false} />
      {editor.isEditable && <div className="image-edit-controls">
        <button className="image-remove" type="button" aria-label="Usuń zaznaczone zdjęcie" onClick={deleteNode}><Trash2 size={15} /></button>
      </div>}
      {editor.isEditable && <button className="image-resize-handle" type="button" aria-label="Zmień rozmiar zdjęcia, przeciągając" onPointerDown={startResize} />}
    </div>
  </NodeViewWrapper>
}

export default ResizableImage
