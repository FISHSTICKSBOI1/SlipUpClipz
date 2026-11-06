import { sampleClips } from '../data/sampleClips'
import type { Clip } from '../types/clip'

const STORAGE_KEY = 'slipupclipz-clip-library'
let clipLibraryUnreadable = false

export function clipLibraryUnreadableState(): boolean {
  return clipLibraryUnreadable
}

export function clipLibraryLoadError(): string | null {
  return clipLibraryUnreadable
    ? 'Saved clips could not be read. They were left on this PC and were not replaced.'
    : null
}

/**
 * Development-only sample clips. Keep disabled in production so the Clip Library
 * opens empty for new users and deleted clips stay deleted after relaunch.
 */
export const ENABLE_DEV_SAMPLE_CLIPS = false

const SAMPLE_CLIP_IDS = new Set(sampleClips.map((clip) => clip.id))

function stripLegacySampleClips(clips: Clip[]): Clip[] {
  if (ENABLE_DEV_SAMPLE_CLIPS) {
    return clips
  }
  return clips.filter((clip) => !SAMPLE_CLIP_IDS.has(clip.id))
}

export function loadClips(): Clip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      clipLibraryUnreadable = false
      return ENABLE_DEV_SAMPLE_CLIPS ? sampleClips : []
    }

    const parsed = JSON.parse(raw) as Clip[]
    if (!Array.isArray(parsed)) {
      clipLibraryUnreadable = true
      return []
    }

    clipLibraryUnreadable = false
    return stripLegacySampleClips(parsed)
  } catch {
    clipLibraryUnreadable = true
    return []
  }
}

export function saveClips(clips: Clip[]): void {
  if (clipLibraryUnreadable) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clips))
}
