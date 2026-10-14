// Every case from python/scripts/generate_golden.py must match pixel for pixel.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeImg, modeOf, planesOf, type Img } from '../src/engine/image'
import { runSteps, type Step } from '../src/engine/registry'

interface Encoded {
  width: number
  height: number
  mode: string
  planes: string[]
}

const golden = JSON.parse(
  readFileSync(process.env.GOLDEN ?? new URL('../../spec/golden/golden.json', import.meta.url), 'utf8'),
) as {
  fixtures: Record<string, Encoded>
  cases: { name: string; fixture: string; steps: Step[]; expected: Encoded }[]
}

function decode(e: Encoded): Img {
  const planes = e.planes.map((b64) => new Uint8Array(Buffer.from(b64, 'base64')))
  const nColor = e.mode.startsWith('L') ? 1 : 3
  return makeImg(e.width, e.height, planes.slice(0, nColor), e.mode.endsWith('A') ? planes[nColor] : null)
}

function diff(actual: Img, expected: Img) {
  let mismatches = 0
  let maxDelta = 0
  const pa = planesOf(actual)
  planesOf(expected).forEach((plane, k) =>
    plane.forEach((v, i) => {
      const d = Math.abs(v - pa[k][i])
      if (d) mismatches++
      maxDelta = Math.max(maxDelta, d)
    }),
  )
  return { mismatches, maxDelta }
}

describe('golden cases from the Python reference', () => {
  it('covers every case', () => expect(golden.cases.length).toBeGreaterThan(80))

  for (const c of golden.cases) {
    it(c.name, () => {
      const actual = runSteps(decode(golden.fixtures[c.fixture]), c.steps)
      const expected = decode(c.expected)
      expect([actual.width, actual.height, modeOf(actual)]).toEqual([expected.width, expected.height, modeOf(expected)])
      expect(diff(actual, expected)).toEqual({ mismatches: 0, maxDelta: 0 })
    })
  }
})
