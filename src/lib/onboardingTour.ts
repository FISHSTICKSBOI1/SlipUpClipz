export const ONBOARDING_TOUR_VERSION = 1

export const TOUR_TARGET = {
  clipsOverview: 'tour-clips-overview',
  clipHotkey: 'tour-clip-hotkey',
  replaySource: 'tour-replay-source',
  audioSetup: 'tour-audio-setup',
  voiceEffects: 'tour-voice-effects',
  soundboardPads: 'tour-soundboard-pads',
} as const

export type TourTargetId = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET]

export type TourStepId =
  | 'welcome'
  | 'clips-overview'
  | 'clip-hotkey'
  | 'replay-source'
  | 'audio-setup'
  | 'voice-effects'
  | 'soundboard-pads'
  | 'finish'

export type TourStep = {
  id: TourStepId
  title: string
  description: string
  route?: string
  targetId?: TourTargetId
  placement?: 'auto' | 'center'
  showBack?: boolean
  requireHotkeyAck?: boolean
  isFinal?: boolean
}

export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SlipUpClipz',
    description:
      'Capture the last few seconds of game or voice-chat audio, trim the best part, and replay it instantly through your soundboard.',
    placement: 'center',
  },
  {
    id: 'clips-overview',
    title: 'Instant replay buffer',
    description:
      'SlipUpClipz continuously keeps a short replay buffer. Press Clip whenever you want to save the last few seconds of audio.',
    route: '/clips',
    targetId: TOUR_TARGET.clipsOverview,
    showBack: true,
  },
  {
    id: 'clip-hotkey',
    title: 'Choose a Clip hotkey',
    description:
      'Choose the keyboard shortcut you want to use to capture a clip while you are playing a game or using another app.',
    route: '/clips',
    targetId: TOUR_TARGET.clipHotkey,
    showBack: true,
    requireHotkeyAck: true,
  },
  {
    id: 'replay-source',
    title: 'Choose the replay audio source',
    description:
      'Choose what SlipUpClipz should capture. You can record your microphone, system audio, or both, depending on the available audio modes.',
    route: '/clips',
    targetId: TOUR_TARGET.replaySource,
    showBack: true,
  },
  {
    id: 'audio-setup',
    title: 'Microphone and soundboard audio',
    description:
      'Choose your microphone, adjust your microphone and soundboard volumes, and select the output device used for Discord or game voice chat.',
    route: '/soundboard',
    targetId: TOUR_TARGET.audioSetup,
    showBack: true,
  },
  {
    id: 'voice-effects',
    title: 'Voice effects',
    description:
      'Change how your live microphone sounds before it is sent to the virtual output. Try presets such as Deep, Squeaky, Radio, or Robot, or adjust the controls manually.',
    route: '/soundboard',
    targetId: TOUR_TARGET.voiceEffects,
    showBack: true,
  },
  {
    id: 'soundboard-pads',
    title: 'Soundboard pads',
    description:
      'Saved clips and imported audio can be placed on soundboard pads. Each pad can be played manually or assigned to a keyboard shortcut.',
    route: '/soundboard',
    targetId: TOUR_TARGET.soundboardPads,
    showBack: true,
  },
  {
    id: 'finish',
    title: 'You’re ready to use SlipUpClipz',
    description:
      'Capture a moment, trim it, add it to your soundboard, and replay it whenever you want.',
    placement: 'center',
    showBack: true,
    isFinal: true,
  },
]

export function getTourTargetElement(targetId: TourTargetId): HTMLElement | null {
  return document.querySelector(`[data-tour="${targetId}"]`)
}
