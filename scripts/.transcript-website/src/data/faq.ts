import type { FaqItem } from '../components/FaqAccordion'

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What does SlipUpClipz record?',
    answer:
      'SlipUpClipz keeps a short rolling replay buffer of the audio sources you select — typically microphone, game, Discord, or system audio depending on your setup. It captures recent audio for clipping, not long continuous recordings by default.',
  },
  {
    question: 'Can it capture Discord audio?',
    answer:
      'Yes, when your replay source includes system or application audio and Windows routing is set up correctly. Many players also use VB-Audio Virtual Cable so Discord voice can be mixed with the soundboard.',
  },
  {
    question: 'Can it capture game audio?',
    answer:
      'Yes, when system/loopback capture is available and selected as the replay source. Exact behavior can vary by Windows audio settings and how the game outputs sound.',
  },
  {
    question: 'Does it record video?',
    answer:
      'No. SlipUpClipz is audio-focused: replay clipping, trimming, soundboard playback, and virtual microphone routing.',
  },
  {
    question: 'Does it work with Valorant, CS2, Fortnite, and Discord?',
    answer:
      'SlipUpClipz is built for Windows gaming and Discord voice chat. Compatibility depends on your audio routing (system capture and/or a virtual cable). Always follow each game’s and Discord’s device settings.',
  },
  {
    question: 'Do I need VB-Audio Virtual Cable?',
    answer:
      'Not for basic clipping and local playback. You typically need a virtual audio device like VB-Audio Virtual Cable if you want Discord or games to hear your microphone and soundboard together.',
  },
  {
    question: 'Can people hear my microphone and soundboard together?',
    answer:
      'Yes, when virtual microphone routing is configured: SlipUpClipz sends your mic and pads to a virtual device, and Discord (or another app) uses that virtual device as its input.',
  },
  {
    question: 'Can I import MP3 and WAV files?',
    answer:
      'Yes. You can import MP3 and WAV files into the soundboard in addition to clips you capture with the replay buffer.',
  },
  {
    question: 'Does it work in the background?',
    answer:
      'Yes. The replay buffer can keep running while you game. Pro unlocks global hotkeys, minimize-to-tray behavior, and launch on startup for background use.',
  },
  {
    question: 'Will it affect game performance?',
    answer:
      'SlipUpClipz is designed to stay lightweight while buffering recent audio. Impact varies by PC, but it does not record video and avoids heavy background work. Close unused audio apps if you notice contention.',
  },
  {
    question: 'Is Pro a subscription?',
    answer:
      'No. Pro is a one-time lifetime purchase. There is no subscription in the current product design.',
  },
  {
    question: 'How do automatic updates work?',
    answer:
      'Installed builds can check GitHub Releases for a newer version, download it in the background, and ask you to restart to install. You can also check manually in Settings → Updates.',
  },
  {
    question: 'Where are clips stored?',
    answer:
      'Clips and related library data are stored locally on your computer. SlipUpClipz does not upload your recordings by default.',
  },
  {
    question: 'Why might Windows show a SmartScreen warning?',
    answer:
      'New or unsigned apps often trigger Windows SmartScreen. If you downloaded SlipUpClipz from the official GitHub Releases or website download link, you can choose More info → Run anyway. Code signing will reduce these warnings once a certificate is in place.',
  },
]
