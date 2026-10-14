import { LANGUAGES, useI18n, type Lang } from '../i18n'
import { Github, Logo, Moon, Sun } from './Icons'

export const REPO_URL = 'https://github.com/hasan-jwaied/image-editor'

export function Header({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { t, lang, setLang } = useI18n()
  return (
    <header className="topbar">
      <a className="skip-link" href="#lab">
        {t('skip.lab')}
      </a>
      <a className="brand" href="#top" aria-label={t('app.name')}>
        <Logo />
        <span className="brand-text">
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tagline">{t('app.tagline')}</span>
        </span>
      </a>
      <nav className="topnav" aria-label="Primary">
        <a href="#lab">{t('nav.lab')}</a>
        <a href="#how">{t('nav.how')}</a>
      </nav>
      <div className="topbar-actions">
        <label className="lang-select">
          <span className="sr-only">{t('lang.label')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id} lang={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          title={t('theme.toggle')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label={t('nav.github')} title={t('nav.github')}>
          <Github />
        </a>
      </div>
    </header>
  )
}
