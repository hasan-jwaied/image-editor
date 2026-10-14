import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { blank } from '../src/engine/image'
import { runSteps } from '../src/engine/registry'
import { makeStep } from '../src/state/pipeline'
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
