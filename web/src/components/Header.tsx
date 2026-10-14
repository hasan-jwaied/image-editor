import { LANGUAGES, useI18n, type Lang } from '../i18n'
import { HOME_URL } from '../lib/config'
import { Back, Github, Logo, Moon, Sun } from './Icons'

export const REPO_URL = 'https://github.com/hasan-jwaied/image-editor'

/**
 * Full-width translucent bar, the same construction as the portfolio's
 * (.glass-nav): 48px tall, blurred, a hairline underneath and a scroll-driven
 * progress line.
 */
export function Header({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const { t, lang, setLang } = useI18n()
  return (
    <header className="topbar">
      <a className="skip-link" href="#lab">
        {t('skip.lab')}
      </a>
      <div className="glass-nav">
        <nav className="nav-inner" aria-label="Primary">
          {HOME_URL && (
            <a className="nav-back" href={HOME_URL}>
              <Back />
              <span>{t('nav.back')}</span>
            </a>
          )}
          <a className="brand" href="#top" aria-label={t('app.name')}>
            <Logo />
            <span className="brand-name">{t('app.name')}</span>
          </a>
          <ul className="topnav" role="list">
            <li>
              <a href="#lab">{t('nav.lab')}</a>
            </li>
            <li>
              <a href="#how">{t('nav.how')}</a>
            </li>
          </ul>
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
            <span className="nav-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
              title={t('theme.toggle')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            <a className="icon-btn" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={t('nav.github')} title={t('nav.github')}>
              <Github />
            </a>
          </div>
        </nav>
        <div className="nav-progress" aria-hidden="true" />
      </div>
    </header>
  )
}
