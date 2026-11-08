import type { DesktopAPI } from './model'

declare global {
  interface Window {
    flashcards: DesktopAPI
  }
}

export {}
