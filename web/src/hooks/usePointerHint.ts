import type { MessageKey } from '../i18n/en'
import { useMediaQuery } from './useMediaQuery'

export function usePointerHint(): MessageKey {
  return useMediaQuery('(pointer: coarse)') ? 'explain.tap' : 'explain.hover'
}
