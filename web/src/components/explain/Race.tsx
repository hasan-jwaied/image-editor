import { useState } from 'react'
import { useI18n } from '../../i18n'
import { blurSeries } from '../../lib/blurSeries'
import { formatMs } from '../../lib/labels'
import type { EngineClient } from '../../worker/client'
import type { RaceResult } from '../../worker/protocol'
import { LineChart } from '../charts/LineChart'
import { Play } from '../Icons'

export function Race({ client, stepIndex }: { client: EngineClient; stepIndex: number }) {
  const { t, num } = useI18n()
  const [result, setResult] = useState<RaceResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      setResult(await client.request({ type: 'race', stepIndex }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="race" aria-labelledby="race-title">
      <div className="race-head">
        <h4 id="race-title" className="explain-sub">
          {t('explain.raceTitle')}
        </h4>
        <button type="button" className="btn sm primary" onClick={run} disabled={running}>
          <Play /> {running ? t('explain.raceRunning') : t('explain.raceRun')}
        </button>
      </div>
      {error && <p className="small error-text">{error}</p>}
      {result && (
        <>
          <LineChart
            x={result.radii}
            xLabel={t('explain.radius')}
            yLabel={t('explain.time')}
            formatY={(v) => formatMs(num, v)}
            series={blurSeries(t, result.ms)}
            height={200}
          />
          <p className="small muted">{t('explain.raceNote', { w: result.image[0], h: result.image[1] })}</p>
        </>
      )}
    </section>
  )
}
