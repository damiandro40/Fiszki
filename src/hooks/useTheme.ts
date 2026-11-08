import { useEffect } from 'react'
import type { ThemePreference } from '../types/model'

export const useTheme = (preference: ThemePreference) => {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = preference === 'system'
        ? media.matches ? 'dark' : 'light'
        : preference
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
}
