import { useState } from 'react'
import { useI18n } from '../../i18n'
import { Tooltip } from './Tooltip'
import { useWidth } from './useWidth'

export function WeightsChart({ title, weights }: { title: string; weights: ArrayLike<number> }) {
  const { t, num } = useI18n()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const n = weights.length
  const radius = (n - 1) / 2
  const height = 110
  const plotH = height - 26
  let max = 0
  for (let i = 0; i < n; i++) max = Math.max(max, weights[i])
  const band = width / n
  const barW = Math.max(2, Math.min(24, band - 2))

  return (
    <figure className="chart compact" ref={ref} dir="ltr">
      <figcaption className="chart-title">{title}</figcaption>
      <div className="chart-plot">
        <svg width={width} height={height} role="img" aria-label={title}>
          <line className="axis" x1={0} x2={width} y1={plotH + 4} y2={plotH + 4} />
          {Array.from({ length: n }, (_, i) => {
            const h = Math.max(1, (weights[i] / max) * plotH)
            const x = i * band + (band - barW) / 2
            const y = plotH + 4 - h
            const r = Math.min(4, barW / 2, h)
            return (
              <g key={i} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}>
                <rect x={i * band} y={0} width={band} height={height} fill="transparent" />
                <path
                  d={`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${y + h}Z`}
                  fill="var(--series-1)"
                  opacity={active === null || active === i ? 1 : 0.55}
                />
              </g>
            )
          })}
          {[0, radius, n - 1].map((i) => (
            <text key={i} className="tick" x={i * band + band / 2} y={height - 4} textAnchor="middle">
              {i - radius > 0 ? `+${i - radius}` : i - radius}
            </text>
          ))}
        </svg>
        {active !== null && (
          <Tooltip x={active * band + band / 2} flip={active > n / 2}>
            <div className="tooltip-row">
              <strong>{num(weights[active], 4)}</strong>
              <span className="muted">
                {t('explain.weight')} · {t('explain.offset')} {active - radius}
              </span>
            </div>
          </Tooltip>
        )}
      </div>
    </figure>
  )
}
