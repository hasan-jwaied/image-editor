import { fromRGBA, type Img } from '../engine/image'

export const MAX_MEGAPIXELS = 50

export class DecodeError extends Error {
  constructor(
    public readonly kind: 'decode' | 'tooLarge',
    public readonly megapixels = 0,
  ) {
    super(kind)
  }
}

/**
 * Decode any browser-supported image and fit it within `maxSide`.
 * The browser decodes the file and does the initial downscale (I/O, like
 * Pillow on the Python side); every operation after that is ours.
 */
export async function decodeImage(blob: Blob, maxSide: number): Promise<{ img: Img; original: [number, number] }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    throw new DecodeError('decode')
  }
  const { width, height } = bitmap
  const mp = (width * height) / 1e6
  if (mp > MAX_MEGAPIXELS) {
    bitmap.close()
    throw new DecodeError('tooLarge', Math.round(mp))
  }
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new DecodeError('decode')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const data = ctx.getImageData(0, 0, w, h)
  return { img: fromRGBA(data.data, w, h), original: [width, height] }
}
