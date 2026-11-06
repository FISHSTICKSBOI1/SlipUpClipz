import { AI_VOICE_SAMPLES } from '../config/aiVoiceShowcase'
import { VoiceSamplePlayer } from './VoiceSamplePlayer'

export function VoiceComparison() {
  return (
    <div>
      <h3 className="font-display text-lg font-bold text-white sm:text-xl">Hear the Difference</h3>
      <div className="mt-4 grid gap-3">
        {AI_VOICE_SAMPLES.map((sample) => (
          <VoiceSamplePlayer key={sample.id} sample={sample} />
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        The samples say different words. The AI uses the reference to shape new speech.
      </p>
    </div>
  )
}
