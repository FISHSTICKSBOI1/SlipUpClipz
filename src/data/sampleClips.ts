import type { Clip } from '../types/clip'

/**
 * Dev-only fixture data. Loaded only when ENABLE_DEV_SAMPLE_CLIPS is true
 * in src/lib/clipStorage.ts (disabled by default).
 */
const day = 24 * 60 * 60 * 1000
const now = Date.now()

export const sampleClips: Clip[] = [
  {
    id: 'clip-1',
    name: 'Victory Stinger',
    createdAt: now - day * 0.5,
    durationMs: 3200,
    hotkey: 'Ctrl+1',
  },
  {
    id: 'clip-2',
    name: 'Fail Buzzer',
    createdAt: now - day * 1.2,
    durationMs: 1800,
    hotkey: 'Ctrl+2',
  },
  {
    id: 'clip-3',
    name: 'Crowd Cheer',
    createdAt: now - day * 2,
    durationMs: 4500,
  },
  {
    id: 'clip-4',
    name: 'Air Horn',
    createdAt: now - day * 3.5,
    durationMs: 900,
    hotkey: 'Ctrl+H',
  },
  {
    id: 'clip-5',
    name: 'Level Up',
    createdAt: now - day * 5,
    durationMs: 2100,
  },
  {
    id: 'clip-6',
    name: 'Dramatic Pause',
    createdAt: now - day * 7,
    durationMs: 1500,
    hotkey: 'Ctrl+P',
  },
]
