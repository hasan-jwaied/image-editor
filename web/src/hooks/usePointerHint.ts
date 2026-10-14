import type { MessageKey } from '../i18n/en'
import { useMediaQuery } from './useMediaQuery'

/** "Point at the image…" with a mouse, "Tap the image…" on touch screens. */
export function usePointerHint(): MessageKey {
  return useMediaQuery('(pointer: coarse)') ? 'explain.tap' : 'explain.hover'
}
