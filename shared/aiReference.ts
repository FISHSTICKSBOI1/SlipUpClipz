/** AI Clone reference limits. The Python server enforces the same window. */

export const MIN_REFERENCE_SEC = 0.8
export const MAX_REFERENCE_SEC = 7
export const MIN_REFERENCE_MS = 800
export const MAX_REFERENCE_MS = 7_000
export const MAX_REFERENCE_TEXT_CHARS = 300
export const REFERENCE_SAMPLE_RATE = 24_000
export const MAX_WAV_BYTES = 1024 * 1024

/** True when a decoded clip duration may be sent to AI Clone. */
export function referenceSecondsAllowed(seconds: number): boolean {
  return seconds >= MIN_REFERENCE_SEC && Math.round(seconds * 1000) <= MAX_REFERENCE_MS
}

/** True when the clip library duration may open AI Clone. */
export function referenceDurationMsAllowed(durationMs: number): boolean {
  return durationMs >= MIN_REFERENCE_MS && durationMs <= MAX_REFERENCE_MS
}

/** Every accepted duration is rendered in full. There is no shorter frame cap. */
export function referenceWavFrameCount(seconds: number): number {
  return Math.round(seconds * REFERENCE_SAMPLE_RATE)
}

export function referenceWavBytes(seconds: number): number {
  return 44 + referenceWavFrameCount(seconds) * 2
}
