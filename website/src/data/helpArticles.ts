export type HelpCategoryId =
  | 'getting-started'
  | 'clipping'
  | 'soundboard'
  | 'discord'
  | 'voice-effects'
  | 'updates'

export type HelpArticle = {
  slug: string
  category: HelpCategoryId
  title: string
  summary: string
  steps: string[]
  tips?: string[]
  screenshotLabel: string
}

export const HELP_CATEGORIES: { id: HelpCategoryId; title: string; description: string }[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Install, tour, mic, replay source, and Clip hotkey.',
  },
  {
    id: 'clipping',
    title: 'Clipping problems',
    description: 'Empty clips, decode errors, and capture source issues.',
  },
  {
    id: 'soundboard',
    title: 'Soundboard problems',
    description: 'Playback, hotkeys, imports, Stop All, and pad volume.',
  },
  {
    id: 'discord',
    title: 'Discord and game setup',
    description: 'VB-Cable, virtual mic selection, mixing, and echo.',
  },
  {
    id: 'voice-effects',
    title: 'Voice effects',
    description: 'Presets, pitch, bass, and monitoring.',
  },
  {
    id: 'updates',
    title: 'Updates and licensing',
    description: 'Auto-updates, Pro activation, and moving PCs.',
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'installing-slipupclipz',
    category: 'getting-started',
    title: 'Installing SlipUpClipz',
    summary: 'Download the Windows installer and complete setup.',
    screenshotLabel: 'Installer welcome screen',
    steps: [
      'Download the latest SlipUpClipz Setup installer from the Download page or GitHub Releases.',
      'Run the .exe. If SmartScreen appears, choose More info → Run anyway when you trust the source.',
      'Follow the NSIS installer prompts and finish installation.',
      'Launch SlipUpClipz from the Start Menu or desktop shortcut.',
    ],
  },
  {
    slug: 'first-time-guided-tour',
    category: 'getting-started',
    title: 'First-time guided tour',
    summary: 'Walk through the in-app tour after your first launch.',
    screenshotLabel: 'Onboarding tour overlay',
    steps: [
      'Open SlipUpClipz for the first time.',
      'Follow the guided highlights for Clips, Soundboard, and Settings.',
      'You can restart the tour later from Settings → Help & Support.',
    ],
  },
  {
    slug: 'choosing-your-microphone',
    category: 'getting-started',
    title: 'Choosing your microphone',
    summary: 'Pick the physical mic SlipUpClipz should listen to.',
    screenshotLabel: 'Microphone device picker',
    steps: [
      'Open Settings or the audio controls in Soundboard.',
      'Select your real microphone device (not the virtual cable).',
      'Speak briefly and confirm input levels move.',
    ],
  },
  {
    slug: 'choosing-replay-audio-source',
    category: 'getting-started',
    title: 'Choosing replay audio source',
    summary: 'Decide what the rolling buffer records.',
    screenshotLabel: 'Replay audio source control on Clips',
    steps: [
      'Open the Clips page.',
      'Find Replay audio source next to the recorder.',
      'Choose microphone, system/game audio, or the combination your setup supports.',
      'Start the buffer and test a short clip.',
    ],
  },
  {
    slug: 'setting-the-clip-hotkey',
    category: 'getting-started',
    title: 'Setting the Clip hotkey',
    summary: 'Bind a global or in-app shortcut to capture the buffer.',
    screenshotLabel: 'Clip hotkey control',
    steps: [
      'Open the Clips page.',
      'Click the Clip hotkey control and press your preferred keys.',
      'Confirm the new binding is shown.',
      'With the buffer listening, press the hotkey to capture a clip.',
    ],
  },
  {
    slug: 'clip-button-does-nothing',
    category: 'clipping',
    title: 'Clip button does nothing',
    summary: 'Fix a Clip action that never creates a clip.',
    screenshotLabel: 'Recorder panel while listening',
    steps: [
      'Confirm the replay buffer status shows it is listening.',
      'Check that a microphone or system source is selected.',
      'Try the on-screen Clip control as well as the hotkey.',
      'Restart SlipUpClipz and test again with a short spoken phrase.',
    ],
    tips: ['If the buffer was just started, wait a second so there is audio to capture.'],
  },
  {
    slug: 'clip-has-no-audio',
    category: 'clipping',
    title: 'Clip has no audio',
    summary: 'Clips save but play back silent.',
    screenshotLabel: 'Silent waveform in trimmer',
    steps: [
      'Verify Windows privacy settings allow microphone access.',
      'Make sure the correct input device is selected in SlipUpClipz.',
      'If capturing system audio, confirm that source is producing sound.',
      'Re-record a test clip while watching input meters.',
    ],
  },
  {
    slug: 'could-not-decode-clip',
    category: 'clipping',
    title: 'Could not decode clip for editing',
    summary: 'The trimmer cannot open a captured or imported file.',
    screenshotLabel: 'Decode error state',
    steps: [
      'Try capturing a fresh clip instead of an older file.',
      'For imports, use a standard MP3 or WAV file.',
      'Close other apps that might lock the audio file.',
      'Restart SlipUpClipz and open the clip again.',
    ],
  },
  {
    slug: 'wrong-microphone-selected',
    category: 'clipping',
    title: 'Wrong microphone selected',
    summary: 'Audio is coming from an unexpected device.',
    screenshotLabel: 'Device list with wrong mic highlighted',
    steps: [
      'Open audio device settings in SlipUpClipz.',
      'Select your headset or desk mic by name.',
      'Avoid selecting VB-Cable as the capture mic unless you intend to.',
      'Test with Hear Myself or a short clip.',
    ],
  },
  {
    slug: 'system-audio-not-captured',
    category: 'clipping',
    title: 'System audio is not captured',
    summary: 'Game or Discord output never appears in clips.',
    screenshotLabel: 'Replay source set to system audio',
    steps: [
      'Set the replay source to include system/loopback audio if available.',
      'Play known audio (music or a Discord call) while the buffer listens.',
      'On some setups you may need exclusive-mode off in Windows sound settings.',
      'If loopback is unsupported, capture mic-only or use a virtual cable mix.',
    ],
  },
  {
    slug: 'soundboard-cannot-be-heard',
    category: 'soundboard',
    title: 'Soundboard cannot be heard',
    summary: 'Pads trigger but you or Discord hear nothing.',
    screenshotLabel: 'Audio output section',
    steps: [
      'Check the output device in Settings / Soundboard mixer.',
      'Raise pad volume and master output.',
      'If routing to Discord, select the virtual cable in both SlipUpClipz and Discord.',
      'Use Hear Myself to confirm local monitoring.',
    ],
  },
  {
    slug: 'hotkey-does-not-work',
    category: 'soundboard',
    title: 'Hotkey does not work',
    summary: 'Keyboard shortcuts do not fire pads or Clip.',
    screenshotLabel: 'Hotkey binding dialog',
    steps: [
      'Confirm the hotkey is assigned on the pad or Clip control.',
      'Free plan supports in-app hotkeys while SlipUpClipz is focused.',
      'Pro global hotkeys must be enabled in Settings.',
      'Avoid conflicting shortcuts used by your game or Discord.',
    ],
  },
  {
    slug: 'imported-mp3-wav-will-not-play',
    category: 'soundboard',
    title: 'Imported MP3 or WAV will not play',
    summary: 'Imports appear on pads but fail playback.',
    screenshotLabel: 'Import file dialog',
    steps: [
      'Re-import a known-good MP3 or WAV under a few megabytes.',
      'Avoid DRM-protected or unusual codecs.',
      'Check pad volume is not muted.',
      'Try Stop All Sounds, then trigger the pad again.',
    ],
  },
  {
    slug: 'stop-all-sounds',
    category: 'soundboard',
    title: 'Stop All Sounds',
    summary: 'Immediately silence every playing pad.',
    screenshotLabel: 'Stop All control',
    steps: [
      'Click Stop All Sounds on the Soundboard page, or use the Stop All hotkey if assigned.',
      'Confirm playing indicators clear on each pad.',
      'Trigger a single pad again to verify playback still works.',
    ],
  },
  {
    slug: 'adjusting-pad-volume',
    category: 'soundboard',
    title: 'Adjusting pad volume',
    summary: 'Balance loud clips without changing your mic.',
    screenshotLabel: 'Per-pad volume slider',
    steps: [
      'Open the pad controls for the sound you want to change.',
      'Move the per-pad volume slider.',
      'Preview the pad and adjust until it sits under your voice.',
    ],
  },
  {
    slug: 'installing-vb-audio-virtual-cable',
    category: 'discord',
    title: 'Installing VB-Audio Virtual Cable',
    summary: 'Add a virtual device for Discord and game voice routing.',
    screenshotLabel: 'VB-Audio Cable download page',
    steps: [
      'Download VB-Audio Virtual Cable from the official VB-Audio site.',
      'Install it and reboot if Windows asks you to.',
      'Confirm “CABLE Input” and “CABLE Output” appear in Windows sound devices.',
    ],
  },
  {
    slug: 'selecting-virtual-device-in-slipupclipz',
    category: 'discord',
    title: 'Selecting the virtual device in SlipUpClipz',
    summary: 'Send mic + soundboard into the cable.',
    screenshotLabel: 'Virtual output device picker',
    steps: [
      'Open audio output / routing settings in SlipUpClipz.',
      'Choose VB-Cable (or your virtual device) as the routed output.',
      'Enable the mix so microphone and pads both feed the virtual device.',
    ],
  },
  {
    slug: 'selecting-virtual-microphone-in-discord',
    category: 'discord',
    title: 'Selecting the virtual microphone in Discord',
    summary: 'Point Discord at the cable so friends hear your mix.',
    screenshotLabel: 'Discord voice settings input device',
    steps: [
      'Open Discord → User Settings → Voice & Video.',
      'Set Input Device to CABLE Output (VB-Audio Virtual Cable).',
      'Speak and play a pad while watching Discord’s input meter.',
    ],
  },
  {
    slug: 'mixing-live-mic-and-soundboard',
    category: 'discord',
    title: 'Mixing live microphone and soundboard',
    summary: 'Keep talking while pads play into the same virtual mic.',
    screenshotLabel: 'Mixer controls',
    steps: [
      'Confirm your real mic is selected as the SlipUpClipz input.',
      'Confirm the virtual cable is the routed output.',
      'Balance pad volumes so clips do not overpower your voice.',
      'Test in a private Discord call before ranked games.',
    ],
  },
  {
    slug: 'using-hear-myself',
    category: 'discord',
    title: 'Using Hear Myself',
    summary: 'Monitor your processed voice and pads locally.',
    screenshotLabel: 'Hear Myself toggle',
    steps: [
      'Enable Hear Myself in Soundboard controls.',
      'Wear headphones to avoid speaker feedback.',
      'Adjust monitoring level until it is comfortable.',
    ],
  },
  {
    slug: 'troubleshooting-echo-or-doubled-audio',
    category: 'discord',
    title: 'Troubleshooting echo or doubled audio',
    summary: 'Stop hearing yourself twice in Discord or locally.',
    screenshotLabel: 'Discord echo cancellation settings',
    steps: [
      'Use headphones instead of open speakers.',
      'Disable Discord’s input monitoring if you already use Hear Myself.',
      'Make sure Discord is not also capturing your real mic in parallel.',
      'Turn off extra monitoring paths in Windows “Listen to this device”.',
    ],
  },
  {
    slug: 'enabling-voice-effects',
    category: 'voice-effects',
    title: 'Enabling effects',
    summary: 'Turn on real-time voice processing.',
    screenshotLabel: 'Voice effects enable toggle',
    steps: [
      'Open Voice Effects on the Soundboard page.',
      'Enable effects.',
      'Speak while monitoring to confirm the change.',
    ],
  },
  {
    slug: 'adjusting-pitch-and-bass',
    category: 'voice-effects',
    title: 'Adjusting pitch and bass',
    summary: 'Fine-tune how processed your voice sounds.',
    screenshotLabel: 'Pitch and bass sliders',
    steps: [
      'Move pitch up or down in small steps.',
      'Adjust bass for warmth or thinness.',
      'Use Hear Myself to evaluate before joining a call.',
    ],
  },
  {
    slug: 'using-voice-presets',
    category: 'voice-effects',
    title: 'Using presets',
    summary: 'Apply Deep, Squeaky, Radio, or Robot quickly.',
    screenshotLabel: 'Preset buttons',
    steps: [
      'Choose a preset such as Deep, Squeaky, Radio, or Robot.',
      'Preview with Hear Myself.',
      'Switch back to Normal when you want your regular voice.',
    ],
  },
  {
    slug: 'reducing-delay-or-distortion',
    category: 'voice-effects',
    title: 'Reducing delay or distortion',
    summary: 'Keep effects usable in live chat.',
    screenshotLabel: 'Effects panel with moderate settings',
    steps: [
      'Avoid extreme pitch values during competitive play.',
      'Close unused audio apps competing for the device.',
      'Disable effects temporarily to compare latency.',
      'Update your audio drivers if distortion persists.',
    ],
  },
  {
    slug: 'checking-for-updates',
    category: 'updates',
    title: 'Checking for updates',
    summary: 'See if a newer SlipUpClipz build is available.',
    screenshotLabel: 'Settings Updates section',
    steps: [
      'Open Settings → Updates.',
      'Click Check for Updates.',
      'If an update exists, wait for the download to finish.',
    ],
  },
  {
    slug: 'restarting-to-install',
    category: 'updates',
    title: 'Restarting to install',
    summary: 'Apply a downloaded update safely.',
    screenshotLabel: 'Update ready dialog',
    steps: [
      'When prompted that an update is ready, choose Restart Now.',
      'Or choose Later and use Restart and Install in Settings when you are not mid-game.',
      'After relaunch, confirm the version number in Settings.',
    ],
  },
  {
    slug: 'activating-pro',
    category: 'updates',
    title: 'Activating Pro',
    summary: 'Unlock Pro features with your license key.',
    screenshotLabel: 'License activation panel',
    steps: [
      'Open Settings and find the License section.',
      'Paste your Pro license key.',
      'Activate and confirm Pro features unlock (pads, global hotkeys, routing).',
    ],
  },
  {
    slug: 'moving-to-another-computer',
    category: 'updates',
    title: 'Moving to another computer',
    summary: 'Install SlipUpClipz elsewhere and restore Pro.',
    screenshotLabel: 'Fresh install license screen',
    steps: [
      'Install SlipUpClipz on the new PC from the official download.',
      'Sign in / activate with the same Pro key when prompted.',
      'Reconfigure devices and hotkeys on the new machine.',
      'Contact support if activation fails after a hardware move.',
    ],
  },
  {
    slug: 'restoring-access',
    category: 'updates',
    title: 'Restoring access',
    summary: 'Recover Pro when a key or purchase receipt is missing.',
    screenshotLabel: 'Contact support form',
    steps: [
      'Search your email for the original purchase or license message.',
      'Try activating again from Settings → License.',
      'Contact Support with your purchase email and approximate order date.',
    ],
  },
]

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug)
}

export function getArticlesByCategory(category: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.category === category)
}
