import { useState, type PointerEvent } from 'react'
import { useI18n } from '../../i18n'
import { Tooltip } from './Tooltip'
import { useWidth } from './useWidth'

const M = { top: 6, right: 8, bottom: 20, left: 8 }

export function Histogram({
  title,
  counts,
  height = 96,
}: {
  title: string
  counts: ArrayLike<number>
  height?: number
}) {
  const { t, num } = useI18n()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const plotW = width - M.left - M.right
  const plotH = height - M.top - M.bottom
  let max = 1
  for (let i = 0; i < 256; i++) max = Math.max(max, counts[i])
  const sx = (i: number) => M.left + (i / 255) * plotW
  const sy = (v: number) => M.top + plotH - (v / max) * plotH

  let line = ''
  for (let i = 0; i < 256; i++) line += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(counts[i]).toFixed(1)}`
  const area = `${line}L${sx(255)},${M.top + plotH}L${sx(0)},${M.top + plotH}Z`

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    setActive(Math.max(0, Math.min(255, Math.round(((e.clientX - rect.left - M.left) / plotW) * 255))))
  }

  return (
    <figure className="chart compact" ref={ref} dir="ltr">
      <figcaption className="chart-title">{title}</figcaption>
      <div className="chart-plot">
        <svg width={width} height={height} role="img" aria-label={title}>
          <path d={area} fill="var(--series-1)" opacity={0.12} />
          <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={1.5} strokeLinejoin="round" />
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} />
          {[0, 128, 255].map((v) => (
            <text
              key={v}
              className="tick"
              x={sx(v)}
              y={height - 5}
              textAnchor={v === 0 ? 'start' : v === 255 ? 'end' : 'middle'}
            >
              {v}
            </text>
          ))}
          {active !== null && (
            <line className="crosshair" x1={sx(active)} x2={sx(active)} y1={M.top} y2={M.top + plotH} />
          )}
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {active !== null && (
          <Tooltip x={sx(active)} flip={active > 160}>
            <div className="tooltip-row">
              <strong>{num(counts[active], 0)}</strong>
              <span className="muted">
                {t('explain.count')} · {t('explain.level')} {active}
              </span>
            </div>
          </Tooltip>
        )}
      </div>
    </figure>
  )
}
