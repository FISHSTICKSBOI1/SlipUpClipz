/**
 * Decides which devices and graphs the soundboard uses.
 * The Web Audio engine follows this plan. It does not choose devices itself.
 */

export type ListedAudioDevice = {
  deviceId: string
  label: string
}

export type AudioRouteMode = 'legacy' | 'gaming-discord'

export type AudioRoutePlan = {
  mode: AudioRouteMode
  voiceSinkId: string | null
  voiceSinkExplicit: boolean
  voiceMicrophone: boolean
  voicePads: boolean
  /** Preset mix: a peak limiter only, so pads do not compress the microphone. */
  protectWithoutDucking: boolean
  localEnabled: boolean
  localSinkId: string | null
  localSinkExplicit: boolean
  localMicrophone: boolean
  localPads: boolean
  microphoneDeviceId: string | null
  /** Keep the voice-chat graph alive between pad presses. */
  keepVoiceGraphHot: boolean
}

export type RouteSettings = {
  gamingDiscordPreset: boolean
  hearMyself: boolean
  mixerMicrophoneEnabled: boolean
  audioOutputDeviceId: string | null
  audioInputDeviceId: string | null
  routeToVBCable: boolean
  voiceChatMicrophoneDeviceId: string | null
  monitorMicrophoneLocally: boolean | null
}

export type PlaybackTargetDecision = {
  voicePads: boolean
  localPads: boolean
  voiceMicrophone: boolean
  localMicrophone: boolean
}

export type GamingDiscordPreparation =
  | {
      ok: true
      microphoneDeviceId: string
      microphoneLabel: string
      cable: ListedAudioDevice
      headphone: ListedAudioDevice
    }
  | { ok: false; message: string }

export const GAMING_DISCORD_CHECKLIST = [
  'Discord: set the microphone to CABLE Output. That is the virtual microphone. CABLE Input is where SlipUpClipz plays audio. SlipUpClipz cannot change Discord.',
  'In your game, set the microphone to CABLE Output. SlipUpClipz cannot change the game.',
  'Windows: set playback to your headphones and turn off Listen for your microphone. SlipUpClipz cannot change Windows.',
] as const

export function isSixteenChannelCable(label: string): boolean {
  return /16\s*ch/i.test(label)
}

export function isExactCableInput(label: string): boolean {
  const lower = label.toLowerCase()
  if (isSixteenChannelCable(lower)) return false
  return lower.includes('cable input')
}

export function isAsusProcessedInput(label: string): boolean {
  const lower = label.toLowerCase()
  return lower.includes('ai noise-cancelling input') || lower.includes('ai noise-canceling input')
}

export function isDisallowedHeadphoneLabel(label: string): boolean {
  const lower = label.toLowerCase()
  if (isSixteenChannelCable(lower)) return true
  if (lower.includes('cable input') || lower.includes('cable output')) return true
  if (lower.includes('vb-audio') || lower.includes('virtual cable') || lower.includes('voicemeeter')) return true
  if (lower.includes('system virtual line')) return true
  if (lower.includes('ai noise-cancelling output') || lower.includes('ai noise-canceling output')) return true
  if (lower.includes('fifine') && lower.includes('speaker')) return true
  return false
}

export function isDisallowedVoiceMicrophoneLabel(label: string): boolean {
  const lower = label.toLowerCase()
  if (lower.includes('system virtual line')) return true
  if (lower.includes('cable output') || lower.includes('cable input')) return true
  if (lower.includes('ai noise-cancelling output') || lower.includes('ai noise-canceling output')) return true
  if (isSixteenChannelCable(lower)) return true
  return false
}

export function pickCableInput(devices: ListedAudioDevice[]): ListedAudioDevice | null {
  return devices.find((device) => isExactCableInput(device.label)) ?? null
}

export function pickAsusProcessedInput(devices: ListedAudioDevice[]): ListedAudioDevice | null {
  return devices.find((device) => isAsusProcessedInput(device.label)) ?? null
}

