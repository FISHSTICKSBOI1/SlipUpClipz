import { generationProgress, generationStatusLabel, type GenerationPhase } from '@shared/generationProgress'

function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}:${rest.toString().padStart(2, '0')}` : `${seconds}s`
}

export function GenerationProgress({
  phase,
  elapsedMs,
  coldStart,
  textLength,
  completed,
  total,
  activeLabel,
}: {
  phase: GenerationPhase
  elapsedMs: number
  coldStart: boolean
  textLength: number
  completed: number
  total: number
  activeLabel: string
}) {
  const view = generationProgress({ phase, elapsedMs, coldStart, textLength, completed, total })
  const status = generationStatusLabel(phase, view.overrun, activeLabel)
  const elapsed = `Elapsed ${formatSeconds(elapsedMs)}`
  const remaining = view.remainingMs !== null ? `About ${formatSeconds(view.remainingMs)} left` : ''
  const percentLabel = view.percent === null || view.percent === 0 ? '' : view.estimate ? `About ${view.percent}%` : `${view.percent}%`

  return (
    <div
      className="space-y-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-white">{status}</p>
        {percentLabel && <p className="text-xs tabular-nums text-accent-hover">{percentLabel}</p>}
      </div>
      <div
        className="generation-track"
        role="progressbar"
        aria-label={status}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent ?? undefined}
        aria-valuetext={view.percent === null ? status : `${status.replace(/\.\.\.$/, '')}. ${percentLabel}.`}
      >
        {view.percent === null ? (
          <div className="generation-indeterminate" />
        ) : (
          <div className="generation-fill" style={{ width: `${view.percent}%` }} />
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {elapsed}
        {remaining ? ` · ${remaining}` : ''}
        {view.estimate ? ' · Estimated' : ''}
      </p>
    </div>
  )
}
