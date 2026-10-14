import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Article } from './components/Article'
import { Explain } from './components/explain/Explain'
import { Header } from './components/Header'
import { Back } from './components/Icons'
import { Library } from './components/Library'
import { PipelinePanel } from './components/PipelinePanel'
import { Viewer, type Overlay } from './components/Viewer'
import { toRGBA, type Img } from './engine/image'
import type { ParamValue } from './engine/spec'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useProcessor } from './hooks/useProcessor'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './i18n'
import { HOME_URL, WORKING_SIZES } from './lib/config'
import { DecodeError, decodeImage } from './lib/decode'
import { downloadBlob } from './lib/download'
import { frameOf } from './lib/frame'
import { opLabel } from './lib/labels'
import { PRESETS, SAMPLES, type Sample } from './lib/samples'
import { initialPipeline, makeStep, pipelineReducer } from './state/pipeline'
import { decodeRecipeHash } from './state/recipe'
import { EngineClient } from './worker/client'

type Tab = 'add' | 'pipeline' | 'explain'
const SIZE_KEY = 'pixel-lab:working-size'

/** A phone or a low-core device starts at 1024 px (seam carving costs ~width² × height). */
function defaultSize(): number {
  const small = window.matchMedia('(max-width: 899px)').matches
  const slow = (navigator.hardwareConcurrency || 8) <= 4
  return small || slow ? 1024 : 1600
}

function storedSize(): number {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY))
    return (WORKING_SIZES as readonly number[]).includes(v) ? v : defaultSize()
  } catch {
    return defaultSize()
  }
}

/**
 * The lab starts with an empty pipeline: nothing runs until the visitor picks
 * an operation or a recipe. A shared link (#r=…) is the one exception; it is
 * applied once and then removed from the address bar, so a reload starts clean.
 */
function initialSteps() {
  if (!window.location.hash.startsWith('#r=')) return []
  const shared = decodeRecipeHash(window.location.hash)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return shared ? shared.map((s) => makeStep(s.op, s.params, s.enabled)) : []
}

/** True only after `value` has been true for `delay` ms (avoids spinner flicker). */
function useDelayed(value: boolean, delay = 180) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!value) {
      setOn(false)
      return
    }
    const id = window.setTimeout(() => setOn(true), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return on
}

