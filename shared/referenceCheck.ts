/** Read-only checks for an AI reference. Nothing here changes the recording. */

export type ReferenceWarningCode = 'invalid' | 'short' | 'clipping' | 'cutoff' | 'silence' | 'quiet'

export type ReferenceWarning = {
  code: ReferenceWarningCode
  message: string
}

const CLIP_LEVEL = 0.98
const SILENCE_LEVEL = 0.02

export function inspectReferencePcm(samples: ArrayLike<number>, sampleRate: number): ReferenceWarning[] {
  const count = samples.length
  if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || count < 2) {
    return [invalidRecording()]
  }

  let peak = 0
  let clipped = 0
  let silent = 0
  let finite = 0
  let sumSq = 0
  for (let index = 0; index < count; index += 1) {
    const sample = samples[index] ?? 0
    if (!Number.isFinite(sample)) continue
    finite += 1
    const abs = Math.abs(sample)
    if (abs > peak) peak = abs
    if (abs >= CLIP_LEVEL) clipped += 1
    if (abs < SILENCE_LEVEL) silent += 1
    sumSq += sample * sample
  }

  if (finite < count * 0.5 || peak === 0) return [invalidRecording()]

  const warnings: ReferenceWarning[] = []
  const duration = count / sampleRate
  if (duration < 2) {
    warnings.push({
      code: 'short',
      message: 'A complete 2–3 second phrase usually clones more naturally than a clip under 2 seconds.',
    })
  }
  if (clipped / finite > 0.005) {
    warnings.push({
      code: 'clipping',
      message: 'This recording looks clipped. Flattened peaks can make the clone sound harsh.',
    })
  }
  if (silent / finite > 0.55) {
    warnings.push({
      code: 'silence',
      message: 'A lot of this clip is silence. Trim it to the spoken phrase before generating.',
    })
  }
  const rms = Math.sqrt(sumSq / finite)
  if (rms < 0.01 && peak < 0.08) {
    warnings.push({
      code: 'quiet',
      message: 'This recording is very quiet. The clone may miss the voice.',
    })
  }
  if (edgeLooksCut(samples, sampleRate, count)) {
    warnings.push({
      code: 'cutoff',
      message: 'Speech may be cut off at the start or end. Trim so the first and last words are complete.',
    })
  }
  return warnings
}

export function transcriptAccuracyWarning(input: {
  durationSec: number
  status: 'idle' | 'transcribing' | 'ready' | 'review' | 'truncated' | 'no-speech' | 'failed'
}): string | null {
  if (input.status === 'review' || input.status === 'truncated' || input.status === 'failed') {
    return 'Check the automatic transcript. A wrong word changes how the voice is cloned.'
  }
  if (input.durationSec < 2 && input.status === 'ready') {
    return 'Automatic transcripts of clips under 2 seconds are often wrong. Read every word before generating.'
  }
  return null
}

function invalidRecording(): ReferenceWarning {
  return { code: 'invalid', message: 'This recording could not be read as usable audio.' }
}

function edgeLooksCut(samples: ArrayLike<number>, sampleRate: number, count: number): boolean {
  const edge = Math.min(count, Math.round(sampleRate * 0.02))
  if (edge < 8) return false
  return windowMeanAbs(samples, 0, edge) > 0.22 || windowMeanAbs(samples, count - edge, count) > 0.22
}

function windowMeanAbs(samples: ArrayLike<number>, start: number, end: number): number {
  let sum = 0
  let count = 0
  for (let index = start; index < end; index += 1) {
    const sample = samples[index] ?? 0
    if (!Number.isFinite(sample)) continue
    sum += Math.abs(sample)
    count += 1
  }
  return count > 0 ? sum / count : 0
}

