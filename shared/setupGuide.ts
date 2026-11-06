import {
  isDisallowedHeadphoneLabel,
  isDisallowedVoiceMicrophoneLabel,
  isProcessedMicrophoneLabel,
  pickCableInput,
  type ListedAudioDevice,
} from './gamingAudioRouting.ts'

export type CaptureGoal = 'teammates' | 'myself' | 'both'

export type CaptureGoalPlan = {
  goal: CaptureGoal
  title: string
  supported: boolean
  /** Only set when this goal can be applied with the current replay buffer. */
  replayAudioSource: 'system' | 'microphone' | null
  summary: string
  limitation: string | null
}

const BOTH_LIMITATION =
  'SlipUpClipz can record one source at a time: either what you hear, or your microphone. It cannot yet mix both into the same clip. Recording both together would need a separate change to the replay buffer.'

export function captureGoalPlan(goal: CaptureGoal): CaptureGoalPlan {
  if (goal === 'teammates') {
    return {
      goal,
      title: 'Record what I hear',
      supported: true,
      replayAudioSource: 'system',
      summary:
        'Clip saves the playback mix coming out of your headphones or speakers. That usually includes the game and voice chat you hear. It does not isolate one teammate, and it does not add your own microphone.',
      limitation: null,
    }
  }
  if (goal === 'myself') {
    return {
      goal,
      title: 'Record my microphone',
      supported: true,
      replayAudioSource: 'microphone',
      summary:
        'Clip saves your own voice from the microphone you pick. It does not include the game or your teammates unless their voices are already coming out of that microphone.',
      limitation: null,
    }
  }
  return {
    goal,
    title: 'Record myself and what I hear',
    supported: false,
    replayAudioSource: null,
    summary: BOTH_LIMITATION,
    limitation: BOTH_LIMITATION,
  }
}

/** Settings a goal may change. Routing, headphones, and the voice-chat preset are not included. */
export function captureGoalSettingsPatch(
  goal: CaptureGoal,
): { replayAudioSource: 'system' | 'microphone' } | null {
  const plan = captureGoalPlan(goal)
  if (!plan.supported || !plan.replayAudioSource) return null
  return { replayAudioSource: plan.replayAudioSource }
}

export function isPhysicalMicrophoneLabel(label: string): boolean {
  if (isDisallowedVoiceMicrophoneLabel(label) || isProcessedMicrophoneLabel(label)) return false
  const lower = label.toLowerCase()
  if (lower.includes('speaker') || lower.includes('output') || lower.includes('cable')) return false
  if (lower.includes('stereo mix') || lower.includes('loopback') || lower.includes('what u hear')) return false
  return true
}

export function physicalMicrophones(devices: ListedAudioDevice[]): ListedAudioDevice[] {
  return devices.filter((device) => isPhysicalMicrophoneLabel(device.label))
}

export function processedMicrophones(devices: ListedAudioDevice[]): ListedAudioDevice[] {
  return devices.filter((device) => isProcessedMicrophoneLabel(device.label))
}

export function headphoneChoices(devices: ListedAudioDevice[]): ListedAudioDevice[] {
  return devices.filter(
    (device) => device.deviceId !== 'default' && !isDisallowedHeadphoneLabel(device.label),
  )
}

export type SetupRecommendation = {
  physicalMics: ListedAudioDevice[]
  processedMics: ListedAudioDevice[]
  headphones: ListedAudioDevice[]
  cableInput: ListedAudioDevice | null
  needsVirtualCable: boolean
  processedExplanation: string | null
  manualSteps: string[]
}

export function recommendSetup(
  inputs: ListedAudioDevice[],
  outputs: ListedAudioDevice[],
  headphoneLabel: string | null,
): SetupRecommendation {
  const processed = processedMicrophones(inputs)
  const physical = physicalMicrophones(inputs)
  const processedExplanation =
    processed.length === 0
      ? null
      : processed.length === 1
        ? `${processed[0].label} is a processed microphone. It can sound cleaner than the original microphone. Pick it only if you want that processing. SlipUpClipz does not turn the processor on or off.`
        : `${processed.map((device) => device.label).join(', ')} are processed microphones. They can sound cleaner than the original microphone. Pick one only if you want that processing. SlipUpClipz does not turn the processor on or off.`
  return {
    physicalMics: physical,
    processedMics: processed,
    headphones: headphoneChoices(outputs),
    cableInput: pickCableInput(outputs),
    needsVirtualCable: true,
    processedExplanation,
    manualSteps: voiceChatManualSteps({
      processedMicrophoneLabel: processed[0]?.label ?? null,
      physicalMicrophoneLabel: physical[0]?.label ?? null,
      headphoneLabel,
    }),
  }
}

export function voiceChatManualSteps(input: {
  processedMicrophoneLabel: string | null
  physicalMicrophoneLabel: string | null
  headphoneLabel: string | null
}): string[] {
  const steps: string[] = []
  if (input.processedMicrophoneLabel) {
    const source = input.physicalMicrophoneLabel ?? 'your microphone'
    steps.push(
      `In the app that creates ${input.processedMicrophoneLabel}, choose ${source} as its source. SlipUpClipz cannot change that app.`,
    )
  }
  steps.push(
    'Discord: set the microphone to CABLE Output. That is the virtual microphone teammates hear. CABLE Input is only where SlipUpClipz sends audio. SlipUpClipz cannot change Discord.',
    'In your game, set the microphone to CABLE Output as well. SlipUpClipz cannot change the game.',
    `Windows: set playback to ${input.headphoneLabel ?? 'your headphones'} and turn off Listen for your microphone. SlipUpClipz cannot change Windows.`,
  )
  return steps
}

export const RECORDING_VERSUS_ROUTING = [
  'Record what I hear — Clip saves the game and voice-chat playback coming through your headphones, when system audio is the replay source.',
  'Record my microphone — Clip saves the microphone selected for replay. That can be different from the microphone Discord uses.',
  'Microphone in the Live Audio Mixer — sends your microphone with soundboard clips. With VB-Cable selected, that mix goes to CABLE Input and Discord or the game uses CABLE Output.',
  'Soundboard clips play in your selected headphones.',
  'Hear Myself — on the Soundboard, plays your microphone in your headphones. It stays off until you turn it on.',
] as const

export const VOICE_CHAT_TROUBLESHOOTING = [
  {
    problem: 'Silence in Discord or the game',
    fix: 'Set their microphone to CABLE Output, not CABLE Input and not your headset microphone. Then play a soundboard clip.',
  },
  {
    problem: 'You hear your own voice in the headphones',
    fix: 'Turn off Hear Myself. Also turn off Listen for that microphone in Windows sound settings.',
  },
  {
    problem: 'Teammates hear you twice',
    fix: 'Discord and the game should use only CABLE Output. Do not also select your headset microphone there.',
  },
  {
    problem: 'The wrong microphone is being used',
    fix: 'Pick the microphone name you expect under Microphone for voice chat, then turn the preset on again. SlipUpClipz will not switch to a different device on its own.',
  },
] as const
