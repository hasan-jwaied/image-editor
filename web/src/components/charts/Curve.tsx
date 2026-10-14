import { useState, type PointerEvent } from 'react'
import { useI18n } from '../../i18n'

const SIZE = 200
const M = 26

/** A point operation's look-up table drawn as a tone curve, identity as reference. */
export function Curve({ lut }: { lut: ArrayLike<number> }) {
  const { t } = useI18n()
  const [active, setActive] = useState<number | null>(null)
  const plot = SIZE - M - 8
  const sx = (v: number) => M + (v / 255) * plot
  const sy = (v: number) => 8 + plot - (v / 255) * plot
  let d = ''
  for (let i = 0; i < 256; i++) d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(lut[i]).toFixed(1)}`

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const scale = rect.width / SIZE
    setActive(Math.max(0, Math.min(255, Math.round((((e.clientX - rect.left) / scale - M) / plot) * 255))))
  }

  return (
    <figure className="chart curve" dir="ltr">
      <figcaption className="chart-title">{t('explain.curve')}</figcaption>
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          style={{ maxWidth: 240 }}
          role="img"
          aria-label={t('explain.curve')}
        >
          {[0, 128, 255].map((v) => (
            <g key={v}>
              <line className="grid" x1={sx(0)} x2={sx(255)} y1={sy(v)} y2={sy(v)} />
              <text className="tick" x={M - 5} y={sy(v)} dy="0.32em" textAnchor="end">
                {v}
              </text>
              <text className="tick" x={sx(v)} y={SIZE - 2} textAnchor="middle">
                {v}
              </text>
            </g>
          ))}
          <line className="reference" x1={sx(0)} y1={sy(0)} x2={sx(255)} y2={sy(255)} />
          <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
          {active !== null && (
            <>
              <line className="crosshair" x1={sx(active)} x2={sx(active)} y1={8} y2={8 + plot} />
              <circle
                cx={sx(active)}
                cy={sy(lut[active])}
                r={4}
                fill="var(--series-1)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              />
            </>
          )}
          <rect
            x={M}
            y={8}
            width={plot}
            height={plot}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        <p className="curve-readout small" aria-live="polite">
          {active !== null ? (
            <>
              {t('explain.curveIn')} <strong>{active}</strong> → {t('explain.curveOut')} <strong>{lut[active]}</strong>
            </>
          ) : (
            <span className="muted">
              {t('explain.curveIn')} → {t('explain.curveOut')}
            </span>
          )}
        </p>
      </div>
    </figure>
  )
}
