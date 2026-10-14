import { useId } from 'react'
import type { ParamSpec, ParamValue } from '../engine/spec'
import { useI18n } from '../i18n'
import { optionLabel, paramLabel } from '../lib/labels'

interface Props {
  op: string
  spec: ParamSpec
  value: ParamValue
  onChange: (value: ParamValue) => void
}

export function ParamControl({ op, spec, value, onChange }: Props) {
  const { t, has, num } = useI18n()
  const id = useId()
  const label = paramLabel(t, has, op, spec.name)

  if (spec.type === 'enum') {
    const options = spec.options ?? []
    if (options.length <= 3) {
      return (
        <fieldset className="param">
          <legend className="param-label">{label}</legend>
          <div className="segmented" role="radiogroup" aria-label={label}>
            {options.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={value === o}
                className={value === o ? 'on' : ''}
                onClick={() => onChange(o)}
              >
                {optionLabel(t, has, o)}
              </button>
            ))}
          </div>
        </fieldset>
      )
    }
    return (
      <div className="param">
        <label className="param-label" htmlFor={id}>
          {label}
        </label>
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {optionLabel(t, has, o)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (spec.type === 'kernel') return null // edited in the explainer's kernel grid

  const n = value as number
  const min = spec.min ?? 0
  const max = spec.max ?? 100
  const step = spec.step ?? (spec.type === 'int' ? 1 : 0.1)
  const digits = spec.type === 'int' ? 0 : step < 0.1 ? 2 : 1
  const pct = ((n - min) / (max - min)) * 100
  return (
    <div className="param">
      <div className="param-row">
        <label className="param-label" htmlFor={id}>
          {label}
        </label>
        <output htmlFor={id} className="param-value" dir="ltr">
          {num(n, digits)}
          {spec.unit ? <span className="unit">{spec.unit === '%' ? '%' : ` ${spec.unit}`}</span> : null}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={n}
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(spec.type === 'int' ? Math.round(Number(e.target.value)) : Number(e.target.value))}
      />
    </div>
  )
}
