export const HOME_URL = import.meta.env.VITE_HOME_URL || null
export const PWA = import.meta.env.VITE_PWA !== 'false'

/** Longest side images are scaled to before processing. */
export const WORKING_SIZES = [1024, 1600, 2400, 4096] as const
