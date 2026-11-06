import type { RecordingResult } from '../types/clip'
import { logClipPipeline, summarizeBlob } from './clipPipelineLog'

const TRIMMED_MIME_TYPE = 'audio/wav'

export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const sampleRate = buffer.sampleRate
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const endSample = Math.min(buffer.length, Math.ceil(endSec * sampleRate))
  const length = Math.max(1, endSample - startSample)

  const trimmed = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate,
  })

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = trimmed.getChannelData(channel)
    target.set(source.subarray(startSample, endSample))
  }

  return trimmed
}

function encodeWav(buffer: AudioBuffer): Blob {
  const bytes = encodePcmWav(pcmFromAudioBuffer(buffer))
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: TRIMMED_MIME_TYPE })
}

export type PcmBlock = {
  sampleRate: number
  channels: Float32Array[]
}

export type RemoveSelectionResult =
  | { ok: true; audio: PcmBlock; durationMs: number }
  | { ok: false; error: string }

export type CutMarkers = {
  first: number | null
  second: number | null
}

export function emptyCutMarkers(): CutMarkers {
  return { first: null, second: null }
}

function clampMarker(playheadSec: number, durationSec: number): number {
  if (!Number.isFinite(playheadSec)) return 0
  return Math.max(0, Math.min(playheadSec, Math.max(0, durationSec)))
}

/**
 * C at the cut cursor. The third press clears the pair and starts again.
 * Marker order does not matter; the span uses the earlier and later time.
 */
export function placeCutMarker(markers: CutMarkers, playheadSec: number, durationSec: number): CutMarkers {
  const at = clampMarker(playheadSec, durationSec)
  if (markers.first === null || markers.second !== null) {
    return { first: at, second: null }
  }
  return { first: markers.first, second: at }
}

/** Earlier and later marker, ignoring which was placed first. */
export function cutMarkerBounds(
  markers: CutMarkers,
): { startSec: number; endSec: number } | null {
  if (markers.first === null || markers.second === null) return null
  const startSec = Math.min(markers.first, markers.second)
  const endSec = Math.max(markers.first, markers.second)
  if (endSec - startSec < 0.01) return null
  return { startSec, endSec }
}

/** A removable span. The same point, or the whole recording, is refused. */
export function cutSpanFromMarkers(
  markers: CutMarkers,
  durationSec: number,
): { startSec: number; endSec: number } | null {
  const bounds = cutMarkerBounds(markers)
  if (!bounds || !Number.isFinite(durationSec) || durationSec <= 0) return null
  if (bounds.startSec <= 0.01 && bounds.endSec >= durationSec - 0.01) return null
  return bounds
}

/**
 * C places a marker only in Cut mode, with the editor focused, and with no modifiers.
 * Typing, Ctrl+C, and keys while the editor is not focused are left alone.
 */
export function cutMarkerKeyDecision(input: {
  cutMode: boolean
  editorFocused: boolean
  key: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  editable: boolean
}): 'place' | 'ignore' {
  if (!input.cutMode || !input.editorFocused) return 'ignore'
  if (input.repeat || input.editable) return 'ignore'
  if (input.ctrlKey || input.metaKey || input.altKey || input.shiftKey) return 'ignore'
  if (input.key.toLowerCase() !== 'c') return 'ignore'
  return 'place'
}

export type CutModeKeyAction = 'cancel' | 'place' | 'block' | 'pass'

/**
 * Cut mode keeps C, Esc, and typing. Other keys while the waveform is focused
 * must not reach playback, trim, or pad shortcuts.
 */
export function cutModeKeyDecision(input: {
  cutMode: boolean
  editorFocused: boolean
  key: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  editable: boolean
}): CutModeKeyAction {
  if (!input.cutMode) return 'pass'
  if (input.key === 'Escape') return 'cancel'
  if (input.editable || !input.editorFocused) return 'pass'
  if (cutMarkerKeyDecision(input) === 'place') return 'place'
  return 'block'
}

/** Where the cut cursor sits. It is not the playback playhead. */
export function positionCutCursor(sec: number, durationSec: number): number {
  return clampMarker(sec, durationSec)
}

/**
 * While Cut mode is on, playback, seeking, and trim handles stay off.
 * Undo and Save are available after a finished cut, with no markers waiting.
 * An unfinished marker pair keeps Save off so a partial selection cannot be saved.
 */
export function cutModeControls(input: {
  cutMode: boolean
  pendingMarkers: boolean
  completedCuts: boolean
}): {
  playback: boolean
  playhead: boolean
  trimming: boolean
  save: boolean
  undo: boolean
  clearSelection: boolean
  cancel: boolean
} {
  if (!input.cutMode) {
    return {
      playback: true,
      playhead: true,
      trimming: true,
      save: true,
      undo: input.completedCuts,
      clearSelection: false,
      cancel: false,
    }
  }
  const finishedCutReady = input.completedCuts && !input.pendingMarkers
  return {
    playback: false,
    playhead: false,
    trimming: false,
    save: finishedCutReady,
    undo: finishedCutReady,
    clearSelection: input.pendingMarkers,
    cancel: true,
  }
}

