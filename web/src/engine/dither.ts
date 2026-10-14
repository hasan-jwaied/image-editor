/** Floyd–Steinberg dithering, mirroring python/src/pixel_lab/ops/dither.py. */
import { mapColor, type Img } from './image'
import { roundHalfEven } from './math'

function ditherChannel(p: Uint8Array, w: number, h: number, levels: number): Uint8Array {
  const steps = levels - 1
  const palette = Array.from({ length: levels }, (_, q) => roundHalfEven((q * 255) / steps))
  const buf = Float64Array.from(p)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    const below = y + 1 < h ? row + w : -1
    for (let x = 0; x < w; x++) {
      const old = buf[row + x]
      let q = roundHalfEven((old * steps) / 255)
      q = q < 0 ? 0 : q > steps ? steps : q
      const value = palette[q]
      out[row + x] = value
      const err = old - value
      if (x + 1 < w) buf[row + x + 1] += (err * 7) / 16
      if (below >= 0) {
        if (x > 0) buf[below + x - 1] += (err * 3) / 16
        buf[below + x] += (err * 5) / 16
        if (x + 1 < w) buf[below + x + 1] += (err * 1) / 16
      }
    }
  }
  return out
}

export const dither = (img: Img, levels: number) =>
  mapColor(img, (p) => ditherChannel(p, img.width, img.height, levels))
