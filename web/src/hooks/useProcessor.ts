import { useEffect, useRef, useState } from 'react'
import type { Img } from '../engine/image'
import type { StepState } from '../state/pipeline'
import { Superseded, type EngineClient } from '../worker/client'

export interface Processed {
  /** May lag behind `steps` while busy. */
  images: Img[]
  ms: number[]
  keys: string[]
  currentKeys: string[]
  runningIndex: number | null
  fraction: number | null
  busy: boolean
  error: string | null
}

function cumulativeKeys(steps: StepState[]): string[] {
  let key = ''
  return steps.map((s) => (key += JSON.stringify([s.op, s.params, s.enabled]) + '|'))
}

export function useProcessor(client: EngineClient, source: Img | null, steps: StepState[]): Processed {
  const [state, setState] = useState<Omit<Processed, 'currentKeys'>>({
    images: [],
    ms: [],
    keys: [],
    runningIndex: null,
    fraction: null,
    busy: false,
    error: null,
  })
  const sourceRef = useRef<Img | null>(null)
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const currentKeys = cumulativeKeys(steps)
  const signature = currentKeys[currentKeys.length - 1] ?? ''

  useEffect(() => {
    if (!source) return
    let cancelled = false
    const sourceChanged = sourceRef.current !== source
    sourceRef.current = source
    const steps = stepsRef.current
    const requestKeys = cumulativeKeys(steps)
    const payload = steps.map((s) => ({ op: s.op, params: s.params, enabled: s.enabled }))

    setState((s) => ({
      ...(sourceChanged ? { images: [], ms: [], keys: [] } : s),
      runningIndex: null,
      fraction: null,
      busy: true,
      error: null,
    }))
    const start = sourceChanged ? client.setSource(source) : Promise.resolve(null)
    start
      .then(() =>
        client.run(payload, (i, fraction) => {
          if (!cancelled) setState((s) => ({ ...s, runningIndex: i, fraction: fraction ?? null }))
        }),
      )
      .then(({ fromIndex, results }) => {
        setState((s) => {
          const images = [...s.images.slice(0, fromIndex), ...results.map((r) => r.image)]
          const ms = [...s.ms.slice(0, fromIndex), ...results.map((r) => r.ms)]
          const keys = [...s.keys.slice(0, fromIndex), ...requestKeys.slice(fromIndex)]
          return { images, ms, keys, runningIndex: null, fraction: null, busy: cancelled ? s.busy : false, error: null }
        })
      })
      .catch((err: unknown) => {
        if (err instanceof Superseded || cancelled) return
        setState((s) => ({
          ...s,
          busy: false,
          runningIndex: null,
          fraction: null,
          error: err instanceof Error ? err.message : String(err),
        }))
      })
    return () => {
      cancelled = true
    }
  }, [client, source, signature])

  return { ...state, currentKeys }
}
