/**
 * Seam carving, mirroring python/src/pixel_lab/ops/seam.py, plus tracing of
 * the removed seams (in original-image coordinates) for visualisation.
 *
 * Same algorithm and tie-breaking as the Python reference, so the output is
 * bit-identical, but organised for speed:
 *  - planes keep their original row stride and shrink in place (copyWithin),
 *    so removing a seam allocates nothing;
 *  - after a removal only a 3-pixel band of the energy map around the seam can
 *    change, so energy is updated locally in O(height) instead of O(N);
 *  - the DP runs on Int32 (energies are small integers; sums stay exact).
 */
import { makeImg, planesOf, type Img } from './image'
import { roundHalfEven } from './math'
import { luma } from './point'

/** Optional progress hook (0..1) for long-running carves; set by the worker. */
export const progress: { report: ((fraction: number) => void) | null } = { report: null }

/** Dual-gradient energy |dI/dx| + |dI/dy| with clamped borders (full map). */
export function energyMap(gray: ArrayLike<number>, w: number, h: number): Int32Array {
  const e = new Int32Array(w * h)
  for (let y = 0; y < h; y++) energyRow(gray, e, w, w, h, y, 0, w - 1)
  return e
}

/** Recompute energy for row y, columns x0..x1, on buffers with row `stride`. */
function energyRow(
  gray: ArrayLike<number>,
  e: Int32Array,
  stride: number,
  w: number,
  h: number,
  y: number,
  x0: number,
  x1: number,
) {
  const row = y * stride
  const up = (y > 0 ? y - 1 : 0) * stride
  const down = (y < h - 1 ? y + 1 : h - 1) * stride
  for (let x = x0; x <= x1; x++) {
    const l = gray[row + (x > 0 ? x - 1 : 0)]
    const r = gray[row + (x < w - 1 ? x + 1 : w - 1)]
    const dx = r - l
    const dy = gray[down + x] - gray[up + x]
    e[row + x] = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy)
  }
}

/** Minimum-energy vertical seam by dynamic programming; leftmost on ties. */
export function findSeam(energy: ArrayLike<number>, w: number, h: number): Int32Array {
  return findSeamStrided(energy, w, w, h, new Int32Array(w * h), new Int32Array(h))
}

function findSeamStrided(
  energy: ArrayLike<number>,
  stride: number,
  w: number,
  h: number,
  m: Int32Array,
  seam: Int32Array,
): Int32Array {
  for (let x = 0; x < w; x++) m[x] = energy[x]
  for (let y = 1; y < h; y++) {
    const row = y * stride
    const prev = row - stride
    if (w === 1) {
      m[row] = energy[row] + m[prev]
      continue
    }
    // x = 0: no left neighbour
    let up = m[prev]
    let right = m[prev + 1]
    m[row] = energy[row] + (up < right ? up : right)
    for (let x = 1; x < w - 1; x++) {
      const left = up
      up = right
      right = m[prev + x + 1]
      let best = left < up ? left : up
      if (right < best) best = right
      m[row + x] = energy[row + x] + best
    }
    // x = w - 1: no right neighbour
    m[row + w - 1] = energy[row + w - 1] + (up < right ? up : right)
  }
  const last = (h - 1) * stride
  let x = 0
  for (let i = 1; i < w; i++) if (m[last + i] < m[last + x]) x = i
  seam[h - 1] = x
  for (let y = h - 2; y >= 0; y--) {
    const row = y * stride
    let best = x
    if (x > 0 && m[row + x - 1] <= m[row + best]) best = x - 1
    if (x + 1 < w && m[row + x + 1] < m[row + best]) best = x + 1
    x = best
    seam[y] = x
  }
  return seam
}

type Buffer = Uint8Array | Int32Array

