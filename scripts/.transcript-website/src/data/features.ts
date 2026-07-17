export const FEATURE_SECTIONS = [
  {
    id: 'replay',
    title: 'Instant replay clipping',
    points: [
      'Keep the last few seconds of mic, Discord, or game audio ready',
      'Press one hotkey the moment something funny happens',
      'Capture without stopping your match',
    ],
    imageKey: 'clips' as const,
    imageAlt: 'SlipUpClipz Clips page with replay buffer and clip library',
  },
  {
    id: 'trim',
    title: 'Waveform trimming',
    points: [
      'See the clip as a clear waveform',
      'Drag start and end points, then preview before saving',
      'Keep only the punchline',
    ],
    imageKey: 'trim' as const,
    imageAlt: 'SlipUpClipz trim editor with waveform selection handles',
  },
  {
    id: 'soundboard',
    title: 'Soundboard and hotkeys',
    points: [
      'Drop clips onto pads and fire them instantly',
      'Import MP3 and WAV, set per-pad volume, and Stop All when needed',
      'Use in-app hotkeys free, or global hotkeys with Pro',
    ],
    imageKey: 'soundboard' as const,
    imageAlt: 'SlipUpClipz soundboard with pads, categories, and playback controls',
  },
  {
    id: 'routing',
    title: 'Virtual microphone routing',
    points: [
      'Mix your live mic and soundboard into one output',
      'Send that mix to Discord or supported game voice chats',
      'Works with supported virtual audio devices like VB-Cable',
    ],
    imageKey: 'settings' as const,
    imageAlt: 'SlipUpClipz Settings showing audio devices and virtual microphone routing',
  },
  {
    id: 'effects',
    title: 'Voice effects',
    points: [
      'Deep, Squeaky, Radio, and Robot presets',
      'Fine-tune pitch and bass',
      'Monitor with Hear Myself before you go live',
    ],
    imageKey: 'voiceEffects' as const,
    imageAlt: 'SlipUpClipz voice effects panel with presets, pitch, and bass controls',
  },
  {
    id: 'background',
    title: 'Background operation and tray support',
    points: [
      'Keep the replay buffer running while you game',
      'Minimize to tray and stay out of the way',
      'Launch on startup with Pro so the board is ready',
    ],
    imageKey: 'onboarding' as const,
    imageAlt: 'SlipUpClipz guided onboarding overlay introducing the main workspace',
  },
] as const

export const WORKFLOW_STEPS = [
  {
    title: 'Capture',
    body: 'Keep recent voice-chat audio ready in a rolling buffer.',
  },
  {
    title: 'Trim',
    body: 'Cut to the exact moment you want to keep.',
  },
  {
    title: 'Add',
    body: 'Drop the clip onto a soundboard pad.',
  },
  {
    title: 'Replay',
    body: 'Trigger it instantly — by click or hotkey.',
  },
] as const
