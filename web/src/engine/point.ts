/** Point operations, mirroring python/src/pixel_lab/ops/point.py. */
import { isGray, makeImg, mapColor, type Img } from './image'
import { roundHalfEven } from './math'

export function applyLut(img: Img, lut: Uint8Array): Img {
  return mapColor(img, (p) => {
    const out = new Uint8Array(p.length)
    for (let i = 0; i < p.length; i++) out[i] = lut[p[i]]
    return out
  })
}

export function buildLut(fn: (v: number) => number): Uint8Array {
  const lut = new Uint8Array(256)
  for (let v = 0; v < 256; v++) lut[v] = fn(v)
  return lut
}

export function luma(img: Img): Uint8Array {
  if (isGray(img)) return img.color[0]
  const [r, g, b] = img.color
  const out = new Uint8Array(r.length)
  for (let i = 0; i < r.length; i++) out[i] = roundHalfEven(r[i] * 0.299 + g[i] * 0.587 + b[i] * 0.114)
  return out
}

export const grayscale = (img: Img): Img =>
  isGray(img) ? img : makeImg(img.width, img.height, [luma(img)], img.alpha)

export const invertLut = () => buildLut((v) => 255 - v)
export const brightnessLut = (amount: number) => buildLut((v) => Math.min(255, Math.max(0, v + amount)))

export function contrastLut(amount: number): Uint8Array {
  const factor = (100 + amount) / 100
  return buildLut((v) => Math.min(255, Math.max(0, roundHalfEven((v - 128) * factor + 128))))
}

export function posterizeLut(levels: number): Uint8Array {
  const step = 255 / (levels - 1)
  return buildLut((v) => roundHalfEven(Math.floor((v * levels) / 256) * step))
}

export const invert = (img: Img) => applyLut(img, invertLut())
export const brightness = (img: Img, amount: number) => applyLut(img, brightnessLut(amount))
export const contrast = (img: Img, amount: number) => applyLut(img, contrastLut(amount))
export const posterize = (img: Img, levels: number) => applyLut(img, posterizeLut(levels))

export const SEPIA_MATRIX = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
] as const

export function sepia(img: Img): Img {
  const [r, g, b] = isGray(img) ? [img.color[0], img.color[0], img.color[0]] : img.color
  const mix = ([cr, cg, cb]: readonly number[]) => {
    const out = new Uint8Array(r.length)
    for (let i = 0; i < r.length; i++) out[i] = Math.min(255, roundHalfEven(r[i] * cr + g[i] * cg + b[i] * cb))
    return out
  }
  return makeImg(img.width, img.height, SEPIA_MATRIX.map(mix), img.alpha)
}
