import { describe, expect, it } from 'vitest'
import { SPEC } from '../src/engine/spec'
import { en } from '../src/i18n/en'
import { he } from '../src/i18n/he'

/** Labels are looked up by computed keys, so their existence is checked here instead of by the type. */
describe('every spec entry has a string in each language', () => {
  const keys = [
    ...SPEC.categories.map((c) => `category.${c.id}`),
    ...SPEC.operations.flatMap((op) => [
      `op.${op.id}.label`,
      `op.${op.id}.explain`,
      ...op.params.filter((p) => p.type !== 'kernel').map((p) => `param.${op.id}.${p.name}`),
      ...op.params.flatMap((p) => (p.options ?? []).map((o) => `option.${o}`)),
    ]),
  ]

  it.each([
    ['en', en],
    ['he', he],
  ] as const)('%s', (_lang, messages) => {
    expect(keys.filter((k) => !(k in messages))).toEqual([])
  })
})
