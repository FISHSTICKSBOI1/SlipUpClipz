/** Voice-chat mix levels. The microphone and soundboard share one output. */
export const VOICE_MIC_GAIN_MAX = 0.6
export const VOICE_PAD_GAIN_MAX = 0.75
export const LOCAL_PAD_GAIN_MAX = 0.9
export const VOICE_MIX_AUDIBLE_PEAK = 0.02

export type PadDestination = 'voice' | 'local'

/**
 * Where a pad is started, and that the buffer must belong to that destination.
 * A clip decoded earlier, including on a context that has since been closed,
 * is copied before it is played. The live microphone does not use that cache.
 */
export function padPlaybackPlan(input: {
  bufferContextId: string
  voiceContextId: string | null
  localContextId: string | null
  voicePads: boolean
  localPads: boolean
}): Array<{ destination: PadDestination; contextId: string; copy: boolean }> {
  const steps: Array<{ destination: PadDestination; contextId: string; copy: boolean }> = []
  if (input.voicePads && input.voiceContextId) {
    steps.push({
      destination: 'voice',
      contextId: input.voiceContextId,
      copy: input.bufferContextId !== input.voiceContextId,
    })
  }
  if (input.localPads && input.localContextId) {
    steps.push({
      destination: 'local',
      contextId: input.localContextId,
      copy: input.bufferContextId !== input.localContextId,
    })
  }
  return steps
}

export type VoiceMixVerdictKind = 'idle' | 'routing' | 'wrong-device' | 'game'

export function voiceMixVerdict(input: {
  tested: boolean
  soundboardPeak: number
  sinkMatchesCable: boolean | null
}): { kind: VoiceMixVerdictKind; message: string } {
  if (!input.tested) {
    return {
      kind: 'idle',
      message:
        'Press Test soundboard. SlipUpClipz checks whether the tone reaches the voice-chat mix before a game is involved.',
    }
  }
  if (input.soundboardPeak < VOICE_MIX_AUDIBLE_PEAK) {
    return {
      kind: 'routing',
      message:
        'The soundboard did not reach the voice-chat mix. Teammates cannot hear a clip that never enters CABLE Input. This is a SlipUpClipz routing problem.',
    }
  }
  if (input.sinkMatchesCable === false) {
    return {
      kind: 'wrong-device',
      message:
        'The soundboard is playing, but the voice-chat output is not CABLE Input. SlipUpClipz did not leave it on the Windows default.',
    }
  }
  if (input.sinkMatchesCable === null) {
    return {
      kind: 'game',
      message:
        'The soundboard reached the voice-chat mix. The output device name could not be confirmed. In Valorant, choose CABLE Output as the microphone. Valorant can remove sound effects even when the cable has them. SlipUpClipz cannot change Valorant.',
    }
  }
  return {
    kind: 'game',
    message:
      'The soundboard is present on CABLE Input, in the same mix as your microphone. If Valorant still cannot hear it, set Valorant’s microphone to CABLE Output, not your headset. Valorant’s voice threshold and noise removal can strip sound effects. SlipUpClipz cannot change Valorant.',
  }
}
