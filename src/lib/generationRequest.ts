/**
 * One AI generation, then Generate Again from the inputs that succeeded.
 * The snapshot is independent of later edits to the dialog fields.
 */

export type GenerationRequestSnapshot = {
  clipId: string
  /** Exact WAV bytes sent to the engine. */
  referenceWav: Uint8Array
  /** Saved clip bytes, used only to detect a missing or replaced reference. */
  referenceSource: Uint8Array
  referenceTranscript: string
  targetText: string
  language: 'English'
  /** Start of the reference audio that was encoded, in seconds. */
  startSec: number
  /** End of the reference audio that was encoded, in seconds. */
  endSec: number
}

export type GeneratedResult = {
  id: string
  wav: Uint8Array
}

const MISSING_REFERENCE = 'The original reference clip is no longer available. Generate Again was not run.'
const CHANGED_REFERENCE = 'The original reference clip has changed. Generate Again was not run.'

export function captureGenerationRequest(input: {
  clipId: string
  referenceWav: Uint8Array
  referenceSource: Uint8Array
  referenceTranscript: string
  targetText: string
  startSec: number
  endSec: number
}): GenerationRequestSnapshot {
  return {
    clipId: input.clipId,
    referenceWav: input.referenceWav.slice(),
    referenceSource: input.referenceSource.slice(),
    referenceTranscript: input.referenceTranscript,
    targetText: input.targetText,
    language: 'English',
    startSec: input.startSec,
    endSec: input.endSec,
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function generationAgainRequest(
  snapshot: GenerationRequestSnapshot,
  currentSource: Uint8Array | null,
):
  | {
      ok: true
      audioWav: Uint8Array
      refText: string
      text: string
      language: 'English'
      startSec: number
      endSec: number
    }
  | { ok: false; error: string } {
  if (!currentSource) return { ok: false, error: MISSING_REFERENCE }
  if (!sameBytes(currentSource, snapshot.referenceSource)) return { ok: false, error: CHANGED_REFERENCE }
  return {
    ok: true,
    audioWav: snapshot.referenceWav.slice(),
    refText: snapshot.referenceTranscript,
    text: snapshot.targetText,
    language: snapshot.language,
    startSec: snapshot.startSec,
    endSec: snapshot.endSec,
  }
}

/** A failed attempt returns the same results. A success appends one clip. */
export function resultsAfterGeneration(
  previous: readonly GeneratedResult[],
  next: Uint8Array | null,
  id: string,
): GeneratedResult[] {
  if (!next) return [...previous]
  return [...previous, { id, wav: next.slice() }]
}
