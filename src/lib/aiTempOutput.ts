/**
 * Session-owned AI preview files. Saved library clips live in IndexedDB, so these
 * WAV files are only a worker scratch copy and may be removed after the bytes
 * have been copied into the renderer.
 */

export const TEMP_AI_OUTPUT_PREFIX = 'tmp-'
export const TEMP_AI_SESSION_PATTERN = /^tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{32}\.wav$/i
export const HISTORICAL_UUID_WAV_PATTERN = /^[0-9a-f]{32}\.wav$/i

const PROTECTED_NAME_PREFIXES = [
  'compare-',
  'nonstream-',
  'subtalker-',
  'reference',
] as const

export type TempOutputPhase =
  | 'generating'
  | 'previewing'
  | 'saving'
  | 'abandoned'
  | 'saved'
  | 'interrupted'
  | 'failed'

export type TempOutputRecord = {
  filename: string
  sessionId: string
  phase: TempOutputPhase
}

export function isProtectedAiOutputName(filename: string): boolean {
  const name = filename.toLowerCase()
  if (PROTECTED_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))) return true
  if (name.endsWith('.bin') || name.endsWith('.json') || name.endsWith('.pt') || name.endsWith('.safetensors')) {
    return true
  }
  return false
}

export function isHistoricalUuidWav(filename: string): boolean {
  return HISTORICAL_UUID_WAV_PATTERN.test(filename)
}

export function isSessionTempWav(filename: string, sessionId: string): boolean {
  if (!TEMP_AI_SESSION_PATTERN.test(filename)) return false
  return filename.toLowerCase().startsWith(`tmp-${sessionId.toLowerCase()}-`)
}

export function tempAiOutputFilename(sessionId: string, token: string): string {
  return `${TEMP_AI_OUTPUT_PREFIX}${sessionId}-${token}.wav`
}

export function createTempOutputRecord(
  sessionId: string,
  token: string,
  phase: TempOutputPhase = 'generating',
): TempOutputRecord {
  return {
    filename: tempAiOutputFilename(sessionId, token),
    sessionId,
    phase,
  }
}

/** Files this session may unlink. Historical UUID WAVs and benchmarks stay. */
export function canUnlinkTempAiOutput(
  record: TempOutputRecord,
  sessionId: string,
): { ok: true } | { ok: false; reason: string } {
  if (record.sessionId !== sessionId) {
    return { ok: false, reason: 'owned by another session' }
  }
  if (!isSessionTempWav(record.filename, sessionId)) {
    return { ok: false, reason: 'not a session-owned temporary file' }
  }
  if (isProtectedAiOutputName(record.filename) || isHistoricalUuidWav(record.filename)) {
    return { ok: false, reason: 'protected output' }
  }
  if (record.phase === 'generating' || record.phase === 'previewing' || record.phase === 'saving') {
    return { ok: false, reason: `still ${record.phase}` }
  }
  return { ok: true }
}

export function nextTempOutputPhase(
  current: TempOutputPhase,
  event: 'preview-ready' | 'save-started' | 'saved' | 'abandoned' | 'interrupted' | 'failed',
): TempOutputPhase {
  if (event === 'preview-ready' && current === 'generating') return 'previewing'
  if (event === 'save-started' && (current === 'previewing' || current === 'generating')) return 'saving'
  if (event === 'saved') return 'saved'
  if (event === 'abandoned' && current !== 'saving' && current !== 'generating') return 'abandoned'
  if (event === 'interrupted' && current === 'generating') return 'interrupted'
  if (event === 'failed') return 'failed'
  return current
}

export function cleanupTempAiOutputs(input: {
  records: TempOutputRecord[]
  sessionId: string
  unlink: (filename: string) => boolean
}): { removed: string[]; kept: Array<{ filename: string; reason: string }> } {
  const removed: string[] = []
  const kept: Array<{ filename: string; reason: string }> = []
  for (const record of input.records) {
    const decision = canUnlinkTempAiOutput(record, input.sessionId)
    if (!decision.ok) {
      kept.push({ filename: record.filename, reason: decision.reason })
      continue
    }
    try {
      if (input.unlink(record.filename)) removed.push(record.filename)
      else kept.push({ filename: record.filename, reason: 'unlink declined' })
    } catch {
      kept.push({ filename: record.filename, reason: 'unlink failed' })
    }
  }
  return { removed, kept }
}

export function scanAiOutputForCleanup(input: {
  filenames: string[]
  sessionId: string
}): { eligible: string[]; reviewLater: string[] } {
  const eligible: string[] = []
  const reviewLater: string[] = []
  for (const filename of input.filenames) {
    if (isSessionTempWav(filename, input.sessionId) && !isProtectedAiOutputName(filename)) {
      eligible.push(filename)
      continue
    }
    reviewLater.push(filename)
  }
  return { eligible, reviewLater }
}

/** Crash leftovers that this app created. Historical UUID WAVs stay for review. */
export function isOrphanSessionTempWav(filename: string): boolean {
  const name = filename.replace(/^.*[\\/]/, '')
  return TEMP_AI_SESSION_PATTERN.test(name) && !isProtectedAiOutputName(name) && !isHistoricalUuidWav(name)
}

export function scanOrphanSessionTempWavs(filenames: string[]): {
  eligible: string[]
  reviewLater: string[]
} {
  const eligible: string[] = []
  const reviewLater: string[] = []
  for (const filename of filenames) {
    if (isOrphanSessionTempWav(filename)) eligible.push(filename)
    else reviewLater.push(filename)
  }
  return { eligible, reviewLater }
}
