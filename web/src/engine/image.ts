/**
 * The image model, mirroring python/src/pixel_lab/image.py.
 *
 * Planes are stored row-major in flat Uint8Arrays. `color` holds one plane
 * (grayscale) or three (R, G, B); `alpha` is optional and is only moved by
 * geometric operations, never recolored.
 */
export interface Img {
  readonly width: number
  readonly height: number
  readonly color: Uint8Array[]
  readonly alpha: Uint8Array | null
}

type Mode = 'L' | 'LA' | 'RGB' | 'RGBA'

export function makeImg(width: number, height: number, color: Uint8Array[], alpha: Uint8Array | null = null): Img {
  if (color.length !== 1 && color.length !== 3) throw new Error(`expected 1 or 3 color planes, got ${color.length}`)
  const n = width * height
  if (width < 1 || height < 1) throw new Error('image must be at least 1x1')
  for (const p of [...color, ...(alpha ? [alpha] : [])]) {
    if (p.length !== n) throw new Error('plane size does not match dimensions')
  }
  return { width, height, color, alpha }
}

export function blank(width: number, height: number, mode: Mode = 'RGB', fill = 0): Img {
  const plane = (v: number) => new Uint8Array(width * height).fill(v)
  const color = mode.startsWith('L') ? [plane(fill)] : [plane(fill), plane(fill), plane(fill)]
  return makeImg(width, height, color, mode.endsWith('A') ? plane(255) : null)
}

export const isGray = (img: Img) => img.color.length === 1

export function modeOf(img: Img): Mode {
  return `${isGray(img) ? 'L' : 'RGB'}${img.alpha ? 'A' : ''}` as Mode
}

export function planesOf(img: Img): Uint8Array[] {
  return img.alpha ? [...img.color, img.alpha] : [...img.color]
}

/** Apply `fn` to each color plane; alpha is shared untouched. */
export function mapColor(img: Img, fn: (plane: Uint8Array) => Uint8Array): Img {
  return { width: img.width, height: img.height, color: img.color.map(fn), alpha: img.alpha }
}

/** Apply a geometric transform to every plane, including alpha. */
export function mapPlanes(img: Img, width: number, height: number, fn: (plane: Uint8Array) => Uint8Array): Img {
  return makeImg(width, height, img.color.map(fn), img.alpha ? fn(img.alpha) : null)
}

/** Interleave into RGBA for a canvas. */
export function toRGBA(img: Img, out?: Uint8ClampedArray<ArrayBuffer>): Uint8ClampedArray<ArrayBuffer> {
  const n = img.width * img.height
  const data = out ?? new Uint8ClampedArray(n * 4)
  const [r, g = r, b = r] = img.color
  const a = img.alpha
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    data[j] = r[i]
    data[j + 1] = g[i]
    data[j + 2] = b[i]
    data[j + 3] = a ? a[i] : 255
  }
  return data
}

/** De-interleave canvas RGBA. Fully opaque alpha is dropped, as in Python's loader. */
export function fromRGBA(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Img {
  const n = width * height
  const r = new Uint8Array(n)
  const g = new Uint8Array(n)
  const b = new Uint8Array(n)
  const a = new Uint8Array(n)
  let opaque = true
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    r[i] = data[j]
    g[i] = data[j + 1]
    b[i] = data[j + 2]
    a[i] = data[j + 3]
    if (a[i] !== 255) opaque = false
  }
  return makeImg(width, height, [r, g, b], opaque ? null : a)
}

export function imagesEqual(a: Img, b: Img): boolean {
  if (a.width !== b.width || a.height !== b.height || modeOf(a) !== modeOf(b)) return false
  const pa = planesOf(a)
  const pb = planesOf(b)
  return pa.every((p, k) => p.every((v, i) => v === pb[k][i]))
}
