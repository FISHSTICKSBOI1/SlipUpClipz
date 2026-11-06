export const ONBOARDING_TOUR_VERSION = 1

export const TOUR_TARGET = {
  clipsOverview: 'tour-clips-overview',
  clipLibrary: 'tour-clip-library',
  clipHotkey: 'tour-clip-hotkey',
  replaySource: 'tour-replay-source',
  audioSetup: 'tour-audio-setup',
  voiceEffects: 'tour-voice-effects',
  soundboardPads: 'tour-soundboard-pads',
  aiVoice: 'tour-ai-voice',
} as const

export type TourTargetId = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET]

export type TourStepId =
  | 'welcome'
  | 'clips-overview'
  | 'trim-clip'
  | 'clip-hotkey'
  | 'replay-source'
  | 'audio-setup'
  | 'voice-effects'
  | 'soundboard-pads'
  | 'ai-voice'
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
      'Save a short moment, trim it, and play it back. This short guide asks what you want to record, then how teammates hear your soundboard.',
    placement: 'center',
  },
  {
    id: 'clips-overview',
    title: 'Instant replay buffer',
    description:
      'SlipUpClipz keeps a short rolling recording. Press Clip to save the last few seconds. That recording is separate from what Discord or a game hears.',
    route: '/clips',
    targetId: TOUR_TARGET.clipsOverview,
    showBack: true,
  },
  {
    id: 'trim-clip',
    title: 'Trim a clip',
    description:
      'Open a saved clip and choose Trim. Drag the edges so the selection starts and ends on complete words, then save that piece.',
    route: '/clips',
    targetId: TOUR_TARGET.clipLibrary,
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
      'Pick one recording goal. Record what you hear, or record your microphone. Both at once is not available yet. This does not change where your soundboard is sent.',
    route: '/clips',
    targetId: TOUR_TARGET.replaySource,
    showBack: true,
  },
  {
    id: 'audio-setup',
    title: 'Microphone and soundboard audio',
    description:
      'Choose the output, turn on Hear Myself to hear your microphone, and use the Live Audio Mixer when the microphone should join the soundboard.',
    route: '/soundboard',
    targetId: TOUR_TARGET.audioSetup,
    showBack: true,
  },
  {
    id: 'voice-effects',
    title: 'Voice effects',
    description:
      'Optional. Voice effects change the microphone SlipUpClipz mixes with soundboard clips. You can skip this and leave them off.',
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
    id: 'ai-voice',
    title: 'Generate an AI voice clip',
    description:
      'With Pro and Voice Cloning installed, open a short clip and choose AI Clone. Review the transcript, then generate a new line from that voice.',
    route: '/settings',
    targetId: TOUR_TARGET.aiVoice,
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

/** Free tours skip the AI step. Pro tours include it. Every tour can still be skipped. */
export function tourStepsFor(includeAiVoice: boolean): TourStep[] {
  return ONBOARDING_TOUR_STEPS.filter((step) => includeAiVoice || step.id !== 'ai-voice')
}

export function getTourTargetElement(targetId: TourTargetId): HTMLElement | null {
  return document.querySelector(`[data-tour="${targetId}"]`)
}
