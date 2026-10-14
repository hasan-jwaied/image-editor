import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Img } from '../../engine/image'
import type { Params } from '../../engine/spec'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/en'
import { frameOf } from '../../lib/frame'
import type { EngineClient } from '../../worker/client'
import type { Frame, Overlay } from '../Viewer'

const STAGES = ['smoothed', 'gradient', 'suppressed', 'edges'] as const
type Stage = (typeof STAGES)[number]

export function Thumb({ frame, label }: { frame: Frame; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = frame.width
    c.height = frame.height
    c.getContext('2d')?.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0)
  }, [frame])
  return <canvas ref={ref} className="thumb-canvas" aria-hidden="true" data-label={label} />
}

export function CannyStages({
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
  const { t } = useI18n()
  const [stages, setStages] = useState<Record<Stage, Img> | null>(null)
  const key = JSON.stringify(params)

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      client
        .request({ type: 'cannyStages', stepIndex, params })
        .then((s) => alive && setStages(s))
        .catch(() => alive && setStages(null))
    }, 120)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, stepIndex, key, input])

  return (
    <section>
      <h4 className="explain-sub">{t('explain.cannyStages')}</h4>
      {!stages ? (
        <p className="small muted">{t('explain.loading')}</p>
      ) : (
        <>
          <div className="stage-grid">
            {STAGES.map((s) => {
              const label = t(`explain.cannyStage.${s}` as MessageKey)
              const frame = frameOf(stages[s])
              const on = overlay?.label === label
              return (
                <button key={s} type="button" className={`stage-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setOverlay(on ? null : { frame, label })}>
                  <Thumb frame={frame} label={label} />
                  <span className="small">{label}</span>
                </button>
              )
            })}
          </div>
          <p className="small muted">{t('explain.cannyStageHint')}</p>
        </>
      )}
    </section>
  )
}
