export type VoiceEffectsPreset = 'normal' | 'deep' | 'squeaky' | 'radio' | 'robot' | 'custom'

export type VoiceEffectsTone = 'none' | 'radio' | 'robot'

export type VoiceEffectsSettings = {
  enabled: boolean
  pitch: number
  bass: number
  formant: number
  /** 0–100 dry/wet mix of processed mic. */
  mix: number
  /** -12..+12 dB-ish output trim after processing. */
  outputGain: number
  preset: VoiceEffectsPreset
}

export const VOICE_PITCH_MIN = -12
export const VOICE_PITCH_MAX = 12
export const VOICE_BASS_MIN = -12
export const VOICE_BASS_MAX = 12
export const VOICE_FORMANT_MIN = -12
export const VOICE_FORMANT_MAX = 12
export const VOICE_MIX_MIN = 0
export const VOICE_MIX_MAX = 100
export const VOICE_OUTPUT_GAIN_MIN = -12
export const VOICE_OUTPUT_GAIN_MAX = 6

export type VoiceEffectPresetValues = {
  pitch: number
  bass: number
  formant: number
  mix: number
  outputGain: number
  tone: VoiceEffectsTone
  label: string
}

/**
 * Preset tuning tuned for obvious character differences while keeping speech speed.
 * Pitch/formant in semitones, bass in shelf dB, mix 0–100, outputGain in dB trim.
 */
export const VOICE_EFFECT_PRESETS: Record<
  Exclude<VoiceEffectsPreset, 'custom'>,
  VoiceEffectPresetValues
> = {
  normal: {
    pitch: 0,
    bass: 0,
    formant: 0,
    mix: 100,
    outputGain: 0,
    tone: 'none',
    label: 'Normal',
  },
  deep: {
    pitch: -7,
    bass: 6,
    formant: -7,
    mix: 100,
    outputGain: -1,
    tone: 'none',
    label: 'Deep',
  },
  squeaky: {
    pitch: 10,
    bass: -10,
    formant: 10,
    mix: 100,
    outputGain: -2,
    tone: 'none',
    label: 'Squeaky',
  },
  radio: {
    pitch: 0,
    bass: -9,
    formant: 2,
    mix: 100,
    outputGain: 1,
    tone: 'radio',
    label: 'Radio',
  },
  robot: {
    pitch: -3,
    bass: 2,
    formant: -2,
    mix: 100,
    outputGain: -1,
    tone: 'robot',
    label: 'Robot',
  },
}

export function clampVoicePitch(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(VOICE_PITCH_MIN, Math.min(VOICE_PITCH_MAX, Math.round(value)))
}

export function clampVoiceBass(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(VOICE_BASS_MIN, Math.min(VOICE_BASS_MAX, Math.round(value)))
}

export function clampVoiceFormant(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(VOICE_FORMANT_MIN, Math.min(VOICE_FORMANT_MAX, Math.round(value)))
}

export function clampVoiceMix(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.max(VOICE_MIX_MIN, Math.min(VOICE_MIX_MAX, Math.round(value)))
}

export function clampVoiceOutputGain(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(
    VOICE_OUTPUT_GAIN_MIN,
    Math.min(VOICE_OUTPUT_GAIN_MAX, Math.round(value)),
  )
}

export function semitonesToPitchRatio(semitones: number): number {
  return Math.pow(2, clampVoicePitch(semitones) / 12)
}

/** Convert dB trim to linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, clampVoiceOutputGain(db) / 20)
}

export function toneForPreset(preset: VoiceEffectsPreset): VoiceEffectsTone {
  if (preset === 'custom' || preset === 'normal') return 'none'
  return VOICE_EFFECT_PRESETS[preset].tone
}

export function matchVoicePreset(
  pitch: number,
  bass: number,
  formant: number,
  mix = 100,
  outputGain = 0,
): VoiceEffectsPreset {
  for (const [key, preset] of Object.entries(VOICE_EFFECT_PRESETS) as Array<
    [Exclude<VoiceEffectsPreset, 'custom'>, VoiceEffectPresetValues]
  >) {
    if (
      preset.pitch === pitch &&
      preset.bass === bass &&
      preset.formant === formant &&
      preset.mix === mix &&
      preset.outputGain === outputGain
    ) {
      return key
    }
  }
  return 'custom'
}

export function formatSemitones(value: number): string {
  if (value === 0) return '0 st'
  return `${value > 0 ? '+' : ''}${value} st`
}

export function formatPercent(value: number): string {
  return `${clampVoiceMix(value)}%`
}

export function formatOutputGain(value: number): string {
  const v = clampVoiceOutputGain(value)
  if (v === 0) return '0 dB'
  return `${v > 0 ? '+' : ''}${v} dB`
}

export function voiceEffectsStatusLabel(settings: VoiceEffectsSettings): string {
  if (!settings.enabled) {
    return 'Voice effects off'
  }

  switch (settings.preset) {
    case 'deep':
      return 'Deep voice active'
    case 'squeaky':
      return 'Squeaky voice active'
    case 'radio':
      return 'Radio voice active'
    case 'robot':
      return 'Robot voice active'
    case 'normal':
      return 'Normal voice active'
    default:
      return 'Custom voice effect active'
  }
}

/** Migrate older saved settings that lack mix/outputGain. */
export function normalizeVoiceEffectsFields(partial: {
  voiceEffectsEnabled?: boolean
  voicePitch?: number
  voiceBass?: number
  voiceFormant?: number
  voiceEffectMix?: number
  voiceOutputGain?: number
  voicePreset?: VoiceEffectsPreset
}): {
  voiceEffectsEnabled: boolean
  voicePitch: number
  voiceBass: number
  voiceFormant: number
  voiceEffectMix: number
  voiceOutputGain: number
  voicePreset: VoiceEffectsPreset
} {
  return {
    voiceEffectsEnabled: partial.voiceEffectsEnabled === true,
    voicePitch: clampVoicePitch(partial.voicePitch ?? 0),
    voiceBass: clampVoiceBass(partial.voiceBass ?? 0),
    voiceFormant: clampVoiceFormant(partial.voiceFormant ?? 0),
    voiceEffectMix: clampVoiceMix(partial.voiceEffectMix ?? 100),
    voiceOutputGain: clampVoiceOutputGain(partial.voiceOutputGain ?? 0),
    voicePreset: partial.voicePreset ?? 'normal',
  }
}