/** A noise-processed capture endpoint, whatever app created it. Not a speaker or cable. */
export function isProcessedMicrophoneLabel(label: string): boolean {
  if (isDisallowedVoiceMicrophoneLabel(label)) return false
  const lower = label.toLowerCase()
  if (lower.includes('output') || lower.includes('speaker')) return false
  if (isAsusProcessedInput(label)) return true
  if (lower.includes('nvidia broadcast') || lower.includes('rtx voice')) return true
  if (
    lower.includes('noise') &&
    (lower.includes('cancel') || lower.includes('suppress'))
  ) {
    return true
  }
  return false
}

export function pickProcessedMicrophone(devices: ListedAudioDevice[]): ListedAudioDevice | null {
  return devices.find((device) => isProcessedMicrophoneLabel(device.label)) ?? null
}

export function playbackTargets(plan: AudioRoutePlan): PlaybackTargetDecision {
  const sameSink =
    plan.localEnabled &&
    plan.localSinkId === plan.voiceSinkId &&
    plan.localSinkExplicit === plan.voiceSinkExplicit
  return {
    voicePads: plan.voicePads,
    localPads: plan.localEnabled && plan.localPads && !sameSink,
    voiceMicrophone: plan.voiceMicrophone,
    localMicrophone: plan.localEnabled && plan.localMicrophone && !sameSink,
  }
}

export function microphoneTargets(plan: AudioRoutePlan): Array<'voice' | 'local'> {
  const playback = playbackTargets(plan)
  const targets: Array<'voice' | 'local'> = []
  if (playback.voiceMicrophone) targets.push('voice')
  if (playback.localMicrophone) targets.push('local')
  return targets
}

export const HEAR_MYSELF_HEADPHONE_ERROR =
  "Can't hear audio? Check your selected headphones, Windows output device, and volume."

/**
 * The browser device list cannot see Windows mute or a zero volume.
 * Say only what the device list actually shows.
 */
export function headphoneMonitorMessage(input: {
  selectedId: string | null
  selectedLabel: string | null
}): string | null {
  if (!input.selectedId) {
    return 'Choose the headphones in the Output list. A connected device is not used until it is selected.'
  }
  if (!input.selectedLabel) {
    return 'The selected headphones are not available. Check that the Windows output is enabled, then choose them again.'
  }
  if (!headphonesCanMonitor(input.selectedLabel)) {
    return `${input.selectedLabel} cannot play Hear Myself. Choose the headphones you wear.`
  }
  return null
}

export function headphonesCanMonitor(label: string | null | undefined): boolean {
  return Boolean(label) && !isDisallowedHeadphoneLabel(label ?? '')
}

/** The Clips button follows the route that is actually playing, including the older same-device path. */
export function isMicrophoneMonitoring(
  plan: AudioRoutePlan,
  settings: { monitorMicrophoneLocally: boolean | null; audioOutputDeviceId: string | null },
): boolean {
  if (playbackTargets(plan).localMicrophone) return true
  return (
    settings.monitorMicrophoneLocally === true
    && plan.mode === 'legacy'
    && plan.voiceMicrophone
    && plan.voiceSinkId !== null
    && plan.voiceSinkId === settings.audioOutputDeviceId
  )
}

function sinkReady(sinkId: string | null, explicit: boolean): boolean {
  if (!explicit) return true
  return Boolean(sinkId)
}

export function graphsToCreate(plan: AudioRoutePlan): { voice: boolean; local: boolean } {
  const playback = playbackTargets(plan)
  const voice =
    (plan.keepVoiceGraphHot || playback.voicePads || playback.voiceMicrophone) &&
    sinkReady(plan.voiceSinkId, plan.voiceSinkExplicit)
  const local =
    plan.localEnabled &&
    !sameOutput(plan) &&
    (plan.keepVoiceGraphHot || playback.localPads || playback.localMicrophone) &&
    sinkReady(plan.localSinkId, plan.localSinkExplicit)
  return { voice, local }
}

