import { useMemo, useState } from 'react'
import { SPEC } from '../engine/spec'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/en'
import { opExplain, opLabel } from '../lib/labels'
import { Plus, Search } from './Icons'

export function Library({ onAdd }: { onAdd: (op: string) => void }) {
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
            if (e.key === 'Enter' && groups.length === 1 && groups[0].ops.length === 1) onAdd(groups[0].ops[0].id)
          }}
        />
      </label>
      {groups.length === 0 && <p className="muted small pad">{t('library.empty', { q: query })}</p>}
      {groups.map((g) => (
        <section key={g.id} className="library-group" aria-labelledby={`cat-${g.id}`}>
          <h3 id={`cat-${g.id}`}>{t(`category.${g.id}` as MessageKey)}</h3>
          <ul role="list">
            {g.ops.map((op) => {
              const label = opLabel(t, op.id)
              return (
                <li key={op.id}>
                  <button
                    type="button"
                    className="op-btn"
                    onClick={() => onAdd(op.id)}
                    aria-label={t('library.add', { name: label })}
                    title={opExplain(t, op.id)}
                  >
                    <span className="op-name">{label}</span>
                    <span className="complexity" dir="ltr">
                      {op.complexity}
                    </span>
                    <Plus className="op-add" />
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
