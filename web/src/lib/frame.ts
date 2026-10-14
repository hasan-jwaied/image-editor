import { toRGBA, type Img } from '../engine/image'
import type { Frame } from '../components/Viewer'

const cache = new WeakMap<Img, Frame>()

export function frameOf(img: Img): Frame {
  let f = cache.get(img)
  if (!f) {
    f = { width: img.width, height: img.height, rgba: toRGBA(img) }
    cache.set(img, f)
  }
  return f
}

export function grayFrame(plane: Uint8Array, width: number, height: number): Frame {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, j = 0; i < plane.length; i++, j += 4) {
    rgba[j] = rgba[j + 1] = rgba[j + 2] = plane[i]
    rgba[j + 3] = 255
  }
  return { width, height, rgba }
}
