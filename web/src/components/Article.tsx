import pyBench from '../../../bench/python.json'
import tsBench from '../../../bench/typescript.json'
import golden from '../../../spec/golden/summary.json'
import { SPEC } from '../engine/spec'
import { useI18n } from '../i18n'
import { formatMs, opLabel } from '../lib/labels'
import { LineChart } from './charts/LineChart'
import { REPO_URL } from './Header'
import { Github } from './Icons'

const asSec = (ms: number) => ms / 1000

export function Article() {
  const { t, has, num } = useI18n()
  const radii = pyBench.blur.radii
  const r7 = radii.indexOf(7)
  const [bw, bh] = pyBench.blur.image
  const fmt = (v: number) => formatMs(num, v)
  const satPy = Math.round(pyBench.blur.ms.sat.reduce((a, b) => a + (b ?? 0), 0) / radii.length)
  const satTs = Math.round(tsBench.blur.ms.sat.reduce((a, b) => a + b, 0) / radii.length)
  const domain: [number, number] = [10, 100_000]

  return (
    <article id="how" className="article" aria-labelledby="how-title">
      <header>
        <p className="eyebrow">{t('app.name')}</p>
        <h2 id="how-title">{t('how.title')}</h2>
        <p className="lead">{t('how.lead')}</p>
      </header>

      <section aria-labelledby="s1">
        <h3 id="s1">
          <span className="section-num">1</span>
          {t('how.s1.title')}
        </h3>
        <p>
          {t('how.s1.p1', {
            mp: num((bw * bh) / 1e6, 2),
            v1: num(asSec(pyBench.blur.ms.v1[r7] ?? 0), 1),
          })}
        </p>
        <p>{t('how.s1.p2', { sat: num(satPy, 0), satTs: num(satTs, 0) })}</p>
        <div className="small-multiples">
          <LineChart
            title={t('how.chartPython')}
            x={radii}
            xLabel={t('explain.radius')}
            yLabel={t('explain.time')}
            formatY={fmt}
            yDomain={domain}
            series={[
              { id: 'sat', label: t('explain.raceSat'), color: 'var(--series-1)', values: pyBench.blur.ms.sat },
              { id: 'separable', label: t('explain.raceSeparable'), color: 'var(--series-2)', values: pyBench.blur.ms.separable },
              { id: 'naive', label: t('explain.raceNaive'), color: 'var(--series-3)', values: pyBench.blur.ms.naive },
              { id: 'v1', label: t('explain.raceV1'), color: 'var(--series-4)', values: pyBench.blur.ms.v1 },
            ]}
          />
          <LineChart
            title={t('how.chartTs')}
            x={radii}
            xLabel={t('explain.radius')}
            yLabel={t('explain.time')}
            formatY={fmt}
            yDomain={domain}
            series={[
              { id: 'sat', label: t('explain.raceSat'), color: 'var(--series-1)', values: tsBench.blur.ms.sat },
              { id: 'separable', label: t('explain.raceSeparable'), color: 'var(--series-2)', values: tsBench.blur.ms.separable },
              { id: 'naive', label: t('explain.raceNaive'), color: 'var(--series-3)', values: tsBench.blur.ms.naive },
            ]}
          />
        </div>
        <p className="caption">{t('how.chartCaption', { w: bw, h: bh })}</p>
      </section>

      <section aria-labelledby="s2">
        <h3 id="s2">
          <span className="section-num">2</span>
          {t('how.s2.title')}
        </h3>
        <p>{t('how.s2.p1', { cases: golden.cases })}</p>
        <p>{t('how.s2.p2')}</p>
        <pre className="code-block" dir="ltr" tabIndex={0}>
          <code>{`function roundHalfEven(x: number): number {
  const r = Math.round(x) // rounds halves toward +Infinity
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r
}`}</code>
        </pre>
      </section>

      <section aria-labelledby="s3">
        <h3 id="s3">
          <span className="section-num">3</span>
          {t('how.s3.title')}
        </h3>
        <p>{t('how.s3.p1')}</p>
        <figure className="flow" aria-label={t('how.diagram.caption')}>
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
      </section>

      <section aria-labelledby="s4">
        <h3 id="s4">
          <span className="section-num">4</span>
          {t('how.s4.title')}
        </h3>
        <p>{t('how.s4.p1', { w: pyBench.ops.image[0], h: pyBench.ops.image[1] })}</p>
        <div className="table-wrap">
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
      </section>

      <section aria-labelledby="s5">
        <h3 id="s5">
          <span className="section-num">5</span>
          {t('how.s5.title')}
        </h3>
        <ul className="checks">
          <li>{t('how.s5.privacy')}</li>
          <li>{t('how.s5.offline')}</li>
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
        <a className="btn primary" href={REPO_URL} target="_blank" rel="noreferrer">
          <Github /> {t('how.cta')}
        </a>
      </section>
    </article>
  )
}