/** Pro users may cut a region out. Free users keep ordinary start/end trim. */
export function removeSelectionAllowed(isPro: boolean): boolean {
  return isPro
}

/**
 * Basic trim still replaces the clip being edited.
 * A ripple cut is saved as a new clip and only when Pro is active.
 */
export function trimSavePlan(input: {
  hasRemovals: boolean
  isPro: boolean
}): 'replace-original' | 'new-clip' | 'denied' {
  if (!input.hasRemovals) return 'replace-original'
  if (!removeSelectionAllowed(input.isPro)) return 'denied'
  return 'new-clip'
}

function pcmRangeMatches(
  source: Float32Array,
  saved: Float32Array,
  start: number,
  length: number,
  epsilon: number,
): boolean {
  for (let i = 0; i < length; i++) {
    if (Math.abs((source[start + i] ?? 0) - (saved[i] ?? 0)) > epsilon) return false
  }
  return true
}

export const TRIM_SAVE_UNVERIFIED_MESSAGE =
  'Could not verify this edit. Your original clip is unchanged. Try saving again.'

/** Ordinary trim is the opened recording sliced at start/end. A ripple join is not. */
export function pcmLooksLikeRemoval(
  original: PcmBlock,
  saved: PcmBlock,
  startSec: number,
  endSec: number,
  epsilon = 0.03,
): boolean {
  if (original.sampleRate !== saved.sampleRate) return true
  if (original.channels.length !== saved.channels.length) return true
  const source = original.channels[0]
  const needle = saved.channels[0]
  if (!source || !needle) return true
  const range = frameRange(original.sampleRate, source.length, startSec, endSec)
  if (!range) return true
  const expected = range.end - range.start
  if (Math.abs(expected - needle.length) > 2) return true
  const length = Math.min(expected, needle.length)
  return original.channels.some(
    (channel, index) => !pcmRangeMatches(channel, saved.channels[index] ?? channel, range.start, length, epsilon),
  )
}

/**
 * A ripple cut creates a new clip only after the main process allows it.
 * Basic trimming still replaces the open clip and does not ask for Pro.
 * PCM content, not a renderer boolean, decides whether the save is a cut.
 */
export function removalSaveAction(input: {
  asNewClip: boolean
  mainAllows: boolean
  originalId: string
  looksLikeRemoval?: boolean
}): { action: 'deny' } | { action: 'create' } | { action: 'replace'; id: string } {
  if (input.looksLikeRemoval || input.asNewClip) {
    if (!input.mainAllows) return { action: 'deny' }
    return { action: 'create' }
  }
  return { action: 'replace', id: input.originalId }
}

export type TrimSaveAudioCheck =
  | { ok: false }
  | { ok: true; looksLikeRemoval: boolean }

/** Decode failure cannot be treated as a Free trim. The original clip must stay. */
export function verifyTrimSaveAudio(input: {
  original: PcmBlock | null
  saved: PcmBlock | null
  startSec?: number
  endSec?: number
}): TrimSaveAudioCheck {
  if (!input.original || !input.saved) return { ok: false }
  const startSec = input.startSec
  const endSec = input.endSec
  if (startSec === undefined || endSec === undefined || !Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return { ok: true, looksLikeRemoval: true }
  }
  return {
    ok: true,
    looksLikeRemoval: pcmLooksLikeRemoval(input.original, input.saved, startSec, endSec),
  }
}

export function trimSaveOutcome(input: {
  verified: TrimSaveAudioCheck
  asNewClip: boolean
  mainAllows: boolean
  originalId: string
}): { action: 'unverified' } | { action: 'deny' } | { action: 'create' } | { action: 'replace'; id: string } {
  if (!input.verified.ok) return { action: 'unverified' }
  return removalSaveAction({
    asNewClip: input.asNewClip,
    mainAllows: input.mainAllows,
    originalId: input.originalId,
    looksLikeRemoval: input.verified.looksLikeRemoval,
  })
}

function frameRange(
  sampleRate: number,
  length: number,
  startSec: number,
  endSec: number,
): { start: number; end: number } | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || length <= 0) return null
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
  const start = Math.max(0, Math.min(length, Math.floor(startSec * sampleRate)))
  const end = Math.max(0, Math.min(length, Math.ceil(endSec * sampleRate)))
  if (end <= start) return null
  return { start, end }
}

/**
 * Drop samples from start through end and join the remainder.
 * A 1 ms fade is applied only at an interior join so the splice does not click.
 */
