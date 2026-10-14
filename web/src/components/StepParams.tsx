import { opSpec, type ParamValue } from '../engine/spec'
import { useI18n } from '../i18n'
import type { StepState } from '../state/pipeline'
import { Reset } from './Icons'
import { ParamControl } from './ParamControl'

export function StepParams({
  step,
  onChange,
  onReset,
}: {
  step: StepState
  onChange: (name: string, value: ParamValue) => void
  onReset: () => void
}) {
  const { t } = useI18n()
  const controls = opSpec(step.op).params.filter((p) => p.type !== 'kernel')
  if (!controls.length) return null
  return (
    <div className="step-params">
      {controls.map((p) => (
        <ParamControl
          key={p.name}
          op={step.op}
          spec={p}
          value={step.params[p.name]}
          onChange={(v) => onChange(p.name, v)}
        />
      ))}
      <button type="button" className="text-btn small" onClick={onReset}>
        <Reset width={14} height={14} /> {t('step.reset')}
      </button>
    </div>
  )
}
