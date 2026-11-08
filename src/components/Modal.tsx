import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useModal } from '../providers/ModalProvider'

interface ModalProps {
  title?: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  kind?: 'default' | 'settings'
  footer?: ReactNode
}

// Declarative compatibility layer. New features can call useModal().createModal(node)
// directly; existing dialogs keep their state and props without owning a portal.
const Modal = ({ children, ...options }: ModalProps) => {
  const { createModal, updateModal, closeModal } = useModal()
  const id = useRef<number | null>(null)

  useLayoutEffect(() => {
    id.current = createModal(children, options)
    return () => {
      if (id.current !== null) closeModal(id.current)
      id.current = null
    }
  }, [createModal, closeModal])

  useLayoutEffect(() => {
    if (id.current !== null) updateModal(id.current, children, options)
  })

  return null
}

export default Modal
