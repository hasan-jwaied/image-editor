import type { ReactNode } from 'react'
import pyBench from '../../../bench/python.json'
import tsBench from '../../../bench/typescript.json'
import golden from '../../../spec/golden/summary.json'
import { SPEC } from '../engine/spec'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/en'
import { PWA } from '../lib/config'
import { formatMs, opLabel } from '../lib/labels'
import { LineChart } from './charts/LineChart'
import { REPO_URL } from './Header'
import { Github } from './Icons'

/**
 * The "How it's built" case study, laid out like the portfolio's project
 * pages: highlight cards with real numbers, then sections with a short label
 * on the inline start and the content beside it.
 */
function Section({ id, label, title, children }: { id: string; label: MessageKey; title: MessageKey; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <section className="case-section" aria-labelledby={id}>
      <p className="case-label">{t(label)}</p>
      <div className="case-body">
        <h3 id={id}>{t(title)}</h3>
        {children}
      </div>
    </section>
  )
}

export function Article() {
  const { t, has, num } = useI18n()
  const radii = pyBench.blur.radii
  const r7 = radii.indexOf(7)
  const [bw, bh] = pyBench.blur.image
  const fmt = (v: number) => formatMs(num, v)
  const v1Seconds = (pyBench.blur.ms.v1[r7] ?? 0) / 1000
  const satPy = Math.round(pyBench.blur.ms.sat.reduce((a, b) => a + (b ?? 0), 0) / radii.length)
  const satTs = Math.round(tsBench.blur.ms.sat.reduce((a, b) => a + b, 0) / radii.length)
  const domain: [number, number] = [10, 100_000]

  const highlights: { value: string; label: MessageKey }[] = [
    { value: `${num(v1Seconds, 1)} s → ${num(tsBench.blur.ms.sat[r7], 0)} ms`, label: 'how.hl.blur' },
    { value: num(golden.cases, 0), label: 'how.hl.golden' },
    { value: num(golden.operations, 0), label: 'how.hl.algos' },
    { value: '3', label: 'how.hl.langs' },
  ]

  // Three series at most: with all lines on screen at once, a fourth colour
  // can't stay distinguishable for colour-blind readers (validated palette).
  const series = (bench: typeof pyBench.blur.ms | typeof tsBench.blur.ms) => [
    { id: 'sat', label: t('explain.raceSat'), color: 'var(--series-1)', values: bench.sat },
    { id: 'separable', label: t('explain.raceSeparable'), color: 'var(--series-2)', values: bench.separable },
    { id: 'naive', label: t('explain.raceNaive'), color: 'var(--series-3)', values: bench.naive },
  ]

  return (
    <article id="how" className="article" aria-labelledby="how-title">
      <header className="article-head">
        <p className="eyebrow">{t('app.name')}</p>
        <h2 id="how-title">{t('how.title')}</h2>
        <p className="lead">{t('how.lead')}</p>
      </header>

      <ul className="highlights" role="list">
        {highlights.map((h) => (
          <li key={h.label} className="glass highlight">
            <p className="highlight-value" dir="ltr">
              {h.value}
            </p>
            <p className="highlight-label">{t(h.label)}</p>
          </li>
        ))}
      </ul>

      <Section id="s1" label="how.s1.label" title="how.s1.title">
        <p>{t('how.s1.p1', { mp: num((bw * bh) / 1e6, 2), v1: num(v1Seconds, 1) })}</p>
        <p>{t('how.s1.p2', { sat: num(satPy, 0), satTs: num(satTs, 0) })}</p>
        <div className="small-multiples glass">
          <LineChart
            title={t('how.chartPython')}
            x={radii}
            xLabel={t('explain.radius')}
            yLabel={t('explain.time')}
            formatY={fmt}
            yDomain={domain}
            series={series(pyBench.blur.ms)}
          />
          <LineChart
            title={t('how.chartTs')}
            x={radii}
            xLabel={t('explain.radius')}
            yLabel={t('explain.time')}
            formatY={fmt}
            yDomain={domain}
            series={series(tsBench.blur.ms)}
          />
        </div>
        <p className="caption">
          {t('how.chartCaption', { w: bw, h: bh })} {t('how.chartNoteV1', { v1: num(v1Seconds, 1) })}
        </p>
      </Section>

      <Section id="s2" label="how.s2.label" title="how.s2.title">
        <p>{t('how.s2.p1', { cases: golden.cases })}</p>
        <p>{t('how.s2.p2')}</p>
        <pre className="code-block" dir="ltr" tabIndex={0}>
          <code>{`function roundHalfEven(x: number): number {
  const r = Math.round(x) // rounds halves toward +Infinity
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r
}`}</code>
        </pre>
      </Section>

      <Section id="s3" label="how.s3.label" title="how.s3.title">
        <p>{t('how.s3.p1')}</p>
        <figure className="flow glass" aria-label={t('how.diagram.caption')}>
          <div className="flow-lane">
            <span className="flow-node">{t('how.diagram.registry')}</span>
            <span className="flow-arrow" aria-hidden="true" />
            <code className="flow-node file">{t('how.diagram.spec')}</code>
            <span className="flow-arrow" aria-hidden="true" />
            <span className="flow-node">{t('how.diagram.ui')}</span>
          </div>
          <div className="flow-lane">
            <span className="flow-node">{t('how.diagram.pyEngine')}</span>
            <span className="flow-arrow" aria-hidden="true" />
            <code className="flow-node file">{t('how.diagram.golden')}</code>
            <span className="flow-arrow" aria-hidden="true" />
            <span className="flow-node accent">{t('how.diagram.tests')}</span>
            <span className="flow-arrow back" aria-hidden="true" />
            <span className="flow-node">{t('how.diagram.tsEngine')}</span>
          </div>
          <figcaption className="caption">{t('how.diagram.caption')}</figcaption>
        </figure>
      </Section>

      <Section id="s4" label="how.s4.label" title="how.s4.title">
        <p>{t('how.s4.p1', { w: pyBench.ops.image[0], h: pyBench.ops.image[1] })}</p>
        <div className="table-wrap glass">
          <table className="data-table bench-table">
            <thead>
              <tr>
                <th scope="col">{t('how.table.op')}</th>
                <th scope="col" className="num">
                  {t('how.table.python')}
                </th>
                <th scope="col" className="num">
                  {t('how.table.ts')}
                </th>
                <th scope="col" className="num">
                  {t('how.table.speedup')}
                </th>
              </tr>
            </thead>
            <tbody>
              {SPEC.operations.map((op) => {
                const py = (pyBench.ops.ms as Record<string, number>)[op.id]
                const ts = (tsBench.ops.ms as Record<string, number>)[op.id]
                return (
                  <tr key={op.id}>
                    <th scope="row">{opLabel(t, has, op.id)}</th>
                    <td className="num" dir="ltr">
                      {fmt(py)}
                    </td>
                    <td className="num" dir="ltr">
                      {fmt(ts)}
                    </td>
                    <td className="num" dir="ltr">
                      {num(py / Math.max(ts, 0.1), 0)}×
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="caption" dir="ltr">
          {pyBench.runtime} · {tsBench.runtime}
        </p>
      </Section>

      <Section id="s5" label="how.s5.label" title="how.s5.title">
        <ul className="checks" role="list">
          <li>{t('how.s5.privacy')}</li>
          {PWA && <li>{t('how.s5.offline')}</li>}
          <li>{t('how.s5.a11y')}</li>
          <li>{t('how.s5.tests')}</li>
        </ul>
        <h4>{t('how.cliTitle')}</h4>
        <pre className="code-block" dir="ltr" tabIndex={0}>
          <code>{`pip install ./python
pixel-lab run photo.jpg -o sketch.png -s grayscale -s canny:sigma=2
pixel-lab run photo.jpg -o out.png --recipe pixel-lab-recipe.json
pixel-lab edit photo.jpg   # interactive, with undo/redo`}</code>
        </pre>
      </Section>

      <section className="cta glass" aria-labelledby="cta-title">
        <h2 id="cta-title">{t('how.ctaTitle')}</h2>
        <p>{t('how.ctaBody')}</p>
        <a className="btn primary lg" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <Github /> {t('how.cta')}
        </a>
      </section>
    </article>
  )
}
