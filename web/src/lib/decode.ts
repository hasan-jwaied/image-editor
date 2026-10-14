import { fromRGBA, type Img } from '../engine/image'

const MAX_MEGAPIXELS = 50

export class DecodeError extends Error {
  constructor(
    public readonly kind: 'decode' | 'tooLarge',
    public readonly megapixels = 0,
  ) {
    super(kind)
  }
}

type Source = { draw: CanvasImageSource; width: number; height: number; release: () => void }

/** createImageBitmap where available; an <img> element on older Safari. */
async function load(blob: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return { draw: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      /* unsupported option or format: fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new DecodeError('decode')
  }
  return { draw: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

/**
 * Decode any browser-supported image and fit it within `maxSide`.
 * The browser decodes the file and does the initial downscale (I/O, like
 * Pillow on the Python side); every operation after that is ours.
 */
export async function decodeImage(blob: Blob, maxSide: number): Promise<{ img: Img; original: [number, number] }> {
  const source = await load(blob)
  const { width, height } = source
  const mp = (width * height) / 1e6
  if (!width || !height) {
    source.release()
    throw new DecodeError('decode')
  }
  if (mp > MAX_MEGAPIXELS) {
    source.release()
    throw new DecodeError('tooLarge', Math.round(mp))
  }
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    source.release()
    throw new DecodeError('decode')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source.draw, 0, 0, w, h)
  source.release()
  const data = ctx.getImageData(0, 0, w, h)
  return { img: fromRGBA(data.data, w, h), original: [width, height] }
}
