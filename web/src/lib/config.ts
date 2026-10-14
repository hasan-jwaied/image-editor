/** Build-time configuration; see web/.env and web/.env.site. */
export const HOME_URL = import.meta.env.VITE_HOME_URL || null
export const PWA = import.meta.env.VITE_PWA !== 'false'
