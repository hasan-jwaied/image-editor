import { useEffect, useRef, useState } from 'react'
import type { Img } from '../../engine/image'
import type { Params } from '../../engine/spec'
import { useI18n } from '../../i18n'
import { frameOf, grayFrame } from '../../lib/frame'
import type { EngineClient } from '../../worker/client'
import type { SeamTraceResult } from '../../worker/protocol'
import type { Frame, Overlay } from '../Viewer'
import { Play } from '../Icons'

const SEAM_RGB = [227, 73, 72] // red series step; marks are the only colored thing here

function paintSeams(base: Frame, seams: Int32Array[], count: number): Frame {
  const rgba = new Uint8ClampedArray(base.rgba)
  const w = base.width
  for (let k = 0; k < count; k++) {
    const seam = seams[k]
    for (let y = 0; y < seam.length; y++) {
      const j = (y * w + seam[y]) * 4
      rgba[j] = SEAM_RGB[0]
      rgba[j + 1] = SEAM_RGB[1]
      rgba[j + 2] = SEAM_RGB[2]
      rgba[j + 3] = 255
    }
  }
  return { width: base.width, height: base.height, rgba }
}

export function SeamExplainer({
  client,
  stepIndex,
  params,
  input,
  overlay,
  setOverlay,
}: {
  client: EngineClient
  stepIndex: number
  params: Params
  input: Img
  overlay: Overlay | null
  setOverlay: (o: Overlay | null) => void
}) {
  const { t, num } = useI18n()
  const [trace, setTrace] = useState<SeamTraceResult | null>(null)
  const animRef = useRef(0)
  const seamLabel = t('explain.seamOverlay')
  const energyLabel = t('explain.seamEnergy')

  useEffect(() => {
    let alive = true
    setTrace(null)
    const timer = window.setTimeout(() => {
      client
        .request({ type: 'seamTrace', stepIndex, params })
        .then((r) => alive && setTrace(r))
        .catch(() => alive && setTrace(null))
    }, 150)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [client, stepIndex, params.width_percent, input]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  const showSeams = () => trace && setOverlay({ frame: paintSeams(frameOf(trace.input), trace.seams, trace.seams.length), label: seamLabel })
  const showEnergy = () => trace && setOverlay({ frame: grayFrame(trace.energy, trace.input.width, trace.input.height), label: energyLabel })

  const replay = () => {
    if (!trace) return
    cancelAnimationFrame(animRef.current)
    const base = frameOf(trace.input)
    const total = trace.seams.length
    const duration = Math.min(2400, 400 + total * 12)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    const tick = (now: number) => {
      const k = reduced ? total : Math.min(total, Math.round(((now - start) / duration) * total))
      setOverlay({ frame: paintSeams(base, trace.seams, k), label: seamLabel })
      if (k < total) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  return (
    <section>
      <div className="button-row">
        <button type="button" className={`btn sm${overlay?.label === seamLabel ? ' on' : ''}`} onClick={() => (overlay?.label === seamLabel ? setOverlay(null) : showSeams())} disabled={!trace} aria-pressed={overlay?.label === seamLabel}>
          {t('explain.seamShow')}
        </button>
        <button type="button" className={`btn sm${overlay?.label === energyLabel ? ' on' : ''}`} onClick={() => (overlay?.label === energyLabel ? setOverlay(null) : showEnergy())} disabled={!trace} aria-pressed={overlay?.label === energyLabel}>
          {energyLabel}
        </button>
        <button type="button" className="btn sm" onClick={replay} disabled={!trace || !trace.seams.length}>
          <Play /> {t('explain.seamAnimate')}
        </button>
      </div>
      <p className="small muted">
        {trace ? `${t('explain.seamCount', { n: num(trace.seams.length, 0) })} · ` : `${t('explain.loading')} `}
        {t('explain.seamNote')}
      </p>
      <pre className="formula" dir="ltr">
        M[y][x] = e[y][x] + min(M[y−1][x−1], M[y−1][x], M[y−1][x+1])
      </pre>
    </section>
  )
}
