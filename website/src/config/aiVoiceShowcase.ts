/**
 * Public AI Voice Clip Cloning showcase assets.
 * Screenshot crops are display-only. The files in website/public stay unchanged.
 */

export type ShowcaseCrop = {
  x: number
  y: number
  width: number
  height: number
}

export type VoiceSample = {
  id: string
  src: string
  label: string
  quote: string
  detail: string
}

export type ShowcaseShot = {
  id: string
  step: number
  title: string
  src: string
  imageWidth: number
  imageHeight: number
  crop: ShowcaseCrop
  alt: string
  caption: string
}

export const AI_VOICE_SAMPLES: readonly VoiceSample[] = [
  {
    id: 'original',
    src: '/audio/ai-voice/original-reference.wav',
    label: 'Original voice',
    quote: 'HES ONE SHOT!',
    detail: 'Short reference from a speaker who gave permission',
  },
  {
    id: 'generated',
    src: '/audio/ai-voice/ai-generated.wav',
    label: 'AI-generated voice',
    quote: 'HELP ME GUYS!',
    detail: 'New speech created from that reference',
  },
]

export const AI_VOICE_SHOTS: readonly ShowcaseShot[] = [
  {
    id: 'choose-words',
    step: 1,
    title: 'Choose your voice and words',
    src: '/images/ai-voice/step-1-before.png',
    imageWidth: 1920,
    imageHeight: 1080,
    crop: { x: 384, y: 158, width: 1152, height: 648 },
    alt: 'AI Voice Clone dialog showing the reference transcript HES ONE SHOT, the requested line HELP ME GUYS, a checked speaker-permission box, and the Generate AI voice button.',
    caption: 'Enter the reference, type the new line, and confirm the speaker gave permission.',
  },
  {
    id: 'preview',
    step: 2,
    title: 'Generate and preview',
    src: '/images/ai-voice/step-2-generated-preview.png',
    imageWidth: 1920,
    imageHeight: 1080,
    crop: { x: 640, y: 700, width: 640, height: 360 },
    alt: 'AI Voice Clone dialog after generation, with the requested line, the generated-voice preview, and the Save AI clip to library button.',
    caption: 'Preview the generated voice, then save the clip you want.',
  },
  {
    id: 'library',
    step: 3,
    title: 'Save to your library',
    src: '/images/ai-voice/step-3-saved-clips.png',
    imageWidth: 1920,
    imageHeight: 1080,
    crop: { x: 400, y: 288, width: 1408, height: 792 },
    alt: 'Clip library with the AI-generated clip and the original HES ONE SHOT recording, including AI Clone and Assign hotkey actions.',
    caption: 'The saved clip sits next to the original recording, ready for a soundboard pad.',
  },
]
