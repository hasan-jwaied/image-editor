/** Geometric transforms, mirroring python/src/pixel_lab/ops/geometry.py. */
import { mapPlanes, type Img } from './image'
import { roundHalfEven } from './math'

export function flip(img: Img, axis: string): Img {
  const { width: w, height: h } = img
  if (axis !== 'horizontal' && axis !== 'vertical') throw new Error(`unknown axis ${axis}`)
  return mapPlanes(img, w, h, (p) => {
    const out = new Uint8Array(p.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        out[y * w + x] = axis === 'horizontal' ? p[y * w + (w - 1 - x)] : p[(h - 1 - y) * w + x]
      }
    }
    return out
  })
}

export function rotate(img: Img, direction: string): Img {
  const { width: w, height: h } = img
  if (direction === '180') {
    return mapPlanes(img, w, h, (p) => p.slice().reverse())
  }
  if (direction !== 'cw' && direction !== 'ccw') throw new Error(`unknown direction ${direction}`)
  // Output is h wide and w tall. cw: out[i][j] = in[h-1-j][i]; ccw: out[i][j] = in[j][w-1-i].
  return mapPlanes(img, h, w, (p) => {
    const out = new Uint8Array(p.length)
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        out[i * h + j] = direction === 'cw' ? p[(h - 1 - j) * w + i] : p[j * w + (w - 1 - i)]
      }
    }
    return out
  })
}

/** Pixel-centre aligned sample positions; see Python's `_sample_positions`. */
function samplePositions(src: number, dst: number) {
  const ratio = src / dst
  const lo = new Int32Array(dst)
  const hi = new Int32Array(dst)
  const frac = new Float64Array(dst)
  for (let i = 0; i < dst; i++) {
    let s = (i + 0.5) * ratio - 0.5
    if (s < 0) s = 0
    else if (s > src - 1) s = src - 1
    const i0 = Math.floor(s)
    lo[i] = i0
    hi[i] = Math.min(i0 + 1, src - 1)
    frac[i] = s - i0
  }
  return { lo, hi, frac }
}

/** Upper bound on any result, so repeated upscaling can't exhaust memory. Same as Python. */
export const MAX_PIXELS = 50_000_000

export function resizeTo(img: Img, width: number, height: number): Img {
  if (width < 1 || height < 1) throw new Error('target size must be at least 1x1')
  if (width * height > MAX_PIXELS) throw new Error('the result would be larger than 50 megapixels')
  const sw = img.width
  const xs = samplePositions(sw, width)
  const ys = samplePositions(img.height, height)
  return mapPlanes(img, width, height, (p) => {
    const out = new Uint8Array(width * height)
    for (let y = 0; y < height; y++) {
      const top = ys.lo[y] * sw
      const bot = ys.hi[y] * sw
      const wy = ys.frac[y]
      for (let x = 0; x < width; x++) {
        const a = xs.lo[x]
        const b = xs.hi[x]
        const wx = xs.frac[x]
        const v = roundHalfEven(
          (p[top + a] * (1 - wx) + p[top + b] * wx) * (1 - wy) + (p[bot + a] * (1 - wx) + p[bot + b] * wx) * wy,
        )
        out[y * width + x] = v < 0 ? 0 : v > 255 ? 255 : v
      }
    }
    return out
  })
}

export function resize(img: Img, scale: number): Img {
  const width = Math.max(1, roundHalfEven((img.width * scale) / 100))
  const height = Math.max(1, roundHalfEven((img.height * scale) / 100))
  return resizeTo(img, width, height)
}
