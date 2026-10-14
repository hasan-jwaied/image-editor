// spec/operations.json is generated from the Python registry.
import raw from '../../../spec/operations.json'

type ParamType = 'int' | 'float' | 'enum' | 'kernel'
export type ParamValue = number | string | number[]
export type Params = Record<string, ParamValue>

export interface ParamSpec {
  name: string
  type: ParamType
  label: string
  default: ParamValue
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: string[]
}

export interface OpSpec {
  id: string
  label: string
  category: string
  summary: string
  complexity: string
  params: ParamSpec[]
}

interface Spec {
  version: number
  categories: { id: string; label: string }[]
  operations: OpSpec[]
}

export const SPEC = raw as Spec
// No prototype, so "__proto__" from a shared link resolves to nothing.
const OP_SPECS: Record<string, OpSpec | undefined> = Object.assign(
  Object.create(null) as Record<string, OpSpec>,
  Object.fromEntries(SPEC.operations.map((op) => [op.id, op])),
)

export const isOp = (id: string) => OP_SPECS[id] !== undefined

export function opSpec(id: string): OpSpec {
  const spec = OP_SPECS[id]
  if (!spec) throw new Error(`unknown operation ${id}`)
  return spec
}

export function defaultParams(opId: string): Params {
  const spec = opSpec(opId)
  return Object.fromEntries(spec.params.map((p) => [p.name, Array.isArray(p.default) ? [...p.default] : p.default]))
}

/** Same rules as Python's Param.coerce. */
export function resolveParams(opId: string, raw: Record<string, unknown> = {}): Params {
  const spec = opSpec(opId)
  const known = new Set(spec.params.map((p) => p.name))
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) throw new Error(`${opId}: unknown parameter ${key}`)
  }
  const out: Params = {}
  for (const p of spec.params) {
    const value = raw[p.name] ?? p.default
    out[p.name] = coerce(p, value)
  }
  return out
}

function coerce(p: ParamSpec, value: unknown): ParamValue {
  const fail = () => new Error(`invalid value for ${p.name}: ${JSON.stringify(value)}`)
  if (p.type === 'enum') {
    if (typeof value !== 'string' || !p.options?.includes(value)) throw fail()
    return value
  }
  if (p.type === 'kernel') {
    const list = typeof value === 'string' ? value.split(',') : value
    if (!Array.isArray(list)) throw fail()
    const nums = list.map(Number)
    if (![9, 25, 49].includes(nums.length) || nums.some((n) => !Number.isFinite(n))) throw fail()
    return nums
  }
  const n = Number(value)
  if (!Number.isFinite(n) || (p.type === 'int' && !Number.isInteger(n))) throw fail()
  if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) {
    throw new Error(`${p.name} must be between ${p.min} and ${p.max}, got ${n}`)
  }
  return n
}
