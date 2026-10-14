import type { Img } from '../engine/image'
import type { Step } from '../engine/registry'
import type { Params } from '../engine/spec'

export interface StepResult {
  /** A disabled step passes its input through. */
  image: Img
  ms: number
}

export interface RaceResult {
  image: [number, number]
  radii: number[]
  ms: { naive: (number | null)[]; separable: number[]; sat: number[] }
}

export interface SeamTraceResult {
  input: Img
  seams: Int32Array[]
  energy: Uint8Array
}

export type Request =
  | { type: 'setSource'; image: Img }
  | { type: 'run'; steps: Step[] }
  | { type: 'cannyStages'; stepIndex: number; params: Params }
  | { type: 'seamTrace'; stepIndex: number; widthPercent: number }
  | { type: 'race'; stepIndex: number }

export type ResponseFor<R extends Request> = R extends { type: 'run' }
  ? { fromIndex: number; results: StepResult[] }
  : R extends { type: 'cannyStages' }
    ? { smoothed: Img; gradient: Img; suppressed: Img; edges: Img }
    : R extends { type: 'seamTrace' }
      ? SeamTraceResult
      : R extends { type: 'race' }
        ? RaceResult
        : null

export type WorkerMessage =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: { stepIndex: number; fraction?: number } }
