import { useMemo, useState } from 'react'
import { SPEC } from '../engine/spec'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/en'
import { opExplain, opLabel } from '../lib/labels'
import { Plus, Search } from './Icons'

interface Props {
  /** Ops currently in the pipeline (highlighted). */
  active: ReadonlySet<string>
  /** Show this operation on its own: the pipeline becomes just this step. */
  onApply: (op: string) => void
  /** Stack this operation on top of the current pipeline. */
  onAdd: (op: string) => void
}

export function Library({ active, onApply, onAdd }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SPEC.categories
      .map((cat) => ({
        id: cat.id,
        ops: SPEC.operations.filter((op) => {
          if (op.category !== cat.id) return false
          if (!q) return true
          return [op.id, opLabel(t, op.id)].some((s) => s.toLowerCase().includes(q))
        }),
      }))
      .filter((g) => g.ops.length)
  }, [query, t])

  return (
    <div className="library">
      <label className="search">
        <Search />
        <span className="sr-only">{t('library.search')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('library.search')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && groups.length === 1 && groups[0].ops.length === 1) onApply(groups[0].ops[0].id)
          }}
        />
      </label>
      <p className="library-hint">{t('library.hint')}</p>
      {groups.length === 0 && <p className="muted small pad">{t('library.empty', { q: query })}</p>}
      {groups.map((g) => (
        <section key={g.id} className="library-group" aria-labelledby={`cat-${g.id}`}>
          <h3 id={`cat-${g.id}`}>{t(`category.${g.id}` as MessageKey)}</h3>
          <ul role="list">
            {g.ops.map((op) => {
              const label = opLabel(t, op.id)
              const on = active.has(op.id)
              return (
                <li key={op.id} className={`op-row${on ? ' on' : ''}`}>
                  <button
                    type="button"
                    className="op-btn"
                    onClick={() => onApply(op.id)}
                    aria-label={t(on ? 'library.applied' : 'library.apply', { name: label })}
                    title={opExplain(t, op.id)}
                  >
                    <span className="op-name">{label}</span>
                    <span className="complexity" dir="ltr">
                      {op.complexity}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn sm op-add"
                    onClick={() => onAdd(op.id)}
                    aria-label={t('library.add', { name: label })}
                    title={t('library.add', { name: label })}
                  >
                    <Plus />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
