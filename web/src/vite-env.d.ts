/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "‹ Portfolio" link in the nav bar. */
  readonly VITE_HOME_URL?: string
  readonly VITE_CANONICAL_URL?: string
  readonly VITE_OG_IMAGE?: string
  /** "false" turns off the service worker. */
  readonly VITE_PWA?: string
}
