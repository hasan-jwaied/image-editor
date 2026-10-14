import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useI18n } from '../../i18n'
import { useWidth } from './useWidth'

export interface Series {
  id: string
  label: string
  /** CSS color, normally a var(--series-n) token. */
  color: string
  values: (number | null)[]
}

interface Props {
  title?: string
  x: number[]
  xLabel: string
  yLabel: string
  series: Series[]
  formatY: (v: number) => string
  height?: number
  /** Share one y-domain across small multiples. */
  yDomain?: [number, number]
}

const M = { top: 10, right: 12, bottom: 34, left: 54 }

/** Line chart with a log10 y-axis, crosshair tooltip, legend and table view. */
export function LineChart({ title, x, xLabel, yLabel, series, formatY, height = 220, yDomain }: Props) {
  const { t, num } = useI18n()
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const titleId = useId()

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && v > 0))
  const [lo, hi] = yDomain ?? [
    10 ** Math.floor(Math.log10(Math.min(...all))),
    10 ** Math.ceil(Math.log10(Math.max(...all))),
  ]
  const ticks: number[] = []
  for (let v = lo; v <= hi * 1.0001; v *= 10) ticks.push(v)

  // Direct end labels need room on the inline end; drop them on narrow screens (legend remains).
  const endLabels = width >= 420
  const right = endLabels ? 132 : M.right
  const plotW = width - M.left - right
  const plotH = height - M.top - M.bottom
  const xMin = x[0]
  const xMax = x[x.length - 1]
  const sx = (v: number) => M.left + ((v - xMin) / (xMax - xMin)) * plotW
  const sy = (v: number) => M.top + plotH - ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * plotH

  const paths = series.map((s) => {
    let d = ''
    s.values.forEach((v, i) => {
      if (v === null || v <= 0) return
      d += `${d ? 'L' : 'M'}${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}`
    })
    return d
  })

  // End labels at each series' last point, nudged apart only enough to avoid overlap.
  const labels = series
    .map((s) => {
      const last = s.values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1)
      return { s, i: last, y: last >= 0 ? sy(s.values[last]!) : 0 }
    })
    .filter((l) => l.i >= 0)
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < labels.length; k++) labels[k].y = Math.max(labels[k].y, labels[k - 1].y + 14)

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left
    let best = 0
    x.forEach((v, i) => {
      if (Math.abs(sx(v) - px) < Math.abs(sx(x[best]) - px)) best = i
    })
    return best
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()))
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const d = e.key === 'ArrowRight' ? 1 : -1
      setActive((a) => Math.min(x.length - 1, Math.max(0, (a ?? (d > 0 ? -1 : x.length)) + d)))
    } else if (e.key === 'Escape') setActive(null)
  }

  const tipLeft = active !== null ? sx(x[active]) : 0
  const flip = active !== null && tipLeft > width * 0.6

  return (
    <figure className="chart" ref={wrapRef} dir="ltr">
      {title && (
        <figcaption id={titleId} className="chart-title">
          {title}
        </figcaption>
      )}
      {series.length > 1 && (
        <ul className="legend" role="list">
          {series.map((s) => (
            <li key={s.id}>
              <span className="line-key" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="chart-plot">
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : yLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid" x1={M.left} x2={M.left + plotW} y1={sy(v)} y2={sy(v)} />
              <text className="tick" x={M.left - 8} y={sy(v)} dy="0.32em" textAnchor="end">
                {formatY(v)}
              </text>
            </g>
          ))}
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} />
          {x.map((v) => (
            <text key={v} className="tick" x={sx(v)} y={M.top + plotH + 16} textAnchor="middle">
              {num(v, 0)}
            </text>
          ))}
          <text className="axis-label" x={M.left + plotW / 2} y={height - 2} textAnchor="middle">
            {xLabel}
          </text>
          {active !== null && <line className="crosshair" x1={sx(x[active])} x2={sx(x[active])} y1={M.top} y2={M.top + plotH} />}
          {series.map((s, k) => (
            <g key={s.id}>
              <path d={paths[k]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={sx(x[i])}
                    cy={sy(v)}
                    r={active === i ? 5 : 3.5}
                    fill={s.color}
                    stroke="var(--chart-surface)"
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          ))}
          {endLabels &&
            labels.map(({ s, i, y }) => (
              <text key={s.id} className="end-label" x={sx(x[i]) + 10} y={y} dy="0.32em">
                {s.label.split('  ')[0]}
              </text>
            ))}
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
          <div className="tooltip" style={{ left: tipLeft, top: M.top, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }} role="status">
            <div className="tooltip-head">
              {xLabel}: {num(x[active], 0)}
            </div>
            {series.map((s) => (
              <div key={s.id} className="tooltip-row">
                <span className="line-key" style={{ background: s.color }} />
                <strong>{s.values[active] === null ? '—' : formatY(s.values[active]!)}</strong>
                <span className="muted">{s.label.split('  ')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="sr-only">{yLabel}</span>
      <button type="button" className="text-btn small" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? t('explain.hideTable') : t('explain.showTable')}
      </button>
      {showTable && (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {x.map((v, i) => (
              <tr key={v}>
                <th scope="row">{num(v, 0)}</th>
                {series.map((s) => (
                  <td key={s.id}>{s.values[i] === null ? '—' : formatY(s.values[i]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
