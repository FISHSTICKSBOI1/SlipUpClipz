import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GAMING_DISCORD_CHECKLIST,
  buildAudioRoutePlan,
  isDisallowedHeadphoneLabel,
  HEAR_MYSELF_HEADPHONE_ERROR,
  headphoneMonitorMessage,
  headphonesCanMonitor,
  isMicrophoneMonitoring,
  isMicrophoneSentToCable,
  microphoneTargets,
  pickAsusProcessedInput,
  pickCableInput,
  playbackTargets,
  prepareGamingDiscordPreset,
  type ListedAudioDevice,
  type RouteSettings,
} from './gamingAudioRouting.ts'

const outputs: ListedAudioDevice[] = [
  { deviceId: 'cable-16', label: 'CABLE In 16ch (VB-Audio Virtual Cable)' },
  { deviceId: 'cable-in', label: 'CABLE Input (VB-Audio Virtual Cable)' },
  { deviceId: 'asus-out', label: 'AI Noise-cancelling Output (ASUS Utility)' },
  { deviceId: 'fifine-spk', label: 'Speakers (fifine Microphone)' },
  { deviceId: 'phones', label: 'Headset Earphone (CORSAIR VOID ELITE Wireless Gaming Dongle)' },
]

const inputs: ListedAudioDevice[] = [
  { deviceId: 'fifine', label: 'Microphone (fifine Microphone)' },
  { deviceId: 'asus-in', label: 'AI Noise-cancelling Input (ASUS Utility)' },
  { deviceId: 'virtual-line', label: 'System Virtual Line (ASUS Utility)' },
  { deviceId: 'cable-out', label: 'CABLE Output (VB-Audio Virtual Cable)' },
]

function legacy(overrides: Partial<RouteSettings> = {}): RouteSettings {
  return {
    gamingDiscordPreset: false,
    hearMyself: true,
    mixerMicrophoneEnabled: false,
    audioOutputDeviceId: 'phones',
    audioInputDeviceId: 'fifine',
    routeToVBCable: false,
    voiceChatMicrophoneDeviceId: null,
    monitorMicrophoneLocally: null,
    ...overrides,
  }
}

describe('endpoint selection', () => {
  it('prefers CABLE Input and ignores the 16-channel endpoint', () => {
    assert.equal(pickCableInput(outputs)?.deviceId, 'cable-in')
    assert.equal(pickCableInput([{ deviceId: 'cable-16', label: 'CABLE In 16ch (VB-Audio Virtual Cable)' }]), null)
  })

  it('selects only the ASUS processed capture', () => {
    assert.equal(pickAsusProcessedInput(inputs)?.deviceId, 'asus-in')
    assert.equal(pickAsusProcessedInput([{ deviceId: 'virtual-line', label: 'System Virtual Line (ASUS Utility)' }]), null)
  })

  it('rejects substitute headphone endpoints', () => {
    assert.equal(isDisallowedHeadphoneLabel('CABLE Input (VB-Audio Virtual Cable)'), true)
    assert.equal(isDisallowedHeadphoneLabel('CABLE In 16ch (VB-Audio Virtual Cable)'), true)
    assert.equal(isDisallowedHeadphoneLabel('AI Noise-cancelling Output (ASUS Utility)'), true)
    assert.equal(isDisallowedHeadphoneLabel('Speakers (fifine Microphone)'), true)
    assert.equal(isDisallowedHeadphoneLabel('System Virtual Line (ASUS Utility)'), true)
    assert.equal(isDisallowedHeadphoneLabel('Headset Earphone (CORSAIR VOID ELITE Wireless Gaming Dongle)'), false)
  })
})

