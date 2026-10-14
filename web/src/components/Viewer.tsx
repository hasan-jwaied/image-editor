import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useFrameCanvas } from '../hooks/useFrameCanvas'
import { useI18n } from '../i18n'
import { WORKING_SIZES } from '../lib/config'
import { SAMPLES, type Sample } from '../lib/samples'
import { Close, Fit, Image as ImageIcon, Minus, Plus, Split } from './Icons'

export interface Frame {
  width: number
  height: number
  rgba: Uint8ClampedArray<ArrayBuffer>
}

export interface Overlay {
  frame: Frame
  label: string
}

interface Props {
  after: Frame | null
  original: Frame | null
  overlay: Overlay | null
  onCloseOverlay: () => void
  busyLabel: string | null
  error: string | null
  loading: boolean
  stepChip: { n: number; total: number; onShowFinal: () => void } | null
  onHover: (p: { x: number; y: number } | null) => void
  onFile: (file: File) => void
  onSample: (sample: Sample) => void
  activeSample: string | null
  workingSize: number
  onWorkingSize: (n: number) => void
  zoomRequest: { zoom: number; nonce: number } | null
}

const MIN_ZOOM = 0.05
const MAX_ZOOM = 16

export function Viewer(props: Props) {
  const { t, num } = useI18n()
  const { after, original, overlay } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [box, setBox] = useState({ w: 800, h: 600 })
  const [mode, setMode] = useState<'result' | 'split'>('result')
  const [holding, setHolding] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null) // null = fit
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [splitPos, setSplitPos] = useState(0.5)
  const [dragOver, setDragOver] = useState(false)
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ kind: 'pan' | 'split'; x: number; y: number; px: number; py: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  const shown: Frame | null = holding && original ? original : (overlay?.frame ?? after)
  const splitAvailable = !!original && !!after && original.width === after.width && original.height === after.height
  const splitting = mode === 'split' && splitAvailable && !holding && !overlay

  const mainRef = useFrameCanvas(shown)
  const originalRef = useFrameCanvas(splitting ? original : null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const inset = box.w < 500 ? 12 : 32
  const fit = shown ? Math.min((box.w - inset) / shown.width, (box.h - inset) / shown.height, 4) : 1
  const scale = Math.max(MIN_ZOOM, zoom ?? fit)
  const dispW = shown ? shown.width * scale : 0
  const dispH = shown ? shown.height * scale : 0
  const left = (box.w - dispW) / 2 + (zoom === null ? 0 : pan.x)
  const top = (box.h - dispH) / 2 + (zoom === null ? 0 : pan.y)

  const dimsKey = shown ? `${shown.width}x${shown.height}` : ''
  useEffect(() => {
    setZoom(null)
    setPan({ x: 0, y: 0 })
  }, [dimsKey])

  useEffect(() => {
    if (props.zoomRequest) {
      setZoom(props.zoomRequest.zoom)
      setPan({ x: 0, y: 0 })
    }
  }, [props.zoomRequest])

  const zoomAround = useCallback(
    (factor: number, cx = box.w / 2, cy = box.h / 2) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * factor))
      const real = next / scale
      // keep the point under the cursor fixed
      const newLeft = cx - (cx - left) * real
      const newTop = cy - (cy - top) * real
      const w = (shown?.width ?? 0) * next
      const h = (shown?.height ?? 0) * next
      setZoom(next)
      setPan({ x: newLeft - (box.w - w) / 2, y: newTop - (box.h - h) / 2 })
    },
    [box, scale, left, top, shown],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !shown) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAround(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAround, shown])

  const toImage = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: Math.floor((clientX - rect.left - left) / scale), y: Math.floor((clientY - rect.top - top) / scale) }
  }

  const inspect = (clientX: number, clientY: number) => {
    if (!shown) return
    const p = toImage(clientX, clientY)
    const inside = p.x >= 0 && p.y >= 0 && p.x < shown.width && p.y < shown.height
    setProbe(inside ? p : null)
    props.onHover(inside ? p : null)
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!shown || e.button !== 0) return
    const target = e.target as HTMLElement
    if (e.pointerType !== 'mouse') {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale }
        dragRef.current = null
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      // no hover on touch screens, so a tap inspects
      if (!target.closest('.split-handle')) inspect(e.clientX, e.clientY)
    }
    if (target.closest('.split-handle')) {
      dragRef.current = { kind: 'split', x: e.clientX, y: e.clientY, px: 0, py: 0 }
    } else if (zoom !== null && target.closest('.canvas-wrap')) {
      dragRef.current = { kind: 'pan', x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    } else return
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    if (pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const rect = containerRef.current!.getBoundingClientRect()
      const target = (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist
      zoomAround(target / scale, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
      return
    }
    const drag = dragRef.current
    if (drag?.kind === 'pan') {
      setPan({ x: drag.px + e.clientX - drag.x, y: drag.py + e.clientY - drag.y })
      return
    }
    if (drag?.kind === 'split') {
      const rect = containerRef.current!.getBoundingClientRect()
      setSplitPos(Math.min(1, Math.max(0, (e.clientX - rect.left - left) / dispW)))
      return
    }
    if (e.pointerType === 'mouse') inspect(e.clientX, e.clientY)
  }

  const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
  }

  const pixel =
    probe && shown
      ? Array.from(
          shown.rgba.subarray((probe.y * shown.width + probe.x) * 4, (probe.y * shown.width + probe.x) * 4 + 3),
        )
      : null

  return (
    <div className="viewer panel">
      <div className="viewer-bar">
        <div className="segmented sm" role="radiogroup" aria-label={t('viewer.result')}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'result'}
            className={mode === 'result' ? 'on' : ''}
            onClick={() => setMode('result')}
          >
            {t('viewer.result')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'split'}
            className={mode === 'split' ? 'on' : ''}
            onClick={() => setMode('split')}
            disabled={!splitAvailable}
            title={!splitAvailable && after ? t('viewer.sizeDiff') : undefined}
          >
            <Split /> {t('viewer.split')}
          </button>
        </div>
        <button
          type="button"
          className="btn sm ghost hold-btn"
          disabled={!original}
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setHolding(true)}
          onKeyUp={() => setHolding(false)}
          onBlur={() => setHolding(false)}
        >
          <span className="hide-sm">{t('viewer.hold')}</span>
          <span className="show-sm">{t('viewer.original')}</span>
        </button>
        <span className="toolbar-spacer" />
        <div className="samples" aria-label={t('viewer.samples')} role="group">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sample-thumb${props.activeSample === s.id ? ' on' : ''}`}
              onClick={() => props.onSample(s)}
              title={t(s.label)}
              aria-label={t(s.label)}
              aria-pressed={props.activeSample === s.id}
            >
              <img src={s.thumb} alt="" width={36} height={28} />
            </button>
          ))}
          <button
            type="button"
            className="btn sm"
            onClick={() => fileRef.current?.click()}
            aria-label={t('viewer.upload')}
          >
            <ImageIcon /> <span className="hide-sm">{t('viewer.upload')}</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) props.onFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <div
        ref={containerRef}
        className={`viewport${dragOver ? ' drag-over' : ''}${zoom !== null ? ' zoomed' : ''}`}
        title={shown ? t('viewer.zoomHint') : undefined}
        dir="ltr"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          // touch sends a leave after every tap
          if (e.pointerType !== 'mouse') return
          setProbe(null)
          props.onHover(null)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) props.onFile(f)
        }}
      >
        {shown ? (
          <div
            className={`canvas-wrap${scale >= 2 ? ' pixelated' : ''}${props.busyLabel ? ' stale' : ''}`}
            style={{ left, top, width: dispW, height: dispH }}
          >
            {splitting && <canvas ref={originalRef} className="layer" aria-hidden="true" />}
            <canvas
              ref={mainRef}
              className="layer"
              role="img"
              aria-label={t('viewer.canvasLabel')}
              style={splitting ? { clipPath: `inset(0 0 0 ${splitPos * 100}%)` } : undefined}
            />
            {splitting && (
              <>
                <span className="split-tag start">{t('viewer.original')}</span>
                <span className="split-tag end">{t('viewer.after')}</span>
                <div
                  className="split-handle"
                  style={{ left: `${splitPos * 100}%` }}
                  role="slider"
                  tabIndex={0}
                  aria-label={t('viewer.splitHandle')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(splitPos * 100)}
                  onKeyDown={(e) => {
                    const d = e.key === 'ArrowLeft' ? -0.05 : e.key === 'ArrowRight' ? 0.05 : 0
                    if (d) {
                      e.preventDefault()
                      setSplitPos((p) => Math.min(1, Math.max(0, p + d)))
                    }
                  }}
                >
                  <span className="split-knob" />
                </div>
              </>
            )}
            {holding && <span className="split-tag start">{t('viewer.original')}</span>}
          </div>
        ) : (
          <div className="dropzone">
            {props.loading ? (
              <p className="muted">{t('viewer.loading')}</p>
            ) : (
              <>
                <p>
                  {t('viewer.drop')}{' '}
                  <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
                    {t('viewer.choose')}
                  </button>
                </p>
                <p className="muted small">{t('viewer.privacy')}</p>
              </>
            )}
          </div>
        )}

        <div className="viewer-chips">
          {overlay && (
            <span className="chip">
              {t('viewer.viewing', { label: overlay.label })}
              <button
                type="button"
                className="chip-close"
                onClick={props.onCloseOverlay}
                aria-label={t('viewer.close')}
              >
                <Close width={14} height={14} />
              </button>
            </span>
          )}
          {!overlay && props.stepChip && (
            <span className="chip">
              {t('viewer.showingStep', { n: props.stepChip.n, total: props.stepChip.total })}
              <button type="button" className="chip-action" onClick={props.stepChip.onShowFinal}>
                {t('viewer.showFinal')}
              </button>
            </span>
          )}
        </div>

        {(props.busyLabel || props.error) && (
          <div className={`viewer-status${props.error ? ' error' : ''}`} role="status" aria-live="polite">
            {props.error ? (
              t('viewer.error', { msg: props.error })
            ) : (
              <>
                <span className="spinner" aria-hidden="true" /> {props.busyLabel}
              </>
            )}
          </div>
        )}
      </div>

      <div className="viewer-foot small">
        <div className="zoom-controls">
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => zoomAround(1 / 1.25)}
            disabled={!shown}
            aria-label={t('viewer.zoomOut')}
          >
            <Minus />
          </button>
          <span
            className="zoom-value"
            dir="ltr"
            title={t('viewer.zoomHint')}
            aria-label={t('viewer.zoom', { pct: `${Math.round(scale * 100)}%` })}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="icon-btn sm"
            onClick={() => zoomAround(1.25)}
            disabled={!shown}
            aria-label={t('viewer.zoomIn')}
          >
            <Plus />
          </button>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => setZoom(null)}
            disabled={!shown}
            aria-pressed={zoom === null}
          >
            <Fit /> {t('viewer.fit')}
          </button>
          <button
            type="button"
            className="btn sm ghost actual-btn"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
            disabled={!shown}
          >
            {t('viewer.actual')}
          </button>
        </div>
        <span className="toolbar-spacer" />
        {shown && (
          <span className={`probe${pixel && probe ? '' : ' idle'}`} dir="ltr">
            {pixel && probe ? (
              <>
                <span className="swatch" style={{ background: `rgb(${pixel.join(',')})` }} />
                {probe.x}, {probe.y} · {pixel[0] === pixel[1] && pixel[1] === pixel[2] ? pixel[0] : pixel.join(' ')}
              </>
            ) : (
              t('viewer.dims', { w: num(shown.width, 0), h: num(shown.height, 0) })
            )}
          </span>
        )}
        <label className="working-size" title={t('viewer.resolutionHelp')}>
          <span className="muted">{t('viewer.resolution')}</span>
          <select value={props.workingSize} onChange={(e) => props.onWorkingSize(Number(e.target.value))}>
            {WORKING_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
