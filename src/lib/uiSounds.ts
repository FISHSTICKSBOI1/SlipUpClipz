import clipSavedSoundUrl from '../assets/sounds/clip-saved.mp3'
import toggleOnSoundUrl from '../assets/sounds/toggle-on.mp3'
import toggleOffSoundUrl from '../assets/sounds/toggle-off.mp3'

/**
 * Local desktop UI feedback sounds.
 * Plays through the default system output only — never the soundboard / VB-Cable graph.
 */

type UISoundName = 'clipSaved' | 'toggleOn' | 'toggleOff'

const soundUrls: Record<UISoundName, string> = {
  clipSaved: clipSavedSoundUrl,
  toggleOn: toggleOnSoundUrl,
  toggleOff: toggleOffSoundUrl,
}

const volumeBySound: Record<UISoundName, number> = {
  clipSaved: 0.45,
  toggleOn: 0.3,
  toggleOff: 0.3,
}

const COOLDOWN_MS = 55

let uiSoundsEnabled = true
const lastPlayedAt: Partial<Record<UISoundName, number>> = {}
const preloaded = new Map<UISoundName, HTMLAudioElement>()

export function setUISoundsEnabled(enabled: boolean): void {
  uiSoundsEnabled = enabled
}

export function areUISoundsEnabled(): boolean {
  return uiSoundsEnabled
}

function ensurePreloaded(soundName: UISoundName): HTMLAudioElement {
  const existing = preloaded.get(soundName)
  if (existing) return existing

  const audio = new Audio(soundUrls[soundName])
  audio.preload = 'auto'
  audio.volume = volumeBySound[soundName]
  // Warm the element without audible playback when possible.
  void audio.load()
  preloaded.set(soundName, audio)
  return audio
}

/** Call once after first user gesture if desired; safe to call repeatedly. */
export function preloadUISounds(): void {
  try {
    ensurePreloaded('clipSaved')
    ensurePreloaded('toggleOn')
    ensurePreloaded('toggleOff')
  } catch (error) {
    console.warn('Unable to preload UI sounds:', error)
  }
}

function playUISound(soundName: UISoundName): void {
  if (!uiSoundsEnabled) return

  const now = performance.now()
  const last = lastPlayedAt[soundName] ?? 0
  if (now - last < COOLDOWN_MS) return
  lastPlayedAt[soundName] = now

  try {
    // Fresh Audio instance so rapid toggles / clip saves can overlap safely.
    const audio = new Audio(soundUrls[soundName])
    audio.preload = 'auto'
    audio.volume = volumeBySound[soundName]
    audio.currentTime = 0

    void audio.play().catch((error: unknown) => {
      console.warn(`Unable to play ${soundName} UI sound:`, error)
    })
  } catch (error) {
    console.warn(`Unable to initialize ${soundName} UI sound:`, error)
  }
}

export function playClipSavedSound(): void {
  playUISound('clipSaved')
}

export function playToggleOnSound(): void {
  playUISound('toggleOn')
}

export function playToggleOffSound(): void {
  playUISound('toggleOff')
}

/** Play the matching on/off sound for a deliberate Boolean toggle. */
export function playToggleSound(nextEnabled: boolean): void {
  if (nextEnabled) {
    playToggleOnSound()
  } else {
    playToggleOffSound()
  }
}
