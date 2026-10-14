/** Edge detection, mirroring python/src/pixel_lab/ops/edges.py. */
import { makeImg, type Img } from './image'
import { clampedIndex, integralImage, roundHalfEven } from './math'
import { boxBlurChannel, gaussianChannel } from './filters'
import { luma } from './point'

export function sobelGradients(p: Uint8Array, w: number, h: number) {
  const gx = new Int32Array(w * h)
  const gy = new Int32Array(w * h)
  const xi = clampedIndex(w, 1)
  const yi = clampedIndex(h, 1)
  for (let y = 0; y < h; y++) {
    const a = yi[y] * w // row above (clamped)
    const b = yi[y + 1] * w
    const c = yi[y + 2] * w // row below
    for (let x = 0; x < w; x++) {
      const l = xi[x]
      const m = xi[x + 1]
      const r = xi[x + 2]
      gx[y * w + x] = p[a + r] + 2 * p[b + r] + p[c + r] - (p[a + l] + 2 * p[b + l] + p[c + l])
      gy[y * w + x] = p[c + l] + 2 * p[c + m] + p[c + r] - (p[a + l] + 2 * p[a + m] + p[a + r])
    }
  }
  return { gx, gy }
}

function magnitude(gx: Int32Array, gy: Int32Array): Float64Array {
  const out = new Float64Array(gx.length)
  for (let i = 0; i < gx.length; i++) out[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i])
  return out
}

function toBytes(values: Float64Array): Uint8Array {
  const out = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) out[i] = Math.min(255, roundHalfEven(values[i]))
  return out
}

export function sobel(img: Img): Img {
  const { gx, gy } = sobelGradients(luma(img), img.width, img.height)
  return makeImg(img.width, img.height, [toBytes(magnitude(gx, gy))], img.alpha)
}

const TAN_NUM = 414
const TAN_DEN = 1000

function nonMaximumSuppression(mag: Float64Array, gx: Int32Array, gy: Int32Array, w: number, h: number) {
  const out = new Float64Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const m = mag[i]
      if (m === 0) continue
      const dx = gx[i]
      const dy = gy[i]
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      let n1: number
      let n2: number
      if (TAN_DEN * ay <= TAN_NUM * ax) {
        n1 = mag[i - 1]
        n2 = mag[i + 1]
      } else if (TAN_DEN * ax <= TAN_NUM * ay) {
        n1 = mag[i - w]
        n2 = mag[i + w]
      } else if (dx > 0 === dy > 0) {
        n1 = mag[i - w - 1]
        n2 = mag[i + w + 1]
      } else {
        n1 = mag[i - w + 1]
        n2 = mag[i + w - 1]
      }
      if (m >= n1 && m >= n2) out[i] = m
    }
  }
  return out
}

function hysteresis(nms: Float64Array, w: number, h: number, low: number, high: number): Uint8Array {
  const out = new Uint8Array(w * h)
  const stack: number[] = []
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= high) {
      out[i] = 255
      stack.push(i)
    }
  }
  while (stack.length) {
    const i = stack.pop()!
    const y = (i / w) | 0
    const x = i - y * w
    for (let ny = y - 1; ny <= y + 1; ny++) {
      if (ny < 0 || ny >= h) continue
      for (let nx = x - 1; nx <= x + 1; nx++) {
        const j = ny * w + nx
        if (nx >= 0 && nx < w && out[j] === 0 && nms[j] >= low) {
          out[j] = 255
          stack.push(j)
        }
      }
    }
  }
  return out
}

export interface CannyStages {
  smoothed: Uint8Array
  gradient: Uint8Array
  suppressed: Uint8Array
  edges: Uint8Array
}

export function cannyStages(img: Img, sigma: number, low: number, high: number): CannyStages {
  const { width: w, height: h } = img
  const gray = luma(img)
  const smoothed = sigma > 0 ? gaussianChannel(gray, w, h, sigma) : gray
  const { gx, gy } = sobelGradients(smoothed, w, h)
  const mag = magnitude(gx, gy)
  const nms = nonMaximumSuppression(mag, gx, gy, w, h)
  return {
    smoothed,
    gradient: toBytes(mag),
    suppressed: toBytes(nms),
    edges: hysteresis(nms, w, h, Math.min(low, high), high),
  }
}

export const canny = (img: Img, sigma: number, low: number, high: number): Img =>
  makeImg(img.width, img.height, [cannyStages(img, sigma, low, high).edges], img.alpha)

export function adaptiveThreshold(img: Img, blurRadius: number, blockRadius: number, offset: number): Img {
  const { width: w, height: h } = img
  const smoothed = boxBlurChannel(luma(img), w, h, blurRadius)
  const table = integralImage(smoothed, w, h, 0)
  const stride = w + 1
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const r0 = Math.max(0, y - blockRadius)
    const r1 = Math.min(h, y + blockRadius + 1)
    const top = r0 * stride
    const bottom = r1 * stride
    const rows = r1 - r0
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - blockRadius)
      const b = Math.min(w, x + blockRadius + 1)
      const mean = (table[bottom + b] - table[top + b] - table[bottom + a] + table[top + a]) / (rows * (b - a))
      out[y * w + x] = smoothed[y * w + x] < mean - offset ? 0 : 255
    }
  }
  return makeImg(w, h, [out], img.alpha)
}