describe('Gaming + Discord preset', () => {
  it('configures the processed microphone, cable, and headphones', () => {
    const prepared = prepareGamingDiscordPreset({
      outputs,
      inputs,
      headphoneDeviceId: 'phones',
      useAsusInput: true,
      selectedMicrophoneId: null,
    })
    assert.equal(prepared.ok, true)
    if (!prepared.ok) return
    assert.equal(prepared.microphoneDeviceId, 'asus-in')
    assert.equal(prepared.cable.deviceId, 'cable-in')
    assert.equal(prepared.headphone.deviceId, 'phones')

    const { plan } = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        voiceChatMicrophoneDeviceId: prepared.microphoneDeviceId,
        audioOutputDeviceId: 'phones',
      }),
      outputs,
      inputs,
    )
    assert.equal(plan.mode, 'gaming-discord')
    assert.equal(plan.voiceSinkId, 'cable-in')
    assert.equal(plan.voiceMicrophone, true)
    assert.equal(plan.voicePads, true)
    assert.equal(plan.localMicrophone, false)
    assert.equal(plan.localPads, true)
    assert.equal(plan.localSinkId, 'phones')
    assert.equal(plan.protectWithoutDucking, true)
    assert.equal(plan.keepVoiceGraphHot, true)
    assert.deepEqual(microphoneTargets(plan), ['voice'])
    assert.equal(isMicrophoneSentToCable(plan, outputs), true)
    const playback = playbackTargets(plan)
    assert.equal(playback.voicePads, true)
    assert.equal(playback.localPads, true)
    assert.equal(playback.voiceMicrophone, true)
    assert.equal(playback.localMicrophone, false)
  })

  it('does not select ASUS when it is missing or not confirmed', () => {
    const missing = prepareGamingDiscordPreset({
      outputs,
      inputs: inputs.filter((device) => device.deviceId !== 'asus-in'),
      headphoneDeviceId: 'phones',
      useAsusInput: true,
      selectedMicrophoneId: 'fifine',
    })
    assert.equal(missing.ok, false)

    const unconfirmed = prepareGamingDiscordPreset({
      outputs,
      inputs,
      headphoneDeviceId: 'phones',
      useAsusInput: false,
      selectedMicrophoneId: null,
    })
    assert.equal(unconfirmed.ok, false)

    const chosen = prepareGamingDiscordPreset({
      outputs,
      inputs,
      headphoneDeviceId: 'phones',
      useAsusInput: false,
      selectedMicrophoneId: 'fifine',
    })
    assert.equal(chosen.ok, true)
    if (chosen.ok) assert.equal(chosen.microphoneDeviceId, 'fifine')
  })

  it('refuses a missing cable or a substitute headphone', () => {
    const noCable = prepareGamingDiscordPreset({
      outputs: outputs.filter((device) => device.deviceId !== 'cable-in'),
      inputs,
      headphoneDeviceId: 'phones',
      useAsusInput: true,
      selectedMicrophoneId: null,
    })
    assert.equal(noCable.ok, false)
    if (!noCable.ok) assert.match(noCable.message, /CABLE Input/)

    for (const headphoneDeviceId of ['cable-16', 'asus-out', 'fifine-spk', null]) {
      const prepared = prepareGamingDiscordPreset({
        outputs,
        inputs,
        headphoneDeviceId,
        useAsusInput: true,
        selectedMicrophoneId: null,
      })
      assert.equal(prepared.ok, false)
    }
  })

  it('does not move the microphone to another device when the cable disappears', () => {
    const { plan, notice } = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'phones',
      }),
      outputs.filter((device) => device.deviceId !== 'cable-in'),
      inputs,
    )
    assert.equal(plan.voiceMicrophone, false)
    assert.equal(plan.voiceSinkId, null)
    assert.equal(plan.localMicrophone, false)
    assert.match(notice ?? '', /not sent to another device/)
  })

  it('leaves replay and legacy routing alone when the preset is off', () => {
    const { plan } = buildAudioRoutePlan(
      legacy({
        routeToVBCable: false,
        mixerMicrophoneEnabled: true,
        hearMyself: true,
        monitorMicrophoneLocally: null,
        audioOutputDeviceId: null,
      }),
      outputs,
      inputs,
    )
    assert.equal(plan.mode, 'legacy')
    assert.equal(plan.voiceSinkId, null)
    assert.equal(plan.protectWithoutDucking, false)
    assert.equal(plan.voiceMicrophone, true)
    assert.equal(plan.microphoneDeviceId, 'fifine')
    assert.equal(plan.keepVoiceGraphHot, true)
  })

  it('keeps legacy local microphone monitoring only when it was already on', () => {
    const split = buildAudioRoutePlan(
      legacy({
        routeToVBCable: true,
        mixerMicrophoneEnabled: true,
        hearMyself: true,
        monitorMicrophoneLocally: null,
        audioOutputDeviceId: 'phones',
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(split.voiceSinkId, 'cable-in')
    assert.deepEqual(microphoneTargets(split), ['voice', 'local'])

    const padsOnly = buildAudioRoutePlan(
      legacy({
        routeToVBCable: true,
        mixerMicrophoneEnabled: true,
        hearMyself: true,
        monitorMicrophoneLocally: false,
        audioOutputDeviceId: 'phones',
      }),
      outputs,
      inputs,
    ).plan
    assert.deepEqual(microphoneTargets(padsOnly), ['voice'])
    assert.equal(playbackTargets(padsOnly).localPads, true)
  })

  it('hears the voice-chat microphone in the headphones without a second stream', () => {
    const off = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: true,
        routeToVBCable: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'phones',
        monitorMicrophoneLocally: false,
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(off.localMicrophone, false)
    assert.equal(off.voiceMicrophone, true)
    assert.equal(off.voiceSinkId, 'cable-in')
    assert.deepEqual(microphoneTargets(off), ['voice'])

    const on = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: false,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'phones',
        monitorMicrophoneLocally: true,
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(on.localMicrophone, true)
    assert.equal(on.localPads, true)
    assert.equal(on.voiceMicrophone, true)
    assert.equal(on.voiceSinkId, 'cable-in')
    assert.equal(on.localSinkId, 'phones')
    assert.equal(on.microphoneDeviceId, 'asus-in')
    assert.deepEqual(microphoneTargets(on), ['voice', 'local'])
    assert.equal(playbackTargets(on).voiceMicrophone, true)
    assert.equal(playbackTargets(on).localMicrophone, true)
  })

  it('does not copy the old Hear myself switch into microphone monitoring', () => {
    const plan = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: true,
        voiceChatMicrophoneDeviceId: 'fifine',
        audioOutputDeviceId: 'phones',
        monitorMicrophoneLocally: null,
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(plan.localPads, true)
    assert.equal(plan.localMicrophone, false)
    assert.equal(plan.voicePads, true)
    assert.equal(plan.microphoneDeviceId, 'fifine')
  })

  it('turns headphone soundboard playback off without stopping voice chat', () => {
    const plan = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: false,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'phones',
        monitorMicrophoneLocally: false,
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(plan.localPads, false)
    assert.equal(plan.localEnabled, false)
    assert.equal(plan.voicePads, true)
    assert.equal(plan.voiceMicrophone, true)
    assert.equal(plan.voiceSinkId, 'cable-in')
    assert.equal(playbackTargets(plan).localPads, false)
  })

  it('keeps an explicit Hear Myself off the cable when the older mixer mic is off', () => {
    const plan = buildAudioRoutePlan(
      legacy({
        routeToVBCable: true,
        hearMyself: false,
        mixerMicrophoneEnabled: false,
        monitorMicrophoneLocally: true,
        audioOutputDeviceId: 'phones',
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(plan.mode, 'legacy')
    assert.equal(plan.voiceMicrophone, false)
    assert.equal(plan.localMicrophone, true)
    assert.equal(plan.localPads, false)
    assert.equal(plan.voiceSinkId, 'cable-in')
    assert.equal(plan.localSinkId, 'phones')
    assert.deepEqual(microphoneTargets(plan), ['local'])
  })

  it('does not treat the virtual cable as headphones for Hear Myself', () => {
    const plan = buildAudioRoutePlan(
      legacy({
        routeToVBCable: true,
        hearMyself: false,
        mixerMicrophoneEnabled: false,
        monitorMicrophoneLocally: true,
        audioOutputDeviceId: 'cable-in',
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(plan.voiceMicrophone, false)
    assert.equal(plan.localMicrophone, false)
    assert.deepEqual(microphoneTargets(plan), [])
  })

  it('plays soundboard clips in the headphones from the saved preference', () => {
    const plan = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'phones',
      }),
      outputs,
      inputs,
    ).plan
    assert.equal(plan.localPads, true)
    assert.equal(plan.voicePads, true)
    assert.equal(plan.localSinkId, 'phones')
    assert.equal(plan.voiceSinkId, 'cable-in')
    assert.equal(plan.microphoneDeviceId, 'asus-in')
  })

  it('does not transmit a microphone for someone who never turned voice chat on', () => {
    const plan = buildAudioRoutePlan(legacy(), outputs, inputs).plan
    assert.equal(plan.mode, 'legacy')
    assert.equal(plan.voiceMicrophone, false)
    assert.equal(plan.voiceSinkId, 'phones')
    assert.deepEqual(microphoneTargets(plan), [])
    assert.equal(plan.localPads, false)
    assert.equal(plan.voicePads, true)
  })

  it('does not move headphone playback onto the cable when headphones are missing', () => {
    const { plan, notice } = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        hearMyself: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: 'missing-phones',
      }),
      outputs,
      inputs,
    )
    assert.equal(plan.localEnabled, false)
    assert.equal(plan.localSinkId, null)
    assert.equal(plan.localPads, false)
    assert.equal(plan.voiceSinkId, 'cable-in')
    assert.match(notice ?? '', /not available/i)
    assert.doesNotMatch(notice ?? '', /disconnected|missing headphones/i)
  })

  it('does not call a connected device missing when it is simply not selected or muted', () => {
    const unselected = headphoneMonitorMessage({ selectedId: null, selectedLabel: null })
    const unavailable = headphoneMonitorMessage({ selectedId: 'gone', selectedLabel: null })
    const cable = headphoneMonitorMessage({ selectedId: 'cable-in', selectedLabel: 'CABLE Input (VB-Audio Virtual Cable)' })
    const ready = headphoneMonitorMessage({ selectedId: 'phones', selectedLabel: 'Headset Earphone' })
    assert.match(unselected ?? '', /Output list/)
    assert.match(unavailable ?? '', /not available/)
    assert.match(cable ?? '', /cannot play Hear Myself/)
    assert.equal(ready, null)
    assert.match(HEAR_MYSELF_HEADPHONE_ERROR, /Windows output device/)
    assert.doesNotMatch(HEAR_MYSELF_HEADPHONE_ERROR, /disconnected/)
    const noneSelected = buildAudioRoutePlan(
      legacy({
        gamingDiscordPreset: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        audioOutputDeviceId: null,
      }),
      outputs,
      inputs,
    ).notice
    assert.match(noneSelected ?? '', /Output list/)
    assert.doesNotMatch(noneSelected ?? '', /disconnected/)
  })

  it('reports Hear Myself from the live route without opening another microphone', () => {
    const settings = legacy({
      gamingDiscordPreset: true,
      hearMyself: true,
      voiceChatMicrophoneDeviceId: 'asus-in',
      audioOutputDeviceId: 'phones',
      monitorMicrophoneLocally: false,
    })
    const off = buildAudioRoutePlan(settings, outputs, inputs).plan
    const on = buildAudioRoutePlan(
      { ...settings, monitorMicrophoneLocally: true },
      outputs,
      inputs,
    ).plan
    assert.equal(isMicrophoneMonitoring(off, settings), false)
    assert.equal(isMicrophoneMonitoring(on, { ...settings, monitorMicrophoneLocally: true }), true)
    assert.equal(on.microphoneDeviceId, off.microphoneDeviceId)
    assert.equal(on.voiceSinkId, 'cable-in')
    assert.equal(headphonesCanMonitor('CABLE Input (VB-Audio Virtual Cable)'), false)
    assert.equal(headphonesCanMonitor('Headset Earphone'), true)
    assert.match(HEAR_MYSELF_HEADPHONE_ERROR, /headphones/i)
  })
})

describe('manual checklist', () => {
  it('names the settings this app cannot change without naming a brand', () => {
    assert.equal(GAMING_DISCORD_CHECKLIST.length, 3)
    assert.match(GAMING_DISCORD_CHECKLIST[0], /Discord/)
    assert.match(GAMING_DISCORD_CHECKLIST[0], /CABLE Output/)
    assert.match(GAMING_DISCORD_CHECKLIST[0], /CABLE Input/)
    assert.match(GAMING_DISCORD_CHECKLIST[1], /game/)
    assert.match(GAMING_DISCORD_CHECKLIST[2], /Windows/)
    for (const step of GAMING_DISCORD_CHECKLIST) {
      assert.match(step, /cannot change/)
      assert.equal(/ASUS|Fifine/i.test(step), false)
    }
  })
})
