import type { MessageKey } from '../i18n/en'
import type { Params } from '../engine/spec'

export interface Sample {
  id: 'tower' | 'aldrin' | 'wave'
  label: MessageKey
  src: string
  thumb: string
}

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const SAMPLES: Sample[] = [
  { id: 'tower', label: 'sample.tower', src: url('samples/tower.webp'), thumb: url('samples/tower-thumb.webp') },
  { id: 'aldrin', label: 'sample.aldrin', src: url('samples/aldrin.webp'), thumb: url('samples/aldrin-thumb.webp') },
  { id: 'wave', label: 'sample.wave', src: url('samples/wave.webp'), thumb: url('samples/wave-thumb.webp') },
]

interface Preset {
  id: string
  label: MessageKey
  steps: { op: string; params?: Params }[]
}

export const PRESETS: Preset[] = [
  { id: 'squeeze', label: 'recipe.squeeze', steps: [{ op: 'seam_carve', params: { width_percent: 30 } }] },
  { id: 'edges', label: 'recipe.edges', steps: [{ op: 'canny' }] },
  { id: 'sketch', label: 'recipe.sketch', steps: [{ op: 'adaptive_threshold' }] },
  {
    id: 'newsprint',
    label: 'recipe.newsprint',
    steps: [{ op: 'grayscale' }, { op: 'equalize' }, { op: 'dither', params: { levels: 2 } }],
  },
  {
    id: 'comic',
    label: 'recipe.comic',
    steps: [
      { op: 'gaussian_blur', params: { sigma: 1.2 } },
      { op: 'posterize', params: { levels: 5 } },
      { op: 'sharpen' },
    ],
  },
  {
    id: 'vintage',
    label: 'recipe.vintage',
    steps: [{ op: 'sepia' }, { op: 'contrast', params: { amount: 15 } }, { op: 'dither', params: { levels: 12 } }],
  },
]
