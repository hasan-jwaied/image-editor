/// <reference lib="webworker" />
// Caches each step's output, so editing step k only reruns steps k..n.
import { cannyStages } from '../engine/edges'
import { boxBlurChannel, boxBlurNaiveChannel, gaussianChannel } from '../engine/filters'
import { resizeTo } from '../engine/geometry'
import { makeImg, type Img } from '../engine/image'
import { luma } from '../engine/point'
import { applyStep, type Step } from '../engine/registry'
import { energyMap, progress, seamCarveTrace } from '../engine/seam'
import type { Request, StepResult, WorkerMessage } from './protocol'

declare const self: DedicatedWorkerGlobalScope

let source: Img | null = null
let cache: { key: string; result: StepResult }[] = []

const post = (msg: WorkerMessage) => self.postMessage(msg)

function inputOf(stepIndex: number): Img {
  if (!source) throw new Error('no image loaded')
  if (stepIndex === 0) return source
  const entry = cache[stepIndex - 1]
  if (!entry) throw new Error('step has not been computed yet')
  return entry.result.image
}

function run(id: number, steps: Step[]) {
  if (!source) throw new Error('no image loaded')
  let key = ''
  let fromIndex = steps.length
  const keys = steps.map((s) => (key += JSON.stringify([s.op, s.params, s.enabled !== false]) + '|'))
  for (let i = 0; i < steps.length; i++) {
    if (cache[i]?.key !== keys[i]) {
      fromIndex = i
      break
    }
  }
  cache.length = Math.min(cache.length, fromIndex)
  const results: StepResult[] = []
  let current = inputOf(fromIndex)
  for (let i = fromIndex; i < steps.length; i++) {
    post({ id, progress: { stepIndex: i } })
    let lastPost = 0
    progress.report = (fraction) => {
      const now = performance.now()
      if (now - lastPost < 80) return
      lastPost = now
      post({ id, progress: { stepIndex: i, fraction } })
    }
    const t = performance.now()
    let image: Img
    try {
      image = steps[i].enabled === false ? current : applyStep(current, steps[i])
    } finally {
      progress.report = null
    }
    const result = { image, ms: steps[i].enabled === false ? 0 : performance.now() - t }
    cache[i] = { key: keys[i], result }
    results.push(result)
    current = image
  }
  return { fromIndex, results }
}

function time(fn: () => unknown): number {
  const t = performance.now()
  fn()
  return Math.round((performance.now() - t) * 10) / 10
}

function race(stepIndex: number) {
  let img = inputOf(stepIndex)
  const longest = Math.max(img.width, img.height)
  if (longest > 512) {
    const s = 512 / longest
    img = resizeTo(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)))
  }
  const p = luma(img)
  const { width: w, height: h } = img
  const radii = [1, 2, 4, 7, 12, 20]
  const ms = { naive: [] as (number | null)[], separable: [] as number[], sat: [] as number[] }
  boxBlurChannel(p, w, h, 2) // warm-up
  for (const r of radii) {
    ms.naive.push(r <= 12 ? time(() => boxBlurNaiveChannel(p, w, h, r)) : null)
    ms.separable.push(time(() => gaussianChannel(p, w, h, r / 3)))
    ms.sat.push(time(() => boxBlurChannel(p, w, h, r)))
  }
  return { image: [w, h] as [number, number], radii, ms }
}

function normalized(values: Int32Array): Uint8Array {
  let max = 1
  for (const v of values) if (v > max) max = v
  const out = new Uint8Array(values.length)
  // square root so faint texture stays visible next to strong edges
  for (let i = 0; i < values.length; i++) out[i] = Math.round(255 * Math.sqrt(values[i] / max))
  return out
}

function handle(id: number, req: Request): unknown {
  switch (req.type) {
    case 'setSource':
      source = req.image
      cache = []
      return null
    case 'run':
      return run(id, req.steps)
    case 'cannyStages': {
      const input = inputOf(req.stepIndex)
      const s = cannyStages(input, req.params.sigma as number, req.params.low as number, req.params.high as number)
      const wrap = (p: Uint8Array) => makeImg(input.width, input.height, [p])
      return {
        smoothed: wrap(s.smoothed),
        gradient: wrap(s.gradient),
        suppressed: wrap(s.suppressed),
        edges: wrap(s.edges),
      }
    }
    case 'seamTrace': {
      const input = inputOf(req.stepIndex)
      const { seams } = seamCarveTrace(input, req.widthPercent, 0, true)
      const energy = normalized(energyMap(luma(input), input.width, input.height))
      return { input, seams, energy }
    }
    case 'race':
      return race(req.stepIndex)
  }
}

self.onmessage = (event: MessageEvent<{ id: number; req: Request }>) => {
  const { id, req } = event.data
  try {
    post({ id, ok: true, value: handle(id, req) })
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
