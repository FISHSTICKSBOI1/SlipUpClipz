import { PRO_SOUNDBOARD_PAD_LIMIT } from '@shared/appTypes'

export const SOUNDBOARD_COLUMNS = 5
export const SOUNDBOARD_ROWS = 10
export const SOUNDBOARD_SLOT_COUNT = PRO_SOUNDBOARD_PAD_LIMIT

export const PAD_VOLUME_DEFAULT = 100
export const PAD_VOLUME_MIN = 0
/** Safe amplified maximum (150% = +3.5 dB-ish). */
export const PAD_VOLUME_MAX = 150

const STORAGE_KEY = 'slipupclipz-soundboard'
const STATE_VERSION = 3

export type SoundboardPad = {
  clipId: string | null
  volume: number
}

export type SoundboardState = {
  version: number
  pads: SoundboardPad[]
}

/** Legacy format still accepted on load. */
export type SoundboardSlots = Array<string | null>

function emptyPads(): SoundboardPad[] {
  return Array.from({ length: SOUNDBOARD_SLOT_COUNT }, () => ({
    clipId: null,
    volume: PAD_VOLUME_DEFAULT,
  }))
}

function normalizeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PAD_VOLUME_DEFAULT
  }
  return Math.max(PAD_VOLUME_MIN, Math.min(PAD_VOLUME_MAX, Math.round(value)))
}

function migrateLegacySlots(parsed: unknown[]): SoundboardPad[] {
  const pads = emptyPads()
  for (let i = 0; i < SOUNDBOARD_SLOT_COUNT; i += 1) {
    const value = parsed[i]
    pads[i] = {
      clipId: typeof value === 'string' ? value : null,
      volume: PAD_VOLUME_DEFAULT,
    }
  }
  return pads
}

function normalizePads(rawPads: unknown): SoundboardPad[] {
  const pads = emptyPads()
  if (!Array.isArray(rawPads)) return pads

  for (let i = 0; i < SOUNDBOARD_SLOT_COUNT; i += 1) {
    const entry = rawPads[i]
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Partial<SoundboardPad>
    pads[i] = {
      clipId: typeof record.clipId === 'string' ? record.clipId : null,
      volume: normalizeVolume(record.volume),
    }
  }
  return pads
}

export function loadSoundboardState(): SoundboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { version: STATE_VERSION, pads: emptyPads() }
    }

    const parsed = JSON.parse(raw) as unknown

    // Legacy: bare array of clip ids / null
    if (Array.isArray(parsed)) {
      return { version: STATE_VERSION, pads: migrateLegacySlots(parsed) }
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Partial<SoundboardState>
      return {
        version: STATE_VERSION,
        pads: normalizePads(record.pads),
      }
    }

    return { version: STATE_VERSION, pads: emptyPads() }
  } catch {
    return { version: STATE_VERSION, pads: emptyPads() }
  }
}

export function saveSoundboardState(state: SoundboardState): void {
  const payload: SoundboardState = {
    version: STATE_VERSION,
    pads: state.pads.slice(0, SOUNDBOARD_SLOT_COUNT).map((pad) => ({
      clipId: pad.clipId,
      volume: normalizeVolume(pad.volume),
    })),
  }

  while (payload.pads.length < SOUNDBOARD_SLOT_COUNT) {
    payload.pads.push({ clipId: null, volume: PAD_VOLUME_DEFAULT })
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/** @deprecated Prefer loadSoundboardState — kept for migration callers. */
export function loadSoundboardSlots(): SoundboardSlots {
  return loadSoundboardState().pads.map((pad) => pad.clipId)
}

/** @deprecated Prefer saveSoundboardState */
export function saveSoundboardSlots(slots: SoundboardSlots): void {
  const current = loadSoundboardState()
  const pads = emptyPads()
  for (let i = 0; i < SOUNDBOARD_SLOT_COUNT; i += 1) {
    pads[i] = {
      clipId: typeof slots[i] === 'string' ? slots[i] : null,
      volume: current.pads[i]?.volume ?? PAD_VOLUME_DEFAULT,
    }
  }
  saveSoundboardState({ version: STATE_VERSION, pads })
}

export function padVolumeToGain(percent: number): number {
  const clamped = normalizeVolume(percent)
  // 100% → 1.0, 150% → 1.35 (safe headroom before the mix compressor)
  return (clamped / 100) * 0.9
}
