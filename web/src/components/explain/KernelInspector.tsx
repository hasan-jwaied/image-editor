import { useMemo } from 'react'
import type { Img } from '../../engine/image'
import { roundHalfEven } from '../../engine/math'
import { luma } from '../../engine/point'
import { usePointerHint } from '../../hooks/usePointerHint'
import { useI18n } from '../../i18n'

export type Kernel = number[][]

function fmtWeight(w: number, num: (n: number, d?: number) => string) {
  if (Number.isInteger(w)) return String(w)
  for (const den of [9, 16, 25, 8, 4, 2]) {
    const n = w * den
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${den}`
  }
  return num(w, 3)
}

export function KernelInspector({
  input,
  hover,
  kernels,
  combine,
}: {
  input: Img
  hover: { x: number; y: number } | null
  kernels: { name?: string; kernel: Kernel }[]
  /** Default: clamp(round(sum)). */
  combine?: (sums: number[]) => { label: string; value: number }
}) {
  const { t, num } = useI18n()
  const hint = usePointerHint()
  const plane = useMemo(() => luma(input), [input])
  const { width: w, height: h } = input
  const p = hover && hover.x < w && hover.y < h ? hover : null

  const size = kernels[0].kernel.length
  const pad = size >> 1
  const flipped = kernels.map((k) => k.kernel.map((row) => row.slice().reverse()).reverse())
  const neighborhood = p
    ? Array.from({ length: size }, (_, dy) =>
        Array.from({ length: size }, (_, dx) => {
          const yy = Math.min(h - 1, Math.max(0, p.y + dy - pad))
          const xx = Math.min(w - 1, Math.max(0, p.x + dx - pad))
          return plane[yy * w + xx]
        }),
      )
    : null
  const sums = neighborhood
    ? flipped.map((k) => k.reduce((acc, row, dy) => row.reduce((a, wt, dx) => a + wt * neighborhood[dy][dx], acc), 0))
    : []
  const out = combine
    ? sums.length
      ? combine(sums)
      : null
    : sums.length
      ? { label: t('explain.result'), value: Math.min(255, Math.max(0, roundHalfEven(sums[0]))) }
      : null

  return (
    <div className="kernel-inspector">
      <p className="small muted">{p ? t('explain.at', { x: p.x, y: p.y }) : t(hint)}</p>
      <div className="kernel-grids" dir="ltr">
        <div>
          <div className="grid-label small">{t('explain.neighborhood')}</div>
          <div className="matrix" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size * size }, (_, i) => {
              const v = neighborhood?.[Math.floor(i / size)][i % size]
              return (
                <span
                  key={i}
                  className="cell px"
                  style={
                    v !== undefined
                      ? { background: `rgb(${v},${v},${v})`, color: v > 140 ? '#111' : '#fff' }
                      : undefined
                  }
                >
                  {v ?? '·'}
                </span>
              )
            })}
          </div>
        </div>
        {flipped.map((k, idx) => (
          <div key={idx}>
            <div className="grid-label small">{kernels[idx].name ?? t('explain.weights')}</div>
            <div className="matrix" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
              {k.flat().map((wt, i) => (
                <span key={i} className={`cell w${wt > 0 ? ' pos' : wt < 0 ? ' neg' : ''}`}>
                  {fmtWeight(wt, num)}
                </span>
              ))}
            </div>
            {sums.length > 0 && (
              <div className="sum small">
                Σ = <strong>{num(sums[idx], 2)}</strong>
              </div>
            )}
          </div>
        ))}
      </div>
      {out && (
        <p className="kernel-out">
          {out.label}: <strong dir="ltr">{out.value}</strong>
        </p>
      )}
      <p className="small muted">{t('explain.kernelNote')}</p>
    </div>
  )
}
