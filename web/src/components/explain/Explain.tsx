import { useMemo, type ReactNode } from 'react'
import { gaussianKernel, kernelFor } from '../../engine/filters'
import type { Img } from '../../engine/image'
import { SEPIA_MATRIX, brightnessLut, contrastLut, invertLut, luma, posterizeLut } from '../../engine/point'
import { OP_SPECS, type ParamValue } from '../../engine/spec'
import { equalizationLut, histogram } from '../../engine/tone'
import { useI18n } from '../../i18n'
import { opExplain, opLabel } from '../../lib/labels'
import type { StepState } from '../../state/pipeline'
import type { EngineClient } from '../../worker/client'
import { Curve } from '../charts/Curve'
import { Histogram } from '../charts/Histogram'
import { WeightsChart } from '../charts/WeightsChart'
import type { Overlay } from '../Viewer'
import { CannyStages } from './CannyStages'
import { KernelInspector } from './KernelInspector'
import { Race } from './Race'
import { SatExplainer } from './SatExplainer'
import { SeamExplainer } from './SeamExplainer'

interface Props {
  step: StepState | null
  stepIndex: number
  input: Img | null
  output: Img | null
  hover: { x: number; y: number } | null
  client: EngineClient
  overlay: Overlay | null
  setOverlay: (o: Overlay | null) => void
  setParam: (name: string, value: ParamValue) => void
  requestZoom: (zoom: number) => void
  /** Parameter controls, shown between the heading and the explanation. */
  controls?: ReactNode
}

const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
]
const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
]

export function Explain(props: Props) {
  const { t, has } = useI18n()
  const { step, input } = props
  if (!step) return <p className="empty-state">{t('explain.empty')}</p>
  const spec = OP_SPECS[step.op]

  return (
    <article className="explain">
      <header className="explain-head">
        <h3>{opLabel(t, has, step.op)}</h3>
        <span className="complexity big" dir="ltr" title={t('explain.complexityNote')}>
          {spec.complexity}
        </span>
      </header>
      {props.controls}
      <p className="explain-text">{opExplain(t, has, step.op)}</p>
      {input && <Detail {...props} input={input} step={step} />}
    </article>
  )
}

function Detail({ step, stepIndex, input, output, hover, client, overlay, setOverlay, setParam, requestZoom }: Props & { input: Img; step: StepState }) {
  const { t } = useI18n()
  const p = step.params
  const num = (k: string) => p[k] as number

  switch (step.op) {
    case 'invert':
      return <Curve lut={invertLut()} />
    case 'brightness':
      return <Curve lut={brightnessLut(num('amount'))} />
    case 'contrast':
      return <Curve lut={contrastLut(num('amount'))} />
    case 'posterize':
      return <Curve lut={posterizeLut(num('levels'))} />
    case 'grayscale':
      return <Matrix rows={[['Y', 0.299, 0.587, 0.114]]} />
    case 'sepia':
      return <Matrix rows={SEPIA_MATRIX.map((r, i) => [["R'", "G'", "B'"][i], ...r])} />
    case 'equalize':
      return <EqualizeDetail input={input} output={output} />
    case 'box_blur':
      return (
        <>
          <SatExplainer input={input} hover={hover} radius={num('radius')} mode="blur" />
          <Race client={client} stepIndex={stepIndex} />
        </>
      )
    case 'gaussian_blur':
      return (
        <>
          <WeightsChart title={t('explain.gaussWeights')} weights={gaussianKernel(num('sigma'))} />
          <Race client={client} stepIndex={stepIndex} />
        </>
      )
    case 'sharpen':
      return <WeightsChart title={t('explain.gaussWeights')} weights={gaussianKernel(num('sigma'))} />
    case 'convolve':
      return <ConvolveDetail input={input} hover={hover} preset={p.preset as string} weights={p.weights as number[]} setParam={setParam} />
    case 'sobel':
      return (
        <KernelInspector
          input={input}
          hover={hover}
          kernels={[
            { name: 'Gx', kernel: SOBEL_X },
            { name: 'Gy', kernel: SOBEL_Y },
          ]}
          combine={([gx, gy]) => ({ label: '√(Gx² + Gy²)', value: Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy))) })}
        />
      )
    case 'canny':
      return <CannyStages client={client} stepIndex={stepIndex} params={p} input={input} overlay={overlay} setOverlay={setOverlay} />
    case 'adaptive_threshold':
      return <SatExplainer input={input} hover={hover} radius={num('block_radius')} mode="threshold" blurRadius={num('blur_radius')} offset={num('offset')} />
    case 'dither':
      return <DitherDetail requestZoom={requestZoom} />
    case 'seam_carve':
      return <SeamExplainer client={client} stepIndex={stepIndex} params={p} input={input} overlay={overlay} setOverlay={setOverlay} />
    case 'rotate':
      return (
        <pre className="formula" dir="ltr">
          {p.direction === 'cw' ? 'out[x][h−1−y] = in[y][x]' : p.direction === 'ccw' ? 'out[w−1−x][y] = in[y][x]' : 'out[h−1−y][w−1−x] = in[y][x]'}
        </pre>
      )
    case 'resize':
      return (
        <pre className="formula" dir="ltr">
          {'v = (a·(1−fx) + b·fx)·(1−fy)\n  + (c·(1−fx) + d·fx)·fy'}
        </pre>
      )
    default:
      return null
  }
}

