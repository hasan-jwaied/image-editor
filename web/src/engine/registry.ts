import { dither } from './dither'
import { adaptiveThreshold, canny, sobel } from './edges'
import { boxBlur, convolve, gaussianBlur, sharpen } from './filters'
import { flip, resize, rotate } from './geometry'
import type { Img } from './image'
import { brightness, contrast, grayscale, invert, posterize, sepia } from './point'
import { seamCarve } from './seam'
import { resolveParams, type Params } from './spec'
import { equalize } from './tone'

type OpFn = (img: Img, p: Params) => Img
const num = (v: unknown) => v as number
const str = (v: unknown) => v as string

export const OPERATIONS: Record<string, OpFn> = {
  grayscale: (img) => grayscale(img),
  invert: (img) => invert(img),
  brightness: (img, p) => brightness(img, num(p.amount)),
  contrast: (img, p) => contrast(img, num(p.amount)),
  equalize: (img) => equalize(img),
  sepia: (img) => sepia(img),
  flip: (img, p) => flip(img, str(p.axis)),
  rotate: (img, p) => rotate(img, str(p.direction)),
  resize: (img, p) => resize(img, num(p.scale)),
  box_blur: (img, p) => boxBlur(img, num(p.radius)),
  gaussian_blur: (img, p) => gaussianBlur(img, num(p.sigma)),
  sharpen: (img, p) => sharpen(img, num(p.amount), num(p.sigma)),
  convolve: (img, p) => convolve(img, str(p.preset), p.weights as number[]),
  sobel: (img) => sobel(img),
  canny: (img, p) => canny(img, num(p.sigma), num(p.low), num(p.high)),
  adaptive_threshold: (img, p) => adaptiveThreshold(img, num(p.blur_radius), num(p.block_radius), num(p.offset)),
  posterize: (img, p) => posterize(img, num(p.levels)),
  dither: (img, p) => dither(img, num(p.levels)),
  seam_carve: (img, p) => seamCarve(img, num(p.width_percent), num(p.height_percent)),
}

export interface Step {
  op: string
  params: Params
  enabled?: boolean
}

export function applyStep(img: Img, step: Step): Img {
  const fn = OPERATIONS[step.op]
  if (!fn) throw new Error(`unknown operation ${step.op}`)
  return fn(img, resolveParams(step.op, step.params))
}

export function runSteps(img: Img, steps: Step[]): Img {
  return steps.reduce((acc, s) => (s.enabled === false ? acc : applyStep(acc, s)), img)
}
