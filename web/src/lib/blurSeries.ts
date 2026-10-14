import type { Series } from '../components/charts/LineChart'
import type { MessageKey } from '../i18n/en'

type T = (key: MessageKey) => string
type Timings = { sat: (number | null)[]; separable: (number | null)[]; naive: (number | null)[] }

/**
 * The three blur algorithms, in the same colours wherever they are compared.
 * Three at most: with every line on screen at once, a fourth colour cannot stay
 * distinguishable for colour-blind readers (validated palette, all pairs).
 */
export const blurSeries = (t: T, ms: Timings): Series[] => [
  { id: 'sat', label: t('explain.raceSat'), note: 'O(N)', color: 'var(--series-1)', values: ms.sat },
  {
    id: 'separable',
    label: t('explain.raceSeparable'),
    note: 'O(N·k)',
    color: 'var(--series-2)',
    values: ms.separable,
  },
  { id: 'naive', label: t('explain.raceNaive'), note: 'O(N·k²)', color: 'var(--series-3)', values: ms.naive },
]