function Matrix({ rows }: { rows: (string | number)[][] }) {
  const { t, num } = useI18n()
  return (
    <div>
      <h4 className="explain-sub">{t('explain.matrix')}</h4>
      <table className="matrix-table" dir="ltr">
        <thead>
          <tr>
            <th />
            <th scope="col">R</th>
            <th scope="col">G</th>
            <th scope="col">B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, ...vals]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {vals.map((v, i) => (
                <td key={i}>{num(v as number, 3)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EqualizeDetail({ input, output }: { input: Img; output: Img | null }) {
  const { t } = useI18n()
  const before = useMemo(() => histogram(luma(input)), [input])
  const after = useMemo(() => (output ? histogram(luma(output)) : null), [output])
  const lut = useMemo(() => equalizationLut(before), [before])
  return (
    <>
      <Histogram title={t('explain.histBefore')} counts={before} />
      {after && <Histogram title={t('explain.histAfter')} counts={after} />}
      <Curve lut={lut} />
    </>
  )
}

function ConvolveDetail({
  input,
  hover,
  preset,
  weights,
  setParam,
}: {
  input: Img
  hover: { x: number; y: number } | null
  preset: string
  weights: number[]
  setParam: (name: string, value: ParamValue) => void
}) {
  const { t } = useI18n()
  const kernel = kernelFor(preset, weights)
  const editable = preset === 'custom' ? weights : kernel.flat()
  return (
    <>
      <KernelInspector input={input} hover={hover} kernels={[{ kernel }]} />
      <details className="kernel-editor" open={preset === 'custom'}>
        <summary>{t('explain.editKernel')}</summary>
        <div className="matrix editable" dir="ltr" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {editable.slice(0, 9).map((v, i) => (
            <input
              key={i}
              type="number"
              step="0.5"
              value={Number.isInteger(v) ? v : Number(v.toFixed(4))}
              aria-label={`${t('explain.weight')} ${Math.floor(i / 3) + 1},${(i % 3) + 1}`}
              onChange={(e) => {
                const next = editable.slice(0, 9)
                next[i] = Number(e.target.value) || 0
                if (preset !== 'custom') setParam('preset', 'custom')
                setParam('weights', next)
              }}
            />
          ))}
        </div>
      </details>
    </>
  )
}

function DitherDetail({ requestZoom }: { requestZoom: (z: number) => void }) {
  const { t } = useI18n()
  return (
    <div>
      <h4 className="explain-sub">{t('explain.diffusion')}</h4>
      <div className="diffusion" dir="ltr" aria-hidden="true">
        <span />
        <span className="current">●</span>
        <span>7/16</span>
        <span>3/16</span>
        <span>5/16</span>
        <span>1/16</span>
      </div>
      <button type="button" className="btn sm" onClick={() => requestZoom(4)}>
        {t('explain.zoomIn')}
      </button>
    </div>
  )
}

