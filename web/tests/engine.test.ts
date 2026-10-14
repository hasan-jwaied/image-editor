import { describe, expect, it } from 'vitest'
import { blank, fromRGBA, imagesEqual, makeImg, toRGBA } from '../src/engine/image'
import { roundHalfEven } from '../src/engine/math'
import { OPERATIONS, applyStep } from '../src/engine/registry'
import { findSeam, seamCarveTrace } from '../src/engine/seam'
import { SPEC, defaultParams, opSpec, resolveParams } from '../src/engine/spec'
import { rotate } from '../src/engine/geometry'

describe('roundHalfEven matches Python round()', () => {
  it.each([
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [3.5, 4],
    [-0.5, -0],
    [-1.5, -2],
    [-2.5, -2],
    [2.4999999999999996, 2],
    [2.5000000000000004, 3],
    [254.5, 254],
    [255.5, 256],
  ])('round(%d) = %d', (x, expected) => {
    expect(roundHalfEven(x)).toBe(expected)
  })
})

describe('spec contract', () => {
  it('implements exactly the operations in the shared spec', () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(SPEC.operations.map((o) => o.id).sort())
  })

  it('runs every operation with its defaults on every mode', () => {
    for (const mode of ['L', 'LA', 'RGB', 'RGBA'] as const) {
      const img = blank(9, 7, mode, 90)
      img.color[0][3 * 9 + 4] = 250
      for (const op of SPEC.operations) {
        const out = applyStep(img, { op: op.id, params: defaultParams(op.id) })
        expect(out.alpha === null).toBe(img.alpha === null)
      }
    }
  })

  it('validates parameters like the Python registry', () => {
    expect(resolveParams('box_blur', { radius: '3' })).toEqual({ radius: 3 })
    expect(() => resolveParams('box_blur', { radius: 2.5 })).toThrow(/invalid/)
    expect(() => resolveParams('gaussian_blur', { sigma: 100 })).toThrow(/between/)
    expect(() => resolveParams('flip', { axis: 'diagonal' })).toThrow(/invalid/)
    expect(() => resolveParams('flip', { nope: 1 })).toThrow(/unknown parameter/)
    expect(opSpec('canny').params.map((p) => p.name)).toEqual(['sigma', 'low', 'high'])
    expect(() => opSpec('__proto__')).toThrow(/unknown operation/)
  })
})

describe('image model', () => {
  it('round-trips RGBA and drops opaque alpha', () => {
    const img = makeImg(2, 1, [Uint8Array.of(1, 2), Uint8Array.of(3, 4), Uint8Array.of(5, 6)], Uint8Array.of(255, 7))
    expect(imagesEqual(fromRGBA(toRGBA(img), 2, 1), img)).toBe(true)
    const opaque = blank(3, 2, 'RGBA', 10)
    expect(fromRGBA(toRGBA(opaque), 3, 2).alpha).toBeNull()
  })

  it('four quarter turns are the identity', () => {
    const img = makeImg(3, 2, [Uint8Array.of(1, 2, 3, 4, 5, 6)])
    expect(imagesEqual(rotate(rotate(rotate(rotate(img, 'cw'), 'cw'), 'cw'), 'cw'), img)).toBe(true)
    expect(Array.from(rotate(img, 'cw').color[0])).toEqual([4, 1, 5, 2, 6, 3])
  })
})

describe('seam carving trace', () => {
  it('finds the optimal seam on a small grid', () => {
    // 3x3 energy with an obvious cheap diagonal
    const e = [0, 9, 9, 9, 0, 9, 9, 9, 0]
    expect(Array.from(findSeam(e, 3, 3))).toEqual([0, 1, 2])
  })

  it('reports connected seams in original coordinates', () => {
    const w = 24
    const h = 10
    const p = new Uint8Array(w * h)
    for (let i = 0; i < p.length; i++) p[i] = (i * 37) % 256
    const { image, seams } = seamCarveTrace(makeImg(w, h, [p]), 25, 0, true)
    expect(image.width).toBe(18)
    expect(seams).toHaveLength(6)
    const used = new Set<number>()
    for (const seam of seams) {
      for (let y = 0; y < h; y++) {
        if (y > 0) expect(Math.abs(seam[y] - seam[y - 1])).toBeLessThanOrEqual(6) // connected in carved space
        const key = y * w + seam[y]
        expect(used.has(key)).toBe(false) // each original pixel removed at most once
        used.add(key)
      }
    }
  })
})
