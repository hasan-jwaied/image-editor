import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type MessageKey } from './en'
import { he } from './he'

export type Lang = 'en' | 'he'
export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'he', label: 'עברית' },
]

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, he }
const STORAGE_KEY = 'pixel-lab:lang'

type Vars = Record<string, string | number>

interface I18n {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (l: Lang) => void
  t: (key: MessageKey, vars?: Vars) => string
  num: (n: number, digits?: number) => string
}

const Ctx = createContext<I18n | null>(null)

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'he') return stored
  } catch {
    /* storage unavailable (private mode, sandbox): fall through */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2)
  return nav === 'he' ? 'he' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const dir = lang === 'he' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* not persisted; fine */
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const formatters = new Map<number, Intl.NumberFormat>()
    const fmt = (digits: number) => {
      if (!formatters.has(digits)) {
        formatters.set(digits, new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0 }))
      }
      return formatters.get(digits)!
    }
    const messages = MESSAGES[lang]
    return {
      lang,
      dir,
      setLang,
      t: (key, vars) => {
        const template = messages[key] ?? key
        return vars
          ? template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
          : template
      },
      num: (n, digits = 1) => fmt(digits).format(n),
    }
  }, [lang, dir, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}
