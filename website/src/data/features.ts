export const FEATURE_SECTIONS = [
  {
    id: 'ai-voice',
    kind: 'ai' as const,
    title: 'AI Voice Clip Cloning',
    points: [
      'Create new English speech from a short recording when that speaker has given permission',
      'Generate one clip at a time, then use Generate Again to repeat it',
      'Preview the result and save it to your clip library',
      'Install the voice engine separately from Settings. It is Pro only and needs a compatible NVIDIA GPU',
    ],
  },
  {
    id: 'replay',
    kind: 'screenshot' as const,
    title: 'Instant replay clipping',
    points: [
      'Keep the last few seconds of microphone, Discord, or game audio ready',
      'Press one hotkey the moment something funny happens',
      'Capture without stopping your match',
    ],
    imageKey: 'clips' as const,
    imageAlt: 'SlipUpClipz Clips page with replay buffer and clip library',
  },
  {
    id: 'trim',
    kind: 'screenshot' as const,
    title: 'Waveform trimming',
    points: [
      'See the clip as a clear waveform',
      'Drag the start and end, then preview before saving',
      'Pro Cut removes a middle section and can save that edit as a new clip',
    ],
    imageKey: 'trim' as const,
    imageAlt: 'SlipUpClipz trim editor with waveform selection handles',
  },
  {
    id: 'soundboard',
    kind: 'screenshot' as const,
    title: 'Soundboard and hotkeys',
    points: [
      'Free includes 7 pads. Pro includes 50',
      'Drop clips onto pads, import MP3 and WAV, and set per-pad volume',
      'Global hotkeys are included, including on the Free plan',
    ],
    imageKey: 'soundboard' as const,
    imageAlt: 'SlipUpClipz soundboard with pads, categories, and playback controls',
  },
  {
    id: 'routing',
    kind: 'screenshot' as const,
    title: 'Virtual microphone routing',
    points: [
      'Mix your live mic and soundboard into one output',
      'Send that mix to Discord, Valorant, or another voice chat that can use a virtual microphone',
      'VB-Audio Virtual Cable routing is included on the Free plan',
    ],
    imageKey: 'settings' as const,
    imageAlt: 'SlipUpClipz Settings showing audio devices and virtual microphone routing',
  },
  {
    id: 'effects',
    kind: 'screenshot' as const,
    title: 'Voice effects',
    points: [
      'Deep, Squeaky, Radio, and Robot presets are included',
      'Fine-tune pitch and bass',
      'Monitor with Hear Myself before you go live',
    ],
    imageKey: 'voiceEffects' as const,
    imageAlt: 'SlipUpClipz voice effects panel with presets, pitch, and bass controls',
  },
  {
    id: 'background',
    kind: 'screenshot' as const,
    title: 'Background operation and tray support',
    points: [
      'Keep the replay buffer running while you game',
      'Minimize to tray and stay out of the way',
      'Start with Windows is included, so the board can be ready when you log in',
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

export const FREE_PLAN_FEATURES = [
  'Instant replay audio clipping',
  'Recording, trimming, and clip library',
  '7 soundboard pads',
  'Global hotkeys',
  'VB-Audio Virtual Cable routing',
  'Start with Windows',
  'Voice effects and Hear Myself',
] as const

export const PRO_PLAN_FEATURES = [
  'Everything in Free',
  '50 soundboard pads',
  'Pro Cut',
  'Local AI Voice Clip Cloning on the Windows installer',
  'Generate Again, then save the clip to your library',
  'Separate local voice-engine install',
] as const
