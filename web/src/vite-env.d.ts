/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Link back to the portfolio ("‹ Portfolio" in the navigation bar). */
  readonly VITE_HOME_URL?: string
  readonly VITE_CANONICAL_URL?: string
  readonly VITE_OG_IMAGE?: string
  /** "false" disables the offline service worker (the portfolio build). */
  readonly VITE_PWA?: string
}
