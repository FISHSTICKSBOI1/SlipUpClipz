import { AI_VOICE_SECTION_ID } from '../lib/scrollToSection'
import { AiScreenshotGallery } from './AiScreenshotGallery'
import { VoiceComparison } from './VoiceComparison'

export function AiVoicePanel({ heading = 'section' }: { heading?: 'section' | 'feature' }) {
  const titleClass =
    heading === 'feature'
      ? 'font-display text-2xl font-bold text-white sm:text-3xl'
      : 'font-display text-3xl font-bold tracking-tight text-white sm:text-4xl'

  return (
    <div id={AI_VOICE_SECTION_ID} className="scroll-mt-24">
      <div className="flex max-w-2xl flex-wrap items-center gap-3">
        <h2 className={titleClass}>AI Voice Clip Cloning</h2>
        <span className="rounded-full border border-glow-purple/40 bg-glow-purple/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.16em] text-glow-magenta">
          NEW
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
        Turn a short voice recording into new speech with AI. Preview your results and save them
        to your soundboard.
      </p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:gap-8">
        <AiScreenshotGallery />
        <VoiceComparison />
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-500">
        The speaker must give permission. Generation stays on your PC and needs a compatible NVIDIA
        GPU. Results are not guaranteed to sound identical to the reference.
      </p>
    </div>
  )
}
