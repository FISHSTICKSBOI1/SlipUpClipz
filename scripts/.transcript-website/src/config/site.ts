/**
 * Central website configuration.
 * Replace placeholder values before going live.
 */
export const SITE = {
  name: 'SlipUpClipz',
  tagline: 'Capture what they just said. Replay it instantly.',
  /** Public site origin (no trailing slash). */
  websiteUrl: 'https://slipupclipz.com',
  /** Direct Windows installer download. Update when a new release ships. */
  downloadUrl:
    'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/latest/download/SlipUpClipz-Setup-0.1.3.exe',
  /** GitHub Releases page for browsing assets. */
  releasesUrl: 'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/latest',
  currentVersion: '0.1.3',
  /** Approximate installer size shown on Download page. */
  installerSizeLabel: '~82 MB',
  /** Placeholder purchase checkout — replace when payments go live. */
  purchaseUrl: 'https://slipupclipz.com/purchase-placeholder',
  helpCenterUrl: 'https://slipupclipz.com/help',
  contactUrl: 'https://slipupclipz.com/contact',
  /** Support inbox used by mailto fallback. */
  supportEmail: 'support@slipupclipz.com',
  /**
   * Demo video URL (YouTube/Vimeo/mp4). Leave empty until the clip is ready.
   * Empty string opens the in-page “Demo coming soon” modal.
   */
  demoVideoUrl: '',
  vbAudioUrl: 'https://vb-audio.com/Cable/',
  githubRepoUrl: 'https://github.com/FISHSTICKSBOI1/SlipUpClipz',
  pricing: {
    freeName: 'Free',
    proName: 'Pro',
    proPriceLabel: '$4.99',
    proPriceNote: 'Lifetime access · one-time payment · no subscription',
  },
  social: {
    /** Leave empty until official accounts exist — empty links are hidden in the UI. */
    tiktok: '',
    youtube: '',
    discord: 'https://discord.com/invite/c8wX9AUREj',
  },
  paths: {
    home: '/',
    features: '/features',
    howItWorks: '/how-it-works',
    pricing: '/pricing',
    download: '/download',
    help: '/help',
    contact: '/contact',
    faq: '/faq',
    changelog: '/changelog',
    privacy: '/privacy',
    terms: '/terms',
    refund: '/refund',
  },
  /** Screenshot assets — real PNGs under public/images/screenshots/. */
  screenshots: {
    clips: '/images/screenshots/clips-page.png',
    /** Replay buffer lives on the Clips page (no separate replay PNG yet). */
    replay: '/images/screenshots/clips-page.png',
    trim: '/images/screenshots/trim-editor.png',
    soundboard: '/images/screenshots/soundboard.png',
    voiceEffects: '/images/screenshots/voice-effects.png',
    onboarding: '/images/screenshots/onboarding.png',
    settings: '/images/screenshots/settings.png',
    /** Demo poster until a dedicated poster image is added. */
    demoPoster: '/images/screenshots/clips-page.png',
  },
} as const

export type SiteConfig = typeof SITE
