import type { MessageKey } from '../i18n/en'
import { OP_SPECS } from '../engine/spec'

type T = (key: MessageKey, vars?: Record<string, string | number>) => string
type Has = (key: string) => key is MessageKey

export const opLabel = (t: T, has: Has, op: string) => {
  const key = `op.${op}.label`
  return has(key) ? t(key) : (OP_SPECS[op]?.label ?? op)
}

export const opExplain = (t: T, has: Has, op: string) => {
  const key = `op.${op}.explain`
  return has(key) ? t(key) : (OP_SPECS[op]?.summary ?? '')
}

export const paramLabel = (t: T, has: Has, op: string, name: string) => {
  const key = `param.${op}.${name}`
  return has(key) ? t(key) : (OP_SPECS[op]?.params.find((p) => p.name === name)?.label ?? name)
}

export const optionLabel = (t: T, has: Has, value: string) => {
  const key = `option.${value}`
  return has(key) ? t(key) : value
}

export function formatMs(num: (n: number, d?: number) => string, ms: number): string {
  if (ms >= 1000) return `${num(ms / 1000, 2)} s`
  if (ms >= 100) return `${num(ms, 0)} ms`
  return `${num(ms, 1)} ms`
}
