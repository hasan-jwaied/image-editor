// Port of python/src/pixel_lab/ops/filters.py. Taps are summed in kernel order,
// starting from 0, to match Python's floating-point results exactly.
import { mapColor, type Img } from './image'
import { clampedIndex, integralImage, roundHalfEven } from './math'

export type Kernel = number[][]

const KERNEL_PRESETS: Record<string, Kernel> = {
  sharpen: [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ],
  emboss: [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ],
  outline: [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ],
  box: [0, 1, 2].map(() => [1 / 9, 1 / 9, 1 / 9]),
  gaussian: [
    [1 / 16, 2 / 16, 1 / 16],
    [2 / 16, 4 / 16, 2 / 16],
    [1 / 16, 2 / 16, 1 / 16],
  ],
}

/** True convolution (kernel flipped), clamped edges. O(N·k²). */
function convolveChannel(p: Uint8Array, w: number, h: number, kernel: Kernel): Uint8Array {
  const size = kernel.length
  if (size % 2 === 0 || kernel.some((row) => row.length !== size)) {
    throw new Error('kernel must be square with an odd size')
  }
  const pad = size >> 1
  const taps: { dy: number; dx: number; wt: number }[] = []
  for (let ky = 0; ky < size; ky++) {
    for (let kx = 0; kx < size; kx++) {
      const wt = kernel[size - 1 - ky][size - 1 - kx]
      if (wt !== 0) taps.push({ dy: ky, dx: kx, wt })
    }
  }
  const xi = clampedIndex(w, pad)
  const yi = clampedIndex(h, pad)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let t = 0; t < taps.length; t++) {
        const { dy, dx, wt } = taps[t]
        acc += p[yi[y + dy] * w + xi[x + dx]] * wt
      }
      const v = roundHalfEven(acc)
      out[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : v
    }
  }
  return out
}

function kernelFromWeights(weights: number[]): Kernel {
  const size = Math.round(Math.sqrt(weights.length))
  if (size * size !== weights.length || size % 2 === 0) {
    throw new Error('custom kernel needs an odd square number of weights (9, 25, ...)')
  }
  return Array.from({ length: size }, (_, i) => weights.slice(i * size, (i + 1) * size))
}

export function kernelFor(preset: string, weights?: number[]): Kernel {
  if (preset === 'custom') return kernelFromWeights(weights ?? [0, 0, 0, 0, 1, 0, 0, 0, 0])
  const k = KERNEL_PRESETS[preset]
  if (!k) throw new Error(`unknown kernel preset ${preset}`)
  return k
}

export function convolve(img: Img, preset: string, weights?: number[]): Img {
  const kernel = kernelFor(preset, weights)
  return mapColor(img, (p) => convolveChannel(p, img.width, img.height, kernel))
}

/** O(N·k²) baseline for the benchmark. */
export function boxBlurNaiveChannel(p: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const size = 2 * radius + 1
  const wt = 1 / (size * size)
  return convolveChannel(
    p,
    w,
    h,
    Array.from({ length: size }, () => new Array(size).fill(wt)),
  )
}

/** Summed-area table: 4 lookups per pixel at any radius. O(N). */
export function boxBlurChannel(p: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius <= 0) return p.slice()
  const size = 2 * radius + 1
  const area = size * size
  const table = integralImage(p, w, h, radius)
  const stride = w + 2 * radius + 1
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const top = y * stride
    const bottom = (y + size) * stride
    for (let x = 0; x < w; x++) {
      out[y * w + x] = roundHalfEven(
        (table[bottom + x + size] - table[top + x + size] - table[bottom + x] + table[top + x]) / area,
      )
    }
  }
  return out
}

export const boxBlur = (img: Img, radius: number) =>
  mapColor(img, (p) => boxBlurChannel(p, img.width, img.height, radius))

export function gaussianKernel(sigma: number): Float64Array {
  const radius = Math.max(1, Math.ceil(3 * sigma))
  const weights = new Float64Array(2 * radius + 1)
  for (let i = -radius; i <= radius; i++) weights[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma))
  let total = 0
  for (const v of weights) total += v
  return weights.map((v) => v / total)
}

/** Horizontal then vertical 1-D pass. O(N·k). */
export function gaussianChannel(p: Uint8Array, w: number, h: number, sigma: number): Uint8Array {
  const weights = gaussianKernel(sigma)
  const n = weights.length
  const radius = n >> 1
  const xi = clampedIndex(w, radius)
  const yi = clampedIndex(h, radius)
  const rows = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    const base = y * w
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let i = 0; i < n; i++) acc += p[base + xi[x + i]] * weights[i]
      rows[base + x] = acc
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let i = 0; i < n; i++) acc += rows[yi[y + i] * w + x] * weights[i]
      const v = roundHalfEven(acc)
      out[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : v
    }
  }
  return out
}

export const gaussianBlur = (img: Img, sigma: number) =>
  mapColor(img, (p) => gaussianChannel(p, img.width, img.height, sigma))

/** Unsharp mask. */
export function sharpen(img: Img, amount: number, sigma: number): Img {
  return mapColor(img, (p) => {
    const blurred = gaussianChannel(p, img.width, img.height, sigma)
    const out = new Uint8Array(p.length)
    for (let i = 0; i < p.length; i++) {
      const v = roundHalfEven(p[i] + amount * (p[i] - blurred[i]))
      out[i] = v < 0 ? 0 : v > 255 ? 255 : v
    }
    return out
  })
}
