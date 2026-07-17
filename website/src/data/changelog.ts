export type ChangelogEntry = {
  version: string
  date: string
  title: string
  highlights: string[]
}

/** Add newest releases at the top. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.4',
    date: '2026-07-16',
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
