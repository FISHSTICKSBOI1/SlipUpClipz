import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyAudioRoute, type AudioRouteHost } from './audioRouteController.ts'
import {
  buildAudioRoutePlan,
  microphoneTargets,
  type AudioRoutePlan,
  type ListedAudioDevice,
} from './gamingAudioRouting.ts'

const outputs: ListedAudioDevice[] = [
  { deviceId: 'cable-in', label: 'CABLE Input (VB-Audio Virtual Cable)' },
  { deviceId: 'phones', label: 'Headset Earphone (CORSAIR VOID ELITE Wireless Gaming Dongle)' },
]

const inputs: ListedAudioDevice[] = [
  { deviceId: 'asus-in', label: 'AI Noise-cancelling Input (ASUS Utility)' },
  { deviceId: 'fifine', label: 'Microphone (fifine Microphone)' },
]

function presetPlan(): AudioRoutePlan {
  return buildAudioRoutePlan(
    {
      gamingDiscordPreset: true,
      hearMyself: false,
      mixerMicrophoneEnabled: false,
      audioOutputDeviceId: 'phones',
      audioInputDeviceId: 'fifine',
      routeToVBCable: false,
      voiceChatMicrophoneDeviceId: 'asus-in',
      monitorMicrophoneLocally: true,
    },
    outputs,
    inputs,
  ).plan
}

function legacyPlan(microphone: boolean): AudioRoutePlan {
  return buildAudioRoutePlan(
    {
      gamingDiscordPreset: false,
      hearMyself: true,
      mixerMicrophoneEnabled: microphone,
      audioOutputDeviceId: 'phones',
      audioInputDeviceId: 'fifine',
      routeToVBCable: false,
      voiceChatMicrophoneDeviceId: null,
      monitorMicrophoneLocally: null,
    },
    outputs,
    inputs,
  ).plan
}

function recordingHost(fail?: { sink?: string; microphone?: string }): {
  host: AudioRouteHost
  calls: string[]
  openCount: number
} {
  const calls: string[] = []
  let microphoneOpen = false
  let opens = 0
  const host: AudioRouteHost = {
    async closeMicrophone() {
      calls.push('close-mic')
      microphoneOpen = false
    },
    async closeVoice() {
      calls.push('close-voice')
    },
    async closeLocal() {
      calls.push('close-local')
    },
    async createVoice() {
      calls.push('create-voice')
    },
    async createLocal() {
      calls.push('create-local')
    },
    async setVoiceSink(plan) {
      calls.push(`voice-sink:${plan.voiceSinkId ?? 'default'}`)
      if (fail?.sink && plan.voiceSinkId === fail.sink) {
        throw new Error('The selected playback device could not be opened.')
      }
    },
    async setLocalSink(plan) {
      calls.push(`local-sink:${plan.localSinkId ?? 'default'}`)
      if (fail?.sink && plan.localSinkId === fail.sink) {
        throw new Error('The selected playback device could not be opened.')
      }
    },
    async resumeVoice() {
      calls.push('resume-voice')
    },
    async resumeLocal() {
      calls.push('resume-local')
    },
    async openMicrophone(plan) {
      if (microphoneOpen) throw new Error('duplicate microphone capture')
      calls.push(`open:${plan.microphoneDeviceId}`)
      if (fail?.microphone && plan.microphoneDeviceId === fail.microphone) {
        throw new Error('Microphone is unavailable.')
      }
      microphoneOpen = true
      opens += 1
    },
    attachMicrophone(target) {
      calls.push(`attach:${target}`)
    },
    detachMicrophone(target) {
      calls.push(`detach:${target}`)
    },
  }
  return {
    host,
    calls,
    get openCount() {
      return opens
    },
  }
}

