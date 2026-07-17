export type ReplayAudioSource = 'microphone' | 'system' | 'virtual'

export type VoiceEffectsPreset =
  | 'normal'
  | 'deep'
  | 'squeaky'
  | 'radio'
  | 'robot'
  | 'custom'

export type AppSettings = {
  launchOnStartup: boolean
  minimizeToTray: boolean
  showRightPanel: boolean
  compactSidebar: boolean
  audioOutputDeviceId: string | null
  routeToVBCable: boolean
  globalHotkeysEnabled: boolean
  clipHotkey: string
  hearMyself: boolean
  mixerMicrophoneEnabled: boolean
  mixerMicrophoneVolume: number
  mixerSoundboardVolume: number
  replayAudioSource: ReplayAudioSource
  virtualAudioInputDeviceId: string | null
  voiceEffectsEnabled: boolean
  voicePitch: number
  voiceBass: number
  voiceFormant: number
  /** Wet mix of processed mic (0–100). Missing in older saves → 100. */
  voiceEffectMix: number
  /** Output trim after effects (-12..+6). Missing in older saves → 0. */
  voiceOutputGain: number
  voicePreset: VoiceEffectsPreset
  stopAllHotkey: string
  /** When true (default), F11 toggles fullscreen. */
  allowF11Fullscreen: boolean
  /** Highest onboarding tour version the user has completed or skipped. */
  onboardingCompletedVersion: number
}

export type LicenseTier = 'free' | 'pro'

export type LicenseState = {
  activated: boolean
  tier: LicenseTier
  key?: string
  activatedAt?: number
  /** ISO-8601 subscription expiry from server validation. */
  expiresAt?: string | null
  /** Unix ms timestamp of the last successful online validation. */
  lastValidatedAt?: number
}

export type HotkeyBinding = {
  clipId: string
  accelerator: string
}

export const CLIP_RECORD_HOTKEY = 'Ctrl+Shift+C'
export const CLIP_RECORD_ACCELERATOR = 'CommandOrControl+Shift+C'
export const STOP_ALL_SOUNDS_HOTKEY = 'Ctrl+Shift+X'

export const DEFAULT_SETTINGS: AppSettings = {
  launchOnStartup: false,
  minimizeToTray: true,
  showRightPanel: true,
  compactSidebar: false,
  audioOutputDeviceId: null,
  routeToVBCable: false,
  globalHotkeysEnabled: true,
  clipHotkey: CLIP_RECORD_HOTKEY,
  stopAllHotkey: STOP_ALL_SOUNDS_HOTKEY,
  hearMyself: true,
  mixerMicrophoneEnabled: false,
  mixerMicrophoneVolume: 75,
  mixerSoundboardVolume: 100,
  replayAudioSource: 'microphone',
  virtualAudioInputDeviceId: null,
  voiceEffectsEnabled: false,
  voicePitch: 0,
  voiceBass: 0,
  voiceFormant: 0,
  voiceEffectMix: 100,
  voiceOutputGain: 0,
  voicePreset: 'normal',
  allowF11Fullscreen: true,
  onboardingCompletedVersion: 0,
}

export const DEFAULT_LICENSE: LicenseState = {
  activated: false,
  tier: 'free',
}

export const FREE_SOUNDBOARD_PAD_LIMIT = 3

/** Pro soundboard capacity (also used by storage / grid). */
export const PRO_SOUNDBOARD_PAD_LIMIT = 50

export const PREMIUM_FEATURES = {
  globalHotkeys: 'Global hotkeys work even when SlipUpClipz is in the background.',
  vbCableRouting: 'Route soundboard output to VB-Audio Virtual Cable for streaming and voice chat.',
  autoStart: 'Launch SlipUpClipz automatically when Windows starts.',
  unlimitedPads: `Use all ${PRO_SOUNDBOARD_PAD_LIMIT} soundboard pads instead of ${FREE_SOUNDBOARD_PAD_LIMIT} on the free plan.`,
} as const
