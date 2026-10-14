import type { Img } from '../../engine/image'
import type { Params } from '../../engine/spec'
import { useFrameCanvas } from '../../hooks/useFrameCanvas'
import { useWorkerResult } from '../../hooks/useWorkerResult'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/en'
import { frameOf } from '../../lib/frame'
import type { EngineClient } from '../../worker/client'
import type { Frame, Overlay } from '../Viewer'

const STAGES = ['smoothed', 'gradient', 'suppressed', 'edges'] as const

function Thumb({ frame }: { frame: Frame }) {
  return <canvas ref={useFrameCanvas(frame)} className="thumb-canvas" aria-hidden="true" />
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
  const stages = useWorkerResult(
    () => client.request({ type: 'cannyStages', stepIndex, params }),
    JSON.stringify([stepIndex, params]),
    input,
  )

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
                <button
                  key={s}
                  type="button"
                  className={`stage-btn${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setOverlay(on ? null : { frame, label })}
                >
                  <Thumb frame={frame} />
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
