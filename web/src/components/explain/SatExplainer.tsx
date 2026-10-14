import { useMemo } from 'react'
import type { Img } from '../../engine/image'
import { integralImage, roundHalfEven } from '../../engine/math'
import { boxBlurChannel } from '../../engine/filters'
import { luma } from '../../engine/point'
import { usePointerHint } from '../../hooks/usePointerHint'
import { useI18n } from '../../i18n'

/**
 * The summed-area-table lookup behind box blur and adaptive threshold, with
 * the real table values at the window corners under the pointer.
 */
export function SatExplainer({
  input,
  hover,
  radius,
  mode,
  blurRadius = 0,
  offset = 0,
}: {
  input: Img
  hover: { x: number; y: number } | null
  radius: number
  mode: 'blur' | 'threshold'
  blurRadius?: number
  offset?: number
}) {
  const { t, num } = useI18n()
  const hint = usePointerHint()
  const { width: w, height: h } = input
  const plane = useMemo(() => {
    const g = luma(input)
    return mode === 'threshold' ? boxBlurChannel(g, w, h, blurRadius) : g
  }, [input, mode, blurRadius, w, h])
  // Blur pads with clamped edges; threshold clips the window at the border.
  const pad = mode === 'blur' ? radius : 0
  const table = useMemo(() => integralImage(plane, w, h, pad), [plane, w, h, pad])
  const stride = w + 2 * pad + 1
  const p = hover && hover.x < w && hover.y < h ? hover : null

  let detail: { A: number; B: number; C: number; D: number; sum: number; area: number; mean: number; size: string } | null = null
  if (p && radius > 0) {
    let y0: number, y1: number, x0: number, x1: number
    if (mode === 'blur') {
      ;[y0, x0] = [p.y, p.x]
      ;[y1, x1] = [p.y + 2 * radius + 1, p.x + 2 * radius + 1]
    } else {
      y0 = Math.max(0, p.y - radius)
      y1 = Math.min(h, p.y + radius + 1)
      x0 = Math.max(0, p.x - radius)
      x1 = Math.min(w, p.x + radius + 1)
    }
    const A = table[y0 * stride + x0]
    const B = table[y0 * stride + x1]
    const C = table[y1 * stride + x0]
    const D = table[y1 * stride + x1]
    const sum = D - B - C + A
    const area = (y1 - y0) * (x1 - x0)
    detail = { A, B, C, D, sum, area, mean: sum / area, size: `${x1 - x0} × ${y1 - y0}` }
  }

  const value = p ? plane[p.y * w + p.x] : 0

  return (
    <div className="sat">
      <h4 className="explain-sub">{t('explain.satTitle')}</h4>
      <div className="sat-body">
        <svg viewBox="0 0 150 120" className="sat-diagram" aria-hidden="true">
          <rect x="4" y="4" width="142" height="112" className="sat-image" />
          <rect x="4" y="4" width="98" height="78" className="sat-prefix" />
          <rect x="50" y="38" width="52" height="44" className="sat-window" />
          {[
            ['A', 50, 38],
            ['B', 102, 38],
            ['C', 50, 82],
            ['D', 102, 82],
          ].map(([l, x, y]) => (
            <g key={l as string}>
              <circle cx={x as number} cy={y as number} r="3.5" className="sat-dot" />
              <text x={(x as number) + ((l as string) === 'A' || (l as string) === 'C' ? -11 : 6)} y={(y as number) + ((l as string) < 'C' ? -4 : 12)} className="sat-label">
                {l}
              </text>
            </g>
          ))}
        </svg>
        <p className="small">{t('explain.satBody')}</p>
      </div>
      {detail ? (
        <dl className="sat-values small" dir="ltr">
          {(['A', 'B', 'C', 'D'] as const).map((k) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{num(detail[k], 0)}</dd>
            </div>
          ))}
          <div className="wide">
            <dt>Σ</dt>
            <dd>
              D − B − C + A = <strong>{num(detail.sum, 0)}</strong>
            </dd>
          </div>
          <div className="wide">
            <dt>μ</dt>
            <dd>
              {t('explain.satMean', { sum: num(detail.sum, 0), area: num(detail.area, 0), mean: num(detail.mean, 2) })}
              {mode === 'blur' ? (
                <>
                  {' '}
                  → <strong>{roundHalfEven(detail.mean)}</strong>
                </>
              ) : (
                <>
                  {' '}
                  · {value} {value < detail.mean - offset ? '<' : '≥'} {num(detail.mean - offset, 1)} →{' '}
                  <strong>{value < detail.mean - offset ? 0 : 255}</strong>
                </>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="small muted">{t(hint)}</p>
      )}
    </div>
  )
}
