import { useState } from 'react'
import type { Processed } from '../hooks/useProcessor'
import { useI18n } from '../i18n'
import { downloadBlob } from '../lib/download'
import { formatMs, opLabel } from '../lib/labels'
import type { Action, PipelineState } from '../state/pipeline'
import { cliCommand, encodeRecipeHash, toRecipe, type Recipe } from '../state/recipe'
import { Down, Download, Eye, EyeOff, FileCode, Link, Redo, Terminal, Trash, Undo, Up } from './Icons'

/** This page's address with the pipeline in the hash; opening it applies the pipeline once. */
const shareUrl = (recipe: Recipe) =>
  `${window.location.origin}${window.location.pathname}${window.location.search}${encodeRecipeHash(recipe)}`

interface Props {
  pipeline: PipelineState
  dispatch: (a: Action) => void
  processed: Processed
  onExport: () => void
  canExport: boolean
}

export function PipelinePanel({ pipeline, dispatch, processed, onExport, canExport }: Props) {
  const { t, num } = useI18n()
  const steps = pipeline.present
  const [copied, setCopied] = useState<'link' | 'cli' | null>(null)
  const recipe = toRecipe(steps)
  const command = cliCommand(recipe)
  const total = steps.reduce(
    (sum, _step, i) => sum + (processed.keys[i] === processed.currentKeys[i] ? (processed.ms[i] ?? 0) : 0),
    0,
  )

  const flash = (what: 'link' | 'cli') => {
    setCopied(what)
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
  }

  const copy = async (text: string, what: 'link' | 'cli') => {
    try {
      await navigator.clipboard.writeText(text)
      flash(what)
    } catch {
      window.prompt(t('pipeline.copy'), text)
    }
  }

  const downloadRecipe = () =>
    downloadBlob(
      new Blob([JSON.stringify(recipe, null, 2) + '\n'], { type: 'application/json' }),
      'pixel-lab-recipe.json',
    )

  return (
    <div className="pipeline">
      <div className="toolbar" role="toolbar" aria-label={t('pipeline.title')}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: 'undo' })}
          disabled={!pipeline.past.length}
          title={`${t('pipeline.undo')} (Ctrl+Z)`}
          aria-label={t('pipeline.undo')}
        >
          <Undo />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: 'redo' })}
          disabled={!pipeline.future.length}
          title={`${t('pipeline.redo')} (Ctrl+Shift+Z)`}
          aria-label={t('pipeline.redo')}
        >
          <Redo />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: 'clear' })}
          disabled={!steps.length}
          title={t('pipeline.clear')}
          aria-label={t('pipeline.clear')}
        >
          <Trash />
        </button>
        <span className="toolbar-spacer" />
        {steps.length > 0 && (
          <span className="total muted small" aria-live="polite">
            {/* U+2066/U+2069 isolate the LTR number inside RTL sentences */}
            {t('pipeline.total', { ms: `\u2066${formatMs(num, total)}\u2069` })}
          </span>
        )}
      </div>

      {steps.length === 0 ? (
        <p className="empty-state">{t('pipeline.empty')}</p>
      ) : (
        <ol className="steps" role="list">
          {steps.map((step, i) => {
            const selected = step.id === pipeline.selectedId
            const label = opLabel(t, step.op)
            const current = processed.keys[i] === processed.currentKeys[i]
            const running =
              processed.runningIndex === i || (processed.busy && !current && processed.runningIndex === null)
            return (
              <li key={step.id} className={`step${selected ? ' selected' : ''}${step.enabled ? '' : ' disabled'}`}>
                <div className="step-head">
                  <button
                    type="button"
                    className="step-title"
                    aria-pressed={selected}
                    aria-label={t('step.select', { n: i + 1, name: label })}
                    onClick={() => dispatch({ type: 'select', id: step.id })}
                  >
                    <span className="step-index" dir="ltr">
                      {i + 1}
                    </span>
                    <span className="step-name">{label}</span>
                    <span className="step-meta small" dir="ltr">
                      {!step.enabled
                        ? t('step.skipped')
                        : running
                          ? t('step.running')
                          : current && processed.ms[i] !== undefined
                            ? formatMs(num, processed.ms[i])
                            : ''}
                    </span>
                  </button>
                  <div className="step-actions">
                    <button
                      type="button"
                      className="icon-btn sm"
                      onClick={() => dispatch({ type: 'toggle', id: step.id })}
                      aria-label={step.enabled ? t('step.disable') : t('step.enable')}
                      title={step.enabled ? t('step.disable') : t('step.enable')}
                      aria-pressed={!step.enabled}
                    >
                      {step.enabled ? <Eye /> : <EyeOff />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn sm step-move"
                      onClick={() => dispatch({ type: 'move', id: step.id, delta: -1 })}
                      disabled={i === 0}
                      aria-label={t('step.up')}
                      title={t('step.up')}
                    >
                      <Up />
                    </button>
                    <button
                      type="button"
                      className="icon-btn sm step-move"
                      onClick={() => dispatch({ type: 'move', id: step.id, delta: 1 })}
                      disabled={i === steps.length - 1}
                      aria-label={t('step.down')}
                      title={t('step.down')}
                    >
                      <Down />
                    </button>
                    <button
                      type="button"
                      className="icon-btn sm danger"
                      onClick={() => dispatch({ type: 'remove', id: step.id })}
                      aria-label={t('step.remove')}
                      title={t('step.remove')}
                    >
                      <Trash />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="export-row">
        <button type="button" className="btn primary" onClick={onExport} disabled={!canExport}>
          <Download /> {t('pipeline.export')}
        </button>
        <button type="button" className="btn" onClick={() => copy(shareUrl(recipe), 'link')} disabled={!steps.length}>
          <Link /> {copied === 'link' ? t('pipeline.shared') : t('pipeline.share')}
        </button>
        <button type="button" className="btn" onClick={downloadRecipe} disabled={!steps.length}>
          <FileCode /> {t('pipeline.recipe')}
        </button>
      </div>

      {steps.length > 0 && (
        <details className="cli">
          <summary>
            <Terminal /> {t('pipeline.cli')}
          </summary>
          <div className="code-block" dir="ltr">
            <pre tabIndex={0}>
              <code>{command}</code>
            </pre>
            <button type="button" className="btn sm" onClick={() => copy(command.replace(/ \\\n {2}/g, ' '), 'cli')}>
              {copied === 'cli' ? t('pipeline.copied') : t('pipeline.copy')}
            </button>
          </div>
        </details>
      )}
    </div>
  )
}
