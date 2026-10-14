import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { blank } from '../src/engine/image'
import { runSteps } from '../src/engine/registry'
import { MAX_STEPS, makeStep } from '../src/state/pipeline'
import { cliCommand, decodeRecipeHash, encodeRecipeHash, parseRecipe, toRecipe } from '../src/state/recipe'

const dir = new URL('../../spec/recipes/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('shared recipes (same files the Python tests load)', () => {
  it.each(files)('%s parses and runs', (file) => {
    const steps = parseRecipe(JSON.parse(readFileSync(new URL(file, dir), 'utf8')))
    expect(steps.length).toBeGreaterThan(0)
    expect(runSteps(blank(12, 8), steps).width).toBeGreaterThan(0)
  })

  it('skips disabled steps like the CLI does', () => {
    const steps = parseRecipe(JSON.parse(readFileSync(new URL('custom-kernel.json', dir), 'utf8')))
    const out = runSteps(blank(12, 8), steps)
    expect([out.width, out.height]).toEqual([8, 12])
  })
})

describe('untrusted recipes (shared links)', () => {
  const step = { op: 'invert', params: {} }
  it.each([
    ['too many steps', { version: 1, steps: Array.from({ length: MAX_STEPS + 1 }, () => step) }],
    ['prototype key as operation', { version: 1, steps: [{ op: '__proto__', params: {} }] }],
    ['params that are not an object', { version: 1, steps: [{ op: 'invert', params: [1, 2] }] }],
    ['unknown parameter', { version: 1, steps: [{ op: 'invert', params: { constructor: 1 } }] }],
    ['wrong version', { version: 2, steps: [step] }],
    ['not an object', 'invert'],
  ])('rejects %s', (_name, recipe) => {
    expect(() => parseRecipe(recipe)).toThrow()
    expect(decodeRecipeHash(encodeRecipeHash(recipe as never))).toBeNull()
  })

  it('accepts the longest allowed pipeline', () => {
    expect(parseRecipe({ version: 1, steps: Array.from({ length: MAX_STEPS }, () => step) })).toHaveLength(MAX_STEPS)
  })

  it('refuses results above 50 megapixels', () => {
    expect(() => runSteps(blank(4000, 4000), [{ op: 'resize', params: { scale: 200 } }])).toThrow(/50 megapixels/)
  })
})

describe('recipe export', () => {
  const steps = [
    makeStep('gaussian_blur', { sigma: 3 }),
    makeStep('convolve', { preset: 'custom', weights: [0, 0, 0, 0, 2, 0, 0, 0, 0] }),
    makeStep('canny'),
  ]

  it('omits defaults and unused kernel weights', () => {
    const recipe = toRecipe(steps)
    expect(recipe.steps[0].params).toEqual({ sigma: 3 })
    expect(recipe.steps[2].params).toEqual({})
    expect(toRecipe([makeStep('convolve')]).steps[0].params).toEqual({})
  })

  it('round-trips through the URL hash', () => {
    const decoded = decodeRecipeHash(encodeRecipeHash(toRecipe(steps)))
    expect(decoded?.map((s) => s.op)).toEqual(['gaussian_blur', 'convolve', 'canny'])
    expect(decoded?.[1].params.weights).toEqual([0, 0, 0, 0, 2, 0, 0, 0, 0])
    expect(decodeRecipeHash('#r=not-valid')).toBeNull()
  })

  it('produces the equivalent CLI command', () => {
    const cmd = cliCommand(toRecipe(steps))
    expect(cmd).toContain('-s gaussian_blur:sigma=3')
    expect(cmd).toContain('-s convolve:preset=custom,weights=0,0,0,0,2,0,0,0,0')
    expect(cmd).toContain('-s canny')
  })
})