function sameOutput(plan: AudioRoutePlan): boolean {
  return plan.localSinkId === plan.voiceSinkId && plan.localSinkExplicit === plan.voiceSinkExplicit
}

function deviceById(devices: ListedAudioDevice[], deviceId: string | null): ListedAudioDevice | null {
  if (!deviceId) return null
  return devices.find((device) => device.deviceId === deviceId) ?? null
}

function legacyVoiceSink(
  settings: RouteSettings,
  outputs: ListedAudioDevice[],
): { sinkId: string | null; explicit: boolean } {
  if (settings.routeToVBCable) {
    const cable = pickCableInput(outputs)
    if (cable) return { sinkId: cable.deviceId, explicit: true }
    const other = outputs.find(
      (device) =>
        /vb-audio|virtual cable|voicemeeter/i.test(device.label) && !isSixteenChannelCable(device.label),
    )
    if (other) return { sinkId: other.deviceId, explicit: true }
    return {
      sinkId: settings.audioOutputDeviceId,
      explicit: settings.audioOutputDeviceId !== null,
    }
  }
  return {
    sinkId: settings.audioOutputDeviceId,
    explicit: settings.audioOutputDeviceId !== null,
  }
}

function legacyLocalMicrophone(settings: RouteSettings, localEnabled: boolean): boolean {
  if (!localEnabled) return false
  if (settings.monitorMicrophoneLocally === null) {
    return settings.hearMyself && settings.mixerMicrophoneEnabled
  }
  return settings.monitorMicrophoneLocally
}

export function buildAudioRoutePlan(
  settings: RouteSettings,
  outputs: ListedAudioDevice[],
  inputs: ListedAudioDevice[],
): { plan: AudioRoutePlan; notice: string | null } {
  if (settings.gamingDiscordPreset) {
    return buildGamingDiscordPlan(settings, outputs, inputs)
  }

  const voice = legacyVoiceSink(settings, outputs)
  const localSinkId = settings.audioOutputDeviceId
  const separate = Boolean(voice.sinkId) && voice.sinkId !== localSinkId
  const explicitMonitor = settings.monitorMicrophoneLocally === true
  const localEnabled = separate && (settings.hearMyself || explicitMonitor)
  const localMicrophone = legacyLocalMicrophone(settings, localEnabled)
  const localPads = settings.hearMyself && separate
  let voiceMicrophone = settings.mixerMicrophoneEnabled
  const sink = deviceById(outputs, voice.sinkId)
  const sinkIsHeadphones = Boolean(
    sink &&
    explicitMonitor &&
    !separate &&
    settings.audioOutputDeviceId &&
    voice.sinkId === settings.audioOutputDeviceId &&
    !isDisallowedHeadphoneLabel(sink.label),
  )
  if (sinkIsHeadphones) voiceMicrophone = true
  return {
    notice: null,
    plan: {
      mode: 'legacy',
      voiceSinkId: voice.sinkId,
      voiceSinkExplicit: voice.explicit,
      voiceMicrophone,
      voicePads: true,
      protectWithoutDucking: false,
      localEnabled,
      localSinkId,
      localSinkExplicit: localSinkId !== null,
      localMicrophone,
      localPads,
      microphoneDeviceId: voiceMicrophone || localMicrophone ? settings.audioInputDeviceId : null,
      keepVoiceGraphHot: voiceMicrophone || localMicrophone,
    },
  }
}

