/**
 * Estimated AI generation progress.
 *
 * Qwen's voice-clone call does not report speech tokens or step counts.
 * Warm times come from the consented short-reference runs in
 * ai/outputs/short-ref-prosody/results.json: a short English sentence took
 * about 5.3–6.6 seconds once the model was loaded, and that load took 7 seconds.
 * Longer references in that run were not slower, so reference duration is not
 * used. Extra target characters add a small allowance because longer speech
 * needs more codec frames.
 *
 * The returned percent is an estimate until the caller hides the bar after the
 * audio bytes exist. It never reaches 100.
 */

export const WARM_GENERATE_BASE_MS = 4_500
export const MS_PER_TARGET_CHAR = 70
export const COLD_LOAD_MS = 8_000
export const MAX_ESTIMATE_MS = 45_000
const ESTIMATE_CAP = 0.92

export type GenerationPhase = 'preparing' | 'loading' | 'generating' | 'finishing'

export type GenerationProgress = {
  /** Null means the bar should be indeterminate. */
  percent: number | null
  estimate: boolean
  overrun: boolean
  /** Remaining time for the clip that is running, when the estimate still holds. */
  remainingMs: number | null
}

export function generationStatusLabel(phase: GenerationPhase, overrun: boolean, activeLabel: string): string {
  if (overrun) {
    const label = activeLabel.trim() || 'Generating voice...'
    const body = `${label.charAt(0).toLowerCase()}${label.slice(1)}`.replace(/\.\.\.$/, '')
    return `Still ${body}...`
  }
  if (phase === 'preparing') return 'Preparing AI...'
  if (phase === 'loading') return 'Starting the voice engine...'
  if (phase === 'finishing') return 'Finishing audio...'
  return activeLabel
}

export function warmGenerateMs(textLength: number): number {
  const chars = Math.max(1, Math.min(Math.round(textLength), 500))
  return Math.min(MAX_ESTIMATE_MS, WARM_GENERATE_BASE_MS + chars * MS_PER_TARGET_CHAR)
}

export function generationProgress(input: {
  phase: GenerationPhase
  elapsedMs: number
  coldStart: boolean
  textLength: number
  completed: number
  total: number
}): GenerationProgress {
  const total = Math.max(1, Math.round(input.total))
  const completed = Math.max(0, Math.min(Math.round(input.completed), total))
  const elapsedMs = Math.max(0, input.elapsedMs)

  if (input.phase === 'preparing') {
    return { percent: null, estimate: false, overrun: false, remainingMs: null }
  }

  if (input.phase === 'finishing') {
    const done = Math.min(total, completed + 1) / total
    return {
      percent: Math.min(96, Math.round(done * 96)),
      estimate: false,
      overrun: false,
      remainingMs: null,
    }
  }

  const budget = warmGenerateMs(input.textLength) + (input.coldStart ? COLD_LOAD_MS : 0)
  if (elapsedMs > budget) {
    return { percent: null, estimate: false, overrun: true, remainingMs: null }
  }

  const fraction = Math.min(ESTIMATE_CAP, elapsedMs / budget)
  const overall = (completed + fraction) / total
  const remainingMs = elapsedMs < budget * 0.85 ? Math.max(0, Math.round(budget - elapsedMs)) : null
  return {
    percent: Math.min(92, Math.round(overall * 100)),
    estimate: true,
    overrun: false,
    remainingMs,
  }
}
