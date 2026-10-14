/** Pipeline state with undo/redo. History stores step lists, never images. */
import { defaultParams, type ParamValue, type Params } from '../engine/spec'

export interface StepState {
  id: string
  op: string
  params: Params
  enabled: boolean
}

export interface PipelineState {
  past: StepState[][]
  present: StepState[]
  future: StepState[][]
  selectedId: string | null
  /** Coalesces rapid edits of one control (slider drags) into one undo entry. */
  lastEditKey: string | null
}

export type Action =
  | { type: 'add'; op: string; params?: Params }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; delta: -1 | 1 }
  | { type: 'toggle'; id: string }
  | { type: 'setParam'; id: string; name: string; value: ParamValue }
  | { type: 'resetParams'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'replace'; steps: { op: string; params?: Params; enabled?: boolean }[] }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' }

const HISTORY_LIMIT = 100
/** Longest pipeline; also enforced on shared links, so a crafted link can't tie up the tab. */
export const MAX_STEPS = 32
let counter = 0
const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`

export const makeStep = (op: string, params?: Params, enabled = true): StepState => ({
  id: newId(),
  op,
  params: { ...defaultParams(op), ...params },
  enabled,
})

export const initialPipeline = (steps: StepState[] = []): PipelineState => ({
  past: [],
  present: steps,
  future: [],
  selectedId: steps[steps.length - 1]?.id ?? null,
  lastEditKey: null,
})

function commit(state: PipelineState, present: StepState[], editKey: string | null = null): PipelineState {
  if (editKey !== null && editKey === state.lastEditKey) {
    return { ...state, present, future: [], lastEditKey: editKey }
  }
  return {
    ...state,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    lastEditKey: editKey,
  }
}

export function pipelineReducer(state: PipelineState, action: Action): PipelineState {
  const steps = state.present
  switch (action.type) {
    case 'add': {
      if (steps.length >= MAX_STEPS) return state
      const step = makeStep(action.op, action.params)
      return { ...commit(state, [...steps, step]), selectedId: step.id }
    }
    case 'remove': {
      const index = steps.findIndex((s) => s.id === action.id)
      const next = steps.filter((s) => s.id !== action.id)
      const selectedId =
        state.selectedId === action.id ? (next[Math.min(index, next.length - 1)]?.id ?? null) : state.selectedId
      return { ...commit(state, next), selectedId }
    }
    case 'move': {
      const i = steps.findIndex((s) => s.id === action.id)
      const j = i + action.delta
      if (i < 0 || j < 0 || j >= steps.length) return state
      const next = [...steps]
      ;[next[i], next[j]] = [next[j], next[i]]
      return commit(state, next)
    }
    case 'toggle':
      return commit(
        state,
        steps.map((s) => (s.id === action.id ? { ...s, enabled: !s.enabled } : s)),
      )
    case 'setParam':
      return commit(
        state,
        steps.map((s) => (s.id === action.id ? { ...s, params: { ...s.params, [action.name]: action.value } } : s)),
        `${action.id}:${action.name}`,
      )
    case 'resetParams':
      return commit(
        state,
        steps.map((s) => (s.id === action.id ? { ...s, params: defaultParams(s.op) } : s)),
      )
    case 'select':
      return { ...state, selectedId: action.id, lastEditKey: null }
    case 'replace': {
      const next = action.steps.map((s) => makeStep(s.op, s.params, s.enabled ?? true))
      return { ...commit(state, next), selectedId: next[next.length - 1]?.id ?? null }
    }
    case 'clear':
      return steps.length ? { ...commit(state, []), selectedId: null } : state
    case 'undo': {
      if (!state.past.length) return state
      const present = state.past[state.past.length - 1]
      return {
        ...state,
        past: state.past.slice(0, -1),
        present,
        future: [state.present, ...state.future],
        selectedId: keepSelection(state.selectedId, present),
        lastEditKey: null,
      }
    }
    case 'redo': {
      if (!state.future.length) return state
      const [present, ...future] = state.future
      return {
        ...state,
        past: [...state.past, state.present],
        present,
        future,
        selectedId: keepSelection(state.selectedId, present),
        lastEditKey: null,
      }
    }
  }
}

function keepSelection(id: string | null, steps: StepState[]) {
  return steps.some((s) => s.id === id) ? id : (steps[steps.length - 1]?.id ?? null)
}