describe('audio route controller', () => {
  it('opens one microphone onto the voice graph before any pad', async () => {
    const recorded = recordingHost()
    const result = await applyAudioRoute(recorded.host, presetPlan(), null)
    assert.equal(result.ok, true)
    assert.deepEqual(result.microphoneTargets, ['voice', 'local'])
    assert.equal(recorded.openCount, 1)
    const openAt = recorded.calls.indexOf('open:asus-in')
    const attachAt = recorded.calls.indexOf('attach:voice')
    const localAt = recorded.calls.indexOf('attach:local')
    const createAt = recorded.calls.indexOf('create-voice')
    const sinkAt = recorded.calls.indexOf('voice-sink:cable-in')
    assert.ok(createAt >= 0 && sinkAt > createAt && openAt > sinkAt && attachAt > openAt)
    assert.ok(localAt > attachAt)
    assert.equal(recorded.calls.filter((call) => call.startsWith('open:')).length, 1)
    assert.equal(recorded.calls.includes('create-local'), true)
    assert.ok(recorded.calls.indexOf('create-local') > recorded.calls.indexOf('voice-sink:cable-in'))
  })

  it('reconnects a changed output and releases the previous graph first', async () => {
    const recorded = recordingHost()
    const first = legacyPlan(true)
    await applyAudioRoute(recorded.host, first, null)
    recorded.calls.length = 0
    const moved: AudioRoutePlan = { ...first, voiceSinkId: 'cable-in', voiceSinkExplicit: true }
    const result = await applyAudioRoute(recorded.host, moved, first)
    assert.equal(result.ok, true)
    assert.equal(recorded.calls[0], 'close-mic')
    assert.ok(recorded.calls.indexOf('close-voice') < recorded.calls.indexOf('create-voice'))
    assert.ok(recorded.calls.includes('voice-sink:cable-in'))
    assert.equal(recorded.calls.includes('voice-sink:default'), false)
    assert.equal(recorded.openCount, 2)
  })

  it('restores the previous route when an explicit device fails', async () => {
    const recorded = recordingHost({ sink: 'bad' })
    const previous = legacyPlan(true)
    await applyAudioRoute(recorded.host, previous, null)
    recorded.calls.length = 0
    const failed: AudioRoutePlan = { ...previous, voiceSinkId: 'bad', voiceSinkExplicit: true }
    const result = await applyAudioRoute(recorded.host, failed, previous)
    assert.equal(result.ok, false)
    assert.equal(result.restored, true)
    assert.equal(recorded.calls.includes('voice-sink:bad'), true)
    assert.equal(recorded.calls.includes('voice-sink:default'), false)
    const failure = recorded.calls.indexOf('voice-sink:bad')
    const restored = recorded.calls.indexOf('voice-sink:phones', failure + 1)
    assert.ok(restored > failure)
    assert.deepEqual(result.microphoneTargets, ['voice'])
  })

  it('does not open a replacement microphone when the selected one fails', async () => {
    const recorded = recordingHost({ microphone: 'asus-in' })
    const previous = legacyPlan(true)
    await applyAudioRoute(recorded.host, previous, null)
    recorded.calls.length = 0
    const result = await applyAudioRoute(recorded.host, presetPlan(), previous)
    assert.equal(result.ok, false)
    assert.equal(result.restored, true)
    assert.equal(recorded.calls.filter((call) => call.startsWith('open:')).join(','), 'open:asus-in,open:fifine')
    assert.equal(recorded.calls.includes('open:virtual-line'), false)
  })

  it('returns to the legacy plan without a second microphone capture', async () => {
    const recorded = recordingHost()
    const preset = presetPlan()
    await applyAudioRoute(recorded.host, preset, null)
    const legacy = legacyPlan(false)
    const result = await applyAudioRoute(recorded.host, legacy, preset)
    assert.equal(result.ok, true)
    assert.deepEqual(result.microphoneTargets, [])
    assert.equal(recorded.calls.filter((call) => call.startsWith('open:')).length, 1)
    assert.equal(legacy.mode, 'legacy')
    assert.equal(legacy.protectWithoutDucking, false)
  })

  it('taps Hear Myself onto the open voice microphone without a second capture', async () => {
    const recorded = recordingHost()
    const padsOnly = buildAudioRoutePlan(
      {
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: true,
        audioOutputDeviceId: 'phones',
        audioInputDeviceId: 'fifine',
        routeToVBCable: true,
        voiceChatMicrophoneDeviceId: 'asus-in',
        monitorMicrophoneLocally: false,
      },
      outputs,
      inputs,
    ).plan
    await applyAudioRoute(recorded.host, padsOnly, null)
    assert.deepEqual(microphoneTargets(padsOnly), ['voice'])
    recorded.calls.length = 0
    const hearing = { ...padsOnly, localMicrophone: true }
    const result = await applyAudioRoute(recorded.host, hearing, padsOnly)
    assert.equal(result.ok, true)
    assert.deepEqual(result.microphoneTargets, ['voice', 'local'])
    assert.equal(recorded.openCount, 1)
    assert.equal(recorded.calls.includes('close-voice'), false)
    assert.equal(recorded.calls.includes('close-mic'), false)
    assert.equal(recorded.calls.includes('open:asus-in'), false)
    assert.equal(recorded.calls.includes('attach:local'), true)
    assert.equal(hearing.voiceSinkId, 'cable-in')
    assert.equal(hearing.microphoneDeviceId, 'asus-in')
  })

  it('turns headphone microphone monitoring off without dropping voice chat', async () => {
    const recorded = recordingHost()
    const hearing = buildAudioRoutePlan(
      {
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: false,
        audioOutputDeviceId: 'phones',
        audioInputDeviceId: 'fifine',
        routeToVBCable: false,
        voiceChatMicrophoneDeviceId: 'asus-in',
        monitorMicrophoneLocally: true,
      },
      outputs,
      inputs,
    ).plan
    await applyAudioRoute(recorded.host, hearing, null)
    recorded.calls.length = 0
    const silent = { ...hearing, localMicrophone: false }
    const result = await applyAudioRoute(recorded.host, silent, hearing)
    assert.equal(result.ok, true)
    assert.deepEqual(result.microphoneTargets, ['voice'])
    assert.equal(recorded.calls.includes('detach:local'), true)
    assert.equal(recorded.calls.includes('close-voice'), false)
    assert.equal(recorded.calls.includes('close-mic'), false)
    assert.equal(recorded.openCount, 1)
  })

  it('keeps voice chat when the headphone device cannot be opened', async () => {
    const recorded = recordingHost({ sink: 'missing-phones' })
    const current = buildAudioRoutePlan(
      {
        gamingDiscordPreset: true,
        hearMyself: true,
        mixerMicrophoneEnabled: false,
        audioOutputDeviceId: 'phones',
        audioInputDeviceId: 'fifine',
        routeToVBCable: false,
        voiceChatMicrophoneDeviceId: 'asus-in',
        monitorMicrophoneLocally: false,
      },
      outputs,
      inputs,
    ).plan
    await applyAudioRoute(recorded.host, current, null)
    recorded.calls.length = 0
    const failed = { ...current, localSinkId: 'missing-phones' }
    const result = await applyAudioRoute(recorded.host, failed, current)
    assert.equal(result.ok, false)
    assert.equal(result.restored, true)
    assert.equal(recorded.calls.includes('close-voice'), false)
    assert.equal(recorded.calls.includes('close-mic'), false)
    assert.match(result.message ?? '', /could not be opened/)
    assert.equal(recorded.calls.includes('local-sink:phones'), true)
  })
})