/** Remove `count` vertical seams from planes stored with row stride `stride`. */
function carveColumns(
  buffers: Buffer[],
  gray: Uint8Array,
  index: Int32Array | null,
  stride: number,
  width: number,
  h: number,
  count: number,
  onSeam: ((seam: Int32Array) => void) | null,
  progressBase: number,
  progressSpan: number,
): number {
  let w = width
  const energy = new Int32Array(stride * h)
  for (let y = 0; y < h; y++) energyRow(gray, energy, stride, w, h, y, 0, w - 1)
  const m = new Int32Array(stride * h)
  const seam = new Int32Array(h)
  const all: Buffer[] = [...buffers, gray, energy, ...(index ? [index] : [])]
  const every = Math.max(1, Math.floor(count / 50))

  for (let k = 0; k < count; k++) {
    findSeamStrided(energy, stride, w, h, m, seam)
    if (onSeam && index) {
      const original = new Int32Array(h)
      for (let y = 0; y < h; y++) original[y] = index[y * stride + seam[y]]
      onSeam(original)
    }
    for (let y = 0; y < h; y++) {
      const row = y * stride
      const s = seam[y]
      if (s < w - 1) for (const b of all) b.copyWithin(row + s, row + s + 1, row + w)
    }
    w--
    // Only pixels within one column of a seam pixel in this row or the rows
    // above/below can see different neighbours now.
    for (let y = 0; y < h; y++) {
      let lo = seam[y]
      let hi = seam[y]
      if (y > 0) {
        lo = Math.min(lo, seam[y - 1])
        hi = Math.max(hi, seam[y - 1])
      }
      if (y < h - 1) {
        lo = Math.min(lo, seam[y + 1])
        hi = Math.max(hi, seam[y + 1])
      }
      energyRow(gray, energy, stride, w, h, y, Math.max(0, lo - 2), Math.min(w - 1, hi + 1))
    }
    if (progress.report && (k + 1) % every === 0) progress.report(progressBase + (progressSpan * (k + 1)) / count)
  }
  return w
}

function compact<T extends Buffer>(buf: T, stride: number, w: number, h: number): T {
  const out = new (buf.constructor as new (n: number) => T)(w * h)
  for (let y = 0; y < h; y++) out.set(buf.subarray(y * stride, y * stride + w), y * w)
  return out
}

function transpose<T extends Buffer>(p: T, w: number, h: number): T {
  const out = new (p.constructor as new (n: number) => T)(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + y] = p[y * w + x]
  return out
}

interface SeamTrace {
  image: Img
  /** Every removed vertical seam, as original-image column per row. */
  seams: Int32Array[]
}

export function seamCarveTrace(img: Img, widthPercent: number, heightPercent: number, trace = false): SeamTrace {
  const { width, height } = img
  const columns = Math.min(roundHalfEven((width * widthPercent) / 100), width - 1)
  const rows = Math.min(roundHalfEven((height * heightPercent) / 100), height - 1)
  const total = columns + rows || 1
  const seams: Int32Array[] = []

  let planes = planesOf(img).map((p) => p.slice())
  let gray = luma(img).slice()
  let w = width
  let h = height

  if (columns > 0) {
    const index = trace ? Int32Array.from({ length: width * height }, (_, i) => i % width) : null
    w = carveColumns(
      planes,
      gray,
      index,
      width,
      width,
      height,
      columns,
      trace ? (s) => seams.push(s) : null,
      0,
      columns / total,
    )
    planes = planes.map((p) => compact(p, width, w, h))
    gray = compact(gray, width, w, h)
  }

  if (rows > 0) {
    planes = planes.map((p) => transpose(p, w, h))
    gray = transpose(gray, w, h)
    // In transposed space the image is h wide and w tall.
    const newH = carveColumns(planes, gray, null, h, h, w, rows, null, columns / total, rows / total)
    planes = planes.map((p) => transpose(compact(p, h, newH, w), newH, w))
    h = newH
  }

  const nColor = img.color.length
  const image = makeImg(w, h, planes.slice(0, nColor), img.alpha ? planes[nColor] : null)
  return { image, seams }
}

export const seamCarve = (img: Img, widthPercent: number, heightPercent: number) =>
  seamCarveTrace(img, widthPercent, heightPercent).image
