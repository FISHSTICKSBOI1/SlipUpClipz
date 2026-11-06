import type { FaqItem } from '../components/FaqAccordion'

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Where can I download SlipUpClipz?',
    answer:
      'You can install SlipUpClipz through the Microsoft Store or download the latest Windows installer directly from SlipUpClipz.com. Both versions provide the same core app and Pro license support.',
  },
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
      'Yes. The replay buffer can keep running while you game. Global hotkeys, minimize to tray, and Start with Windows are included on the Free plan. Turn global hotkeys on in Settings if a shortcut should work while another app is focused.',
  },
  {
    question: 'What is included in Free and Pro?',
    answer:
      'Free includes instant replay clipping, recording, trimming, the clip library, 7 soundboard pads, global hotkeys, VB-Audio Virtual Cable routing, Start with Windows, voice effects, and Hear Myself. Pro includes everything in Free, plus 50 soundboard pads and local AI Voice Clip Cloning. AI Voice Clip Cloning ships with desktop v0.1.6. The published v0.1.5 download does not include it.',
  },
  {
    question: 'How does AI Voice Clip Cloning work?',
    answer:
      'Pro in v0.1.6 can clone a voice locally with Qwen3-TTS 0.6B from a 0.8–7 second reference. English is the language we have tested. The speaker has to give permission. You can generate one clip, or three variations, then preview and save any combination. It needs a compatible NVIDIA GPU. It does not work on every graphics card, it does not guarantee the result will sound like the speaker, and generating a clip uses the GPU while it runs.',
  },
  {
    question: 'Will it affect game performance?',
    answer:
      'Clipping and the soundboard are built to stay light while you play, and SlipUpClipz does not record video. AI Voice Clip Cloning is different: it loads a local model on a compatible NVIDIA GPU and uses that GPU while generating. The model is not a zero-cost background feature. Close unused audio apps if you notice contention.',
  },
  {
    question: 'Is Pro a subscription?',
    answer:
      'Yes. SlipUpClipz Pro is an annual subscription, advertised at $4.99 USD per year, with automatic yearly renewal at the regular price. You keep the same license key across renewals. About 15 to 45 days before each renewal, we email the renewal date, the renewal amount, and how to cancel. To cancel, open Manage subscription on the pricing page. You do not need the app. Enter the license key and checkout email, or request a one-time link if you lost the key. Canceling stops the next charge and Pro stays through the period you already paid. A full refund of the current year ends Pro and stops future charges. Removing the license from a computer does not cancel billing. Checkout shows the exact charge before you pay.',
  },
  {
    question: 'How does the $1 survey discount work?',
    answer:
      'Complete the short survey on the pricing page, submit it, and then claim the thank-you. That thank-you is $1 off the first year of a new Pro subscription bought through Stripe on this website. If the regular price is $4.99, the first year is $3.99 and later years return to $4.99. The discount applies once, to the first invoice only, and it cannot be applied twice on the same checkout. It does not apply to Microsoft Store purchases. You can buy Pro at the regular price without the survey. If someone already shared a code with you, you can type it on the Stripe checkout page.',
  },
  {
    question: 'How do automatic updates work?',
    answer:
      'Microsoft Store installs receive updates through the Store. Direct-download builds can check GitHub Releases for a newer version, download it in the background, and ask you to restart to install. You can also check manually in Settings → Updates.',
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
