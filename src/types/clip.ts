export type ClipSource = 'recorded' | 'imported'

export type Clip = {
  id: string
  name: string
  createdAt: number
  durationMs: number
  hotkey?: string
  hasAudio?: boolean
  mimeType?: string
  isDraft?: boolean
  /** Where the clip came from. Older clips without this are treated as recorded. */
  source?: ClipSource
  /** Original filename for imported audio. */
  originalFileName?: string
  /** Category id, or null/undefined for Uncategorized. */
  categoryId?: string | null
  favorite?: boolean
  lastPlayedAt?: number
  /** Fingerprint used to detect duplicate imports. */
  importFingerprint?: string
}

export type ClipCategory = {
  id: string
  name: string
  createdAt: number
}

export type AddClipOptions = {
  draft?: boolean
  skipDownload?: boolean
}

export type RecordingResult = {
  blob: Blob
  mimeType: string
  durationMs: number
}

export type ImportAudioResult =
  | { ok: true; clip: Clip; duplicateOf?: Clip }
  | { ok: false; error: string }