function buildGamingDiscordPlan(
  settings: RouteSettings,
  outputs: ListedAudioDevice[],
  inputs: ListedAudioDevice[],
): { plan: AudioRoutePlan; notice: string | null } {
  const cable = pickCableInput(outputs)
  const headphone = deviceById(outputs, settings.audioOutputDeviceId)
  const microphone = deviceById(inputs, settings.voiceChatMicrophoneDeviceId)
  const notices: string[] = []

  let voiceSinkId: string | null = null
  if (!cable) {
    notices.push(
      'VB-Audio Virtual Cable is not available. Install it from vb-audio.com/Cable and use CABLE Input. The microphone was not sent to another device.',
    )
  } else {
    voiceSinkId = cable.deviceId
  }

  let localEnabled = false
  const headphoneMessage = headphoneMonitorMessage({
    selectedId: settings.audioOutputDeviceId,
    selectedLabel: headphone?.label ?? null,
  })
  if (headphoneMessage) {
    notices.push(headphoneMessage)
  } else {
    localEnabled = true
  }

  let microphoneDeviceId: string | null = null
  if (!microphone) {
    notices.push('The voice-chat microphone is not connected. Nothing was substituted.')
  } else if (isDisallowedVoiceMicrophoneLabel(microphone.label)) {
    notices.push(`${microphone.label} is not a voice-chat microphone. Choose your microphone instead.`)
  } else {
    microphoneDeviceId = microphone.deviceId
  }

  const voiceReady = Boolean(voiceSinkId && microphoneDeviceId)
  const soundboardLocal = settings.hearMyself
  const monitorOn = settings.monitorMicrophoneLocally === true
  const localActive = localEnabled && (soundboardLocal || monitorOn)
  return {
    notice: notices[0] ?? null,
    plan: {
      mode: 'gaming-discord',
      voiceSinkId,
      voiceSinkExplicit: true,
      voiceMicrophone: voiceReady,
      voicePads: Boolean(voiceSinkId),
      protectWithoutDucking: true,
      localEnabled: localActive,
      localSinkId: localActive ? headphone?.deviceId ?? null : null,
      localSinkExplicit: true,
      localMicrophone: localEnabled && monitorOn,
      localPads: localEnabled && soundboardLocal,
      microphoneDeviceId: voiceReady ? microphoneDeviceId : null,
      keepVoiceGraphHot: Boolean(voiceSinkId),
    },
  }
}

export function prepareGamingDiscordPreset(input: {
  outputs: ListedAudioDevice[]
  inputs: ListedAudioDevice[]
  headphoneDeviceId: string | null
  useAsusInput: boolean
  selectedMicrophoneId: string | null
}): GamingDiscordPreparation {
  const cable = pickCableInput(input.outputs)
  if (!cable) {
    return {
      ok: false,
      message:
        'Install VB-Audio Virtual Cable, then turn this on again. SlipUpClipz will use CABLE Input and will not send your microphone to the speakers.',
    }
  }

  const headphone = deviceById(input.outputs, input.headphoneDeviceId)
  const headphoneMessage = headphoneMonitorMessage({
    selectedId: input.headphoneDeviceId,
    selectedLabel: headphone?.label ?? null,
  })
  if (headphoneMessage || !headphone) {
    return {
      ok: false,
      message: headphoneMessage ?? 'The selected headphones are not available. Check that the Windows output is enabled, then choose them again.',
    }
  }

  const processed = pickProcessedMicrophone(input.inputs)
  if (input.useAsusInput) {
    if (!processed) {
      return {
        ok: false,
        message:
          'No processed microphone was found, so none was selected. Choose the microphone you want voice chat to hear.',
      }
    }
    return {
      ok: true,
      microphoneDeviceId: processed.deviceId,
      microphoneLabel: processed.label,
      cable,
      headphone,
    }
  }

  const selected = deviceById(input.inputs, input.selectedMicrophoneId)
  if (!selected || isDisallowedVoiceMicrophoneLabel(selected.label)) {
    return {
      ok: false,
      message: 'Choose the microphone people in voice chat should hear.',
    }
  }
  return {
    ok: true,
    microphoneDeviceId: selected.deviceId,
    microphoneLabel: selected.label,
    cable,
    headphone,
  }
}

export function isMicrophoneSentToCable(plan: AudioRoutePlan, outputs: ListedAudioDevice[]): boolean {
  if (!plan.voiceMicrophone || !plan.voiceSinkId) return false
  const sink = deviceById(outputs, plan.voiceSinkId)
  return Boolean(sink && isExactCableInput(sink.label))
}