export function App() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const wide = useMediaQuery('(min-width: 1100px)')
  const [client] = useState(() => new EngineClient())
  const [pipeline, dispatch] = useReducer(pipelineReducer, undefined, () => initialPipeline(initialSteps()))
  const [input, setInput] = useState<{ blob: Blob; sample: string | null } | null>(null)
  const [source, setSource] = useState<Img | null>(null)
  const [loading, setLoading] = useState(false)
  // Stored as data, translated when rendered, so switching language doesn't reload the image.
  const [loadError, setLoadError] = useState<{ tooLarge: number } | 'decode' | null>(null)
  const [workingSize, setWorkingSize] = useState(storedSize)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [tab, setTab] = useState<Tab>('pipeline')
  const [zoomRequest, setZoomRequest] = useState<{ zoom: number; nonce: number } | null>(null)
  const steps = pipeline.present

  const loadSample = useCallback(async (sample: Sample) => {
    setLoading(true)
    try {
      const res = await fetch(sample.src)
      if (!res.ok) throw new Error(res.statusText)
      setInput({ blob: await res.blob(), sample: sample.id })
    } catch {
      setLoadError('decode')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSample(SAMPLES[0])
  }, [loadSample])

  // Section links such as …/#how: the target only exists once React has rendered,
  // and its position settles once the web font has replaced the fallback.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) void document.fonts.ready.then(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  useEffect(() => {
    if (!input) return
    let alive = true
    setLoading(true)
    setLoadError(null)
    decodeImage(input.blob, workingSize)
      .then((img) => alive && setSource(img))
      .catch((e: unknown) => {
        if (!alive) return
        setLoadError(e instanceof DecodeError && e.kind === 'tooLarge' ? { tooLarge: e.megapixels } : 'decode')
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [input, workingSize])

  const processed = useProcessor(client, source, steps)

  // Which step the viewer shows: the selected one, else the last.
  const selIndex = steps.findIndex((s) => s.id === pipeline.selectedId)
  const viewIndex = selIndex >= 0 ? selIndex : steps.length - 1
  const selected = selIndex >= 0 ? steps[selIndex] : null
  const outputImg = viewIndex >= 0 ? (processed.images[viewIndex] ?? null) : source
  // Without steps there is nothing to compare or export, so these stay empty.
  const inputImg = viewIndex > 0 ? (processed.images[viewIndex - 1] ?? null) : viewIndex === 0 ? source : null
  const finalImg = steps.length ? (processed.images[steps.length - 1] ?? null) : null
  const viewCurrent = viewIndex < 0 || processed.keys[viewIndex] === processed.currentKeys[viewIndex]

  const after = useMemo(() => (outputImg ? frameOf(outputImg) : source ? frameOf(source) : null), [outputImg, source])
  const before = useMemo(() => (inputImg ? frameOf(inputImg) : null), [inputImg])
  const original = useMemo(() => (source && steps.length ? frameOf(source) : null), [source, steps.length])

  const showBusy = useDelayed(processed.busy || loading)
  const runningOp = processed.runningIndex !== null ? steps[processed.runningIndex]?.op : null
  const busyLabel = showBusy
    ? loading
      ? t('viewer.loading')
      : t('viewer.processing', { op: runningOp ? opLabel(t, runningOp) : '…' }) +
        (processed.fraction !== null ? ` ${Math.round(processed.fraction * 100)}%` : '')
    : null

  // An overlay belongs to one step's state; drop it when that changes.
  const viewKey = processed.currentKeys[viewIndex]
  useEffect(() => setOverlay(null), [pipeline.selectedId, viewKey, source])

  const chooseWorkingSize = (size: number) => {
    setWorkingSize(size)
    try {
      localStorage.setItem(SIZE_KEY, String(size)) // only an explicit choice is remembered
    } catch {
      /* not persisted */
    }
  }

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea, [contenteditable]')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current && !mod) {
        if (!target.closest('.steps')) return
        e.preventDefault()
        dispatch({ type: 'remove', id: selectedRef.current.id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Clicking an operation shows it on its own, so its effect stays readable;
  // clicking it again removes it. "+" stacks an operation that isn't applied yet.
  const toggleOp = (op: string) => {
    const applied = steps.find((s) => s.op === op)
    if (applied) {
      dispatch({ type: 'remove', id: applied.id })
      return
    }
    dispatch({ type: 'replace', steps: [{ op }] })
    if (!wide) setTab('explain')
  }
  const addOp = (op: string) => dispatch({ type: 'add', op })
  const activeOps = useMemo(() => new Set(steps.map((s) => s.op)), [steps])

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    dispatch({ type: 'replace', steps: preset.steps })
    document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportPng = () => {
    if (!finalImg) return
    const canvas = document.createElement('canvas')
    canvas.width = finalImg.width
    canvas.height = finalImg.height
    canvas.getContext('2d')?.putImageData(new ImageData(toRGBA(finalImg), finalImg.width, finalImg.height), 0, 0)
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `pixel-lab-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`)
    }, 'image/png')
  }

  const setParam = (name: string, value: ParamValue) =>
    selected && dispatch({ type: 'setParam', id: selected.id, name, value })

  const pipelinePanel = (
    <PipelinePanel
      pipeline={pipeline}
      dispatch={dispatch}
      processed={processed}
      onExport={exportPng}
      canExport={!!finalImg && !processed.busy}
    />
  )
  const explainPanel = (
    <Explain
      step={selected}
      stepIndex={selIndex}
      input={viewCurrent ? inputImg : null}
      output={viewCurrent ? outputImg : null}
      hover={hover}
      client={client}
      overlay={overlay}
      setOverlay={setOverlay}
      setParam={setParam}
      resetParams={() => selected && dispatch({ type: 'resetParams', id: selected.id })}
      requestZoom={(zoom) => setZoomRequest({ zoom, nonce: Date.now() })}
    />
  )

  const tabs: { id: Tab; label: string }[] = [
    ...(wide ? [] : [{ id: 'add' as Tab, label: t('tabs.add') }]),
    { id: 'pipeline', label: t('tabs.pipeline') },
    { id: 'explain', label: t('tabs.explain') },
  ]
  const activeTab = wide && tab === 'add' ? 'pipeline' : tab

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      <Header theme={theme} onToggleTheme={toggle} />
      <main id="top">
        <section className="hero">
          <p className="hero-eyebrow">{t('app.tagline')}</p>
          <h1>{t('hero.title')}</h1>
          <p className="hero-body">{t('hero.body')}</p>
          <div className="presets" role="group" aria-label={t('hero.try')}>
            <span className="presets-label">{t('hero.try')}</span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip-btn glass" onClick={() => applyPreset(p.id)}>
                {t(p.label)}
              </button>
            ))}
          </div>
        </section>

        <section id="lab" className="lab" aria-label={t('nav.lab')}>
          {wide && (
            <aside className="panel library-panel" aria-labelledby="library-title">
              <h2 id="library-title" className="panel-title">
                {t('library.title')}
              </h2>
              <Library active={activeOps} onToggle={toggleOp} onAdd={addOp} />
            </aside>
          )}

          <div className="stage">
            <Viewer
              after={after}
              before={before}
              original={original}
              overlay={overlay}
              onCloseOverlay={() => setOverlay(null)}
              busyLabel={busyLabel}
              error={
                loadError === 'decode'
                  ? t('error.decode')
                  : loadError
                    ? t('error.tooLarge', { mp: loadError.tooLarge })
                    : processed.error
              }
              loading={loading && !source}
              stepChip={
                selIndex >= 0 && selIndex < steps.length - 1
                  ? {
                      n: selIndex + 1,
                      total: steps.length,
                      onShowFinal: () => dispatch({ type: 'select', id: steps[steps.length - 1].id }),
                    }
                  : null
              }
              onHover={setHover}
              onFile={(file) => setInput({ blob: file, sample: null })}
              onSample={(s) => void loadSample(s)}
              activeSample={input?.sample ?? null}
              workingSize={workingSize}
              onWorkingSize={chooseWorkingSize}
              zoomRequest={zoomRequest}
            />
          </div>

          <aside className="panel inspector" aria-label={t('tabs.pipeline')}>
            {wide ? (
              <>
                <h2 className="panel-title">{t('pipeline.title')}</h2>
                {pipelinePanel}
                <div className="inspector-divider" />
                {explainPanel}
              </>
            ) : (
              <>
                <div className="tabs segmented" role="tablist" aria-label={t('tabs.pipeline')}>
                  {tabs.map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      role="tab"
                      id={`tab-${tb.id}`}
                      aria-selected={activeTab === tb.id}
                      aria-controls={`panel-${tb.id}`}
                      className={activeTab === tb.id ? 'on' : ''}
                      onClick={() => setTab(tb.id)}
                    >
                      {tb.label}
                    </button>
                  ))}
                </div>
                <div
                  role="tabpanel"
                  id={`panel-${activeTab}`}
                  aria-labelledby={`tab-${activeTab}`}
                  className="tabpanel"
                >
                  {activeTab === 'add' && <Library active={activeOps} onToggle={toggleOp} onAdd={addOp} />}
                  {activeTab === 'pipeline' && pipelinePanel}
                  {activeTab === 'explain' && explainPanel}
                </div>
              </>
            )}
          </aside>
        </section>

        <Article />
      </main>
      <footer className="footer">
        {HOME_URL && (
          <a className="footer-back" href={HOME_URL}>
            <Back width={14} height={14} /> {t('footer.back')}
          </a>
        )}
        <p>{t('footer.built')}</p>
        <p className="small muted">{t('footer.credits')}</p>
      </footer>
    </>
  )
}
