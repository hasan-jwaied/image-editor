/**
 * Recipes: the JSON format shared with the Python CLI
 * (python/src/pixel_lab/recipe.py), plus URL-hash sharing.
 */
import { OP_SPECS, defaultParams, resolveParams, type ParamValue, type Params } from '../engine/spec'

export interface RecipeStep {
  op: string
  params: Params
  enabled?: boolean
}

export interface Recipe {
  version: 1
  steps: RecipeStep[]
}

export function toRecipe(steps: { op: string; params: Params; enabled: boolean }[]): Recipe {
  return {
    version: 1,
    steps: steps.map((s) => ({ op: s.op, params: minimalParams(s.op, s.params), ...(s.enabled ? {} : { enabled: false }) })),
  }
}

/** Drop parameters left at their defaults, and custom kernel weights unless used. */
function minimalParams(op: string, params: Params): Params {
  const defaults = defaultParams(op)
  const out: Params = {}
  for (const [k, v] of Object.entries(params)) {
    if (k === 'weights' && params.preset !== 'custom') continue
    if (JSON.stringify(v) !== JSON.stringify(defaults[k])) out[k] = v
  }
  return out
}

export function parseRecipe(data: unknown): RecipeStep[] {
  const r = data as Partial<Recipe>
  if (!r || r.version !== 1 || !Array.isArray(r.steps)) throw new Error('not a pixel-lab recipe (version 1)')
  return r.steps.map((s) => {
    if (!s || typeof s.op !== 'string' || !OP_SPECS[s.op]) throw new Error(`unknown operation ${String(s?.op)}`)
    return { op: s.op, params: resolveParams(s.op, s.params ?? {}), enabled: s.enabled !== false }
  })
}

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export const encodeRecipeHash = (recipe: Recipe) => `#r=${toBase64Url(JSON.stringify(recipe))}`

export function decodeRecipeHash(hash: string): RecipeStep[] | null {
  const match = /[#&]r=([A-Za-z0-9_-]+)/.exec(hash)
  if (!match) return null
  try {
    return parseRecipe(JSON.parse(fromBase64Url(match[1])))
  } catch {
    return null
  }
}

function formatValue(v: ParamValue): string {
  return Array.isArray(v) ? v.join(',') : String(v)
}

/** The equivalent Python CLI invocation, for the "run it in Python" panel. */
export function cliCommand(recipe: Recipe, input = 'photo.jpg', output = 'out.png'): string {
  const steps = recipe.steps
    .filter((s) => s.enabled !== false)
    .map((s) => {
      const args = Object.entries(s.params).map(([k, v]) => `${k}=${formatValue(v)}`)
      return ` \\\n  -s ${args.length ? `${s.op}:${args.join(',')}` : s.op}`
    })
  return `pixel-lab run ${input} -o ${output}${steps.join('')}`
}
