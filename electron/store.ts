import Store from 'electron-store'
import {
  DEFAULT_LICENSE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type HotkeyBinding,
  type LicenseState,
  type VoiceEffectsPreset,
} from '../shared/appTypes.js'

type StoreSchema = {
  settings: AppSettings
  license: LicenseState
}

const VALID_VOICE_PRESETS: VoiceEffectsPreset[] = [
  'normal',
  'deep',
  'squeaky',
  'radio',
  'robot',
  'custom',
]

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

export const settingsStore = new Store<StoreSchema>({
  name: 'slipupclipz',
  defaults: {
    settings: DEFAULT_SETTINGS,
    license: DEFAULT_LICENSE,
  },
})

export function getSettings(): AppSettings {
  const stored = settingsStore.get('settings') as Partial<AppSettings> | undefined
  const merged = { ...DEFAULT_SETTINGS, ...stored }

  // Safe migration / clamp for voice-effect and window fields added after older installs.
  merged.voicePitch = clampNumber(merged.voicePitch, -12, 12, DEFAULT_SETTINGS.voicePitch)
  merged.voiceBass = clampNumber(merged.voiceBass, -12, 12, DEFAULT_SETTINGS.voiceBass)
  merged.voiceFormant = clampNumber(merged.voiceFormant, -12, 12, DEFAULT_SETTINGS.voiceFormant)
  merged.voiceEffectMix = clampNumber(merged.voiceEffectMix, 0, 100, DEFAULT_SETTINGS.voiceEffectMix)
  merged.voiceOutputGain = clampNumber(
    merged.voiceOutputGain,
    -12,
    6,
    DEFAULT_SETTINGS.voiceOutputGain,
  )
  if (!VALID_VOICE_PRESETS.includes(merged.voicePreset)) {
    merged.voicePreset = DEFAULT_SETTINGS.voicePreset
  }
  if (typeof merged.voiceEffectsEnabled !== 'boolean') {
    merged.voiceEffectsEnabled = DEFAULT_SETTINGS.voiceEffectsEnabled
  }
  if (typeof merged.allowF11Fullscreen !== 'boolean') {
    merged.allowF11Fullscreen = DEFAULT_SETTINGS.allowF11Fullscreen
  }

  return merged
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  settingsStore.set('settings', next)
  return next
}

export function getLicense(): LicenseState {
  return { ...DEFAULT_LICENSE, ...settingsStore.get('license') }
}

export function setLicense(license: LicenseState): LicenseState {
  settingsStore.set('license', license)
  return license
}

export type { AppSettings, HotkeyBinding, LicenseState }
