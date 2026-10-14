import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'

type Theme = 'light' | 'dark'
const KEY = 'pixel-lab:theme'

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** System theme by default; an explicit choice is stamped on <html data-theme>. */
export function useTheme() {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [choice, setChoice] = useState<Theme | null>(stored)
  const theme: Theme = choice ?? (systemDark ? 'dark' : 'light')

  useEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice
    else delete document.documentElement.dataset.theme
  }, [choice])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* not persisted */
    }
  }, [theme])

  return { theme, toggle }
}
