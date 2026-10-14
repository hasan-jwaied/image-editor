/** Histogram equalisation, mirroring python/src/pixel_lab/ops/tone.py. */
import { isGray, makeImg, type Img } from './image'
import { roundHalfEven } from './math'

export function histogram(p: Uint8Array): Uint32Array {
  const counts = new Uint32Array(256)
  for (let i = 0; i < p.length; i++) counts[p[i]]++
  return counts
}

export function equalizationLut(counts: ArrayLike<number>): Uint8Array {
  const cdf = new Float64Array(256)
  let running = 0
  for (let v = 0; v < 256; v++) {
    running += counts[v]
    cdf[v] = running
  }
  const total = running
  const cdfMin = cdf.find((c) => c > 0) ?? 0
  const lut = new Uint8Array(256)
  for (let v = 0; v < 256; v++) {
    lut[v] = cdfMin === total ? v : Math.max(0, roundHalfEven(((cdf[v] - cdfMin) * 255) / (total - cdfMin)))
  }
  return lut
}

export function equalize(img: Img): Img {
  const { width: w, height: h } = img
  if (isGray(img)) {
    const p = img.color[0]
    const lut = equalizationLut(histogram(p))
    return makeImg(w, h, [p.map((v) => lut[v])], img.alpha)
  }
  const [r, g, b] = img.color
  const n = r.length
  const ys = new Uint8Array(n)
  for (let i = 0; i < n; i++) ys[i] = roundHalfEven(r[i] * 0.299 + g[i] * 0.587 + b[i] * 0.114)
  const lut = equalizationLut(histogram(ys))
  const or = new Uint8Array(n)
  const og = new Uint8Array(n)
  const ob = new Uint8Array(n)
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
  for (let i = 0; i < n; i++) {
    const rv = r[i]
    const gv = g[i]
    const bv = b[i]
    const cb = -0.168736 * rv - 0.331264 * gv + 0.5 * bv
    const cr = 0.5 * rv - 0.418688 * gv - 0.081312 * bv
    const y = lut[ys[i]]
    or[i] = clamp(roundHalfEven(y + 1.402 * cr))
    og[i] = clamp(roundHalfEven(y - 0.344136 * cb - 0.714136 * cr))
    ob[i] = clamp(roundHalfEven(y + 1.772 * cb))
  }
  return makeImg(w, h, [or, og, ob], img.alpha)
}
