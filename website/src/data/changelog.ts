export type ChangelogEntry = {
  version: string
  date: string
  title: string
  highlights: string[]
  status?: 'released' | 'upcoming'
}

/** Add newest releases at the top. Upcoming drafts stay above the latest published release. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.6',
    date: '2026-11-07',
    status: 'released',
    title: 'AI Voice Cloning on the Windows installer',
    highlights: [
      'Free keeps instant replay, microphone and game recording, trimming, the clip library, 7 soundboard pads, global hotkeys, Discord and Valorant routing, voice effects, and Hear Myself.',
      'Pro adds 50 soundboard pads, Pro Cut, and local AI Voice Clip Cloning on the Windows installer.',
      'Generate one clip from a 0.8–7 second reference when the speaker has given permission, then use Generate Again and save it to your library.',
      'The voice engine is a separate Pro install and needs a compatible NVIDIA GPU. English is the tested language.',
      'If the voice engine fails, restart it from the dialog. Closing during generation asks before it stops.',
      'A direct update from v0.1.5 keeps clips, settings, and Pro licenses. Microsoft Store installs update through the Store and do not use this installer.',
    ],
  },
  {
    version: '0.1.5',
    date: '2026-07-21',
    status: 'released',
    title: 'Server license validation',
    highlights: [
      'Production license activation validates against the license server.',
      'Packaged builds use the public validate-license endpoint.',
      'Safer license validation diagnostics on the server.',
      'This published build does not include AI Voice Clip Cloning.',
    ],
  },
  {
    version: '0.1.4',
    date: '2026-07-16',
    status: 'released',
    title: 'Redesigned interface and major polish',
    highlights: [
      'Redesigned Discord/Voicemod-inspired desktop interface',
      'Improved waveform visibility',
      'Moving waveform preview playhead',
      'Movable trim selection',
      'Improved voice effects',
      'Green Clip button',
      'Improved onboarding positioning',
      'Rotating Quick Tips',
      'Official S branding',
      '50 Pro soundboard pads',
      'F11 fullscreen',
      'Single-instance and tray fixes',
      'Help Center integration',
      'Stability fixes',
    ],
  },
  {
    version: '0.1.3',
    date: '2026-07-10',
    status: 'released',
    title: 'Updates, voice effects, and polish',
    highlights: [
      'Automatic updates from GitHub Releases with Settings progress and restart controls',
      'Real-time voice effects with Deep, Squeaky, Radio, and Robot presets',
      'First-time guided onboarding tour with restart from Help & Support',
      'Improved soundboard: imports, pad volume, categories, favorites, and Stop All',
      'Help Center and Contact Support links to the public website',
      'Sample clips no longer reappear after you clear your library',
      'Tray minimize and launch-on-startup behavior improvements',
      'UI and stability fixes across Clips, Soundboard, and Settings',
    ],
  },
]