export function removePcmSelection(
  block: PcmBlock,
  startSec: number,
  endSec: number,
  fadeMs = 1,
): RemoveSelectionResult {
  const length = block.channels[0]?.length ?? 0
  if (block.channels.length === 0 || block.channels.some((channel) => channel.length !== length)) {
    return { ok: false, error: 'This clip cannot be cut.' }
  }
  const range = frameRange(block.sampleRate, length, startSec, endSec)
  if (!range) return { ok: false, error: 'Choose a region inside the clip to remove.' }

  const before = range.start
  const after = length - range.end
  const kept = before + after
  if (kept < 1) return { ok: false, error: 'Removing that region would leave no audio.' }

  const fade = before > 0 && after > 0 ? Math.min(before, after, Math.round((fadeMs / 1000) * block.sampleRate)) : 0
  const channels = block.channels.map((source) => {
    const target = new Float32Array(kept)
    target.set(source.subarray(0, before), 0)
    target.set(source.subarray(range.end), before)
    for (let i = 0; i < fade; i++) {
      const outGain = (fade - i) / fade
      const inGain = (i + 1) / fade
      const left = before - fade + i
      target[left] *= outGain
      target[before + i] *= inGain
    }
    return target
  })

  return {
    ok: true,
    audio: { sampleRate: block.sampleRate, channels },
    durationMs: Math.round((kept / block.sampleRate) * 1000),
  }
}

export function encodePcmWav(block: PcmBlock): Uint8Array {
  const channelCount = block.channels.length
  const sampleCount = block.channels[0]?.length ?? 0
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = channelCount * bytesPerSample
  const dataLength = sampleCount * blockAlign
  const bytes = new Uint8Array(44 + dataLength)
  const view = new DataView(bytes.buffer)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i)
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, block.sampleRate, true)
  view.setUint32(28, block.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < sampleCount; i++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, block.channels[channel][i] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return bytes
}

export type EditSession = {
  original: PcmBlock
  current: PcmBlock
  undo: PcmBlock[]
}

export function beginEditSession(audio: PcmBlock): EditSession {
  return { original: audio, current: audio, undo: [] }
}

export function commitRemoval(
  session: EditSession,
  startSec: number,
  endSec: number,
  isPro: boolean,
): { session: EditSession; error: string | null; durationMs: number } {
  if (!removeSelectionAllowed(isPro)) {
    return { session, error: 'Remove Selection is a Pro feature.', durationMs: 0 }
  }
  const removed = removePcmSelection(session.current, startSec, endSec)
  if (!removed.ok) return { session, error: removed.error, durationMs: 0 }
  return {
    session: {
      original: session.original,
      current: removed.audio,
      undo: [...session.undo, session.current],
    },
    error: null,
    durationMs: removed.durationMs,
  }
}

export function undoEdit(session: EditSession): EditSession {
  const previous = session.undo[session.undo.length - 1]
  if (!previous) return session
  return { original: session.original, current: previous, undo: session.undo.slice(0, -1) }
}

export function resetEdit(session: EditSession): EditSession {
  return { original: session.original, current: session.original, undo: [] }
}

/** After a cut, the waveform and playhead describe the joined clip from the start. */
export function viewAfterRemoval(durationSec: number): { playheadSec: number; startSec: number; endSec: number } {
  return { playheadSec: 0, startSec: 0, endSec: durationSec }
}

export function pcmFromAudioBuffer(buffer: AudioBuffer): PcmBlock {
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
      buffer.getChannelData(channel).slice(),
    ),
  }
}

export function audioBufferFromPcm(block: PcmBlock): AudioBuffer {
  const next = new AudioBuffer({
    length: Math.max(1, block.channels[0]?.length ?? 1),
    numberOfChannels: Math.max(1, block.channels.length),
    sampleRate: block.sampleRate,
  })
  block.channels.forEach((channel, index) => next.copyToChannel(new Float32Array(channel), index))
  return next
}

export function removeAudioBufferSelection(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): { ok: true; buffer: AudioBuffer; durationMs: number } | { ok: false; error: string } {
  const removed = removePcmSelection(pcmFromAudioBuffer(buffer), startSec, endSec)
  if (!removed.ok) return removed
  return { ok: true, buffer: audioBufferFromPcm(removed.audio), durationMs: removed.durationMs }
}

export function trimAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): RecordingResult {
  const trimmed = sliceAudioBuffer(buffer, startSec, endSec)
  const blob = encodeWav(trimmed)
  const durationMs = Math.round((trimmed.length / trimmed.sampleRate) * 1000)

  logClipPipeline('trim:encoded', {
    mimeType: TRIMMED_MIME_TYPE,
    blob: summarizeBlob(blob),
    durationMs,
    startSec,
    endSec,
  })

  return {
    blob,
    mimeType: TRIMMED_MIME_TYPE,
    durationMs,
  }
}
