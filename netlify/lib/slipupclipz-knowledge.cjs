/**
 * Structured SlipUpClipz support knowledge for the AI assistant.
 * Keep this factual. Do not invent features that are not shipped.
 */

const PRODUCT = {
  name: 'SlipUpClipz',
  platform: 'Windows only (Electron desktop app)',
  website: 'https://slipupclipz.com',
  supportEmail: 'slipupclipz@gmail.com',
  overview: [
    'SlipUpClipz is a Windows Electron desktop app focused on audio, not video clipping.',
    'It continuously maintains a replay audio buffer of recent audio.',
    'Users capture recent audio with an in-app button or a configurable hotkey.',
    'Captured clips are saved to the in-app Clips library.',
    'Clips can be trimmed, renamed, deleted, previewed, and assigned to soundboard pads.',
    'Main app pages include Clips, Soundboard, Settings, and Help.',
  ],
}

const FREE_FEATURES = [
  'Replay buffer',
  'Clip library',
  'Trim editor',
  '3 soundboard pads',
  'In-app playback and basic audio functionality',
]

const PRO_FEATURES = [
  '50 soundboard pads',
  'Voice effects',
  'Hear Myself',
  'Global hotkeys',
  'VB-Audio routing',
  'Windows auto-start',
  'Future Pro features',
  'Priority updates',
]

const PRICING = {
  proPrice: '$4.99 per year',
  billing: 'Annual subscription',
  cancelNote:
    'Users may cancel according to the website billing and refund policies. Direct account-specific billing questions to support.',
  licenseDelivery:
    'After a successful purchase, a license key is emailed automatically. Never invent or generate license keys.',
}

const CAPTURE_TROUBLESHOOTING = [
  'Open Settings and confirm the selected microphone/input device.',
  'Make sure Windows microphone permission is enabled for SlipUpClipz.',
  'Confirm the level meter reacts when speaking.',
  'Ensure the replay buffer is enabled and running.',
  'Check whether another application is holding the audio device exclusively.',
  'Restart SlipUpClipz after changing audio devices.',
  'Check whether the capture hotkey conflicts with another application.',
  'Microphone capture records the selected mic input. System/output capture records what Windows can provide as system/loopback audio when supported. They are different sources and require different setup.',
]

const SOUNDBOARD_TROUBLESHOOTING = [
  'Confirm the clip plays correctly inside the Clips library first.',
  'Confirm a clip is assigned to the desired Soundboard pad.',
  'Confirm the selected playback/output device in Settings is correct.',
  'Global hotkeys require Pro and must be enabled in Settings.',
  'For Discord/game routing: install VB-Audio Virtual Cable, select the cable correctly in SlipUpClipz output routing, then select that virtual input/cable microphone in Discord or the target app. SlipUpClipz cannot automatically change Discord or Windows settings.',
  'Hear Myself lets you monitor your microphone locally. Microphone toggles control whether mic audio is mixed/enabled for monitoring or routing features. If you hear echo, turn down monitoring or adjust Discord/self-listen settings carefully.',
]

const CLIP_WORKFLOW = [
  'Capture: use the Clip button or capture hotkey while the replay buffer is running.',
  'Open Clips to preview the new clip.',
  'Trim the clip in the Trim editor, then save.',
  'Rename or delete clips from the Clips library as needed.',
  'Assign a clip to a Soundboard pad, then replay from Soundboard or with hotkeys.',
  'If a clip cannot decode or open: capture a new short test clip, re-check audio permissions, restart the app, then contact support with the exact error if it continues.',
]

const INSTALL_UPDATES = [
  'SlipUpClipz is Windows only. There is no macOS or mobile app.',
  'Download the installer from slipupclipz.com (Download for Windows).',
  'Windows security prompts (SmartScreen) can appear for new apps. Choose More info → Run anyway only if you trust the official SlipUpClipz download source.',
  'The app includes an auto-updater.',
  'If updating fails: close and reopen the app, then download the newest installer from the website if needed.',
]

const AFFILIATES = [
  'Valid creator codes can provide 25% off the first year.',
  'Never invent a creator code. If a code is invalid or expired, checkout may proceed without the discount.',
  'Enter creator codes on the Pricing page before Buy Pro.',
]

const ASSISTANT_RULES = [
  'Give direct step-by-step troubleshooting rather than only linking to Help.',
  'Ask one useful clarifying question when the problem is unclear.',
  'Refer to exact page names such as Settings, Clips, Soundboard, and Help when appropriate.',
  'Use short paragraphs and numbered steps.',
  'Remember recent messages in the same support conversation.',
  'Do not hallucinate features.',
  'If the knowledge base does not contain the answer, say so honestly.',
  'Suggest contacting support for account, billing, purchase, license, or unresolved technical issues.',
  'Do not pretend you can view the user computer.',
  'Do not claim an issue is fixed unless the user confirms it.',
  'Never invent license keys or claim payment succeeded without evidence.',
]

function section(title, lines) {
  return [`=== ${title} ===`, ...lines.map((line) => `- ${line}`)].join('\n')
}

function buildKnowledgeContext() {
  return [
    section('PRODUCT OVERVIEW', PRODUCT.overview.concat([`Platform: ${PRODUCT.platform}`])),
    section('FREE FEATURES', FREE_FEATURES),
    section(
      'PRO FEATURES AND BILLING',
      PRO_FEATURES.concat([
        `Price: ${PRICING.proPrice}`,
        PRICING.billing,
        PRICING.cancelNote,
        PRICING.licenseDelivery,
      ]),
    ),
    section('CAPTURE TROUBLESHOOTING', CAPTURE_TROUBLESHOOTING),
    section('SOUNDBOARD TROUBLESHOOTING', SOUNDBOARD_TROUBLESHOOTING),
    section('CLIP WORKFLOW AND TROUBLESHOOTING', CLIP_WORKFLOW),
    section('INSTALLATION AND UPDATES', INSTALL_UPDATES),
    section('AFFILIATE / CREATOR CODES', AFFILIATES),
    section('ASSISTANT BEHAVIOR', ASSISTANT_RULES),
    `Support email: ${PRODUCT.supportEmail}`,
    `Website: ${PRODUCT.website}`,
  ].join('\n\n')
}

module.exports = {
  PRODUCT,
  FREE_FEATURES,
  PRO_FEATURES,
  PRICING,
  buildKnowledgeContext,
}
