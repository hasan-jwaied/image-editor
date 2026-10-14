import type { MessageKey } from '../i18n/en'

type T = (key: MessageKey, vars?: Record<string, string | number>) => string

// Every operation, parameter and option in the spec has a string in each
// language; tests/i18n.test.ts fails the build otherwise.
export const opLabel = (t: T, op: string) => t(`op.${op}.label` as MessageKey)
export const opExplain = (t: T, op: string) => t(`op.${op}.explain` as MessageKey)
export const paramLabel = (t: T, op: string, name: string) => t(`param.${op}.${name}` as MessageKey)
export const optionLabel = (t: T, value: string) => t(`option.${value}` as MessageKey)

export function formatMs(num: (n: number, d?: number) => string, ms: number): string {
  if (ms >= 1000) return `${num(ms / 1000, 2)} s`
  if (ms >= 100) return `${num(ms, 0)} ms`
  return `${num(ms, 1)} ms`
}
