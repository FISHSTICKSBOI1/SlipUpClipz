/**
 * Central website configuration.
 */
export const SITE = {
  name: 'SlipUpClipz',
  tagline: 'Capture what they just said. Replay it instantly.',
  websiteUrl: 'https://slipupclipz.com',
  downloadUrl: '/.netlify/functions/download-latest',
  releasesUrl: 'https://github.com/FISHSTICKSBOI1/SlipUpClipz/releases/latest',
  /**
   * Official Microsoft Store product page (web URL).
   * Use this for all website Store CTAs — do not hardcode the URL in components.
   */
  microsoftStoreUrl:
    'https://apps.microsoft.com/detail/9N89SSLR9769?hl=en-us&gl=US&ocid=pdpshare',
  /** Latest published desktop installer. v0.1.6 is prepared on this site but not downloadable yet. */
  currentVersion: '0.1.5',
  upcomingVersion: '0.1.6',
  installerSizeLabel: '~82.4 MB',
  checkoutEndpoint: '/.netlify/functions/create-checkout',
  pricingQuoteEndpoint: '/.netlify/functions/pricing-quote',
  surveyEndpoint: '/.netlify/functions/submit-survey',
  validateLicenseEndpoint: '/.netlify/functions/validate-license',
  billingPortalEndpoint: '/.netlify/functions/billing-portal',
  billingRecoveryEndpoint: '/.netlify/functions/billing-recovery',
  billingRecoveryRedeemEndpoint: '/.netlify/functions/billing-recovery-redeem',
  stripeWebhookEndpoint: '/.netlify/functions/stripe-webhook',
  helpCenterUrl: 'https://slipupclipz.com/help',
  contactUrl: 'https://slipupclipz.com/contact',
  supportEmail: 'slipupclipz@gmail.com',
  supportFormName: 'slipupclipz-support',
  supportMailtoSubject: 'SlipUpClipz Support',
  supportAssistantEndpoint: '/.netlify/functions/support-assistant',
  contactSupportEndpoint: '/.netlify/functions/contact-support',
  demoVideoUrl: 'https://youtu.be/SwqrNqYVWMs?si=z1DpIM1PrfA7mMAv',
  demoVideoEmbedUrl: 'https://www.youtube-nocookie.com/embed/SwqrNqYVWMs',
  promotionCode: 'SURVEY20',
  /**
   * YouTube Shorts of real SlipUpClipz use. Leave youtubeId empty until a real Short exists.
   * Empty cards stay hidden.
   */
  shorts: [
    { youtubeId: '', title: '' },
    { youtubeId: '', title: '' },
    { youtubeId: '', title: '' },
  ],
  vbAudioUrl: 'https://vb-audio.com/Cable/',
  githubRepoUrl: 'https://github.com/FISHSTICKSBOI1/SlipUpClipz',
  logoUrl: '/images/logo.png',
  ogImageUrl: '/images/og-preview.png',
  pricing: {
    freeName: 'Free',
    proName: 'Pro',
    proPriceLabel: '$4.99',
    proPriceInterval: '/year',
    proPriceNote: 'Annual subscription · renews yearly at the regular price · cancel anytime',
    introDiscountLabel: '$1 off the first year',
  },
  social: {
    tiktok: '',
    youtube: '',
    youtubeChannelName: 'Slipupclipz',
    /** Hidden until a new invite is verified. The previous invite returned Discord error 10006. */
    discord: '',
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
    cookies: '/cookies',
  },
  screenshots: {
    clips: '/images/screenshots/clips-page.png',
    replay: '/images/screenshots/clips-page.png',
    trim: '/images/screenshots/trim-editor.png',
    soundboard: '/images/screenshots/soundboard.png',
    voiceEffects: '/images/screenshots/voice-effects.png',
    onboarding: '/images/screenshots/onboarding.png',
    settings: '/images/screenshots/settings.png',
    demoPoster: '/images/screenshots/clips-page.png',
  },
} as const

export type SiteConfig = typeof SITE
