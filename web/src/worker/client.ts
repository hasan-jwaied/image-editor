/**
 * Promise wrapper around the engine worker.
 *
 * Pipeline runs are "latest wins": while one run is in flight, newer requests
 * replace each other in a single pending slot. If a run blocks a newer request
 * for too long (a slider dragged during a slow seam carve), the worker is
 * terminated and restarted rather than making the user wait.
 */
import type { Img } from '../engine/image'
import type { Step } from '../engine/registry'
import type { Request, ResponseFor, WorkerMessage } from './protocol'

const STALE_AFTER_MS = 700

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  onProgress?: (stepIndex: number, fraction?: number) => void
}

export class Superseded extends Error {
  constructor() {
    super('superseded by a newer request')
  }
}

export class EngineClient {
  private worker!: Worker
  private nextId = 1
  private pending = new Map<number, Pending>()
  private source: Img | null = null
  private running: { id: number; startedAt: number } | null = null
  private queued: { steps: Step[]; pending: Pending } | null = null
  private staleTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.spawn()
  }

  private spawn() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data
      const p = this.pending.get(msg.id)
      if (!p) return
      if ('progress' in msg) {
        p.onProgress?.(msg.progress.stepIndex, msg.progress.fraction)
        return
      }
      this.pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.value)
      else p.reject(new Error(msg.error))
    }
  }

  private send<R extends Request>(req: R, onProgress?: (i: number, f?: number) => void): { id: number; promise: Promise<ResponseFor<R>> } {
    const id = this.nextId++
    const promise = new Promise<ResponseFor<R>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress })
    })
    this.worker.postMessage({ id, req })
    return { id, promise }
  }

  setSource(image: Img) {
    this.source = image
    return this.send({ type: 'setSource', image }).promise
  }

  run(steps: Step[], onProgress?: (stepIndex: number, fraction?: number) => void): Promise<ResponseFor<{ type: 'run'; steps: Step[] }>> {
    return new Promise((resolve, reject) => {
      const pending: Pending = { resolve: resolve as (v: unknown) => void, reject, onProgress }
      if (!this.running) {
        this.start(steps, pending)
        return
      }
      this.queued?.pending.reject(new Superseded())
      this.queued = { steps, pending }
      if (!this.staleTimer) {
        const wait = Math.max(0, STALE_AFTER_MS - (performance.now() - this.running.startedAt))
        this.staleTimer = setTimeout(() => this.restartIfStale(), wait)
      }
    })
  }

  private start(steps: Step[], pending: Pending) {
    const { id, promise } = this.send({ type: 'run', steps }, pending.onProgress)
    this.running = { id, startedAt: performance.now() }
    promise.then(pending.resolve, pending.reject).finally(() => {
      if (this.running?.id !== id) return
      this.running = null
      this.clearStaleTimer()
      const next = this.queued
      this.queued = null
      if (next) this.start(next.steps, next.pending)
    })
  }

  private clearStaleTimer() {
    if (this.staleTimer) clearTimeout(this.staleTimer)
    this.staleTimer = null
  }

  private restartIfStale() {
    this.staleTimer = null
    if (!this.running || !this.queued) return
    this.worker.terminate()
    for (const p of this.pending.values()) p.reject(new Superseded())
    this.pending.clear()
    this.running = null
    this.spawn()
    if (this.source) void this.setSource(this.source)
    const next = this.queued
    this.queued = null
    this.start(next.steps, next.pending)
  }

  request<R extends Exclude<Request, { type: 'run' } | { type: 'setSource' }>>(req: R) {
    return this.send(req).promise
  }

  dispose() {
    this.worker.terminate()
  }
}
