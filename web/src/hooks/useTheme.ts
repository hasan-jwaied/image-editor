import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'

/**
 * The same storage key and class the portfolio uses (next-themes, attribute
 * "class", default light, no system mode), so a theme chosen on the portfolio
 * carries over to the lab and back.
 */
const THEME_KEY = 'theme'

function stored(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored)

  useEffect(() => apply(theme), [theme])

  // Another tab (or the portfolio) changed the theme.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setTheme(e.newValue === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const commit = () => {
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* not persisted */
      }
      apply(next)
      setTheme(next)
    }
    // Cross-fade the whole page as one snapshot, like the portfolio's toggle.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('startViewTransition' in document)) commit()
    else document.startViewTransition(() => flushSync(commit))
  }, [theme])

  return { theme, toggle }
}
