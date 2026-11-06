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
  /**
   * Physical microphone for replay, mic test, and the legacy soundboard mix.
   * Null means the system default, including older saves that never stored an id.
   * Gaming + Discord uses voiceChatMicrophoneDeviceId and does not change this.
   */
  audioInputDeviceId: string | null
  /** Optional Gaming + Discord route. Older saves omit this and stay on legacy routing. */
  gamingDiscordPreset: boolean
  /**
   * Microphone mixed into the voice-chat output while the preset is on.
   * Null until the user confirms one. Never copied over audioInputDeviceId.
   */
  voiceChatMicrophoneDeviceId: string | null
  /**
   * Local microphone monitor. Null keeps the older Hear myself behavior.
   * The Gaming + Discord preset forces this off while it is active.
   */
  monitorMicrophoneLocally: boolean | null
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
  /**
   * Unpackaged development only. Ignored in packaged builds even if persisted.
   * Simulates Pro without a customer license.
   */
  devProTesting: boolean
}

export type LicenseTier = 'free' | 'pro'

export type LicenseAccess = 'free' | 'license' | 'development'

export type LicenseState = {
  activated: boolean
  tier: LicenseTier
  key?: string
  activatedAt?: number
  /** ISO-8601 subscription expiry from server validation. */
  expiresAt?: string | null
  /** Unix ms timestamp of the last successful online validation. */
  lastValidatedAt?: number
  /**
   * Latest local or server time this install has already observed.
   * Turning the PC clock backward does not move this earlier.
   */
  latestObservedAt?: number
  /**
   * Local checksum demo key. Never a customer entitlement.
   * Packaged builds ignore it.
   */
  devDemo?: boolean
}

export type LicenseSnapshot = {
  license: LicenseState
  isPro: boolean
  access: LicenseAccess
  developmentBuild: boolean
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
  audioInputDeviceId: null,
  gamingDiscordPreset: false,
  voiceChatMicrophoneDeviceId: null,
  monitorMicrophoneLocally: null,
  voiceEffectsEnabled: false,
  voicePitch: 0,
  voiceBass: 0,
  voiceFormant: 0,
  voiceEffectMix: 100,
  voiceOutputGain: 0,
  voicePreset: 'normal',
  allowF11Fullscreen: true,
  onboardingCompletedVersion: 0,
  devProTesting: false,
}

export const DEFAULT_LICENSE: LicenseState = {
  activated: false,
  tier: 'free',
}

export const FREE_SOUNDBOARD_PAD_LIMIT = 7

/** Pro soundboard capacity (also used by storage / grid). */
export const PRO_SOUNDBOARD_PAD_LIMIT = 50

export function soundboardPadLimit(isPro: boolean): number {
  return isPro ? PRO_SOUNDBOARD_PAD_LIMIT : FREE_SOUNDBOARD_PAD_LIMIT
}

/** Interactive pad slots. Saved assignments outside this range are kept. */
export function isSoundboardPadUnlocked(slotIndex: number, isPro: boolean): boolean {
  return slotIndex >= 0 && slotIndex < soundboardPadLimit(isPro)
}

/**
 * License gates. Global hotkeys, VB-Cable routing, and Windows startup are free.
 * AI Voice Cloning and pads beyond the free limit stay Pro.
 */
export function requiresProLicense(
  feature:
    | 'aiVoice'
    | 'extraSoundboardPads'
    | 'globalHotkeys'
    | 'vbCableRouting'
    | 'autoStart'
    | 'removeSelection',
): boolean {
  return feature === 'aiVoice' || feature === 'extraSoundboardPads' || feature === 'removeSelection'
}

export const PREMIUM_FEATURES = {
  unlimitedPads: `Use all ${PRO_SOUNDBOARD_PAD_LIMIT} soundboard pads instead of ${FREE_SOUNDBOARD_PAD_LIMIT} on the free plan.`,
  aiVoice: 'AI Voice Cloning. Each generation creates one clip.',
} as const
